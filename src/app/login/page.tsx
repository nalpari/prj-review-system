import type { Metadata } from "next";
import { Suspense } from "react";
import { RouteMap } from "@/components/route-map";
import { Wordmark } from "@/components/wordmark";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "로그인" };

// 데모 노선: 로그인 전에 제품이 하는 일을 한 장면으로 보여준다(예시 데이터).
const demo = [
  ["a3f09c1", "환불 사유를 감사 로그에 남김", true],
  ["9b07d41", "지수 백오프 상한 8초", true],
  ["51c9e0f", "재시도 가능 오류 분류", true],
  ["c4f8e19", "reason 인자 추가", false],
].map(([sha, subject, selected]) => ({ sha: String(sha), subject: String(subject), selected: Boolean(selected), author: "", date: "" }));

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <main className="grid min-h-dvh grid-cols-1 lg:grid-cols-[minmax(420px,520px)_1fr]">
      <section className="flex flex-col bg-surface px-6 py-8 sm:px-12">
        <Wordmark />
        <div className="my-auto w-full max-w-[360px] py-12">
          <h1 className="text-[22px] font-bold leading-[30px] tracking-[-0.01em]">로그인</h1>
          <p className="mt-2 text-muted">팀 저장소의 리뷰 요청과 결과는 로그인한 구성원에게만 보입니다.</p>
          <Suspense>
            <LoginForm searchParams={searchParams} />
          </Suspense>
        </div>
        <p className="text-[12px] text-muted">계정은 팀 관리자가 만듭니다. 접근이 필요하면 관리자에게 요청하세요.</p>
      </section>

      <section aria-label="Redline이 보여주는 것" className="hidden flex-col justify-center gap-8 border-l border-border bg-ground px-12 lg:flex">
        <div className="max-w-[760px]">
          <p className="text-[20px] font-bold leading-7 tracking-[-0.01em]">무엇을 무엇과 비교했는지, 어디까지 실행됐는지.</p>
          <p className="mt-2 max-w-[56ch] text-muted">
            현재 브랜치와 타깃 브랜치의 diff, 리뷰 맥락에 넣은 커밋, Claude 또는 Codex 실행 상태를 한 노선도에서 읽습니다.
          </p>
        </div>
        <div className="max-w-[860px] rounded-[8px] border border-border bg-surface p-5">
          <RouteMap target="main" current="feature/refund-retry" color="#00A84D" commits={demo} mergeBase="4e1d9c0" status="completed" statusNote="2분 41초 · 이슈 8건" />
        </div>
        <p className="text-[12px] text-muted">예시 데이터입니다. AI 리뷰는 참고용이며 병합·배포 승인이 아닙니다.</p>
      </section>
    </main>
  );
}
