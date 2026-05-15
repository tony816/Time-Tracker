# Refactor Stage 9 - Date Core Extraction

Purpose: move pure date/calendar calculations from `script.js` into independently testable `core`.

## Changes

- Added `core/date-core.js`:
  - `parseLocalDateParts(date)`
  - `getDateValue(date)`
  - `compareDateStrings(a, b)`
  - `formatDateFromMsLocal(ms)`
  - `getTodayLocalDateString()`
  - `getLocalSlotStartMs(date, hour)`
  - `getDayOfWeek(date)`
- `script.js`: matching methods prefer `TimeTrackerDateCore`; fallback kept.
- `index.html`: loads `core/date-core.js` before `script.js`.
- `server.js`: serves `/core/date-core.js`.

## Regression Tests

- `__tests__/date-core.test.js`: exports/global attach and date parsing/comparison/format/day/slot calculations.
- `__tests__/entry-bootstrap-regression.test.js`: load order.
- `__tests__/security-and-rollover-regression.test.js`: server mapping and core-preferred delegation.
