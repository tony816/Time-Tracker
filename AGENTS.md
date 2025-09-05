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
