# Agent Harness

## Codex Work Loop

Use this harness before changing shared interaction code. Read the relevant paths, make the smallest code change, run the focused test first, then run the broader suite that covers the touched surface.

## Read Path And Test Path

| Surface | Read path | Test path |
| --- | --- | --- |
| Planned editing / selection | `controllers/field-interaction-controller.js` | `__tests__/field-interaction-controller.test.js` |
| Mobile planned segment resize | `controllers/planned-editor-controller.js` | `__tests__/planned-segment-mobile-resize-editor-regression.test.js` |
| Actual-grid lock / legacy guard | `core/actual-grid-core.js` | `__tests__/plan-only-actual-removal.test.js` |
| Persistence / sync | `controllers/persistence-controller.js` | `__tests__/persistence-controller.test.js` |
| Timer | `controllers/timer-controller.js` | `__tests__/timer-controller.test.js` |

Run `npm run test:actual-lock` for the actual-lock legacy guard. Run `npm run test:harness` after editing this document, `docs/harness-quality-score.md`, `AGENTS.md`, `README.md`, `docs/docs-index.md`, `scripts/validate-agent-harness.mjs`, or `__tests__/agent-harness-docs.test.js`.

## Mobile Planned Segment Smoke

Exercise both Desktop viewport and Mobile viewport when a change can affect planned editing. Mobile checks must include the mobile bottom sheet and mobile segment resize.

Required criteria:

- Tap target visibility
- Dropdown/sheet anchoring
- Resize repeatability
- Post-resize suppression

Confirm that the bottom sheet remains anchored to the tapped row after retap, resize handles stay reachable, and post-resize clicks do not reopen stale controls.
