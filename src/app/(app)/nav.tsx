"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Archive, FolderGit2, ListChecks, Menu, Plus, Users, X } from "lucide-react";
import { Wordmark } from "@/components/wordmark";
import { btn, cx } from "@/components/ui";

const ITEMS = [
  { href: "/", label: "리뷰", icon: ListChecks, admin: false },
  { href: "/repositories", label: "저장소", icon: FolderGit2, admin: false },
  { href: "/team", label: "팀·권한", icon: Users, admin: true },
  { href: "/retention", label: "데이터 보존", icon: Archive, admin: false },
];

export function NavLinks({ isAdmin, activeRuns }: { isAdmin: boolean; activeRuns: number }) {
  const path = usePathname();
  const active = (href: string) => (href === "/" ? path === "/" || path.startsWith("/reviews/") && path !== "/reviews/new" : path.startsWith(href));
  return (
    <nav aria-label="주 메뉴" className="mt-5 px-3">
      <Link href="/reviews/new" className={btn("primary", "mb-4 w-full")}>
        <Plus size={16} strokeWidth={2} />새 리뷰 요청
      </Link>
      <ul className="grid gap-0.5">
        {ITEMS.filter((i) => !i.admin || isAdmin).map(({ href, label, icon: Icon }) => (
          <li key={href}>
            <Link
              href={href}
              aria-current={active(href) ? "page" : undefined}
              className={cx(
                "flex h-8 items-center gap-2.5 rounded-[6px] px-2 text-[14px] text-ink hover:bg-active",
                active(href) && "bg-active font-semibold",
              )}
            >
              <Icon size={16} strokeWidth={1.75} className="text-muted" />
              <span className="flex-1">{label}</span>
              {href === "/" && activeRuns > 0 && (
                <span className="num text-[12px] text-muted" title="대기 또는 실행 중인 요청">진행 {activeRuns}</span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

// 1024px 아래에서는 사이드바가 상단 바 + 전체 화면 시트로 접힌다.
export function MobileBar({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="lg:hidden">
      <div className="sticky top-0 z-20 flex h-12 items-center justify-between border-b border-border bg-ground px-4">
        <Link href="/" className="inline-flex"><Wordmark /></Link>
        <button type="button" onClick={() => setOpen(true)} className="flex size-11 items-center justify-center rounded-[6px] hover:bg-active" aria-label="메뉴 열기" aria-expanded={open}>
          <Menu size={20} strokeWidth={1.75} />
        </button>
      </div>
      {open && (
        <div role="dialog" aria-modal aria-label="메뉴" className="fixed inset-0 z-30 flex flex-col bg-ground py-4">
          <div className="flex justify-end px-4">
            <button type="button" onClick={() => setOpen(false)} className="flex size-11 items-center justify-center rounded-[6px] hover:bg-active" aria-label="메뉴 닫기">
              <X size={20} strokeWidth={1.75} />
            </button>
          </div>
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto" onClick={(e) => (e.target as HTMLElement).closest("a") && setOpen(false)}>{children}</div>
        </div>
      )}
    </div>
  );
}
