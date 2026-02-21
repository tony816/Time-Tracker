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

test('toggleActualGridUnit clears failed X and still performs normal toggle (index=3, unit=5)', () => {
    const slot = {
        activityLog: {
            actualGridUnits: [false, false, false, false, false, false],
            actualExtraGridUnits: [],
            actualFailedGridUnits: [false, false, false, false, false, true],
            subActivities: [],
            titleBandOn: false,
            actualOverride: false,
            title: '',
            details: '',
        },
    };
    const timeSlots = Array.from({ length: 8 }, () => ({
        activityLog: {
            actualGridUnits: [],
            actualExtraGridUnits: [],
            actualFailedGridUnits: [],
            subActivities: [],
            titleBandOn: false,
            actualOverride: false,
            title: '',
            details: '',
        },
    }));
    timeSlots[3] = slot;

    let rendered = false;
    let calculated = false;
    let saved = false;

    const ctx = {
        timeSlots,
        getSplitBaseIndex: () => 3,
        buildPlanUnitsForActualGrid: () => ({ units: ['A', 'A', 'A', 'A', 'A', 'A'], planLabel: 'A' }),
        clearActualFailedGridUnitOnNormalClick(index, unitIndex, totalUnits) {
            return clearActualFailedGridUnitOnNormalClick.call(this, index, unitIndex, totalUnits);
        },
        getBlockLength: () => 1,
        getActualGridBlockRange: () => ({ start: 0, end: 5, label: 'A' }),
        getActualGridUnitsForBase(baseIndex, totalUnits) {
            const raw = this.timeSlots[baseIndex].activityLog.actualGridUnits.slice();
            if (raw.length < totalUnits) {
                return raw.concat(new Array(totalUnits - raw.length).fill(false));
            }
            return raw.slice(0, totalUnits);
        },
        getActualFailedGridUnitsForBase(baseIndex, totalUnits) {
            const raw = this.timeSlots[baseIndex].activityLog.actualFailedGridUnits.slice();
            if (raw.length < totalUnits) {
                return raw.concat(new Array(totalUnits - raw.length).fill(false));
            }
            return raw.slice(0, totalUnits);
        },
        findMergeKey: () => null,
        syncActualGridToSlots(baseIndex, _planUnits, actualUnits) {
            this.timeSlots[baseIndex].activityLog.actualGridUnits = actualUnits.slice();
        },
        renderTimeEntries: () => { rendered = true; },
        calculateTotals: () => { calculated = true; },
        autoSave: () => { saved = true; },
    };

    assert.equal(ctx.timeSlots[3].activityLog.actualFailedGridUnits[5], true);
    toggleActualGridUnit.call(ctx, 3, 5);

    assert.equal(ctx.timeSlots[3].activityLog.actualFailedGridUnits[5], false);
    assert.equal(ctx.timeSlots[3].activityLog.actualGridUnits[5], true);
    assert.deepEqual(ctx.timeSlots[3].activityLog.actualGridUnits, [true, true, true, true, true, true]);
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
