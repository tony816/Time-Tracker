# Refactor Stage 11 - Text Core Extraction

Purpose: move string/security normalization into `core` and keep XSS defense plus merge-key normalization independently testable.

## Changes

- Added `core/text-core.js`:
  - `escapeHtml(text)`
  - `escapeAttribute(text)`
  - `normalizeActivityText(text)`
  - `normalizeMergeKey(rawMergeKey, expectedType, slotCount)`
- `script.js`: matching methods prefer `TimeTrackerTextCore`; fallback kept.
- `index.html`: loads core before `script.js`.
- `server.js`: serves `/core/text-core.js`.

## Regression Tests

- `__tests__/text-core.test.js`: exports/global attach, HTML/attribute escape, activity text, merge key normalization.
- `__tests__/entry-bootstrap-regression.test.js`: load order.
- `__tests__/security-and-rollover-regression.test.js`: server mapping and core-preferred delegation.
