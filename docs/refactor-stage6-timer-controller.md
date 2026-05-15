# Refactor Stage 6 - Timer Controller Split

Purpose: extract timer eligibility, block reason, and button-state decisions while `TimeTracker` keeps state passing and UI application.

## Changes

- Added `controllers/timer-controller.js`:
  - `resolveTimerEligibility(options)`
  - `getStartBlockReason(state, messages)`
  - `resolveTimerControlState(state, flags, messages)`
- `script.js`: added `getTimerEligibility`; `getTimerStartBlockReason` and `createTimerControls` prefer `TimerController`; fallback kept.
- `index.html`: loads controller before `script.js`.
- `server.js`: serves `/controllers/timer-controller.js`.

## Regression Tests

- `__tests__/timer-controller.test.js`: merge/planned-text eligibility, block priority, start/pause/resume state.
- `__tests__/security-and-rollover-regression.test.js`: server static mapping includes timer controller.
