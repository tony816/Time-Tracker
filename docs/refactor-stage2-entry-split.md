# Refactor Stage 2 - Entry Split

## 변경 목표
- `script.js`는 앱 로직(클래스 정의)에 집중한다.
- 앱 시작(부트스트랩) 책임은 `main.js`로 분리한다.

## 적용 내용
- `script.js`
  - `TimeTracker` 클래스 자동 실행 코드 제거
  - 전역 노출만 유지: `window.TimeTracker = TimeTracker;`
- `main.js` 신규 추가
  - 애니메이션 keyframes 스타일 주입
  - DOM 준비 시 `window.tracker = new window.TimeTracker()` 실행
  - 중복 초기화 방지(`window.tracker` 존재 시 스킵)
- `index.html`
  - `script.js` 다음에 `main.js` 로드

## 회귀 방지
- `__tests__/entry-bootstrap-regression.test.js`
  - `script.js`에서 자동 부트스트랩이 제거되었는지 확인
  - `main.js`가 부트스트랩 책임을 갖는지 확인
  - `index.html` 로드 순서(`script.js` -> `main.js`) 확인
