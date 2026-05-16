const test = require('node:test');
const assert = require('node:assert/strict');

require('../core/plan-segment-core');
require('../core/actual-grid-core');
const { buildMethod } = require('./helpers/script-method-builder');

const getPlanActivitiesWithVirtualGaps = buildMethod(
    'getPlanActivitiesWithVirtualGaps(baseIndex, range = null)',
    '(baseIndex, range = null)'
);
const computeSplitSegments = buildMethod(
    'computeSplitSegments(type, index)',
    '(type, index)'
);

test('plan-only empty slot renders a calculated virtual rest gap', () => {
    const ctx = {
        actualRecordingDisabled: true,
        timeSlots: [{ planned: '', planActivities: [] }],
        mergedFields: new Map(),
        findMergeKey() {
            return null;
        },
        getBlockLength() {
            return 1;
        },
        normalizeActivityText(value) {
            return String(value || '').trim();
        },
        normalizePlanActivitiesArray(value) {
            return Array.isArray(value) ? value : [];
        },
        getPlannedLabelForIndex() {
            return '';
        },
        getSplitBaseIndex(type, index) {
            return index;
        },
        getSplitRange(type, index) {
            return { start: index, end: index };
        },
        getSplitActivities(type, baseIndex) {
            if (type === 'planned') {
                const slot = this.timeSlots[baseIndex];
                const planActivities = this.normalizePlanActivitiesArray(slot.planActivities).map(item => ({ ...item }));
                if (planActivities.length > 0) return planActivities;
                const planLabel = this.getPlannedLabelForIndex(baseIndex);
                return planLabel ? [{ label: planLabel, seconds: 3600, source: 'plan-template' }] : [];
            }
            return [];
        },
        getPlanActivitiesWithVirtualGaps(baseIndex, range) {
            return getPlanActivitiesWithVirtualGaps.call(this, baseIndex, range);
        },
    };

    const result = computeSplitSegments.call(ctx, 'planned', 0);

    assert.ok(result);
    assert.equal(result.gridSegments.length, 1);
    assert.equal(result.gridSegments[0].label, '휴식');
    assert.equal(result.gridSegments[0].virtualRest, true);
    assert.equal(result.gridSegments[0].durationMinutes, 60);
});

test('real saved 휴식 activity is not marked as a virtual rest gap', () => {
    const ctx = {
        timeSlots: [{ planned: '휴식', planActivities: [{ label: '휴식', seconds: 3600 }] }],
        getBlockLength() {
            return 1;
        },
        normalizePlanActivitiesArray(value) {
            return Array.isArray(value) ? value : [];
        },
        getPlannedLabelForIndex() {
            return '휴식';
        },
        getSplitActivities(type, baseIndex) {
            const slot = this.timeSlots[baseIndex];
            return this.normalizePlanActivitiesArray(slot.planActivities).map(item => ({ ...item }));
        },
    };

    const result = getPlanActivitiesWithVirtualGaps.call(ctx, 0);

    assert.deepEqual(result, [{ label: '휴식', seconds: 3600, startMinute: 0, durationMinutes: 60 }]);
    assert.equal(result[0].kind, undefined);
});
