# High-Risk Refactor Record

Status: completed on 2026-03-25. This file is now historical reference, not an active pending plan.

## Completed Items

| Item | Status | Notes |
| --- | --- | --- |
| `Field Interaction Controller` | Completed | Planned-field interaction routing was extracted while keeping actual-grid pointer/lock behavior guarded. |
| `Actual Grid Core` phase 2 | Completed | Effective lock readers, locked-row reconstruction helpers, extra allocation helpers, and related pure helpers were extracted behind wrappers. |
| `Actual Grid Core` phase 3 | Completed | Additional pure split/title/grid segment builders were moved into `core/actual-grid-core.js`. |

## Current Source Of Truth

Use these docs instead of treating this file as a to-do list:

1. `README.md`
2. `docs/ai-handoff-map.md`
3. `docs/actual-lock-guardrails.md`

## What Still Matters From This Record

The execution plan is complete, but the risk rules remain valid:

- preserve behavior first
- isolate helper clusters before moving orchestration
- validate actual-grid changes with `npm run test:actual-lock` before broader testing
- run browser smoke whenever lock masks, rendering, click behavior, or assigned-duration changes can be affected

## Historical Scope Summary

### Completed High-Risk Candidate 1

`Field Interaction Controller`

Completed scope:

- planned field click / drag selection wiring
- merged planned click capture
- row-wide planned click targets
- planned-side hover entry points

Explicitly kept out of the extraction:

- actual-grid long-press lock logic
- actual-grid click blocking
- actual-grid failed-click handling
- assigned-duration recalculation
- extra-slot allocation

### Completed High-Risk Candidate 2

`Actual Grid Core`

Completed scope:

- effective lock mask readers
- locked-row reconstruction helpers
- split/title/grid segment builders
- extra allocation helper extraction
- actual-grid pure/helper clusters moved under `core/actual-grid-core.js`

Explicitly preserved during the extraction:

- UI event rewiring
- modal shell ownership
- save/load schema compatibility
- Supabase protocol behavior

## Invariants That Still Apply

- `sum(non-locked assigned seconds) + sum(locked row seconds) === modalActualTotalSeconds`
- manual lock rows survive recalculation
- auto lock rows are rebuilt from the current deficit only
- locked units reject normal clicks and failed-click toggles
- extra activities never occupy locked units

## Required Validation For Future Actual-Grid Work

Run:

```bash
npm run test:actual-lock
npm test
```

Then run the documented browser smoke in `docs/actual-lock-guardrails.md`.

## Use This File For

- understanding why the high-risk work was staged
- seeing which extraction classes were already completed
- avoiding duplicate plan work on finished refactors

Do not use this file as the primary description of the current architecture.
