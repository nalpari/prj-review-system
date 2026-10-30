"use client";

import { useActionState, useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { ChevronDown, MessageSquare } from "lucide-react";
import { IssueStatusMark, InlineError, SeverityTag, btn, cx } from "@/components/ui";
import { ISSUE_LABEL, ISSUE_STATUSES, relative } from "@/lib/labels";
import type { DiffLine } from "@/lib/diff";
import type { Issue, IssueStatus } from "@/lib/types";
import { addComment, deleteComment, editComment, setIssueStatus, type FormState } from "../actions";

export type IssueView = Issue & {
  excerpt: DiffLine[];
  comments: { id: string; body: string; deleted: boolean; edited: boolean; created: string; author: string; mine: boolean }[];
  history: { id: string; who: string; from: string; to: string; created: string }[];
};

type Filter = "open" | "all" | IssueStatus;

export function IssueWorkspace({ issues, model, now }: { issues: IssueView[]; model: string; now: number }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [openId, setOpenId] = useState<string | null>(issues[0]?.id ?? null);
  const listRef = useRef<HTMLOListElement>(null);

  const shown = issues.filter((i) =>
    filter === "all" ? true : filter === "open" ? i.status === "unread" || i.status === "acknowledged" : i.status === filter,
  );
  const count = (f: Filter) => issues.filter((i) => (f === "all" ? true : f === "open" ? i.status === "unread" || i.status === "acknowledged" : i.status === f)).length;

  // j/k: 이슈를 하나씩 넘기며 분류한다. 입력 중에는 동작하지 않는다.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, select, [contenteditable]") || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key !== "j" && e.key !== "k") return;
      const idx = shown.findIndex((i) => i.id === openId);
      const next = shown[Math.min(shown.length - 1, Math.max(0, idx + (e.key === "j" ? 1 : -1)))];
      if (!next) return;
      e.preventDefault();
      setOpenId(next.id);
      requestAnimationFrame(() => listRef.current?.querySelector(`[data-issue="${next.id}"]`)?.scrollIntoView({ block: "nearest" }));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [shown, openId]);

  const tabs: [Filter, string][] = [["all", "전체"], ["open", "미처리"], ["resolved", "해결"], ["deferred", "보류"]];

  return (
    <section className="rounded-[8px] border border-border bg-surface" aria-label="이슈">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-rule px-4">
        <div role="tablist" aria-label="이슈 상태 필터" className="flex gap-4">
          {tabs.map(([f, label]) => (
            <button
              key={f}
              role="tab"
              type="button"
              aria-selected={filter === f}
              onClick={() => setFilter(f)}
              className={cx("num -mb-px h-11 border-b-2 text-[14px]", filter === f ? "border-ink font-semibold" : "border-transparent text-muted hover:text-ink")}
            >
              {label} {count(f)}
            </button>
          ))}
        </div>
        <span className="hidden text-[12px] text-muted sm:inline">
          <kbd className="rounded border border-control px-1 font-sans">j</kbd> <kbd className="rounded border border-control px-1 font-sans">k</kbd> 로 이슈 이동
        </span>
      </header>

      {issues.length === 0 ? (
        <p className="px-4 py-8 text-muted">이번 리뷰에서 지적된 이슈가 없습니다.</p>
      ) : shown.length === 0 ? (
        <p className="px-4 py-8 text-muted">이 상태의 이슈가 없습니다.</p>
      ) : (
        <ol ref={listRef}>
          {shown.map((i) => (
            <IssueRow key={i.id} issue={i} model={model} now={now} open={openId === i.id} onToggle={() => setOpenId(openId === i.id ? null : i.id)} />
          ))}
        </ol>
      )}
    </section>
  );
}

function IssueRow({ issue, model, now, open, onToggle }: { issue: IssueView; model: string; now: number; open: boolean; onToggle: () => void }) {
  const [status, setOptimistic] = useOptimistic(issue.status);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  const where = issue.file ? `${issue.file}${issue.line_start ? `:${issue.line_start}${issue.line_end && issue.line_end !== issue.line_start ? `–${issue.line_end}` : ""}` : ""}` : "위치 정보 없음";
  const live = issue.comments.filter((c) => !c.deleted).length;

  const change = (to: IssueStatus) =>
    start(async () => {
      setError(undefined);
      setOptimistic(to);
      const r = await setIssueStatus(issue.id, to);
      if (r.error) setError(r.error);
    });

  return (
    <li data-issue={issue.id} className="border-b border-rule last:border-0">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className={cx("grid w-full grid-cols-[auto_1fr_auto] items-start gap-3 px-4 py-3 text-left hover:bg-raised", open && "bg-raised")}
      >
        <SeverityTag severity={issue.severity} />
        <span className="min-w-0">
          <span className="block font-semibold leading-[22px]">{issue.title}</span>
          <span className="block truncate font-mono text-[12px] text-muted">{where}</span>
        </span>
        <span className="flex items-center gap-3 pt-0.5">
          {live > 0 && (
            <span className="num inline-flex items-center gap-1 text-[12px] text-muted" title={`댓글 ${live}개`}>
              <MessageSquare size={13} strokeWidth={1.75} />{live}
            </span>
          )}
          <IssueStatusMark status={status} />
          <ChevronDown size={16} className={cx("text-muted transition-transform duration-200", open && "rotate-180")} />
        </span>
      </button>

      {open && (
        <div className="grid grid-cols-1 gap-4 px-4 pb-5 pt-1 sm:pl-[76px]">
          {issue.body && <p className="max-w-[72ch] leading-[22px]">{issue.body}</p>}

          {issue.excerpt.length > 0 && (
            <figure className="overflow-x-auto rounded-[6px] border border-border">
              <figcaption className="border-b border-rule bg-raised px-3 py-1.5 font-mono text-[12px] text-muted">{issue.file}</figcaption>
              <table className="w-full border-collapse font-mono text-[12px] leading-5 [overflow-wrap:normal]">
                <tbody>
                  {issue.excerpt.map((l, k) => {
                    const hit = l.newNo !== undefined && l.newNo >= issue.line_start && l.newNo <= (issue.line_end || issue.line_start);
                    return (
                      <tr key={k} className={l.kind === "add" ? "bg-[#ecf8f0]" : l.kind === "del" ? "bg-[#fdf0ef]" : ""}>
                        <td className="num w-10 select-none whitespace-nowrap border-r border-rule px-2 text-right text-faint">{l.oldNo ?? ""}</td>
                        <td className={cx("num w-10 select-none whitespace-nowrap border-r border-rule px-2 text-right", hit ? "font-bold text-ink" : "text-faint")}>{l.newNo ?? ""}</td>
                        <td className="w-4 select-none pl-2 text-muted">{l.kind === "add" ? "+" : l.kind === "del" ? "−" : ""}</td>
                        <td className={cx("whitespace-pre pr-3", hit && "underline decoration-negative decoration-2 underline-offset-4")}>{l.text}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </figure>
          )}

          {issue.suggestion && (
            <div>
              <h4 className="mb-1.5 text-[13px] font-semibold">개선 제안</h4>
              <pre className="overflow-x-auto rounded-[6px] bg-ink px-3 py-2.5 font-mono text-[12px] leading-5 text-white">{issue.suggestion}</pre>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <div role="radiogroup" aria-label="이슈 상태" className="inline-flex rounded-[6px] border border-control bg-surface p-0.5">
              {ISSUE_STATUSES.map((s) => (
                <button
                  key={s}
                  type="button"
                  role="radio"
                  aria-checked={status === s}
                  disabled={pending}
                  onClick={() => change(s)}
                  className={cx("h-7 rounded-[4px] px-3 text-[13px]", status === s ? "bg-ink font-semibold text-white" : "text-ink hover:bg-active")}
                >
                  {ISSUE_LABEL[s]}
                </button>
              ))}
            </div>
            <span className="text-[12px] text-muted" aria-live="polite">{pending ? "저장 중…" : `${model}가 생성`}</span>
          </div>
          {error && <InlineError>{error}</InlineError>}

          <Thread issue={issue} now={now} />
        </div>
      )}
    </li>
  );
}

function Thread({ issue, now }: { issue: IssueView; now: number }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [len, setLen] = useState(0);
  // 제출 키는 저장에 성공해야 바뀐다. 실패 뒤 다시 보내면 같은 키라 댓글이 두 번 생기지 않는다.
  const [submissionKey, setSubmissionKey] = useState(() => crypto.randomUUID());
  const [state, action, pending] = useActionState<FormState, FormData>(async (s, f) => {
    const r = await addComment(s, f);
    if (!r.error) {
      formRef.current?.reset();
      setLen(0);
      setSubmissionKey(crypto.randomUUID());
    }
    return r;
  }, {});

  // 댓글과 상태 변경을 시간순으로 섞어 보여준다.
  const timeline = [
    ...issue.comments.map((c) => ({ t: c.created, kind: "comment" as const, c })),
    ...issue.history.map((h) => ({ t: h.created, kind: "status" as const, h })),
  ].sort((a, b) => a.t.localeCompare(b.t));

  return (
    <div className="border-t border-rule pt-4">
      <h4 className="text-[13px] font-semibold">토론과 이력</h4>
      {timeline.length === 0 && <p className="mt-2 text-[13px] text-muted">아직 댓글이 없습니다.</p>}
      <ol className="mt-2 grid gap-3">
        {timeline.map((e) =>
          e.kind === "status" ? (
            <li key={e.h.id} className="flex items-center gap-2 text-[12px] text-muted">
              <span className="size-1.5 rounded-full bg-control" aria-hidden />
              {e.h.who}님이 상태를 {ISSUE_LABEL[e.h.from as IssueStatus] ?? e.h.from} → {ISSUE_LABEL[e.h.to as IssueStatus] ?? e.h.to}(으)로 바꿈 · {relative(e.h.created, now)}
            </li>
          ) : (
            <CommentItem key={e.c.id} c={e.c} now={now} />
          ),
        )}
      </ol>
      <form ref={formRef} action={action} className="mt-3 grid gap-2">
        <input type="hidden" name="issue" value={issue.id} />
        <input type="hidden" name="submission_key" value={submissionKey} />
        <label htmlFor={`c-${issue.id}`} className="sr-only">댓글</label>
        <textarea
          id={`c-${issue.id}`}
          name="body"
          rows={2}
          maxLength={4000}
          onChange={(e) => setLen(e.target.value.length)}
          placeholder="이 지적에 대한 의견이나 처리 계획"
          className="min-h-16 w-full resize-y rounded-[6px] border border-control bg-surface px-3 py-2 text-[14px] placeholder:text-faint focus:border-ink focus:outline-none"
        />
        {state.error && <InlineError>{state.error}</InlineError>}
        <div className="flex items-center justify-between">
          <span className={cx("num text-[12px]", len > 3800 ? "text-negative" : "text-muted")}>{len.toLocaleString("ko-KR")} / 4,000</span>
          <button type="submit" disabled={pending || len === 0} className={btn("primary")}>{pending ? "저장 중…" : "댓글 남기기"}</button>
        </div>
      </form>
    </div>
  );
}

function CommentItem({ c, now }: { c: IssueView["comments"][number]; now: number }) {
  const [editing, setEditing] = useState(false);
  const [state, action, pending] = useActionState<FormState, FormData>(async (s, f) => {
    const r = await editComment(s, f);
    if (!r.error) setEditing(false);
    return r;
  }, {});
  const [delPending, startDel] = useTransition();
  const [delError, setDelError] = useState<string>();

  return (
    <li className="grid grid-cols-[28px_1fr] gap-2.5">
      <span className="flex size-7 items-center justify-center rounded-full bg-active text-[12px] font-bold" aria-hidden>{c.author.slice(0, 1)}</span>
      <div className="min-w-0">
        <p className="text-[12px] text-muted">
          <span className="font-semibold text-ink">{c.author}</span> · {relative(c.created, now)}{c.edited && !c.deleted && " · 수정됨"}
        </p>
        {c.deleted ? (
          <p className="mt-0.5 text-[13px] italic text-muted">작성자가 삭제한 댓글입니다.</p>
        ) : editing ? (
          <form action={action} className="mt-1 grid gap-2">
            <input type="hidden" name="id" value={c.id} />
            <textarea name="body" defaultValue={c.body} maxLength={4000} rows={2} aria-label="댓글 수정" className="w-full rounded-[6px] border border-control px-3 py-2 text-[14px] focus:border-ink focus:outline-none" />
            {state.error && <InlineError>{state.error}</InlineError>}
            <div className="flex gap-2">
              <button type="submit" disabled={pending} className={btn("primary")}>{pending ? "저장 중…" : "수정 저장"}</button>
              <button type="button" onClick={() => setEditing(false)} className={btn("ghost")}>그만두기</button>
            </div>
          </form>
        ) : (
          <>
            <p className="mt-0.5 whitespace-pre-wrap break-words leading-[22px]">{c.body}</p>
            {c.mine && (
              <div className="mt-1 flex gap-3 text-[12px]">
                <button type="button" onClick={() => setEditing(true)} className="text-muted hover:text-ink hover:underline">수정</button>
                <button
                  type="button"
                  disabled={delPending}
                  onClick={() => {
                    if (!confirm("이 댓글을 삭제할까요? 삭제한 댓글은 '삭제됨'으로 남습니다.")) return;
                    startDel(async () => setDelError((await deleteComment(c.id)).error));
                  }}
                  className="text-muted hover:text-negative hover:underline"
                >
                  {delPending ? "삭제 중…" : "삭제"}
                </button>
              </div>
            )}
            {delError && <InlineError>{delError}</InlineError>}
          </>
        )}
      </div>
    </li>
  );
}
