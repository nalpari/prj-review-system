import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { InlineError, LineBadge, PageTitle, Panel, field, label } from "@/components/ui";
import { PageSkeleton } from "@/components/page-skeleton";
import { errorMessage, requireSession } from "@/lib/pb";
import type { Repository, ReviewRequest, Team } from "@/lib/types";
import { SEOUL_LINES, lineInk } from "@/lib/lines";
import { addRepository } from "../admin-actions";

export const metadata: Metadata = { title: "저장소" };

export default function RepositoriesPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <RepositoriesPageContent />
    </Suspense>
  );
}

async function RepositoriesPageContent() {
  const { pb, user } = await requireSession();
  let repos: Repository[], teams: Team[], counts: Map<string, number>;
  try {
    [repos, teams] = await Promise.all([
      pb.collection("repositories").getFullList<Repository>({ filter: "retention = 'retained'", sort: "line_no", expand: "team" }),
      pb.collection("teams").getFullList<Team>({ sort: "name" }),
    ]);
    const reqs = await pb.collection("review_requests").getFullList<Pick<ReviewRequest, "repository">>({ filter: "retention = 'retained'", fields: "repository" });
    counts = new Map();
    for (const r of reqs) counts.set(r.repository, (counts.get(r.repository) ?? 0) + 1);
  } catch (e) {
    return <InlineError>저장소를 불러오지 못했습니다. {errorMessage(e)}</InlineError>;
  }
  const isAdmin = user.role === "admin";
  const firstFree = Object.keys(SEOUL_LINES).find((no) => !repos.some((r) => r.line_no === Number(no))) ?? "1";

  return (
    <>
      <PageTitle title="저장소" sub="리뷰할 수 있는 Git 저장소입니다. 저장소마다 노선 번호와 색이 붙습니다." />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,1fr)]">
        <Panel>
          <ul>
            {repos.map((r) => (
              <li key={r.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-4 border-b border-rule px-4 py-3 last:border-0">
                <LineBadge repo={r} size={28} />
                <div className="min-w-0">
                  <p className="font-semibold">{r.name}</p>
                  <p className="truncate font-mono text-[12px] text-muted" title={r.remote_url || r.local_path}>{r.remote_url || r.local_path} · 기본 {r.default_branch || "main"}</p>
                  <p className="text-[12px] text-muted">{r.expand?.team?.name}</p>
                </div>
                <div className="flex flex-col items-end gap-1 text-[13px]">
                  <Link href={`/?repo=${r.id}`} className="num text-muted hover:text-ink hover:underline">리뷰 {counts.get(r.id) ?? 0}건</Link>
                  <Link href={`/reviews/new?repo=${r.id}`} className="font-semibold hover:underline">리뷰 요청</Link>
                </div>
              </li>
            ))}
            {repos.length === 0 && <li className="px-4 py-8 text-muted">접근 가능한 저장소가 없습니다. {isAdmin ? (teams.length ? "오른쪽에서 등록하세요." : "") : "관리자에게 팀 저장소 접근을 요청하세요."}</li>}
          </ul>
        </Panel>

        {isAdmin && teams.length === 0 ? (
          <p className="text-[13px] text-muted">저장소는 팀에 속합니다. 먼저 <Link href="/team" className="font-semibold text-ink underline">팀·권한</Link>에서 팀을 만드세요.</p>
        ) : isAdmin ? (
          <Panel title="저장소 등록">
            <ActionForm action={addRepository} submit="등록" className="grid gap-4 p-4">
              <div>
                <label className={label} htmlFor="team">팀</label>
                <select id="team" name="team" className={field} required>
                  {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div>
                <label className={label} htmlFor="name">이름</label>
                <input id="name" name="name" className={field} placeholder="payments-api" required />
              </div>
              <div>
                <label className={label} htmlFor="remote_url">원격 저장소 URL</label>
                <input id="remote_url" name="remote_url" className={`${field} font-mono`} placeholder="git@github.com:acme/payments-api.git" required />
                <p className="mt-1 text-[12px] text-muted">서버가 새로 클론하고, 리뷰할 때마다 푸시된 최신 브랜치를 받아옵니다. 비공개 저장소는 서버의 SSH 키나 git 자격증명으로 인증합니다. URL에 토큰을 넣지 마세요.</p>
              </div>
              <div>
                <label className={label} htmlFor="default_branch">기본 타깃 브랜치</label>
                <input id="default_branch" name="default_branch" className={`${field} font-mono`} defaultValue="main" />
              </div>
              <fieldset>
                <legend className={label}>노선</legend>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(SEOUL_LINES).map(([no, l]) => {
                    const used = repos.some((r) => r.line_no === Number(no));
                    return (
                      <label key={no} className="cursor-pointer" title={`${l.name}${used ? " · 이미 쓰는 노선" : ""}`}>
                        <input type="radio" name="line_no" value={no} defaultChecked={no === firstFree} className="peer sr-only" />
                        <span className="num flex size-8 items-center justify-center rounded-full text-[14px] font-bold ring-offset-2 peer-checked:ring-2 peer-checked:ring-ink peer-focus-visible:ring-2 peer-focus-visible:ring-ink" style={{ background: l.color, color: lineInk(l.color), opacity: used ? 0.45 : 1 }}>{no}</span>
                        <span className="sr-only">{l.name}{used ? " (이미 사용 중)" : ""}</span>
                      </label>
                    );
                  })}
                </div>
                <p className="mt-1 text-[12px] text-muted">흐린 노선은 이미 다른 저장소가 씁니다. 같은 노선을 겹쳐 쓰면 목록에서 구분하기 어렵습니다.</p>
              </fieldset>
            </ActionForm>
          </Panel>
        ) : (
          <p className="text-[13px] text-muted">저장소 등록과 팀 배정은 시스템 관리자가 합니다.</p>
        )}
      </div>
    </>
  );
}
