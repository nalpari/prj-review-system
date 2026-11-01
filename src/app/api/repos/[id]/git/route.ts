import { NextResponse, type NextRequest } from "next/server";
import { GitError, listBranches, listCommits, syncRemote } from "@/lib/git";
import { errorMessage, isNotFound, pbFromCookies } from "@/lib/pb";
import type { Repository } from "@/lib/types";

// GET /api/repos/:id/git                      → 브랜치 목록
// GET /api/repos/:id/git?target=a&current=b   → b에만 있는 커밋
export async function GET(request: NextRequest, ctx: RouteContext<"/api/repos/[id]/git">) {
  const pb = await pbFromCookies();
  if (!pb.authStore.token) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  if (!pb.authStore.isValid) return NextResponse.json({ error: "인증이 만료되었습니다. 다시 로그인하세요.", expired: true }, { status: 401 });

  const { id } = await ctx.params;
  let repo: Repository;
  try {
    repo = await pb.collection("repositories").getOne<Repository>(id);
  } catch (e) {
    // 권한 없는 저장소는 존재 여부도 알려주지 않는다.
    if (isNotFound(e)) return NextResponse.json({ error: "저장소에 접근할 권한이 없습니다." }, { status: 403 });
    return NextResponse.json({ error: errorMessage(e) }, { status: 502 });
  }

  // 관리자는 숨긴 저장소도 조회되지만 Git 접근과 새 리뷰는 보존 중인 저장소에만 허용한다.
  if (repo.retention !== "retained") return NextResponse.json({ error: "접근 불가로 전환된 저장소입니다." }, { status: 403 });

  const target = request.nextUrl.searchParams.get("target");
  const current = request.nextUrl.searchParams.get("current");
  try {
    // 원격 저장소는 브랜치 목록을 열 때 최신으로 받는다. 커밋 조회는 직전에 받은 상태를 쓴다.
    if (repo.remote_url && !(target && current)) await syncRemote(repo.local_path);
    if (target && current) return NextResponse.json({ commits: await listCommits(repo.local_path, target, current) });
    return NextResponse.json({ branches: await listBranches(repo.local_path), defaultBranch: repo.default_branch || "main" });
  } catch (e) {
    if (e instanceof GitError) return NextResponse.json({ error: `${e.message}. ${repo.remote_url ? `원격 저장소(${repo.remote_url})와 서버의 git 접근 권한을` : `서버에서 저장소 경로(${repo.local_path})와 읽기 권한을`} 확인하세요.`, detail: e.detail }, { status: 422 });
    return NextResponse.json({ error: errorMessage(e) }, { status: 422 });
  }
}
