---
version: 1
slug: "src-app"
primary_target: "src/app"
related_targets: []
---

# Surface brief: Redline 앱 (리뷰 목록, 리뷰 요청 작성, 리뷰 상세, 저장소, 팀·권한, 데이터 보존, 로그인)

Mode: Operate. 개발자·테크 리드가 데스크톱에서 리뷰를 신청하고, 실행 상태를 보고, 이슈를 분류·토론한다.
Build path: code-led. Critique reference: .impeccable/mocks/decision/assigned.png, chosen sketch .impeccable/mocks/decision/assigned.html.

## Direction contract

THESIS: 브랜치 diff 리뷰를 서울 지하철 노선도처럼 읽는다. 타깃 브랜치와 현재 브랜치는 두 노선, 커밋은 역, 분기점은 환승역, 실행 상태는 노선 위 열차 위치. 회색 카드와 KPI 타일로 채운 카테고리 기본 대시보드를 거부한다.
OWN-WORLD: 시원한 중립 바탕 #F3F4F1, 잉크 #15171A, 흰 판 1px #E3E5E0. 크롬은 바탕과 잉크 두 값만(데이터매틱스에서 가져온 규율). 색은 저장소 노선색(초록 #00A84D, 파랑 #0065B3, 주황 #EF7C1C 등 법랑 안내판 평면색)과 상태에만. 저장소는 숫자가 든 원형 노선 표지. 한글 그로테스크 하나, 커밋 해시·경로만 등폭.
STORY: 무엇을 무엇과 비교했는지, 지금 어디까지 실행됐는지, 무엇을 먼저 고쳐야 하는지 순서로 읽고, 이슈를 하나씩 확인·해결·보류로 처리한다. AI 결과는 참고용임을 늘 안다.
FIRST VIEWPORT: 좌측 232px 사이드바(워드마크, 팀 전환, 내비, 노선 표지 달린 저장소 목록). 상세 화면은 제목 행(브랜치 → 타깃, 상태, 다시 실행) 아래 캔버스 폭 노선도(약 200px), 그 아래 요약 문장과 심각도 수, 좌 2/3 이슈 목록, 우 1/3 변경 파일 레일(높이 ∝ 변경 라인)과 컨텍스트 한도 대비 diff 길이. 목록 화면은 각 행 앞에 노선 표지, 실행 중 행은 진행 표시.
FORM: 지하철 노선도 / 역사 안내 사인 (내 목록 5번, 배정). seed:78205355998a07ff. Raises: 크롬 두 값(데이터매틱스), 컨텍스트 한도 테이프 길이(J카드), 변경 파일 비례 레일(아세테이트 탭), j/k 한 건씩 분류(세로 피드).
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Decisions after finish review
- 사이드바 팀 전환: 이번 범위에서 뺐다. 구성원은 소속된 모든 팀의 저장소를 한 목록에서 보고(사이드바에 소속 팀 이름 표시), 저장소 필터로 좁힌다. 팀이 많아지면 상단 전환기를 추가한다.
- 노선 번호와 색은 SEOUL_LINES 한 곳에서 파생한다(5·8호선 제외).

## Constraints
- 시그니처 이동은 노선도 한 곳(상세)과 목록의 노선 표지에만. 색이 크롬으로 번지지 않는다.
- 상태: 대기, 실행 중, 완료, 실패(재시도), 취소. 이슈: 미확인, 확인, 해결, 보류.
