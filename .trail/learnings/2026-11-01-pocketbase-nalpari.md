---
title: "리뷰 이슈는 완료 전이와 같은 PocketBase 트랜잭션에서 한 번에 게시하고, 멈춘 실행 정리는 그 트랜잭션 안에서 하트비트를 다시 확인한다"
author: Nalpari
date: 2026-11-01
branch: feat/remote-repo-mirror
cost: { minutes: 4, tokens: 57396 }
id: l-20c98272
scope: repo
status: active
src: agent
touches:
  - pocketbase/pb_hooks/runs.pb.js
  - src/lib/run-state.ts
  - src/lib/runner.ts
  - src/lib/stale-runs.ts
  - scripts/rules.test.mjs
---

## Decided
- 실행기는 이슈를 직접 저장하지 않는다. 완료 결과와 함께 이슈 배열을 전이 훅에 넘기고, 훅이 한 트랜잭션에서 상태·run_id 확인 → 기존 이슈 삭제 → 새 이슈 생성 → completed 전이를 한다. 하나라도 실패하면 전부 롤백되고 요청은 running으로 남아 정리 작업이 실패로 돌린다.
- 멈춘 실행 정리(failStaleRuns)는 staleBefore를 넘기고, 훅이 트랜잭션 안에서 heartbeat_at(없으면 started_at, 대기면 updated)이 그보다 이전인지 다시 확인한다. 목록을 읽은 뒤 하트비트가 갱신된 실행은 건드리지 않는다.

## Tried and ruled out
- 이슈에 run_id 필드를 추가하고 조회를 완료된 시도로 거르기(Codex 리뷰 제안): 한 트랜잭션 게시면 실패·밀려난 시도의 이슈가 애초에 생기지 않아 스키마 변경과 조회 필터가 필요 없다.
- 50개씩 배치로 저장한 뒤 superseded일 때만 지우기(이전 방식): 배치 일부 성공 후 실패하거나 저장 중 프로세스가 죽으면 이슈가 남고, 재시도 결과에 섞였다.

## Watch out
- Windows의 PocketBase는 pb_hooks 변경을 자동으로 다시 불러오지 않는다. 훅을 바꾸면 PocketBase를 재시작해야 반영된다(재시작 전에는 rules 테스트가 옛 훅으로 돈다).
- Node 22.17에서는 `pnpm test`, `pnpm test:rules`에 `--experimental-strip-types`가 없으면 .ts import가 ERR_UNKNOWN_FILE_EXTENSION으로 실패한다.
- 완료 시 이 요청의 기존 이슈를 모두 지운다. 재시도는 failed·canceled에서만 되므로 사용자가 다루던 완료 리뷰의 이슈·댓글은 지워지지 않는다.

In the code: pocketbase/pb_hooks/runs.pb.js (staleBefore, issues), src/lib/run-state.ts transition opts·runAttempt, src/lib/runner.ts startRun, src/lib/stale-runs.ts, scripts/rules.test.mjs.
