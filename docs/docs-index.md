# Docs Index

현재 문서와 과거 리팩터 기록을 구분하는 색인이다. 토큰 절약을 위해 필요한 문서만 연다.

## Current Source Of Truth

1. `README.md`
2. `docs/product-identity.md`
3. `docs/ai-handoff-map.md`
4. `docs/actual-lock-guardrails.md` only for actual-grid / lock / extra allocation

## Supporting Docs

- `docs/codex-token-efficient-prompts.md`: Codex 프롬프트/AI 설정 가이드
- `docs/vibe-coding-protocol-v1.md`: 작업 루프와 보고 템플릿
- `docs/high-risk-refactor-plan.md`: 완료된 고위험 리팩터 기록
- `docs/templates/`: `task-brief.md`, `done-report.md`

## Historical Refactor Logs

`docs/refactor-stage*.md`는 과거 경계와 회귀 테스트 기원을 확인할 때만 읽는다.

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
| Product/UX decision | `README.md`, `docs/product-identity.md` |
| Current architecture | `README.md`, `docs/ai-handoff-map.md` |
| Actual-grid / lock / extra allocation | `docs/actual-lock-guardrails.md`, current code/tests |
| Scoped Codex prompt or AI instruction | `docs/codex-token-efficient-prompts.md` |
| Historical boundary or prior regression | relevant `docs/refactor-stage*.md` |
| Completed high-risk extraction history | `docs/high-risk-refactor-plan.md` |
