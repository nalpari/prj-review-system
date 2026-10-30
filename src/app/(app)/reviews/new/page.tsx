import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { InlineError, PageTitle } from "@/components/ui";
import { PageSkeleton } from "@/components/page-skeleton";
import { errorMessage, requireSession } from "@/lib/pb";
import type { Repository } from "@/lib/types";
import { NewReviewForm } from "./new-review-form";

export const metadata: Metadata = { title: "새 리뷰 요청" };

export default function NewReviewPage(props: PageProps<"/reviews/new">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <NewReviewPageContent {...props} />
    </Suspense>
  );
}

async function NewReviewPageContent({ searchParams }: PageProps<"/reviews/new">) {
  const sp = await searchParams;
  const { pb } = await requireSession();
  let repos: Repository[];
  try {
    repos = await pb.collection("repositories").getFullList<Repository>({ filter: "retention = 'retained'", sort: "line_no" });
  } catch (e) {
    return <InlineError>저장소 목록을 불러오지 못했습니다. {errorMessage(e)}</InlineError>;
  }
  return (
    <>
      <PageTitle title="새 리뷰 요청" sub="현재 브랜치를 타깃 브랜치와 비교한 diff와, 고른 커밋을 맥락으로 리뷰합니다." />
      {repos.length === 0 ? (
        <p className="text-muted">
          리뷰할 수 있는 저장소가 없습니다. <Link href="/repositories" className="font-semibold text-ink underline">저장소</Link>에서 등록하거나 관리자에게 접근을 요청하세요.
        </p>
      ) : (
        <NewReviewForm repos={repos} initialRepo={typeof sp.repo === "string" ? sp.repo : undefined} />
      )}
    </>
  );
}
