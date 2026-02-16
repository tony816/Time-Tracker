# Refactor Stage 5 - Time Entry Renderer Split

## 목표
- `renderTimeEntries()`의 행 마크업 결정 로직을 별도 렌더러 모듈로 분리한다.
- `TimeTracker`는 DOM 조립/리스너 부착에 집중한다.

## 적용 내용
- 신규 파일: `ui/time-entry-renderer.js`
  - `buildRowRenderModel(options)`
  - `parseMergeRange(mergeKey)`
- `script.js`
  - `buildTimeEntryRowModel(slot, index)` 신규 추가
  - 외부 렌더러(`TimeEntryRenderer`) 우선 호출
  - 렌더러 미탑재 시 fallback 로직 유지
  - `renderTimeEntries()`는 row model 기반 조립으로 단순화
- `index.html`
  - `ui/time-entry-renderer.js`를 `script.js` 전에 로드
- `server.js`
  - `/ui/time-entry-renderer.js` 정적 파일 라우팅 추가

## 회귀 방지
- 신규 테스트: `__tests__/time-entry-renderer.test.js`
  - 비병합/병합 행 렌더 모델 검증
- 보강 테스트: `__tests__/security-and-rollover-regression.test.js`
  - 서버 정적 매핑에 렌더러 파일 포함 검증
