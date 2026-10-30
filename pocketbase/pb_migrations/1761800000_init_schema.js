/// <reference path="../pb_data/types.d.ts" />

// Redline 스키마: 팀 → 저장소 → 리뷰 요청 → 이슈 → 댓글/이력.
// 접근 범위는 팀 멤버십 하나로 판단한다. 모든 규칙은 서버(PocketBase)에서 강제된다.
migrate((app) => {
  const users = app.findCollectionByNameOrId("users");
  users.fields.add(new SelectField({ name: "role", values: ["member", "admin"], maxSelect: 1 }));
  // 계정 생성은 관리자만. 공개 가입을 막는다.
  users.createRule = null;
  users.listRule = "@request.auth.id != ''";
  users.viewRule = "@request.auth.id != ''";
  app.save(users);

  const teams = new Collection({
    type: "base",
    name: "teams",
    fields: [{ name: "name", type: "text", required: true, max: 80 }],
    createRule: "@request.auth.role = 'admin'",
    updateRule: "@request.auth.role = 'admin'",
    deleteRule: "@request.auth.role = 'admin'",
  });
  app.save(teams);

  const memberships = new Collection({
    type: "base",
    name: "memberships",
    fields: [
      { name: "team", type: "relation", collectionId: teams.id, maxSelect: 1, required: true, cascadeDelete: true },
      { name: "user", type: "relation", collectionId: users.id, maxSelect: 1, required: true, cascadeDelete: true },
      { name: "role", type: "select", values: ["developer", "reviewer", "lead", "manager"], maxSelect: 1, required: true },
      { name: "created", type: "autodate", onCreate: true },
    ],
    indexes: ["CREATE UNIQUE INDEX idx_membership_team_user ON memberships (team, user)"],
    listRule: "team.memberships_via_team.user ?= @request.auth.id || @request.auth.role = 'admin'",
    viewRule: "team.memberships_via_team.user ?= @request.auth.id || @request.auth.role = 'admin'",
    createRule: "@request.auth.role = 'admin'",
    updateRule: "@request.auth.role = 'admin'",
    deleteRule: "@request.auth.role = 'admin'",
  });
  app.save(memberships);

  // memberships가 생긴 뒤에야 역참조 규칙을 걸 수 있다.
  teams.listRule = "memberships_via_team.user ?= @request.auth.id || @request.auth.role = 'admin'";
  teams.viewRule = teams.listRule;
  app.save(teams);

  const member = "repository.team.memberships_via_team.user ?= @request.auth.id";
  const repositories = new Collection({
    type: "base",
    name: "repositories",
    fields: [
      { name: "team", type: "relation", collectionId: teams.id, maxSelect: 1, required: true, cascadeDelete: true },
      { name: "name", type: "text", required: true, max: 120 },
      { name: "local_path", type: "text", required: true, max: 500 },
      { name: "default_branch", type: "text", max: 200 },
      { name: "line_no", type: "number", onlyInt: true, min: 1, max: 99 },
      { name: "line_color", type: "text", max: 9 },
      { name: "retention", type: "select", values: ["retained", "hidden", "deleted"], maxSelect: 1 },
      { name: "created", type: "autodate", onCreate: true },
    ],
    listRule: "(team.memberships_via_team.user ?= @request.auth.id && retention != 'deleted') || @request.auth.role = 'admin'",
    viewRule: "(team.memberships_via_team.user ?= @request.auth.id && retention != 'deleted') || @request.auth.role = 'admin'",
    createRule: "@request.auth.role = 'admin'",
    updateRule: "@request.auth.role = 'admin'",
    deleteRule: "@request.auth.role = 'admin'",
  });
  app.save(repositories);

  const visible = `${member} && retention = 'retained' && repository.retention = 'retained'`;
  const requests = new Collection({
    type: "base",
    name: "review_requests",
    fields: [
      { name: "repository", type: "relation", collectionId: repositories.id, maxSelect: 1, required: true, cascadeDelete: true },
      { name: "requester", type: "relation", collectionId: users.id, maxSelect: 1, required: true },
      { name: "current_branch", type: "text", required: true, max: 250 },
      { name: "target_branch", type: "text", required: true, max: 250 },
      { name: "base_sha", type: "text", max: 64 },
      { name: "head_sha", type: "text", max: 64 },
      { name: "commits", type: "json", maxSize: 200000 },
      { name: "context", type: "text", max: 4000 },
      { name: "model", type: "select", values: ["claude", "codex"], maxSelect: 1, required: true },
      { name: "status", type: "select", values: ["queued", "running", "completed", "failed", "canceled"], maxSelect: 1, required: true },
      { name: "idempotency_key", type: "text", required: true, max: 64 },
      { name: "diff_stats", type: "json", maxSize: 200000 },
      { name: "diff", type: "text", max: 5000000 },
      { name: "summary", type: "text", max: 8000 },
      { name: "partial", type: "bool" },
      { name: "error", type: "text", max: 4000 },
      { name: "started_at", type: "date" },
      { name: "finished_at", type: "date" },
      { name: "retention", type: "select", values: ["retained", "hidden", "deleted"], maxSelect: 1, required: true },
      { name: "retention_changed_at", type: "date" },
      { name: "created", type: "autodate", onCreate: true },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
    ],
    indexes: [
      "CREATE UNIQUE INDEX idx_request_idempotency ON review_requests (idempotency_key)",
      "CREATE INDEX idx_request_created ON review_requests (created)",
    ],
    listRule: visible,
    viewRule: visible,
    createRule: `${member} && @request.body.requester = @request.auth.id`,
    // 실행 상태 전이는 서버 액션이 요청자의 토큰으로 수행한다.
    updateRule: `${visible}`,
    deleteRule: "@request.auth.role = 'admin'",
  });
  app.save(requests);

  const reqMember = "request.repository.team.memberships_via_team.user ?= @request.auth.id && request.retention = 'retained'";
  const issues = new Collection({
    type: "base",
    name: "issues",
    fields: [
      { name: "request", type: "relation", collectionId: requests.id, maxSelect: 1, required: true, cascadeDelete: true },
      { name: "file", type: "text", max: 500 },
      { name: "line_start", type: "number", onlyInt: true },
      { name: "line_end", type: "number", onlyInt: true },
      { name: "severity", type: "select", values: ["critical", "warning", "suggestion"], maxSelect: 1, required: true },
      { name: "title", type: "text", required: true, max: 300 },
      { name: "body", type: "text", max: 8000 },
      { name: "suggestion", type: "text", max: 8000 },
      { name: "model", type: "select", values: ["claude", "codex"], maxSelect: 1 },
      { name: "status", type: "select", values: ["unread", "acknowledged", "resolved", "deferred"], maxSelect: 1, required: true },
      { name: "created", type: "autodate", onCreate: true },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
    ],
    listRule: reqMember,
    viewRule: reqMember,
    createRule: reqMember,
    // 상태 외 필드는 바꾸지 못한다.
    updateRule: `${reqMember} && @request.body.title:isset = false && @request.body.body:isset = false && @request.body.request:isset = false`,
    deleteRule: null,
  });
  app.save(issues);

  const comments = new Collection({
    type: "base",
    name: "comments",
    fields: [
      { name: "issue", type: "relation", collectionId: issues.id, maxSelect: 1, required: true, cascadeDelete: true },
      { name: "request", type: "relation", collectionId: requests.id, maxSelect: 1, required: true, cascadeDelete: true },
      { name: "author", type: "relation", collectionId: users.id, maxSelect: 1, required: true },
      { name: "body", type: "text", required: true, max: 4000 },
      { name: "edited_at", type: "date" },
      { name: "deleted", type: "bool" },
      { name: "created", type: "autodate", onCreate: true },
    ],
    listRule: reqMember,
    viewRule: reqMember,
    createRule: `${reqMember} && @request.body.author = @request.auth.id`,
    updateRule: `${reqMember} && author = @request.auth.id && deleted = false && @request.body.author:isset = false`,
    deleteRule: null,
  });
  app.save(comments);

  const events = new Collection({
    type: "base",
    name: "issue_events",
    fields: [
      { name: "issue", type: "relation", collectionId: issues.id, maxSelect: 1, required: true, cascadeDelete: true },
      { name: "request", type: "relation", collectionId: requests.id, maxSelect: 1, required: true, cascadeDelete: true },
      { name: "actor", type: "relation", collectionId: users.id, maxSelect: 1, required: true },
      { name: "kind", type: "select", values: ["status", "comment", "comment_edit", "comment_delete"], maxSelect: 1, required: true },
      { name: "from", type: "text", max: 40 },
      { name: "to", type: "text", max: 40 },
      { name: "created", type: "autodate", onCreate: true },
    ],
    listRule: reqMember,
    viewRule: reqMember,
    createRule: `${reqMember} && @request.body.actor = @request.auth.id`,
    updateRule: null,
    deleteRule: null,
  });
  app.save(events);
}, (app) => {
  for (const name of ["issue_events", "comments", "issues", "review_requests", "repositories", "memberships", "teams"]) {
    app.delete(app.findCollectionByNameOrId(name));
  }
  const users = app.findCollectionByNameOrId("users");
  users.fields.removeByName("role");
  app.save(users);
});
