import "server-only";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { pbService } from "./pb-service";
import { runAttempt } from "./run-state";
import type { Model, ReviewRequest } from "./types";

const run = promisify(execFile);

// 로컬 구독 실행 환경 어댑터. 이번 단계는 환경 확인까지만 하고 실행은 다음 단계에서 붙인다.
type Adapter = { bin: string; label: string };
const ADAPTERS: Record<Model, Adapter> = {
  claude: { bin: "claude", label: "Claude" },
  codex: { bin: "codex", label: "Codex" },
};

async function available(bin: string) {
  try {
    await run("which", [bin], { timeout: 3000 });
    return true;
  } catch {
    return false;
  }
}

// 실행 상태와 결과는 서비스 클라이언트로만 쓴다(사용자 토큰으로는 쓸 수 없다).
// 프로세스 내 잠금은 두지 않는다. queued → running 점유가 원자적이라 같은 요청이 두 번 실행되지 않고,
// 취소된 시도가 아직 돌고 있어도 재시도는 바로 새 시도로 시작한다(이전 시도는 결과를 쓰지 못하고 끝난다).
export async function startRun(req: ReviewRequest): Promise<void> {
  const adapter = ADAPTERS[req.model];
  await runAttempt(await pbService(), req.id, async () => {
    const ok = await available(adapter.bin);
    return {
      status: "failed",
      error: ok
        ? `${adapter.label} 로컬 실행 어댑터가 아직 연결되지 않았습니다. 실행 연동이 붙으면 재시도하세요.`
        : `${adapter.label} 로컬 실행 환경을 찾을 수 없습니다. 이 서버에서 '${adapter.bin}' 명령이 인증된 상태로 실행되는지 확인한 뒤 재시도하세요.`,
    };
  });
}
