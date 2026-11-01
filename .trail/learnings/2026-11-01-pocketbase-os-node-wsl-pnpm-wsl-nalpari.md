---
title: "PocketBase 명령은 OS별 바이너리를 고르는 Node 래퍼로 실행하고, WSL 저장소의 pnpm은 WSL 안에서만 돌린다"
author: Nalpari
date: 2026-11-01
branch: main
id: l-08bf2616
scope: repo
status: active
src: agent
touches:
  - README.md
  - package-lock.json
  - package.json
  - scripts/rules.test.mjs
  - scripts/seed.mjs
---

## Decided
- PocketBase 실행 스크립트(pb:serve, pb:superuser)는 셸 문법 대신 Node 래퍼로 돌린다. 기존 `cd pocketbase && ./pocketbase ... ${VAR:-기본값}`은 sh 전용이라 Windows(pnpm이 cmd로 실행)에서 못 쓴다. 래퍼가 OS에 맞는 바이너리(pocketbase / pocketbase.exe)를 고른다.
- PocketBase 바이너리는 OS마다 달라서(git에서 제외됨) README에 받는 명령을 나눠 둔다. 그렇지 않으면 macOS 예시만 보고 받은 바이너리가 Linux에서 Exec format error로 실패한다. 

## Watch out
- `Exec format error`가 나면 다른 OS용 바이너리가 들어 있는 것이다. WSL에 macOS arm64(Mach-O) 바이너리가 있어서 pb:* 명령이 전부 실패했다. `file pocketbase/pocketbase`로 확인한다.
- WSL에 둔 저장소에서 Windows PowerShell로 `\wsl.localhost\...` 경로에서 pnpm install을 돌리면 ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY로 멈춘다. Windows pnpm은 저장소 위치가 달라 node_modules를 지우려 하고, Windows는 pnpm의 Linux 심볼릭 링크를 다루지 못한다. node_modules 작업은 WSL 안에서 한다.
- pnpm 11은 승인 안 된 빌드 스크립트가 있으면 설치를 실패시킨다. unrs-resolver는 pnpm-workspace.yaml allowBuilds에서 false로 둔다(대체 바이너리 다운로드용이라 필요 없음).

In the code:
- scripts/pb.mjs, package.json scripts pb:serve / pb:superuser, README.md "로컬 실행", .gitignore /pocketbase/pocketbase.exe, pnpm-workspace.yaml
