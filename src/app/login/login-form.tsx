"use client";

import { use, useActionState } from "react";
import { btn, field, InlineError, label } from "@/components/ui";
import { login, type LoginState } from "./actions";

export function LoginForm({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = use(searchParams);
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});
  const expired = sp.reason === "expired";
  const next = typeof sp.next === "string" ? sp.next : "/";

  return (
    <form action={action} className="mt-8 grid gap-4" noValidate>
      {expired && !state.error && (
        <div role="status" className="rounded-[6px] border border-warning/30 bg-warning-bg px-3 py-2 text-[13px] text-warning-ink">
          세션이 만료되었습니다. 다시 로그인하면 보던 화면으로 돌아갑니다.
        </div>
      )}
      {state.error && <InlineError>{state.error}</InlineError>}
      <input type="hidden" name="next" value={next} />
      <div>
        <label htmlFor="email" className={label}>이메일</label>
        <input id="email" name="email" type="email" autoComplete="username" required defaultValue={state.email} className={field} />
      </div>
      <div>
        <label htmlFor="password" className={label}>비밀번호</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required className={field} />
      </div>
      <button type="submit" disabled={pending} className={btn("primary", "mt-2 h-10 text-[14px]")}>
        {pending ? "확인 중…" : "로그인"}
      </button>
    </form>
  );
}
