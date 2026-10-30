import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { ConfirmButton } from "@/components/action-form";
import { InlineError, LineBadge, PageTitle, Panel, RunPill } from "@/components/ui";
import { PageSkeleton } from "@/components/page-skeleton";
import { RETENTION_LABEL, formatDate, relative } from "@/lib/labels";
import { errorMessage, requestNow, requireSession } from "@/lib/pb";
import type { Membership, Repository, ReviewRequest } from "@/lib/types";
import { setRepositoryRetention, setRequestRetention } from "../admin-actions";

export const metadata: Metadata = { title: "데이터 보존" };

export default function RetentionPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <RetentionPageContent />
    </Suspense>
  );
}

async function RetentionPageContent() {
  const { pb, user } = await requireSession();
  const now = await requestNow();
  let reqs: ReviewRequest[], mine: Membership[], repos: Repository[];
  try {
    [reqs, mine, repos] = await Promise.all([
      pb.collection("review_requests").getFullList<ReviewRequest>({
        sort: "-created",
        expand: "repository",
        fields: "id,current_branch,target_branch,status,retention,retention_changed_at,created,repository,expand.repository.id,expand.repository.name,expand.repository.line_no,expand.repository.line_color,expand.repository.team",
      }),
      pb.collection("memberships").getFullList<Membership>({ filter: pb.filter("user = {:u}", { u: user.id }) }),
      pb.collection("repositories").getFullList<Repository>({ sort: "line_no" }),
    ]);
  } catch (e) {
    return <InlineError>보존 정보를 불러오지 못했습니다. {errorMessage(e)}</InlineError>;
  }
  const isAdmin = user.role === "admin";
  const stewardOf = new Set(mine.filter((m) => m.role === "lead" || m.role === "manager").map((m) => m.team));
  const canManage = (teamId?: string) => isAdmin || (teamId ? stewardOf.has(teamId) : false);

  return (
    <>
      <PageTitle
        title="데이터 보존"
        sub="리뷰 요청에는 소스 diff, 커밋 맥락, AI 결과, 댓글, 실행 기록이 함께 저장됩니다. 접근 불가로 돌리거나 삭제하면 연결된 데이터 전체에 같은 정책이 적용됩니다."
      />
      <p className="mb-4 max-w-[80ch] text-[13px] text-muted">
        토큰·비밀번호·비밀 키처럼 탐지되는 비밀정보는 저장 전에 가려지며 원문은 복구할 수 없습니다.
        {canManage() || stewardOf.size > 0 ? " 테크 리드·팀 관리자·시스템 관리자만 상태를 바꿀 수 있습니다." : " 상태 변경은 팀의 테크 리드나 팀 관리자에게 요청하세요."}
      </p>

      <Panel title="리뷰 요청">
        <ul>
          {reqs.map((r) => {
            const repo = r.expand?.repository;
            const manage = canManage(repo?.team);
            return (
              <li key={r.id} className="grid grid-cols-[1fr_auto] items-center gap-3 border-b border-rule px-4 py-3 last:border-0 md:grid-cols-[minmax(0,1fr)_120px_150px_auto]">
                <div className="flex min-w-0 items-center gap-3">
                  {repo && <LineBadge repo={repo} size={20} />}
                  <div className="min-w-0">
                    {r.retention === "retained" ? (
                      <Link href={`/reviews/${r.id}`} className="block truncate font-mono text-[13px] font-semibold hover:underline">{r.current_branch} → {r.target_branch}</Link>
                    ) : (
                      <span className="block truncate font-mono text-[13px] text-muted">{r.current_branch} → {r.target_branch}</span>
                    )}
                    <span className="block text-[12px] text-muted">{repo?.name} · {relative(r.created, now)}</span>
                  </div>
                </div>
                <span className="hidden md:block"><RunPill status={r.status} /></span>
                <span className="text-[13px]">
                  <span className={r.retention === "retained" ? "" : "font-semibold text-warning-ink"}>{RETENTION_LABEL[r.retention]}</span>
                  {r.retention_changed_at && <span className="num block text-[12px] text-muted">{formatDate(r.retention_changed_at)}</span>}
                </span>
                <span className="col-span-2 flex flex-wrap justify-end gap-2 md:col-span-1">
                  {manage ? (
                    <>
                      {r.retention === "retained" ? (
                        <ConfirmButton label="접근 불가로" run={setRequestRetention.bind(null, r.id, "hidden")} confirmText={`${r.current_branch} 리뷰를 접근 불가로 돌릴까요? 대시보드와 이력에서 사라지고 권한자만 볼 수 있습니다.`} />
                      ) : (
                        <ConfirmButton label="다시 보존" run={setRequestRetention.bind(null, r.id, "retained")} />
                      )}
                      <ConfirmButton variant="danger" label="삭제" run={setRequestRetention.bind(null, r.id, "deleted")} confirmText={`${r.current_branch} → ${r.target_branch} 리뷰와 diff·결과·댓글·실행 기록을 영구 삭제할까요? 되돌릴 수 없습니다.`} />
                    </>
                  ) : (
                    <span className="text-[12px] text-muted">변경 권한 없음</span>
                  )}
                </span>
              </li>
            );
          })}
          {reqs.length === 0 && <li className="px-4 py-8 text-muted">보존 중인 리뷰 데이터가 없습니다.</li>}
        </ul>
      </Panel>

      {isAdmin && (
        <Panel title="저장소 단위" className="mt-4">
          <ul>
            {repos.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-3 border-b border-rule px-4 py-3 last:border-0">
                <LineBadge repo={r} size={20} />
                <span className="min-w-0 flex-1 font-semibold">{r.name} <span className="ml-1 text-[13px] font-normal text-muted">{RETENTION_LABEL[r.retention || "retained"]}</span></span>
                {r.retention === "hidden" ? (
                  <ConfirmButton label="다시 보존" run={setRepositoryRetention.bind(null, r.id, "retained")} />
                ) : (
                  <ConfirmButton label="저장소 접근 불가로" run={setRepositoryRetention.bind(null, r.id, "hidden")} confirmText={`${r.name}의 모든 리뷰 데이터를 접근 불가로 돌릴까요?`} />
                )}
                <ConfirmButton variant="danger" label="저장소 데이터 삭제" run={setRepositoryRetention.bind(null, r.id, "deleted")} confirmText={`${r.name} 저장소 등록과 모든 리뷰·diff·결과·댓글·실행 기록을 영구 삭제할까요? 되돌릴 수 없습니다.`} />
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </>
  );
}
