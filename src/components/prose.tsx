import { splitCode, toParagraphs } from "@/lib/prose";
import { cx } from "./ui";

// 모델이 쓴 글(요약·이슈 설명)을 문단으로 나누고 `코드`는 등폭 칩으로 보여 준다.
export function Prose({ text, className }: { text: string; className?: string }) {
  return (
    <div className={cx("grid max-w-[72ch] gap-3 break-words", className)}>
      {toParagraphs(text).map((p, i) => (
        <p key={i}>
          {splitCode(p).map((s, j) =>
            s.code ? (
              <code key={j} className="rounded-[4px] bg-raised px-1 py-px font-mono text-[0.85em]">{s.text}</code>
            ) : (
              s.text
            ),
          )}
        </p>
      ))}
    </div>
  );
}
