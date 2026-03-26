# Docs Index

This index separates current source-of-truth docs from historical stage logs.

## Current Source Of Truth

Read these first:

1. `README.md`
2. `docs/product-identity.md`
3. `docs/ai-handoff-map.md`
4. `docs/actual-lock-guardrails.md` for actual-grid work

Supporting current docs:

- `docs/product-identity.md`: product identity and anti-shallow decision checklist
- `docs/high-risk-refactor-plan.md`: completed high-risk refactor record
- `docs/vibe-coding-protocol-v1.md`: contributor workflow notes

## Historical Refactor Logs

These files describe earlier extraction stages and are mainly useful for archaeology:

- `docs/refactor-stage1-baseline.md`
- `docs/refactor-stage2-entry-split.md`
- `docs/refactor-stage3-core-extraction.md`
- `docs/refactor-stage4-storage-adapter.md`
- `docs/refactor-stage5-renderer-split.md`
- `docs/refactor-stage6-timer-controller.md`
- `docs/refactor-stage7-legacy-cleanup.md`
- `docs/refactor-stage8-css-split.md`
- `docs/refactor-stage9-date-core.md`
- `docs/refactor-stage10-actual-grid-core.md`
- `docs/refactor-stage11-text-core.md`
- `docs/refactor-stage12-duration-core.md`
- `docs/refactor-stage13-activity-core.md`
- `docs/refactor-stage14-input-format-core.md`
- `docs/refactor-stage15-grid-metrics-core.md`

## Templates

- `docs/templates/`: reusable document templates

## Recommended Use By Scenario

| Scenario | Read This |
| --- | --- |
| Need product direction before making feature calls | `README.md`, `docs/product-identity.md` |
| Need current architecture fast | `README.md`, `docs/ai-handoff-map.md` |
| Touching actual-grid / lock / extra allocation | `docs/actual-lock-guardrails.md`, then current code/tests |
| Investigating why a boundary exists | relevant `docs/refactor-stage*.md` |
| Reviewing high-risk extraction history | `docs/high-risk-refactor-plan.md` |
