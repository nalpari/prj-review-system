// 표시·저장 전에 탐지 가능한 비밀정보를 가린다. 원문 복구 기능은 두지 않는다.
// ponytail: 정규식 기반 탐지. 놓치는 형식이 생기면 패턴을 추가하거나 gitleaks 규칙셋으로 교체.
// PEM 개인 키 블록. diff 안에서는 줄마다 +·-·공백 접두사가 붙고, 삭제 줄의 END는 "------END"가 된다.
// 줄 수와 접두사는 남기고 키 내용만 지운다(diff 줄 번호가 어긋나지 않게). 다음 "-----"에서 멈춰 선형으로 돈다.
const PRIVATE_KEY = /-----BEGIN [A-Z ]*PRIVATE KEY-----(?:[^-]|-(?!-{4}))*-?-----END [A-Z ]*PRIVATE KEY-----/g;
const maskKeyBlock = (block: string) =>
  block.split("\n").map((line, i) => (i === 0 ? "[비밀 키 마스킹됨]" : /^[+\- ]/.test(line) ? line[0] : "")).join("\n");

const PATTERNS: [RegExp, string][] = [
  [/\b(AKIA|ASIA)[0-9A-Z]{16}\b/g, "[AWS 키 마스킹됨]"],
  [/\bgh[pousr]_[A-Za-z0-9]{30,}\b/g, "[GitHub 토큰 마스킹됨]"],
  [/\bsk-[A-Za-z0-9_-]{20,}\b/g, "[API 키 마스킹됨]"],
  [/\bxox[abpr]-[A-Za-z0-9-]{10,}\b/g, "[Slack 토큰 마스킹됨]"],
  [/(?<![\w-])eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g, "[JWT 마스킹됨]"],
  // 접속 URL에 박힌 자격 증명(postgres://user:pass@host). 사용자 이름은 남기고 비밀번호만 가린다.
  [/(?<![a-z0-9+.-])([a-z][a-z0-9+.-]*:\/\/[^\s:\/@]+:)[^\s@\/]+@/gi, "$1********@"],
  // Authorization 헤더 값(Bearer·Basic·Token 스킴 포함). 따옴표로 감싼 헤더 이름과 diff 줄도 잡는다.
  [/(\bauthorization["']?\s*[:=]\s*["'`]?(?:(?:bearer|basic|token)\s+)?)[^\s"'`,;]{8,}/gi, "$1********"],
];

// 키 이름에 password·secret·token·api key가 들어간 할당. JSON처럼 따옴표로 감싼 키("db_password": ...)도 잡는다.
// 값이 다음 줄에 있으면(diff에서는 +·-·공백 접두사 뒤) 그 값까지 가린다.
// 값은 따옴표 값이면 공백·문장부호·이스케이프까지 통째로, 따옴표가 없으면 다음 공백·구분자까지 가린다.
// 정규식은 입력 길이에 선형이어야 한다(diff 전체에 동기로 돈다). 키는 식별자의 첫 글자에서만 시작하고(lookbehind),
// 키워드는 lookahead로 확인한 뒤 식별자를 통째로 읽는다. 앞뒤를 [\w.-]*로 열어 두면 긴 한 줄에서 제곱 이상으로 느려진다.
const ASSIGNMENT =
  /(?<![\w.-])((["']?)(?=[\w.-]*?(?:password|passwd|pwd|secret|token|api[_-]?key|access[_-]?key|private[_-]?key))[\w.-]+\2\s*[:=][ \t]*(?:\r?\n[+\- ]?[ \t]*)?)(?:"((?:[^"\\\n]|\\.)*)"|'((?:[^'\\\n]|\\.)*)'|([^\s"',;}]{4,}))/gi;

export function maskSecrets(text: string): string {
  let out = text.replace(PRIVATE_KEY, maskKeyBlock);
  for (const [re, rep] of PATTERNS) out = out.replace(re, rep);
  return out.replace(ASSIGNMENT, (_m, prefix: string, _q, dq?: string, sq?: string) =>
    prefix + (dq !== undefined ? '"********"' : sq !== undefined ? "'********'" : "********"),
  );
}
