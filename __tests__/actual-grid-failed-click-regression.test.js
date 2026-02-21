const test = require('node:test');
const assert = require('node:assert/strict');
const { buildMethod } = require('./helpers/script-method-builder');

const clearActualFailedGridUnitOnNormalClick = buildMethod(
    'clearActualFailedGridUnitOnNormalClick(index, unitIndex, totalUnits = null)',
    '(index, unitIndex, totalUnits = null)'
);
const toggleActualGridUnit = buildMethod('toggleActualGridUnit(index, unitIndex)', '(index, unitIndex)');
const toggleExtraGridUnit = buildMethod('toggleExtraGridUnit(index, extraLabel, unitIndex = null)', '(index, extraLabel, unitIndex = null)');

test('clearActualFailedGridUnitOnNormalClick clears only target failed unit in merged range', () => {
    const slots = [
        { activityLog: { actualFailedGridUnits: [true, true, false] } },
        { activityLog: { actualFailedGridUnits: [true] } },
        { activityLog: { actualFailedGridUnits: [true] } },
    ];

    const ctx = {
        timeSlots: slots,
        getSplitBaseIndex: () => 0,
        buildPlanUnitsForActualGrid: () => ({ units: ['A', 'A', 'A'] }),
        getActualFailedGridUnitsForBase: () => [true, true, false],
        findMergeKey: () => 'actual-0-2',
    };

    const changed = clearActualFailedGridUnitOnNormalClick.call(ctx, 1, 1, 3);

    assert.equal(changed, true);
    assert.deepEqual(slots[0].activityLog.actualFailedGridUnits, [true, false, false]);
    assert.deepEqual(slots[1].activityLog.actualFailedGridUnits, []);
    assert.deepEqual(slots[2].activityLog.actualFailedGridUnits, []);
});

test('clearActualFailedGridUnitOnNormalClick is no-op when target is not failed', () => {
    const slots = [
        { activityLog: { actualFailedGridUnits: [false, false] } },
    ];

    const ctx = {
        timeSlots: slots,
        getSplitBaseIndex: () => 0,
        buildPlanUnitsForActualGrid: () => ({ units: ['A', 'B'] }),
        getActualFailedGridUnitsForBase: () => [false, false],
        findMergeKey: () => null,
    };

    const changed = clearActualFailedGridUnitOnNormalClick.call(ctx, 0, 1, 2);

    assert.equal(changed, false);
    assert.deepEqual(slots[0].activityLog.actualFailedGridUnits, [false, false]);
});

test('toggleActualGridUnit keeps existing toggle behavior and clears failed state first', () => {
    let clearArgs = null;
    let syncArgs = null;
    let rendered = false;
    let calculated = false;
    let saved = false;

    const ctx = {
        getSplitBaseIndex: () => 2,
        buildPlanUnitsForActualGrid: () => ({ units: ['focus', 'focus'], planLabel: 'focus' }),
        clearActualFailedGridUnitOnNormalClick: (index, unitIndex, totalUnits) => {
            clearArgs = { index, unitIndex, totalUnits };
            return true;
        },
        getBlockLength: () => 1,
        getActualGridBlockRange: () => ({ start: 0, end: 1, label: 'focus' }),
        getActualGridUnitsForBase: () => [false, false],
        syncActualGridToSlots: (baseIndex, planUnits, actualUnits) => {
            syncArgs = {
                baseIndex,
                planUnits: planUnits.slice(),
                actualUnits: actualUnits.slice(),
            };
        },
        renderTimeEntries: () => { rendered = true; },
        calculateTotals: () => { calculated = true; },
        autoSave: () => { saved = true; },
    };

    toggleActualGridUnit.call(ctx, 5, 1);

    assert.deepEqual(clearArgs, { index: 5, unitIndex: 1, totalUnits: 2 });
    assert.deepEqual(syncArgs, {
        baseIndex: 2,
        planUnits: ['focus', 'focus'],
        actualUnits: [true, true],
    });
    assert.equal(rendered, true);
    assert.equal(calculated, true);
    assert.equal(saved, true);
});

test('toggleExtraGridUnit clears failed mark before running extra toggle logic', () => {
    let clearArgs = null;

    const ctx = {
        timeSlots: [{ activityLog: { subActivities: [] } }],
        getSplitBaseIndex: () => 0,
        normalizeActivityText: (value) => String(value || '').trim(),
        buildPlanUnitsForActualGrid: () => ({ units: ['A', ''] }),
        clearActualFailedGridUnitOnNormalClick: (index, unitIndex, totalUnits) => {
            clearArgs = { index, unitIndex, totalUnits };
            return true;
        },
        getActualGridUnitsForBase: () => [true, false],
        normalizeActivitiesArray: () => [],
        sortActivitiesByOrder: (items) => items,
        getActualPlanLabelContext: () => ({ labelSet: new Set(['A']) }),
    };

    toggleExtraGridUnit.call(ctx, 0, 'extra-task', 1);

    assert.deepEqual(clearArgs, { index: 0, unitIndex: 1, totalUnits: 2 });
});
