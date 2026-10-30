/// <reference path="../pb_data/types.d.ts" />

// 보존·삭제 권한: 시스템 관리자, 또는 해당 팀의 테크 리드·팀 관리자.
// 접근 불가로 전환된 요청은 일반 구성원 조회에서 빠지고, 권한자만 보존 화면에서 본다.
migrate((app) => {
  const member = "repository.team.memberships_via_team.user ?= @request.auth.id";
  const steward =
    "(@request.auth.role = 'admin' || (@collection.memberships.user ?= @request.auth.id && @collection.memberships.team ?= repository.team && (@collection.memberships.role ?= 'lead' || @collection.memberships.role ?= 'manager')))";
  const visible = `(${member} && retention = 'retained' && repository.retention = 'retained') || (${steward} && retention != 'deleted')`;

  const requests = app.findCollectionByNameOrId("review_requests");
  requests.listRule = visible;
  requests.viewRule = visible;
  requests.updateRule = `(${visible}) && (@request.body.retention:isset = false || ${steward})`;
  requests.deleteRule = steward;
  app.save(requests);
}, (app) => {
  const member = "repository.team.memberships_via_team.user ?= @request.auth.id";
  const visible = `${member} && retention = 'retained' && repository.retention = 'retained'`;
  const requests = app.findCollectionByNameOrId("review_requests");
  requests.listRule = visible;
  requests.viewRule = visible;
  requests.updateRule = visible;
  requests.deleteRule = "@request.auth.role = 'admin'";
  app.save(requests);
});
