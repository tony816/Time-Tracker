# Refactor Stage 15 - Grid Metrics Core Extraction

Purpose: move Actual Grid aggregate calculations into independently testable `core`.

## Changes

- Added `core/grid-metrics-core.js`:
  - `getActualGridSecondsMap(planUnits, actualUnits, options)`
  - `getActualGridSecondsForLabel(label, options)`
  - `getActualGridUnitCounts(planUnits, actualUnits, options)`
  - `getActualAssignedSecondsMap(activities, options)`
- `script.js`: matching methods prefer `TimeTrackerGridMetricsCore`; fallback kept.
- `index.html`: loads core before `script.js`.
- `server.js`: serves `/core/grid-metrics-core.js`.

## Regression Tests

- `__tests__/grid-metrics-core.test.js`: exports/global attach, seconds/unit aggregation, label lookup, assigned seconds map.
- `__tests__/entry-bootstrap-regression.test.js`: load order.
- `__tests__/security-and-rollover-regression.test.js`: server mapping and core-preferred delegation.
