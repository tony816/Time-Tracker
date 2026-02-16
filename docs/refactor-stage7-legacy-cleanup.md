# Refactor Stage 7 - Legacy Schedule Modal Cleanup

## 목표
- 실제 UI에서 제거된 `scheduleModal` 경로의 데드 코드를 정리한다.
- README 문서를 현재 구현(인라인 계획 편집, 저장 키, 서버 역할, Supabase 스키마)과 일치시킨다.

## 적용 내용
- `script.js`
  - `closeScheduleModal()` -> legacy no-op (`false` 반환)
  - `saveScheduleFromModal()` -> legacy no-op (`false` 반환)
  - `attachModalEventListeners()` -> legacy no-op (`false` 반환)
  - `openScheduleModal()`은 기존처럼 인라인 드롭다운 라우팅 유지
- `styles.css`
  - 사용되지 않는 `#scheduleModal .modal-content` 규칙 제거
- `README.md`
  - 계획 입력 설명을 모달 기준에서 인라인 드롭다운 기준으로 수정
  - 데이터 저장 키를 현재 구현(`timesheetData:*`, `tt.dayStartHour`)으로 수정
  - 서버 역할 설명을 Notion 브리지 + 정적 서버로 수정
  - Supabase 예시 스키마를 `timesheet_days` 기반으로 수정

## 회귀 방지
- 신규 테스트: `__tests__/schedule-modal-legacy-regression.test.js`
  - legacy 메서드 no-op 동작 검증
  - `scheduleModal` DOM 의존 제거 검증
