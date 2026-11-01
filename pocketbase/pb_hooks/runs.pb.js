/// <reference path="../pb_data/types.d.ts" />

// 실행 상태 비교 후 쓰기(compare-and-set). 앱 서버의 runAttempt·취소·재시도가 서비스 클라이언트로 부른다.
// 저장된 status가 from 중 하나이고(runId를 주면 run_id도 같을 때) set을 쓴다. 아니면 409.
// 트랜잭션 안에서 읽고 쓰므로, 서버가 여러 대여도 두 요청이 같은 상태를 보고 둘 다 쓰는 일이 없다.
// - staleBefore: 실행 중이면 heartbeat_at(없으면 started_at), 대기면 updated가 이 시각보다 이전일 때만 쓴다.
//   정리 작업이 목록을 읽은 뒤 실행기가 하트비트를 갱신했으면 살아 있는 실행을 실패로 돌리지 않는다.
// - issues: 완료와 함께 게시할 이슈. 이 요청의 기존 이슈를 지우고 같은 트랜잭션에서 만든다.
//   일부만 저장된 채 실패하거나 이전 시도의 이슈가 재시도 결과에 섞이는 일이 없다.
routerAdd("POST", "/api/redline/runs/{id}/transition", (e) => {
  const body = e.requestInfo().body;
  const from = Array.from(body.from || []);
  let ok = false;
  $app.runInTransaction((tx) => {
    const r = tx.findRecordById("review_requests", e.request.pathValue("id"));
    const status = r.getString("status");
    if (!from.includes(status)) return;
    if (body.runId !== undefined && r.getString("run_id") !== body.runId) return;
    if (body.staleBefore !== undefined) {
      const at = (f) => r.getString(f) ? Date.parse(r.getString(f).replace(" ", "T")) : NaN;
      const seen = status === "running" ? (r.getString("heartbeat_at") ? at("heartbeat_at") : at("started_at")) : at("updated");
      if (seen >= Date.parse(body.staleBefore)) return;
    }
    for (const k of Object.keys(body.set || {})) r.set(k, body.set[k]);
    tx.save(r);
    if (body.issues !== undefined) {
      for (const old of tx.findRecordsByFilter("issues", "request = {:id}", "", 0, 0, { id: r.id })) tx.delete(old);
      const col = tx.findCollectionByNameOrId("issues");
      for (const it of Array.from(body.issues)) {
        const rec = new Record(col);
        for (const k of Object.keys(it)) rec.set(k, it[k]);
        rec.set("request", r.id);
        tx.save(rec);
      }
    }
    ok = true;
  });
  return e.json(ok ? 200 : 409, { ok });
}, $apis.requireSuperuserAuth());
