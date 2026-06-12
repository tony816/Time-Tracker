# Harness Quality Score

This scorecard grades each feature surface by how quickly a future Codex session can find the right files, understand the risks, reproduce behavior, verify a fix, and report honestly.

## Rating Criteria

| Grade | Codex-readability bar |
| --- | --- |
| A | Clear entry doc, mapped tests, concrete repro or smoke steps, known risks, and little missing harness. |
| B | Entry doc and tests exist, but repro or smoke detail is partial. |
| C | Some tests or docs exist, but a future agent must infer major risk or reproduction details from code. |
| D | No reliable entry path, test mapping, or smoke procedure. |

## Surface Scores

| Surface | Grade | Entry document | Related tests | Repro / smoke | Known risks | Missing harness |
| --- | --- | --- | --- | --- | --- | --- |
| Planned editing / selection | B | `docs/agent-harness.md`, `docs/ai-handoff-map.md` | Planned merge, inline dropdown, overlay, editor, tap-intent tests | Browser smoke now defined in `docs/agent-harness.md` | Selection identity, dropdown anchoring, undo overlay, hover controls | A short scripted browser smoke would move this to A |
| Mobile segment resize | B | `docs/agent-harness.md` | Mobile resize editor, tap intent, mobile zoom, focus jump tests | Mobile viewport smoke now defined | Resize finish can trigger unintended editor/dropdown; handle visibility can regress | No automated browser smoke for resize gestures |
| Persistence / sync | B | `docs/agent-harness.md`, `docs/ai-handoff-map.md` | Persistence, storage adapter, timesheet state, Supabase sync tests | Save/load smoke recommended when storage shape changes | Local key compatibility, legacy/missing timer/activity fields, optional Supabase shape | Need explicit storage fixture matrix for older snapshots |
| Actual-lock legacy guard | B | `docs/actual-lock-guardrails.md`, `docs/agent-harness.md` | `npm run test:actual-lock` currently aliases plan-only removal; `__tests__/actual-grid-core.test.js` has partial lock/extra helper coverage; `npm test` | Concrete browser scenarios in `docs/actual-lock-guardrails.md` | Effective mask drift, legacy/manual/auto lock confusion, extra allocation into locked units | No dedicated actual-grid lock/locked-row/extra-allocation targeted suite; browser smoke remains manual |
| Timer | B | `docs/agent-harness.md`, `docs/ai-handoff-map.md` | Timer controller, plan segment timer core, time control renderer tests | Browser smoke recommended for rendered control changes | Eligibility, current-slot choice, elapsed-time persistence, displayed controls | Need one end-to-end timer smoke checklist |

## Maintenance Rules

- Update this scorecard when adding a new high-risk surface, a new targeted test path, or a new manual smoke procedure.
- If a surface is graded C or D, prefer adding a small test, fixture, or smoke checklist before adding more prose.
- `npm run test:harness` must confirm this document exists and stays linked from `AGENTS.md`, `README.md`, and `docs/docs-index.md`.
