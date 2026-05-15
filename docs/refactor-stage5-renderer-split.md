# Refactor Stage 5 - Time Entry Renderer Split

Purpose: move `renderTimeEntries()` row model logic into a renderer while `TimeTracker` handles DOM assembly/listeners.

## Changes

- Added `ui/time-entry-renderer.js`:
  - `buildRowRenderModel(options)`
  - `parseMergeRange(mergeKey)`
- `script.js`: added `buildTimeEntryRowModel(slot, index)`, prefers `TimeEntryRenderer`, keeps fallback.
- `index.html`: loads renderer before `script.js`.
- `server.js`: serves `/ui/time-entry-renderer.js`.

## Regression Tests

- `__tests__/time-entry-renderer.test.js`: merged/unmerged row models.
- `__tests__/security-and-rollover-regression.test.js`: server static mapping includes renderer.
