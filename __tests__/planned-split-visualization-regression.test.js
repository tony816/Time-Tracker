const test = require('node:test');
const assert = require('node:assert/strict');

const { buildMethod } = require('./helpers/script-method-builder');

const getSplitActivities = buildMethod('getSplitActivities(type, baseIndex)', '(type, baseIndex)');

test('planned split falls back to single planned label when planActivities is empty', () => {
    const ctx = {
        timeSlots: [
            { planActivities: [] },
        ],
        normalizePlanActivitiesArray(value) {
            return Array.isArray(value) ? value : [];
        },
        getPlannedLabelForIndex(index) {
            return index === 0 ? '집중 작업' : '';
        },
        getBlockLength(type, index) {
            assert.equal(type, 'planned');
            assert.equal(index, 0);
            return 2;
        },
    };

    const result = getSplitActivities.call(ctx, 'planned', 0);

    assert.deepEqual(result, [
        { label: '집중 작업', seconds: 7200, source: 'plan-template' },
    ]);
});

test('planned split keeps explicit planActivities when available', () => {
    const ctx = {
        timeSlots: [
            { planActivities: [{ label: '운동', seconds: 1800 }] },
        ],
        normalizePlanActivitiesArray(value) {
            return Array.isArray(value) ? value : [];
        },
        getPlannedLabelForIndex() {
            return '무시되어야 함';
        },
        getBlockLength() {
            return 1;
        },
    };

    const result = getSplitActivities.call(ctx, 'planned', 0);

    assert.deepEqual(result, [{ label: '운동', seconds: 1800 }]);
    assert.notEqual(result[0], ctx.timeSlots[0].planActivities[0]);
});

