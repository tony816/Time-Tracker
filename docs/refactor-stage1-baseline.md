# Refactor Stage 1 - Baseline Freeze

Purpose: freeze core behavior before modular refactors so regressions are easy to spot.

## Automatic Check

Run `npm test`. Minimum coverage:

- date transition / timer rollover
- merge key normalization / XSS defense
- slot generation / duration parsing / storage keys

## Manual Baseline

Check:

1. Date navigation via previous/next/today/date input; no stale previous-date screen after transition.
2. Planned single select, drag select, merge with time/actual columns, undo restore.
3. Timer only starts on today; start/pause/stop; stop writes actual cell.
4. Inline planned dropdown opens and label add/edit/delete updates screen and totals.
5. Actual detail modal opens/saves/cancels and activity totals match total time.
6. Save/sync chip moves `저장 중 -> 저장됨`; offline/online sync text changes.

Rule: Stage 1 changes no behavior. If tests fail, decide whether the baseline or code is wrong before proceeding.
