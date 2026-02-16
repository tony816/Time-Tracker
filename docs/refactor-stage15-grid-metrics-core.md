# Refactor Stage 15 - Grid Metrics Core Extraction

## 목표
- `script.js`의 Actual Grid 집계 계산 로직을 `core` 모듈로 분리한다.
- 라벨별 시간/유닛 카운트 맵 계산을 독립 테스트 가능한 순수 함수로 유지한다.

## 적용 내용
- 신규 파일: `core/grid-metrics-core.js`
  - `getActualGridSecondsMap(planUnits, actualUnits, options)`
  - `getActualGridSecondsForLabel(label, options)`
  - `getActualGridUnitCounts(planUnits, actualUnits, options)`
  - `getActualAssignedSecondsMap(activities, options)`
- `script.js`
  - 동일 메서드(`getActualGridSecondsMap`, `getActualGridSecondsForLabel`, `getActualGridUnitCounts`, `getActualAssignedSecondsMap`)를
    `TimeTrackerGridMetricsCore` 우선 위임으로 변경
  - 코어 미탑재 시 기존 fallback 로직 유지
- `index.html`
  - `core/grid-metrics-core.js`를 `script.js` 전에 로드
- `server.js`
  - `/core/grid-metrics-core.js` 정적 파일 매핑/라우트 추가

## 회귀 방지
- 신규 테스트: `__tests__/grid-metrics-core.test.js`
  - export/global attach 검증
  - Actual Grid 초/유닛 집계와 라벨 조회, 배정 초 맵 계산 규칙 검증
- 보강 테스트:
  - `__tests__/entry-bootstrap-regression.test.js`
    - `core/grid-metrics-core.js` 로드 순서 검증
  - `__tests__/security-and-rollover-regression.test.js`
    - 서버 정적 매핑에 `/core/grid-metrics-core.js` 포함 검증
    - `script.js` Grid 집계 유틸의 코어 우선 사용 검증
