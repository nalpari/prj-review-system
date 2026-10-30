/// <reference path="../pb_data/types.d.ts" />

// 실행 상태 비교 후 쓰기(compare-and-set). 앱 서버의 runAttempt·취소·재시도가 서비스 클라이언트로 부른다.
// 저장된 status가 from 중 하나이고(runId를 주면 run_id도 같을 때) set을 쓴다. 아니면 409.
// 트랜잭션 안에서 읽고 쓰므로, 서버가 여러 대여도 두 요청이 같은 상태를 보고 둘 다 쓰는 일이 없다.
routerAdd("POST", "/api/redline/runs/{id}/transition", (e) => {
  const body = e.requestInfo().body;
  const from = Array.from(body.from || []);
  let ok = false;
  $app.runInTransaction((tx) => {
    const r = tx.findRecordById("review_requests", e.request.pathValue("id"));
    if (!from.includes(r.getString("status"))) return;
    if (body.runId !== undefined && r.getString("run_id") !== body.runId) return;
    for (const k of Object.keys(body.set || {})) r.set(k, body.set[k]);
    tx.save(r);
    ok = true;
  });
  return e.json(ok ? 200 : 409, { ok });
}, $apis.requireSuperuserAuth());
