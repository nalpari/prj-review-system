# Redline (가칭)

브랜치 diff와 커밋 맥락으로 Claude 또는 Codex 코드리뷰를 실행하고, 요청·실행 상태·이슈·토론·이력을 한곳에서 관리하는 팀 도구. 기획 문서는 `docs/`.

## 로컬 실행

```bash
npm install

# PocketBase 바이너리 (macOS arm64 예시, 다른 OS는 releases에서 받기)
curl -L -o /tmp/pb.zip https://github.com/pocketbase/pocketbase/releases/download/v0.40.6/pocketbase_0.40.6_darwin_arm64.zip
unzip -o /tmp/pb.zip pocketbase -d pocketbase

npm run pb:superuser   # 슈퍼유저 (PB_SUPERUSER_EMAIL / PB_SUPERUSER_PASSWORD)
npm run pb:serve       # http://127.0.0.1:8090, 시작할 때 pb_migrations 적용, pb_hooks 로드(실행 상태 전이)
npm run pb:seed        # 다른 터미널에서, 데모 데이터
npm run dev            # http://localhost:3000
```

`.env.local`에 `PB_SUPERUSER_EMAIL`, `PB_SUPERUSER_PASSWORD`(필요하면 `POCKETBASE_URL`)를 둔다. 서버는 이 계정으로만 리뷰 결과·실행 상태·댓글·이력을 쓴다. 사용자 토큰으로는 PocketBase 규칙이 이 쓰기를 막는다.

데모 계정: `admin@redline.local` / `redline-demo-1` (시스템 관리자), `seoyeon@redline.local` / `redline-demo-1` (결제팀 개발자).
시드의 사람·저장소·커밋·리뷰 결과는 모두 예시 데이터다. 시드 저장소 경로(`/srv/git/...`)는 실제로 없으므로, 리뷰를 새로 요청하려면 저장소 화면에서 이 서버의 실제 Git 저장소 경로를 등록한다.

## 구조

- `pocketbase/pb_migrations/` 컬렉션과 접근 규칙. 팀 멤버십이 저장소·리뷰·이슈·댓글 접근을 결정하고, 서버(PocketBase)가 강제한다.
- `src/lib/git.ts` 브랜치·커밋·diff 수집(셸 없이 인자 배열로 git 호출, 저장 전 비밀정보 마스킹 `src/lib/mask.ts`).
- `src/lib/runner.ts` 로컬 실행 어댑터. 지금은 CLI 존재만 확인하고 재시도 가능한 실패로 기록한다. 실제 Claude/Codex 실행 연동은 다음 단계.
- `src/components/route-map.tsx` 브랜치 노선도(타깃=본선, 현재 브랜치=지선, 커밋=역, 실행 상태=열차).

`npm test`로 마스킹·diff 파서 검사를, `npm run test:rules`로 PocketBase 접근 규칙 통합 검사(PocketBase 실행 중이어야 함)를 돌린다.
