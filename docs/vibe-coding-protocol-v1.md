# Time-Tracker Vibe Coding Protocol v1

## Goal
- Keep delivery speed high with small patches.
- Keep regression risk low with repeatable checks.
- Use one fixed loop per task: `request -> impact scan -> small patch -> related tests -> report`.

## Defaults
- Collaboration mode: balanced.
- Patch size: small and single-intent.
- Reporting density: medium.
- Test policy: recover green baseline first.
- Language: Korean-first discussion, existing code naming conventions unchanged.

## Session Baseline Rule
1. Run `npm test` at session start.
2. If there is an existing red test, fix baseline before new feature work.
3. Continue only from green baseline.

## Request Intake Standard (`TaskBrief`)
Use this template for every new request:

```md
목표:
완료조건(측정 가능):
범위(In/Out):
제약(성능/호환/UI/일정):
검증방법(명령어/수동 시나리오):
```

## Execution Loop
1. Clarify one goal only.
2. Discover impact via targeted search (`rg`).
3. Implement one intent per patch.
4. Run related tests immediately.
5. If patch bundle is complete, run full test suite (`npm test`).
6. For UI changes, do manual checks:
   - slot rendering
   - merge/split behavior
   - timer start/pause/stop
   - date transition
   - save/load

## Compatibility Contract
- Local storage keys must stay compatible:
  - `timesheetData:YYYY-MM-DD`
  - `timesheetData:last`
- If save behavior changes, update tests and docs in the same patch set.

## Result Reporting Standard (`DoneReport`)
Always report with this structure:

```md
변경 파일:
핵심 변경:
검증 결과(통과/실패):
리스크/후속:
```

## Acceptance Criteria
- Full test suite is green.
- No newly introduced failing tests.
- Documentation and behavior stay aligned.
