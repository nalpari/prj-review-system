import Link from "next/link";
import type { ComponentProps, CSSProperties, ReactNode } from "react";
import { ISSUE_LABEL, RUN_LABEL, SEVERITY_LABEL } from "@/lib/labels";
import { lineInk } from "@/lib/lines";
import type { IssueStatus, Repository, RunStatus, Severity } from "@/lib/types";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");
export { cx };

// 지하철 노선 번호 표지. 저장소 하나 = 노선 하나.
export function LineBadge({ repo, size = 20 }: { repo: Pick<Repository, "line_no" | "line_color" | "name">; size?: number }) {
  return (
    <span
      aria-hidden
      className="num inline-flex shrink-0 items-center justify-center rounded-full font-bold"
      style={{ width: size, height: size, background: repo.line_color || "#15171a", color: lineInk(repo.line_color || "#15171a"), fontSize: size * 0.58, lineHeight: 1 }}
    >
      {repo.line_no || "·"}
    </span>
  );
}

const RUN_STYLE: Record<RunStatus, string> = {
  queued: "bg-active text-ink",
  running: "bg-ink text-white",
  completed: "bg-positive-bg text-positive-ink",
  failed: "bg-negative-bg text-negative-ink",
  canceled: "border border-control text-muted",
};

export function RunPill({ status }: { status: RunStatus }) {
  return (
    <span className={cx("inline-flex h-[22px] flex-none items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-[12px] font-semibold", RUN_STYLE[status])}>
      {status === "running" && <span className="size-1.5 animate-pulse rounded-full bg-white motion-reduce:animate-none" />}
      {RUN_LABEL[status]}
    </span>
  );
}

const SEV_STYLE: Record<Severity, string> = {
  critical: "bg-negative-bg text-negative-ink",
  warning: "bg-warning-bg text-warning-ink",
  suggestion: "bg-active text-ink",
};

export function SeverityTag({ severity }: { severity: Severity }) {
  return (
    <span className={cx("inline-flex h-[22px] flex-none items-center whitespace-nowrap rounded px-2 text-[12px] font-semibold", SEV_STYLE[severity])}>
      {SEVERITY_LABEL[severity]}
    </span>
  );
}

const ISSUE_DOT: Record<IssueStatus, string> = {
  unread: "border-2 border-ink bg-surface",
  acknowledged: "bg-ink",
  resolved: "bg-positive",
  deferred: "border-2 border-dashed border-faint bg-surface",
};

// 역 표지 모양으로 이슈 상태를 표시한다: 빈 역(미확인), 찬 역(확인), 초록(해결), 점선(보류).
export function IssueStatusMark({ status, withLabel = true }: { status: IssueStatus; withLabel?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[13px] text-ink">
      <span aria-hidden className={cx("inline-block size-2.5 rounded-full", ISSUE_DOT[status])} />
      {withLabel ? ISSUE_LABEL[status] : <span className="sr-only">{ISSUE_LABEL[status]}</span>}
    </span>
  );
}

type Variant = "primary" | "secondary" | "ghost" | "danger";
const BTN: Record<Variant, string> = {
  primary: "bg-ink text-white hover:bg-[#2b2e33] disabled:bg-[#6d7170]",
  secondary: "border border-control bg-surface text-ink hover:bg-raised",
  ghost: "text-ink hover:bg-active",
  danger: "border border-negative/60 bg-surface text-negative hover:bg-negative-bg",
};
export const btn = (v: Variant = "secondary", extra?: string) =>
  cx(
    "inline-flex h-8 items-center justify-center gap-1.5 whitespace-nowrap rounded-[6px] px-3 text-[13px] font-semibold transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-70",
    BTN[v],
    extra,
  );

export function ButtonLink({ variant = "secondary", className, ...p }: ComponentProps<typeof Link> & { variant?: Variant }) {
  return <Link {...p} className={btn(variant, className)} />;
}

export function Panel({ title, action, children, className, style }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <section className={cx("rounded-[8px] border border-border bg-surface", className)} style={style}>
      {title && (
        <header className="flex min-h-11 items-center justify-between gap-3 border-b border-rule px-4">
          <h2 className="text-[14px] font-semibold">{title}</h2>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function PageTitle({ title, sub, actions }: { title: ReactNode; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-[22px] font-bold leading-[30px] tracking-[-0.01em] break-words">{title}</h1>
        {sub && <p className="mt-1 text-[14px] text-muted">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function InlineError({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div role="alert" className="flex flex-wrap items-center gap-3 rounded-[6px] border border-negative/30 bg-negative-bg px-3 py-2 text-[13px] text-negative-ink">
      <span className="min-w-0 flex-1">{children}</span>
      {action}
    </div>
  );
}

export const field =
  "rl-select h-9 w-full rounded-[6px] border border-control bg-surface px-3 text-[14px] text-ink placeholder:text-faint hover:border-[#a9aea6] focus:border-ink focus:outline-none disabled:bg-raised";
export const label = "mb-2 block text-[13px] font-semibold";
