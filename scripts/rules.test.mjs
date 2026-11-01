// PocketBase 접근 규칙 통합 검사. 실행: pnpm test:rules (PocketBase가 떠 있어야 한다)
// 슈퍼유저로 임시 데이터를 만들고, 구성원·관리자 토큰으로 직접 API를 호출해 본 뒤 지운다.
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import PocketBase from "pocketbase";

const URL = process.env.POCKETBASE_URL ?? "http://127.0.0.1:8090";
const su = new PocketBase(URL);
su.autoCancellation(false);
const tag = `rt${Date.now()}`;
const PASS = "rules-test-pass-1";
const f = {};

async function login(email) {
  const pb = new PocketBase(URL);
  pb.autoCancellation(false);
  await pb.collection("users").authWithPassword(email, PASS);
  return pb;
}
const denied = (p) => p.then(() => assert.fail("허용되면 안 되는 요청이 성공했다"), (e) => assert.ok([400, 403, 404].includes(e.status), `status ${e.status}`));

before(async () => {
  await su.collection("_superusers").authWithPassword(
    process.env.PB_SUPERUSER_EMAIL ?? "superuser@redline.local",
    process.env.PB_SUPERUSER_PASSWORD ?? "redline-superuser-1",
  );
  const user = (name, role) => su.collection("users").create({ email: `${tag}-${name}@test.local`, name, role, password: PASS, passwordConfirm: PASS, verified: true });
  f.dev = await user("dev", "member");
  f.lead = await user("lead", "member");
  f.admin = await user("admin", "admin");
  f.team = await su.collection("teams").create({ name: `${tag}-team` });
  await su.collection("memberships").create({ team: f.team.id, user: f.dev.id, role: "developer" });
  await su.collection("memberships").create({ team: f.team.id, user: f.lead.id, role: "lead" });
  f.repo = await su.collection("repositories").create({ team: f.team.id, name: `${tag}-repo`, local_path: "/tmp", line_no: 1, line_color: "#0052A4", retention: "retained" });
  f.req = await su.collection("review_requests").create({
    repository: f.repo.id, requester: f.dev.id, current_branch: "a", target_branch: "b", model: "claude",
    status: "completed", summary: "원본 요약", idempotency_key: `${tag}-k`, retention: "retained",
  });
  f.issue = await su.collection("issues").create({ request: f.req.id, severity: "warning", title: "원본 제목", status: "unread" });
  f.comment = await su.collection("comments").create({ issue: f.issue.id, request: f.req.id, author: f.dev.id, body: "원본 댓글" });
});

after(async () => {
  if (f.team) await su.collection("teams").delete(f.team.id).catch(() => {});
  for (const u of await su.collection("users").getFullList({ filter: `email ~ '${tag}'` })) await su.collection("users").delete(u.id);
});

test("구성원은 자기 role을 admin으로 바꿀 수 없다", async () => {
  const dev = await login(f.dev.email);
  await denied(dev.collection("users").update(f.dev.id, { role: "admin" }));
  assert.equal((await su.collection("users").getOne(f.dev.id)).role, "member");
  await dev.collection("users").update(f.dev.id, { name: "이름 변경은 허용" });
});

test("구성원은 리뷰 결과를 직접 만들거나 고칠 수 없다", async () => {
  const dev = await login(f.dev.email);
  await denied(dev.collection("review_requests").update(f.req.id, { summary: "조작", status: "completed" }));
  await denied(dev.collection("review_requests").create({
    repository: f.repo.id, requester: f.dev.id, current_branch: "x", target_branch: "y", model: "claude",
    status: "completed", idempotency_key: `${tag}-fake`, retention: "retained",
  }));
  await denied(dev.collection("issues").update(f.issue.id, { severity: "suggestion" }));
  await dev.collection("issues").update(f.issue.id, { status: "acknowledged" }); // 상태 변경만 허용
  assert.equal((await su.collection("review_requests").getOne(f.req.id)).summary, "원본 요약");
});

test("댓글·이력은 사용자 토큰으로 직접 쓸 수 없다(서버가 마스킹 후 쓴다)", async () => {
  const dev = await login(f.dev.email);
  await denied(dev.collection("comments").create({ issue: f.issue.id, request: f.req.id, author: f.dev.id, body: "password=hunter2hunter2" }));
  await denied(dev.collection("comments").update(f.comment.id, { body: "우회 수정" }));
  await denied(dev.collection("issue_events").create({ issue: f.issue.id, request: f.req.id, actor: f.dev.id, kind: "comment" }));
});

test("보존 권한자는 retention만 바꿀 수 있다", async () => {
  const lead = await login(f.lead.email);
  await denied(lead.collection("review_requests").update(f.req.id, { retention: "hidden", summary: "조작" }));
  await lead.collection("review_requests").update(f.req.id, { retention: "hidden" });
  await lead.collection("review_requests").update(f.req.id, { retention: "retained" });
  const dev = await login(f.dev.email);
  await denied(dev.collection("review_requests").update(f.req.id, { retention: "hidden" }));
});

test("일반 시스템 관리자는 계정을 만들 수 있고, 구성원은 못 만든다", async () => {
  const admin = await login(f.admin.email);
  await admin.collection("users").create({ email: `${tag}-new@test.local`, name: "새 계정", role: "member", password: PASS, passwordConfirm: PASS });
  const dev = await login(f.dev.email);
  await denied(dev.collection("users").create({ email: `${tag}-x@test.local`, name: "x", role: "admin", password: PASS, passwordConfirm: PASS }));
});

test("저장소를 숨기면 요청 갱신이 중간에 실패해도 하위 데이터가 안 보인다", async () => {
  // 저장소만 숨기고 요청은 retained로 둔다(갱신 루프가 실패한 상황).
  await su.collection("repositories").update(f.repo.id, { retention: "hidden" });
  const dev = await login(f.dev.email);
  assert.equal((await dev.collection("review_requests").getList(1, 10, { filter: `id = '${f.req.id}'` })).totalItems, 0);
  assert.equal((await dev.collection("issues").getList(1, 10, { filter: `request = '${f.req.id}'` })).totalItems, 0);
  assert.equal((await dev.collection("comments").getList(1, 10, { filter: `request = '${f.req.id}'` })).totalItems, 0);
  await su.collection("repositories").update(f.repo.id, { retention: "retained" });
});

test("쿠키의 record를 조작해도 authRefresh는 토큰 주인의 신원과 역할을 돌려준다", async () => {
  // 앱(src/lib/pb.ts requireSession)은 이 동작에 기대어 신원을 정한다.
  const dev = await login(f.dev.email);
  const forged = new PocketBase(URL);
  forged.authStore.save(dev.authStore.token, { ...dev.authStore.record, id: f.lead.id, role: "admin", collectionName: "users" });
  await forged.collection("users").authRefresh();
  assert.equal(forged.authStore.record.id, f.dev.id);
  assert.equal(forged.authStore.record.role, "member");
});

test("접근 불가 저장소는 일반 구성원에게 조회되지 않는다(Git 엔드포인트·리뷰 생성의 전제)", async () => {
  await su.collection("repositories").update(f.repo.id, { retention: "hidden" });
  const dev = await login(f.dev.email);
  await denied(dev.collection("repositories").getOne(f.repo.id));
  const admin = await login(f.admin.email);
  assert.equal((await admin.collection("repositories").getOne(f.repo.id)).retention, "hidden"); // 앱 코드가 retention을 다시 확인한다
  await su.collection("repositories").update(f.repo.id, { retention: "retained" });
});

test("실행 시도는 취소·재시도를 덮어쓰지 않는다", async () => {
  const { runAttempt } = await import("../src/lib/run-state.ts");
  const mk = (key, status) => su.collection("review_requests").create({
    repository: f.repo.id, requester: f.dev.id, current_branch: "a", target_branch: "b", model: "claude",
    status, idempotency_key: `${tag}-${key}`, retention: "retained",
  });
  const fail = async () => ({ status: "failed", error: "x" });

  const canceled = await mk("canceled", "canceled");
  assert.equal(await runAttempt(su, canceled.id, fail), "skipped");
  assert.equal((await su.collection("review_requests").getOne(canceled.id)).status, "canceled");

  const queued = await mk("cancel-mid", "queued");
  const result = await runAttempt(su, queued.id, async () => {
    await su.collection("review_requests").update(queued.id, { status: "canceled" }); // 실행 중 취소
    return fail();
  });
  assert.equal(result, "superseded");
  assert.equal((await su.collection("review_requests").getOne(queued.id)).status, "canceled");

  const retried = await mk("retry", "queued");
  const r2 = await runAttempt(su, retried.id, async () => {
    await su.collection("review_requests").update(retried.id, { status: "running", run_id: "newer-attempt" }); // 재시도가 앞지름
    return fail();
  });
  assert.equal(r2, "superseded");
  assert.equal((await su.collection("review_requests").getOne(retried.id)).run_id, "newer-attempt");

  const ok = await mk("ok", "queued");
  assert.equal(await runAttempt(su, ok.id, fail), "finished");
  assert.equal((await su.collection("review_requests").getOne(ok.id)).status, "failed");
});

test("취소 뒤 바로 재시도하면 이전 시도가 돌고 있어도 새 시도가 결과를 쓴다", async () => {
  const { runAttempt, transition } = await import("../src/lib/run-state.ts");
  const req = await su.collection("review_requests").create({
    repository: f.repo.id, requester: f.dev.id, current_branch: "a", target_branch: "b", model: "claude",
    status: "queued", idempotency_key: `${tag}-cancel-retry`, retention: "retained",
  });
  let second;
  const first = await runAttempt(su, req.id, async () => {
    assert.equal(await transition(su, req.id, ["queued", "running"], { status: "canceled" }), true);
    assert.equal(await transition(su, req.id, ["failed", "canceled"], { status: "queued" }), true);
    second = await runAttempt(su, req.id, async () => ({ status: "completed", summary: "새 시도" }));
    return { status: "failed", error: "이전 시도" };
  });
  assert.equal(second, "finished");
  assert.equal(first, "superseded");
  const saved = await su.collection("review_requests").getOne(req.id);
  assert.equal(saved.status, "completed");
  assert.equal(saved.summary, "새 시도");
});

test("동시에 시작해도 대기 중인 요청은 한 시도만 점유한다", async () => {
  const { runAttempt } = await import("../src/lib/run-state.ts");
  const req = await su.collection("review_requests").create({
    repository: f.repo.id, requester: f.dev.id, current_branch: "a", target_branch: "b", model: "claude",
    status: "queued", idempotency_key: `${tag}-race`, retention: "retained",
  });
  const fail = async () => ({ status: "failed", error: "x" });
  const results = await Promise.all(Array.from({ length: 5 }, () => runAttempt(su, req.id, fail)));
  assert.equal(results.filter((r) => r === "finished").length, 1);
  assert.equal(results.filter((r) => r === "skipped").length, 4);
});

test("댓글과 이력은 한 트랜잭션으로 저장되고, 같은 제출 키로는 댓글이 하나만 생긴다", async () => {
  const comment = (key) => ({ issue: f.issue.id, request: f.req.id, author: f.dev.id, body: "배치 댓글", submission_key: key });
  const count = async (key) => (await su.collection("comments").getList(1, 1, { filter: su.filter("submission_key = {:k}", { k: key }) })).totalItems;

  const failing = su.createBatch();
  failing.collection("comments").create(comment(`${tag}-atomic`));
  failing.collection("issue_events").create({ issue: f.issue.id, request: f.req.id, actor: f.dev.id, kind: "없는 종류" }); // 이력 저장 실패
  await assert.rejects(failing.send());
  assert.equal(await count(`${tag}-atomic`), 0);

  await su.collection("comments").create(comment(`${tag}-dup`));
  await assert.rejects(su.collection("comments").create(comment(`${tag}-dup`)));
  assert.equal(await count(`${tag}-dup`), 1);
  await su.collection("comments").create(comment("")); // 키 없는 댓글끼리는 겹쳐도 된다
  await su.collection("comments").create(comment(""));
});

test("구성원은 run_id를 바꿀 수 없다", async () => {
  const lead = await login(f.lead.email);
  await denied(lead.collection("review_requests").update(f.req.id, { run_id: "forged" }));
});
