# Actual Lock Guardrails

Use this checklist for any change touching actual-grid locking, assigned-duration edits, locked rows, failed clicks, or extra-slot allocation.

## Impact Surfaces

Treat these as one feature surface:

- Locked row classification: `manual`, `auto`, and legacy locked rows stay distinguishable.
- Effective lock mask: blocking, graphics, and extra allocation read the same mask.
- Total invariant: `sum(non-locked assigned seconds) + sum(locked row seconds) === modalActualTotalSeconds`.
- Manual locks survive recalculation and are not duplicated into auto rows.
- Auto locks are rebuilt from the current deficit only and do not accumulate.
- Locked units reject normal click and failed-click toggles.
- Locked units render inactive with the locked graphic.
- Extra activities never occupy locked units.

## Required Tests

Run targeted tests first:

```bash
npm run test:actual-lock
```

Then run:

```bash
npm test
```

## Browser Smoke

Start a static server:

```bash
python -m http.server 8000
```

Verify relevant scenarios:

1. Assigned decrease only: `3h A -> reduce assigned by 20m`; expect one 20m auto locked row, last 20m locked graphic, total still 3h.
2. Manual lock plus assigned decrease: `manual lock 10m -> reduce assigned by 20m`; expect manual 10m preserved, one 20m auto lock, 30m locked total, total still 3h.
3. Long-press lock/unlock: `3h A -> long-press one unit -> long-press again`; expect assigned time -10m then restored, graphic follows both states.

## Final Report

Include touched surfaces, targeted tests, browser smoke result, and any unverified residual risk.
