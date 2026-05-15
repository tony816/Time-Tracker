# Time-Tracker Vibe Coding Protocol v1

Goal: deliver small patches quickly while keeping regression checks repeatable.

## Defaults

- Loop: `request -> impact scan -> small patch -> related tests -> report`
- Patch size: small, single-intent
- Reporting: medium density, Korean-first discussion
- Test policy: recover green baseline before feature work

## Task Brief

```md
목표:
완료조건(측정 가능):
범위(In/Out):
제약(성능/호환/UI/일정):
검증방법(명령어/수동 시나리오):
```

## Execution Loop

1. Clarify one goal.
2. Use targeted `rg` for impact scan.
3. Implement one intent per patch.
4. Run related tests.
5. Run `npm test` when the patch bundle is complete.
6. For UI changes, check slot rendering, merge/split, timer start/pause/stop, date transition, and save/load.

## Compatibility

Keep local keys compatible:

- `timesheetData:YYYY-MM-DD`
- `timesheetData:last`

If save behavior changes, update tests and docs in the same patch set.

## Done Report

```md
변경 파일:
핵심 변경:
검증 결과(통과/실패):
리스크/후속:
```

Acceptance: no newly introduced failing tests; behavior and docs stay aligned.
