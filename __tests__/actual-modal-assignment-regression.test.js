const test = require('node:test');
const assert = require('node:assert/strict');

const { buildMethod } = require('./helpers/script-method-builder');

const STEP_SECONDS = 600;

const buildActualModalActivities = buildMethod(
    'buildActualModalActivities(baseIndex, planUnits, gridUnits, existingActivities = null, planLabel = \'\')',
    '(baseIndex, planUnits, gridUnits, existingActivities = null, planLabel = \'\')'
);
const addActualActivityRow = buildMethod(
    'addActualActivityRow(defaults = {})',
    '(defaults = {})'
);
const removeActualActivityRow = buildMethod(
    'removeActualActivityRow(index)',
    '(index)'
);
const moveActualActivityRow = buildMethod(
    'moveActualActivityRow(index, direction)',
    '(index, direction)'
);
const applyActualDurationChange = buildMethod(
    'applyActualDurationChange(index, targetSeconds, options = {})',
    '(index, targetSeconds, options = {})'
);
const adjustActualActivityDuration = buildMethod(
    'adjustActualActivityDuration(index, direction, options = {})',
    '(index, direction, options = {})'
);
const adjustActualGridDuration = buildMethod(
    'adjustActualGridDuration(index, direction)',
    '(index, direction)'
);
const clampActualGridToAssigned = buildMethod(
    'clampActualGridToAssigned()',
    '()'
);
const getActualGridLockedUnitsForBase = buildMethod(
    'getActualGridLockedUnitsForBase(baseIndex, planUnits = null, activities = null)',
    '(baseIndex, planUnits = null, activities = null)'
);
const getActualGridUnitsForBase = buildMethod(
    'getActualGridUnitsForBase(baseIndex, totalUnits, planUnits = null)',
    '(baseIndex, totalUnits, planUnits = null)'
);
const buildExtraSlotAllocation = buildMethod(
    'buildExtraSlotAllocation(planUnits, actualUnits, extraActivities, orderIndices = null, lockedUnits = null)',
    '(planUnits, actualUnits, extraActivities, orderIndices = null, lockedUnits = null)'
);
const mergeActualActivitiesWithGrid = buildMethod(
    'mergeActualActivitiesWithGrid(baseIndex, planUnits, gridActivities, existingActivities = null, planLabel = \'\')',
    '(baseIndex, planUnits, gridActivities, existingActivities = null, planLabel = \'\')'
);
const finalizeActualActivitiesForSave = buildMethod(
    'finalizeActualActivitiesForSave()',
    '()'
);

function normalizeToStep(raw) {
    const value = Number.isFinite(raw) ? raw : 0;
    return Math.max(0, Math.round(value / STEP_SECONDS) * STEP_SECONDS);
}

test('applyActualDurationChange keeps other rows unchanged and allows unassigned gap', () => {
    const ctx = {
        modalActualActivities: [
            { label: 'A', seconds: 1800, source: 'grid' },
            { label: 'B', seconds: 1200, source: 'grid' },
            { label: 'C', seconds: 600, source: 'grid' },
        ],
        modalActualTotalSeconds: 3600,
        modalActualHasPlanUnits: true,
        modalActualPlanLabelSet: new Set(['A', 'B', 'C']),
        modalActualBaseIndex: 0,
        modalActualDirty: false,
        isValidActualRow(index) {
            return Number.isInteger(index) && index >= 0 && index < this.modalActualActivities.length;
        },
        normalizeActualDurationStep: normalizeToStep,
        clampActualGridToAssigned() {
            this.clampCalls = (this.clampCalls || 0) + 1;
        },
        updateActualSpinnerDisplays() {},
        updateActualActivitiesSummary() {},
        normalizeActivityText(value) {
            return String(value || '').trim();
        },
        updatePlanActivitiesAssignment() {
            this.planSyncCalls = (this.planSyncCalls || 0) + 1;
        },
    };

    applyActualDurationChange.call(ctx, 0, 600, {});

    assert.deepEqual(
        ctx.modalActualActivities.map((item) => item.seconds),
        [600, 1200, 600]
    );
    assert.equal(ctx.clampCalls, 1);
    assert.equal(ctx.modalActualDirty, true);
});

test('addActualActivityRow assigns all remaining unassigned time to the new row', () => {
    const ctx = {
        modalActualActivities: [
            { label: 'A', seconds: 600, source: 'grid' },
            { label: 'B', seconds: 1200, source: 'grid' },
        ],
        modalActualTotalSeconds: 3600,
        modalActualHasPlanUnits: true,
        modalActualDirty: false,
        modalActualActiveRow: -1,
        normalizeActualDurationStep: normalizeToStep,
        normalizeActualActivitiesToStep() {
            this.modalActualActivities.forEach((item) => {
                item.seconds = this.normalizeActualDurationStep(item.seconds);
            });
        },
        clampActualGridToAssigned() {
            this.clampCalls = (this.clampCalls || 0) + 1;
        },
        renderActualActivitiesList() {},
        focusActualRowLabel() {},
    };

    addActualActivityRow.call(ctx, { focusLabel: false });

    assert.equal(ctx.modalActualActivities.length, 3);
    assert.equal(ctx.modalActualActivities[2].seconds, 1800);
    assert.equal(ctx.clampCalls, 1);
});

test('addActualActivityRow keeps zero when no unassigned time remains', () => {
    const ctx = {
        modalActualActivities: [
            { label: 'A', seconds: 1800, source: 'grid' },
            { label: 'B', seconds: 1800, source: 'grid' },
        ],
        modalActualTotalSeconds: 3600,
        modalActualHasPlanUnits: true,
        modalActualDirty: false,
        modalActualActiveRow: -1,
        normalizeActualDurationStep: normalizeToStep,
        normalizeActualActivitiesToStep() {
            this.modalActualActivities.forEach((item) => {
                item.seconds = this.normalizeActualDurationStep(item.seconds);
            });
        },
        clampActualGridToAssigned() {},
        renderActualActivitiesList() {},
        focusActualRowLabel() {},
    };

    addActualActivityRow.call(ctx, { focusLabel: false });

    assert.equal(ctx.modalActualActivities.length, 3);
    assert.equal(ctx.modalActualActivities[2].seconds, 0);
});

test('removeActualActivityRow drops removed time without carrying over to others', () => {
    const ctx = {
        modalActualActivities: [
            { label: 'A', seconds: 600 },
            { label: 'B', seconds: 1200 },
            { label: 'C', seconds: 1800 },
        ],
        modalActualActiveRow: 1,
        modalActualDirty: false,
        isValidActualRow(index) {
            return Number.isInteger(index) && index >= 0 && index < this.modalActualActivities.length;
        },
        normalizeActualDurationStep: normalizeToStep,
        normalizeActualActivitiesToStep() {
            this.modalActualActivities.forEach((item) => {
                item.seconds = this.normalizeActualDurationStep(item.seconds);
            });
        },
        clampActualGridToAssigned() {},
        renderActualActivitiesList() {},
    };

    removeActualActivityRow.call(ctx, 1);

    assert.deepEqual(
        ctx.modalActualActivities.map((item) => item.seconds),
        [600, 1800]
    );
    assert.equal(ctx.modalActualActiveRow, 1);
});

test('moveActualActivityRow reindexes order to match row order', () => {
    const ctx = {
        modalActualActivities: [
            { label: 'A', seconds: 600, order: 0 },
            { label: 'B', seconds: 1200, order: 1 },
            { label: 'C', seconds: 1800, order: 2 },
        ],
        modalActualActiveRow: 1,
        modalActualDirty: false,
        isValidActualRow(index) {
            return Number.isInteger(index) && index >= 0 && index < this.modalActualActivities.length;
        },
        renderActualActivitiesList() {},
        focusActualRowLabel() {},
    };

    moveActualActivityRow.call(ctx, 1, -1);

    assert.deepEqual(
        ctx.modalActualActivities.map((item) => item.label),
        ['B', 'A', 'C']
    );
    assert.deepEqual(
        ctx.modalActualActivities.map((item) => item.order),
        [0, 1, 2]
    );
    assert.equal(ctx.modalActualActiveRow, 0);
    assert.equal(ctx.modalActualDirty, true);
});

test('adjustActualActivityDuration does not wrap down from zero to max', () => {
    const ctx = {
        modalActualActivities: [
            { label: 'A', seconds: 0 },
            { label: 'B', seconds: 1200 },
        ],
        modalActualHasPlanUnits: true,
        modalActualTotalSeconds: 3600,
        isValidActualRow(index) {
            return Number.isInteger(index) && index >= 0 && index < this.modalActualActivities.length;
        },
        getActualDurationStepSeconds() {
            return STEP_SECONDS;
        },
        normalizeActualDurationStep: normalizeToStep,
        applyActualDurationChange(index, nextSeconds, options) {
            this.lastChange = { index, nextSeconds, options };
        },
    };

    adjustActualActivityDuration.call(ctx, 0, -1, {});

    assert.equal(ctx.lastChange.index, 0);
    assert.equal(ctx.lastChange.nextSeconds, 0);
});

test('adjustActualGridDuration does not wrap down from zero for extra labels', () => {
    const ctx = {
        modalActualActivities: [
            { label: 'extra', seconds: 1200, recordedSeconds: 0, source: 'extra' },
        ],
        modalActualHasPlanUnits: true,
        modalActualPlanLabelSet: new Set(['plan']),
        modalActualDirty: false,
        isValidActualRow(index) {
            return Number.isInteger(index) && index >= 0 && index < this.modalActualActivities.length;
        },
        normalizeActivityText(value) {
            return String(value || '').trim();
        },
        getActualDurationStepSeconds() {
            return STEP_SECONDS;
        },
        normalizeActualDurationStep: normalizeToStep,
        updateActualSpinnerDisplays() {},
        updateActualActivitiesSummary() {},
    };

    adjustActualGridDuration.call(ctx, 0, -1);

    assert.equal(ctx.modalActualActivities[0].recordedSeconds, 0);
});

test('buildActualModalActivities does not reseed missing planned labels when existing list is present', () => {
    const ctx = {
        modalActualTotalSeconds: 3600,
        normalizeActivityText(value) {
            return String(value || '').trim();
        },
        normalizeActualDurationStep: normalizeToStep,
        getBlockLength() {
            return 1;
        },
        getPlanActivitiesForIndex() {
            return [
                { label: 'A', seconds: 1800 },
                { label: 'B', seconds: 1800 },
            ];
        },
        getActualGridSecondsMap() {
            return new Map([
                ['A', 1800],
                ['B', 1800],
            ]);
        },
        getPlanLabelOrderForActual() {
            return ['A', 'B'];
        },
        normalizeActualActivitiesList(raw) {
            return Array.isArray(raw) ? raw.map((item) => ({ ...item })) : [];
        },
        buildActualActivitiesSeed() {
            return [];
        },
    };

    const result = buildActualModalActivities.call(
        ctx,
        0,
        ['A', 'B'],
        [true, true, true, true, true, true],
        [{ label: 'A', seconds: 600, source: 'grid' }],
        ''
    );

    assert.deepEqual(result.map((item) => item.label), ['A']);
});

test('clampActualGridToAssigned locks tail units by total assigned deficit', () => {
    const ctx = {
        modalActualHasPlanUnits: true,
        modalActualPlanUnits: ['A', 'A', 'B', 'B'],
        modalActualGridUnits: [true, true, true, true],
        modalActualActivities: [
            { label: 'A', seconds: 1200, source: 'grid' },
        ],
        modalActualPlanLabelSet: new Set(['A', 'B']),
        getActualDurationStepSeconds() {
            return STEP_SECONDS;
        },
        normalizeActivityText(value) {
            return String(value || '').trim();
        },
    };

    clampActualGridToAssigned.call(ctx);

    assert.deepEqual(ctx.modalActualGridUnits, [true, true, false, false]);
});

test('clampActualGridToAssigned uses total assigned sum regardless label identity', () => {
    const ctx = {
        modalActualHasPlanUnits: true,
        modalActualPlanUnits: ['A', 'A', 'B', 'B'],
        modalActualGridUnits: [true, true, true, true],
        modalActualActivities: [
            { label: 'B', seconds: 1200, source: 'grid' },
        ],
        modalActualPlanLabelSet: new Set(['A', 'B']),
        getActualDurationStepSeconds() {
            return STEP_SECONDS;
        },
        normalizeActivityText(value) {
            return String(value || '').trim();
        },
    };

    clampActualGridToAssigned.call(ctx);

    assert.deepEqual(ctx.modalActualGridUnits, [true, true, false, false]);
});

test('clampActualGridToAssigned creates one locked row with remaining seconds', () => {
    const ctx = {
        modalActualHasPlanUnits: true,
        modalActualPlanUnits: ['A', 'A', 'B', 'B'],
        modalActualGridUnits: [true, true, true, true],
        modalActualActivities: [
            { label: 'A', seconds: 1200, source: 'grid' },
        ],
        modalActualPlanLabelSet: new Set(['A', 'B']),
        modalActualDirty: false,
        getActualDurationStepSeconds() {
            return STEP_SECONDS;
        },
        normalizeActualDurationStep(seconds) {
            return normalizeToStep(seconds);
        },
        normalizeActivityText(value) {
            return String(value || '').trim();
        },
    };

    clampActualGridToAssigned.call(ctx);

    assert.deepEqual(ctx.modalActualGridUnits, [true, true, false, false]);
    const lockedRows = ctx.modalActualActivities.filter((item) => item && item.source === 'locked');
    assert.equal(lockedRows.length, 1);
    assert.equal(lockedRows[0].label, '');
    assert.equal(lockedRows[0].seconds, 1200);
    assert.equal(lockedRows[0].recordedSeconds, 1200);
    assert.deepEqual(
        ctx.modalActualActivities.map((item) => item.order),
        [0, 1]
    );
    assert.equal(ctx.modalActualDirty, true);
});

test('clampActualGridToAssigned is idempotent for locked row creation', () => {
    const ctx = {
        modalActualHasPlanUnits: true,
        modalActualPlanUnits: ['A', 'A', 'B', 'B'],
        modalActualGridUnits: [true, true, true, true],
        modalActualActivities: [
            { label: 'A', seconds: 1200, source: 'grid', order: 0 },
        ],
        modalActualPlanLabelSet: new Set(['A', 'B']),
        getActualDurationStepSeconds() {
            return STEP_SECONDS;
        },
        normalizeActualDurationStep(seconds) {
            return normalizeToStep(seconds);
        },
        normalizeActivityText(value) {
            return String(value || '').trim();
        },
    };

    clampActualGridToAssigned.call(ctx);
    const afterFirst = ctx.modalActualActivities.map((item) => ({ ...item }));

    clampActualGridToAssigned.call(ctx);
    const afterSecond = ctx.modalActualActivities.map((item) => ({ ...item }));

    const lockedRows = afterSecond.filter((item) => item && item.source === 'locked');
    assert.equal(lockedRows.length, 1);
    assert.deepEqual(afterSecond, afterFirst);
});

test('clampActualGridToAssigned updates and removes locked row as deficit changes', () => {
    const ctx = {
        modalActualHasPlanUnits: true,
        modalActualPlanUnits: ['A', 'A', 'B', 'B'],
        modalActualGridUnits: [true, true, true, true],
        modalActualActivities: [
            { label: 'A', seconds: 1200, source: 'grid', order: 0 },
        ],
        modalActualPlanLabelSet: new Set(['A', 'B']),
        getActualDurationStepSeconds() {
            return STEP_SECONDS;
        },
        normalizeActualDurationStep(seconds) {
            return normalizeToStep(seconds);
        },
        normalizeActivityText(value) {
            return String(value || '').trim();
        },
    };

    clampActualGridToAssigned.call(ctx);
    let lockedRows = ctx.modalActualActivities.filter((item) => item && item.source === 'locked');
    assert.equal(lockedRows[0].seconds, 1200);

    ctx.modalActualActivities[0].seconds = 1800;
    clampActualGridToAssigned.call(ctx);
    lockedRows = ctx.modalActualActivities.filter((item) => item && item.source === 'locked');
    assert.equal(lockedRows.length, 1);
    assert.equal(lockedRows[0].seconds, 600);
    assert.equal(lockedRows[0].recordedSeconds, 600);

    ctx.modalActualActivities[0].seconds = 2400;
    clampActualGridToAssigned.call(ctx);
    lockedRows = ctx.modalActualActivities.filter((item) => item && item.source === 'locked');
    assert.equal(lockedRows.length, 0);
    assert.deepEqual(ctx.modalActualActivities.map((item) => item.order), [0]);
});

test('getActualGridLockedUnitsForBase unlocks when assigned time increases', () => {
    const ctx = {
        timeSlots: [{ activityLog: { subActivities: [] } }],
        getActualDurationStepSeconds() {
            return STEP_SECONDS;
        },
        normalizeActivityText(value) {
            return String(value || '').trim();
        },
        normalizeActivitiesArray(raw) {
            return Array.isArray(raw) ? raw : [];
        },
    };

    const lockedWhenShort = getActualGridLockedUnitsForBase.call(
        ctx,
        0,
        ['A', 'A'],
        [{ label: 'A', seconds: 600, source: 'grid' }]
    );
    const lockedWhenExpanded = getActualGridLockedUnitsForBase.call(
        ctx,
        0,
        ['A', 'A'],
        [{ label: 'A', seconds: 1200, source: 'grid' }]
    );

    assert.deepEqual(lockedWhenShort, [false, true]);
    assert.deepEqual(lockedWhenExpanded, [false, false]);
});

test('getActualGridLockedUnitsForBase locks from global tail by total assigned sum', () => {
    const ctx = {
        timeSlots: [{ activityLog: { subActivities: [] } }],
        getActualDurationStepSeconds() {
            return STEP_SECONDS;
        },
        normalizeActivityText(value) {
            return String(value || '').trim();
        },
        normalizeActivitiesArray(raw) {
            return Array.isArray(raw) ? raw : [];
        },
    };

    const locked = getActualGridLockedUnitsForBase.call(
        ctx,
        0,
        ['A', 'A', 'B', 'B'],
        [
            { label: 'A', seconds: 600, source: 'grid' },
            { label: 'B', seconds: 600, source: 'grid' },
        ]
    );

    assert.deepEqual(locked, [false, false, true, true]);
});

test('getActualGridLockedUnitsForBase places locked units by locked row order (head)', () => {
    const ctx = {
        timeSlots: [{ activityLog: { subActivities: [] } }],
        getActualDurationStepSeconds() {
            return STEP_SECONDS;
        },
        normalizeActivityText(value) {
            return String(value || '').trim();
        },
        getActualGridDisplayOrderIndices(units) {
            return units.map((_, idx) => idx);
        },
        normalizeActivitiesArray(raw) {
            return Array.isArray(raw) ? raw : [];
        },
    };

    const planUnits = ['A', 'A', 'B', 'B'];
    const activities = [
        { label: '', seconds: 1200, recordedSeconds: 1200, source: 'locked', order: 0 },
        { label: 'A', seconds: 1200, source: 'grid', order: 1 },
    ];

    const locked = getActualGridLockedUnitsForBase.call(ctx, 0, planUnits, activities);
    assert.deepEqual(locked, [true, true, false, false]);
});

test('getActualGridLockedUnitsForBase moves locked units when locked row order changes', () => {
    const ctx = {
        timeSlots: [{ activityLog: { subActivities: [] } }],
        getActualDurationStepSeconds() {
            return STEP_SECONDS;
        },
        normalizeActivityText(value) {
            return String(value || '').trim();
        },
        getActualGridDisplayOrderIndices(units) {
            return units.map((_, idx) => idx);
        },
        normalizeActivitiesArray(raw) {
            return Array.isArray(raw) ? raw : [];
        },
    };

    const planUnits = ['A', 'A', 'B', 'B'];
    const activities = [
        { label: 'A', seconds: 1200, source: 'grid', order: 0 },
        { label: '', seconds: 1200, recordedSeconds: 1200, source: 'locked', order: 1 },
    ];

    const locked = getActualGridLockedUnitsForBase.call(ctx, 0, planUnits, activities);
    assert.deepEqual(locked, [false, false, true, true]);
});

test('getActualGridUnitsForBase keeps explicit all-off grid without rebuilding from activities', () => {
    const ctx = {
        timeSlots: [{
            activityLog: {
                actualGridUnits: [false, false, false, false, false, false],
                subActivities: [{ label: 'A', seconds: 3600, source: 'grid' }],
            }
        }],
        normalizeActualGridBooleanUnits(units, totalUnits) {
            let safe = Array.isArray(units) ? units.map((value) => Boolean(value)) : [];
            if (safe.length > totalUnits) safe = safe.slice(0, totalUnits);
            if (safe.length < totalUnits) safe = safe.concat(new Array(totalUnits - safe.length).fill(false));
            return safe;
        },
        normalizeActivitiesArray(raw) {
            return Array.isArray(raw) ? raw : [];
        },
        buildActualUnitsFromActivities(planUnits) {
            this.rebuildCalls = (this.rebuildCalls || 0) + 1;
            return new Array(planUnits.length).fill(true);
        },
    };

    const result = getActualGridUnitsForBase.call(
        ctx,
        0,
        6,
        ['A', 'A', 'A', 'A', 'A', 'A']
    );

    assert.deepEqual(result, [false, false, false, false, false, false]);
    assert.equal(ctx.rebuildCalls || 0, 0);
});

test('getActualGridUnitsForBase rebuilds from activities only when stored units are missing', () => {
    const ctx = {
        timeSlots: [{
            activityLog: {
                actualGridUnits: [],
                subActivities: [{ label: 'A', seconds: 3600, source: 'grid' }],
            }
        }],
        normalizeActualGridBooleanUnits(units, totalUnits) {
            let safe = Array.isArray(units) ? units.map((value) => Boolean(value)) : [];
            if (safe.length > totalUnits) safe = safe.slice(0, totalUnits);
            if (safe.length < totalUnits) safe = safe.concat(new Array(totalUnits - safe.length).fill(false));
            return safe;
        },
        normalizeActivitiesArray(raw) {
            return Array.isArray(raw) ? raw : [];
        },
        buildActualUnitsFromActivities(planUnits) {
            this.rebuildCalls = (this.rebuildCalls || 0) + 1;
            return new Array(planUnits.length).fill(true);
        },
    };

    const result = getActualGridUnitsForBase.call(
        ctx,
        0,
        6,
        ['A', 'A', 'A', 'A', 'A', 'A']
    );

    assert.deepEqual(result, [true, true, true, true, true, true]);
    assert.equal(ctx.rebuildCalls || 0, 1);
});

test('buildExtraSlotAllocation can place extras into inactive planned-labeled units', () => {
    const ctx = {
        normalizeActivityText(value) {
            return String(value || '').trim();
        },
        getExtraActivityUnitCount(item) {
            const seconds = Number.isFinite(item && item.seconds) ? Math.max(0, Math.floor(item.seconds)) : 0;
            return Math.floor(seconds / STEP_SECONDS);
        },
    };

    const result = buildExtraSlotAllocation.call(
        ctx,
        ['A', 'A', 'A', 'A', 'A', 'A'],
        [true, true, true, false, false, false],
        [{ label: 'X', seconds: 1800, source: 'extra', recordedSeconds: 1800 }],
        [0, 1, 2, 3, 4, 5]
    );

    assert.deepEqual(result.slotsByIndex, ['', '', '', 'X', 'X', 'X']);
    assert.deepEqual(result.slotsByLabel.get('X'), [5, 4, 3]);
});

test('buildExtraSlotAllocation fills from the tail when all planned units are available', () => {
    const ctx = {
        normalizeActivityText(value) {
            return String(value || '').trim();
        },
        getExtraActivityUnitCount(item) {
            const seconds = Number.isFinite(item && item.seconds) ? Math.max(0, Math.floor(item.seconds)) : 0;
            return Math.floor(seconds / STEP_SECONDS);
        },
    };

    const result = buildExtraSlotAllocation.call(
        ctx,
        new Array(18).fill('A'),
        new Array(18).fill(false),
        [{ label: 'X', seconds: 1800, source: 'extra', recordedSeconds: 1800 }],
        Array.from({ length: 18 }, (_v, idx) => idx)
    );

    assert.equal(result.slotsByIndex[15], 'X');
    assert.equal(result.slotsByIndex[16], 'X');
    assert.equal(result.slotsByIndex[17], 'X');
    assert.deepEqual(result.slotsByLabel.get('X'), [17, 16, 15]);
});

test('buildExtraSlotAllocation never places extras into locked units', () => {
    const ctx = {
        normalizeActivityText(value) {
            return String(value || '').trim();
        },
        getExtraActivityUnitCount(item) {
            const seconds = Number.isFinite(item && item.seconds) ? Math.max(0, Math.floor(item.seconds)) : 0;
            return Math.floor(seconds / STEP_SECONDS);
        },
    };

    const result = buildExtraSlotAllocation.call(
        ctx,
        ['A', 'A', 'A', 'A', 'A', 'A'],
        [false, false, false, false, false, false],
        [{ label: 'X', seconds: 3000, source: 'extra', recordedSeconds: 3000 }],
        [0, 1, 2, 3, 4, 5],
        [false, false, false, false, false, true]
    );

    assert.equal(result.slotsByIndex[5], '');
    assert.deepEqual(result.slotsByLabel.get('X'), [4, 3, 2, 1, 0]);
});

test('buildExtraSlotAllocation can follow row order relative to planned rows', () => {
    const ctx = {
        normalizeActivityText(value) {
            return String(value || '').trim();
        },
        getExtraActivityUnitCount(item) {
            const seconds = Number.isFinite(item && item.seconds) ? Math.max(0, Math.floor(item.seconds)) : 0;
            return Math.floor(seconds / STEP_SECONDS);
        },
    };

    const planUnits = new Array(6).fill('A');
    const actualUnits = new Array(6).fill(false);
    const extraActivities = [{ label: 'X', seconds: 1800, source: 'extra', recordedSeconds: 1800 }];
    const orderIndices = [0, 1, 2, 3, 4, 5];
    const planLabelSet = new Set(['A']);

    const extraFirst = buildExtraSlotAllocation.call(
        ctx,
        planUnits,
        actualUnits,
        extraActivities,
        orderIndices,
        null,
        [
            { label: 'X', seconds: 1800, source: 'extra' },
            { label: 'A', seconds: 1800, source: 'grid' },
        ],
        planLabelSet
    );
    assert.deepEqual(extraFirst.slotsByIndex, ['X', 'X', 'X', '', '', '']);

    const extraLast = buildExtraSlotAllocation.call(
        ctx,
        planUnits,
        actualUnits,
        extraActivities,
        orderIndices,
        null,
        [
            { label: 'A', seconds: 1800, source: 'grid' },
            { label: 'X', seconds: 1800, source: 'extra' },
        ],
        planLabelSet
    );
    assert.deepEqual(extraLast.slotsByIndex, ['', '', '', 'X', 'X', 'X']);
});

test('mergeActualActivitiesWithGrid keeps planned assignment when existing list is empty', () => {
    const ctx = {
        timeSlots: [{ activityLog: { subActivities: [] } }],
        normalizeActivityText(value) {
            return String(value || '').trim();
        },
        getActualDurationStepSeconds() {
            return STEP_SECONDS;
        },
        normalizeActualActivitiesList(raw) {
            return Array.isArray(raw) ? raw.map((item) => ({ ...item })) : [];
        },
        getPlanLabelOrderForActual() {
            return ['A'];
        },
    };

    const result = mergeActualActivitiesWithGrid.call(
        ctx,
        0,
        ['A', 'A', 'A', 'A', 'A', 'A'],
        [{ label: 'A', seconds: 600, source: 'grid' }],
        null,
        'A'
    );

    assert.deepEqual(result, [{ label: 'A', seconds: 3600, source: 'grid' }]);
});

test('mergeActualActivitiesWithGrid preserves existing planned assignment on grid click', () => {
    const ctx = {
        timeSlots: [{ activityLog: { subActivities: [{ label: 'A', seconds: 1800, source: 'grid' }] } }],
        normalizeActivityText(value) {
            return String(value || '').trim();
        },
        getActualDurationStepSeconds() {
            return STEP_SECONDS;
        },
        normalizeActualActivitiesList(raw) {
            return Array.isArray(raw) ? raw.map((item) => ({ ...item })) : [];
        },
        getPlanLabelOrderForActual() {
            return ['A'];
        },
    };

    const result = mergeActualActivitiesWithGrid.call(
        ctx,
        0,
        ['A', 'A', 'A', 'A', 'A', 'A'],
        [{ label: 'A', seconds: 600, source: 'grid' }],
        null,
        'A'
    );

    assert.deepEqual(result, [{ label: 'A', seconds: 1800, source: 'grid' }]);
});

test('finalizeActualActivitiesForSave does not force-fill total allocation', () => {
    const ctx = {
        modalActualActivities: [
            { label: 'A', seconds: 600, source: 'grid' },
            { label: 'B', seconds: 600, source: 'extra' },
        ],
        normalizeActualActivitiesList(raw) {
            return Array.isArray(raw) ? raw.map((item) => ({ ...item })) : [];
        },
    };

    const result = finalizeActualActivitiesForSave.call(ctx);
    assert.deepEqual(
        result.map((item) => ({ label: item.label, seconds: item.seconds })),
        [
            { label: 'A', seconds: 600 },
            { label: 'B', seconds: 600 },
        ]
    );
});
