import "server-only";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import path from "node:path";
import { maskSecrets } from "./mask";
import type { Commit, DiffStats } from "./types";

const run = promisify(execFile);
const MAX_DIFF = 4_000_000;

async function git(repoPath: string, args: string[]) {
  // 셸을 거치지 않고 인자 배열로 호출한다. 브랜치명은 아래에서 따로 검증한다.
  const { stdout } = await run("git", ["-C", repoPath, ...args], { maxBuffer: 64 * 1024 * 1024, timeout: 20_000 });
  return stdout;
}

export class GitError extends Error {
  constructor(message: string, public detail = "") {
    super(message);
  }
}

async function guard<T>(fn: () => Promise<T>, what: string): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    const msg = (e as { stderr?: string }).stderr?.trim() || (e as Error).message;
    throw new GitError(what, msg.split("\n")[0]);
  }
}

// 원격 저장소는 서버의 REPOS_DIR 아래 bare 클론으로 둔다. 원격 브랜치가 클론의 refs/heads로 그대로 들어오므로
// 브랜치·커밋·diff 읽기는 로컬 저장소와 같은 코드를 쓴다. 인증은 서버의 git 자격증명(SSH 키, credential helper)을 쓴다.
const NO_PROMPT = { ...process.env, GIT_TERMINAL_PROMPT: "0", GIT_SSH_COMMAND: process.env.GIT_SSH_COMMAND ?? "ssh -o BatchMode=yes" };

export function reposDir() {
  // 런타임 데이터 디렉터리라 배포 산출물 추적에서 뺀다(빼지 않으면 프로젝트 전체가 추적된다).
  return path.resolve(/*turbopackIgnore: true*/ process.env.REPOS_DIR || path.join(process.cwd(), ".data", "repos"));
}

// https·ssh URL과 scp 형식(git@host:org/repo.git)만 받는다. 자격증명은 URL에 넣지 않는다(저장되고 화면에 보인다).
export function checkRemoteUrl(url: string): string | undefined {
  if (/^[\w.-]+@[\w.-]+:[\w./~-]+$/.test(url)) return;
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return "원격 URL 형식이 아닙니다. https://… 또는 git@host:org/repo.git 형식으로 입력하세요.";
  }
  if (u.protocol !== "https:" && u.protocol !== "ssh:") return "https 또는 ssh 원격 URL만 등록할 수 있습니다.";
  if (u.password || (u.protocol === "https:" && u.username)) return "URL에 계정·토큰을 넣지 마세요. 서버의 git 자격증명(SSH 키, credential helper)으로 인증합니다.";
}

export async function cloneRemote(url: string, dest: string) {
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await guard(() => run("git", ["clone", "--bare", "--", url, dest], { env: NO_PROMPT, timeout: 600_000, maxBuffer: 16 * 1024 * 1024 }), "원격 저장소를 클론할 수 없습니다");
  // bare 클론은 기본 fetch refspec이 없어서, 이후 fetch가 브랜치를 갱신하도록 지정한다.
  await git(dest, ["config", "remote.origin.fetch", "+refs/heads/*:refs/heads/*"]);
}

// 같은 저장소에 fetch가 겹치면 git 잠금 오류가 나므로 진행 중인 fetch를 함께 기다린다.
const fetching = new Map<string, Promise<void>>();
export function syncRemote(repoPath: string): Promise<void> {
  let p = fetching.get(repoPath);
  if (!p) {
    p = guard(() => run("git", ["-C", repoPath, "fetch", "--prune", "origin"], { env: NO_PROMPT, timeout: 120_000 }), "원격 저장소에서 최신 브랜치를 받아오지 못했습니다")
      .then(() => undefined)
      .finally(() => fetching.delete(repoPath));
    fetching.set(repoPath, p);
  }
  return p;
}

export async function listBranches(repoPath: string): Promise<string[]> {
  const out = await guard(() => git(repoPath, ["for-each-ref", "--format=%(refname:short)", "refs/heads"]), "브랜치 목록을 읽을 수 없습니다");
  return out.split("\n").filter(Boolean);
}

async function assertBranch(repoPath: string, name: string) {
  if (!/^[\w./-]+$/.test(name) || name.startsWith("-")) throw new GitError(`허용되지 않는 브랜치 이름입니다: ${name}`);
  await guard(() => git(repoPath, ["rev-parse", "--verify", "--quiet", `refs/heads/${name}`]), `브랜치를 찾을 수 없습니다(${name})`);
}

// 타깃 브랜치에 없는 현재 브랜치의 커밋. 최신순.
export async function listCommits(repoPath: string, target: string, current: string): Promise<Commit[]> {
  await assertBranch(repoPath, target);
  await assertBranch(repoPath, current);
  const out = await guard(
    () => git(repoPath, ["log", "--format=%H%x1f%s%x1f%an%x1f%aI", "-n", "200", `${target}..${current}`]),
    "커밋 목록을 읽을 수 없습니다",
  );
  return out
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [sha, subject, author, date] = line.split("\x1f");
      return { sha, subject: maskSecrets(subject), author, date, selected: true };
    });
}

export type Collected = { stats: DiffStats; diff: string; baseSha: string; headSha: string };

// 머지 베이스 기준 diff(target...current). 저장 전에 비밀정보를 가린다.
export async function collectDiff(repoPath: string, target: string, current: string): Promise<Collected> {
  await assertBranch(repoPath, target);
  await assertBranch(repoPath, current);
  const range = `${target}...${current}`;
  const [numstat, diff, base, head] = await Promise.all([
    guard(() => git(repoPath, ["diff", "--numstat", range]), "diff 통계를 만들 수 없습니다"),
    guard(() => git(repoPath, ["diff", "--no-color", "-U3", range]), "diff를 만들 수 없습니다"),
    guard(() => git(repoPath, ["merge-base", target, current]), "공통 조상을 찾을 수 없습니다"),
    guard(() => git(repoPath, ["rev-parse", current]), "현재 브랜치 커밋을 읽을 수 없습니다"),
  ]);
  const files = numstat
    .split("\n")
    .filter(Boolean)
    .map((l) => {
      const [a, d, path] = l.split("\t");
      return { path, additions: Number(a) || 0, deletions: Number(d) || 0 };
    });
  const stats: DiffStats = {
    files,
    additions: files.reduce((s, f) => s + f.additions, 0),
    deletions: files.reduce((s, f) => s + f.deletions, 0),
    mergeBase: base.trim(),
  };
  // 잘라 저장하면 전체를 비교한 것처럼 보이면서 뒷부분이 빠진다. 크면 거부하고 범위를 줄이게 한다.
  // 마스킹은 동기 처리라 원문 크기를 먼저 확인하고, 가린 뒤 길어졌을 수 있어 한 번 더 확인한다.
  const tooBig = (n: number) =>
    new GitError(`diff가 너무 큽니다(${n.toLocaleString("ko-KR")}자, 최대 ${MAX_DIFF.toLocaleString("ko-KR")}자). 브랜치를 나누거나 비교 범위를 줄여 다시 신청하세요`);
  if (diff.length > MAX_DIFF) throw tooBig(diff.length);
  const masked = maskSecrets(diff);
  if (masked.length > MAX_DIFF) throw tooBig(masked.length);
  return {
    stats,
    diff: masked,
    baseSha: base.trim(),
    headSha: head.trim(),
  };
}
