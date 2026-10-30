---
name: Redline
description: 브랜치 diff 리뷰를 서울 지하철 노선도처럼 읽는 팀 코드리뷰 도구
colors:
  ground: "#f3f4f1"
  surface: "#ffffff"
  raised: "#f8f9f6"
  active: "#e6e8e3"
  border: "#dfe2dc"
  rule: "#ebede8"
  control: "#c9cdc5"
  ink: "#15171a"
  muted: "#555a53"
  faint: "#686d66"
  positive: "#247b50"
  positive-bg: "#dcf5e5"
  positive-ink: "#0b3a20"
  negative: "#c4242a"
  negative-bg: "#fde9e7"
  negative-ink: "#831c1e"
  warning: "#a35a00"
  warning-bg: "#fff3dc"
  warning-ink: "#6e3d00"
  line-1: "#0052A4"
  line-2: "#00A84D"
  line-3: "#EF7C1C"
  line-4: "#00A5DE"
  line-6: "#CD7C2F"
  line-7: "#747F00"
  line-9: "#BDB092"
typography:
  headline:
    fontFamily: "Wanted Sans Variable, Apple SD Gothic Neo, system-ui, sans-serif"
    fontSize: "22px"
    fontWeight: 700
    lineHeight: "30px"
    letterSpacing: "-0.01em"
  headline-ref:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: "20px"
    fontWeight: 700
    lineHeight: "28px"
  lead:
    fontFamily: "Wanted Sans Variable, Apple SD Gothic Neo, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: "24px"
  title:
    fontFamily: "Wanted Sans Variable, Apple SD Gothic Neo, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 600
    lineHeight: "20px"
  body:
    fontFamily: "Wanted Sans Variable, Apple SD Gothic Neo, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: "20px"
    fontFeature: "\"ss01\""
  label:
    fontFamily: "Wanted Sans Variable, Apple SD Gothic Neo, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 600
    lineHeight: "20px"
  caption:
    fontFamily: "Wanted Sans Variable, Apple SD Gothic Neo, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: "16px"
  code:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: "20px"
rounded:
  inset: "4px"
  control: "6px"
  card: "8px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  2xl: "24px"
  3xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.surface}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "0 12px"
    height: "32px"
  button-primary-hover:
    backgroundColor: "#2b2e33"
  button-primary-disabled:
    backgroundColor: "#6d7170"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "0 12px"
    height: "32px"
  button-secondary-hover:
    backgroundColor: "{colors.raised}"
  button-ghost:
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "0 12px"
    height: "32px"
  button-ghost-hover:
    backgroundColor: "{colors.active}"
  button-danger:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.negative}"
    rounded: "{rounded.control}"
    padding: "0 12px"
    height: "32px"
  button-danger-hover:
    backgroundColor: "{colors.negative-bg}"
  field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "0 12px"
    height: "36px"
  panel:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.card}"
  run-pill-running:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.surface}"
    rounded: "{rounded.full}"
    padding: "0 10px"
    height: "22px"
  run-pill-completed:
    backgroundColor: "{colors.positive-bg}"
    textColor: "{colors.positive-ink}"
    rounded: "{rounded.full}"
    padding: "0 10px"
    height: "22px"
  run-pill-failed:
    backgroundColor: "{colors.negative-bg}"
    textColor: "{colors.negative-ink}"
    rounded: "{rounded.full}"
    padding: "0 10px"
    height: "22px"
  run-pill-queued:
    backgroundColor: "{colors.active}"
    textColor: "{colors.ink}"
    rounded: "{rounded.full}"
    padding: "0 10px"
    height: "22px"
  severity-critical:
    backgroundColor: "{colors.negative-bg}"
    textColor: "{colors.negative-ink}"
    rounded: "{rounded.inset}"
    padding: "0 8px"
    height: "22px"
  severity-warning:
    backgroundColor: "{colors.warning-bg}"
    textColor: "{colors.warning-ink}"
    rounded: "{rounded.inset}"
    padding: "0 8px"
    height: "22px"
  severity-suggestion:
    backgroundColor: "{colors.active}"
    textColor: "{colors.ink}"
    rounded: "{rounded.inset}"
    padding: "0 8px"
    height: "22px"
  nav-item:
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "0 8px"
    height: "32px"
  nav-item-active:
    backgroundColor: "{colors.active}"
---

# Design System: Redline

## Overview

**Creative North Star: "역사 안내판"**

Redline은 브랜치 diff 리뷰를 서울 지하철 노선도처럼 읽게 한다. 타깃 브랜치는 잉크색 본선, 현재 브랜치는 환승역(공통 조상)에서 갈라진 저장소 노선색 지선, 커밋은 역, 실행 상태는 노선 위 열차의 위치다. 화면 나머지는 역사 안의 안내판처럼 조용하다. 시원한 중립 바탕 위에 흰 판을 1px 선으로 얹고, 글자는 잉크 하나로 쓴다.

밀도는 업무 도구의 밀도다. 기본 글자 14px/20px, 컨트롤 높이 32~36px, 표와 목록은 촘촘하다. 장식은 없고, 정보를 구분하는 수단은 선(1px)과 바탕의 한 단계 명도 차이뿐이다. 회색 카드와 KPI 타일로 채운 카테고리 기본 대시보드는 이 세계가 거부한 것이다.

색은 두 가지 이유로만 화면에 들어온다. 저장소를 가리키는 노선색, 그리고 실행·심각도 상태색. 크롬(사이드바, 판, 버튼, 탭)은 바탕과 잉크 두 값으로 끝난다.

**Key Characteristics:**
- 크롬은 바탕과 잉크 두 값. 색은 노선(저장소)과 상태에만.
- 저장소 = 노선 = 숫자가 든 원형 노선 표지. 번호와 색은 한 몸이다.
- 그림자 없는 평면. 흰 판, 1px 테두리, 8px 모서리.
- 한글 그로테스크 하나(Wanted Sans). 등폭(JetBrains Mono)은 브랜치·커밋 해시·경로·코드에만.
- 시그니처 노선도는 상세 화면 한 곳. 목록에서는 노선 표지로만 반복된다.

## Colors

법랑 안내판의 평면색 몇 개를 서늘한 회녹색 바탕과 잉크 위에 아껴 쓴다.

### Primary
- **역사 잉크** (ink): 모든 본문 글자, 주 버튼, 실행 중 상태 알약, 노선도의 본선(타깃 브랜치), 열차, 선택된 분류 버튼, 포커스 링, 텍스트 선택 반전. 이 시스템의 유일한 "강조"는 잉크의 무게다.

### Secondary: 노선색 (저장소 식별)
서울 지하철 노선 번호와 색을 그대로 쓴다. 번호를 고르면 색이 따라오며 `SEOUL_LINES` 한 곳에서 파생한다. 5호선(보라)과 8호선(분홍)은 상태색과 겹쳐 뺐다.
- **1호선 남청** (line-1), **2호선 초록** (line-2), **3호선 주황** (line-3), **4호선 하늘** (line-4), **6호선 황토** (line-6), **7호선 올리브** (line-7), **9호선 금사** (line-9): 노선 표지 원, 노선도의 지선과 역, 변경 파일 레일 막대에만 쓴다. 한 화면에 노선색이 둘 이상 나오는 곳은 목록과 사이드바 저장소 목록뿐이다.

### Tertiary: 상태색
각 상태는 선 색(positive / negative / warning), 옅은 바탕(-bg), 진한 글자(-ink) 세 값으로 쓴다. 알약과 태그는 항상 -bg 바탕 위 -ink 글자다.
- **신호 초록** (positive): 완료, 해결, 추가된 줄 수.
- **신호 빨강** (negative): 실패, 치명, 삭제된 줄 수, 위험 버튼, 컨텍스트 한도 80% 초과 막대, 이슈 해당 줄 밑줄.
- **경고 호박** (warning): 경고 심각도, 부분 저장 안내.

### Neutral
- **역사 바탕** (ground): 페이지 바탕과 사이드바.
- **흰 판** (surface): 패널, 입력, 보조 버튼 바탕.
- **들린 판** (raised): 보조 버튼 호버, 비활성 입력, 커밋 역 호버.
- **눌린 판** (active): 현재 내비 항목, 고스트 호버, 대기 알약, 제안 태그.
- **판 테두리** (border): 패널 외곽선, 사이드바 경계.
- **안쪽 괘선** (rule): 패널 안의 구획선, 표 행 구분, 진행 막대 바탕.
- **컨트롤 테두리** (control): 입력·보조 버튼 외곽선, 스크롤바, kbd 테두리.
- **보조 글자** (muted): 부제, 메타데이터, 범례, 표 머리글.
- **흐린 글자** (faint): placeholder, 빈 날짜 입력, 보류 점선.

### Named Rules
**The Two-Value Chrome Rule.** 사이드바, 패널, 버튼, 탭, 내비는 바탕 계열과 잉크로만 칠한다. 노선색이 크롬(버튼 바탕, 활성 내비, 링크)으로 번지면 실패다.

**The Line Is the Repo Rule.** 노선색은 저장소를 가리킬 때만 쓴다. 같은 저장소는 어디서나 같은 번호, 같은 색이다. 새 저장소 색을 고르지 말고 노선 번호를 고른다.

**The Status Triad Rule.** 상태는 선·바탕·글자 세 값 묶음으로만 쓴다. 상태색을 장식이나 브랜드 강조로 빌리지 않는다.

## Typography

**Body Font:** Wanted Sans Variable (with Apple SD Gothic Neo, system-ui), 자체 호스팅, 400~800, `ss01` 활성
**Mono Font:** JetBrains Mono (with ui-monospace)

**Character:** 한글 그로테스크 하나가 제목부터 캡션까지 모두 맡는다. 등폭은 사람이 아닌 git이 쓴 문자열(브랜치명, 커밋 해시, 파일 경로, 코드)을 표시하는 신호다.

### Hierarchy
- **Headline** (headline): 페이지 제목. 로그인 화면만 24px/32px로 한 단계 크다.
- **Headline-ref** (headline-ref): 리뷰 상세 제목. `현재 브랜치 → 타깃`을 등폭으로, 타깃은 보조 글자색.
- **Lead** (lead): 리뷰 요약 문장 한 단락, 최대 72ch.
- **Title** (title): 패널 머리글, 목록 행의 이슈 제목.
- **Body** (body): 기본 글자. 루트에서 14px/20px.
- **Label** (label): 버튼, 폼 라벨, 메타데이터 줄, 이슈 상태 표지.
- **Caption** (caption): 상태 알약과 태그, 표 머리글, 범례, 보조 수치. 가장 많이 쓰는 크기다.
- **Code** (code): diff 발췌, 제안 코드, 경로. 노선도의 커밋 해시만 11px.

### Named Rules
**The Mono Means Git Rule.** 등폭은 브랜치·해시·경로·코드에만 쓴다. 숫자 정렬이 필요하면 등폭 대신 tabular-nums(`num`)를 쓴다.

**The Keep-All Rule.** 한글은 어절 단위로 줄을 바꾼다(`word-break: keep-all`). 긴 경로와 해시만 강제로 끊는다.

## Layout

앱은 좌측 232px 고정 사이드바와 본문 두 열이다(1024px 이상). 1024px 아래에서 사이드바는 48px 상단 바와 전체 화면 시트로 접힌다. 본문은 최대 1280px, 좌우 여백 16 / 24 / 32px(모바일 / sm / lg), 위 24~32px.

리뷰 상세는 제목 행 → 캔버스 폭 노선도 패널 → 2:1 그리드(좌 요약·이슈 목록, 우 최소 300px 레일: 변경 파일, 요청 정보)로 쌓인다. 2:1 분할은 1280px(xl)부터, 그 아래는 한 열.

로그인은 왼쪽 420~520px 흰 판(폼 최대 360px)과 오른쪽 바탕 판의 두 열이며, 1024px 아래에서 폼 한 열.

간격 리듬은 4px 단위. 패널 사이 16px, 패널 안쪽 16~20px, 컨트롤 묶음 8px, 제목 아래 24px.

## Elevation & Depth

그림자가 없다. 깊이는 바탕(ground) 위에 흰 판(surface)을 1px 테두리(border)로 얹는 것, 그리고 판 안의 한 단계 명도(raised, active)로만 표현한다. 다크 모드는 없다(`color-scheme: light`).

### Named Rules
**The Flat Enamel Rule.** 표면은 법랑 안내판처럼 평평하다. 그림자, 그라데이션, 흐림 효과를 쓰지 않는다. 겹침이 필요하면 테두리와 명도 단계로 해결한다.

## Shapes

모서리는 세 단계다. 패널 8px, 컨트롤(버튼·입력·내비 항목·코드 블록) 6px, 판 안의 작은 태그와 분류 버튼 4px. 둥근 알약과 원은 노선도 어휘에만 속한다: 노선 표지, 실행 상태 알약, 역, 노선 선(4px 두께, 양끝 둥글게), 환승역 캡슐, 변경 파일 레일, 이슈 상태 점.

이슈 상태는 역 표지 모양으로 표시한다: 빈 원(미확인), 잉크로 찬 원(확인), 초록 원(해결), 점선 원(보류).

## Components

### Buttons
조용하고 단단하다. 잉크 한 덩어리가 화면의 주 행동이다.
- **Shape:** 6px 모서리, 높이 32px, 좌우 12px, 13px 세미볼드, 아이콘과 6px 간격.
- **Primary:** 잉크 바탕, 흰 글자. 호버 시 한 단계 밝은 잉크, 비활성 시 회색 잉크.
- **Secondary:** 흰 판, 컨트롤 테두리, 호버 시 들린 판.
- **Ghost:** 테두리 없음, 호버 시 눌린 판.
- **Danger:** 흰 판, 반투명 빨강 테두리, 빨강 글자, 호버 시 빨강 옅은 바탕.
- **Focus:** 전역 2px 잉크 외곽선, 2px 띄움. 색 전환 150ms.

### Chips
- **실행 상태 알약:** 높이 22px 완전 둥근 알약, 12px 세미볼드. 대기(눌린 판), 실행 중(잉크 바탕 + 깜빡이는 흰 점), 완료(초록 묶음), 실패(빨강 묶음), 취소(컨트롤 테두리만).
- **심각도 태그:** 높이 22px, 4px 모서리. 치명(빨강 묶음), 경고(호박 묶음), 제안(눌린 판).

### Cards / Containers
- **Panel:** 흰 판, 1px 판 테두리, 8px 모서리. 머리글은 최소 44px, 좌우 16px, 아래 안쪽 괘선. 머리글 오른쪽에 수치나 행동 하나.
- **Shadow Strategy:** 없음(Elevation 참고).
- **Internal Padding:** 16~20px.

### Inputs / Fields
- **Style:** 높이 36px, 흰 판, 컨트롤 테두리, 6px 모서리, 14px. select는 직접 그린 잉크 셰브런을 쓴다. 날짜 입력도 직접 그린 달력 아이콘을 쓴다.
- **Hover / Focus:** 호버 시 테두리가 한 단계 진해지고, 포커스 시 잉크 테두리.
- **Label:** 13px 세미볼드, 아래 8px.
- **Error:** 빨강 옅은 바탕 + 진한 빨강 글자 + 빨강 30% 테두리의 인라인 경고 상자(6px 모서리), 오른쪽에 회복 행동.

### Navigation
- **사이드바:** 바탕색, 오른쪽 1px 판 테두리, 화면 높이 고정. 위부터 워드마크, 소속 팀(12px 보조), 전폭 주 버튼, 내비, 노선 표지 달린 저장소 목록, 아래 사용자.
- **내비 항목:** 높이 32px, 6px 모서리, 16px 선 아이콘(보조 글자색, 1.75 굵기) + 14px 글자. 현재 위치는 눌린 판 + 세미볼드. 노선색을 쓰지 않는다.
- **이슈 탭:** 밑줄 없는 글자 탭, 활성은 잉크 세미볼드.
- **모바일:** 48px 상단 바, 44px 터치 대상, 전체 화면 시트.

### Line Badge (노선 표지)
저장소의 얼굴. 노선색 원 안에 볼드 숫자(원 지름의 58%). 숫자색은 `lineInk()`가 흰색과 잉크 중 대비가 큰 쪽을 고른다(1·7호선 흰색, 2·3·4·6·9호선 잉크). 실제 노선도의 흰 숫자보다 판독성을 앞세운 결정이다. 사이드바 18px, 목록 행 20~24px, 브레드크럼 16px. 목록의 모든 행은 이 표지로 시작한다.

### Route Map (노선도, 시그니처)
리뷰 상세 맨 위의 캔버스 폭 패널. 높이 164px.
- 타깃 브랜치는 잉크 본선(4px)과 오른쪽 끝 화살표, 현재 브랜치는 노선색 지선(4px)이 환승역에서 곡선으로 갈라진다.
- 환승역은 흰 캡슐에 3px 잉크 테두리, 아래에 공통 조상 해시.
- 역은 16px 원, 3px 노선색 테두리. 리뷰 맥락에 포함된 커밋은 채움, 제외된 커밋은 흰 속. 역 위에 해시, 아래에 제목 두 줄. 새 요청 화면에서는 역을 눌러 맥락을 토글한다(호버 시 1.25배).
- 열차는 6px 모서리 잉크 표찰. 대기는 환승역, 실행 중은 지선을 2.4초 왕복, 끝나면 종점에 선다. 실패는 빨강, 취소는 흐린 회색. 동작 줄이기 설정에서는 가운데 멈춘다.
- 640px 아래에서는 이름표 폭과 역 간격을 줄이고 역 제목을 숨기며, 왼쪽에 두 노선 이름표를 고정하고 최신 역부터 보인다.

### Changed-File Rail (변경 파일 레일)
변경 파일마다 6px 폭 노선색 막대. 높이는 변경 라인 수에 비례(10~56px). 아래에 diff 길이를 컨텍스트 한도와 비교하는 6px 테이프(잉크, 80% 초과 시 빨강)와 "추정값" 안내.

### Issue Row (이슈 행)
심각도 태그, 제목(title), 경로(code) 한 행. 펼치면 diff 발췌(해당 줄 빨강 2px 밑줄), 잉크 바탕 제안 코드 블록, 4px 모서리 분류 버튼 묶음(미확인·확인·해결·보류, 선택은 잉크), 토론과 이력. j/k로 한 건씩 이동한다.

## Do's and Don'ts

### Do:
- **Do** 새 화면도 바탕 → 흰 판 → 1px 테두리 → 잉크 글자로 짓는다.
- **Do** 저장소가 나오는 모든 곳에 노선 표지를 붙이고, 번호와 색은 `SEOUL_LINES`에서 가져온다.
- **Do** 상태는 알약(실행)·태그(심각도)·역 표지(이슈) 세 어휘 중 하나로 표시하고, 상태색은 선·바탕·글자 묶음으로 쓴다.
- **Do** 브랜치, 해시, 경로, 코드는 등폭으로, 숫자 열은 tabular-nums로 쓴다.
- **Do** AI 결과 옆에 "참고용" 안내를 둔다.
- **Do** 움직임은 상태를 말할 때만 쓰고(실행 중 열차, 깜빡이는 점), 동작 줄이기 설정을 따른다.

### Don't:
- **Don't** 노선색을 버튼, 활성 내비, 링크, 패널 바탕 같은 크롬에 쓰지 않는다.
- **Don't** 그림자, 그라데이션, 흐림 효과로 깊이를 만들지 않는다.
- **Don't** 회색 카드와 KPI 타일을 늘어놓은 대시보드를 만들지 않는다.
- **Don't** 노선도를 상세 화면 밖으로 복제하지 않는다. 다른 화면에서는 노선 표지로만 노선을 말한다.
- **Don't** 5호선 보라와 8호선 분홍을 노선색으로 쓰지 않는다.
- **Don't** 본문이나 라벨에 등폭을 쓰지 않는다.
