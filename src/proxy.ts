import { NextResponse, type NextRequest } from "next/server";

// 낙관적 검사: 쿠키가 없으면 로그인으로. 실제 검증은 각 화면과 PocketBase 규칙이 한다.
export function proxy(request: NextRequest) {
  if (request.cookies.has("rl_auth")) return NextResponse.next();
  const url = new URL("/login", request.url);
  const next = request.nextUrl.pathname + request.nextUrl.search;
  if (next !== "/") url.searchParams.set("next", next);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!login|api|_next|favicon.ico|fonts).*)"],
};
