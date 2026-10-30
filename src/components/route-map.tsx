"use client";

import { useEffect, useRef } from "react";
import { RUN_LABEL } from "@/lib/labels";
import type { Commit, RunStatus } from "@/lib/types";
import { cx } from "./ui";

// 시그니처: 타깃 브랜치는 본선, 현재 브랜치는 환승역에서 갈라진 지선, 커밋은 역.
// 왼쪽이 오래된 커밋. 채운 역은 리뷰 맥락에 포함된 커밋. 실행 상태는 지선 위 열차의 위치.
type Props = {
  target: string;
  current: string;
  color: string;
  commits: Commit[]; // 최신순으로 받는다(git log 순서)
  mergeBase?: string;
  status?: RunStatus;
  statusNote?: string;
  onToggle?: (sha: string) => void;
  legend?: boolean;
  className?: string;
};

const MAIN_Y = 118;
const BRANCH_Y = 46;
const L = "var(--rl-labels)";

const TRAIN: Record<RunStatus, string> = {
  queued: "#15171a",
  running: "#15171a",
  completed: "#15171a",
  failed: "#c4242a",
  canceled: "#686d66",
};

export function RouteMap({ target, current, color, commits, mergeBase, status, statusNote, onToggle, legend, className }: Props) {
  const stations = [...commits].reverse();
  const n = Math.max(stations.length, 3);
  const running = status === "running";
  const scroller = useRef<HTMLDivElement>(null);
  // 화면보다 노선이 길면 최신 역과 열차가 보이도록 오른쪽 끝에서 시작한다.
  useEffect(() => {
    const el = scroller.current;
    if (el && el.scrollWidth > el.clientWidth) el.scrollLeft = el.scrollWidth;
  }, [commits.length]);

  return (
    <div className={cx("rl-route", className)} style={{ ["--line" as string]: color }}>
      {legend && (
        <p className="flex flex-wrap items-center gap-x-4 gap-y-1 pb-1 pt-3 text-[12px] text-muted">
          <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full" style={{ background: color }} />맥락 포함</span>
          <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full border-2 bg-surface" style={{ borderColor: color }} />맥락 제외</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-4 rounded-full border-2 border-ink bg-surface" />공통 조상(환승역)</span>
        </p>
      )}
      <div className="relative">
      {/* 좁은 화면: 노선이 오른쪽 끝부터 보이므로 왼쪽에 노선 표지를 고정해 두 노선 관계를 남긴다. */}
      <div aria-hidden className="pointer-events-none absolute inset-y-0 left-0 z-10 w-[76px] border-r border-rule bg-surface sm:hidden">
        <span className="absolute left-0 flex w-full items-center gap-1.5 pr-1" style={{ top: BRANCH_Y - 8 }}>
          <span className="h-1 w-3 flex-none rounded-full" style={{ background: color }} />
          <span className="truncate font-mono text-[12px] font-semibold">{current.split("/").pop()}</span>
        </span>
        <span className="absolute left-0 flex w-full items-center gap-1.5 pr-1" style={{ top: MAIN_Y - 8 }}>
          <span className="h-1 w-3 flex-none rounded-full bg-ink" />
          <span className="truncate font-mono text-[12px] font-semibold">{target}</span>
        </span>
      </div>
      <div ref={scroller} className="overflow-x-auto">
        <div className="relative h-[164px]" style={{ minWidth: `calc(${L} + 72px + ${n} * var(--rl-station) + 140px)` }}>
          {/* 노선 이름표 */}
          <div className="absolute left-0 flex items-center gap-2" style={{ top: BRANCH_Y - 12, width: `calc(${L} - 16px)` }}>
            <span className="h-1 w-4 flex-none rounded-full" style={{ background: color }} />
            <span className="truncate font-mono text-[12px] font-semibold" title={current}>{current}</span>
          </div>
          <div className="absolute left-0 flex items-center gap-2" style={{ top: MAIN_Y - 12, width: `calc(${L} - 16px)` }}>
            <span className="h-1 w-4 flex-none rounded-full bg-ink" />
            <span className="truncate font-mono text-[12px] font-semibold" title={target}>{target}</span>
          </div>

          {/* 본선 */}
          <div className="absolute right-6 h-1 rounded-full bg-ink" style={{ left: L, top: MAIN_Y - 2 }} />
          <svg className="absolute right-0" width="24" height="12" style={{ top: MAIN_Y - 6 }} aria-hidden>
            <path d="M2 1 L12 6 L2 11" fill="none" stroke="#15171a" strokeWidth="2.5" strokeLinejoin="round" />
          </svg>

          {/* 분기 곡선 */}
          <svg className="absolute" style={{ left: `calc(${L} + 12px)`, top: BRANCH_Y - 2 }} width="56" height={MAIN_Y - BRANCH_Y + 4} aria-hidden>
            <path d={`M8 ${MAIN_Y - BRANCH_Y + 2} C 8 30, 24 2, 56 2`} fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" />
          </svg>
          {/* 환승역: 서울 노선도의 흰 캡슐 표기 */}
          <div
            className="absolute h-[18px] w-7 rounded-full border-[3px] border-ink bg-surface"
            style={{ left: `calc(${L} + 6px)`, top: MAIN_Y - 9 }}
            title={mergeBase ? `공통 조상 ${mergeBase.slice(0, 7)}` : "공통 조상"}
          />
          {mergeBase && (
            <span className="absolute font-mono text-[12px] text-muted" style={{ left: L, top: MAIN_Y + 14 }}>{mergeBase.slice(0, 7)}</span>
          )}

          {/* 지선 */}
          <div className="absolute h-1 rounded-full" style={{ left: `calc(${L} + 66px)`, right: 120, top: BRANCH_Y - 2, background: color }} />

          {/* 역 */}
          <ol className="absolute flex" style={{ left: `calc(${L} + 72px)`, right: 128, top: 0 }} aria-label={`${current} 커밋`}>
            {stations.map((c) => {
              const Tag = onToggle ? "button" : "div";
              return (
                <li key={c.sha} className="flex min-w-0 flex-1 justify-center" style={{ minWidth: "var(--rl-station)" }}>
                  <Tag
                    {...(onToggle ? { type: "button" as const, onClick: () => onToggle(c.sha), "aria-pressed": c.selected } : {})}
                    className={cx("group flex w-full min-w-0 flex-col items-center px-1", onToggle && "cursor-pointer rounded-[6px] hover:bg-raised")}
                    title={`${c.sha.slice(0, 7)} ${c.subject} · ${c.author}${c.selected ? " · 맥락 포함" : " · 맥락 제외"}`}
                  >
                    <span className="mt-[14px] font-mono text-[12px] leading-[14px] text-muted">{c.sha.slice(0, 7)}</span>
                    <span
                      className={cx("mt-[7px] size-4 rounded-full border-[3px] transition-transform duration-150", onToggle && "group-hover:scale-125")}
                      style={{ borderColor: color, background: c.selected ? color : "#fff" }}
                    />
                    <span className="mt-2 line-clamp-2 w-full text-center text-[12px] leading-4 text-ink max-sm:hidden">{c.subject}</span>
                  </Tag>
                </li>
              );
            })}
          </ol>

          {/* 열차: 대기는 환승역, 실행 중은 지선 위를 달리고, 끝나면 종점(최신 역 뒤)에 선다. */}
          {status && (
            <div
              className="pointer-events-none absolute"
              style={
                status === "queued"
                  ? { left: `calc(${L} + 58px)`, top: BRANCH_Y - 11 }
                  : running
                    ? { left: `calc(${L} + 66px)`, right: 120, top: BRANCH_Y - 11 }
                    : { right: 24, top: BRANCH_Y - 11 }
              }
            >
              <div className={cx("flex flex-col items-start", running && "rl-train-running absolute")}>
                <span
                  className="num inline-flex h-[22px] items-center whitespace-nowrap rounded-[6px] px-2 text-[12px] font-bold text-white"
                  style={{ background: TRAIN[status] }}
                >
                  {RUN_LABEL[status]}
                </span>
                {statusNote && <span className="num mt-1 whitespace-nowrap text-[12px] text-muted">{statusNote}</span>}
              </div>
            </div>
          )}
        </div>
      </div>
      </div>
      {stations.length > 2 && <p className="pt-1 text-[12px] text-muted sm:hidden">← 밀어서 이전 커밋 보기 · 역 {stations.length}개</p>}
    </div>
  );
}
