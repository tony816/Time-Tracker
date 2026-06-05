# Agent Harness

Use this harness to move from investigation to edit to verification with the fewest useful files in context. It is a routing document, not a replacement for the source code or tests.

## Codex Work Loop

1. State check: record branch, HEAD, and `git status --short`.
2. Minimal doc loading: start with `AGENTS.md`, `README.md`, and this file; use `docs/docs-index.md` only when the task surface is unclear.
3. Risk surface: name the touched feature surface before editing. If one item in a coupled surface is touched, treat the whole surface as in scope for verification.
4. Repro and verification plan: pick the smallest failing or risky scenario, then map it to targeted tests and any browser smoke.
5. Implementation: read the extracted helper first (`core/`, `controllers/`, `ui/`, `infra/`) before changing a large `script.js` method.
6. Targeted test: run the mapped test command or the smallest matching `node --test` file first.
7. Full test: run `npm test`; add `npm run test:actual-lock` first for actual-grid locking work.
8. Short report: list changed files, validation results, and at most three residual risks.

Ask the user only when the target behavior, compatibility tradeoff, or data migration choice cannot be inferred from repo-local docs, tests, or current product identity.

## Read Path And Test Path

| Surface | Minimal read path | Targeted test path | Full/extra verification |
| --- | --- | --- | --- |
| Planned editing / selection | `controllers/field-interaction-controller.js`, `controllers/selection-overlay-controller.js`, `controllers/inline-plan-dropdown-controller.js`, `controllers/planned-editor-controller.js`, `controllers/time-entry-render-controller.js` | `node --test __tests__/planned-merge-selection-regression.test.js __tests__/planned-inline-dropdown-toggle-regression.test.js __tests__/selection-overlay-controller.test.js __tests__/inline-plan-dropdown-controller.test.js` | `npm test`; browser smoke for any visible planned-grid behavior |
| Mobile planned segment resize | `controllers/field-interaction-controller.js`, `controllers/inline-plan-dropdown-controller.js`, `controllers/planned-editor-controller.js`, `controllers/time-entry-render-controller.js`, related planned segment tests | `node --test __tests__/planned-segment-mobile-resize-editor-regression.test.js __tests__/planned-segment-mobile-tap-intent.test.js __tests__/inline-plan-mobile-zoom-regression.test.js __tests__/inline-plan-focus-jump-regression.test.js` | Desktop + mobile browser smoke; verify resize handle repeatability and accidental dropdown suppression |
| Actual-grid lock / legacy guard | `docs/actual-lock-guardrails.md`, `core/actual-grid-core.js`, `controllers/actual-modal-controller.js`, `controllers/time-entry-render-controller.js` | `npm run test:actual-lock` | `npm test`; browser smoke from `docs/actual-lock-guardrails.md` |
| Persistence / sync | `core/timesheet-state-core.js`, `controllers/persistence-controller.js`, `infra/storage-adapter.js`, `controllers/supabase-sync-controller.js` | `node --test __tests__/persistence-controller.test.js __tests__/storage-adapter.test.js __tests__/timesheet-state-core.test.js __tests__/supabase-sync-controller.test.js` | `npm test`; browser save/load smoke if UI or localStorage shape changes |
| Timer | `controllers/timer-controller.js`, `controllers/actual-input-controller.js`, `ui/time-control-renderer.js` | `node --test __tests__/timer-controller.test.js __tests__/actual-input-controller.test.js __tests__/time-control-renderer.test.js` | `npm test`; browser smoke if controls or rendered state change |
| Product / UX decision | `docs/product-identity.md`, then the surface-specific read path | Matching targeted tests for the touched surface | Browser smoke for visible UI behavior |
| Harness docs / validation | `docs/agent-harness.md`, `docs/harness-quality-score.md`, `docs/docs-index.md`, `AGENTS.md`, `README.md`, `package.json` | `npm run test:harness` | `npm test` |

## Mobile Planned Segment Risk Surface

Treat planned selection, merge, inline dropdown, mobile bottom sheet, and mobile segment resize as one coupled surface. Changes in one can change tap intent, focus behavior, or editor anchoring in the others.

Known risk checks:

- Tap target visibility: resize handles and dropdown triggers remain visible and reachable in mobile viewport.
- Dropdown/sheet anchoring: inline dropdown on desktop and bottom sheet on mobile stay attached to the intended segment after scroll or resize.
- Resize repeatability: dragging the same handle multiple times changes duration predictably without jumping focus.
- Post-resize suppression: the tap or pointer sequence that finishes resize must not immediately open the dropdown or editor by accident.
- Selection integrity: merge selection, hover controls, title editing, and undo overlay keep the intended segment identity.

## Browser Smoke For UI Changes

Use browser smoke when a change can alter layout, visible controls, pointer behavior, focus, local save/load, or actual-grid graphics. Start with:

```bash
python -m http.server 8000
```

Minimum viewport coverage:

- Desktop viewport: planned grid can select, edit, dropdown, and merge without overlapping controls.
- Mobile viewport: tap target is visible; bottom sheet opens for the intended segment; resize handles can be dragged repeatedly.
- Anchoring: dropdown or sheet remains aligned after scroll, segment resize, and close/reopen.
- Resize finish: after resizing a planned segment, the next accidental click suppression prevents an unintended dropdown/editor open.
- Actual-grid work: also run the scenarios in `docs/actual-lock-guardrails.md`.

If browser smoke is skipped, say who skipped it or why it was not applicable in the final report.

## Reporting Template

Keep the final report short:

- Changed files.
- Failure type the harness now prevents.
- Validation commands and results.
- Residual risks, maximum three.
