import Link from "next/link";
import { LogOut } from "lucide-react";
import { logout } from "@/app/login/actions";
import { LineBadge } from "@/components/ui";
import { Wordmark } from "@/components/wordmark";
import { requireSession } from "@/lib/pb";
import type { Membership, Repository, ReviewRequest } from "@/lib/types";
import { MobileBar, NavLinks } from "./nav";

export async function Sidebar() {
  const { pb, user } = await requireSession();
  const [memberships, repos, queue] = await Promise.all([
    pb.collection("memberships").getFullList<Membership>({ filter: pb.filter("user = {:u}", { u: user.id }), expand: "team" }),
    pb.collection("repositories").getFullList<Repository>({ filter: "retention = 'retained'", sort: "line_no" }),
    pb.collection("review_requests").getList<ReviewRequest>(1, 1, { filter: "(status = 'running' || status = 'queued') && retention = 'retained'", fields: "id" }),
  ]);
  const teams = memberships.map((m) => m.expand?.team?.name).filter(Boolean).join(", ") || (user.role === "admin" ? "전체 팀(관리자)" : "소속 팀 없음");

  const body = (
    <>
      <div className="px-3">
        <Link href="/" className="inline-flex rounded-[6px] px-1 py-1"><Wordmark /></Link>
        <p className="mt-3 truncate px-1 text-[12px] text-muted" title={teams}>{teams}</p>
      </div>
      <NavLinks isAdmin={user.role === "admin"} activeRuns={queue.totalItems} />
      <div className="mt-6 px-3">
        <h2 className="px-2 text-[12px] font-semibold text-muted">저장소</h2>
        <ul className="mt-2">
          {repos.map((r) => (
            <li key={r.id}>
              <Link href={`/?repo=${r.id}`} className="flex h-8 items-center gap-2.5 rounded-[6px] px-2 text-[13px] hover:bg-active">
                <LineBadge repo={r} size={18} />
                <span className="truncate">{r.name}</span>
              </Link>
            </li>
          ))}
          {repos.length === 0 && <li className="px-2 text-[13px] text-muted">접근 가능한 저장소가 없습니다.</li>}
        </ul>
      </div>
      <div className="mt-auto flex items-center gap-2 border-t border-border px-3 pt-3">
        <span className="flex size-7 flex-none items-center justify-center rounded-full bg-active text-[12px] font-bold">{user.name.slice(0, 1)}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-semibold">{user.name}</span>
          <span className="block truncate text-[12px] text-muted">{user.email}</span>
        </span>
        <form action={logout}>
          <button type="submit" className="flex size-8 items-center justify-center rounded-[6px] text-muted hover:bg-active hover:text-ink" aria-label="로그아웃" title="로그아웃">
            <LogOut size={16} strokeWidth={1.75} />
          </button>
        </form>
      </div>
    </>
  );

  return (
    <>
      <MobileBar>{body}</MobileBar>
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-border py-5 lg:flex">{body}</aside>
    </>
  );
}

export function SidebarFallback() {
  return <aside className="hidden h-dvh border-r border-border lg:block" />;
}
