# Refactor Stage 4 - Storage Adapter

Purpose: move local key/default rules into `infra` so `TimeTracker` does not directly own all `localStorage` access.

## Changes

- Added `infra/storage-adapter.js`:
  - `getDayStartHour`, `setDayStartHour`
  - `getTimesheetData`, `setTimesheetData`, `removeTimesheetData`
  - keys: `tt.dayStartHour`, `timesheetData:YYYY-MM-DD`, `timesheetData:last`
- `script.js`: `loadDayStartHour`, `attachDayStartListeners`, `saveData`, `loadData`, `clearData` prefer `TimeTrackerStorage` and keep fallback.
- `index.html`: loads adapter before `script.js`.

## Regression Test

`__tests__/storage-adapter.test.js` covers day-start normalization and timesheet date/last key save, read, and delete.
