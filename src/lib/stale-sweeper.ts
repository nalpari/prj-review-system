import "server-only";
import { pbService } from "./pb-service";
import { failStaleRuns } from "./stale-runs";

const SWEEP_MS = 60_000;

// 서버 프로세스마다 한 번 시작한다(instrumentation.ts). 개발 서버의 재로딩으로 두 번 불려도 하나만 돈다.
const g = globalThis as { __redlineStaleSweeper?: NodeJS.Timeout };
export function startStaleRunSweeper() {
  if (g.__redlineStaleSweeper) return;
  let warned = false;
  const sweep = async () => {
    try {
      const n = await failStaleRuns(await pbService());
      if (n) console.info(`[redline] 멈춘 실행 ${n}건을 실패로 돌렸습니다.`);
      warned = false;
    } catch (e) {
      // PocketBase가 아직 안 떴을 때 매분 같은 경고를 쌓지 않는다.
      if (!warned) console.warn(`[redline] 멈춘 실행 정리를 건너뜁니다: ${(e as Error).message}`);
      warned = true;
    }
  };
  g.__redlineStaleSweeper = setInterval(sweep, SWEEP_MS);
  g.__redlineStaleSweeper.unref();
  setTimeout(sweep, 5_000).unref(); // 서버 준비를 막지 않도록 시작 직후가 아니라 조금 뒤에 처음 정리한다.
}
