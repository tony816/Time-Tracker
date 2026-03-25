# Time Tracker

Static single-page timesheet app for day planning, actual activity tracking, timer logging, local persistence, optional Notion activity import, and optional Supabase day sync.

## Start Here

If you are a new contributor or an AI agent, read in this order:

1. `README.md`
2. `docs/ai-handoff-map.md`
3. `docs/actual-lock-guardrails.md` if the task touches actual-grid, locking, assigned-duration edits, locked rows, failed clicks, or extra allocation
4. `docs/docs-index.md` if you need refactor history or older stage notes

## Current Architecture

- `index.html`: loads the SPA shell and the browser-side module order
- `main.js`: bootstraps `window.tracker`
- `script.js`: defines `TimeTracker`, owns app state, DOM references, wrappers, and remaining orchestration glue
- `core/`: extracted pure helpers
- `controllers/`: interaction and state transition logic
- `ui/`: rendering helpers
- `infra/`: storage adapters and infrastructure-facing helpers
- `__tests__/`: `node:test` regression and unit tests

The codebase has already been split substantially, but `script.js` is still the main state and wiring hub. Do not start large refactors from `script.js` alone. Read the relevant controller/core modules first.

## Runtime Load Order

`index.html` loads browser modules in this order:

1. `core/*.js`
2. `infra/storage-adapter.js`
3. `ui/*.js`
4. `controllers/*.js`
5. `script.js`
6. `main.js`

That order matters because `script.js` uses globals attached by the previously loaded modules.

## Key Risk Surfaces

- Actual-grid locking, assigned-duration edits, locked rows, failed clicks, and extra allocation are one feature surface.
- Planned selection, merge, inline dropdown, schedule hover button, and undo overlay are tightly coupled.
- Persistence and sync span in-memory state, local snapshot shape, and optional Supabase day sync.
- Timer behavior spans timer eligibility, current-slot selection, actual input writes, and rendered control state.

## Validation Commands

Quick run:

```bash
start index.html
```

Static server:

```bash
python -m http.server 8000
```

Optional Node server:

```bash
npm start
```

Tests:

```bash
npm run test:actual-lock
npm test
```

## Validation Rules

- For UI-impacting changes, browser validation is required.
- Use Playwright or equivalent browser automation unless the user explicitly says not to.
- If the task touches actual-grid locking, locked rows, assigned-duration changes, failed clicks, or extra allocation:
  - read `docs/actual-lock-guardrails.md`
  - run `npm run test:actual-lock` before `npm test`
  - run the documented browser smoke checks

## Persistence / Sync Facts

Local keys:

- `timesheetData:YYYY-MM-DD`
- `timesheetData:last`
- `tt.dayStartHour`

Optional remote table:

- `timesheet_days` in Supabase

## Known Repository Facts

- `server.js` still imports Telegram bridge modules that are not present in the current repository state. Until that mismatch is reconciled, `npm start` and the full `npm test` suite can fail on bridge-related paths.
- Some legacy Korean literals and comments in `index.html`, `server.js`, and older files are mojibake. When tracing behavior, trust element ids, data attributes, controller names, and tests more than raw displayed text.
- Historical refactor stage notes in `docs/refactor-stage*.md` are useful for rationale, but they are not the current source of truth.

## Documentation Map

- `docs/ai-handoff-map.md`: current architecture, module inventory, read order, and test mapping
- `docs/actual-lock-guardrails.md`: non-negotiable checklist for actual-grid work
- `docs/high-risk-refactor-plan.md`: completed high-risk refactor record
- `docs/docs-index.md`: current-vs-historical document index
