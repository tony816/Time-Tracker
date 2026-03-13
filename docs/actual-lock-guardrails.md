# Actual Lock Guardrails

Use this checklist whenever a change touches actual-grid locking, assigned-duration edits, locked rows, or extra-slot allocation.

## Impact Surfaces
- Locked row classification:
  `manual`, `auto`, and legacy locked rows must stay distinguishable.
- Effective locked mask:
  grid blocking, graphics, and extra allocation must all read the same effective lock mask.
- Total invariant:
  `sum(non-locked assigned seconds) + sum(locked row seconds) === modalActualTotalSeconds`
- Manual lock invariant:
  manual locks survive recalculation and are not duplicated into auto lock rows.
- Auto lock invariant:
  auto lock rows are recreated from the current deficit only and do not accumulate across edits.
- Grid interaction invariant:
  locked units reject normal click and failed-click toggles.
- Grid rendering invariant:
  locked units render with the locked graphic and inactive state.
- Extra allocation invariant:
  extra activities never occupy locked units.

## Required Regression Tests
Run these before the full suite:

```bash
npm run test:actual-lock
```

Then run:

```bash
npm test
```

## Required Browser Smoke Checks
Run a local static server and verify at least the relevant scenario:

```bash
python -m http.server 8000
```

1. Assigned decrease only
   `3h A -> reduce assigned by 20m`
   Expected: one auto locked row for 20m, grid shows the last 20m as locked, total stays 3h.
2. Manual lock plus assigned decrease
   `manual lock 10m -> reduce assigned by 20m`
   Expected: manual 10m stays manual, auto locked 20m is added once, grid shows 30m locked total, total stays 3h.
3. Long-press lock/unlock
   `3h A -> long-press one unit -> long-press again`
   Expected: assigned time decreases by 10m on lock, restores on unlock, and the grid graphic follows both transitions.

## Final Report Expectations
When this guardrail is triggered, the final response should include:
- which impact surfaces were touched
- which targeted tests were run
- whether browser smoke checks were run
- any residual risk if a surface was not verified
