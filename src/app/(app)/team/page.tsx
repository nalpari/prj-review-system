import { Suspense } from "react";
import type { Metadata } from "next";
import { ActionForm } from "@/components/action-form";
import { InlineError, LineBadge, PageTitle, Panel, field, label } from "@/components/ui";
import { PageSkeleton } from "@/components/page-skeleton";
import { ROLE_LABEL } from "@/lib/labels";
import { errorMessage, requireAdmin } from "@/lib/pb";
import type { Membership, Repository, Team, User } from "@/lib/types";
import { addMember, createTeam, createUser } from "../admin-actions";
import { MemberControls } from "./member-controls";

export const metadata: Metadata = { title: "팀·권한" };

export default function TeamPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <TeamPageContent />
    </Suspense>
  );
}

async function TeamPageContent() {
  const { pb } = await requireAdmin();
  let teams: Team[], members: Membership[], users: User[], repos: Repository[];
  try {
    [teams, members, users, repos] = await Promise.all([
      pb.collection("teams").getFullList<Team>({ sort: "name" }),
      pb.collection("memberships").getFullList<Membership>({ expand: "user", sort: "created" }),
      pb.collection("users").getFullList<User>({ sort: "name" }),
      pb.collection("repositories").getFullList<Repository>({ filter: "retention = 'retained'", sort: "line_no" }),
    ]);
  } catch (e) {
    return <InlineError>팀 정보를 불러오지 못했습니다. {errorMessage(e)}</InlineError>;
  }

  return (
    <>
      <PageTitle title="팀·권한" sub="구성원은 소속 팀의 저장소에서만 리뷰를 만들고, 보고, 댓글을 남길 수 있습니다. 서버 API도 같은 규칙으로 막습니다." />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,1fr)]">
        <div className="grid content-start gap-4">
          {teams.length === 0 && (
            <Panel><p className="px-4 py-8">아직 팀이 없습니다. 오른쪽에서 팀을 만들면 구성원을 넣고 저장소를 연결할 수 있습니다.</p></Panel>
          )}
          {teams.map((t) => {
            const tm = members.filter((m) => m.team === t.id);
            const tr = repos.filter((r) => r.team === t.id);
            return (
              <Panel
                key={t.id}
                title={t.name}
                action={
                  <span className="flex items-center gap-1.5" title="이 팀이 접근하는 저장소">
                    {tr.map((r) => <LineBadge key={r.id} repo={r} size={18} />)}
                    <span className="num text-[12px] text-muted">저장소 {tr.length}</span>
                  </span>
                }
              >
                <ul>
                  {tm.map((m) => (
                    <li key={m.id} className="flex flex-wrap items-center gap-3 border-b border-rule px-4 py-2.5 last:border-0">
                      <span className="flex size-7 items-center justify-center rounded-full bg-active text-[12px] font-bold" aria-hidden>{m.expand?.user?.name?.slice(0, 1)}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold">{m.expand?.user?.name}</span>
                        <span className="block truncate text-[12px] text-muted">{m.expand?.user?.email}</span>
                      </span>
                      <MemberControls id={m.id} role={m.role} name={m.expand?.user?.name ?? ""} team={t.name} />
                    </li>
                  ))}
                  {tm.length === 0 && <li className="px-4 py-4 text-muted">구성원이 없습니다.</li>}
                </ul>
              </Panel>
            );
          })}
        </div>

        <div className="grid content-start gap-4">
          <Panel title="팀 만들기">
            <ActionForm action={createTeam} submit="팀 만들기" className="grid gap-4 p-4">
              <div>
                <label className={label} htmlFor="t-name">팀 이름</label>
                <input id="t-name" name="name" maxLength={80} className={field} placeholder="결제팀" required />
              </div>
            </ActionForm>
          </Panel>

          {teams.length > 0 && <Panel title="팀에 구성원 추가">
            <ActionForm action={addMember} submit="추가" className="grid gap-4 p-4">
              <div>
                <label className={label} htmlFor="m-team">팀</label>
                <select id="m-team" name="team" className={field}>{teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
              </div>
              <div>
                <label className={label} htmlFor="m-user">사용자</label>
                <select id="m-user" name="user" className={field}>{users.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}</select>
              </div>
              <div>
                <label className={label} htmlFor="m-role">역할</label>
                <select id="m-role" name="role" className={field}>
                  {Object.entries(ROLE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
                <p className="mt-1 text-[12px] text-muted">테크 리드와 팀 관리자는 팀 리뷰 데이터를 접근 불가로 돌리거나 삭제할 수 있습니다.</p>
              </div>
            </ActionForm>
          </Panel>}

          <Panel title="계정 만들기">
            <ActionForm action={createUser} submit="계정 만들기" className="grid gap-4 p-4">
              <div>
                <label className={label} htmlFor="u-name">이름</label>
                <input id="u-name" name="name" className={field} required />
              </div>
              <div>
                <label className={label} htmlFor="u-email">이메일</label>
                <input id="u-email" name="email" type="email" className={field} required />
              </div>
              <div>
                <label className={label} htmlFor="u-pass">초기 비밀번호</label>
                <input id="u-pass" name="password" type="password" minLength={10} autoComplete="new-password" className={field} required />
                <p className="mt-1 text-[12px] text-muted">10자 이상. 처음 로그인한 뒤 바꾸도록 안내하세요.</p>
              </div>
              <label className="flex items-center gap-2 text-[14px]">
                <input type="checkbox" name="role" value="admin" className="size-4 accent-[#15171a]" /> 시스템 관리자 권한
              </label>
            </ActionForm>
          </Panel>
        </div>
      </div>
    </>
  );
}
