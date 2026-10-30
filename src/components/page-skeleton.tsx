// 최종 레이아웃 자리에 평평한 회색 막대. 시머 없이.
export function PageSkeleton() {
  return (
    <div aria-busy className="grid gap-4">
      <div className="h-[30px] w-64 rounded bg-active" />
      <div className="h-4 w-96 max-w-full rounded bg-active" />
      <div className="mt-4 h-[280px] rounded-[8px] border border-border bg-surface" />
    </div>
  );
}
