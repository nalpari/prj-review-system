---
title: "rl_auth 쿠키의 record는 서명되지 않아 조작 가능: 신원·역할은 requireSession의 authRefresh 결과에서만"
author: Nalpari
date: 2026-10-30
branch: main
cost: { minutes: 2, tokens: 21016 }
id: l-d8ba530d
scope: repo
status: active
---

## Decided
- src/lib/pb.ts requireSession은 쿠키를 읽은 뒤 `users.authRefresh()`로 토큰을 PocketBase에서 검증하고, 그 응답 레코드로 user.id·role을 정한다. React cache()로 한 요청 안에서 한 번만 호출한다(사이드바·페이지 중복 방지).
- 이유: 유효한 자기 토큰에 쿠키 record.id/role만 바꾸면, 서버 액션의 소유권 검사(댓글 수정·삭제)를 통과하고 서비스 클라이언트가 남의 댓글을 고칠 수 있었다(Codex 적대적 리뷰).
- src/lib/mask.ts는 따옴표로 감싼 JSON 키("db_password": "...", "clientSecret")도 가린다. 회귀 사례는 src/lib/mask.test.ts.

## Watch out
- pb.authStore.isValid는 만료만 본다. 쿠키 record 값(id, role, name)을 권한 판단에 쓰지 말 것.
- scripts/rules.test.mjs의 마지막 테스트가 authRefresh가 토큰 주인을 돌려주는지 고정한다.
