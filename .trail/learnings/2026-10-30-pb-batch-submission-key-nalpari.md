---
title: "댓글 저장은 PB batch로 댓글·이력을 한 트랜잭션에, submission_key 유니크 인덱스로 재시도 중복 방지"
author: Nalpari
date: 2026-10-30
branch: main
cost: { minutes: 1, tokens: 1946 }
id: l-488b6ec9
scope: repo
status: active
---

## Decided
- `addComment` (src/app/(app)/reviews/actions.ts) 는 svc.createBatch()로 comments와 issue_events를 한 트랜잭션으로 만든다. pocketbase/pb_migrations/1761800400_comment_submission.js 가 PocketBase batch API를 켰다(규칙은 요청마다 그대로 적용).
- 폼(src/app/(app)/reviews/[id]/issue-workspace.tsx 의 `Thread`)이 submission_key를 보내고, 저장에 성공해야 새 키로 바꾼다. comments.submission_key는 빈 값이 아닐 때 유니크. 저장 전후로 같은 키·작성자의 댓글이 있으면 성공으로 본다(응답 유실·동시 제출).
- src/lib/mask.ts 는 Authorization 헤더 값(Bearer·Basic·Token, 따옴표 헤더, diff 줄)을 가린다. 문맥 없이 "bearer/basic 다음 단어"를 가리는 패턴은 일반 문장("basic understanding")까지 가려서 쓰지 않았다.

## Tried and ruled out
- 댓글 생성 후 이력 생성 실패를 보상 삭제로 되돌리는 방법: 보상 요청도 실패할 수 있어 batch 트랜잭션을 택했다.

## Watch out
- 마이그레이션은 pb:serve 시작 때만 적용된다. 이 변경을 받은 뒤 PocketBase를 재시작해야 `addComment`가 동작한다(batch 비활성이면 실패).
- `editComment`·`deleteComment`는 아직 두 요청(댓글 수정 + 이력)이다. 재시도해도 중복 댓글은 안 생기지만 이력이 빠지거나 두 번 남을 수 있다.
