"use server";

import PocketBase, { ClientResponseError } from "pocketbase";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AUTH_COOKIE, PB_URL, authCookieValue } from "@/lib/pb";

export type LoginState = { error?: string; email?: string };

export async function login(_: LoginState, form: FormData): Promise<LoginState> {
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  if (!email || !password) return { error: "이메일과 비밀번호를 모두 입력하세요.", email };

  const pb = new PocketBase(PB_URL);
  try {
    await pb.collection("users").authWithPassword(email, password);
  } catch (e) {
    if (e instanceof ClientResponseError && e.status === 0) return { error: "인증 서버에 연결할 수 없습니다. 잠시 뒤 다시 시도하세요.", email };
    return { error: "이메일 또는 비밀번호가 맞지 않습니다.", email };
  }
  (await cookies()).set(AUTH_COOKIE, authCookieValue(pb), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  const next = String(form.get("next") ?? "/");
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/");
}

export async function logout() {
  (await cookies()).delete(AUTH_COOKIE);
  redirect("/login");
}
