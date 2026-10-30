/// <reference path="../pb_data/types.d.ts" />

// 적대적 리뷰 반영:
// - 일반 사용자 토큰으로는 리뷰 결과·실행 상태·댓글·이력을 직접 쓰지 못한다. 이 쓰기는 서버(서비스 클라이언트)만 한다.
//   서버는 쓰기 전에 사용자 토큰으로 접근 권한을 확인하고, 자유 텍스트를 마스킹한 뒤 저장한다.
// - 구성원이 자기 role을 바꾸지 못한다. 계정 생성과 role 변경은 시스템 관리자만.
// - 하위 레코드(이슈·댓글·이력)도 저장소 보존 상태를 직접 확인한다.
migrate((app) => {
  const admin = "@request.auth.role = 'admin'";

  const users = app.findCollectionByNameOrId("users");
  users.createRule = admin;
  users.updateRule = `(id = @request.auth.id && @request.body.role:isset = false) || ${admin}`;
  app.save(users);

  const steward =
    "(@request.auth.role = 'admin' || (@collection.memberships.user ?= @request.auth.id && @collection.memberships.team ?= repository.team && (@collection.memberships.role ?= 'lead' || @collection.memberships.role ?= 'manager')))";
  const locked = [
    "repository", "requester", "current_branch", "target_branch", "base_sha", "head_sha", "commits", "context", "model",
    "status", "idempotency_key", "diff_stats", "diff", "summary", "partial", "error", "started_at", "finished_at",
  ].map((f) => `@request.body.${f}:isset = false`).join(" && ");
  const requests = app.findCollectionByNameOrId("review_requests");
  requests.createRule = null;
  // 보존 권한자가 retention만 바꿀 수 있다.
  requests.updateRule = `${steward} && retention != 'deleted' && ${locked}`;
  app.save(requests);

  const reqMember =
    "request.repository.team.memberships_via_team.user ?= @request.auth.id && request.retention = 'retained' && request.repository.retention = 'retained'";

  const issues = app.findCollectionByNameOrId("issues");
  issues.listRule = reqMember;
  issues.viewRule = reqMember;
  issues.createRule = null;
  const issueLocked = ["request", "file", "line_start", "line_end", "severity", "title", "body", "suggestion", "model"]
    .map((f) => `@request.body.${f}:isset = false`).join(" && ");
  issues.updateRule = `${reqMember} && ${issueLocked}`; // 상태만 바꿀 수 있다
  app.save(issues);

  for (const name of ["comments", "issue_events"]) {
    const c = app.findCollectionByNameOrId(name);
    c.listRule = reqMember;
    c.viewRule = reqMember;
    c.createRule = null;
    c.updateRule = null;
    c.deleteRule = null;
    app.save(c);
  }
}, (app) => {
  const users = app.findCollectionByNameOrId("users");
  users.createRule = null;
  users.updateRule = "id = @request.auth.id";
  app.save(users);
});
