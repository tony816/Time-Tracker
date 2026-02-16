# Refactor Stage 12 - Duration Core Extraction

## 목표
- `script.js`의 시간 포맷/단위 정규화 로직을 `core` 모듈로 분리한다.
- 타이머/활동 시간 계산에서 사용하는 규칙을 독립 테스트 가능한 순수 함수로 유지한다.

## 적용 내용
- 신규 파일: `core/duration-core.js`
  - `formatTime(seconds)`
  - `formatDurationSummary(rawSeconds)`
  - `normalizeDurationStep(seconds)`
  - `normalizeActualDurationStep(seconds, stepSeconds)`
- `script.js`
  - 동일 메서드(`formatTime`, `formatDurationSummary`, `normalizeDurationStep`, `normalizeActualDurationStep`)를
    `TimeTrackerDurationCore` 우선 위임으로 변경
  - 코어 모듈 미탑재 시 기존 fallback 계산 유지
- `index.html`
  - `core/duration-core.js`를 `script.js` 전에 로드
- `server.js`
  - `/core/duration-core.js` 정적 파일 매핑/라우트 추가

## 회귀 방지
- 신규 테스트: `__tests__/duration-core.test.js`
  - export/global attach 검증
  - 시간 포맷/요약/단위 정규화 규칙 검증
- 보강 테스트:
  - `__tests__/entry-bootstrap-regression.test.js`
    - `core/duration-core.js` 로드 순서 검증
  - `__tests__/security-and-rollover-regression.test.js`
    - 서버 정적 매핑에 `/core/duration-core.js` 포함 검증
    - `script.js` 시간 유틸의 코어 우선 사용 검증
