---
title: "리뷰 결과·실행 상태·댓글·이력 쓰기는 서버 서비스 클라이언트(pbService)로만, 사용자 토큰 쓰기는 규칙으로 막음"
author: Nalpari
date: 2026-10-30
branch: main
cost: { minutes: 4, tokens: 47160 }
id: l-6a63db09
scope: repo
status: active
touches:
  - pocketbase/pb_migrations/1761800200_harden_rules.js
  - src/lib/pb-service.ts
  - scripts/rules.test.mjs
---

## Decided
- pocketbase/pb_migrations/1761800200_harden_rules.js: review_requests 생성, comments·issue_events 쓰기를 사용자 토큰에서 막았다(createRule/updateRule null). issues는 status만, review_requests는 보존 권한자의 retention 변경만 허용한다.
- 서버 액션(src/app/(app)/reviews/actions.ts)이 먼저 사용자 토큰으로 읽어 권한을 확인하고, 자유 텍스트를 maskSecrets로 가린 뒤 src/lib/pb-service.ts(슈퍼유저)로 쓴다. 그래야 직접 API 호출로 마스킹을 우회하거나 결과를 꾸미지 못한다.
- users: role은 관리자만 바꾼다(`@request.body.role:isset = false`). 계정 생성은 role=admin 사용자에게 허용한다.
- 이슈·댓글·이력 규칙은 request.repository.retention도 확인한다. 저장소 숨김 뒤 요청 갱신이 중간에 실패해도 하위 데이터가 보이지 않는다.

## Tried and ruled out
- 쓰기 규칙에 필드 isset 조건만 덧붙이는 방식: 자유 텍스트 마스킹을 PocketBase 쪽에서 강제할 수 없어 버렸다.

## Watch out
- 슈퍼유저가 아니면 users 생성 때 `verified`를 넣을 수 없다("Values don't match"). createUser에서 뺐다.
- 시스템 관리자도 팀 멤버가 아니면 그 팀 요청의 이슈·댓글은 안 보인다(요청 자체는 보존 권한으로 보임).
- PB_SUPERUSER_EMAIL / PB_SUPERUSER_PASSWORD가 없으면 리뷰 신청·댓글이 서버 설정 오류로 실패한다. `npm run test:rules`가 규칙 회귀를 잡는다.
