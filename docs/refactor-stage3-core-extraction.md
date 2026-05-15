# Refactor Stage 3 - Core Function Extraction

Purpose: move state/DOM-free time helpers to `core` while `TimeTracker` remains orchestration.

## Changes

- Added `core/time-core.js`:
  - `createEmptyTimeSlots()`
  - `formatSlotTimeLabel(rawHour)`
  - `parseDurationFromText(text, normalizeDurationStep)`
- `script.js`: delegates matching methods to `TimeTrackerCore`.
- `index.html`: loads `core/time-core.js` before `script.js`.

## Regression Test

`__tests__/time-core.test.js` covers exports/global attach, slot generation, time labels, and duration parsing.
