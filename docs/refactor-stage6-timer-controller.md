# Refactor Stage 6 - Timer Controller Split (Eligibility)

## 목표
- 타이머 상호작용의 핵심 판단 로직(시작 가능 여부/차단 사유/버튼 상태)을 컨트롤러로 분리한다.
- `TimeTracker`는 상태 전달과 UI 반영 책임을 유지한다.

## 적용 내용
- 신규 파일: `controllers/timer-controller.js`
  - `resolveTimerEligibility(options)`
  - `getStartBlockReason(state, messages)`
  - `resolveTimerControlState(state, flags, messages)`
- `script.js`
  - `getTimerEligibility(index, slotOverride = null)` 추가
  - `getTimerStartBlockReason(index)`에서 `TimerController` 우선 호출
  - `createTimerControls(index, slot)`에서 `TimerController` 버튼 상태 계산 우선 호출
  - 컨트롤러 미탑재 시 fallback 로직 유지
- `index.html`
  - `controllers/timer-controller.js`를 `script.js` 전에 로드
- `server.js`
  - `/controllers/timer-controller.js` 정적 라우트 추가

## 회귀 방지
- 신규 테스트: `__tests__/timer-controller.test.js`
  - 병합 범위/계획 텍스트 기반 시작 가능 계산 검증
  - 차단 사유 우선순위 검증
  - 시작/일시정지/재개 버튼 상태 검증
- 보강 테스트: `__tests__/security-and-rollover-regression.test.js`
  - 서버 정적 매핑에 timer controller 포함 검증
