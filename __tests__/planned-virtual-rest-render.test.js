const test = require('node:test');
const assert = require('node:assert/strict');

globalThis.TimeTrackerActualGridCore = require('../core/actual-grid-core');
globalThis.TimeTrackerPlanSegmentCore = require('../core/plan-segment-core');

const { buildMethod } = require('./helpers/script-method-builder');

const computeSplitSegments = buildMethod('computeSplitSegments(type, index)', '(type, index)');
const getSplitActivities = buildMethod('getSplitActivities(type, baseIndex)', '(type, baseIndex)');

function createContext(planActivities, overrides = {}) {
    const slot = {
        planned: '',
        planTitle: '',
        planTitleBandOn: false,
        planActivities,
    };
    return {
        timeSlots: [slot],
        actualRecordingDisabled: true,
        mergedFields: new Map(),
        findMergeKey() {
            return null;
        },
        getSplitBaseIndex(type, index) {
            assert.equal(type, 'planned');
            return index;
        },
        getSplitRange(type, index) {
            assert.equal(type, 'planned');
            return { start: index, end: index };
        },
        getBlockLength(type, index) {
            assert.equal(type, 'planned');
            assert.equal(index, 0);
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
        getSplitActivities,
        ...overrides,
    };
}

test('computeSplitSegments renders a virtual rest gap for unfilled planned block time', () => {
    const planActivities = [{ label: 'work', seconds: 40 * 60 }];
    const ctx = createContext(planActivities);

    const result = computeSplitSegments.call(ctx, 'planned', 0);

    assert.equal(ctx.timeSlots[0].planActivities, planActivities);
    assert.deepEqual(ctx.timeSlots[0].planActivities, [{ label: 'work', seconds: 40 * 60 }]);
    assert.ok(result);
    assert.equal(result.gridSegments.length, 2);
    assert.equal(result.gridSegments[0].label, 'work');
    assert.equal(result.gridSegments[0].span, 4);
    assert.equal(result.gridSegments[1].label, '휴식');
    assert.equal(result.gridSegments[1].kind, 'virtual-rest');
    assert.equal(result.gridSegments[1].virtual, true);
    assert.equal(result.gridSegments[1].durationMinutes, 20);
    assert.equal(result.gridSegments[1].span, 2);
});

test('computeSplitSegments does not render a virtual rest gap under ten minutes', () => {
    const ctx = createContext([{ label: 'work', seconds: 55 * 60 }]);

    const result = computeSplitSegments.call(ctx, 'planned', 0);

    assert.ok(result);
    assert.equal(result.gridSegments.length, 1);
    assert.equal(result.gridSegments[0].label, 'work');
    assert.equal(result.gridSegments[0].span, 6);
    assert.equal(result.gridSegments.some(segment => segment.kind === 'virtual-rest'), false);
});

test('computeSplitSegments renders a single virtual rest segment for an empty planned block', () => {
    const ctx = createContext([]);

    const result = computeSplitSegments.call(ctx, 'planned', 0);

    assert.ok(result);
    assert.equal(result.gridSegments.length, 1);
    assert.equal(result.gridSegments[0].label, '휴식');
    assert.equal(result.gridSegments[0].kind, 'virtual-rest');
    assert.equal(result.gridSegments[0].span, 6);
});

test('computeSplitSegments keeps a real saved rest activity distinct from virtual rest', () => {
    const ctx = createContext([{ label: '휴식', seconds: 60 * 60 }]);

    const result = computeSplitSegments.call(ctx, 'planned', 0);

    assert.ok(result);
    assert.equal(result.gridSegments.length, 1);
    assert.equal(result.gridSegments[0].label, '휴식');
    assert.equal(result.gridSegments[0].kind, undefined);
    assert.equal(result.gridSegments[0].virtual, undefined);
});

test('computeSplitSegments preserves parent title metadata on child planned segments', () => {
    const ctx = createContext([
        {
            label: 'english',
            seconds: 40 * 60,
            titleActivityId: 'study',
            titleText: 'study',
            activityId: 'english',
            activityText: 'english',
        },
    ]);

    const result = computeSplitSegments.call(ctx, 'planned', 0);

    assert.ok(result);
    assert.equal(result.gridSegments[0].label, 'english');
    assert.equal(result.gridSegments[0].titleLabel, 'study');
});
