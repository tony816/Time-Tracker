# Time-Tracker Plan-only 구현 핸드오프 문서

작성 목적: Codex 코딩 에이전트가 Time-Tracker의 Plan-only 설계안을 총체적으로 이해하고, Notion에 정리된 순서와 Phase를 어기지 않고 단계적으로 구현하도록 하기 위한 단일 기준 문서.

작성 기준: 사용자가 Notion `TiTi` 데이터베이스에 업로드한 최신 확정안과 첨부 이미지의 구현 순서.

---

## 0. Codex가 먼저 지켜야 할 운영 규칙

### 0.1 구현 순서 고정

구현 범주 순서는 첨부 이미지의 Notion 테이블 정렬을 그대로 따른다. 위에서 아래로 진행한다.

1. 계획 세그먼트 단위 타이머 측정 1안
2. 세그먼트 내 토글과 기록 시간 표시
3. Plan-only 선택형 계획 세그먼트 타이머
4. 범주 리스트
5. 활동 카탈로그 / 활동 칩 보드 시스템
6. 직접 조작형 세그먼트 편집 시스템
7. 루틴 / 템플릿 시스템
8. 세부활동 분해 시스템
9. “활동을 고르는 UI”와 “그 활동이 들어갈 위치”가 시각적으로 분리된다는 점
10. 활동 입력 대상 인지 UX
11. “활동을 고르는 UI”와 “그 활동이 들어갈 위치”가 시각적으로 분리된다는 점

단, 1번과 2번은 3번의 최종 확정안으로 흡수된 선행 논의다. 충돌이 있으면 반드시 3번 `Plan-only 선택형 계획 세그먼트 타이머`의 최신 로드맵을 우선한다.

9번과 11번은 같은 문제 정의 계열이다. 충돌이 있으면 `활동 입력 대상 인지 UX`의 v0.2 확정안을 우선한다. 특히 모바일은 `칩 1회 탭 즉시 반영`이 확정이다.

### 0.2 Phase 순서 고정

각 범주 안에서는 Notion 페이지에 적힌 Phase 순서를 그대로 따른다. Codex는 Phase를 건너뛰거나 합치지 않는다.

나쁜 진행:

```plain text
타이머 UI부터 대충 만들고 나중에 데이터 모델 정리
```

좋은 진행:

```plain text
Phase 0 범위 고정 확인
→ Phase 1 데이터 모델
→ Phase 2 UI
→ Phase 3 로직
→ Phase N 안정화
```

### 0.3 기존 확정 범위 재논의 금지

아래 결정은 재설계하지 않는다.

- Plan-only만 대상이다.
- actual 기록 기능은 plan-only 핵심 구현에서 제외한다.
- 모든 계획 시간을 자동 기록하지 않는다.
- 사용자가 측정하고 싶은 세그먼트만 타이머로 측정한다.
- 휴식은 실제 저장된 활동 세그먼트가 아니라 계산된 gap이다.
- 활동 카탈로그는 자동 그룹 추론을 하지 않는다.
- 활동 입력은 활동 칩 보드 GUI를 사용한다.
- 부모/세부활동 관계는 사용자가 직접 만든다.
- 모바일 활동 입력은 칩 1회 탭 즉시 반영이다.
- 모바일 활동 입력에 확인 버튼과 별도 미니 프리뷰 카드는 두지 않는다.

### 0.4 저장 데이터 마이그레이션 원칙

현재 실제 사용자 데이터는 없고 테스트 데이터만 있다고 전제한다. 따라서 Plan-only 신규 설계는 backward-compatible migration보다 clean data model을 우선한다.

### 0.5 기존 저장 키는 신중히 다룬다

현재 저장 키는 다음을 사용한다.

```plain text
timesheetData:YYYY-MM-DD
timesheetData:last
tt.dayStartHour
```

Plan-only 데이터 구조를 바꾸더라도 저장/불러오기, 날짜 이동, 테스트 데이터 초기화 흐름을 함께 점검한다.

### 0.6 검증 원칙

저장소의 `AGENTS.md` 기준을 따른다.

- 들여쓰기 4칸
- JS는 세미콜론 사용
- `npm test` 실행
- UI 영향 변경은 브라우저 실사용 검증 필요
- actual-grid locking 계열을 건드리면 `npm run test:actual-lock`도 실행
- 변경 범위는 작고 단일 목적이어야 한다

현재 저장소는 정적 SPA 구조다.

```plain text
index.html        UI shell
main.js           bootstrap
script.js         TimeTracker 중심 상태/오케스트레이션
core/             pure helper
controllers/      interaction/state controller
ui/               rendering helper
infra/            storage adapter
__tests__/        node:test 기반 테스트
```

---

## 1. 제품 정체성

핵심 문장:

```plain text
편집이 귀찮지 않은 플래너
```

이 앱은 사용자가 매일 계획을 빠르게 만들고, 쉽게 고치고, 원하는 세그먼트만 선택적으로 측정하게 하는 Plan-only 플래너다.

중요한 판단 기준:

1. 입력 마찰을 줄이는가?
2. 모바일에서 오작동 가능성이 낮은가?
3. 세그먼트 조작 상태가 충돌하지 않는가?
4. 사용자가 “어디에 입력되는지” 이해할 수 있는가?
5. 데이터가 AI에게 넘겨도 해석 가능한 구조를 유지하는가?

하지 말아야 할 방향:

- 모든 계획을 기록 대상으로 만드는 것
- 실제 기록 actual grid 중심으로 회귀하는 것
- 자동 분류/자동 추론으로 활동 카탈로그를 복잡하게 만드는 것
- 확인 모달을 남발해 빠른 편집성을 해치는 것
- hover 전용 UX를 모바일 기본 UX로 삼는 것

---

## 2. 범주별 구현 순서와 핵심 확정안

# 2.1 계획 세그먼트 단위 타이머 측정 1안

역할: 선택형 계획 세그먼트 타이머의 선행 개념 정의.

핵심 취지:

```plain text
모든 계획을 실제 기록 대상으로 삼지 않고,
사용자가 속도·몰입·실행력을 확인하고 싶은 계획 세그먼트만 선택적으로 타이머화한다.
```

이 페이지의 초기 아이디어 중 다음은 후속 확정안에서 변경되었다.

- `timer.enabled` 기반 on/off 모델은 후속 v0.5에서 제거된다.
- 10분 그리드 진행 표시는 1차에서 제외된다.
- 초과 `+N분` 표시는 후속 v0.5에서 제거된다.

Codex는 이 페이지를 “문제의식과 배경”으로 읽되, 실제 구현 기준은 2.3의 최종 확정안을 따른다.

---

# 2.2 세그먼트 내 토글과 기록 시간 표시

역할: 세그먼트 내부 타이머 UI 배치의 선행 논의.

유지되는 결정:

- 타이머 아이콘은 세그먼트 좌측에 고정한다.
- 아이콘은 활동명 중앙 정렬을 밀지 않는다.
- 측정 시간은 활동명 하측에 표시한다.

후속 v0.5에서 변경된 결정:

- 별도 `측정 꺼짐`, `완료`, `초과` 아이콘 상태를 쓰지 않는다.
- 미측정 상태는 `⏱` 아이콘이다.
- 실행 중은 `❚❚` 아이콘이다. 이것은 “클릭하면 일시정지”라는 다음 동작을 뜻한다.
- 일시정지는 `▶` 아이콘이다. 이것은 “클릭하면 재개”라는 다음 동작을 뜻한다.
- 초과, 일치, 미만은 숫자 추가 없이 색상으로만 표시한다.
- 진행 그리드는 제외한다.

---

# 2.3 Plan-only 선택형 계획 세그먼트 타이머

상태: 최종 확정안. 타이머 구현의 source of truth.

## Phase 0. 범위 고정

- 대상 버전: plan-only만
- actual 기록 기능: 제외
- 기존 실사용 데이터 마이그레이션: 제외
- 타이머 대상: 시간 슬롯이 아니라 계획 세그먼트
- 측정 방식: 사용자가 측정하고 싶은 세그먼트의 아이콘을 직접 클릭
- 측정 대상 사전 등록 단계: 제외
- 동시 실행 타이머: 1개만 허용
- 진행 그리드: 1차 범위에서 제외

## Phase 1. 데이터 모델

각 세그먼트는 최소 다음 구조를 가진다.

```ts
segment = {
    id: string,
    title?: string,
    titleActivityId?: string | null,
    titleText?: string | null,
    activityId?: string | null,
    activityText: string,
    startMinute: number,
    durationMinutes: number,
    plannedSeconds: number,
    timer: {
        status: "idle" | "running" | "paused",
        elapsedSeconds: number,
        startedAt: number | null,
        lastPausedAt: number | null
    }
}
```

제거 또는 사용 금지:

```plain text
timer.enabled
completedUnits
overrun 저장 상태
actual 기록 반영
```

초과/일치/미만은 저장하지 않고 렌더링 시 계산한다.

## Phase 2. 세그먼트 타이머 UI

- 타이머 아이콘은 세그먼트 좌측에 항상 표시한다.
- 아이콘은 현재 상태라기보다 클릭 시 다음 동작을 의미한다.

```plain text
idle/running 전:
[⏱] 클릭 → 측정 시작

running:
[❚❚] 클릭 → 일시정지

paused:
[▶] 클릭 → 재개
```

- 초과 아이콘 없음
- 측정 꺼짐 아이콘 없음
- 완료 아이콘 없음
- 아이콘은 활동명 중앙 정렬을 방해하지 않음
- 세그먼트 폭이 좁아도 아이콘 + 활동명 + 시간은 모두 표시
- 활동명만 ellipsis 가능

## Phase 3. 측정 시간 표시

- 측정 시간은 활동명 아래에 표시
- 모든 세그먼트에 시간 표시
- 기본: `0m / 40m`
- 실행 중: `12:34 / 40m`
- 일시정지: `12m / 40m`
- 초과 숫자 `+12m` 표시하지 않음
- 색상 규칙:
    - 미만: 기본색
    - 일치: 옐로
    - 초과: 레드
- 비교 기준은 표시 분 단위 기준

## Phase 4. 타이머 클릭 로직

필수 함수 후보:

```ts
handleSegmentTimerClick(segmentId)
startSegmentTimer(segmentId)
pauseSegmentTimer(segmentId)
resumeSegmentTimer(segmentId)
```

상태 전이:

```plain text
idle → running
running → paused
paused → running
```

다른 세그먼트 클릭:

```plain text
기존 running 세그먼트 자동 pause
클릭한 세그먼트 running
```

## Phase 5. 색상 판정 로직

```ts
getSegmentTimeTone(segment): "under" | "match" | "over"
```

기준:

```plain text
elapsedSeconds
plannedSeconds
표시용 분 단위 계산
```

아이콘 색상은 시간 초과 여부와 연동하지 않는다.

## Phase 6. 요약/분석 변경

전체 실행률, 실제 활동 합계는 제거한다. 선택 측정 활동 기준 요약만 사용한다.

표시 후보:

- 측정된 세그먼트 수
- 현재 실행 중 세그먼트
- 총 측정 시간
- 계획 시간 대비 측정 시간
- 초과 세그먼트 수
- 일치 세그먼트 수

“성공/실패” 표현은 쓰지 않는다.

## Phase 7. 안정화

- 같은 이름의 세그먼트 중복 처리
- 세그먼트 삭제 시 timer 데이터 제거
- 계획 시간 수정 시 색상 재계산
- 날짜 이동/새로고침 시 running timer 처리
- localStorage 저장 안정화
- 모바일 터치 영역 조정
- 테스트 데이터 초기화 기능

## Phase 8. 1차 완성 기준

- plan-only에서 각 계획 세그먼트 좌측에 시계 아이콘 표시
- 미측정 상태에서 아이콘 클릭 시 바로 측정 시작
- 실행 중 아이콘은 `❚❚`
- 일시정지 상태에서는 `▶`
- 측정 시간은 활동명 아래에 항상 표시
- 시간은 `측정시간 / 계획시간` 형식
- 초과·일치·미만은 색상으로만 구분
- 초과 숫자 `+N분`은 표시하지 않음
- 진행 그리드는 표시하지 않음
- 좁은 세그먼트에서도 아이콘과 시간은 유지하고 활동명만 ellipsis

---

# 2.4 범주 리스트

역할: 이후 기능 확장 범주를 구분하는 인덱스.

현재 구현은 이 문서의 순서를 따르되, 범주 리스트 자체를 기능 구현 대상으로 과하게 해석하지 않는다. 범주 리스트는 “어떤 기능 묶음이 별도 논의 대상인지”를 알려주는 메타 페이지다.

---

# 2.5 활동 카탈로그 / 활동 칩 보드 시스템

상태: 확정안.

## Phase 0. 범위 고정

- 핵심 컨셉: 계획을 빨리 만들기 위한 개인 활동 칩 보드
- 자동 그룹 추론 제외
- 활동명 자유 저장
- 종속적 활동명은 사용자가 직접 연결
- 부모 활동도 독립 활동으로 선택 가능
- 세부활동 선택 시 부모는 세그먼트 활동 타이틀로 들어감
- 세부활동은 실제 세그먼트 활동으로 들어감

## Phase 1. 활동 데이터 모델

```ts
activity = {
    id: string,
    name: string,
    normalizedName: string,
    parentId: string | null,
    colorKey?: string,
    defaultDurationMinutes?: number,
    displayMode?: string,
    pinned?: boolean,
    archived?: boolean,
    usageCount?: number,
    lastUsedAt?: number
}
```

자동 `parentId` 추론 없음.

## Phase 2. 세그먼트 데이터 모델 연결

```ts
segment.titleActivityId
segment.titleText
segment.activityId
segment.activityText
```

부모만 선택한 경우:

```ts
titleActivityId = null;
titleText = null;
activityId = parentActivityId;
activityText = parentName;
```

세부활동 선택한 경우:

```ts
titleActivityId = parentActivityId;
titleText = parentName;
activityId = childActivityId;
activityText = childName;
```

## Phase 3. 활동군 / 세부활동 GUI

- 부모 칩은 선택 영역과 펼침 영역을 분리
- 부모명 클릭: 부모 활동 자체를 세그먼트 활동으로 입력
- 화살표 클릭: 세부활동 보드 펼침
- 펼친 보드에는 부모 자체 선택 칩, 세부활동 칩, `+ 세부활동 추가` 제공
- 세부활동 추가 시 현재 부모의 `parentId`로 저장

## Phase 4. 세그먼트 표시 규칙

부모 활동 선택:

```plain text
운동
0m / 30m
```

세부활동 선택:

```plain text
운동
스쿼트
0m / 30m
```

타이틀/활동명은 폭 부족 시 ellipsis 가능. 아이콘과 시간은 생략하지 않음.

## Phase 5. 검색 / 새 활동 추가

- 검색은 부모 활동명과 세부활동명 모두 대상
- 세부활동 검색 결과는 관계 표시 가능: `스쿼트 · 운동`
- 세부활동 선택 시 부모가 title로 자동 입력
- 부모 선택 시 부모 자체가 activity로 입력
- 검색 결과 없음: 새 독립 활동 추가
- 부모 보드 안에서는 새 세부활동 추가
- 같은 `normalizedName` 중복 생성 금지

## Phase 6. 칩 선택 적용 규칙

기존 세그먼트에 적용하면 duration 유지.

새 세그먼트에 적용하면:

- 부모 defaultDuration 적용
- 세부활동 defaultDuration 우선
- 없으면 부모 defaultDuration
- 없으면 기본 30분

단, 휴식 gap에 선택하는 경우에는 `활동 입력 대상 인지 UX` 규칙에 따라 gap 전체 길이를 우선한다.

## Phase 7. 인라인 편집 연동

- 세부활동 세그먼트에서 인라인 편집은 우선 `activityText`에 적용
- `titleText` 편집은 1차에서 제한하거나 상세 편집으로 처리
- 같은 부모 아래 같은 이름의 세부활동이 있으면 switch
- 없으면 해당 부모 아래 새 세부활동 추가
- 부모 없는 단독 활동은 기존 활동 있으면 switch, 없으면 새 독립 활동 추가

## Phase 8. 1차 완성 기준

- 부모 활동 자체 입력 가능
- 부모 아래 세부활동 선택 가능
- 세부활동 선택 시 부모가 타이틀로 표시
- 검색 결과에서 세부활동을 선택해도 부모 타이틀 자동 입력
- 자동 그룹 추론 없이 사용자가 만든 관계만 사용

---

# 2.6 직접 조작형 세그먼트 편집 시스템

상태: 확정안.

핵심 컨셉:

```plain text
편집이 귀찮지 않은 플래너
```

## Phase 0. 범위 고정

- 대상 버전: plan-only만
- 드롭다운은 제거하지 않음
- 자주 쓰는 수정은 세그먼트 그래픽에서 직접 조작
- 시간 단위: 10분 스냅
- 빈 시간 허용
- 세그먼트 겹침 금지
- 자동 밀어내기 허용
- 반복 기능은 루틴 범주로 보류

## Phase 1. 데이터 모델 / 활동 카탈로그 연결

- `segment.id`
- `segment.activityId`
- `segment.title`
- `segment.startMinute`
- `segment.durationMinutes`
- `segment.colorKey`
- `segment.timer`
- activity catalog 별도 유지
- 인라인 편집 저장 시 catalog match/add
- 기존 catalog activity 이름은 인라인 편집으로 rename하지 않음
- `plannedSeconds = durationMinutes * 60`
- 세그먼트 배열은 시간순 정렬
- 겹침 검증 함수 필요
- 빈 공간 탐색 함수 필요
- auto-push resize 함수 필요
- row swap 함수 필요

## Phase 2. 활동명 인라인 편집

- 활동명 텍스트 영역 1회 클릭으로 인라인 편집 시작
- 세그먼트 전체 클릭으로 편집 시작하지 않음
- Enter 저장
- Esc 취소
- blur 저장
- 빈 값이면 기존값 유지
- 저장 시 catalog match/add 로직 실행
- 제목 길면 ellipsis 처리
- 타이머 아이콘, 시간 표시, 리사이즈, 배경 드래그와 충돌 방지

## Phase 3. 세그먼트 리사이즈 + auto-push resize

- 좌우 resize handle 추가
- 핸들은 수평 방향 조작
- 왼쪽 핸들: 시작 시간 조정
- 오른쪽 핸들: 종료 시간 조정
- 10분 단위 스냅
- 최소 길이 10분
- 옆 세그먼트 자동 밀어내기 적용
- 밀린 세그먼트가 10분 미만이 되면 삭제
- 삭제된 세그먼트는 Undo stack에 기록
- 조정 중 길이 표시
- running 세그먼트는 리사이즈 제한

## Phase 4. 세그먼트 배경 드래그 이동

- 별도 segment drag handle은 만들지 않음
- 세그먼트 이동은 세그먼트 배경 드래그로 수행
- 이동 시작 금지 영역:
    - 타이머 아이콘
    - 활동명 텍스트
    - 시간 표시 텍스트
    - 리사이즈 핸들
    - 컨텍스트 툴바
- 10분 단위 스냅
- 이동 중 ghost preview 표시
- 이동 성공 시 원래 위치는 빈 공간으로 남김
- running 세그먼트는 이동 제한
- 모바일에서는 long press 또는 별도 정책을 후속 논의에서 결정 가능

## Phase 5. 컨텍스트 툴바

- 세그먼트 선택 시 floating toolbar 표시
- 기본 항목: 분할, 병합, 복제, 삭제
- 이름 수정은 활동명 1회 클릭으로 처리
- 화면이 좁으면 일부 항목은 `⋯` 안으로 이동
- 외부 클릭 시 닫기

## Phase 6. 분할 / 병합 / 삭제 / 복제

- 반으로 나누기
- 선택 지점에서 나누기
- 인접 세그먼트 병합
- 병합 시 앞 세그먼트 제목 유지
- 삭제 후 Undo
- 복제는 가장 가까운 빈 공간에 배치
- running 세그먼트는 삭제/병합/분할 제한
- Undo는 1단계 우선 지원

## Phase 7. 계획 슬롯 row swap

- 계획 슬롯 우측 하단에 작은 row drag handle 배치
- row 이동은 row drag handle로만 수행
- row drag handle을 드래그해 다른 row에 drop
- 두 row의 계획 슬롯 내용을 교환
- 기능명: slot-level row swap
- 세그먼트 배경 드래그 이동과 row swap 분리
- running 세그먼트가 포함된 row는 swap 제한 또는 확인 필요
- row swap 후 각 세그먼트의 `startMinute` 재계산

## Phase 8. 선택 상태와 조작 충돌 처리

상태 변수 후보:

```ts
selectedSegmentId
editingSegmentId
resizingSegmentId
draggingSegmentId
draggingRowId
```

조작 우선순위:

```plain text
1. timer icon
2. resize handle
3. row drag handle
4. toolbar / menu
5. activity title inline edit
6. time display inert area
7. segment background drag
```

조작 중 드롭다운 열림 방지. 잘못된 조작은 짧은 안내 또는 조용한 차단.

## Phase 9. 1차 완성 기준

- 드롭다운 없이 활동명 텍스트 클릭으로 수정 가능
- catalog에 있으면 switch, 없으면 새 활동 추가
- 기존 catalog 활동명은 rename하지 않음
- 좌우 핸들로 계획 시간 조정
- auto-push resize 적용
- 10분 미만으로 밀린 세그먼트 삭제 + Undo
- 세그먼트 배경 드래그로 이동
- 별도 segment drag handle 없음
- row 우측 하단 handle로 row 교환
- 툴바에서 분할/병합/삭제/복제
- 세그먼트 겹침 없음
- 빈 시간 허용
- 타이머, 편집, 시간 표시, 리사이즈, 이동, row swap 충돌 없음

---

# 2.7 루틴 / 템플릿 시스템

상태: 확정안.

핵심 컨셉:

```plain text
매일 계획을 처음부터 만들지 않게 하는 플래너
```

## Phase 0. 범위 고정

- plan-only만 대상
- 템플릿은 계획 구조 저장본
- 루틴은 자주 쓰는 템플릿의 UX 표현
- 복사는 특정 날짜 계획의 재사용 기능
- 타이머 측정 기록은 템플릿에 저장하지 않음
- 직접 조작형 세그먼트 편집과 별도 범주

## Phase 1. 템플릿 데이터 모델

```ts
template = {
    id: string,
    name: string,
    type: "weekday" | "weekend" | "exercise" | "recovery" | "study" | "custom",
    segments: TemplateSegment[],
    createdAt: number,
    updatedAt: number
}
```

템플릿 segment에는 timer 데이터 제외. activity catalog와 연결 가능하되, 연결이 깨지면 title 기반 복원 가능.

## Phase 2. 오늘 계획을 템플릿으로 저장

- 오늘 전체 계획 저장
- 템플릿 이름 입력
- 유형 태그 선택 가능
- 빈 계획 저장 방지
- 같은 이름 저장 시 덮어쓰기/다른 이름으로 저장
- 저장 시 timer 상태 초기화

## Phase 3. 템플릿 목록 / 관리

- 목록 보기
- 이름 기준 정렬
- 최근 사용순 정렬
- 유형 태그 표시
- 이름 변경
- 삭제
- 삭제 후 Undo 또는 확인
- 템플릿 미리보기

## Phase 4. 템플릿 적용

- 템플릿 전체 적용
- 현재 계획 전체 덮어쓰기
- 적용 전 확인 또는 적용 후 Undo
- 적용 시 새 segment id 발급
- timer 상태 idle 초기화
- activityId는 catalog match 후 연결
- 적용 후 시간순 정렬

## Phase 5. 어제 계획 복사

- 어제 전체 계획 복사
- 현재 계획 덮어쓰기 방식 우선
- timer 기록 제외
- 새 segment id 발급
- 적용 후 Undo 가능
- 어제 계획이 없으면 안내

## Phase 6 이후는 후순위

- 시간대 선택 저장/적용
- 특정 시간대 템플릿
- 빈 곳에만 적용
- 충돌 구간 미리보기
- 평일/주말/운동일/회복일/공부일 빠른 적용
- 최근 7일 복사

---

# 2.8 세부활동 분해 시스템

상태: 확정안.

핵심 컨셉:

```plain text
세부활동 분해를 폼 입력이 아니라 세그먼트 직접 조작으로
```

## Phase 0. 범위 고정

- plan-only만 대상
- 기존 하단 행 기반 분해 폼은 1차 기본 UX에서 제외
- 기본 방식: 휴식 표시형 빈 세그먼트 기반 인라인 분해
- 세그먼트를 줄이면 남은 시간이 `휴식` 세그먼트처럼 표시
- `휴식`은 실제 저장된 활동이 아니라 계산된 gap
- 휴식 표시 세그먼트는 항상 보임
- 휴식 표시 세그먼트를 클릭하면 활동 칩 보드 열림
- 활동 선택 시 해당 휴식 구간 전체 길이만큼 새 활동 세그먼트 생성

## Phase 1. 휴식 gap 계산

- 실제 저장 데이터는 활동 세그먼트만 유지
- 휴식 세그먼트는 저장하지 않고 렌더링 시 계산
- 기준: 계획 슬롯 전체 시간, 실제 세그먼트들의 `startMinute`, `durationMinutes`
- gap이 10분 이상이면 `휴식`으로 표시
- gap이 10분 미만이면 표시하지 않음
- 인접 gap은 하나의 `휴식` 세그먼트로 병합 표시

## Phase 2. 휴식 세그먼트 상시 표시 UX

- gap은 항상 `휴식`으로 표시
- 실제 활동 세그먼트보다 약한 스타일 사용
- 필요 시 `휴식 20분`
- 점선 테두리 또는 연한 배경 사용
- hover/tap 시 클릭 가능 상태 강조
- 모바일 터치 영역 확보
- 실제 저장된 휴식 활동과 구분

## Phase 3. 리사이즈로 휴식 gap 생성

- 오른쪽을 줄이면 뒤쪽에 휴식 gap 생성
- 왼쪽을 줄이면 앞쪽에 휴식 gap 생성
- 10분 단위 스냅
- 최소 세그먼트 길이 10분
- 줄여서 생긴 gap은 즉시 휴식 표시
- 휴식 gap은 편집 모드와 관계없이 항상 표시

## Phase 4. 휴식 세그먼트 클릭 입력

- `휴식` 세그먼트 클릭 시 활동 칩 보드 열림
- 칩 선택 시 해당 휴식 구간 전체 길이만큼 활동 생성
- 부모 활동 선택 시 부모 자체 입력
- 세부활동 선택 시 부모는 title, 세부활동은 activity
- 생성 후 해당 휴식 gap은 실제 활동 세그먼트로 전환

## Phase 5. 추가 분해 흐름

반복 흐름:

```plain text
세그먼트 줄이기
→ 휴식 세그먼트 클릭
→ 활동 선택
→ 다시 줄이기
```

별도 행 추가, 잔여+, 분해 합계 UI 없이 처리한다.

## Phase 6. 삭제 / 병합 연동

- 세그먼트 삭제 시 해당 시간은 휴식 gap으로 환원
- 인접 휴식 gap은 자동 병합
- 인접 활동 세그먼트 병합은 직접 조작형 편집 규칙 사용
- 삭제 후 Undo 지원

## Phase 7. 모바일 최적화

- 휴식 세그먼트는 항상 보여 삽입 가능 위치를 명확히 함
- 휴식 탭 시 bottom sheet로 활동 칩 보드 열림
- 시트 상단에 입력 대상 표시: `휴식 20분에 활동 추가`
- 칩 선택 즉시 세그먼트 생성 후 시트 닫기
- 숫자 입력칸 없이 조작 가능
- 휴식 세그먼트 최소 터치 높이 확보

## Phase 8. 1차 완성 기준

- 세그먼트를 줄여 휴식 gap 생성 가능
- 휴식 gap은 계산된 gap
- 휴식 gap은 항상 화면에 표시
- 휴식 클릭 후 활동 칩 보드에서 활동 선택 가능
- 선택한 활동은 해당 휴식 구간 전체 길이만큼 입력
- 새 세그먼트를 다시 줄여 추가 gap 생성 가능
- 삭제 시 휴식 gap으로 환원
- 하단 행 기반 분해 폼 없이 세부활동 분해 가능

---

# 2.9 활동 입력 대상 인지 문제 정의

역할: `활동 입력 대상 인지 UX`의 문제 정의와 설계 근거.

핵심 문제:

```plain text
활동을 고르는 UI와 그 활동이 들어갈 위치가 시각적으로 분리된다.
```

사용자가 이해해야 하는 것:

- 지금 대상이 기존 세그먼트인지 휴식 gap인지
- 선택한 활동이 어느 시간대에 들어가는지
- 부모/세부활동 선택 결과가 어떻게 표시되는지
- 선택 후 길이가 어떻게 정해지는지

모바일 취약점:

- bottom sheet가 원래 계획표를 가림
- 탭한 위치와 결과 위치의 연결이 끊김
- hover preview 없음
- 좁은 화면에서 세그먼트 정보가 압축됨
- 기존 세그먼트 교체와 휴식 gap 삽입이 같은 칩 선택 동작처럼 보임

따라서 `inputTarget` 상태가 필수다.

```ts
inputTarget = {
    type: "gap" | "segment",
    slotId: string,
    segmentId?: string,
    startMinute: number,
    durationMinutes: number,
    mode: "insert" | "replace"
}
```

---

# 2.10 활동 입력 대상 인지 UX

상태: 최신 확정안 v0.2. 활동 선택 UX의 source of truth.

## 확정 흐름

데스크톱:

```plain text
휴식 gap 또는 활동 변경 target 클릭
→ target anchor popover
→ target highlight 유지
→ hover/focus ghost preview
→ 칩 클릭 즉시 반영
→ popover 닫힘
→ segment flash + Undo
```

모바일:

```plain text
휴식 gap 탭
→ bottom sheet
→ sheet 상단 target card 고정
→ 칩 1회 탭 즉시 반영
→ sheet 닫힘
→ segment flash
→ snackbar Undo
```

모바일에서는 제외:

```plain text
시트 내부 미니 프리뷰 카드
확인 버튼
long press preview
```

## Phase 0. 범위 고정

- 범주명: 활동 입력 대상 인지 UX
- 목표: 활동 선택 전후로 target, preview, result를 명확히 연결
- 기존 확정 범주 변경 없음
- 자동 그룹 추론, 템플릿, 타이머 기록 방식 변경은 다루지 않음

## Phase 1. inputTarget 상태 모델

```ts
inputTarget = {
    type: "gap" | "segment",
    slotId: string,
    segmentId?: string,
    startMinute: number,
    durationMinutes: number,
    mode: "insert" | "replace"
}
```

규칙:

- 휴식 gap 클릭: `type = "gap"`, `mode = "insert"`
- 기존 세그먼트 활동 변경: `type = "segment"`, `mode = "replace"`
- 칩 보드가 열려 있는 동안 유지
- 외부 클릭, 적용 완료, 취소 시 해제
- 날짜 이동, row swap, segment 삭제 시 무효화

## Phase 2. 데스크톱 target anchor popover

- target anchor popover 사용
- 휴식 gap 클릭 시 해당 gap 근처에 activity chip board popover
- 기존 세그먼트는 컨텍스트 툴바의 `활동 변경`에서 popover
- 화면 경계에 따라 자동 flip
- popover가 열려도 target highlight 유지
- 밖 클릭 또는 Esc로 닫기

## Phase 3. target highlight

휴식 gap target:

- 약한 배경
- dashed border
- `여기에 추가` micro label

기존 segment target:

- solid border
- `활동 변경` micro label
- 시간 길이는 유지된다는 느낌

공통:

- 색상만으로 구분하지 않음
- 타이머 초과/일치 색상과 충돌하지 않게 border/outline 중심
- 적용 완료 후 짧은 flash

## Phase 4. 데스크톱 ghost segment preview

- 칩 hover/focus 시 target 위치에 ghost preview 표시
- 부모 칩 hover: 부모 단독 표시
- 세부활동 hover: 부모/세부활동 2줄 표시
- 휴식 gap target: 새 세그먼트처럼 ghost 표시
- 기존 segment target: 기존 박스 안의 activity preview만 변경
- keyboard focus도 동일

## Phase 5. 모바일 bottom sheet

- 모바일에서는 bottom sheet 사용
- 휴식 gap 탭 시 열림
- 기존 세그먼트는 toolbar의 `활동 변경`에서 열림
- sheet 상단 target card 고정
- 계획표 target highlight 유지
- sheet 높이 기본 55~65%, 검색 시 확장 가능

휴식 gap target card:

```plain text
입력 대상
11:40–12:00 · 휴식 20분
선택한 활동이 이 구간 전체에 추가됩니다
```

기존 세그먼트 target card:

```plain text
변경 대상
11:00–11:30 · 운동 / 걷기
활동만 변경되고 시간은 유지됩니다
```

## Phase 6. 모바일 칩 1회 탭 즉시 반영

- 칩 1회 탭 즉시 반영
- 확인 버튼 제외
- 별도 미니 프리뷰 카드 제외
- 적용 후 sheet 닫힘
- 생성/변경된 세그먼트 selected flash
- snackbar Undo 제공

## Phase 7. 칩 내부 결과 예측 문구

부모 활동:

```plain text
[운동]
운동으로 입력
```

세부활동:

```plain text
[스쿼트]
운동 / 스쿼트로 입력
```

새 활동 추가:

```plain text
[+ 독서 추가]
독서로 입력
```

## Phase 8. 적용 로직 분리

### gap insert

```ts
applyActivityToGap(inputTarget, selectedActivity)
```

- gap 전체 길이만큼 새 segment 생성
- 새 segment id 발급
- timer 상태 idle
- elapsedSeconds 0
- 부모 선택 시 부모 단독 activity
- 세부활동 선택 시 parent는 title, child는 activity
- 생성 후 gap 재계산

### segment replace

```ts
replaceSegmentActivity(segmentId, selectedActivity)
```

- 기존 segment id 유지
- startMinute 유지
- durationMinutes 유지
- 부모/세부활동 표시 규칙만 갱신
- idle/paused 상태에서는 변경 가능
- running 상태에서는 변경 제한 추천

문구:

```plain text
측정 중인 세그먼트는 활동을 변경할 수 없습니다.
먼저 일시정지하세요.
```

## Phase 9. 조작 충돌 방지

- 기존 세그먼트 전체 클릭으로 칩 보드 열지 않음
- 활동명 텍스트 클릭은 인라인 편집 유지
- 세그먼트 배경 드래그는 이동 유지
- 타이머 아이콘은 타이머 유지
- 리사이즈 핸들은 리사이즈 유지
- 휴식 gap 본체 탭은 칩 보드 열기
- 기존 세그먼트 활동 변경은 컨텍스트 툴바의 `활동 변경`
- running 세그먼트 활동 변경 제한
- 리사이즈/드래그 중에는 칩 보드 열림 차단

## Phase 10. 전환 피드백 / Undo

- 칩 선택 후 120~180ms 전환 애니메이션
- 데스크톱: ghost preview가 real segment로 바뀌는 느낌
- 모바일: sheet가 내려가며 target segment flash
- snackbar Undo

삽입 후:

```plain text
운동 / 스쿼트 20분 추가됨   [되돌리기]
```

변경 후:

```plain text
활동이 운동 / 스쿼트로 변경됨   [되돌리기]
```

Undo:

- gap insert: 생성 segment 삭제, 해당 시간은 휴식 gap으로 환원
- segment replace: 이전 `activityId/activityText/titleActivityId/titleText` 복원

## Phase 11. 1차 완성 기준

- 휴식 gap 클릭 시 어느 시간대에 활동이 들어갈지 즉시 인지 가능
- 데스크톱 target anchor popover 작동
- 칩 보드가 열린 동안 대상 gap/segment 강조 유지
- 데스크톱 hover/focus ghost preview 작동
- 모바일 bottom sheet target card 표시
- 모바일 칩 1회 탭 즉시 반영
- 확인 버튼과 별도 미니 프리뷰 카드 없음
- gap 선택 시 gap 전체 길이만큼 새 segment 생성
- 기존 segment 활동 변경 시 시간 길이는 유지
- 부모/세부활동 선택 결과 예측 가능
- 타이머, 인라인 편집, 리사이즈, 이동과 충돌 없음
- 잘못 선택하면 Undo 가능

---

## 3. 상태 충돌에 대한 임시 통합 규칙

상태 충돌 통합 시스템은 아직 별도 실물 구현 후 재논의 대상이지만, 현재 구현을 시작하려면 최소한 아래 임시 규칙을 따른다.

### 3.1 상태 변수 후보

```ts
selectedSegmentId
editingSegmentId
resizingSegmentId
draggingSegmentId
draggingRowId
inputTarget
openedChipBoard
runningTimerSegmentId
undoStack
```

### 3.2 우선순위

```plain text
1. timer icon
2. resize handle
3. row drag handle
4. toolbar / menu
5. activity title inline edit
6. time display inert area
7. segment background drag
8. gap click → activity input
```

단, 휴식 gap은 실제 활동 세그먼트가 아니므로 gap 본체 클릭은 activity chip board 열기로 사용한다.

### 3.3 차단 규칙

- running 세그먼트는 활동 변경, 이동, 리사이즈, 삭제, 병합, 분할 제한
- 리사이즈 중에는 칩 보드 열지 않음
- 드래그 중에는 칩 보드 열지 않음
- bottom sheet 열린 상태에서 날짜 이동/row swap 발생 시 inputTarget 무효화
- inputTarget이 무효화되면 popover/sheet 닫기

---

## 4. Codex 구현 지침

### 4.1 첫 응답 형식

저장소의 `AGENTS.md`에 따라 Codex는 실제 코딩 전 아래 프레임으로 작업 프롬프트를 정제해야 한다.

```plain text
무엇:
어떤 형식:
대상(사용자):
왜:
소스:
금지 사항:
테스트:
cetera(추가로 너가 더 입력해야 한다고 생각하는 것):
```

### 4.2 구현 전 확인할 파일

우선 읽을 파일:

```plain text
README.md
AGENTS.md
docs/product-identity.md
docs/ai-handoff-map.md
index.html
script.js
main.js
controllers/planned-editor-controller.js
controllers/inline-plan-dropdown-controller.js
controllers/timer-controller.js
controllers/time-entry-render-controller.js
core/activity-core.js
core/duration-core.js
core/grid-metrics-core.js
core/timesheet-state-core.js
ui/time-entry-renderer.js
styles.css
styles/interactions.css
styles/responsive.css
```

테스트 확인:

```plain text
__tests__/planned-editor-controller.test.js
__tests__/inline-plan-dropdown-controller.test.js
__tests__/planned-catalog-routine-controller.test.js
__tests__/planned-split-visualization-regression.test.js
__tests__/timer-controller.test.js
__tests__/timesheet-state-core.test.js
```

### 4.3 실제 구현 방식

- 한 번에 전체 구현하지 않는다.
- Notion Phase 단위로 작은 PR처럼 진행한다.
- 데이터 모델 변경 후 렌더링 변경, 이후 인터랙션 로직을 붙인다.
- UI 변경은 브라우저에서 실제 클릭/탭 시나리오 검증을 한다.
- 테스트 데이터 초기화 가능성을 유지한다.
- actual 기록 흐름과 섞지 않는다.

### 4.4 금지 사항

- Plan-only 구현 중 actual grid 기록을 다시 핵심으로 끌어오지 말 것
- 자동 그룹 추론 구현 금지
- 모바일에서 확인 버튼을 기본 입력 흐름에 넣지 말 것
- 기존 세그먼트 전체 클릭으로 활동 칩 보드 열기 금지
- 세그먼트 전체 클릭으로 인라인 편집 시작 금지
- 별도 segment drag handle 추가 금지
- timer.enabled 모델로 회귀 금지
- 초과 `+N분` 표시 금지
- 진행 그리드 1차 구현 금지
- 기존 catalog activity 이름을 인라인 편집으로 rename 금지

---

## 5. 최소 브라우저 검증 시나리오

### 5.1 선택형 세그먼트 타이머

1. plan-only 화면에서 세그먼트 좌측에 `⏱` 표시 확인
2. `⏱` 클릭 → 타이머 실행, 아이콘 `❚❚` 확인
3. 실행 중 시간 `12:34 / 40m` 형식 확인
4. `❚❚` 클릭 → paused, 아이콘 `▶` 확인
5. `▶` 클릭 → 재개 확인
6. 다른 세그먼트 `⏱` 클릭 → 기존 running 자동 pause 확인
7. 초과/일치/미만 색상 확인
8. 초과 `+N분`이 표시되지 않는지 확인

### 5.2 활동 칩 보드 / 부모 세부활동

1. 부모 활동 `운동` 생성
2. 세부활동 `스쿼트` 생성
3. 부모 선택 → 세그먼트에 `운동` 단독 표시
4. 세부활동 선택 → 세그먼트에 `운동 / 스쿼트` 구조 표시
5. 검색에서 `스쿼트` 선택 시 부모 `운동` 자동 표시
6. 같은 normalizedName 중복 생성 차단 확인

### 5.3 직접 조작형 편집

1. 활동명 텍스트 클릭 → 인라인 편집 시작
2. 세그먼트 배경 드래그 → 이동 시작
3. 타이머 아이콘 클릭 시 이동/편집이 시작되지 않음
4. 리사이즈 핸들 드래그 → 10분 단위 조정
5. auto-push로 10분 미만 세그먼트 삭제 + Undo 확인
6. row 우측 하단 handle로 row swap 확인

### 5.4 휴식 gap 분해

1. 세그먼트 오른쪽을 줄여 뒤쪽 휴식 gap 생성
2. 휴식 gap이 항상 표시되는지 확인
3. 휴식 gap 클릭 → 칩 보드 열림
4. 활동 선택 → gap 전체 길이만큼 세그먼트 생성
5. 새 세그먼트를 다시 줄여 추가 휴식 gap 생성
6. 세그먼트 삭제 시 휴식 gap 환원 확인

### 5.5 활동 입력 대상 인지 UX

데스크톱:

1. 휴식 gap 클릭
2. target anchor popover가 gap 근처에 열리는지 확인
3. target highlight 유지 확인
4. 칩 hover/focus 시 ghost preview 확인
5. 칩 클릭 즉시 반영 확인
6. segment flash + Undo 확인

모바일:

1. 휴식 gap 탭
2. bottom sheet 열림
3. sheet 상단 target card 표시 확인
4. 칩 1회 탭 즉시 반영 확인
5. 확인 버튼이 없는지 확인
6. sheet 닫힘 + segment flash + snackbar Undo 확인

---

## 6. 최종 구현 목표 문장

Codex는 아래 문장을 구현 기준으로 삼는다.

```plain text
Time-Tracker Plan-only는 사용자가 하루 계획을 세그먼트 단위로 빠르게 만들고,
세그먼트를 직접 조작해 귀찮지 않게 고치며,
원하는 세그먼트만 선택적으로 타이머 측정하고,
휴식 gap과 활동 칩 보드를 통해 어디에 무엇이 들어가는지 명확히 인지하면서,
모바일에서도 확인 버튼 없이 빠르게 입력하되 Undo로 복구할 수 있는 플래너다.
```
