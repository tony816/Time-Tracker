# Codex Token-Efficient Prompt Guide

Use this guide when asking Codex to work on Time Tracker with a small, reliable context window. For the repo-local execution loop, use `docs/agent-harness.md`.

## Core Rule

Give Codex the narrow outcome, allowed files or feature surface, hard constraints, and expected validation. Do not ask it to preload every Markdown file or inspect the entire app unless the task truly spans the app.

A strong request includes:

- Goal: the desired result.
- Scope: files, folders, or feature surface that may change.
- Constraints: compatibility rules, forbidden refactors, or storage/schema limits.
- Verification: targeted tests, browser smoke, and final response length.

## Default AI Instruction

```text
This is a static SPA Time Tracker project.

Prioritize token efficiency:
- Read only files related to the requested surface first.
- Do not auto-read every file in docs/.
- If document choice is unclear, use docs/docs-index.md, then open the smallest relevant document.
- Avoid whole-repo refactors, broad searches, and long explanations unless required.
- Before editing, summarize touched files and affected risk surfaces.
- Prefer existing helpers in core/, controllers/, ui/, and infra/ before changing large script.js methods.
- Report only changed files, validation results, and residual risks.

Follow repo rules:
- AGENTS.md is the map; detailed harness guidance lives in docs/agent-harness.md.
- JavaScript uses 4-space indentation and semicolons.
- Preserve localStorage key compatibility.
- If save/load behavior changes, update code, tests, and docs together.

For actual-grid locking, locked rows, assigned-duration, or extra allocation:
- Treat them as one feature surface.
- Use docs/actual-lock-guardrails.md.
- Run npm run test:actual-lock before npm test.
- Run browser smoke if UI behavior can change.
```

## Prompt Template

```text
Goal: [desired outcome]
Scope: [files/folders/feature surface that may change]
Constraints: [forbidden changes, compatibility rules, refactor limits]
Process: Read only relevant docs/code first, then state the minimal plan before editing.
Verification: [targeted tests and smoke checks]
Response: [summary length and required fields]
```

## Examples

```text
Goal: Fix the timer losing the last manual start time after reload.
Scope: timer controller, persistence controller, storage adapter, related tests only.
Constraints: Do not change localStorage keys or snapshot shape unless unavoidable.
Process: Read docs/agent-harness.md, then the timer and persistence read paths.
Verification: Run targeted timer/persistence tests first, then npm test.
Response: Changed files, validation results, residual risks in 5 lines or fewer.
```

```text
Goal: Investigate accidental dropdown opening after mobile planned segment resize.
Scope: planned selection, inline dropdown, mobile bottom sheet, and resize surface.
Constraints: No broad UI redesign and no new dependencies.
Process: Use docs/agent-harness.md mobile planned segment risk checks.
Verification: Run mapped mobile planned tests and desktop/mobile browser smoke.
Response: Cause, changed files, validation results, residual risks.
```

```text
Goal: Investigate whether locked actual units can accept extra allocation.
Scope: actual-grid locking, locked rows, assigned-duration, extra-slot allocation.
Constraints: Investigation only; do not edit files.
Process: Use docs/actual-lock-guardrails.md as the checklist.
Verification: Suggest the smallest tests needed.
Response: Evidence, likely files, and next fix scope.
```

## Token-Saving Rules

- Split investigation and implementation when the risk surface is unclear.
- Share file paths so Codex can read the source directly.
- Use `docs/agent-harness.md` for work loop, read paths, test paths, and smoke checks.
- Use `docs/docs-index.md` only to choose documents.
- Use `docs/ai-handoff-map.md` only for architecture context.
- Use `docs/product-identity.md` only for product direction, UX, or feature decisions.
- Use `docs/actual-lock-guardrails.md` only for actual-grid lock work.
- Use historical `docs/refactor-stage*.md` only for past boundaries or regression-test origins.
- Cap final reports by asking for changed files, validation results, and residual risks.

## Thread Restart Summary

```text
Current state:
- Done:
- Changed files:
- Validation:

Next goal:
-

Scope:
-

Risks:
-

Response:
- Keep updates short; report validation results and residual risks only.
```
