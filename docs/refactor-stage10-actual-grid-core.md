# Refactor Stage 10 - Actual Grid Core Extraction

## 목표
- `script.js`의 Actual Grid 계산 로직 중 순수 함수 4개를 `core` 모듈로 분리한다.
- UI/DOM 의존 없는 계산을 독립 테스트 가능하게 만든다.

## 적용 내용
- 신규 파일: `core/actual-grid-core.js`
  - `getExtraActivityUnitCount(item, stepSeconds)`
  - `getActualGridBlockRange(planUnits, unitIndex, unitsPerRow)`
  - `buildActualUnitsFromActivities(planUnits, activities, options)`
  - `buildActualActivitiesFromGrid(planUnits, actualUnits, options)`
- `script.js`
  - 위 4개 메서드를 `TimeTrackerActualGridCore` 우선 위임으로 변경
  - 코어 모듈 미탑재 시 기존 fallback 계산 유지
- `index.html`
  - `core/actual-grid-core.js`를 `script.js` 전에 로드
- `server.js`
  - `/core/actual-grid-core.js` 정적 파일 매핑/라우트 추가

## 회귀 방지
- 신규 테스트: `__tests__/actual-grid-core.test.js`
  - export/global attach 검증
  - 단위 수 계산/블록 범위/그리드 변환 규칙 검증
- 보강 테스트:
  - `__tests__/entry-bootstrap-regression.test.js`
    - `core/actual-grid-core.js` 로드 순서 검증
  - `__tests__/security-and-rollover-regression.test.js`
    - 서버 정적 매핑에 `/core/actual-grid-core.js` 포함 검증
    - `script.js` Actual Grid 메서드의 코어 우선 사용 검증
