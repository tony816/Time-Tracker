# Refactor Stage 8 - CSS Split (Structure)

## 목표
- 단일 `styles.css`(3000+ lines) 유지보수 부담을 줄이기 위해 영역별 파일로 분리한다.
- 기존 시각 결과를 유지하면서 로딩 순서와 서버 정적 서빙 경로를 고정한다.

## 적용 내용
- `index.html`
  - 분리 CSS 파일을 직접 `<link>`로 로드하도록 변경
  - 로딩 순서: `foundation -> modal -> interactions -> responsive`
- `styles.css`
  - 호환용 엔트리 파일로 유지 (`@import` 4개)
- 신규 디렉터리: `styles/`
  - `foundation.css`: 기본 레이아웃/그리드
  - `modal.css`: 모달 관련 스타일
  - `interactions.css`: 타이머 및 상호작용 UI 스타일
  - `responsive.css`: 반응형 + UX 패치
- `server.js`
  - `/styles/foundation.css`
  - `/styles/modal.css`
  - `/styles/interactions.css`
  - `/styles/responsive.css`
  - 위 경로를 정적 파일 매핑/라우팅에 추가

## 회귀 방지
- 신규 테스트: `__tests__/styles-split-regression.test.js`
  - `styles.css` import 순서 고정 검증
  - 분리 파일 존재 및 섹션 앵커(comment) 검증
- 보강 테스트: `__tests__/security-and-rollover-regression.test.js`
  - 서버 정적 매핑에 분리 CSS 경로 포함 검증
