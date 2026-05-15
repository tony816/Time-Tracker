# High-Risk Refactor Record

Status: completed on 2026-03-25. Historical reference only; do not treat as an active plan.

## Completed Work

| Item | Result |
| --- | --- |
| Field Interaction Controller | Planned click/drag/merge/hover routing extracted while keeping actual-grid pointer/lock behavior guarded. |
| Actual Grid Core phase 2 | Effective lock readers, locked-row reconstruction, extra allocation helpers, and related pure helpers extracted behind wrappers. |
| Actual Grid Core phase 3 | Additional pure split/title/grid segment builders moved into `core/actual-grid-core.js`. |

## Current Source Of Truth

Use:

1. `README.md`
2. `docs/ai-handoff-map.md`
3. `docs/actual-lock-guardrails.md`

## Still-Relevant Rules

- Preserve behavior first.
- Isolate helper clusters before moving orchestration.
- For actual-grid changes, run `npm run test:actual-lock` before `npm test`.
- Run browser smoke when lock masks, rendering, click behavior, assigned-duration, or extra allocation can change.

## Historical Scope

Field interaction extraction included planned field click/drag selection, merged planned click capture, row-wide planned targets, and planned-side hover entry points. It intentionally excluded actual-grid long-press lock, click blocking, failed-click handling, assigned-duration recalculation, and extra-slot allocation.

Actual Grid Core extraction included effective lock mask readers, locked-row reconstruction, split/title/grid segment builders, extra allocation helpers, and pure/helper clusters under `core/actual-grid-core.js`. It preserved UI event wiring, modal shell ownership, save/load schema compatibility, and Supabase protocol behavior.

## Invariants

- `sum(non-locked assigned seconds) + sum(locked row seconds) === modalActualTotalSeconds`
- manual lock rows survive recalculation
- auto lock rows are rebuilt from current deficit only
- locked units reject normal clicks and failed-click toggles
- extra activities never occupy locked units

Use this file only to understand staging rationale, completed extraction scope, or historical boundaries.
