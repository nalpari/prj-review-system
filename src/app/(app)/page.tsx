import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { ButtonLink, InlineError, LineBadge, PageTitle, Panel, RunPill, btn, cx, field } from "@/components/ui";
import { PageSkeleton } from "@/components/page-skeleton";
import { DateFilter } from "@/components/date-filter";
import { errorMessage, requestNow, requireSession } from "@/lib/pb";
import { MODEL_LABEL, RUN_LABEL, nf, relative } from "@/lib/labels";
import type { Issue, Repository, ReviewRequest, RunStatus, User } from "@/lib/types";
import { RetryButton } from "./reviews/run-controls";

export const metadata: Metadata = { title: "리뷰" };

const PER_PAGE = 30;
type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");

export default function ReviewsPage(props: PageProps<"/">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ReviewsPageContent {...props} />
    </Suspense>
  );
}

async function ReviewsPageContent({ searchParams }: PageProps<"/">) {
  const sp: SP = await searchParams;
  const { pb } = await requireSession();
  const now = await requestNow();
  const f = {
    repo: one(sp.repo),
    branch: one(sp.branch).trim(),
    requester: one(sp.requester),
    status: one(sp.status),
    model: one(sp.model),
    from: one(sp.from),
    to: one(sp.to),
  };
  const page = Math.max(1, Number(one(sp.page)) || 1);

  // 보존 권한자는 접근 불가 요청도 조회할 수 있지만, 이력 목록에는 보존 중인 것만 보인다.
  const clauses: string[] = ["retention = 'retained'"];
  const params: Record<string, string> = {};
  const rules: [string, string, string][] = [
    ["repo", "repository = {:repo}", f.repo],
    ["branch", "(current_branch ~ {:branch} || target_branch ~ {:branch})", f.branch],
    ["requester", "requester = {:requester}", f.requester],
    ["status", "status = {:status}", f.status],
    ["model", "model = {:model}", f.model],
    ["from", "created >= {:from}", f.from && `${f.from} 00:00:00`],
    ["to", "created <= {:to}", f.to && `${f.to} 23:59:59`],
  ];
  for (const [key, clause, value] of rules) {
    if (!value) continue;
    clauses.push(clause);
    params[key] = value;
  }
  const filter = pb.filter(clauses.join(" && "), params);
  const filtered = clauses.length > 1;

  let list, repos: Repository[], people: User[], open: { running: number; queued: number; failed: number };
  try {
    [list, repos, people] = await Promise.all([
      pb.collection("review_requests").getList<ReviewRequest>(page, PER_PAGE, {
        filter,
        sort: "-created",
        expand: "repository,requester",
        fields: "id,current_branch,target_branch,model,status,created,started_at,finished_at,error,partial,expand.repository.id,expand.repository.name,expand.repository.line_no,expand.repository.line_color,expand.requester.id,expand.requester.name",
      }),
      pb.collection("repositories").getFullList<Repository>({ filter: "retention = 'retained'", sort: "line_no" }),
      pb.collection("users").getFullList<User>({ sort: "name", fields: "id,name" }),
    ]);
    const count = (s: RunStatus) => pb.collection("review_requests").getList(1, 1, { filter: `status = '${s}' && retention = 'retained'`, fields: "id" }).then((r) => r.totalItems);
    const [running, queued, failed] = await Promise.all([count("running"), count("queued"), count("failed")]);
    open = { running, queued, failed };
  } catch (e) {
    return (
      <>
        <PageTitle title="리뷰" />
        <InlineError action={<Link href="/" className="font-semibold underline">다시 불러오기</Link>}>리뷰 목록을 불러오지 못했습니다. {errorMessage(e)}</InlineError>
      </>
    );
  }

  const ids = list.items.map((r) => r.id);
  const issues = ids.length
    ? await pb.collection("issues").getFullList<Pick<Issue, "request" | "status" | "severity">>({
        filter: ids.map((id) => pb.filter("request = {:id}", { id })).join(" || "),
        fields: "request,status,severity",
      })
    : [];
  const tally = new Map<string, { open: number; total: number; critical: number }>();
  for (const i of issues) {
    const t = tally.get(i.request) ?? { open: 0, total: 0, critical: 0 };
    t.total++;
    if (i.status === "unread" || i.status === "acknowledged") t.open++;
    if (i.severity === "critical" && i.status !== "resolved") t.critical++;
    tally.set(i.request, t);
  }

  const finding = [
    open.running && `실행 중 ${open.running}건`,
    open.queued && `대기 ${open.queued}건`,
    open.failed && `실패 ${open.failed}건은 재시도가 필요합니다`,
  ].filter(Boolean).join(" · ") || "진행 중이거나 실패한 요청이 없습니다.";

  const qs = (patch: Record<string, string>) => {
    const u = new URLSearchParams(Object.entries({ ...f, page: String(page), ...patch }).filter(([k, v]) => v && !(k === "page" && v === "1")));
    return `/?${u}`;
  };
  const first = (page - 1) * PER_PAGE + 1;
  const last = first + list.items.length - 1;

  return (
    <>
      <PageTitle
        title="리뷰"
        sub={finding}
        actions={<ButtonLink href="/reviews/new" variant="primary"><Plus size={16} />새 리뷰 요청</ButtonLink>}
      />

      <form method="get" className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-[1.2fr_1.2fr_1fr_0.9fr_0.9fr_1fr_1fr_auto]" aria-label="리뷰 이력 필터">
        <select name="repo" defaultValue={f.repo} className={field} aria-label="저장소">
          <option value="">모든 저장소</option>
          {repos.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
        <input name="branch" defaultValue={f.branch} placeholder="브랜치 이름" className={field} aria-label="브랜치" />
        <select name="requester" defaultValue={f.requester} className={field} aria-label="요청자">
          <option value="">모든 요청자</option>
          {people.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        <select name="status" defaultValue={f.status} className={field} aria-label="상태">
          <option value="">모든 상태</option>
          {(Object.keys(RUN_LABEL) as RunStatus[]).map((s) => <option key={s} value={s}>{RUN_LABEL[s]}</option>)}
        </select>
        <select name="model" defaultValue={f.model} className={field} aria-label="모델">
          <option value="">모든 모델</option>
          <option value="claude">Claude</option>
          <option value="codex">Codex</option>
        </select>
        <DateFilter name="from" defaultValue={f.from} label="시작일" />
        <DateFilter name="to" defaultValue={f.to} label="종료일" />
        <div className="col-span-2 flex gap-2 md:col-span-1">
          <button type="submit" className={btn("secondary", "h-9 flex-1")}>적용</button>
          {filtered && <Link href="/" className={btn("ghost", "h-9")}>초기화</Link>}
        </div>
      </form>

      <Panel>
        <div className="flex items-center justify-between border-b border-rule px-4 py-3 text-[13px] text-muted">
          <span className="num">{list.totalItems ? `${nf.format(first)}–${nf.format(last)} / ${nf.format(list.totalItems)}건` : "0건"} · 최신순</span>
        </div>
        {list.items.length === 0 ? (
          <div className="px-4 py-10">
            {filtered ? (
              <p>조건에 맞는 리뷰가 없습니다. <Link href="/" className="font-semibold underline">필터 초기화</Link></p>
            ) : (
              <p>아직 리뷰 요청이 없습니다. <Link href="/reviews/new" className="font-semibold underline">첫 리뷰를 요청</Link>하면 실행 상태와 결과가 여기에 쌓입니다.</p>
            )}
          </div>
        ) : (
          <ul>
            <li aria-hidden className="hidden grid-cols-[minmax(0,2.4fr)_minmax(0,1fr)_88px_96px_minmax(0,1fr)_96px] gap-x-4 border-b border-rule px-4 py-2 text-[12px] text-muted md:grid">
              <span className="pl-[34px]">브랜치 → 타깃</span><span>요청자</span><span>모델</span><span>상태</span><span>이슈</span><span className="text-right">생성</span>
            </li>
            {list.items.map((r) => {
              const repo = r.expand?.repository;
              const t = tally.get(r.id);
              return (
                <li key={r.id} className="group relative grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 border-b border-rule px-4 py-3 last:border-0 hover:bg-raised md:grid-cols-[minmax(0,2.4fr)_minmax(0,1fr)_88px_96px_minmax(0,1fr)_96px]">
                  <div className="flex min-w-0 items-center gap-3">
                    {repo && <LineBadge repo={repo} size={22} />}
                    <div className="min-w-0">
                      <Link href={`/reviews/${r.id}`} className="block truncate font-mono text-[13px] font-semibold after:absolute after:inset-0 focus-visible:outline-none" title={`${r.current_branch} → ${r.target_branch}`}>
                        {r.current_branch} <span className="text-muted">→ {r.target_branch}</span>
                      </Link>
                      <span className="block truncate text-[12px] text-muted">{repo?.name}</span>
                    </div>
                  </div>
                  <span className="hidden truncate md:block">{r.expand?.requester?.name ?? "—"}</span>
                  <span className="hidden text-muted md:block">{MODEL_LABEL[r.model]}</span>
                  <span className="justify-self-end md:justify-self-start"><RunPill status={r.status} /></span>
                  <span className="num col-span-2 text-[13px] text-muted md:col-span-1">
                    {r.status === "failed" ? (
                      <span className="relative z-10 inline-flex items-center gap-2 text-negative-ink">
                        <span className="truncate" title={r.error}>실행 실패</span>
                        <RetryButton id={r.id} compact />
                      </span>
                    ) : t ? (
                      <>
                        미처리 <span className="font-semibold text-ink">{t.open}</span> / {t.total}
                        {t.critical > 0 && <span className="ml-2 font-semibold text-negative">치명 {t.critical}</span>}
                      </>
                    ) : r.status === "completed" ? (
                      r.partial ? "일부만 저장됨" : "지적 없음"
                    ) : "—"}
                  </span>
                  <span className="num hidden text-right text-[13px] text-muted md:block" title={r.created}>{relative(r.created, now)}</span>
                  <span className={cx("num text-[12px] text-muted md:hidden")}>{r.expand?.requester?.name} · {MODEL_LABEL[r.model]} · {relative(r.created, now)}</span>
                </li>
              );
            })}
          </ul>
        )}
        {list.totalPages > 1 && (
          <nav aria-label="페이지" className="flex items-center justify-end gap-2 border-t border-rule px-4 py-3">
            {page > 1 && <Link className={btn("secondary")} href={qs({ page: String(page - 1) })}>이전</Link>}
            <span className="num text-[13px] text-muted">{page} / {list.totalPages}</span>
            {page < list.totalPages && <Link className={btn("secondary")} href={qs({ page: String(page + 1) })}>다음</Link>}
          </nav>
        )}
      </Panel>
    </>
  );
}
