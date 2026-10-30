import type { IssueStatus, Model, Retention, RunStatus, Severity } from "./types";

export const MODEL_LABEL: Record<Model, string> = { claude: "Claude", codex: "Codex" };

export const RUN_LABEL: Record<RunStatus, string> = {
  queued: "대기",
  running: "실행 중",
  completed: "완료",
  failed: "실패",
  canceled: "취소",
};

export const SEVERITY_LABEL: Record<Severity, string> = { critical: "치명", warning: "경고", suggestion: "제안" };
export const SEVERITIES: Severity[] = ["critical", "warning", "suggestion"];

export const ISSUE_LABEL: Record<IssueStatus, string> = {
  unread: "미확인",
  acknowledged: "확인",
  resolved: "해결",
  deferred: "보류",
};
export const ISSUE_STATUSES: IssueStatus[] = ["unread", "acknowledged", "resolved", "deferred"];

export const RETENTION_LABEL: Record<Retention, string> = { retained: "보존 중", hidden: "접근 불가", deleted: "삭제됨" };

export const ROLE_LABEL = { developer: "개발자", reviewer: "코드리뷰어", lead: "테크 리드", manager: "팀 관리자" } as const;

const dateFmt = new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Seoul" });

export function formatDate(iso: string) {
  return iso ? dateFmt.format(new Date(iso)) : "—";
}

// 최근이면 상대 시간, 아니면 날짜.
export function relative(iso: string, now: number) {
  if (!iso) return "—";
  const m = Math.round((now - new Date(iso).getTime()) / 60_000);
  if (m < 1) return "방금";
  if (m < 60) return `${m}분 전`;
  if (m < 60 * 24) return `${Math.floor(m / 60)}시간 전`;
  if (m < 60 * 24 * 7) return `${Math.floor(m / 1440)}일 전`;
  return formatDate(iso);
}

export function duration(fromIso: string, toIso: string) {
  if (!fromIso || !toIso) return "—";
  const s = Math.max(0, Math.round((new Date(toIso).getTime() - new Date(fromIso).getTime()) / 1000));
  return s < 60 ? `${s}초` : `${Math.floor(s / 60)}분 ${s % 60}초`;
}

export const nf = new Intl.NumberFormat("ko-KR");
