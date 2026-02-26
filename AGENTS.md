# Repository Guidelines

## Project Structure & Module Organization
- Root files: `index.html` (UI), `styles.css` (styles), `script.js` (logic), `README.md` (Korean docs).
- No build system; runs as a static single-page app in the browser.
- Data persistence: `localStorage` per date key like `timesheet_YYYY-MM-DD`.

## Build, Test, and Development Commands
- Run locally (quick): open `index.html` in a browser (`start index.html` on Windows, `open index.html` on macOS).
- Serve locally (optional): `python -m http.server 8000` then visit `http://localhost:8000/`.
- Lint/format: no tooling configured; see style rules below before submitting PRs.

## Coding Style & Naming Conventions
- Indentation: 4 spaces; include semicolons.
- JavaScript: use `const`/`let`, template literals where helpful, camelCase for variables/functions, PascalCase for classes, UPPER_SNAKE_CASE for constants.
- CSS: kebab-case class names (e.g., `.time-entry`, `.today-btn`).
- HTML: keep structure semantic; prefer small, focused elements and data-attributes like `data-index`, `data-type` used in `script.js`.
- Comments: keep short and purposeful; match existing Korean/English mix when useful.

## Testing Guidelines
- No test framework in repo. For additions, prefer lightweight unit tests with Jest + jsdom placed in `__tests__/` and named `*.test.js`.
- Manual checks: open the app, verify time slot rendering, selection/merge behavior, timers (start/pause/stop), and localStorage save/load for multiple dates.

## Commit & Pull Request Guidelines
- Commits: concise, imperative mood; include scope when helpful (e.g., `ui:`, `core:`). Korean or English acceptable. Example: `core: fix timer resume edge case`.
- PRs: include summary, rationale, before/after screenshots or GIFs for UI changes, steps to reproduce/verify, and linked issues.
- Keep PRs small and focused; mention any data migration implications (localStorage keys) and manual test steps.

## Security & Configuration Tips
- localStorage is device-local; avoid storing sensitive data. Clearing browser storage removes entries (key prefix `timesheet_`).
- Ensure changes handle missing/legacy fields safely (e.g., timer/activity objects) as in current compatibility code.
# Repository Guidelines

## Project Structure & Module Organization
- Root SPA (no build system):
  - `index.html` — UI shell, modals.
  - `styles.css` — layout, timer/merge visuals.
  - `script.js` — core logic: time-slot rendering, selection/merge, timers, activity log, schedule modal (multi-select), localStorage.
  - `README.md` — Korean usage docs.
  - `AGENTS.md` — this contributor guide.
- Persistence: `localStorage` per date (`timesheet_YYYY-MM-DD`) and planned activity catalog (`planned_activities`).

## Build, Test, and Development Commands
- Run quickly (open as file):
  - macOS: `open index.html`
  - Windows: `start index.html`
- Serve locally (optional): `python -m http.server 8000` then visit `http://localhost:8000/`.
- Tests (if added): `npx jest` (see Testing Guidelines).

## Coding Style & Naming Conventions
- Indentation: 4 spaces; always use semicolons.
- JavaScript (ES6+): `const`/`let`; camelCase for variables/functions; PascalCase for classes; UPPER_SNAKE_CASE for constants; prefer template literals; avoid one-letter names.
- CSS: kebab-case classes (e.g., `.time-entry`, `.today-btn`, `.timer-result-input`).
- HTML: semantic structure; prefer small, focused elements; use data attributes like `data-index`, `data-type` referenced in `script.js`.
- Comments: short and purposeful (Korean/English both acceptable).

## Testing Guidelines
- No framework preconfigured. If you add tests, use Jest + jsdom.
  - Location: `__tests__/`, filenames `*.test.js`.
  - Scope: unit tests for selection/merge, timer start/pause/stop, localStorage save/load.
- Manual checks: open the app and verify slot rendering, merge behavior, timer controls, and persistence across dates.

## Commit & Pull Request Guidelines
- Commits: concise, imperative; include scope when helpful.
  - Examples: `core: fix timer resume edge case`, `ui: align hover button center`.
- PRs: include summary, rationale, before/after screenshots or GIFs for UI changes, steps to reproduce/verify, and linked issues. Keep PRs small and focused. Note any data migration (e.g., localStorage key changes) and manual test steps.

## Security & Configuration Tips
- Data is device-local via `localStorage`; do not store sensitive information.
- Keys in use: `timesheet_YYYY-MM-DD`, `planned_activities`.
- Maintain compatibility with missing/legacy fields (e.g., timer/activity objects) as done in current code paths.

## Notes for Contributors
- The app is a static single-page app; avoid introducing build steps unless discussed.
- State is kept in-memory plus `localStorage`; merged ranges are tracked via keys like `type-start-end`.

## Vibe Coding Protocol v1
- Follow fixed loop: `request -> impact scan -> small patch -> related tests -> report`.
- Start each session with `npm test`; recover baseline before new tasks.
- Keep patches single-intent and small by default.
- Use `TaskBrief` format for requests: [`docs/templates/task-brief.md`](docs/templates/task-brief.md).
- Use `DoneReport` format for results: [`docs/templates/done-report.md`](docs/templates/done-report.md).
- Protocol reference: [`docs/vibe-coding-protocol-v1.md`](docs/vibe-coding-protocol-v1.md).
- Keep local storage key compatibility for saves: `timesheetData:YYYY-MM-DD`, `timesheetData:last`.
