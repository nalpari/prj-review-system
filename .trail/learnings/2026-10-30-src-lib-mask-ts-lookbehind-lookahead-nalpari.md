---
title: "src/lib/mask.ts 정규식은 입력 길이에 선형이어야 한다: 식별자 시작 lookbehind + 키워드 lookahead, [\\w.-]* 양쪽 열기 금지"
author: Nalpari
date: 2026-10-30
branch: main
cost: { minutes: 4, tokens: 26209 }
id: l-5f060a1f
scope: repo
status: active
---

## Decided
- `maskSecrets` (src/lib/mask.ts)는 diff 전체에 동기로 돌아 서버 이벤트 루프를 막을 수 있다. `ASSIGNMENT`는 `(?<![\w.-])`로 식별자 첫 글자에서만 시작하고, 키워드는 lookahead로 확인한 뒤 식별자를 `[\w.-]+`로 통째로 읽는다.
- JWT·URL 패턴도 lookbehind로 시작 위치를 묶었고, 비밀 키 블록은 `[\s\S]*?` 대신 `(?:[^-]|-(?!-{4}))*`로 다음 `-----`에서 멈춘다.
- src/lib/git.ts `collectDiff`는 마스킹 전에 원문 크기(MAX_DIFF)를 먼저 확인하고, 가린 뒤 한 번 더 확인한다.

## Tried and ruled out
- 키를 넓게 잡고 replace 콜백에서 키워드를 검사하는 방식: 키워드 없는 할당이 값(문자열)을 소비해서 `x = "token=..."` 안의 비밀값을 놓친다.

## Watch out
- 이전 정규식 `[\w.-]*(?:password|...)[\w.-]*`는 4만 자 "password" 반복에서 2분 넘게 멈췄다(세제곱). 패턴을 추가할 때는 src/lib/mask.test.ts 의 40만 자 성능 테스트를 통과해야 한다.
