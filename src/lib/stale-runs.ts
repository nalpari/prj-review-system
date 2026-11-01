import type PocketBase from "pocketbase";
// 확장자를 붙여 import한다: scripts/rules.test.mjs가 node로 직접 불러 검사한다.
import { transition } from "./run-state.ts";
import type { ReviewRequest } from "./types";

// 실행기는 5초마다 heartbeat_at을 갱신한다(runner.ts). 이보다 오래 갱신이 없으면 실행기가 사라진 것으로 본다
// (앱 서버 재시작·프로세스 종료). 대기는 응답 직후 바로 실행으로 넘어가므로, 오래 대기면 실행이 시작되지 못한 것이다.
export const STALE_RUNNING_MS = 2 * 60_000;
export const STALE_QUEUED_MS = 2 * 60_000;

const RUNNING_MSG = "실행기가 응답 없이 멈췄습니다(앱 서버 재시작 등으로 실행이 중단됐을 수 있습니다). 재시도하세요.";
const QUEUED_MSG = "실행이 시작되지 않았습니다(앱 서버 재시작 등으로 대기 중인 요청이 유실됐을 수 있습니다). 재시도하세요.";

type Row = Pick<ReviewRequest, "id"> & { run_id: string };

// 오래 멈춘 실행·대기를 실패로 돌리고 돌린 개수를 돌려준다.
// 실패 전이는 비교 후 쓰기라서, 목록을 읽은 뒤 실행이 끝났거나 다른 시도가 시작됐으면 건드리지 않는다.
export async function failStaleRuns(pb: PocketBase, now = Date.now()): Promise<number> {
  const runningCutoff = new Date(now - STALE_RUNNING_MS);
  const queuedCutoff = new Date(now - STALE_QUEUED_MS);
  const finished_at = new Date(now).toISOString();
  const [running, queued] = await Promise.all([
    pb.collection("review_requests").getFullList<Row>({
      // heartbeat_at이 없는 행은 이 필드가 생기기 전에 시작된 실행이다. 시작 시각으로 판단한다.
      filter: pb.filter("status = 'running' && ((heartbeat_at != '' && heartbeat_at < {:c}) || (heartbeat_at = '' && started_at < {:c}))", { c: runningCutoff }),
      fields: "id,run_id",
    }),
    pb.collection("review_requests").getFullList<Row>({
      filter: pb.filter("status = 'queued' && updated < {:c}", { c: queuedCutoff }),
      fields: "id,run_id",
    }),
  ]);
  let n = 0;
  for (const r of running) if (await transition(pb, r.id, ["running"], { status: "failed", error: RUNNING_MSG, finished_at }, r.run_id)) n++;
  for (const r of queued) if (await transition(pb, r.id, ["queued"], { status: "failed", error: QUEUED_MSG, finished_at })) n++;
  return n;
}
