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

## Testing Guidelines
- Current baseline uses `node:test` under `__tests__/`.
- Add tests near related coverage and keep naming `*.test.js`.
- For behavior changes, run related tests first, then run full suite with `npm test`.
- Manual checks for UI-impact changes:
  - slot rendering
  - selection/merge/split behavior
  - timer start/pause/stop
  - date transition
  - save/load persistence

## Commit & Pull Request Guidelines
- Commits: concise imperative subject; optional scope prefix (`core:`, `ui:`, etc.).
- PRs should include:
  - summary and rationale
  - validation steps
  - screenshots/GIFs for UI changes
  - data compatibility notes when storage schema/keys change
- Keep PRs small and focused.

## Security & Compatibility Tips
- `localStorage` is device-local; do not store sensitive data.
- Keep compatibility with legacy/missing fields in timer/activity objects.
- If save/load behavior changes, update code, tests, and docs together.
- Keep local key compatibility: `timesheetData:YYYY-MM-DD`, `timesheetData:last`.

## Notes for Contributors
- This is a static SPA; avoid introducing build tooling unless discussed.
- Keep patches small and single-intent when possible.
- State is in-memory plus `localStorage`; merged ranges use keys like `type-start-end`.

## Vibe Coding Protocol v1
- Fixed loop: `request -> impact scan -> small patch -> related tests -> report`.
- Start each session with `npm test`; recover baseline before new feature work.
- Use request template: [`docs/templates/task-brief.md`](docs/templates/task-brief.md).
- Use result template: [`docs/templates/done-report.md`](docs/templates/done-report.md).
- Full protocol: [`docs/vibe-coding-protocol-v1.md`](docs/vibe-coding-protocol-v1.md).
