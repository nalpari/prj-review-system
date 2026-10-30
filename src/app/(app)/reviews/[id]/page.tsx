import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Info } from "lucide-react";
import { RouteMap } from "@/components/route-map";
import { InlineError, LineBadge, Panel, RunPill } from "@/components/ui";
import { PageSkeleton } from "@/components/page-skeleton";
import { excerpt, parseDiff } from "@/lib/diff";
import { MODEL_LABEL, RETENTION_LABEL, SEVERITY_LABEL, SEVERITIES, duration, formatDate, nf, relative } from "@/lib/labels";
import { maskSecrets } from "@/lib/mask";
import { errorMessage, isNotFound, requestNow, requireSession } from "@/lib/pb";
import type { Comment, Issue, IssueEvent, ReviewRequest } from "@/lib/types";
import { CancelButton, LiveRefresh, RetryButton } from "../run-controls";
import { IssueWorkspace, type IssueView } from "./issue-workspace";

export const metadata: Metadata = { title: "리뷰 상세" };

// 모델 컨텍스트 기준값. 정확한 한도는 사용자의 구독·버전마다 다르므로 추정으로만 표시한다.
const CONTEXT_TOKENS = 200_000;

export default function ReviewPage(props: PageProps<"/reviews/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ReviewPageContent {...props} />
    </Suspense>
  );
}

async function ReviewPageContent({ params }: PageProps<"/reviews/[id]">) {
  const { id } = await params;
  const { pb, user } = await requireSession();
  const now = await requestNow();

  let req: ReviewRequest;
  try {
    req = await pb.collection("review_requests").getOne<ReviewRequest>(id, { expand: "repository,requester" });
  } catch (e) {
    if (isNotFound(e)) notFound();
    return <InlineError>리뷰 요청을 불러오지 못했습니다. {errorMessage(e)}</InlineError>;
  }

  // 연결 데이터는 따로 불러와 일부가 실패해도 나머지는 보여준다.
  const [issuesR, commentsR, eventsR] = await Promise.allSettled([
    pb.collection("issues").getFullList<Issue>({ filter: pb.filter("request = {:id}", { id }), sort: "created" }),
    pb.collection("comments").getFullList<Comment>({ filter: pb.filter("request = {:id}", { id }), sort: "created", expand: "author" }),
    pb.collection("issue_events").getFullList<IssueEvent>({ filter: pb.filter("request = {:id} && kind = 'status'", { id }), sort: "created", expand: "actor" }),
  ]);
  const issues = issuesR.status === "fulfilled" ? issuesR.value : [];
  const comments = commentsR.status === "fulfilled" ? commentsR.value : [];
  const events = eventsR.status === "fulfilled" ? eventsR.value : [];
  const partialLoad = [issuesR, commentsR, eventsR].some((r) => r.status === "rejected");

  const repo = req.expand?.repository;
  const color = repo?.line_color || "#15171a";
  const stats = req.diff_stats ?? { files: [], additions: 0, deletions: 0 };
  const files = parseDiff(req.diff ?? "");
  const order = { critical: 0, warning: 1, suggestion: 2 };
  const views: IssueView[] = [...issues]
    .sort((a, b) => order[a.severity] - order[b.severity])
    .map((i) => ({
      ...i,
      suggestion: maskSecrets(i.suggestion),
      body: maskSecrets(i.body),
      excerpt: excerpt(files.get(i.file), i.line_start, i.line_end).map((l) => ({ ...l, text: maskSecrets(l.text) })),
      comments: comments.filter((c) => c.issue === i.id).map((c) => ({
        id: c.id, body: c.deleted ? "" : maskSecrets(c.body), deleted: c.deleted, edited: Boolean(c.edited_at), created: c.created,
        author: c.expand?.author?.name ?? "알 수 없음", mine: c.author === user.id,
      })),
      history: events.filter((e) => e.issue === i.id).map((e) => ({ id: e.id, who: e.expand?.actor?.name ?? "—", from: e.from, to: e.to, created: e.created })),
    }));

  const counts = SEVERITIES.map((s) => [s, issues.filter((i) => i.severity === s).length] as const);
  const commits = req.commits ?? [];
  const selected = commits.filter((c) => c.selected).length;
  const tokens = Math.round((req.diff?.length ?? 0) / 3.5);
  const budget = Math.min(100, (tokens / CONTEXT_TOKENS) * 100);
  const maxChange = Math.max(1, ...stats.files.map((f) => f.additions + f.deletions));
  const active = req.status === "queued" || req.status === "running";
  const statusNote =
    req.status === "completed" ? `${duration(req.started_at, req.finished_at)} · 이슈 ${issues.length}건`
    : req.status === "running" ? `${relative(req.started_at, now)} 시작`
    : req.status === "queued" ? undefined
    : req.status === "failed" ? formatDate(req.finished_at)
    : "사용자가 취소";

  return (
    <>
      <LiveRefresh active={active} />
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="mb-1 flex items-center gap-2 text-[13px] text-muted">
            <Link href="/" className="hover:text-ink hover:underline">리뷰</Link>
            <span aria-hidden>/</span>
            {repo && <LineBadge repo={repo} size={16} />}
            <span>{repo?.name}</span>
          </p>
          <h1 className="break-all font-mono text-[20px] font-bold leading-7">
            {req.current_branch} <span className="text-muted">→ {req.target_branch}</span>
          </h1>
          <p className="num mt-1 text-[13px] text-muted">
            {req.expand?.requester?.name} 요청 · {MODEL_LABEL[req.model]} · {formatDate(req.created)} · 커밋 {commits.length}개 중 {selected}개 맥락 포함
          </p>
        </div>
        <div className="flex items-center gap-2">
          <RunPill status={req.status} />
          {active && <CancelButton id={req.id} />}
          {(req.status === "failed" || req.status === "canceled") && <RetryButton id={req.id} />}
        </div>
      </div>

      {req.status === "failed" && (
        <div className="mb-4"><InlineError action={<RetryButton id={req.id} compact />}>{req.error || "실행이 실패했습니다."}</InlineError></div>
      )}
      {partialLoad && (
        <div className="mb-4"><InlineError action={<Link href={`/reviews/${id}`} className="font-semibold underline">다시 불러오기</Link>}>이슈·댓글·이력 일부를 불러오지 못했습니다. 보이는 내용은 저장된 데이터입니다.</InlineError></div>
      )}

      <Panel className="mb-4 px-5 pb-3 pt-2">
        <RouteMap
          target={req.target_branch}
          current={req.current_branch}
          color={color}
          commits={commits}
          mergeBase={req.base_sha || stats.mergeBase}
          status={req.status}
          statusNote={statusNote}
          legend
        />
      </Panel>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]">
        <div className="grid min-w-0 grid-cols-1 content-start gap-4">
          <Panel>
            <div className="px-5 py-4">
              {req.status === "completed" ? (
                <>
                  <p className="max-w-[72ch] text-[16px] leading-6">{req.summary || "요약이 저장되지 않았습니다."}</p>
                  <p className="num mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[14px]">
                    {counts.map(([s, n]) => (
                      <span key={s}><span className="text-muted">{SEVERITY_LABEL[s]}</span> <span className={s === "critical" && n > 0 ? "font-bold text-negative" : "font-semibold"}>{n}</span></span>
                    ))}
                  </p>
                  {req.partial && (
                    <p className="mt-3 rounded-[6px] border border-warning/30 bg-warning-bg px-3 py-2 text-[13px] text-warning-ink">
                      모델 응답 일부를 해석하지 못했습니다. 해석된 이슈 {issues.length}건만 저장되었고 나머지는 빠져 있을 수 있습니다.
                    </p>
                  )}
                </>
              ) : (
                <p className="text-muted">
                  {req.status === "failed" ? "실행이 실패해 결과가 없습니다. 원인을 확인하고 재시도하세요."
                    : req.status === "canceled" ? "실행이 취소되어 결과가 없습니다."
                    : "리뷰가 끝나면 요약과 파일·라인별 이슈가 여기에 나타납니다. 이 화면을 떠나도 실행은 계속됩니다."}
                </p>
              )}
              <p className="mt-3 flex items-center gap-1.5 text-[12px] text-muted">
                <Info size={14} strokeWidth={1.75} /> AI 리뷰는 참고용입니다. 병합이나 배포를 승인하는 근거로 쓰지 마세요.
              </p>
            </div>
          </Panel>

          {(issues.length > 0 || req.status === "completed") && <IssueWorkspace issues={views} model={MODEL_LABEL[req.model]} now={now} />}
        </div>

        <div className="grid content-start gap-4">
          <Panel title="변경 파일" action={<span className="num text-[12px] text-muted">{stats.files.length}개 · <span className="text-positive">+{nf.format(stats.additions)}</span> <span className="text-negative">−{nf.format(stats.deletions)}</span></span>}>
            <ul className="px-4 py-2">
              {stats.files.map((f) => {
                const n = issues.filter((i) => i.file === f.path).length;
                return (
                  <li key={f.path} className="grid grid-cols-[6px_1fr_auto] items-stretch gap-3 py-1.5">
                    {/* 레일: 막대 높이 = 변경 라인 수에 비례 */}
                    <span className="self-center rounded-full" style={{ height: 10 + ((f.additions + f.deletions) / maxChange) * 46, background: color }} />
                    <span className="min-w-0 self-center">
                      <span className="block truncate font-mono text-[12px]" title={f.path}>{f.path}</span>
                      <span className="num text-[12px] text-muted">+{f.additions} −{f.deletions}{n > 0 && ` · 이슈 ${n}`}</span>
                    </span>
                  </li>
                );
              })}
              {stats.files.length === 0 && <li className="py-2 text-[13px] text-muted">diff 통계가 없습니다.</li>}
            </ul>
            <div className="border-t border-rule px-4 py-3">
              <div className="num flex justify-between text-[12px]">
                <span>diff 약 {nf.format(tokens)} 토큰</span>
                <span className="text-muted">컨텍스트 {nf.format(CONTEXT_TOKENS / 1000)}K 기준 {budget.toFixed(1)}%</span>
              </div>
              <div className="mt-1.5 h-1.5 rounded-full bg-rule">
                <div className="h-full rounded-full" style={{ width: `${Math.max(budget, 0.5)}%`, background: budget > 80 ? "#c4242a" : "#15171a" }} />
              </div>
              <p className="mt-1.5 text-[12px] text-muted">글자 수로 추정한 값입니다.</p>
            </div>
          </Panel>

          <Panel title="요청 정보">
            <dl className="grid grid-cols-[88px_1fr] gap-x-3 gap-y-2 px-4 py-3 text-[13px]">
              <dt className="text-muted">공통 조상</dt><dd className="font-mono">{(req.base_sha || stats.mergeBase || "—").slice(0, 10)}</dd>
              <dt className="text-muted">헤드</dt><dd className="font-mono">{(req.head_sha || "—").slice(0, 10)}</dd>
              <dt className="text-muted">시작</dt><dd className="num">{formatDate(req.started_at)}</dd>
              <dt className="text-muted">종료</dt><dd className="num">{formatDate(req.finished_at)}</dd>
              <dt className="text-muted">보존</dt><dd>{RETENTION_LABEL[req.retention]} · <Link href="/retention" className="underline">관리</Link></dd>
            </dl>
            <div className="border-t border-rule px-4 py-3">
              <h3 className="text-[13px] font-semibold">리뷰 맥락</h3>
              <p className="mt-1 whitespace-pre-wrap text-[13px] text-ink">{req.context ? maskSecrets(req.context) : <span className="text-muted">입력하지 않았습니다.</span>}</p>
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}
