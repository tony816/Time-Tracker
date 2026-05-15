# Refactor Stage 7 - Legacy Schedule Modal Cleanup

Purpose: remove dead `scheduleModal` path and align README with current inline planning/storage/server/Supabase behavior.

## Changes

- `script.js`: `closeScheduleModal`, `saveScheduleFromModal`, and `attachModalEventListeners` became legacy no-ops returning `false`; `openScheduleModal` still routes to inline dropdown.
- `styles.css`: removed unused `#scheduleModal .modal-content`.
- `README.md`: updated planning UI, storage keys, server role, and `timesheet_days` Supabase schema notes.

## Regression Test

`__tests__/schedule-modal-legacy-regression.test.js` verifies legacy no-op methods and removal of `scheduleModal` DOM dependency.
