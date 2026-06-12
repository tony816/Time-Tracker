# Docs Index

This index separates current source-of-truth docs from historical stage logs. To save tokens, open only the document needed for the task.

## Current Source Of Truth

1. `README.md`
2. `docs/agent-harness.md`
3. `docs/harness-quality-score.md`
4. `docs/product-identity.md`
5. `docs/ai-handoff-map.md`
6. `docs/actual-lock-guardrails.md` only for actual-grid / lock / extra allocation

## Harness Docs

- `docs/agent-harness.md`: Codex work loop, read path/test path table, mobile planned segment risk surface, UI smoke rules
- `docs/harness-quality-score.md`: Codex-readability grade by surface and missing harness inventory
- `docs/codex-token-efficient-prompts.md`: prompt and AI settings guide for token-efficient work requests

## Supporting Docs

- `docs/vibe-coding-protocol-v1.md`: work loop and reporting template
- `docs/high-risk-refactor-plan.md`: completed high-risk refactor record
- `docs/templates/`: `task-brief.md`, `done-report.md`

## Historical Refactor Logs

`docs/refactor-stage*.md` should be read only when checking historical boundaries or regression-test origins.

- Stage 1: baseline freeze
- Stage 2: entry/bootstrap split
- Stage 3: `core/time-core.js`
- Stage 4: `infra/storage-adapter.js`
- Stage 5: `ui/time-entry-renderer.js`
- Stage 6: `controllers/timer-controller.js`
- Stage 7: legacy schedule modal cleanup
- Stage 8: CSS split
- Stage 9: `core/date-core.js`
- Stage 10: `core/actual-grid-core.js`
- Stage 11: `core/text-core.js`
- Stage 12: `core/duration-core.js`
- Stage 13: `core/activity-core.js`
- Stage 14: `core/input-format-core.js`
- Stage 15: `core/grid-metrics-core.js`

## Scenario Map

| Scenario | Read |
| --- | --- |
| Agent work loop or validation route | `docs/agent-harness.md` |
| Harness quality or missing automation | `docs/harness-quality-score.md` |
| Product/UX decision | `README.md`, `docs/product-identity.md` |
| Current architecture | `README.md`, `docs/ai-handoff-map.md` |
| Planned editing / selection / mobile resize | `docs/agent-harness.md`, then mapped controllers/tests |
| Actual-grid / lock / extra allocation | `docs/actual-lock-guardrails.md`, current code/tests |
| Scoped Codex prompt or AI instruction | `docs/codex-token-efficient-prompts.md` |
| Historical boundary or prior regression | relevant `docs/refactor-stage*.md` |
| Completed high-risk extraction history | `docs/high-risk-refactor-plan.md` |
