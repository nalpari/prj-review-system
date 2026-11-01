import { test } from "node:test";
import assert from "node:assert/strict";
import { splitCode, toParagraphs } from "./prose.ts";

test("빈 줄과 줄바꿈으로 문단을 나눈다", () => {
  assert.deepEqual(toParagraphs("첫 문단입니다.\n\n둘째 문단입니다.\n셋째."), ["첫 문단입니다.", "둘째 문단입니다.", "셋째."]);
});

test("짧은 한 덩어리는 그대로 둔다", () => {
  assert.deepEqual(toParagraphs("  짧은 요약입니다. 문제 없습니다.  "), ["짧은 요약입니다. 문제 없습니다."]);
});

test("줄바꿈 없는 긴 문단은 문장 경계에서 여러 문단으로 나눈다", () => {
  const s = "가".repeat(60) + "입니다. ";
  const text = (s.repeat(6) + "끝입니다.").trim();
  const ps = toParagraphs(text);
  assert.ok(ps.length >= 2, `문단 ${ps.length}개`);
  assert.equal(ps.join(" "), text); // 글자를 잃거나 바꾸지 않는다
  for (const p of ps) assert.match(p, /[.!?]$/); // 문장 중간에서 끊지 않는다
});

test("백틱 안의 마침표에서는 끊지 않는다", () => {
  const text = `${"나".repeat(120)} \`a. b\` 그리고 ${"다".repeat(80)}.`;
  assert.deepEqual(toParagraphs(text), [text]);
});

test("백틱 구간을 코드로 나누고, 닫히지 않은 백틱은 글자로 둔다", () => {
  assert.deepEqual(splitCode("너비를 `max-w-sm`에서 `lg:max-w-lg`로"), [
    { code: false, text: "너비를 " },
    { code: true, text: "max-w-sm" },
    { code: false, text: "에서 " },
    { code: true, text: "lg:max-w-lg" },
    { code: false, text: "로" },
  ]);
  assert.deepEqual(splitCode("열린 ` 백틱"), [{ code: false, text: "열린 ` 백틱" }]);
});
