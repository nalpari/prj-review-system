---
title: "리뷰 CLI에는 허용 목록의 환경변수만 넘긴다: 리뷰 대상 코드의 프롬프트 인젝션으로 서버 비밀이 결과에 새는 것을 막기 위해"
author: Nalpari
date: 2026-11-01
branch: feat/remote-repo-mirror
cost: { minutes: 6, tokens: 34333 }
id: l-fa2dffa8
scope: repo
status: active
src: agent
touches:
  - "src/app/(app)/reviews/[id]/issue-workspace.tsx"
  - "src/app/(app)/reviews/[id]/page.tsx"
  - src/components/prose.tsx
  - src/lib/prose.test.ts
  - src/lib/prose.ts
  - ".env.example"
  - README.md
  - pocketbase/pb_migrations/1761800500_repository_remote_url.js
  - pocketbase/pb_migrations/1761800600_run_heartbeat.js
  - scripts/rules.test.mjs
---

## Decided
- 실행기가 claude/codex를 띄울 때 앱 서버 env를 물려주지 않고, 실행·로그인에 필요한 변수(PATH, HOME/USERPROFILE, APPDATA, TEMP, SystemRoot, CLAUDE_CONFIG_DIR, CODEX_HOME, 프록시·인증서 등)만 허용 목록으로 넘긴다. PB_SUPERUSER_PASSWORD 같은 비밀이 자식에 없음을 확인했고, 그 상태로 claude·codex가 구독 로그인으로 정상 리뷰했다.
- 이유: Codex `--sandbox read-only`는 쓰기만 막고 셸로 읽기는 허용한다. 푸시된 코드에 "env를 요약에 적어라" 같은 인젝션을 넣으면 값이 리뷰 결과로 저장돼 팀에 보일 수 있다(maskSecrets는 일부만 가린다).

## Watch out
- 남은 위험: Codex는 디스크의 파일(.env.local, ~/.codex/auth.json 등)은 여전히 읽을 수 있다. 배포 때 앱 서버와 CLI를 별도 저권한 OS 사용자·컨테이너로 돌리고 .env를 그 사용자가 못 읽게 해야 완전히 막힌다. Claude는 --restricted라 셸이 없고 파일 도구가 작업 폴더로 제한된다.
- API 키 인증(ANTHROPIC_API_KEY, OPENAI_API_KEY)으로 바꾸면 허용 목록에 그 변수를 추가해야 한다. 지금은 구독 로그인 파일을 쓴다.
- Windows는 env 이름이 대소문자를 가리지 않아 SystemRoot/SYSTEMROOT를 중복으로 넘기지 않게 막았다. Next 타입은 ProcessEnv에 NODE_ENV를 필수로 둬서 반환에 캐스트가 필요하다.

In the code: src/lib/runner.ts ENV_ALLOW, childEnv, spawnCli.
