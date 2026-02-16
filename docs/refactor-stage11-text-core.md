# Refactor Stage 11 - Text Core Extraction

## 목표
- `script.js`에 흩어져 있던 문자열/보안 정규화 유틸을 `core` 모듈로 분리한다.
- XSS 방어와 병합 키 정규화 규칙을 독립 테스트 가능한 순수 함수로 유지한다.

## 적용 내용
- 신규 파일: `core/text-core.js`
  - `escapeHtml(text)`
  - `escapeAttribute(text)`
  - `normalizeActivityText(text)`
  - `normalizeMergeKey(rawMergeKey, expectedType, slotCount)`
- `script.js`
  - `escapeHtml`, `escapeAttribute`, `normalizeMergeKey`, `normalizeActivityText`를
    `TimeTrackerTextCore` 우선 위임으로 변경
  - 코어 미탑재 시 기존 fallback 로직 유지
- `index.html`
  - `core/text-core.js`를 `script.js` 전에 로드
- `server.js`
  - `/core/text-core.js` 정적 파일 매핑/라우트 추가

## 회귀 방지
- 신규 테스트: `__tests__/text-core.test.js`
  - export/global attach 검증
  - HTML escape/활동 텍스트 정규화/merge key 정규화 검증
- 보강 테스트:
  - `__tests__/entry-bootstrap-regression.test.js`
    - `core/text-core.js` 로드 순서 검증
  - `__tests__/security-and-rollover-regression.test.js`
    - 서버 정적 매핑에 `/core/text-core.js` 포함 검증
    - `script.js` 문자열 유틸의 코어 우선 사용 검증
