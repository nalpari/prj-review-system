"use server";

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { revalidatePath } from "next/cache";
import type PocketBase from "pocketbase";
import { errorMessage, requireAdmin, requireSession } from "@/lib/pb";
import { SEOUL_LINES } from "@/lib/lines";
import type { Membership, Retention, ReviewRequest } from "@/lib/types";

const run = promisify(execFile);
export type ActionState = { error?: string; ok?: string };

export async function addRepository(_: ActionState, form: FormData): Promise<ActionState> {
  const { pb } = await requireAdmin();
  const name = String(form.get("name") ?? "").trim();
  const localPath = String(form.get("local_path") ?? "").trim();
  const team = String(form.get("team") ?? "");
  const lineNo = Number(form.get("line_no"));
  const line = SEOUL_LINES[lineNo];
  if (!name || !localPath || !team) return { error: "팀, 이름, 로컬 경로를 모두 입력하세요." };
  if (!line) return { error: "노선을 고르세요." };
  if (!localPath.startsWith("/")) return { error: "로컬 경로는 서버의 절대 경로여야 합니다(예: /srv/git/payments-api)." };
  try {
    await run("git", ["-C", localPath, "rev-parse", "--git-dir"], { timeout: 5000 });
  } catch {
    return { error: `${localPath}에서 Git 저장소를 찾을 수 없습니다. 서버에서 경로와 읽기 권한을 확인하세요.` };
  }
  try {
    await pb.collection("repositories").create({
      team, name, local_path: localPath, default_branch: String(form.get("default_branch") ?? "main").trim() || "main",
      line_no: lineNo, line_color: line.color, retention: "retained",
    });
  } catch (e) {
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
