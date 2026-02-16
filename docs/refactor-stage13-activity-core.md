# Refactor Stage 13 - Activity Core Extraction

## 목표
- `script.js`의 활동 데이터 정규화/요약 문자열 계산 로직을 `core` 모듈로 분리한다.
- 계획/실제 활동 배열 정규화 규칙을 독립 테스트 가능한 순수 함수로 유지한다.

## 적용 내용
- 신규 파일: `core/activity-core.js`
  - `formatActivitiesSummary(activities, options)`
  - `normalizeActivitiesArray(raw, options)`
  - `normalizePlanActivitiesArray(raw, options)`
- `script.js`
  - 동일 메서드(`formatActivitiesSummary`, `normalizeActivitiesArray`, `normalizePlanActivitiesArray`)를
    `TimeTrackerActivityCore` 우선 위임으로 변경
  - 코어 모듈 미탑재 시 기존 fallback 로직 유지
- `index.html`
  - `core/activity-core.js`를 `script.js` 전에 로드
- `server.js`
  - `/core/activity-core.js` 정적 파일 매핑/라우트 추가

## 회귀 방지
- 신규 테스트: `__tests__/activity-core.test.js`
  - export/global attach 검증
  - 활동 배열 정규화(계획/실제) 및 요약 문자열 계산 규칙 검증
- 보강 테스트:
  - `__tests__/entry-bootstrap-regression.test.js`
    - `core/activity-core.js` 로드 순서 검증
  - `__tests__/security-and-rollover-regression.test.js`
    - 서버 정적 매핑에 `/core/activity-core.js` 포함 검증
    - `script.js` 활동 유틸의 코어 우선 사용 검증
