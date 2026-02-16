# Refactor Stage 14 - Input Format Core Extraction

## 목표
- `script.js`의 입력 필드 포맷 유틸을 `core` 모듈로 분리한다.
- 시간(초) 입력/표시 문자열 규칙을 독립 테스트 가능한 순수 함수로 유지한다.

## 적용 내용
- 신규 파일: `core/input-format-core.js`
  - `formatSecondsForInput(seconds)`
  - `formatMinutesForInput(seconds)`
  - `formatSpinnerValue(kind, seconds)`
- `script.js`
  - 동일 메서드(`formatSecondsForInput`, `formatMinutesForInput`, `formatSpinnerValue`)를
    `TimeTrackerInputFormatCore` 우선 위임으로 변경
  - 코어 미탑재 시 기존 fallback 로직 유지
- `index.html`
  - `core/input-format-core.js`를 `script.js` 전에 로드
- `server.js`
  - `/core/input-format-core.js` 정적 파일 매핑/라우트 추가

## 회귀 방지
- 신규 테스트: `__tests__/input-format-core.test.js`
  - export/global attach 검증
  - 입력 포맷(시:분[:초], 분 반올림, spinner 분기) 규칙 검증
- 보강 테스트:
  - `__tests__/entry-bootstrap-regression.test.js`
    - `core/input-format-core.js` 로드 순서 검증
  - `__tests__/security-and-rollover-regression.test.js`
    - 서버 정적 매핑에 `/core/input-format-core.js` 포함 검증
    - `script.js` 입력 포맷 유틸의 코어 우선 사용 검증
