---
title: "리뷰 실행은 서버의 claude/codex CLI를 stdin 프롬프트로 헤드리스 실행하고, 결과 JSON 형식은 CLI 플래그가 아니라 프롬프트와 자체 파서로 강제한다"
author: Nalpari
date: 2026-11-01
branch: feat/remote-repo-mirror
cost: { minutes: 8, tokens: 81354 }
id: l-9beedde1
scope: repo
status: active
src: agent
touches:
  - src/lib/runner.ts
  - src/lib/review-output.ts
  - src/lib/review-output.test.ts
  - src/lib/run-state.ts
---

## Decided
- 실행은 리뷰 대상 head_sha를 `git worktree add --detach`로 임시 폴더에 꺼내고, 그 폴더를 cwd로 CLI를 띄운다. Claude는 `-p --output-format json --tools Read,Grep,Glob --restricted --strict-mcp-config --no-session-persistence --permission-mode dontAsk`, Codex는 `exec --sandbox read-only --ephemeral -o <파일> -`. 둘 다 2026-11 기준 실제 로그인된 CLI로 끝까지 돌려 확인했다(11~12초, 심어 둔 off-by-one을 찾음).
- 프롬프트(diff 포함)는 stdin으로 넘긴다. 인자는 고정 플래그와 임시 경로만 둔다.
- 결과 JSON 형식은 프롬프트에 적고 src/lib/review-output.ts parseReview가 검증한다. 형식이 틀린 이슈만 버리고 partial로 표시, summary가 없거나 JSON이 아니면 실패.
- 이슈를 먼저 저장한 뒤 completed로 전이하고, 전이가 막히면(superseded) 그 시도가 만든 이슈를 지운다. runAttempt의 execute가 runId를 받아 5초마다 status·run_id를 확인하고, 바뀌면 CLI 프로세스 트리를 죽인다.

## Tried and ruled out
- Claude `--json-schema '<JSON>'`: Windows에서 npm 전역 CLI가 claude.cmd 래퍼라 shell로 실행해야 하고, cmd가 JSON 인자의 따옴표를 깨뜨린다. 그래서 스키마를 프롬프트로 옮겼다.
- shell 없이 claude.cmd 실행: Node가 `spawn EINVAL`로 거부한다(.cmd/.bat는 shell 필요).
- `which`로 CLI 확인: Windows에 없어서 항상 "실행 환경을 찾을 수 없음"이 됐다. win32는 `where`.

## Watch out
- Windows에서 shell:true면 child.kill이 cmd만 죽인다. `taskkill /T /F`로 트리를 죽이고, POSIX는 detached + process.kill(-pid).
- 앱 서버가 실행 중에 재시작되면 요청이 running에 남는다(예전부터 있던 문제, 아직 회수 로직 없음).
- MAX_PROMPT_DIFF 800,000자를 넘는 diff는 실행 전에 실패시킨다(모델 문맥 한도).

In the code: src/lib/runner.ts (ADAPTERS, spawnCli, watchAttempt, checkout), src/lib/review-output.ts, src/lib/run-state.ts runAttempt(execute(runId)), REVIEW_TIMEOUT_MS.
