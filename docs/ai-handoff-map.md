# AI Handoff Map

새 AI 세션이 현재 구조를 빠르게 잡기 위한 지도다. 제품/UX 판단은 먼저 `docs/product-identity.md`를 따른다.

## Read Order

`script.js`를 처음부터 끝까지 읽지 말고 아래 순서로 좁혀 읽는다.

1. `README.md`
2. `docs/product-identity.md`
3. `index.html` for load order
4. `main.js` for bootstrap
5. 이 문서
6. 작업 표면별 폴더:
   - `core/`: pure calculations
   - `controllers/`: interaction/state flow
   - `ui/`: DOM/string rendering
   - `infra/`: storage/integration helpers
7. 관련 `__tests__/`
8. actual-grid 작업이면 `docs/actual-lock-guardrails.md`

## Runtime Shape

`index.html` loads:

```text
core/*.js -> infra/storage-adapter.js -> ui/*.js -> controllers/*.js -> script.js -> main.js -> window.tracker
```

`script.js` still owns `TimeTracker`, app state, DOM lookup, wrappers, and remaining orchestration. A large method there does not mean the fix belongs there; check extracted helpers first.

## Inventory

| Area | Files | Role |
| --- | --- | --- |
| Root | `index.html`, `main.js`, `script.js` | shell/load order, bootstrap, state hub |
| Core | `time-core`, `duration-core`, `input-format-core`, `date-core`, `text-core`, `activity-core`, `timesheet-state-core`, `actual-grid-core`, `grid-metrics-core` | pure helpers and snapshot/grid calculations |
| Controllers | `actual-input`, `actual-modal`, `controller-state-access`, `field-interaction`, `inline-plan-dropdown`, `lifecycle`, `persistence`, `planned-catalog-routine`, `planned-editor`, `schedule-preview`, `selection-overlay`, `supabase-sync`, `time-entry-render`, `timer` | user interactions, state transitions, persistence/sync orchestration |
| UI | `time-entry-renderer`, `actual-activity-list-renderer`, `time-control-renderer` | row/activity/control markup helpers |
| Infra | `storage-adapter.js` | local key rules and storage calls |

## Task Read Paths

### Planned Editing / Selection

Read:

1. `controllers/field-interaction-controller.js`
2. `controllers/selection-overlay-controller.js`
3. `controllers/inline-plan-dropdown-controller.js`
4. `controllers/planned-editor-controller.js`
5. `controllers/time-entry-render-controller.js`

Tests:

- `__tests__/planned-inline-dropdown-toggle-regression.test.js`
- `__tests__/planned-merge-selection-regression.test.js`
- `__tests__/selection-overlay-controller.test.js`
- `__tests__/inline-plan-dropdown-controller.test.js`

### Actual Modal / Actual Input

Read:

1. `controllers/actual-modal-controller.js`
2. `controllers/actual-input-controller.js`
3. `ui/actual-activity-list-renderer.js`
4. `ui/time-control-renderer.js`

Tests:

- `__tests__/actual-modal-assignment-regression.test.js`
- `__tests__/actual-input-controller.test.js`
- `__tests__/time-control-renderer.test.js`

### Actual Grid / Locking / Extra Allocation

Read:

1. `docs/actual-lock-guardrails.md`
2. `core/actual-grid-core.js`
3. `controllers/actual-modal-controller.js`
4. `controllers/time-entry-render-controller.js`

Tests:

- `npm run test:actual-lock`
- `npm test`
- Browser smoke from `docs/actual-lock-guardrails.md`

Treat as one surface: locked row classification, effective lock mask, assigned-duration edits, locked row regeneration, grid graphics, click blocking, failed-click behavior, and extra-slot allocation.

### Timer

Read:

1. `controllers/timer-controller.js`
2. `controllers/actual-input-controller.js`
3. `ui/time-control-renderer.js`

Tests:

- `__tests__/timer-controller.test.js`
- `__tests__/actual-input-controller.test.js`

### Persistence / Sync

Read:

1. `core/timesheet-state-core.js`
2. `controllers/persistence-controller.js`
3. `infra/storage-adapter.js`
4. `controllers/supabase-sync-controller.js`

Tests:

- `__tests__/refactor-baseline-stage1.test.js`
- persistence-related tests
- bootstrap regression tests

## Test Mapping

| Surface | Minimum | Extra |
| --- | --- | --- |
| Actual-grid / locking / extra allocation | `npm run test:actual-lock`, then `npm test` | Browser smoke |
| Planned selection / merge / dropdown | targeted planned regression tests | Browser smoke |
| Timer / actual input | targeted timer/input tests | Browser smoke if UI changes |
| Persistence / save/load | targeted persistence tests | Browser smoke for save/load |
| Pure core helpers | matching core tests | Browser smoke if rendered behavior changes |

## Known Facts

- `server.js` still imports missing Telegram bridge modules; `npm start` or bridge-related tests may fail until reconciled.
- Some legacy Korean literals/comments are mojibake. Trace by ids, classes, data attributes, controller names, and tests.
- `docs/refactor-stage*.md` are historical rationale only. Open them only for past boundaries, previous extraction reasons, or regression-test origin.
