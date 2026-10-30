import "server-only";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { maskSecrets } from "./mask";
import type { Commit, DiffStats } from "./types";

const run = promisify(execFile);
const MAX_DIFF = 4_000_000;

async function git(repoPath: string, args: string[]) {
  // 셸을 거치지 않고 인자 배열로 호출한다. 브랜치명은 아래에서 따로 검증한다.
  const { stdout } = await run("git", ["-C", repoPath, ...args], { maxBuffer: 64 * 1024 * 1024, timeout: 20_000 });
  return stdout;
}

export class GitError extends Error {
  constructor(message: string, public detail = "") {
    super(message);
  }
}

async function guard<T>(fn: () => Promise<T>, what: string): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    const msg = (e as { stderr?: string }).stderr?.trim() || (e as Error).message;
    throw new GitError(what, msg.split("\n")[0]);
  }
}

export async function listBranches(repoPath: string): Promise<string[]> {
  const out = await guard(() => git(repoPath, ["for-each-ref", "--format=%(refname:short)", "refs/heads"]), "브랜치 목록을 읽을 수 없습니다");
  return out.split("\n").filter(Boolean);
}

async function assertBranch(repoPath: string, name: string) {
  if (!/^[\w./-]+$/.test(name) || name.startsWith("-")) throw new GitError(`허용되지 않는 브랜치 이름입니다: ${name}`);
  await guard(() => git(repoPath, ["rev-parse", "--verify", "--quiet", `refs/heads/${name}`]), `브랜치를 찾을 수 없습니다(${name})`);
}

// 타깃 브랜치에 없는 현재 브랜치의 커밋. 최신순.
export async function listCommits(repoPath: string, target: string, current: string): Promise<Commit[]> {
  await assertBranch(repoPath, target);
  await assertBranch(repoPath, current);
  const out = await guard(
    () => git(repoPath, ["log", "--format=%H%x1f%s%x1f%an%x1f%aI", "-n", "200", `${target}..${current}`]),
    "커밋 목록을 읽을 수 없습니다",
  );
  return out
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [sha, subject, author, date] = line.split("\x1f");
      return { sha, subject: maskSecrets(subject), author, date, selected: true };
    });
}

export type Collected = { stats: DiffStats; diff: string; baseSha: string; headSha: string };

// 머지 베이스 기준 diff(target...current). 저장 전에 비밀정보를 가린다.
export async function collectDiff(repoPath: string, target: string, current: string): Promise<Collected> {
  await assertBranch(repoPath, target);
  await assertBranch(repoPath, current);
  const range = `${target}...${current}`;
  const [numstat, diff, base, head] = await Promise.all([
    guard(() => git(repoPath, ["diff", "--numstat", range]), "diff 통계를 만들 수 없습니다"),
    guard(() => git(repoPath, ["diff", "--no-color", "-U3", range]), "diff를 만들 수 없습니다"),
    guard(() => git(repoPath, ["merge-base", target, current]), "공통 조상을 찾을 수 없습니다"),
    guard(() => git(repoPath, ["rev-parse", current]), "현재 브랜치 커밋을 읽을 수 없습니다"),
  ]);
  const files = numstat
    .split("\n")
    .filter(Boolean)
    .map((l) => {
      const [a, d, path] = l.split("\t");
      return { path, additions: Number(a) || 0, deletions: Number(d) || 0 };
    });
  const stats: DiffStats = {
    files,
    additions: files.reduce((s, f) => s + f.additions, 0),
    deletions: files.reduce((s, f) => s + f.deletions, 0),
    mergeBase: base.trim(),
  };
  // 잘라 저장하면 전체를 비교한 것처럼 보이면서 뒷부분이 빠진다. 크면 거부하고 범위를 줄이게 한다.
  // 마스킹은 동기 처리라 원문 크기를 먼저 확인하고, 가린 뒤 길어졌을 수 있어 한 번 더 확인한다.
  const tooBig = (n: number) =>
    new GitError(`diff가 너무 큽니다(${n.toLocaleString("ko-KR")}자, 최대 ${MAX_DIFF.toLocaleString("ko-KR")}자). 브랜치를 나누거나 비교 범위를 줄여 다시 신청하세요`);
  if (diff.length > MAX_DIFF) throw tooBig(diff.length);
  const masked = maskSecrets(diff);
  if (masked.length > MAX_DIFF) throw tooBig(masked.length);
  return {
    stats,
    diff: masked,
    baseSha: base.trim(),
    headSha: head.trim(),
  };
}
