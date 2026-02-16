# Refactor Stage 4 - Storage Adapter (Local)

## 목표
- `TimeTracker`가 `localStorage` API를 직접 다루지 않도록 분리 기반을 만든다.
- 저장 키/기본값 규칙을 `infra` 단일 모듈로 모은다.

## 적용 내용
- 신규 파일: `infra/storage-adapter.js`
  - `getDayStartHour`, `setDayStartHour`
  - `getTimesheetData`, `setTimesheetData`, `removeTimesheetData`
  - 키 규칙: `tt.dayStartHour`, `timesheetData:YYYY-MM-DD`, `timesheetData:last`
- `script.js`
  - `loadDayStartHour`, `attachDayStartListeners`, `saveData`, `loadData`, `clearData`에서
    `TimeTrackerStorage`를 우선 호출
  - 어댑터가 없거나 예외가 나면 기존 `localStorage` fallback 유지
- `index.html`
  - `infra/storage-adapter.js`를 `script.js` 전에 로드

## 회귀 방지
- 신규 테스트: `__tests__/storage-adapter.test.js`
  - day-start 정규화/저장 검증
  - timesheet date key + last key 저장/조회/삭제 검증
