const test = require('node:test');
const assert = require('node:assert/strict');

const actualGridCore = require('../core/actual-grid-core');

test('actual-grid-core exports are available and attached to global', () => {
    assert.equal(typeof actualGridCore.getExtraActivityUnitCount, 'function');
    assert.equal(typeof actualGridCore.getActualGridBlockRange, 'function');
    assert.equal(typeof actualGridCore.buildActualUnitsFromActivities, 'function');
    assert.equal(typeof actualGridCore.buildActualActivitiesFromGrid, 'function');
    assert.equal(typeof actualGridCore.buildSplitSegmentsFromActivities, 'function');
    assert.equal(typeof actualGridCore.buildSplitGridSegmentsFromActivities, 'function');
    assert.equal(typeof actualGridCore.normalizeActualGridBooleanUnits, 'function');
    assert.equal(typeof actualGridCore.rebuildLockedRowsFromUnitSet, 'function');
    assert.equal(typeof actualGridCore.insertLockedRowsAfterRelatedActivities, 'function');
    assert.equal(typeof actualGridCore.getActualGridLockedUnitsForBase, 'function');
    assert.equal(typeof actualGridCore.getActualGridManualLockedUnitsForBase, 'function');
    assert.equal(typeof actualGridCore.getActualExtraGridUnitsForBase, 'function');
    assert.equal(typeof actualGridCore.getActualFailedGridUnitsForBase, 'function');
    assert.equal(typeof actualGridCore.buildExtraSlotAllocation, 'function');
    assert.equal(typeof actualGridCore.mergeActualActivitiesWithGrid, 'function');

    assert.ok(globalThis.TimeTrackerActualGridCore);
    assert.equal(typeof globalThis.TimeTrackerActualGridCore.getActualGridBlockRange, 'function');
});

test('getExtraActivityUnitCount reflects assigned/recorded with minimum 1 unit', () => {
    assert.equal(actualGridCore.getExtraActivityUnitCount(null), 0);
    assert.equal(actualGridCore.getExtraActivityUnitCount({ seconds: 599 }), 1);
    assert.equal(actualGridCore.getExtraActivityUnitCount({ seconds: 1200, recordedSeconds: 600 }), 2);
    assert.equal(actualGridCore.getExtraActivityUnitCount({ seconds: 0, recordedSeconds: 601 }), 1);
    assert.equal(actualGridCore.getExtraActivityUnitCount({ seconds: 900 }, 300), 3);
});

test('getActualGridBlockRange resolves contiguous same-label block', () => {
    const planUnits = ['A', 'A', '', 'B', 'B', 'B', 'C'];
    assert.deepEqual(actualGridCore.getActualGridBlockRange(planUnits, 4), { start: 3, end: 5, label: 'B' });
    assert.equal(actualGridCore.getActualGridBlockRange(planUnits, 2), null);
    assert.equal(actualGridCore.getActualGridBlockRange(planUnits, -1), null);
});

test('buildActualUnitsFromActivities builds active units from per-label seconds', () => {
    const planUnits = ['운동', '공부', '운동', ''];
    const activities = [
        { label: ' 운동 ', seconds: 1200 },
        { label: '공부', seconds: 600 },
        { label: '기타', seconds: 600 },
    ];

    const units = actualGridCore.buildActualUnitsFromActivities(planUnits, activities, {
        normalizeLabel: (value) => String(value || '').trim(),
    });
    assert.deepEqual(units, [true, true, true, false]);
});

test('buildActualActivitiesFromGrid keeps plan order and aggregates active labels', () => {
    const planUnits = ['A', 'A', 'B', '', 'B'];
    const actualUnits = [true, false, true, true, true];
    const activities = actualGridCore.buildActualActivitiesFromGrid(planUnits, actualUnits);

    assert.deepEqual(activities, [
        { label: 'A', seconds: 600, source: 'grid' },
        { label: 'B', seconds: 1200, source: 'grid' },
    ]);

    const activitiesBy300 = actualGridCore.buildActualActivitiesFromGrid(planUnits, actualUnits, { stepSeconds: 300 });
    assert.deepEqual(activitiesBy300, [
        { label: 'A', seconds: 300, source: 'grid' },
        { label: 'B', seconds: 600, source: 'grid' },
    ]);
});

test('buildSplitSegmentsFromActivities builds connected row segments with padding', () => {
    const result = actualGridCore.buildSplitSegmentsFromActivities([
        { label: 'A', seconds: 4200 },
    ], {
        index: 0,
        baseIndex: 0,
        isMergedRange: true,
        unitsPerRow: 6,
        showTitleBand: false,
        titleSegments: [],
        normalizeLabel: (value) => String(value || '').trim(),
    });

    assert.equal(result.showTitleBand, false);
    assert.deepEqual(result.titleSegments, []);
    assert.deepEqual(result.gridSegments, [
        { label: 'A', span: 6, connectTop: false, connectBottom: true },
        { label: 'A', span: 1, connectTop: true, connectBottom: false },
        { label: '', span: 5, connectTop: false, connectBottom: false },
    ]);
});

test('buildSplitGridSegmentsFromActivities preserves extras and pads to the row size', () => {
    const result = actualGridCore.buildSplitGridSegmentsFromActivities([
        { label: 'A', seconds: 600 },
        { label: 'X', seconds: 600 },
        { label: 'X', seconds: 600 },
    ], {
        index: 0,
        baseIndex: 0,
        unitsPerRow: 6,
        totalUnits: 4,
        showTitleBand: false,
        titleSegments: [],
        normalizeLabel: (value) => String(value || '').trim(),
        planLabelSet: new Set(['A']),
        reservedIndices: new Set([1, 2]),
        persistExtraFirstLabel: true,
    });

    assert.equal(result.gridSegments.length, 6);
    assert.equal(result.showTitleBand, false);
    assert.deepEqual(result.gridSegments.slice(0, 4), [
        {
            label: 'A',
            span: 1,
            isExtra: false,
            reservedIndices: result.gridSegments[0].reservedIndices,
            alwaysVisibleLabel: false,
            suppressHoverLabel: false,
        },
        {
            label: 'X',
            span: 1,
            isExtra: true,
            reservedIndices: result.gridSegments[1].reservedIndices,
            alwaysVisibleLabel: true,
            suppressHoverLabel: false,
        },
        {
            label: 'X',
            span: 1,
            isExtra: true,
            reservedIndices: result.gridSegments[2].reservedIndices,
            alwaysVisibleLabel: false,
            suppressHoverLabel: true,
        },
        {
            label: '',
            span: 1,
            isExtra: false,
            reservedIndices: result.gridSegments[3].reservedIndices,
            alwaysVisibleLabel: false,
            suppressHoverLabel: false,
        },
    ]);
});

test('normalizeActualGridBooleanUnits clamps and pads boolean masks', () => {
    assert.deepEqual(actualGridCore.normalizeActualGridBooleanUnits([1, 0, '', true], 3), [true, false, false]);
    assert.deepEqual(actualGridCore.normalizeActualGridBooleanUnits([true], 3), [true, false, false]);
    assert.deepEqual(actualGridCore.normalizeActualGridBooleanUnits(null, 2), [false, false]);
    assert.deepEqual(actualGridCore.normalizeActualGridBooleanUnits([true], 0), []);
});

test('rebuildLockedRowsFromUnitSet preserves contiguous segments and auto-lock collapse', () => {
    const segmented = actualGridCore.rebuildLockedRowsFromUnitSet([true, true, false, true], {
        stepSeconds: 600,
        normalizeDurationStep: (value) => value,
    });
    assert.deepEqual(segmented, [
        {
            label: '',
            seconds: 1200,
            recordedSeconds: 1200,
            source: 'locked',
            isAutoLocked: false,
            lockStart: 0,
            lockEnd: 1,
            lockUnits: [0, 1],
        },
        {
            label: '',
            seconds: 600,
            recordedSeconds: 600,
            source: 'locked',
            isAutoLocked: false,
            lockStart: 3,
            lockEnd: 3,
            lockUnits: [3],
        },
    ]);

    const collapsedAuto = actualGridCore.rebuildLockedRowsFromUnitSet([false, true, false, true], {
        isAutoLocked: true,
        allowSegments: false,
        stepSeconds: 600,
        normalizeDurationStep: (value) => value,
    });
    assert.deepEqual(collapsedAuto, [
        {
            label: '',
            seconds: 1200,
            recordedSeconds: 1200,
            source: 'locked',
            isAutoLocked: true,
            lockStart: 1,
            lockEnd: 3,
            lockUnits: [1, 3],
        },
    ]);
});

test('extra and failed grid unit readers normalize stored masks', () => {
    const ctx = {
        timeSlots: [
            {
                activityLog: {
                    actualExtraGridUnits: [1, 0, true],
                    actualFailedGridUnits: [false, 'x'],
                },
            },
        ],
        normalizeActualGridBooleanUnits: actualGridCore.normalizeActualGridBooleanUnits,
    };

    assert.deepEqual(actualGridCore.getActualExtraGridUnitsForBase.call(ctx, 0, 4), [true, false, true, false]);
    assert.deepEqual(actualGridCore.getActualFailedGridUnitsForBase.call(ctx, 0, 3), [false, true, false]);
});
