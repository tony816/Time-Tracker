# Refactor Stage 8 - CSS Split

Purpose: split large `styles.css` by area while preserving visual output, load order, and static serving.

## Changes

- `index.html`: directly loads split CSS in order: `foundation -> modal -> interactions -> responsive`.
- `styles.css`: compatibility entry with four `@import`s.
- Added `styles/`:
  - `foundation.css`: base layout/grid
  - `modal.css`: modal styles
  - `interactions.css`: timer/interaction UI
  - `responsive.css`: responsive and UX patches
- `server.js`: serves all split CSS paths.

## Regression Tests

- `__tests__/styles-split-regression.test.js`: import order, file presence, section anchors.
- `__tests__/security-and-rollover-regression.test.js`: server mapping includes split CSS.
