"use server";

import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import type PocketBase from "pocketbase";
import { checkRemoteUrl, cloneRemote, GitError, reposDir } from "@/lib/git";
import { errorMessage, requireAdmin, requireSession } from "@/lib/pb";
import { SEOUL_LINES } from "@/lib/lines";
import type { Membership, Retention, ReviewRequest } from "@/lib/types";

export type ActionState = { error?: string; ok?: string };

export async function addRepository(_: ActionState, form: FormData): Promise<ActionState> {
  const { pb } = await requireAdmin();
  const name = String(form.get("name") ?? "").trim();
  const remoteUrl = String(form.get("remote_url") ?? "").trim();
  const team = String(form.get("team") ?? "");
  const lineNo = Number(form.get("line_no"));
  const line = SEOUL_LINES[lineNo];
  if (!name || !remoteUrl || !team) return { error: "팀, 이름, 원격 URL을 모두 입력하세요." };
  if (!line) return { error: "노선을 고르세요." };
  const urlError = checkRemoteUrl(remoteUrl);
  if (urlError) return { error: urlError };

  // 서버에 새로 클론한다. 디렉터리 이름이 겹치지 않게 임의 접미사를 붙인다.
  const slug = name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^[-.]+/, "").slice(0, 60) || "repo";
  const localPath = path.join(reposDir(), `${slug}-${randomUUID().slice(0, 8)}.git`);
  try {
    await cloneRemote(remoteUrl, localPath);
  } catch (e) {
    await fs.rm(localPath, { recursive: true, force: true });
    const detail = e instanceof GitError && e.detail ? ` (git: ${e.detail})` : "";
    return { error: `${remoteUrl}을(를) 클론하지 못했습니다. URL과 서버의 git 접근 권한(SSH 키, credential helper)을 확인하세요.${detail}` };
  }
  try {
    await pb.collection("repositories").create({
      team, name, remote_url: remoteUrl, local_path: localPath, default_branch: String(form.get("default_branch") ?? "main").trim() || "main",
      line_no: lineNo, line_color: line.color, retention: "retained",
    });
  } catch (e) {
    await fs.rm(localPath, { recursive: true, force: true });
    return { error: `저장소를 등록하지 못했습니다. ${errorMessage(e)}` };
  }
  revalidatePath("/", "layout");
  return { ok: `${name} 저장소를 등록했습니다.` };
}

export async function createTeam(_: ActionState, form: FormData): Promise<ActionState> {
  const { pb } = await requireAdmin();
  const name = String(form.get("name") ?? "").trim();
  if (!name) return { error: "팀 이름을 입력하세요." };
  try {
    await pb.collection("teams").create({ name });
  } catch (e) {
    return { error: `팀을 만들지 못했습니다. ${errorMessage(e)}` };
  }
  revalidatePath("/", "layout");
  return { ok: `${name} 팀을 만들었습니다. 이제 구성원과 저장소를 연결하세요.` };
}

export async function addMember(_: ActionState, form: FormData): Promise<ActionState> {
  const { pb } = await requireAdmin();
  try {
    await pb.collection("memberships").create({ team: form.get("team"), user: form.get("user"), role: form.get("role") });
  } catch (e) {
    return { error: `구성원을 추가하지 못했습니다. 이미 팀에 있는지 확인하세요. ${errorMessage(e)}` };
  }
  revalidatePath("/team");
  return { ok: "구성원을 추가했습니다." };
}

export async function createUser(_: ActionState, form: FormData): Promise<ActionState> {
  const { pb } = await requireAdmin();
  const password = String(form.get("password") ?? "");
  if (password.length < 10) return { error: "비밀번호는 10자 이상이어야 합니다." };
  try {
    await pb.collection("users").create({
      name: String(form.get("name") ?? "").trim(), email: String(form.get("email") ?? "").trim(),
      role: form.get("role") === "admin" ? "admin" : "member", password, passwordConfirm: password,
    });
  } catch (e) {
    return { error: `계정을 만들지 못했습니다. ${errorMessage(e)}` };
  }
  revalidatePath("/team");
  return { ok: "계정을 만들었습니다. 이제 팀에 추가하세요." };
}

export async function updateMemberRole(id: string, role: Membership["role"]) {
  const { pb } = await requireAdmin();
  await pb.collection("memberships").update(id, { role });
  revalidatePath("/team");
}

export async function removeMember(id: string) {
  const { pb } = await requireAdmin();
  await pb.collection("memberships").delete(id);
  revalidatePath("/team");
}

// 요청을 접근 불가로 돌리거나 영구 삭제한다. 연결된 이슈·댓글·이력은 같은 정책을 따른다(삭제 시 연쇄 삭제).
export async function setRequestRetention(id: string, to: Retention): Promise<ActionState> {
  const { pb } = await requireSession();
  try {
    if (to === "deleted") {
      await pb.collection("review_requests").delete(id);
    } else {
      await pb.collection("review_requests").update(id, { retention: to, retention_changed_at: new Date().toISOString() });
    }
  } catch (e) {
    return { error: `처리하지 못했습니다. 연결 데이터는 그대로입니다. ${errorMessage(e)}` };
  }
  revalidatePath("/", "layout");
  return { ok: to === "deleted" ? "요청과 연결된 diff·결과·댓글·이력을 삭제했습니다." : to === "hidden" ? "접근 불가로 전환했습니다." : "다시 보존 중으로 돌렸습니다." };
}

// 저장소 단위 전환: 저장소와 그 요청 전체를 같은 정책으로 처리한다.
export async function setRepositoryRetention(id: string, to: Retention): Promise<ActionState> {
  const { pb } = await requireAdmin();
  try {
    if (to === "deleted") {
      await pb.collection("repositories").delete(id); // cascadeDelete로 요청·이슈·댓글·이력까지
    } else {
      await pb.collection("repositories").update(id, { retention: to });
      await updateAll(pb, id, to);
    }
  } catch (e) {
    return { error: `저장소 데이터를 처리하지 못했습니다. 일부만 바뀌었을 수 있으니 다시 시도하세요. ${errorMessage(e)}` };
  }
  revalidatePath("/", "layout");
  return { ok: "저장소 데이터 상태를 바꿨습니다." };
}

async function updateAll(pb: PocketBase, repoId: string, to: Retention) {
  const reqs = await pb.collection("review_requests").getFullList<ReviewRequest>({ filter: pb.filter("repository = {:id}", { id: repoId }), fields: "id" });
  const at = new Date().toISOString();
  for (const r of reqs) await pb.collection("review_requests").update(r.id, { retention: to, retention_changed_at: at });
}
