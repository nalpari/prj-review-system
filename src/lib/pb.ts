import "server-only";
import { cache } from "react";
import PocketBase, { ClientResponseError } from "pocketbase";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import type { User } from "./types";

export const PB_URL = process.env.POCKETBASE_URL ?? "http://127.0.0.1:8090";
export const AUTH_COOKIE = "rl_auth";

// 요청마다 새 클라이언트. 사용자 토큰으로 호출하므로 PocketBase 규칙이 권한을 강제한다.
export async function pbFromCookies() {
  const pb = new PocketBase(PB_URL);
  pb.autoCancellation(false);
  const raw = (await cookies()).get(AUTH_COOKIE)?.value;
  await connection(); // authStore.isValid가 현재 시각으로 토큰 만료를 본다
  if (raw) pb.authStore.loadFromCookie(`${AUTH_COOKIE}=${encodeURIComponent(raw)}`, AUTH_COOKIE);
  return pb;
}

// authStore를 쿠키 값(JSON 문자열)으로. 이름·이메일·역할만 남겨 쿠키를 작게 유지한다.
export function authCookieValue(pb: PocketBase) {
  const r = pb.authStore.record!;
  return JSON.stringify({ token: pb.authStore.token, record: { id: r.id, collectionId: r.collectionId, collectionName: r.collectionName, email: r.email, name: r.name, role: r.role } });
}

// 요청 시각. 상대 시간 표시를 한 요청 안에서 일관되게 맞춘다.
export async function requestNow() {
  await connection();
  return Date.now();
}

export type Session = { pb: PocketBase; user: User };

// 비로그인은 /login, 토큰 만료는 /login?reason=expired 로 구분한다.
// 쿠키 안의 record는 서명되지 않아 조작할 수 있다. 신원·역할은 PocketBase가 토큰을 검증하고 돌려준 레코드에서만 가져온다.
// cache: 한 요청 안에서(사이드바와 페이지) 검증을 한 번만 한다.
export const requireSession = cache(async (): Promise<Session> => {
  const pb = await pbFromCookies();
  if (!pb.authStore.token) redirect("/login");
  if (!pb.authStore.isValid) redirect("/login?reason=expired");
  let verified = false;
  try {
    await pb.collection("users").authRefresh();
    verified = true;
  } catch (e) {
    if (!(e instanceof ClientResponseError) || (e.status !== 401 && e.status !== 403 && e.status !== 404)) throw e;
  }
  if (!verified) redirect("/login?reason=expired");
  const m = pb.authStore.record!;
  return { pb, user: { id: m.id, name: m.name || m.email, email: m.email, role: m.role === "admin" ? "admin" : "member" } };
});

export async function requireAdmin(): Promise<Session> {
  const s = await requireSession();
  if (s.user.role !== "admin") redirect("/?denied=1");
  return s;
}

export function isNotFound(e: unknown) {
  return e instanceof ClientResponseError && (e.status === 404 || e.status === 403);
}

export function errorMessage(e: unknown): string {
  if (e instanceof ClientResponseError) {
    if (e.status === 0) return "PocketBase 서버에 연결할 수 없습니다.";
    if (e.status === 401) return "인증이 만료되었습니다. 다시 로그인하세요.";
    if (e.status === 403) return "이 작업을 할 권한이 없습니다.";
    const fields = Object.entries(e.response?.data ?? {}).map(([k, v]) => `${k}: ${(v as { message?: string }).message}`);
    return fields.length ? fields.join(", ") : e.message;
  }
  return e instanceof Error ? e.message : String(e);
}
