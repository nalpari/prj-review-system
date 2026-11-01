import "server-only";
import { execFile, spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import type PocketBase from "pocketbase";
import { maskSecrets } from "./mask";
import { pbService } from "./pb-service";
import { buildPrompt, parseReview } from "./review-output";
import { runAttempt, transition } from "./run-state";
import type { Model, Repository, ReviewRequest } from "./types";

const run = promisify(execFile);
const WIN = process.platform === "win32";
const TIMEOUT_MS = Number(process.env.REVIEW_TIMEOUT_MS) || 20 * 60_000;
// 프롬프트에 넣을 diff 상한(문자 수). 넘으면 모델 문맥 한도에 걸리기 전에 범위를 줄이게 한다.
const MAX_PROMPT_DIFF = 800_000;
const MAX_OUTPUT = 20 * 1024 * 1024;
const POLL_MS = 5000;

type Proc = { code: number | null; stdout: string; stderr: string; killed?: "timeout" | "canceled" };

// 서버에 설치·인증된 CLI를 헤드리스로 실행한다. 프롬프트는 stdin으로 넘기고, 인자는 고정 플래그만 쓴다.
type Adapter = {
  bin: string;
  label: string;
  args: (tmp: string) => string[];
  // 실행 결과에서 모델의 최종 응답 텍스트를 꺼낸다. 실패면 사용자에게 보일 메시지로 예외를 던진다.
  read: (p: Proc, tmp: string) => Promise<string>;
};

const tail = (s: string, n = 600) => maskSecrets(s.trim()).slice(-n);

const ADAPTERS: Record<Model, Adapter> = {
  claude: {
    bin: "claude",
    label: "Claude",
    // 읽기 도구만 열고(--restricted: 명령 실행 도구 제거, 작업 디렉터리 밖 접근 차단), 사용자 설정·MCP·세션 기록은 쓰지 않는다.
    args: () => ["-p", "--output-format", "json", "--tools", "Read,Grep,Glob", "--restricted", "--strict-mcp-config", "--no-session-persistence", "--permission-mode", "dontAsk"],
    read: async (p) => {
      let out: { is_error?: boolean; subtype?: string; result?: string } | undefined;
      try {
        out = JSON.parse(p.stdout);
      } catch {
        // 아래에서 종료 코드와 stderr로 원인을 알린다.
      }
      if (!out) throw new Error(`종료 코드 ${p.code}. ${tail(p.stderr || p.stdout) || "출력이 없습니다."}`);
      if (out.is_error || out.subtype !== "success") throw new Error(tail(out.result || out.subtype || "알 수 없는 오류"));
      return out.result ?? "";
    },
  },
  codex: {
    bin: "codex",
    label: "Codex",
    // 샌드박스는 읽기 전용, 세션 파일은 남기지 않는다. 마지막 응답만 파일로 받는다.
    args: (tmp) => ["exec", "--sandbox", "read-only", "--ephemeral", "--color", "never", "-o", path.join(tmp, "last-message.txt"), "-"],
    read: async (p, tmp) => {
      if (p.code !== 0) throw new Error(`종료 코드 ${p.code}. ${tail(p.stderr || p.stdout) || "출력이 없습니다."}`);
      return fs.readFile(path.join(tmp, "last-message.txt"), "utf8");
    },
  },
};

async function available(bin: string) {
  try {
    // Windows에는 which가 없다. where는 PATH의 claude.cmd 같은 실행 파일도 찾는다.
    await run(WIN ? "where" : "which", [bin], { timeout: 3000 });
    return true;
  } catch {
    return false;
  }
}

// Windows의 npm 전역 CLI는 .cmd 래퍼라 셸로만 실행된다. 인자는 고정 플래그와 임시 경로뿐이고, 공백 등이 있으면 따옴표로 감싼다.
const winArg = (a: string) => (/^[\w./:\\=-]+$/.test(a) ? a : `"${a}"`);

function killTree(pid: number | undefined) {
  if (!pid) return;
  if (WIN) execFile("taskkill", ["/pid", String(pid), "/T", "/F"], () => {});
  else {
    try {
      process.kill(-pid, "SIGTERM"); // detached로 띄운 프로세스 그룹 전체
    } catch {
      // 이미 끝났다.
    }
  }
}

// CLI에는 실행·로그인에 필요한 환경변수만 넘긴다. 리뷰 대상 코드에 심은 프롬프트 인젝션이 셸로 env를 읽어
// 결과에 적는 경로를 막기 위해서다(PB_SUPERUSER_PASSWORD 등 앱 서버 비밀을 물려주지 않는다).
// CLI 인증 파일(~/.claude, ~/.codex)은 여전히 읽을 수 있으므로, 배포 때는 별도 OS 사용자·컨테이너로 격리한다.
const ENV_ALLOW = [
  "PATH", "PATHEXT", "HOME", "USERPROFILE", "HOMEDRIVE", "HOMEPATH", "APPDATA", "LOCALAPPDATA", "PROGRAMDATA",
  "SystemRoot", "SYSTEMROOT", "windir", "ComSpec", "TEMP", "TMP", "TMPDIR", "LANG", "LC_ALL", "LC_CTYPE",
  "XDG_CONFIG_HOME", "XDG_DATA_HOME", "XDG_CACHE_HOME", "XDG_STATE_HOME", "CLAUDE_CONFIG_DIR", "CODEX_HOME",
  "HTTP_PROXY", "HTTPS_PROXY", "NO_PROXY", "http_proxy", "https_proxy", "no_proxy", "SSL_CERT_FILE", "NODE_EXTRA_CA_CERTS",
];
export function childEnv(src: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const env: Record<string, string | undefined> = {};
  const seen = new Set<string>();
  for (const k of ENV_ALLOW) {
    // Windows의 환경변수 이름은 대소문자를 가리지 않는다. 같은 변수를 두 번 넘기지 않는다.
    const id = WIN ? k.toUpperCase() : k;
    if (src[k] === undefined || seen.has(id)) continue;
    seen.add(id);
    env[k] = src[k];
  }
  return env as NodeJS.ProcessEnv; // Next 타입은 NODE_ENV를 필수로 둔다. 자식 CLI에는 넘기지 않는다.
}

function spawnCli(bin: string, args: string[], cwd: string, input: string, signal: AbortSignal): Promise<Proc> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, WIN ? args.map(winArg) : args, { cwd, env: childEnv(), shell: WIN, detached: !WIN, windowsHide: true });
    let stdout = "";
    let stderr = "";
    let killed: Proc["killed"];
    const kill = (why: NonNullable<Proc["killed"]>) => {
      killed ??= why;
      killTree(child.pid);
    };
    const timer = setTimeout(() => kill("timeout"), TIMEOUT_MS);
    const onAbort = () => kill("canceled");
    signal.addEventListener("abort", onAbort, { once: true });
    child.stdout.setEncoding("utf8").on("data", (d: string) => {
      if (stdout.length < MAX_OUTPUT) stdout += d;
    });
    child.stderr.setEncoding("utf8").on("data", (d: string) => {
      if (stderr.length < MAX_OUTPUT) stderr += d;
    });
    child.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      signal.removeEventListener("abort", onAbort);
      resolve({ code, stdout, stderr, killed });
    });
    child.stdin.on("error", () => {}); // CLI가 입력을 다 읽기 전에 끝나면 EPIPE가 난다. 결과는 close에서 판단한다.
    child.stdin.end(input);
  });
}

// 주기마다 heartbeat_at을 갱신해 실행기가 살아 있음을 남긴다(stale-runs.ts가 오래 멈춘 실행을 실패로 돌린다).
// 갱신은 이 시도가 아직 유효할 때만 된다. 취소되거나 재시도로 다른 시도가 시작됐으면 실행 중인 CLI를 멈춘다.
function watchAttempt(pb: PocketBase, id: string, runId: string, ctrl: AbortController) {
  const timer = setInterval(async () => {
    try {
      if (!(await transition(pb, id, ["running"], { heartbeat_at: new Date().toISOString() }, runId))) ctrl.abort();
    } catch {
      // 일시적인 연결 실패는 다음 주기에 다시 한다.
    }
  }, POLL_MS);
  return () => clearInterval(timer);
}

// 리뷰 대상 커밋을 임시 작업 폴더로 꺼낸다. 원본 저장소(bare 클론)는 건드리지 않는다.
async function checkout(repoPath: string, sha: string, dir: string) {
  await run("git", ["-C", repoPath, "worktree", "add", "--detach", dir, sha], { timeout: 300_000 });
}

async function removeCheckout(repoPath: string, dir: string) {
  await run("git", ["-C", repoPath, "worktree", "remove", "--force", dir]).catch(() => {});
  await run("git", ["-C", repoPath, "worktree", "prune"]).catch(() => {});
}

const failed = (error: string) => ({ status: "failed" as const, error: maskSecrets(error).slice(0, 2000) });

// 실행 상태와 결과는 서비스 클라이언트로만 쓴다(사용자 토큰으로는 쓸 수 없다).
// 프로세스 내 잠금은 두지 않는다. queued → running 점유가 원자적이라 같은 요청이 두 번 실행되지 않고,
// 취소된 시도가 아직 돌고 있으면 watchAttempt가 멈추고, 결과를 쓰지 못한 채 끝난다.
export async function startRun(req: ReviewRequest): Promise<void> {
  const adapter = ADAPTERS[req.model];
  const svc = await pbService();

  await runAttempt(svc, req.id, async (runId) => {
    if (!(await available(adapter.bin))) {
      return failed(`${adapter.label} 로컬 실행 환경을 찾을 수 없습니다. 이 서버에서 '${adapter.bin}' 명령이 인증된 상태로 실행되는지 확인한 뒤 재시도하세요.`);
    }
    const fresh = await svc.collection("review_requests").getOne<ReviewRequest>(req.id);
    const diff = fresh.diff;
    if (!diff) return failed("저장된 diff가 없어 리뷰할 수 없습니다. 리뷰를 새로 요청하세요.");
    if (diff.length > MAX_PROMPT_DIFF) {
      return failed(`diff가 모델 실행 한도보다 큽니다(${diff.length.toLocaleString("ko-KR")}자, 최대 ${MAX_PROMPT_DIFF.toLocaleString("ko-KR")}자). 브랜치를 나누거나 범위를 줄여 다시 요청하세요.`);
    }
    const repo = await svc.collection("repositories").getOne<Repository>(fresh.repository);

    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "redline-run-"));
    const work = path.join(tmp, "src");
    const ctrl = new AbortController();
    const stopWatching = watchAttempt(svc, req.id, runId, ctrl);
    try {
      try {
        await checkout(repo.local_path, fresh.head_sha, work);
      } catch (e) {
        return failed(`리뷰 대상 커밋(${fresh.head_sha.slice(0, 10)})을 꺼내지 못했습니다. 브랜치가 강제 푸시로 바뀌었다면 리뷰를 새로 요청하세요. (${tail(String((e as { stderr?: string }).stderr || e), 300)})`);
      }

      let proc: Proc;
      try {
        proc = await spawnCli(adapter.bin, adapter.args(tmp), work, buildPrompt({ ...fresh, diff }), ctrl.signal);
      } catch (e) {
        return failed(`${adapter.label}를 실행하지 못했습니다. ${tail(String(e), 300)}`);
      }
      if (proc.killed === "canceled") return failed("실행이 취소되었습니다.");
      if (proc.killed === "timeout") return failed(`${adapter.label} 실행이 ${Math.round(TIMEOUT_MS / 60_000)}분 안에 끝나지 않아 중단했습니다. 범위를 줄이거나 재시도하세요.`);

      let text: string;
      try {
        text = await adapter.read(proc, tmp);
      } catch (e) {
        return failed(`${adapter.label} 실행이 실패했습니다. 이 서버에서 '${adapter.bin}'이 로그인된 상태인지 확인한 뒤 재시도하세요. (${(e as Error).message})`);
      }
      let parsed;
      try {
        parsed = parseReview(text);
      } catch (e) {
        return failed(`${adapter.label} 응답을 해석하지 못했습니다(${(e as Error).message}). 재시도하세요.`);
      }
      if (ctrl.signal.aborted) return failed("실행이 취소되었습니다.");

      // 이슈는 runAttempt가 완료 전이와 같은 트랜잭션에서 게시한다.
      const issues = parsed.issues.map((it) => ({
        model: req.model, status: "unread",
        file: it.file, line_start: it.line_start, line_end: it.line_end, severity: it.severity,
        title: maskSecrets(it.title), body: maskSecrets(it.body), suggestion: maskSecrets(it.suggestion),
      }));
      return { status: "completed", summary: maskSecrets(parsed.summary), partial: parsed.dropped > 0, error: "", issues };
    } catch (e) {
      return failed(`실행 중 오류가 났습니다. ${tail(String(e), 300)}`);
    } finally {
      stopWatching();
      await removeCheckout(repo.local_path, work);
      await fs.rm(tmp, { recursive: true, force: true }).catch(() => {});
    }
  });
}
