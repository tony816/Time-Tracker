# Repository Guidelines

## Project Structure & Module Organization
- Root SPA files:
  - `index.html`: UI shell and modals.
  - `styles.css`: style entrypoint (`styles/` split files imported).
  - `script.js`: main app logic.
  - `main.js`: bootstrap entry.
  - `README.md`: usage and integration notes.
- Modular folders:
  - `core/`: extracted pure helpers.
  - `controllers/`: controller logic (timer, etc.).
  - `infra/`: storage adapters and infra utilities.
  - `ui/`: rendering helpers.
  - `functions/`: optional API endpoints.
  - `__tests__/`: node:test regression/unit tests.
- Persistence keys (local):
  - `timesheetData:YYYY-MM-DD`
  - `timesheetData:last`
  - `tt.dayStartHour`
- Optional remote sync table: `timesheet_days` (Supabase).

## Build, Test, and Development Commands
- Quick run:
  - macOS: `open index.html`
  - Windows: `start index.html`
- Static server (optional): `python -m http.server 8000`
- Optional bridge server: `npm start` (runs `server.js`)
- Test suite: `npm test` (`node --test __tests__/*.test.js`)
- No build step and no formatter configured by default.

## Coding Style & Naming Conventions
- Indentation: 4 spaces.
- JavaScript: always use semicolons, prefer `const`/`let`, camelCase for variables/functions, PascalCase for classes, UPPER_SNAKE_CASE for constants.
- CSS: kebab-case class names.
- HTML: semantic structure and focused elements; use `data-*` attributes consumed by `script.js`.
- Comments: short and purposeful (Korean/English allowed).


## Commit & Pull Request Guidelines
- Commits: concise imperative subject; optional scope prefix (`core:`, `ui:`, etc.).
- PRs should include:
  - summary and rationale
  - validation steps
  - screenshots/GIFs for UI changes
  - data compatibility notes when storage schema/keys change
- Keep PRs small and focused.

## Actual Lock Guardrail
- When a task touches actual-grid locking, locked rows, assigned-duration changes, or extra-slot allocation, treat them as one feature surface.
- Before editing, explicitly list the affected surfaces in the refined prompt.
- Use [docs/actual-lock-guardrails.md](/C:/Time-Tracker/docs/actual-lock-guardrails.md) as the required checklist.
- For those tasks, you MUST run `npm run test:actual-lock` before `npm test`.
- If the change can affect UI behavior, you MUST also run the documented browser smoke check unless the user explicitly tells you not to.
- Do not close the task after only fixing row data; verify row generation, effective lock mask, grid graphics, click blocking, and extra allocation together.

## Token-Efficient Doc Loading
- Do not preload every Markdown file in `docs/` for routine tasks.
- Start with `docs/docs-index.md` only when document selection is needed, then open the smallest relevant source document.
- Read `docs/ai-handoff-map.md` only when current architecture context is needed.
- Read `docs/product-identity.md` only for product direction, UX, or feature decision work.
- Read `docs/actual-lock-guardrails.md` only for actual-grid locking, locked rows, assigned-duration, or extra-slot allocation work.
- Read `docs/refactor-stage*.md` and `docs/high-risk-refactor-plan.md` only when investigating historical boundaries or prior refactor decisions.
- Use `docs/codex-token-efficient-prompts.md` as the prompt/AI setting guide, not as required context for every coding task.

## Security & Compatibility Tips
- `localStorage` is device-local; do not store sensitive data.
- Keep compatibility with legacy/missing fields in timer/activity objects.
- If save/load behavior changes, update code, tests, and docs together.
- Keep local key compatibility: `timesheetData:YYYY-MM-DD`, `timesheetData:last`.

## Notes for Contributors
- This is a static SPA; avoid introducing build tooling unless discussed.
- Keep patches small and single-intent when possible.
- State is in-memory plus `localStorage`; merged ranges use keys like `type-start-end`.




