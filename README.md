# Redline (가칭)

브랜치 diff와 커밋 맥락으로 Claude 또는 Codex 코드리뷰를 실행하고, 요청·실행 상태·이슈·토론·이력을 한곳에서 관리하는 팀 도구. 기획 문서는 `docs/`.

## 로컬 실행

pnpm 명령은 저장소가 있는 OS의 터미널에서 실행한다. WSL에 둔 저장소는 WSL 터미널에서 실행한다(Windows PowerShell에서 `\\wsl.localhost\...` 경로로 `pnpm install`을 돌리면 심볼릭 링크를 다루지 못해 실패한다).

```bash
pnpm install
```

### PocketBase 바이너리

`pocketbase/`에 OS에 맞는 v0.40.6 바이너리를 받는다(git에서 제외된다). 다른 CPU는 [releases](https://github.com/pocketbase/pocketbase/releases/tag/v0.40.6)에서 같은 이름 규칙의 파일을 받는다.

macOS (Apple Silicon, Intel은 `darwin_amd64`):

```bash
curl -L -o /tmp/pb.zip https://github.com/pocketbase/pocketbase/releases/download/v0.40.6/pocketbase_0.40.6_darwin_arm64.zip
unzip -o /tmp/pb.zip pocketbase -d pocketbase
```

Linux / WSL (x86_64, ARM은 `linux_arm64`):

```bash
curl -L -o /tmp/pb.zip https://github.com/pocketbase/pocketbase/releases/download/v0.40.6/pocketbase_0.40.6_linux_amd64.zip
unzip -o /tmp/pb.zip pocketbase -d pocketbase
```

Windows PowerShell (x64, ARM은 `windows_arm64`):

```powershell
Invoke-WebRequest -Uri https://github.com/pocketbase/pocketbase/releases/download/v0.40.6/pocketbase_0.40.6_windows_amd64.zip -OutFile $env:TEMP\pb.zip
Expand-Archive -Path $env:TEMP\pb.zip -DestinationPath $env:TEMP\pb -Force
Copy-Item $env:TEMP\pb\pocketbase.exe pocketbase\
```

### 실행

`pb:*` 스크립트는 `scripts/pb.mjs`가 OS에 맞는 바이너리(`pocketbase` 또는 `pocketbase.exe`)를 골라 실행하므로 세 OS에서 같다.

```bash
pnpm pb:superuser   # 슈퍼유저 (.env.local의 PB_SUPERUSER_EMAIL / PB_SUPERUSER_PASSWORD)
pnpm pb:serve       # http://127.0.0.1:8090, 시작할 때 pb_migrations 적용, pb_hooks 로드(실행 상태 전이)
pnpm pb:seed        # 다른 터미널에서, 데모 데이터
pnpm dev            # http://localhost:3000
```

### 환경변수

`PB_SUPERUSER_EMAIL`, `PB_SUPERUSER_PASSWORD`, `POCKETBASE_URL`은 `.env.local`에 둔다(git에서 제외). `.env.example`을 복사해서 시작한다.

```bash
cp .env.example .env.local            # macOS / Linux
```

```powershell
Copy-Item .env.example .env.local     # Windows PowerShell
```

Next.js 앱과 `pnpm pb:superuser`, `pnpm pb:seed`, `pnpm test:rules`가 이 파일을 읽는다. 셸에 같은 이름의 환경변수가 있으면 그 값이 우선한다. 서버는 이 슈퍼유저 계정으로만 리뷰 결과·실행 상태·댓글·이력을 쓴다. 사용자 토큰으로는 PocketBase 규칙이 이 쓰기를 막는다. 값을 바꾸면 `pnpm pb:superuser`를 다시 실행한다.

데모 계정: `admin@redline.local` / `redline-demo-1` (시스템 관리자), `seoyeon@redline.local` / `redline-demo-1` (결제팀 개발자).
시드의 사람·저장소·커밋·리뷰 결과는 모두 예시 데이터다. 시드 저장소 경로(`/srv/git/...`)는 실제로 없으므로, 리뷰를 새로 요청하려면 저장소 화면에서 원격 저장소 URL을 등록한다.

### 리뷰 대상 저장소

저장소는 원격 URL(https, ssh, `git@host:org/repo.git`)로 등록한다. 서버가 `REPOS_DIR`(기본 `.data/repos`) 아래에 bare 클론을 만들고, 브랜치 목록을 열 때와 리뷰를 요청할 때 `git fetch --prune`으로 푸시된 최신 브랜치를 받는다. 리뷰는 푸시된 브랜치 기준이다. 비공개 저장소는 서버 계정의 SSH 키나 git credential helper로 인증하고, URL에 토큰을 넣지 않는다.

## 구조

- `pocketbase/pb_migrations/` 컬렉션과 접근 규칙. 팀 멤버십이 저장소·리뷰·이슈·댓글 접근을 결정하고, 서버(PocketBase)가 강제한다.
- `src/lib/git.ts` 원격 저장소 클론·fetch, 브랜치·커밋·diff 수집(셸 없이 인자 배열로 git 호출, 저장 전 비밀정보 마스킹 `src/lib/mask.ts`).
- `src/lib/runner.ts` 리뷰 실행. 리뷰 대상 커밋을 임시 작업 폴더로 꺼내고, 이 서버에 설치·로그인된 `claude`(`-p`, 읽기 도구만) 또는 `codex exec`(읽기 전용 샌드박스)에 diff·커밋·맥락을 넘겨 JSON 결과를 받는다. 해석은 `src/lib/review-output.ts`. 취소·재시도하면 실행 중인 CLI를 멈추고, `REVIEW_TIMEOUT_MS`(기본 20분)를 넘기면 중단한다.
- `src/lib/stale-runs.ts` 멈춘 실행 정리. 실행기는 5초마다 `heartbeat_at`을 남기고, 앱 서버(`src/instrumentation.ts`가 띄우는 1분 주기 작업)는 2분 넘게 하트비트가 없는 실행과 2분 넘게 대기 중인 요청을 재시도 가능한 실패로 돌린다. 앱 서버가 실행 중에 재시작돼도 요청이 "실행 중"에 남지 않는다.
- `src/components/route-map.tsx` 브랜치 노선도(타깃=본선, 현재 브랜치=지선, 커밋=역, 실행 상태=열차).

`pnpm test`로 마스킹·diff 파서 검사를, `pnpm test:rules`로 PocketBase 접근 규칙 통합 검사(PocketBase 실행 중이어야 함)를 돌린다.
