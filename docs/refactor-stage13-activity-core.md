# Refactor Stage 13 - Activity Core Extraction

Purpose: move activity array normalization and summary-string logic into independently testable `core`.

## Changes

- Added `core/activity-core.js`:
  - `formatActivitiesSummary(activities, options)`
  - `normalizeActivitiesArray(raw, options)`
  - `normalizePlanActivitiesArray(raw, options)`
- `script.js`: matching methods prefer `TimeTrackerActivityCore`; fallback kept.
- `index.html`: loads core before `script.js`.
- `server.js`: serves `/core/activity-core.js`.

## Regression Tests

- `__tests__/activity-core.test.js`: exports/global attach, planned/actual array normalization, summary calculation.
- `__tests__/entry-bootstrap-regression.test.js`: load order.
- `__tests__/security-and-rollover-regression.test.js`: server mapping and core-preferred delegation.
