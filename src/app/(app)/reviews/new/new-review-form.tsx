"use client";

import { useActionState, useEffect, useState } from "react";
import { RouteMap } from "@/components/route-map";
import { InlineError, LineBadge, btn, cx, field, label } from "@/components/ui";
import type { Commit, Model, Repository } from "@/lib/types";
import { createReview, type FormState } from "../actions";

type Load<T> = { state: "idle" | "loading" | "error" | "ready"; data?: T; error?: string; detail?: string };
type Res<T> = { key: string; data?: T; error?: string; detail?: string };
class LoadError extends Error {
  constructor(message: string, public detail?: string) {
    super(message);
  }
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new LoadError(body.error ?? `요청 실패(${res.status})`, body.detail);
  return body as T;
}

// 응답을 요청 키와 함께 저장하고, 키가 다르면 '불러오는 중'으로 본다.
function load<T>(key: string | null, res: Res<T> | undefined): Load<T> {
  if (!key) return { state: "idle" };
  if (!res || res.key !== key) return { state: "loading" };
  return res.error ? { state: "error", error: res.error, detail: res.detail } : { state: "ready", data: res.data };
}

export function NewReviewForm({ repos, initialRepo }: { repos: Repository[]; initialRepo?: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(createReview, {});
  const [key] = useState(() => crypto.randomUUID());
  const [repoId, setRepoId] = useState(initialRepo && repos.some((r) => r.id === initialRepo) ? initialRepo : repos[0].id);
  const [branchRes, setBranchRes] = useState<Res<{ branches: string[]; defaultBranch: string }>>();
  const [current, setCurrent] = useState("");
  const [target, setTarget] = useState("");
  const [commitRes, setCommitRes] = useState<Res<Commit[]>>();
  const [model, setModel] = useState<Model | "">("");
  const [ctxLen, setCtxLen] = useState(0);
  const repo = repos.find((r) => r.id === repoId)!;
  const fe = state.fieldErrors ?? {};
  const same = Boolean(current) && current === target;
  const commitKey = current && target && !same ? `${repoId}|${target}|${current}` : null;
  const branches = load(repoId, branchRes);
  const commits = load(commitKey, commitRes);

  useEffect(() => {
    let live = true;
    getJson<{ branches: string[]; defaultBranch: string }>(`/api/repos/${repoId}/git`)
      .then((d) => {
        if (!live) return;
        setBranchRes({ key: repoId, data: d });
        setTarget(d.branches.includes(d.defaultBranch) ? d.defaultBranch : d.branches[0] ?? "");
      })
      .catch((e: LoadError) => live && setBranchRes({ key: repoId, error: e.message, detail: e.detail }));
    return () => {
      live = false;
    };
  }, [repoId]);

  useEffect(() => {
    if (!commitKey) return;
    let live = true;
    getJson<{ commits: Commit[] }>(`/api/repos/${repoId}/git?${new URLSearchParams({ target, current })}`)
      .then((d) => live && setCommitRes({ key: commitKey, data: d.commits }))
      .catch((e: LoadError) => live && setCommitRes({ key: commitKey, error: e.message, detail: e.detail }));
    return () => {
      live = false;
    };
  }, [commitKey, repoId, current, target]);

  const pickRepo = (id: string) => {
    setRepoId(id);
    setCurrent("");
  };
  const toggle = (sha: string) =>
    setCommitRes((c) => c && { ...c, data: c.data?.map((x) => (x.sha === sha ? { ...x, selected: !x.selected } : x)) });

  const list = commits.data ?? [];
  const chosen = list.filter((c) => c.selected).length;
  const noCommits = commits.state === "ready" && list.length === 0;
  const canSubmit = !pending && !same && commits.state === "ready" && list.length > 0 && chosen > 0 && Boolean(model);

  return (
    <form action={action} className="grid max-w-[1040px] gap-8" noValidate>
      <input type="hidden" name="idempotency_key" value={key} />
      <input type="hidden" name="repository" value={repoId} />
      {list.filter((c) => c.selected).map((c) => <input key={c.sha} type="hidden" name="commit" value={c.sha} />)}

      <fieldset>
        <legend className={label}>저장소</legend>
        <div className="flex flex-wrap gap-2">
          {repos.map((r) => (
            <button
              key={r.id}
              type="button"
              aria-pressed={r.id === repoId}
              onClick={() => pickRepo(r.id)}
              className={cx(
                "inline-flex h-9 items-center gap-2 rounded-full border pl-1.5 pr-3.5 text-[14px]",
                r.id === repoId ? "border-ink bg-surface font-semibold" : "border-control bg-surface text-ink hover:bg-raised",
              )}
            >
              <LineBadge repo={r} size={24} />
              {r.name}
            </button>
          ))}
        </div>
        {fe.repository && <p className="mt-1.5 text-[13px] text-negative">{fe.repository}</p>}
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="current_branch" className={label}>현재 브랜치</label>
          <select id="current_branch" name="current_branch" value={current} onChange={(e) => setCurrent(e.target.value)} disabled={branches.state !== "ready"} className={field}>
            <option value="">{branches.state === "loading" ? "브랜치를 읽는 중…" : "리뷰할 브랜치 고르기"}</option>
            {branches.data?.branches.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
          {fe.current_branch && <p className="mt-1.5 text-[13px] text-negative">{fe.current_branch}</p>}
        </div>
        <div>
          <label htmlFor="target_branch" className={label}>타깃 브랜치</label>
          <select id="target_branch" name="target_branch" value={target} onChange={(e) => setTarget(e.target.value)} disabled={branches.state !== "ready"} aria-invalid={same} className={field}>
            {branches.data?.branches.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
          {(same || fe.target_branch) && <p className="mt-1.5 text-[13px] text-negative">{fe.target_branch ?? "현재 브랜치와 같습니다. 비교할 다른 브랜치를 고르세요."}</p>}
        </div>
        {branches.state === "error" && (
          <div className="sm:col-span-2"><InlineError>{branches.error}<GitDetail detail={branches.detail} /></InlineError></div>
        )}
      </div>

      <section aria-labelledby="commits-h">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="commits-h" className="text-[13px] font-semibold">리뷰 맥락에 넣을 커밋</h2>
          {commits.state === "ready" && list.length > 0 && (
            <span className="num text-[13px] text-muted">{list.length}개 중 {chosen}개 · 역을 눌러 넣거나 빼기</span>
          )}
        </div>
        <div className="rounded-[8px] border border-border bg-surface px-4 pb-2 pt-1">
          {commits.state === "idle" && <p className="py-6 text-[13px] text-muted">두 브랜치를 고르면 {target || "타깃"}에 없는 커밋이 노선으로 나타납니다.</p>}
          {commits.state === "loading" && <div aria-busy className="my-4 h-[124px] rounded bg-active" />}
          {commits.state === "error" && <div className="py-4"><InlineError>{commits.error}<GitDetail detail={commits.detail} /></InlineError></div>}
          {noCommits && <p className="py-6 text-[13px]">{current}에는 {target}에 없는 커밋이 없습니다. 리뷰할 변경을 커밋한 뒤 다시 고르세요.</p>}
          {commits.state === "ready" && list.length > 0 && (
            <RouteMap target={target} current={current} color={repo.line_color} commits={list} onToggle={toggle} />
          )}
        </div>
        {commits.state === "ready" && list.length > 0 && chosen === 0 && <p className="mt-1.5 text-[13px] text-negative">커밋을 하나 이상 넣으세요. diff 자체는 선택과 관계없이 전체가 들어갑니다.</p>}
      </section>

      <div>
        <label htmlFor="context" className={label}>리뷰 맥락 <span className="font-normal text-muted">(선택)</span></label>
        <textarea
          id="context"
          name="context"
          rows={4}
          maxLength={4000}
          onChange={(e) => setCtxLen(e.target.value.length)}
          placeholder="이 변경의 목적, 특히 봐야 할 위험, 무시해도 되는 부분"
          className="w-full rounded-[6px] border border-control bg-surface px-3 py-2 text-[14px] placeholder:text-faint focus:border-ink focus:outline-none"
        />
        <p className={cx("num mt-1 text-right text-[12px]", fe.context ? "text-negative" : "text-muted")}>{fe.context ?? `${ctxLen.toLocaleString("ko-KR")} / 4,000`}</p>
      </div>

      <fieldset>
        <legend className={label}>실행할 모델</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {([["claude", "Claude", "이 서버의 Claude 로컬 구독 환경에서 실행"], ["codex", "Codex", "이 서버의 Codex 로컬 구독 환경에서 실행"]] as const).map(([v, name, desc]) => (
            <label key={v} className={cx("flex cursor-pointer items-start gap-3 rounded-[8px] border bg-surface px-4 py-3", model === v ? "border-ink" : "border-control hover:bg-raised")}>
              <input type="radio" name="model" value={v} checked={model === v} onChange={() => setModel(v)} className="mt-1 accent-[#15171a]" />
              <span>
                <span className="block font-semibold">{name}</span>
                <span className="block text-[13px] text-muted">{desc}</span>
              </span>
            </label>
          ))}
        </div>
        {fe.model && <p className="mt-1.5 text-[13px] text-negative">{fe.model}</p>}
      </fieldset>

      {state.error && <InlineError>{state.error}</InlineError>}

      <div className="flex flex-wrap items-center gap-3 border-t border-border pt-5">
        <button type="submit" disabled={!canSubmit} className={btn("primary", "h-10 px-5 text-[14px]")}>
          {pending ? "요청을 만드는 중…" : "리뷰 요청"}
        </button>
        <span className="text-[13px] text-muted">
          {!model ? "모델을 고르면 요청할 수 있습니다." : same ? "두 브랜치가 달라야 합니다." : "요청하면 대기 상태로 저장되고 바로 실행을 시도합니다."}
        </span>
      </div>
    </form>
  );
}

function GitDetail({ detail }: { detail?: string }) {
  if (!detail) return null;
  return (
    <details className="mt-1">
      <summary className="cursor-pointer text-[12px]">git 메시지 보기</summary>
      <code className="mt-1 block break-all font-mono text-[12px]">{detail}</code>
    </details>
  );
}
