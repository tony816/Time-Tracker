# Refactor Stage 12 - Duration Core Extraction

Purpose: move duration formatting and step normalization into independently testable `core`.

## Changes

- Added `core/duration-core.js`:
  - `formatTime(seconds)`
  - `formatDurationSummary(rawSeconds)`
  - `normalizeDurationStep(seconds)`
  - `normalizeActualDurationStep(seconds, stepSeconds)`
- `script.js`: matching methods prefer `TimeTrackerDurationCore`; fallback kept.
- `index.html`: loads core before `script.js`.
- `server.js`: serves `/core/duration-core.js`.

## Regression Tests

- `__tests__/duration-core.test.js`: exports/global attach, formatting, summary, step normalization.
- `__tests__/entry-bootstrap-regression.test.js`: load order.
- `__tests__/security-and-rollover-regression.test.js`: server mapping and core-preferred delegation.
