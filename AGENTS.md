# Repository Guidelines

## Structure

- Root SPA: `index.html`, `styles.css`, `script.js`, `main.js`, `README.md`
- Modules: `core/`, `controllers/`, `infra/`, `ui/`, `functions/`, `__tests__/`
- Local keys: `timesheetData:YYYY-MM-DD`, `timesheetData:last`, `tt.dayStartHour`
- Optional Supabase table: `timesheet_days`

## Commands

- Quick run: Windows `start index.html`, macOS `open index.html`
- Static server: `python -m http.server 8000`
- Optional bridge server: `npm start`
- Tests: `npm test` (`node --test __tests__/*.test.js`)
- No build step or formatter is configured.

## Style

- 4-space indentation.
- JavaScript: semicolons, `const`/`let`, camelCase functions/vars, PascalCase classes, UPPER_SNAKE_CASE constants.
- CSS: kebab-case classes.
- HTML: semantic structure, focused elements, `data-*` attributes consumed by `script.js`.
- Comments: short and purposeful; Korean/English allowed.

## Commits / PRs

- Commits: concise imperative subject; optional scope prefix such as `core:` or `ui:`.
- PRs: summary/rationale, validation steps, screenshots/GIFs for UI changes, data compatibility notes for storage/schema changes.
- Keep patches small and focused.

## Agent Harness

- Use `docs/agent-harness.md` for the Codex work loop, read path/test path table, mobile planned segment risk surface, and UI smoke rules.
- Use `docs/harness-quality-score.md` when improving the repo-local harness or judging missing docs/tests/smoke coverage.
- Harness changes must run `npm run test:harness` before `npm test`.
- Planned selection, merge, inline dropdown, mobile bottom sheet, and mobile segment resize are one coupled surface; use the mapped targeted tests in `docs/agent-harness.md`.

## Actual Lock Guardrail

When a task touches actual-grid locking, locked rows, assigned-duration changes, or extra-slot allocation, treat them as one feature surface.

- Before editing, list affected surfaces in the refined prompt.
- Use `docs/actual-lock-guardrails.md`.
- Run `npm run test:actual-lock` before `npm test`.
- If UI behavior can change, run the documented browser smoke check unless explicitly skipped.
- Verify row generation, effective lock mask, grid graphics, click blocking, and extra allocation together.

## Token-Efficient Doc Loading

- Do not preload every Markdown file in `docs/` for routine tasks.
- Use `docs/docs-index.md` only when document selection is needed, then open the smallest relevant source document.
- Read `docs/agent-harness.md` when choosing work loop, risk surface, tests, or smoke checks.
- Read `docs/harness-quality-score.md` only for harness quality or missing coverage decisions.
- Read `docs/ai-handoff-map.md` only for architecture context.
- Read `docs/product-identity.md` only for product direction, UX, or feature decisions.
- Read `docs/actual-lock-guardrails.md` only for actual-grid locking, locked rows, assigned-duration, or extra allocation.
- Read `docs/refactor-stage*.md` and `docs/high-risk-refactor-plan.md` only for historical boundaries or prior refactor decisions.
- Use `docs/codex-token-efficient-prompts.md` as prompt/AI setting guidance, not required context for every coding task.

## Security / Compatibility

- `localStorage` is device-local; do not store sensitive data.
- Keep compatibility with legacy/missing timer/activity fields.
- If save/load behavior changes, update code, tests, and docs together.
- Preserve local key compatibility.

## Contributor Notes

- Static SPA; avoid adding build tooling unless discussed.
- State is in-memory plus `localStorage`; merged ranges use keys like `type-start-end`.
