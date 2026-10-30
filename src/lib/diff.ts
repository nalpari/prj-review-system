export type DiffLine = { kind: "add" | "del" | "ctx"; oldNo?: number; newNo?: number; text: string };

// unified diff → 파일별 줄 목록. 이슈 위치 주변만 잘라 보여주는 데 쓴다.
export function parseDiff(diff: string): Map<string, DiffLine[]> {
  const files = new Map<string, DiffLine[]>();
  let cur: DiffLine[] | null = null;
  let o = 0;
  let n = 0;
  for (const raw of diff.split("\n")) {
    if (raw.startsWith("diff --git ")) {
      cur = null;
      continue;
    }
    if (raw.startsWith("+++ ")) {
      const path = raw.slice(4).replace(/^b\//, "");
      cur = [];
      if (path !== "/dev/null") files.set(path, cur);
      continue;
    }
    if (raw.startsWith("--- ") || !cur) continue;
    const h = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(raw);
    if (h) {
      o = Number(h[1]);
      n = Number(h[2]);
      continue;
    }
    if (raw.startsWith("+")) cur.push({ kind: "add", newNo: n++, text: raw.slice(1) });
    else if (raw.startsWith("-")) cur.push({ kind: "del", oldNo: o++, text: raw.slice(1) });
    else if (raw.startsWith(" ")) cur.push({ kind: "ctx", oldNo: o++, newNo: n++, text: raw.slice(1) });
  }
  return files;
}

// 새 파일 기준 줄 범위 주변 발췌. 범위 안의 삭제 줄도 함께 보인다.
export function excerpt(lines: DiffLine[] | undefined, start: number, end: number, pad = 3): DiffLine[] {
  if (!lines || !start) return [];
  const from = start - pad;
  const to = (end || start) + pad;
  let lastNew = 0;
  return lines.filter((l) => {
    if (l.newNo !== undefined) lastNew = l.newNo;
    const at = l.newNo ?? lastNew + 1; // 삭제 줄은 다음 새 줄 자리에 속한다
    return at >= from && at <= to;
  });
}
