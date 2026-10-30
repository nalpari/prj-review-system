/// <reference path="../pb_data/types.d.ts" />

// - 접근 불가(hidden)로 돌린 저장소는 일반 구성원에게 보이지 않는다(조회 자체가 막혀 Git 엔드포인트·리뷰 생성도 막힌다).
// - run_id: 실행 시도 식별자. 실행기는 저장된 상태와 run_id가 자기 것일 때만 결과를 쓴다(취소·재시도 덮어쓰기 방지).
migrate((app) => {
  const repos = app.findCollectionByNameOrId("repositories");
  const repoView = "(team.memberships_via_team.user ?= @request.auth.id && retention = 'retained') || @request.auth.role = 'admin'";
  repos.listRule = repoView;
  repos.viewRule = repoView;
  app.save(repos);

  const requests = app.findCollectionByNameOrId("review_requests");
  requests.fields.add(new TextField({ name: "run_id", max: 64 }));
  const steward =
    "(@request.auth.role = 'admin' || (@collection.memberships.user ?= @request.auth.id && @collection.memberships.team ?= repository.team && (@collection.memberships.role ?= 'lead' || @collection.memberships.role ?= 'manager')))";
  const locked = [
    "repository", "requester", "current_branch", "target_branch", "base_sha", "head_sha", "commits", "context", "model",
    "status", "idempotency_key", "diff_stats", "diff", "summary", "partial", "error", "started_at", "finished_at", "run_id",
  ].map((f) => `@request.body.${f}:isset = false`).join(" && ");
  requests.updateRule = `${steward} && retention != 'deleted' && ${locked}`;
  app.save(requests);
}, (app) => {
  const repos = app.findCollectionByNameOrId("repositories");
  const old = "(team.memberships_via_team.user ?= @request.auth.id && retention != 'deleted') || @request.auth.role = 'admin'";
  repos.listRule = old;
  repos.viewRule = old;
  app.save(repos);
  const requests = app.findCollectionByNameOrId("review_requests");
  requests.fields.removeByName("run_id");
  app.save(requests);
});
