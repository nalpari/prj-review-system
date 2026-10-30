import PocketBase, { ClientResponseError } from "pocketbase";

export type AttemptResult = "skipped" | "superseded" | "finished";

// 저장된 status가 from 중 하나이고(runId를 주면 run_id도 같을 때만) set을 쓴다. 썼으면 true.
// 비교와 쓰기는 PocketBase 훅(pocketbase/pb_hooks/runs.pb.js)이 한 트랜잭션에서 한다. 슈퍼유저 클라이언트로만 부른다.
export async function transition(pb: PocketBase, id: string, from: string[], set: Record<string, unknown>, runId?: string) {
  try {
    await pb.send(`/api/redline/runs/${encodeURIComponent(id)}/transition`, { method: "POST", body: { from, runId, set } });
    return true;
  } catch (e) {
    if (e instanceof ClientResponseError && e.status === 409) return false;
    throw e;
  }
}

// 실행 시도 하나의 상태 전이. 대기 → 실행 중 → 실패/완료를 이 시도의 run_id가 아직 유효할 때만 쓴다.
// 그 사이 취소·재시도가 있었다면 아무것도 덮어쓰지 않는다.
export async function runAttempt(
  pb: PocketBase,
  id: string,
  execute: () => Promise<{ status: "failed" | "completed"; error?: string; summary?: string }>,
): Promise<AttemptResult> {
  const runId = crypto.randomUUID();
  if (!(await transition(pb, id, ["queued"], { status: "running", run_id: runId, started_at: new Date().toISOString(), error: "" }))) return "skipped";

  const result = await execute();

  const wrote = await transition(pb, id, ["running"], { ...result, finished_at: new Date().toISOString() }, runId);
  return wrote ? "finished" : "superseded";
}
