// 리뷰 프롬프트 생성과 모델 응답 해석. 순수 함수만 둔다(node --test로 검사).
import type { Severity } from "./types";

export type ReviewInput = {
  current_branch: string;
  target_branch: string;
  head_sha: string;
  context: string;
  commits: { sha: string; subject: string; selected: boolean }[] | null;
  diff: string;
};

export type ParsedIssue = {
  file: string;
  line_start: number;
  line_end: number;
  severity: Severity;
  title: string;
  body: string;
  suggestion: string;
};

export type ParsedReview = { summary: string; issues: ParsedIssue[]; dropped: number };

const SEVERITIES: Severity[] = ["critical", "warning", "suggestion"];

export function buildPrompt(r: ReviewInput): string {
  const commits = (r.commits ?? [])
    .map((c) => `- ${c.sha.slice(0, 10)} ${c.subject}${c.selected ? "" : " (리뷰 범위 밖: 맥락으로만 참고)"}`)
    .join("\n");
  return `당신은 코드리뷰어입니다. 아래 diff는 ${r.target_branch}...${r.current_branch} 변경입니다(머지 베이스 기준).
현재 작업 디렉터리는 ${r.current_branch}의 ${r.head_sha} 시점 체크아웃입니다. 필요하면 파일을 읽어 주변 맥락을 확인하되, 파일을 수정하지 마세요.

검토 기준: 버그와 잘못된 동작, 보안 문제, 데이터 손실·경합, 오류 처리 누락, 성능 문제, 유지보수를 크게 해치는 설계를 찾으세요.
취향 수준의 스타일 지적은 하지 마세요. 확신이 낮은 지적은 suggestion으로 두세요. 문제가 없으면 issues를 빈 배열로 두세요.

응답은 아래 형식의 JSON 객체 하나만 출력하세요. 코드 블록이나 다른 설명을 붙이지 마세요. 문장은 한국어로 씁니다.
summary와 body에서 파일 경로·함수명·클래스명·설정값 같은 코드 식별자는 백틱(\`)으로 감싸세요.
{
  "summary": "변경 전체에 대한 요약과 총평. 2~3개 문단으로 나누고 문단 사이는 빈 줄(\\n\\n)로 구분",
  "issues": [
    {
      "file": "저장소 기준 파일 경로",
      "line_start": 변경 후 파일 기준 시작 줄 번호(정수),
      "line_end": 변경 후 파일 기준 끝 줄 번호(정수),
      "severity": "critical" | "warning" | "suggestion",
      "title": "한 줄 제목",
      "body": "무엇이 왜 문제인지, 어떤 상황에서 드러나는지",
      "suggestion": "개선 방법(코드 조각 가능)"
    }
  ]
}

<commits>
${commits || "(없음)"}
</commits>

<context>
${r.context.trim() || "(요청자가 추가한 맥락 없음)"}
</context>

<diff>
${r.diff}
</diff>
`;
}

// 응답 텍스트에서 JSON 객체를 꺼낸다. 코드 블록으로 감싸거나 앞뒤에 문장을 붙여도 받아들인다.
function extractJson(text: string): unknown {
  const t = text.trim();
  try {
    return JSON.parse(t);
  } catch {
    // 아래에서 객체 구간만 다시 시도한다.
  }
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("응답에서 JSON 객체를 찾지 못했습니다");
  return JSON.parse(t.slice(start, end + 1));
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const int = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.trunc(v)) : typeof v === "string" && /^\d+$/.test(v) ? Number(v) : NaN);

// 전체를 해석하지 못하면 예외를 던진다. 형식이 틀린 이슈만 있으면 버리고 dropped로 센다(부분 파싱).
export function parseReview(text: string): ParsedReview {
  const data = extractJson(text) as { summary?: unknown; issues?: unknown };
  if (!data || typeof data !== "object") throw new Error("응답이 JSON 객체가 아닙니다");
  const summary = str(data.summary, 8000);
  if (!summary) throw new Error("응답에 summary가 없습니다");
  const raw = Array.isArray(data.issues) ? data.issues : [];
  const issues: ParsedIssue[] = [];
  for (const item of raw) {
    const i = (item ?? {}) as Record<string, unknown>;
    const severity = (typeof i.severity === "string" ? i.severity.toLowerCase() : "") as Severity;
    const title = str(i.title, 300);
    if (!SEVERITIES.includes(severity) || !title) continue;
    const start = int(i.line_start) || 0;
    const end = int(i.line_end);
    issues.push({
      file: str(i.file, 500),
      line_start: start,
      line_end: Number.isNaN(end) ? start : Math.max(end, start),
      severity,
      title,
      body: str(i.body, 8000),
      suggestion: str(i.suggestion, 8000),
    });
  }
  // issues가 배열이 아닌 값으로 왔으면 그것도 해석 실패 하나로 센다.
  const notArray = data.issues !== undefined && !Array.isArray(data.issues);
  return { summary, issues, dropped: raw.length - issues.length + (notArray ? 1 : 0) };
}
