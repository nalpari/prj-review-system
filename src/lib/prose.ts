// 모델이 쓴 요약·설명을 읽기 좋게 나눈다. 순수 함수만 둔다(node --test로 검사).

export type Segment = { code: boolean; text: string };

// 한 문단이 이보다 길면 문장 경계에서 나눈다(빈 줄 없이 한 덩어리로 온 응답).
const SOFT_LIMIT = 180;

// 빈 줄(또는 줄바꿈)로 문단을 나누고, 줄바꿈 없이 긴 문단은 문장 2~3개 단위로 다시 나눈다.
export function toParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n|\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .flatMap((p) => (p.length > SOFT_LIMIT ? chunkSentences(p) : [p]));
}

function chunkSentences(p: string): string[] {
  // 마침표·물음표·느낌표 뒤 공백에서 끊는다. 백틱 안(예: `a. b`)은 끊지 않는다.
  const sentences: string[] = [];
  let start = 0;
  let inCode = false;
  for (let i = 0; i < p.length; i++) {
    const ch = p[i];
    if (ch === "`") inCode = !inCode;
    else if (!inCode && /[.!?。]/.test(ch) && /\s/.test(p[i + 1] ?? "")) {
      sentences.push(p.slice(start, i + 1).trim());
      start = i + 1;
    }
  }
  if (start < p.length) sentences.push(p.slice(start).trim());

  const out: string[] = [];
  let cur = "";
  for (const s of sentences.filter(Boolean)) {
    cur = cur ? `${cur} ${s}` : s;
    if (cur.length >= SOFT_LIMIT * 0.6) {
      out.push(cur);
      cur = "";
    }
  }
  if (cur) {
    // 짧은 꼬리 문장 하나만 남으면 앞 문단에 붙인다.
    if (out.length && cur.length < SOFT_LIMIT * 0.3) out[out.length - 1] += ` ${cur}`;
    else out.push(cur);
  }
  return out;
}

// `코드` 구간을 나눈다. 닫히지 않은 백틱은 글자 그대로 둔다.
export function splitCode(p: string): Segment[] {
  const out: Segment[] = [];
  const re = /`([^`\n]+)`/g;
  let last = 0;
  for (const m of p.matchAll(re)) {
    if (m.index > last) out.push({ code: false, text: p.slice(last, m.index) });
    out.push({ code: true, text: m[1] });
    last = m.index + m[0].length;
  }
  if (last < p.length) out.push({ code: false, text: p.slice(last) });
  return out;
}
