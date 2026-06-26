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

test('computeSplitSegments does not render full-row virtual rest for an empty planned block', () => {
    const ctx = createContext([]);

    const result = computeSplitSegments.call(ctx, 'planned', 0);

    assert.equal(result, null);
});

test('computeSplitSegments renders leading and trailing virtual rest around a middle real segment', () => {
    const ctx = createContext([
        { label: 'shower', seconds: 20 * 60, startMinute: 20, durationMinutes: 20, endMinute: 40 },
    ]);

    const result = computeSplitSegments.call(ctx, 'planned', 0);

    assert.ok(result);
    assert.equal(result.gridSegments.length, 3);
    assert.equal(result.gridSegments[0].kind, 'virtual-rest');
    assert.equal(result.gridSegments[0].startMinute, 0);
    assert.equal(result.gridSegments[0].durationMinutes, 20);
    assert.equal(result.gridSegments[1].label, 'shower');
    assert.equal(result.gridSegments[1].startMinute, 20);
    assert.equal(result.gridSegments[1].endMinute, 40);
    assert.equal(result.gridSegments[2].kind, 'virtual-rest');
    assert.equal(result.gridSegments[2].startMinute, 40);
    assert.equal(result.gridSegments[2].durationMinutes, 20);
});

test('computeSplitSegments omits virtual rest between adjacent real segments', () => {
    const ctx = createContext([
        { label: 'A', seconds: 30 * 60, startMinute: 0, durationMinutes: 30, endMinute: 30 },
        { label: 'B', seconds: 30 * 60, startMinute: 30, durationMinutes: 30, endMinute: 60 },
    ]);

    const result = computeSplitSegments.call(ctx, 'planned', 0);

    assert.ok(result);
    assert.equal(result.gridSegments.length, 2);
    assert.equal(result.gridSegments[0].label, 'A');
    assert.equal(result.gridSegments[1].label, 'B');
    assert.equal(result.gridSegments.some(segment => segment.kind === 'virtual-rest'), false);
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

test('computeSplitSegments groups adjacent same planned activity for display timing and keeps resize on the later segment', () => {
    const ctx = createContext([
        { label: 'Exercise', seconds: 20 * 60, startMinute: 0, durationMinutes: 20, endMinute: 20 },
        { label: 'Exercise', seconds: 40 * 60, startMinute: 20, durationMinutes: 40, endMinute: 60 },
    ]);

    const result = computeSplitSegments.call(ctx, 'planned', 0);

    assert.ok(result);
    assert.equal(result.gridSegments.length, 1);
    assert.equal(result.gridSegments[0].label, 'Exercise');
    assert.equal(result.gridSegments[0].durationMinutes, 60);
    assert.equal(result.gridSegments[0].startMinute, 0);
    assert.equal(result.gridSegments[0].endMinute, 60);
    assert.equal(result.gridSegments[0].timerSegmentIndex, 0);
    assert.equal(result.gridSegments[0].segmentIndex, 1);
});

test('computeSplitSegments keeps non-adjacent same planned activity timing separate', () => {
    const ctx = createContext([
        { label: 'Exercise', seconds: 20 * 60, startMinute: 0, durationMinutes: 20, endMinute: 20 },
        { label: 'Study', seconds: 20 * 60, startMinute: 20, durationMinutes: 20, endMinute: 40 },
        { label: 'Exercise', seconds: 20 * 60, startMinute: 40, durationMinutes: 20, endMinute: 60 },
    ]);

    const result = computeSplitSegments.call(ctx, 'planned', 0);

    assert.ok(result);
    assert.deepEqual(result.gridSegments.map(segment => ({
        label: segment.label,
        durationMinutes: segment.durationMinutes,
        segmentIndex: segment.segmentIndex,
        timerSegmentIndex: segment.timerSegmentIndex,
    })), [
        { label: 'Exercise', durationMinutes: 20, segmentIndex: 0, timerSegmentIndex: 0 },
        { label: 'Study', durationMinutes: 20, segmentIndex: 1, timerSegmentIndex: 1 },
        { label: 'Exercise', durationMinutes: 20, segmentIndex: 2, timerSegmentIndex: 2 },
    ]);
});
