/// <reference path="../pb_data/types.d.ts" />

// heartbeat_at: 실행기가 살아 있다는 표시. 실행 중인 시도가 5초마다 갱신하고,
// 오래 갱신되지 않은 running 요청은 앱 서버가 실패로 돌린다(서버 재시작으로 실행기가 사라진 경우).
// 사용자 토큰으로는 바꿀 수 없게 updateRule의 잠금 목록에 넣는다.
const lock = " && @request.body.heartbeat_at:isset = false";

migrate((app) => {
  const requests = app.findCollectionByNameOrId("review_requests");
  requests.fields.add(new DateField({ name: "heartbeat_at" }));
  requests.updateRule = requests.updateRule + lock;
  app.save(requests);
}, (app) => {
  const requests = app.findCollectionByNameOrId("review_requests");
  requests.fields.removeByName("heartbeat_at");
  requests.updateRule = requests.updateRule.replace(lock, "");
  app.save(requests);
});
