# Refactor Stage 9 - Date Core Extraction

## 목표
- `script.js`에 있던 순수 날짜/캘린더 계산 로직을 `core` 모듈로 분리한다.
- UI 상태와 무관한 계산을 독립 테스트 가능하게 만든다.

## 적용 내용
- 신규 파일: `core/date-core.js`
  - `parseLocalDateParts(date)`
  - `getDateValue(date)`
  - `compareDateStrings(a, b)`
  - `formatDateFromMsLocal(ms)`
  - `getTodayLocalDateString()`
  - `getLocalSlotStartMs(date, hour)`
  - `getDayOfWeek(date)`
- `script.js`
  - 동일 메서드(`getLocalDateParts`, `getDateValue`, `compareDateStrings`, `formatDateFromMsLocal`, `getTodayLocalDateString`, `getLocalSlotStartMs`, `getDayOfWeek`)를 `TimeTrackerDateCore` 우선 위임으로 변경
  - 모듈 미탑재 시 기존 fallback 계산 유지
- `index.html`
  - `core/date-core.js`를 `script.js` 전에 로드
- `server.js`
  - `/core/date-core.js` 정적 파일 매핑/라우트 추가

## 회귀 방지
- 신규 테스트: `__tests__/date-core.test.js`
  - 모듈 export/global attach 검증
  - 날짜 파싱/비교/포맷/요일/슬롯 시작 시각 계산 검증
- 보강 테스트:
  - `__tests__/entry-bootstrap-regression.test.js`:
    - `core/date-core.js` 로드 순서(`time-core` 이후, `script.js` 이전) 검증
  - `__tests__/security-and-rollover-regression.test.js`:
    - 서버 정적 매핑에 `/core/date-core.js` 포함 검증
    - `script.js` 날짜 유틸이 `TimeTrackerDateCore` 우선 사용 검증
