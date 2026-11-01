import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPrompt, parseReview } from "./review-output.ts";

test("JSON만 온 응답을 해석한다", () => {
  const r = parseReview(JSON.stringify({
    summary: "요약",
    issues: [{ file: "a.ts", line_start: 3, line_end: 5, severity: "warning", title: "t", body: "b", suggestion: "s" }],
  }));
  assert.equal(r.summary, "요약");
  assert.equal(r.dropped, 0);
  assert.deepEqual(r.issues[0], { file: "a.ts", line_start: 3, line_end: 5, severity: "warning", title: "t", body: "b", suggestion: "s" });
});

test("코드 블록과 앞뒤 문장이 붙어도 객체를 꺼낸다", () => {
  const r = parseReview('결과입니다.\n```json\n{"summary":"ok","issues":[]}\n```\n끝');
  assert.equal(r.summary, "ok");
  assert.equal(r.issues.length, 0);
});

test("형식이 틀린 이슈만 버리고 센다", () => {
  const r = parseReview(JSON.stringify({
    summary: "s",
    issues: [
      { file: "a", line_start: 1, severity: "CRITICAL", title: "대문자 심각도" },
      { file: "b", line_start: 1, severity: "blocker", title: "모르는 심각도" },
      { file: "c", line_start: 1, severity: "warning" },
      null,
    ],
  }));
  assert.equal(r.issues.length, 1);
  assert.equal(r.issues[0].severity, "critical");
  assert.equal(r.issues[0].line_end, 1);
  assert.equal(r.dropped, 3);
});

test("줄 번호는 정수로 맞추고 끝 줄이 시작보다 앞서지 않게 한다", () => {
  const r = parseReview(JSON.stringify({ summary: "s", issues: [{ severity: "suggestion", title: "t", line_start: "7", line_end: 2.9 }] }));
  assert.equal(r.issues[0].line_start, 7);
  assert.equal(r.issues[0].line_end, 7);
});

test("summary가 없거나 JSON이 아니면 실패한다", () => {
  assert.throws(() => parseReview('{"issues":[]}'), /summary/);
  assert.throws(() => parseReview("리뷰를 할 수 없습니다"), /JSON/);
});

test("프롬프트에 범위 밖 커밋과 diff를 넣는다", () => {
  const p = buildPrompt({
    current_branch: "feat", target_branch: "main", head_sha: "abc", context: "",
    commits: [{ sha: "1234567890ab", subject: "first", selected: true }, { sha: "ffff", subject: "old", selected: false }],
    diff: "diff --git a/x b/x",
  });
  assert.match(p, /1234567890 first\n/);
  assert.match(p, /ffff old \(리뷰 범위 밖/);
  assert.match(p, /<diff>\ndiff --git a\/x b\/x\n<\/diff>/);
});
