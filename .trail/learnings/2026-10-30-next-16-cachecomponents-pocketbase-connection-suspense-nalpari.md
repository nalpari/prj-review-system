---
title: "Next 16 cacheComponents: PocketBase 세션 읽기는 connection() 뒤, 페이지 데이터는 페이지별 Suspense 안"
author: Nalpari
date: 2026-10-30
branch: main
cost: { minutes: 32, tokens: 346531 }
id: l-4ab27c29
scope: repo
status: active
touches:
  - pocketbase/pb_migrations/1761800000_init_schema.js
  - src/lib/mask.ts
  - src/lib/mask.test.ts
  - src/lib/types.ts
  - src/lib/pb.ts
  - src/lib/git.ts
  - src/lib/runner.ts
  - scripts/seed.mjs
  - src/app/globals.css
  - src/app/layout.tsx
---

## Decided
- src/lib/pb.ts pbFromCookies()가 cookies() 다음에 `await connection()`을 호출한다. PocketBase authStore.isValid가 JWT 만료를 Date.now()로 보기 때문에, 없으면 모든 라우트가 "unstable value Date.now() while prerendering" 오류를 낸다.
- 상대 시간은 서버에서 requestNow()로 한 번 구해 `now` prop으로 내린다(클라이언트 컴포넌트에서 Date.now() 금지, react-hooks/purity).
- src/app/(app)의 각 page.tsx는 동기 래퍼가 `<Suspense fallback={<PageSkeleton />}>`로 데이터 컴포넌트를 감싼다. 레이아웃의 Suspense만으로는 소프트 내비게이션 instant 검증을 통과하지 못한다.

## Tried and ruled out
- `export const instant = false`로 검증을 끄는 방법: 구조로 해결 가능해서 쓰지 않았다.

## Watch out
- `npx tsc`가 `.next/types/validator.ts` 오류를 내면 생성 타입이 낡은 것이다. `next build`(또는 dev)가 다시 만든다. 코드 문제 아님.
