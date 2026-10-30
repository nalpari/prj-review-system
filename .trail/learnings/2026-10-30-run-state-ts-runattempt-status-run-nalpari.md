---
title: "실행 상태 전이는 run-state.ts runAttempt로만: 저장된 status·run_id를 다시 읽고 자기 시도일 때만 쓴다"
author: Nalpari
date: 2026-10-30
branch: main
cost: { minutes: 2, tokens: 24516 }
id: l-7b98889f
scope: repo
status: active
touches:
  - pocketbase/pb_migrations/1761800300_retention_and_runs.js
  - src/lib/run-state.ts
  - src/lib/runner.ts
---

## Decided
- src/lib/run-state.ts runAttempt가 대기→실행 중→결과 전이를 맡는다. 시작 전 저장된 status가 queued인지, 결과를 쓰기 전 status=running이고 run_id가 자기 것인지 다시 읽는다. 아니면 쓰지 않는다(취소·재시도 보존).
- 숨긴 저장소: 마이그레이션 1761800300에서 구성원 조회를 retention='retained'로 제한했다. 관리자는 조회되므로 Git 엔드포인트(src/app/api/repos/[id]/git/route.ts)와 createReview가 retention을 다시 확인한다.
- 4,000,000자를 넘는 diff는 잘라 저장하지 않고 GitError로 거부한다(src/lib/git.ts).

## Watch out
- PocketBase에 조건부 update가 없어서, runAttempt의 읽기와 쓰기 사이에 짧은 경합 창이 남는다. 서버를 여러 대로 늘리면 PB 훅에서 비교 후 쓰기로 옮긴다.
- 마스킹은 `const token = getToken()` 같은 코드 값도 가린다(저장 전 마스킹의 대가).
- 회귀 검사: npm test(마스킹), npm run test:rules(규칙·실행 전이, PocketBase 실행 중이어야 함).
