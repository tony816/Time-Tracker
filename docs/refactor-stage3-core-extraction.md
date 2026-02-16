# Refactor Stage 3 - Core Function Extraction

## 목표
- 상태/DOM 의존이 없는 순수 로직을 `core`로 분리한다.
- `TimeTracker` 클래스는 코어 함수를 호출하는 오케스트레이션 역할로 유지한다.

## 적용 내용
- 신규 파일: `core/time-core.js`
  - `createEmptyTimeSlots()`
  - `formatSlotTimeLabel(rawHour)`
  - `parseDurationFromText(text, normalizeDurationStep)`
- `script.js`
  - `formatSlotTimeLabel()` -> `TimeTrackerCore.formatSlotTimeLabel()` 위임
  - `createEmptyTimeSlots()` -> `TimeTrackerCore.createEmptyTimeSlots()` 위임
  - `parseDurationFromText()` -> `TimeTrackerCore.parseDurationFromText()` 위임
- `index.html`
  - `script.js` 전에 `core/time-core.js`를 로드하도록 추가

## 회귀 방지
- 신규 테스트: `__tests__/time-core.test.js`
  - 코어 exports/global attach 검증
  - 기본 슬롯 생성/시간 포맷/시간 파싱 규칙 검증
