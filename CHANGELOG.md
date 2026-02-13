# CHANGELOG

## 2026-02-13

### Security
- Hardened dynamic field rendering in `script.js` by escaping user-provided values before template insertion (`planned`, `actual`, merged values) to reduce DOM XSS risk.
- Hardened `server.js` with basic security headers and disabled `x-powered-by`.
- Restricted static file serving to an explicit allowlist instead of exposing repository root files.

### Bug Fixes
- Fixed merged actual cap handling in `enforceActualLimit()` so merged field text, `mergedFields`, and per-slot `actual` state stay consistent.
- Fixed analysis metric bug where `recordedSeconds` incorrectly reused `actualSeconds`.
- Added real timer usage aggregation including currently running timers.
- Prevented timer elapsed loss by committing running timers on:
  - date input change
  - prev/next day navigation
  - today navigation
  - clear/reset flow
  - logout / identity loss flow
- Added stale Supabase reapply guards for clear/delete race conditions:
  - ignore realtime apply when date is `clear pending`
  - skip applying fetch results if date changed mid-request

### Server/API
- Added API no-store cache headers.
- Added static file caching policy:
  - HTML: `no-cache`
  - JS/CSS: short immutable cache (`max-age=300`)
- Added explicit `/api` 404 handling.
- Added `require.main === module` guard and exports for helper testing.

### Cleanup
- Removed obvious duplicate constructor assignment (`modalActualHasPlanUnits`).

### Tests
- Added minimal pure utility tests for server helpers in `__tests__/server-utils.test.js`.
- Added date-navigation regression guard test in `__tests__/date-transition-regression.test.js`.
- Added `npm test` script (`node --test __tests__/*.test.js`).

### 2026-02-13 Hotfix (date navigation)
- Added `transitionToDate()` to centralize date switching with pre-switch timer commit.
- Added `persistSnapshotForDate(date, slots, merged)` to persist a committed snapshot against the *previous* date explicitly.
- Updated date input / today button / `changeDate()` to use the centralized transition path.

### 2026-02-13 Overnight hardening

### Stability / Test Infra
- `server.js`에서 `dotenv` 로딩을 `try/catch`로 감싸 `MODULE_NOT_FOUND` 상황에서도 서버/테스트가 즉시 크래시하지 않도록 보완했습니다.

### Core Risk Fixes
- **날짜 전환(자정 롤오버) 리스크**: 타이머 실행 중 날짜가 바뀌면 `updateRunningTimers()`가 오늘 날짜로 `transitionToDate(today)`를 수행하도록 보완해, 실행 중 타이머가 이전 날짜 컨텍스트에 고정되는 문제를 줄였습니다.
- **병합 키/렌더링 리스크**: `normalizeMergeKey()`를 추가해 `planned|actual|time-start-end` 형태와 범위를 검증합니다.
  - `createMergedField()` / `createMergedTimeField()`에서 검증된 키만 렌더링에 사용
  - 손상된/주입된 merge key는 안전한 기본 렌더링으로 폴백
- **XSS 방어 강화(속성 주입면)**: 병합 키를 `data-merge-key`에 넣을 때 원본 문자열이 아니라 정규화된 안전 키만 반영하도록 변경했습니다.

### Tests
- `__tests__/security-and-rollover-regression.test.js` 추가:
  - dotenv 가드 존재 회귀 테스트
  - merge key 정규화 가드 회귀 테스트
  - 자정 롤오버 시 오늘 날짜 전환 로직 회귀 테스트
- `__tests__/script-executable-regression.test.js` 추가(실행형 회귀 테스트):
  - `normalizeMergeKey()` 정상/비정상 key를 실제 실행으로 검증
  - `escapeHtml()` + `createTimerField()`에 XSS 페이로드를 주입해 raw `<script>/<img>`가 출력되지 않는지 검증
  - `updateRunningTimers()`가 자정 롤오버 시 `transitionToDate(today)`를 호출하는지, 실행 타이머가 없으면 인터벌을 중지하는지 검증

## Manual Test Checklist
- [ ] 계획/실제 입력에 `<script>`/따옴표/특수문자 입력 시 화면/속성 깨짐 없이 정상 표시되는지 확인
- [ ] 실제 병합 영역에서 제한 초과 시간 입력 시 병합 시작칸 UI와 상태가 동일하게 clamp 되는지 확인
- [ ] 분석의 `기록된 시간`이 실제 타이머 누적과 일치하는지 확인
- [ ] 타이머 실행 중 날짜 이동(이전/다음/오늘/직접 날짜 선택) 시 경과 시간이 사라지지 않는지 확인
- [ ] 타이머 실행 중 초기화/로그아웃 시 경과 시간이 안전하게 반영되는지 확인
- [ ] 초기화 직후 새로고침/재접속 시 삭제된 데이터가 stale로 다시 올라오지 않는지 확인
- [ ] `server.js` 실행 후 `/server.js` 같은 내부 파일이 직접 노출되지 않는지 확인
