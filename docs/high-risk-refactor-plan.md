# High-Risk Refactor Plan

This document defines the execution plan for the two deferred high-risk refactor candidates:

1. `Field Interaction Controller`
2. `Actual Grid Core` phase 2

The primary goal is preserving current behavior while reducing `script.js` safely.

## Candidate 1: Field Interaction Controller

### Scope
- Planned field click / drag / long-press selection wiring
- Merged planned click capture
- Row-wide planned click targets
- Hover button orchestration for planned cells
- Actual-column hover entry points only if they are strictly wiring-level

### Explicitly Out of Scope
- Actual-grid long-press lock logic
- Actual-grid click blocking
- Actual-grid failed click handling
- Assigned-duration recalculation
- Extra-slot allocation

### Required Preconditions
- Current controller extraction branch is green on `npm test`
- Inline dropdown / selection overlay regressions are green
- Existing behavior map is updated before edits begin

### Phase Plan
1. Map event sources and current consumers
2. Extract planned-only interaction routing into a controller
3. Keep actual-grid pointer handlers in `script.js`
4. Re-run planned selection and inline dropdown regressions
5. Run browser smoke for planned selection, merge, same-slot toggle, and hover buttons

### Required Tests
- `npm test`
- Targeted regressions:
  - `__tests__/planned-inline-dropdown-toggle-regression.test.js`
  - `__tests__/planned-merge-selection-regression.test.js`
  - `__tests__/selection-overlay-controller.test.js`
  - `__tests__/inline-plan-dropdown-controller.test.js`

### Required Browser Smoke
- Single planned slot click opens inline dropdown
- Same-slot re-click closes dropdown without reopening
- Drag selection expands planned range correctly
- Merged planned range click opens at the merged anchor
- Hover schedule button shows and hides without leaving stale buttons

### Stop Conditions
- Any regression in same-slot toggle close
- Any regression in merged planned click reopen suppression
- Any stale floating schedule/undo/merge button after selection clear

## Candidate 2: Actual Grid Core Phase 2

### Scope
- Additional extraction of actual-grid pure/helper logic only
- Effective lock mask readers
- Split segment computation helpers
- Extra allocation helper extraction
- Grid clamp / reconstruction helpers

### Explicitly Out of Scope
- UI event rewiring
- Modal shell / list rendering
- Save/load schema changes
- Supabase protocol changes

### Required Guardrail
- [actual-lock-guardrails.md](/C:/Time-Tracker/docs/actual-lock-guardrails.md) is mandatory

### Impact Surfaces To Treat As One Feature
- Locked row classification
- Effective lock mask
- Assigned-duration edits
- Locked row regeneration
- Grid graphics
- Click blocking
- Failed-click behavior
- Extra-slot allocation

### Phase Plan
1. Identify pure/helper functions that can move without changing call order
2. Extract one helper cluster at a time behind wrappers
3. Re-run actual-lock targeted tests after each cluster
4. Run browser smoke after any cluster that affects lock masks, rendering, or click behavior
5. Stop on the first invariant break and repair before continuing

### Required Tests
- `npm run test:actual-lock`
- `npm test`

### Required Browser Smoke
1. Assigned decrease only
2. Manual lock plus assigned decrease
3. Long-press lock / unlock

### Invariants
- `sum(non-locked assigned seconds) + sum(locked row seconds) === modalActualTotalSeconds`
- Manual lock rows survive recalculation
- Auto lock rows are regenerated from current deficit only
- Locked units reject normal click and failed-click toggles
- Extra activities never occupy locked units

### Stop Conditions
- Locked row count changes unexpectedly
- Manual lock metadata is dropped or duplicated
- Effective lock mask diverges between rendering and click blocking
- Extra allocation enters any locked unit

## Execution Order

1. `Field Interaction Controller`
2. `Actual Grid Core` phase 2

Do not run both candidates in the same commit.
