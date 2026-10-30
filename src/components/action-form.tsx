"use client";

import { useActionState, useState, useTransition, type ReactNode } from "react";
import { InlineError, btn } from "./ui";

type State = { error?: string; ok?: string };

export function ActionForm({ action, submit, children, className }: { action: (s: State, f: FormData) => Promise<State>; submit: string; children: ReactNode; className?: string }) {
  const [state, run, pending] = useActionState(action, {});
  return (
    <form action={run} className={className}>
      {children}
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={btn("primary")}>{pending ? "처리 중…" : submit}</button>
        <span aria-live="polite" className="text-[13px] text-positive">{state.ok}</span>
      </div>
      {state.error && <div className="mt-2"><InlineError>{state.error}</InlineError></div>}
    </form>
  );
}

// 되돌리기 어려운 동작은 대상 이름을 밝히고 확인을 받는다.
export function ConfirmButton({ run, label, confirmText, variant = "secondary" }: { run: () => Promise<State | void>; label: string; confirmText?: string; variant?: "secondary" | "danger" | "ghost" }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<State>({});
  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={pending}
        className={btn(variant)}
        onClick={() => {
          if (confirmText && !confirm(confirmText)) return;
          start(async () => setMsg((await run()) ?? {}));
        }}
      >
        {pending ? "처리 중…" : label}
      </button>
      {msg.error && <span role="alert" className="max-w-[260px] text-right text-[12px] text-negative">{msg.error}</span>}
    </span>
  );
}
