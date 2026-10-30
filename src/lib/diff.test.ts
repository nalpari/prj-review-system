import { test } from "node:test";
import assert from "node:assert/strict";
import { excerpt, parseDiff } from "./diff.ts";

const DIFF = `diff --git a/a.ts b/a.ts
--- a/a.ts
+++ b/a.ts
@@ -1,4 +1,5 @@
 one
-two
+TWO
+two-b
 three
 four
diff --git a/gone.ts b/gone.ts
--- a/gone.ts
+++ /dev/null
@@ -1 +0,0 @@
-bye`;

test("파일별로 새·옛 줄 번호를 매긴다", () => {
  const files = parseDiff(DIFF);
  assert.deepEqual([...files.keys()], ["a.ts"]);
  const a = files.get("a.ts")!;
  assert.deepEqual(a.map((l) => [l.kind, l.oldNo, l.newNo]), [
    ["ctx", 1, 1], ["del", 2, undefined], ["add", undefined, 2], ["add", undefined, 3], ["ctx", 3, 4], ["ctx", 4, 5],
  ]);
});

test("발췌는 범위 주변 줄과 그 사이 삭제 줄을 포함한다", () => {
  const a = parseDiff(DIFF).get("a.ts")!;
  assert.deepEqual(excerpt(a, 2, 2, 0).map((l) => l.text), ["two", "TWO"]);
});
