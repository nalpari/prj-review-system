---
title: "실행 상태 전이는 PB 훅 /api/redline/runs/{id}/transition의 트랜잭션 비교 후 쓰기로 원자화, 프로세스 내 inFlight 잠금은 제거"
author: Nalpari
date: 2026-10-30
branch: main
cost: { minutes: 2, tokens: 40811 }
id: l-6a45724a
scope: repo
status: active
---

## Decided
- pocketbase/pb_hooks/runs.pb.js가 슈퍼유저 전용 라우트에서 runInTransaction으로 status(·run_id) 비교와 쓰기를 한 번에 한다. src/lib/run-state.ts transition()이 이를 부르고(409면 false), runAttempt의 점유·결과 쓰기, actions.ts의 cancelReview·retryReview가 모두 이 경로를 쓴다.
- src/lib/runner.ts의 inFlight 잠금을 없앴다. queued→running 점유가 원자적이라 중복 실행이 없고, 취소된 시도가 아직 돌고 있어도 재시도가 바로 새 시도로 시작한다(이전 시도는 run_id가 달라 결과를 못 쓴다).
- 이로써 이전 learning의 "읽기와 쓰기 사이 경합 창" watch out은 해소됐다.

## Tried and ruled out
- inFlight에 재시도 대기 플래그를 달아 락이 풀린 뒤 다시 돌리는 방법: 서버가 한 대일 때만 맞고 코드가 늘어서 버렸다.
- 원시 SQL 조건부 UPDATE: 레코드 이벤트·검증을 건너뛰어서 트랜잭션 안 findRecordById+save를 택했다.

## Watch out
- pb_hooks 디렉터리가 없을 때 띄운 PocketBase는 새로 생긴 훅을 로드하지 않는다. 훅을 추가한 뒤에는 pb:serve를 재시작해야 한다(안 하면 transition이 404).
- 마스킹(src/lib/mask.ts)은 접속 URL의 비밀번호와, diff에서 다음 줄(+·-·공백 접두사 뒤)로 넘어간 할당 값도 가린다.
