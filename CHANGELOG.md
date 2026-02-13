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
- Added `npm test` script (`node --test __tests__/*.test.js`).

## Manual Test Checklist
- [ ] 계획/실제 입력에 `<script>`/따옴표/특수문자 입력 시 화면/속성 깨짐 없이 정상 표시되는지 확인
- [ ] 실제 병합 영역에서 제한 초과 시간 입력 시 병합 시작칸 UI와 상태가 동일하게 clamp 되는지 확인
- [ ] 분석의 `기록된 시간`이 실제 타이머 누적과 일치하는지 확인
- [ ] 타이머 실행 중 날짜 이동(이전/다음/오늘/직접 날짜 선택) 시 경과 시간이 사라지지 않는지 확인
- [ ] 타이머 실행 중 초기화/로그아웃 시 경과 시간이 안전하게 반영되는지 확인
- [ ] 초기화 직후 새로고침/재접속 시 삭제된 데이터가 stale로 다시 올라오지 않는지 확인
- [ ] `server.js` 실행 후 `/server.js` 같은 내부 파일이 직접 노출되지 않는지 확인
