// 데모 데이터. 실행: npm run pb:seed  (PocketBase가 떠 있어야 한다)
// 모든 인물·저장소·커밋은 예시 데이터다. 운영 전에 지운다.
import PocketBase from "pocketbase";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";

const URL = process.env.POCKETBASE_URL ?? "http://127.0.0.1:8090";
const SU_EMAIL = process.env.PB_SUPERUSER_EMAIL ?? "superuser@redline.local";
const SU_PASS = process.env.PB_SUPERUSER_PASSWORD ?? "redline-superuser-1";
const DEMO_PASS = "redline-demo-1";
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const pb = new PocketBase(URL);
pb.autoCancellation(false);
await pb.collection("_superusers").authWithPassword(SU_EMAIL, SU_PASS);

const existing = await pb.collection("teams").getList(1, 1);
if (existing.totalItems > 0) {
  console.log("이미 시드되어 있습니다. 다시 하려면 pocketbase/pb_data를 지우고 마이그레이션부터 실행하세요.");
  process.exit(0);
}

const c = (name) => pb.collection(name);
const mk = (name, data) => c(name).create(data);

const people = [
  ["admin@redline.local", "김도윤", "admin"],
  ["seoyeon@redline.local", "박서연", "member"],
  ["hajun@redline.local", "이하준", "member"],
  ["minseo@redline.local", "최민서", "member"],
];
const users = {};
for (const [email, name, role] of people) {
  users[name] = await mk("users", { email, name, role, password: DEMO_PASS, passwordConfirm: DEMO_PASS, verified: true });
}

const pay = await mk("teams", { name: "결제팀" });
const plat = await mk("teams", { name: "플랫폼팀" });
for (const [t, n, r] of [
  [pay, "김도윤", "lead"], [pay, "박서연", "developer"], [pay, "이하준", "reviewer"],
  [plat, "김도윤", "manager"], [plat, "최민서", "developer"], [plat, "이하준", "developer"],
]) await mk("memberships", { team: t.id, user: users[n].id, role: r });

// 서울 지하철 노선색. 저장소 하나가 노선 하나다.
const repo = (team, name, local_path, line_no, line_color, default_branch = "main") =>
  mk("repositories", { team: team.id, name, local_path, line_no, line_color, default_branch, retention: "retained" });
const repos = {
  payments: await repo(pay, "payments-api", "/srv/git/payments-api", 2, "#00A84D"),
  ledger: await repo(pay, "ledger-batch", "/srv/git/ledger-batch", 3, "#EF7C1C"),
  web: await repo(plat, "web-console", "/srv/git/web-console", 1, "#0052A4"),
  self: await repo(plat, "prj-review-system", projectRoot, 4, "#00A5DE"),
};

const DIFF = `diff --git a/src/refund/retry.ts b/src/refund/retry.ts
index 3c1e2aa..9b07d41 100644
--- a/src/refund/retry.ts
+++ b/src/refund/retry.ts
@@ -1,32 +1,58 @@
 import { refundGateway } from "../gateway";
 import { logger } from "../logger";
+import { isRetryable, RefundError } from "./errors";

-const MAX_RETRIES = 3;
+const MAX_ATTEMPTS = 4;
+const BASE_DELAY_MS = 500;
+const MAX_DELAY_MS = 8000;

-export async function retryRefund(refundId: string, amount: number) {
-  let attempt = 0;
-  while (attempt <= MAX_RETRIES) {
+function delayFor(attempt: number) {
+  const exp = BASE_DELAY_MS * 2 ** (attempt - 1);
+  return Math.min(exp, MAX_DELAY_MS);
+}
+
+export async function retryRefund(refundId: string, amount: number, reason: string) {
+  let attempt = 1;
+  while (attempt <= MAX_ATTEMPTS) {
     try {
-      await refundGateway.refund(refundId, amount);
+      await refundGateway.refund(refundId, amount, { reason });
+      logger.info("refund.succeeded", { refundId, attempt });
       return;
     } catch (error) {
-      attempt++;
-      logger.info("refund retry", { refundId, attempt });
+      if (!isRetryable(error)) {
+        throw new RefundError("NON_RETRYABLE", { cause: error });
+      }
+      logger.warn("refund.retry", { refundId, attempt });
+      await new Promise((r) => setTimeout(r, delayFor(attempt)));
     }
   }
-  throw new Error("refund failed");
+  throw new RefundError("MAX_ATTEMPTS_EXCEEDED", { refundId });
 }
diff --git a/src/refund/errors.ts b/src/refund/errors.ts
new file mode 100644
index 0000000..51c9e0f
--- /dev/null
+++ b/src/refund/errors.ts
@@ -0,0 +1,22 @@
+const RETRYABLE_STATUS = new Set([502, 503, 504]);
+
+export class RefundError extends Error {
+  constructor(public code: string, public detail: Record<string, unknown> = {}) {
+    super(code);
+  }
+}
+
+export function isRetryable(error: unknown) {
+  const status = (error as { status?: number }).status;
+  return status !== undefined && RETRYABLE_STATUS.has(status);
+}
diff --git a/src/refund/service.ts b/src/refund/service.ts
index 77ab210..c4f8e19 100644
--- a/src/refund/service.ts
+++ b/src/refund/service.ts
@@ -40,9 +40,11 @@ export async function requestRefund(order: Order, reason: string) {
   const refundId = await refunds.create(order.id, order.total);
-  await retryRefund(refundId, order.total);
+  await retryRefund(refundId, order.total, reason);
   await orders.markRefunded(order.id);
+  await audit.log("refund.requested", { orderId: order.id, reason });
   return refundId;
 }
`;

const commits = (list, selectedFrom = 0) =>
  list.map(([sha, subject, author], i) => ({
    sha, subject, author, date: new Date(Date.UTC(2026, 9, 28, 1 + i, 12)).toISOString(), selected: i >= selectedFrom,
  }));

// 레코드 created는 지금이라, 실행 시각은 지금 이후로 둔다(앞서면 요청보다 먼저 실행된 것처럼 보인다).
const seededAt = Date.now();
const after = (sec) => new Date(seededAt + sec * 1000).toISOString();

async function request(data) {
  return mk("review_requests", { idempotency_key: randomUUID(), retention: "retained", partial: false, ...data });
}

const main = await request({
  repository: repos.payments.id, requester: users["박서연"].id,
  current_branch: "feature/refund-retry", target_branch: "main",
  base_sha: "4e1d9c07a2b35f6e8d1c0b9a7f3e2d1c5b4a6978", head_sha: "a3f09c1d7e2b48f6a9c05d13e7b2f40c9e8d1a62",
  commits: commits([
    ["a3f09c1d7e2b", "환불 사유를 감사 로그에 남김", "박서연"],
    ["9b07d41e6c2a", "지수 백오프 상한 8초로 제한", "박서연"],
    ["51c9e0f8b3d4", "재시도 가능 오류를 상태 코드로 분류", "박서연"],
    ["c4f8e1902a7b", "retryRefund에 reason 인자 추가", "박서연"],
    ["e72b5a10d9c3", "MAX_RETRIES를 MAX_ATTEMPTS로 변경", "박서연"],
    ["0d93f6c4b1e8", "환불 재시도 테스트 골격", "박서연"],
  ], 0).map((cm, i) => ({ ...cm, selected: i < 3 })),
  context: "게이트웨이 장애 때 환불이 중복 처리된 사례가 있었습니다. 재시도 경계 조건과 멱등성을 중점적으로 봐주세요.",
  model: "claude", status: "completed",
  diff_stats: {
    files: [
      { path: "src/refund/retry.ts", additions: 34, deletions: 10 },
      { path: "src/refund/errors.ts", additions: 22, deletions: 0 },
      { path: "src/refund/service.ts", additions: 2, deletions: 1 },
      { path: "test/refund/retry.test.ts", additions: 41, deletions: 0 },
    ],
    additions: 99, deletions: 11,
  },
  diff: DIFF,
  summary: "재시도 경계와 오류 분류는 개선됐지만, 재시도 가능 오류 판정이 429와 네트워크 타임아웃을 놓치고 환불 호출에 멱등 키가 없어 게이트웨이 장애 시 중복 환불 위험이 남아 있습니다.",
  started_at: after(2), finished_at: after(163),
});

const issueRows = [
  ["critical", "src/refund/retry.ts", 21, 21, "환불 호출에 멱등 키가 없음",
    "게이트웨이가 요청을 처리한 뒤 응답 전에 타임아웃이 나면 재시도가 같은 환불을 한 번 더 보냅니다. 맥락에 적힌 중복 환불 사례와 같은 경로입니다.",
    "refundGateway.refund(refundId, amount, { reason, idempotencyKey: refundId })", "acknowledged"],
  ["warning", "src/refund/errors.ts", 1, 1, "429와 네트워크 타임아웃이 재시도 대상에서 빠짐",
    "RETRYABLE_STATUS가 502·503·504만 포함합니다. 속도 제한(429)과 status가 없는 ETIMEDOUT 같은 네트워크 오류는 즉시 NON_RETRYABLE로 실패합니다.",
    "const RETRYABLE_STATUS = new Set([429, 502, 503, 504]);\n// status가 없으면 error.code로 ETIMEDOUT, ECONNRESET 판정", "unread"],
  ["warning", "src/refund/retry.ts", 27, 30, "마지막 시도 뒤에도 대기함",
    "attempt가 MAX_ATTEMPTS일 때 실패하면 delayFor(4) = 4초를 기다린 뒤 루프를 빠져나갑니다. 사용자는 이유 없이 4초 더 기다립니다.",
    "if (attempt === MAX_ATTEMPTS) break;\nawait sleep(delayFor(attempt));", "unread"],
  ["warning", "src/refund/retry.ts", 20, 31, "attempt가 증가하지 않음",
    "catch 블록에서 attempt++가 삭제되어 재시도 가능 오류가 계속되면 루프가 끝나지 않습니다.",
    "await sleep(delayFor(attempt));\nattempt++;", "resolved"],
  ["warning", "src/refund/service.ts", 43, 44, "감사 로그가 환불 완료 표시 뒤에 기록됨",
    "audit.log가 실패하면 환불은 끝났는데 요청은 오류로 응답합니다. 감사 로그 실패를 별도로 처리하거나 같은 트랜잭션 경계에 두세요.",
    "", "deferred"],
  ["suggestion", "src/refund/retry.ts", 8, 11, "지터 없는 지수 백오프",
    "여러 환불이 같은 장애를 만나면 같은 간격으로 동시에 재시도합니다. 0~delay 범위의 full jitter를 권장합니다.",
    "return Math.random() * Math.min(exp, MAX_DELAY_MS);", "unread"],
  ["suggestion", "src/refund/errors.ts", 3, 7, "RefundError에 cause 전달",
    "생성자가 options.cause를 받지 않아 원래 오류 스택이 사라집니다.",
    "constructor(code: string, detail = {}, options?: ErrorOptions) { super(code, options); }", "unread"],
  ["suggestion", "src/refund/retry.ts", 24, 24, "재시도 로그에 오류 원인 포함",
    "logger.warn에 status나 code가 없어 운영 중 어떤 오류로 재시도했는지 알 수 없습니다.", "", "unread"],
];
const issues = [];
for (const [severity, file, ls, le, title, body, suggestion, status] of issueRows) {
  issues.push(await mk("issues", { request: main.id, severity, file, line_start: ls, line_end: le, title, body, suggestion, model: "claude", status }));
}

const thread = [
  [issues[0], "이하준", "게이트웨이 문서상 Idempotency-Key 헤더를 받습니다. refundId를 그대로 써도 될 것 같아요."],
  [issues[0], "박서연", "네, refundId가 주문당 하나라서 키로 쓰겠습니다. 이번 PR에 같이 넣을게요."],
  [issues[4], "김도윤", "감사 로그는 다음 스프린트에 아웃박스로 옮길 예정이라 이번엔 보류합니다."],
];
for (const [issue, who, body] of thread) {
  await mk("comments", { issue: issue.id, request: main.id, author: users[who].id, body });
  await mk("issue_events", { issue: issue.id, request: main.id, actor: users[who].id, kind: "comment" });
}
for (const [issue, who, from, to] of [[issues[0], "박서연", "unread", "acknowledged"], [issues[3], "박서연", "unread", "resolved"], [issues[4], "김도윤", "unread", "deferred"]]) {
  await mk("issue_events", { issue: issue.id, request: main.id, actor: users[who].id, kind: "status", from, to });
}

// 이력용 요청들. 각 상태를 한 번 이상 보여준다.
const simple = (repoKey, who, current, model, status, extra = {}) =>
  request({
    repository: repos[repoKey].id, requester: users[who].id, current_branch: current, target_branch: "main", model, status,
    commits: commits([["7c2e91ab03fd", "작업 커밋", who]]),
    diff_stats: { files: [{ path: "src/index.ts", additions: 12, deletions: 3 }], additions: 12, deletions: 3 },
    ...extra,
  });

await simple("payments", "이하준", "fix/settlement-rounding", "codex", "running", { started_at: after(1) });
await simple("ledger", "박서연", "feature/daily-close-batch", "claude", "queued");
await simple("payments", "박서연", "chore/deps-2026-10", "codex", "failed", {
  started_at: after(1), finished_at: after(61),
  error: "Codex 로컬 실행 환경이 응답하지 않았습니다(60초 초과). 이 서버에서 'codex' 명령이 인증된 상태인지 확인한 뒤 재시도하세요.",
});
await simple("web", "최민서", "feature/review-filters", "claude", "completed", {
  started_at: after(1), finished_at: after(140),
  summary: "필터 상태를 URL과 동기화한 변경입니다. 지적 사항은 없습니다.",
});
await simple("ledger", "이하준", "fix/timezone-close", "claude", "canceled", { started_at: after(1), finished_at: after(20) });
await simple("web", "이하준", "feature/session-expiry-banner", "codex", "completed", {
  started_at: after(1), finished_at: after(212), partial: true,
  summary: "세션 만료 배너 추가. 응답 일부를 해석하지 못해 이슈 2건만 저장했습니다.",
});

console.log(`시드 완료. 로그인: admin@redline.local / ${DEMO_PASS} (관리자), seoyeon@redline.local / ${DEMO_PASS}`);
