# Refactor Stage 14 - Input Format Core Extraction

Purpose: move seconds/minutes/spinner input formatting into independently testable `core`.

## Changes

- Added `core/input-format-core.js`:
  - `formatSecondsForInput(seconds)`
  - `formatMinutesForInput(seconds)`
  - `formatSpinnerValue(kind, seconds)`
- `script.js`: matching methods prefer `TimeTrackerInputFormatCore`; fallback kept.
- `index.html`: loads core before `script.js`.
- `server.js`: serves `/core/input-format-core.js`.

## Regression Tests

- `__tests__/input-format-core.test.js`: exports/global attach, `HH:MM[:SS]`, minute rounding, spinner branching.
- `__tests__/entry-bootstrap-regression.test.js`: load order.
- `__tests__/security-and-rollover-regression.test.js`: server mapping and core-preferred delegation.
