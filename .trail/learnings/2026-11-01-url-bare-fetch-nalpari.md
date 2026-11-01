---
title: "리뷰 대상 저장소는 원격 URL로 등록하고 서버가 bare 클론해 fetch한 푸시 기준으로 리뷰한다(로컬 경로 등록 폐기)"
author: Nalpari
date: 2026-11-01
branch: feat/remote-repo-mirror
cost: { minutes: 18, tokens: 121928 }
id: l-bbc23eef
scope: repo
status: active
src: agent
touches:
  - src/lib/git.ts
  - src/app/(app)/admin-actions.ts
---

## Decided
- 제품 전제를 바꿨다: 개인 사전 리뷰는 개발자가 알아서 하고, Redline은 중앙 서버에 배포해 "푸시된 브랜치"를 리뷰하고 결과를 팀이 공유한다. 기존 기획의 "각자 로컬 구독 환경에서 실행"은 "배포 서버에서 Claude/Codex CLI를 실행"으로 본다(사용자 결정).
- 저장소 등록은 서버 로컬 경로 대신 원격 URL을 받는다. 서버가 REPOS_DIR(기본 .data/repos) 아래에 `git clone --bare`하고 `remote.origin.fetch`를 `+refs/heads/*:refs/heads/*`로 지정한다. 원격 브랜치가 클론의 refs/heads로 들어오므로 기존 listBranches/listCommits/collectDiff를 고치지 않고 그대로 쓴다.
- fetch(--prune)는 브랜치 목록을 열 때와 리뷰 요청 직전에 한다. 같은 경로의 동시 fetch는 진행 중인 Promise를 공유해 git 잠금 충돌을 피한다.

## Tried and ruled out
- `git clone --mirror`: refs/* 전체를 받아 GitHub의 refs/pull/* 까지 쌓인다. bare + heads refspec으로 대신했다.
- 개발자마다 Next를 띄우고 PocketBase만 공유: 슈퍼유저 비밀번호를 모든 PC에 나눠야 하고 local_path가 PC마다 달라 성립하지 않는다.

## Watch out
- URL에 계정·토큰을 넣지 못하게 막는다(레코드에 저장되고 화면에 보인다). 비공개 저장소는 서버 계정의 SSH 키나 credential helper로 인증한다. GIT_TERMINAL_PROMPT=0, ssh BatchMode라서 자격증명이 없으면 멈추지 않고 실패한다.
- 개인 Pro/Max 구독 하나로 팀 전체 리뷰를 서버에서 돌리는 것은 Anthropic 약관(Claude Code Legal and compliance: 구독 자격증명으로 다른 사용자 대신 요청 금지, 서비스는 API 키 인증)과 충돌할 수 있다고 사용자에게 알렸다. 사용자가 서버 구독 실행으로 진행하기로 했다.
- remote_url이 빈 예전 저장소(시드의 /srv/git/...)는 fetch 없이 local_path를 그대로 읽는다.

In the code: src/lib/git.ts (checkRemoteUrl, cloneRemote, syncRemote, reposDir), src/app/(app)/admin-actions.ts addRepository, pocketbase/pb_migrations/1761800500_repository_remote_url.js, REPOS_DIR in .env.example.
