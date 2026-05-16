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
const resizePlanActivitySegment = buildMethod(
    'resizePlanActivitySegment(baseIndex, activityIndex, edge, deltaMinutes)',
    '(baseIndex, activityIndex, edge, deltaMinutes)'
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

test('right resize shrink creates a trailing virtual rest gap', () => {
    const ctx = {
        timeSlots: [{ planned: 'Work', planActivities: [{ label: 'Work', seconds: 3600 }] }],
        getBlockLength() {
            return 1;
        },
        normalizePlanActivitiesArray(value) {
            return require('../core/activity-core').normalizePlanActivitiesArray(value);
        },
        isPlanSegmentTimerRunning() {
            return false;
        },
        renderTimeEntries() {},
        calculateTotals() {},
        autoSave() {},
    };

    const changed = resizePlanActivitySegment.call(ctx, 0, 0, 'right', -30);
    const gaps = getPlanActivitiesWithVirtualGaps.call({
        ...ctx,
        getSplitActivities(type, baseIndex) {
            return this.normalizePlanActivitiesArray(this.timeSlots[baseIndex].planActivities).map(item => ({ ...item }));
        },
        getPlannedLabelForIndex() {
            return 'Work';
        },
    }, 0);

    assert.equal(changed, true);
    assert.equal(ctx.timeSlots[0].planActivities[0].durationMinutes, 30);
    assert.equal(gaps.some((item) => item.kind === 'virtual-rest' && item.durationMinutes === 30), true);
});

test('left resize shrink creates a leading virtual rest gap', () => {
    const ctx = {
        timeSlots: [{ planned: 'Work', planActivities: [{ label: 'Work', seconds: 3600 }] }],
        getBlockLength() {
            return 1;
        },
        normalizePlanActivitiesArray(value) {
            return require('../core/activity-core').normalizePlanActivitiesArray(value);
        },
        isPlanSegmentTimerRunning() {
            return false;
        },
        renderTimeEntries() {},
        calculateTotals() {},
        autoSave() {},
    };

    const changed = resizePlanActivitySegment.call(ctx, 0, 0, 'left', 20);
    const items = getPlanActivitiesWithVirtualGaps.call({
        ...ctx,
        getSplitActivities(type, baseIndex) {
            return this.normalizePlanActivitiesArray(this.timeSlots[baseIndex].planActivities).map(item => ({ ...item }));
        },
        getPlannedLabelForIndex() {
            return 'Work';
        },
    }, 0);

    assert.equal(changed, true);
    assert.equal(ctx.timeSlots[0].planActivities[0].startMinute, 20);
    assert.equal(ctx.timeSlots[0].planActivities[0].durationMinutes, 40);
    assert.equal(items[0].kind, 'virtual-rest');
    assert.equal(items[0].durationMinutes, 20);
});

test('resize expansion is blocked by adjacent real segments and running timers', () => {
    const ctx = {
        timeSlots: [{
            planned: 'A · B',
            planActivities: [
                { label: 'A', seconds: 1800, startMinute: 0, durationMinutes: 30 },
                { label: 'B', seconds: 1800, startMinute: 30, durationMinutes: 30 },
            ],
            planSegmentTimers: { 'planned-0-0-seg0': { running: true } },
        }],
        getBlockLength() {
            return 1;
        },
        normalizePlanActivitiesArray(value) {
            return require('../core/activity-core').normalizePlanActivitiesArray(value);
        },
        isPlanSegmentTimerRunning(baseIndex) {
            return Object.values(this.timeSlots[baseIndex].planSegmentTimers).some((timer) => timer.running);
        },
        renderTimeEntries() {
            assert.fail('running resize should not render');
        },
        calculateTotals() {},
        autoSave() {},
    };

    assert.equal(resizePlanActivitySegment.call(ctx, 0, 0, 'right', 20), false);
    ctx.timeSlots[0].planSegmentTimers['planned-0-0-seg0'].running = false;
    assert.equal(resizePlanActivitySegment.call(ctx, 0, 0, 'right', 20), false);
    assert.equal(ctx.timeSlots[0].planActivities[0].durationMinutes, 30);
});
