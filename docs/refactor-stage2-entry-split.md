# Refactor Stage 2 - Entry Split

Purpose: keep `script.js` focused on app logic and move bootstrap to `main.js`.

## Changes

- `script.js`: removed automatic `TimeTracker` startup; kept `window.TimeTracker = TimeTracker`.
- `main.js`: injects animation keyframes, initializes `window.tracker = new window.TimeTracker()` on DOM ready, skips duplicate init.
- `index.html`: loads `main.js` after `script.js`.

## Regression Test

`__tests__/entry-bootstrap-regression.test.js` verifies no auto-bootstrap in `script.js`, bootstrap ownership in `main.js`, and `script.js -> main.js` load order.
