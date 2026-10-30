"use client";

import { useRouter } from "next/navigation";
import { useEffect, useTransition } from "react";
import { RotateCw, Square } from "lucide-react";
import { btn } from "@/components/ui";
import { cancelReview, retryReview } from "./actions";

export function RetryButton({ id, compact }: { id: string; compact?: boolean }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(() => retryReview(id))}
      className={compact ? "relative z-10 font-semibold text-ink underline underline-offset-2 disabled:opacity-60" : btn("primary")}
    >
      {!compact && <RotateCw size={14} />}
      {pending ? "재시도 중…" : "재시도"}
    </button>
  );
}

export function CancelButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <button type="button" disabled={pending} onClick={() => start(() => cancelReview(id))} className={btn("secondary")}>
      <Square size={12} />
      {pending ? "취소 중…" : "실행 취소"}
    </button>
  );
}

// 대기·실행 중이면 서버 상태를 주기적으로 다시 읽는다. 새로고침해도 상태는 서버에 있다.
export function LiveRefresh({ active }: { active: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => router.refresh(), 3000);
    return () => clearInterval(t);
  }, [active, router]);
  return null;
}
