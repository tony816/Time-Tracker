# Refactor Stage 10 - Actual Grid Core Extraction

Purpose: move pure Actual Grid calculations from `script.js` to `core`.

## Changes

- Added `core/actual-grid-core.js`:
  - `getExtraActivityUnitCount(item, stepSeconds)`
  - `getActualGridBlockRange(planUnits, unitIndex, unitsPerRow)`
  - `buildActualUnitsFromActivities(planUnits, activities, options)`
  - `buildActualActivitiesFromGrid(planUnits, actualUnits, options)`
- `script.js`: matching methods prefer `TimeTrackerActualGridCore`; fallback kept.
- `index.html`: loads core before `script.js`.
- `server.js`: serves `/core/actual-grid-core.js`.

## Regression Tests

- `__tests__/actual-grid-core.test.js`: exports/global attach, unit count, block range, grid conversion.
- `__tests__/entry-bootstrap-regression.test.js`: load order.
- `__tests__/security-and-rollover-regression.test.js`: server mapping and core-preferred delegation.
