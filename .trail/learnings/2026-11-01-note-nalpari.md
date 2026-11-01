---
title: "실행 중에 멈춘 리뷰는 하트비트로 판별해 앱 서버의 주기 작업이 실패로 돌린다(서버 시작 시 일괄 실패 처리는 하지 않음)"
author: Nalpari
date: 2026-11-01
branch: feat/remote-repo-mirror
cost: { minutes: 6, tokens: 51622 }
id: l-36ce7957
scope: repo
status: active
src: agent
touches:
  - src/lib/stale-runs.ts
  - src/instrumentation.ts
  - src/lib/git.ts
---

## Decided
- 실행기는 5초마다 PB 전이 훅(비교 후 쓰기)으로 heartbeat_at을 갱신한다. 같은 호출이 취소 감지도 겸한다: 409면 시도가 바뀐 것이라 CLI를 멈춘다.
- instrumentation.ts register()가 1분 주기 정리 작업을 띄운다(서버 준비를 막지 않게 첫 정리는 5초 뒤). 2분 넘게 하트비트가 없는 running, 2분 넘게 queued인 요청을 재시도 가능한 failed로 돌린다. 실패 전이도 run_id를 건 비교 후 쓰기라 살아 있는 시도를 덮어쓰지 않는다.
- 판별 로직(failStaleRuns)은 server-only 없는 src/lib/stale-runs.ts에 두고 `./run-state.ts`처럼 확장자를 붙여 import한다. scripts/rules.test.mjs가 node로 직접 불러 실제 PocketBase에서 검사한다. 타이머는 src/lib/stale-sweeper.ts.

## Tried and ruled out
- 서버 시작 시 running·queued를 모두 실패로 돌리기: 앱 서버를 여러 대 띄우면 다른 서버가 돌리는 실행까지 죽인다. 하트비트 기준이면 서버 수와 무관하다.

## Watch out
- 시드의 데모 요청(running·queued)도 앱 서버가 뜨면 2분 뒤 실패로 바뀐다. 의도된 동작이다.
- 정리 작업 검사는 기준 시각을 2000년으로 잡아 실제 데이터를 건드리지 않는다. queued 경로는 updated가 autodate라 과거로 둘 수 없어 쿼리 실행만 확인된다.
- register()는 서버 시작 때만 돈다. 실행 중인 next dev에는 재시작해야 적용된다.
- git.ts reposDir의 path.join(process.cwd(), …)은 Turbopack 빌드에서 "프로젝트 전체 추적" 경고를 낸다. /*turbopackIgnore: true*/로 막았다.

In the code: src/lib/stale-runs.ts, src/lib/stale-sweeper.ts, src/instrumentation.ts, runner.ts watchAttempt, pocketbase/pb_migrations/1761800600_run_heartbeat.js.
