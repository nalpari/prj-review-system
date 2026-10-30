"use server";

import { randomUUID } from "node:crypto";
import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ClientResponseError } from "pocketbase";
import { collectDiff, GitError, listCommits } from "@/lib/git";
import { maskSecrets } from "@/lib/mask";
import { errorMessage, requireSession } from "@/lib/pb";
import { pbService } from "@/lib/pb-service";
import { transition } from "@/lib/run-state";
import { startRun } from "@/lib/runner";
import { ISSUE_STATUSES } from "@/lib/labels";
import type { Comment, Issue, IssueStatus, Model, Repository, ReviewRequest } from "@/lib/types";

export type FormState = { error?: string; fieldErrors?: Record<string, string> };

// 권한 확인은 사용자 토큰으로 읽어서 하고(읽히면 접근 가능), 쓰기는 서비스 클라이언트로 한다.
// 자유 텍스트(리뷰 맥락, 댓글)는 저장 전에 마스킹한다.

export async function createReview(_: FormState, form: FormData): Promise<FormState> {
  const { pb, user } = await requireSession();
  const repoId = String(form.get("repository") ?? "");
  const current = String(form.get("current_branch") ?? "").trim();
  const target = String(form.get("target_branch") ?? "").trim();
  const model = String(form.get("model") ?? "") as Model;
  const context = String(form.get("context") ?? "").trim();
  const selected = new Set(form.getAll("commit").map(String));
  // 같은 폼 제출을 여러 번 받아도 요청은 하나만 생긴다.
  const key = String(form.get("idempotency_key") ?? "") || randomUUID();

  const fieldErrors: Record<string, string> = {};
  if (!repoId) fieldErrors.repository = "저장소를 고르세요.";
  if (!current) fieldErrors.current_branch = "현재 브랜치를 고르세요.";
  if (!target) fieldErrors.target_branch = "타깃 브랜치를 고르세요.";
  if (current && current === target) fieldErrors.target_branch = "현재 브랜치와 다른 브랜치를 고르세요.";
  if (model !== "claude" && model !== "codex") fieldErrors.model = "Claude 또는 Codex를 고르세요.";
  if (context.length > 4000) fieldErrors.context = `리뷰 맥락은 4,000자까지입니다(지금 ${context.length.toLocaleString("ko-KR")}자).`;
  if (Object.keys(fieldErrors).length) return { fieldErrors };

  const existing = await pb.collection("review_requests").getList<ReviewRequest>(1, 1, { filter: pb.filter("idempotency_key = {:k}", { k: key }) });
  if (existing.items[0]) redirect(`/reviews/${existing.items[0].id}`);

  let repo: Repository;
  try {
    repo = await pb.collection("repositories").getOne<Repository>(repoId);
  } catch (e) {
    return { error: `저장소에 접근할 수 없습니다. ${errorMessage(e)}` };
  }
  if (repo.retention !== "retained") return { error: "접근 불가로 전환된 저장소에는 리뷰를 요청할 수 없습니다." };

  let created: ReviewRequest;
  try {
    const commits = await listCommits(repo.local_path, target, current);
    if (commits.length === 0) return { error: `${current}에는 ${target}에 없는 커밋이 없습니다. 커밋한 뒤 다시 신청하세요.` };
    const diff = await collectDiff(repo.local_path, target, current);
    if (diff.stats.files.length === 0) return { error: `${target}...${current} diff가 비어 있습니다. 변경된 파일이 없으면 리뷰할 수 없습니다.` };
    const svc = await pbService();
    created = await svc.collection("review_requests").create<ReviewRequest>({
      repository: repo.id,
      requester: user.id,
      current_branch: current,
      target_branch: target,
      base_sha: diff.baseSha,
      head_sha: diff.headSha,
      commits: commits.map((c) => ({ ...c, selected: selected.size === 0 || selected.has(c.sha) })),
      context: maskSecrets(context),
      model,
      status: "queued",
      idempotency_key: key,
      diff_stats: diff.stats,
      diff: diff.diff,
      retention: "retained",
      partial: false,
    });
  } catch (e) {
    if (e instanceof GitError) return { error: `${e.message}. 저장소 경로와 브랜치를 확인한 뒤 다시 신청하세요.${e.detail ? ` (git: ${e.detail})` : ""}` };
    // 동시 제출로 유니크 인덱스에 걸리면 먼저 만들어진 요청으로 보낸다.
    if (e instanceof ClientResponseError && e.response?.data?.idempotency_key) {
      const dup = await pb.collection("review_requests").getFirstListItem<ReviewRequest>(pb.filter("idempotency_key = {:k}", { k: key }));
      redirect(`/reviews/${dup.id}`);
    }
    return { error: `리뷰 요청을 만들지 못했습니다. ${errorMessage(e)}` };
  }
  after(() => startRun(created));
  redirect(`/reviews/${created.id}`);
}

export async function retryReview(id: string) {
  const { pb } = await requireSession();
  const req = await pb.collection("review_requests").getOne<ReviewRequest>(id);
  if (req.status !== "failed" && req.status !== "canceled") return;
  const queued = await transition(await pbService(), id, ["failed", "canceled"], { status: "queued", error: "", started_at: "", finished_at: "" });
  if (queued) after(() => startRun(req));
  revalidatePath("/", "layout");
}

export async function cancelReview(id: string) {
  const { pb } = await requireSession();
  const req = await pb.collection("review_requests").getOne<ReviewRequest>(id);
  if (req.status !== "queued" && req.status !== "running") return;
  await transition(await pbService(), id, ["queued", "running"], { status: "canceled", finished_at: new Date().toISOString() });
  revalidatePath("/", "layout");
}

export async function setIssueStatus(issueId: string, to: IssueStatus): Promise<FormState> {
  const { pb, user } = await requireSession();
  if (!ISSUE_STATUSES.includes(to)) return { error: "알 수 없는 상태입니다." };
  try {
    const issue = await pb.collection("issues").getOne<Issue>(issueId);
    if (issue.status === to) return {};
    await pb.collection("issues").update(issueId, { status: to });
    await (await pbService()).collection("issue_events").create({ issue: issueId, request: issue.request, actor: user.id, kind: "status", from: issue.status, to });
    revalidatePath(`/reviews/${issue.request}`);
    return {};
  } catch (e) {
    return { error: `상태를 저장하지 못했습니다. ${errorMessage(e)}` };
  }
}

const MAX_COMMENT = 4000;
function checkBody(body: string): string | undefined {
  if (!body.trim()) return "빈 댓글은 저장할 수 없습니다.";
  if (body.length > MAX_COMMENT) return `댓글은 ${MAX_COMMENT.toLocaleString("ko-KR")}자까지입니다(지금 ${body.length.toLocaleString("ko-KR")}자).`;
  // 제어 문자는 저장하지 않는다(줄바꿈·탭 제외).
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(body)) return "지원하지 않는 제어 문자가 들어 있습니다. 해당 문자를 지우고 다시 저장하세요.";
}

export async function addComment(_: FormState, form: FormData): Promise<FormState> {
  const { pb, user } = await requireSession();
  const issueId = String(form.get("issue"));
  const body = String(form.get("body") ?? "");
  const key = String(form.get("submission_key") ?? "");
  const err = checkBody(body);
  if (err) return { error: err };
  if (!/^[\w-]{8,64}$/.test(key)) return { error: "댓글 폼이 오래되었습니다. 페이지를 새로 고친 뒤 다시 저장하세요." };
  let issue: Issue;
  try {
    issue = await pb.collection("issues").getOne<Issue>(issueId);
  } catch (e) {
    return { error: `댓글을 저장하지 못했습니다. ${errorMessage(e)}` };
  }
  const svc = await pbService();
  // 같은 제출 키의 댓글이 이미 있으면(앞선 요청의 응답이 유실된 경우) 성공으로 본다.
  const saved = () => svc.collection("comments").getList(1, 1, { filter: svc.filter("submission_key = {:k} && author = {:a}", { k: key, a: user.id }) }).then((r) => r.totalItems > 0);
  try {
    if (!(await saved())) {
      // 댓글과 이력은 한 트랜잭션으로 만든다. 하나라도 실패하면 둘 다 남지 않는다.
      const batch = svc.createBatch();
      batch.collection("comments").create({ issue: issueId, request: issue.request, author: user.id, body: maskSecrets(body.trim()), submission_key: key });
      batch.collection("issue_events").create({ issue: issueId, request: issue.request, actor: user.id, kind: "comment" });
      await batch.send();
    }
  } catch (e) {
    // 동시에 들어온 같은 제출이 먼저 저장돼 유니크 키에 걸렸다면 성공이다.
    if (!(await saved().catch(() => false))) return { error: `댓글을 저장하지 못했습니다. ${errorMessage(e)}` };
  }
  revalidatePath(`/reviews/${issue.request}`);
  return {};
}

export async function editComment(_: FormState, form: FormData): Promise<FormState> {
  const { pb, user } = await requireSession();
  const id = String(form.get("id"));
  const body = String(form.get("body") ?? "");
  const err = checkBody(body);
  if (err) return { error: err };
  try {
    const c = await pb.collection("comments").getOne<Comment>(id);
    if (c.author !== user.id) return { error: "자신의 댓글만 고칠 수 있습니다." };
    if (c.deleted) return { error: "삭제된 댓글은 고칠 수 없습니다." };
    const svc = await pbService();
    await svc.collection("comments").update(id, { body: maskSecrets(body.trim()), edited_at: new Date().toISOString() });
    await svc.collection("issue_events").create({ issue: c.issue, request: c.request, actor: user.id, kind: "comment_edit" });
    revalidatePath(`/reviews/${c.request}`);
    return {};
  } catch (e) {
    return { error: `댓글을 고치지 못했습니다. ${errorMessage(e)}` };
  }
}

export async function deleteComment(id: string): Promise<FormState> {
  const { pb, user } = await requireSession();
  try {
    const c = await pb.collection("comments").getOne<Comment>(id);
    if (c.author !== user.id) return { error: "자신의 댓글만 지울 수 있습니다." };
    if (c.deleted) return {}; // 이미 삭제됨: 중복 처리하지 않는다.
    const svc = await pbService();
    await svc.collection("comments").update(id, { deleted: true, body: "(삭제됨)", edited_at: new Date().toISOString() });
    await svc.collection("issue_events").create({ issue: c.issue, request: c.request, actor: user.id, kind: "comment_delete" });
    revalidatePath(`/reviews/${c.request}`);
    return {};
  } catch (e) {
    return { error: `댓글을 지우지 못했습니다. ${errorMessage(e)}` };
  }
}
