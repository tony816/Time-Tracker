# Time Tracker

Static SPA for day planning, actual activity tracking, timer logging, local persistence, optional Notion activity import, and optional Supabase day sync.

## Start Here

For new contributors or AI agents:

1. `README.md`
2. `docs/product-identity.md`
3. `docs/ai-handoff-map.md`
4. `docs/actual-lock-guardrails.md` only for actual-grid, locking, assigned-duration, locked rows, failed clicks, or extra allocation
5. `docs/docs-index.md` for prompt docs or historical refactor notes

## Product Identity

The app helps a person create high-quality personal data their own AI can understand, trust, reuse, and act on. Prefer data quality, ownership, context fidelity, and exportability over shallow AI-looking behavior.

## Architecture

- `index.html`: SPA shell and browser module order
- `main.js`: bootstraps `window.tracker`
- `script.js`: `TimeTracker`, state owner, DOM refs, wrappers, orchestration
- `core/`: pure helpers
- `controllers/`: interaction/state transitions
- `ui/`: rendering helpers
- `infra/`: storage/infrastructure helpers
- `__tests__/`: `node:test` regression/unit tests

`script.js` is still the hub, but many surfaces have extracted helpers. Read the relevant `core/` or `controllers/` files before changing large `script.js` methods.

## Runtime Load Order

```text
core/*.js -> infra/storage-adapter.js -> ui/*.js -> controllers/*.js -> script.js -> main.js
```

The order matters because modules attach globals consumed by `script.js`.

## Risk Surfaces

- Actual-grid locking, assigned-duration edits, locked rows, failed clicks, and extra allocation are one feature surface.
- Planned selection, merge, inline dropdown, schedule hover button, and undo overlay are tightly coupled.
- Persistence/sync spans in-memory state, local snapshot shape, and optional Supabase day sync.
- Timer behavior spans eligibility, current-slot selection, actual input writes, and rendered controls.

## Commands

```bash
start index.html
python -m http.server 8000
npm start
npm run test:plan-only
npm run test:actual-lock
npm test
```

## Validation Rules

- UI-impacting changes require browser validation with Playwright or equivalent unless explicitly skipped.
- For actual-grid locking/locked rows/assigned-duration/failed clicks/extra allocation:
  - read `docs/actual-lock-guardrails.md`
  - run `npm run test:actual-lock` before `npm test`
  - run the documented browser smoke checks

## Persistence / Sync

Local keys:

- `timesheetData:YYYY-MM-DD`
- `timesheetData:last`
- `tt.dayStartHour`

Optional Supabase table: `timesheet_days`.

## Known Facts

- `server.js` includes optional Telegram/Codex bridge routes. They require `TELEGRAM_BOT_TOKEN` and `CODEX_APP_URL` to be configured before webhook use.
- Some legacy Korean literals/comments are mojibake. Trust ids, data attributes, controller names, and tests over raw displayed text.
- `docs/refactor-stage*.md` are historical rationale, not current source of truth.

## Documentation Map

- `docs/product-identity.md`: product identity and anti-shallow checklist
- `docs/ai-handoff-map.md`: current architecture, read paths, test mapping
- `docs/actual-lock-guardrails.md`: actual-grid checklist
- `docs/codex-token-efficient-prompts.md`: token-efficient Codex prompt guide
- `docs/docs-index.md`: current vs historical doc index
- `docs/high-risk-refactor-plan.md`: completed high-risk refactor record
