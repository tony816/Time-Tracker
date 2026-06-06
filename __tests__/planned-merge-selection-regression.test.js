const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const controller = require('../controllers/selection-overlay-controller');
const planSegmentCore = require('../core/plan-segment-core');
const { buildMethod } = require('./helpers/script-method-builder');

const { selectFieldRange, undoMerge } = controller;
const mergeSelectedFields = buildMethod('mergeSelectedFields(type)', '(type)');
const scriptSource = fs.readFileSync(path.join(__dirname, '..', 'script.js'), 'utf8');

function createSlot(overrides = {}) {
    return {
        time: '',
        planned: '',
        actual: '',
        planActivities: [],
        planTitle: '',
        planTitleBandOn: false,
        planSegmentTimers: {},
        activityLog: {
            title: '',
            details: '',
            subActivities: [],
            titleBandOn: false,
            actualGridUnits: [],
            actualExtraGridUnits: [],
            actualFailedGridUnits: [],
            actualOverride: false,
        },
        ...overrides,
    };
}

function createMergeContext(slots) {
    return {
        timeSlots: slots,
        mergedFields: new Map(),
        selectedPlannedFields: new Set(),
        selectedActualFields: new Set(),
        normalizePlanActivitiesArray(items) {
            return Array.isArray(items) ? items.map((item) => ({ ...item })) : [];
        },
        normalizePlanActivitiesPreservingSegments(items) {
            return Array.isArray(items)
                ? items
                    .filter((item) => item && item.kind !== 'virtual-rest' && item.virtual !== true)
                    .map((item) => ({ ...item }))
                : [];
        },
        normalizeActivitiesArray(items) {
            return Array.isArray(items) ? items.map((item) => ({ ...item })) : [];
        },
        formatActivitiesSummary(items) {
            return items.map((item) => item.label).join(' + ');
        },
        findMergeKey(type, index) {
            for (const key of this.mergedFields.keys()) {
                const [keyType, startStr, endStr] = key.split('-');
                const start = parseInt(startStr, 10);
                const end = parseInt(endStr, 10);
                if (keyType === type && index >= start && index <= end) return key;
            }
            return null;
        },
        renderTimeEntriesCalls: 0,
        renderTimeEntries() {
            this.renderTimeEntriesCalls += 1;
        },
        clearAllSelectionsCalls: 0,
        clearAllSelections() {
            this.clearAllSelectionsCalls += 1;
        },
        calculateTotalsCalls: 0,
        calculateTotals() {
            this.calculateTotalsCalls += 1;
        },
        autoSaveCalls: 0,
        autoSave() {
            this.autoSaveCalls += 1;
        },
        showUndoButtonCalls: [],
        showUndoButton(type, mergeKey) {
            this.showUndoButtonCalls.push({ type, mergeKey });
        },
        hideUndoButton() {},
        clearSelection() {},
    };
}

function withDocumentQuery(value, fn) {
    const originalDocument = global.document;
    global.document = {
        querySelector() {
            return { value };
        },
    };
    try {
        return fn();
    } finally {
        global.document = originalDocument;
    }
}

test('selectFieldRange expands to merged planned slot boundaries', () => {
    const ctx = {
        timeSlots: new Array(12).fill({}),
        selectedPlannedFields: new Set(),
        selectedActualFields: new Set(),
        getPlannedRangeInfo(index) {
            if (index >= 2 && index <= 4) return { startIndex: 2, endIndex: 4, mergeKey: 'planned-2-4' };
            if (index >= 7 && index <= 8) return { startIndex: 7, endIndex: 8, mergeKey: 'planned-7-8' };
            return { startIndex: index, endIndex: index, mergeKey: null };
        },
        clearSelection(type) {
            if (type === 'planned') this.selectedPlannedFields.clear();
            if (type === 'actual') this.selectedActualFields.clear();
        },
        updateSelectionOverlayCalls: [],
        updateSelectionOverlay(type) {
            this.updateSelectionOverlayCalls.push(type);
        },
        showMergeButtonCalls: [],
        showMergeButton(type) {
            this.showMergeButtonCalls.push(type);
        },
        showScheduleButtonForSelectionCalls: [],
        showScheduleButtonForSelection(type) {
            this.showScheduleButtonForSelectionCalls.push(type);
        },
    };

    selectFieldRange.call(ctx, 'planned', 3, 7);

    assert.deepEqual(Array.from(ctx.selectedPlannedFields), [2, 3, 4, 5, 6, 7, 8]);
    assert.deepEqual(ctx.updateSelectionOverlayCalls, ['planned']);
    assert.deepEqual(ctx.showMergeButtonCalls, ['planned']);
    assert.deepEqual(ctx.showScheduleButtonForSelectionCalls, ['planned']);
});

test('merged planned drag start no longer depends on hold delay', () => {
    const anchor = scriptSource.slice(
        scriptSource.indexOf('if (!this.isSelectingPlanned && this.pendingMergedMouseSelection)'),
        scriptSource.indexOf("if (!this.isSelectingPlanned || this.currentColumnType !== 'planned')")
    );

    assert.match(anchor, /if \(movedPx >= 4\)/);
    assert.doesNotMatch(anchor, /elapsedMs\s*>=\s*220/);
});

test('mergeSelectedFields preserves segmented plan data, metadata, timers, and empty virtual-rest space', () => {
    global.TimeTrackerPlanSegmentCore = planSegmentCore;
    const ctx = createMergeContext([
        createSlot({
            time: '4',
            planned: 'Morning',
            planTitle: 'Title Band',
            planTitleBandOn: true,
            planActivities: [
                {
                    label: 'Focus',
                    activityId: 'focus-id',
                    activityText: 'Focus',
                    titleActivityId: 'title-id',
                    titleText: 'Title Band',
                    seconds: 1200,
                    startMinute: 0,
                    endMinute: 20,
                    durationMinutes: 20,
                },
                {
                    label: 'Review',
                    activityId: 'review-id',
                    activityText: 'Review',
                    seconds: 1200,
                    startMinute: 40,
                    endMinute: 60,
                    durationMinutes: 20,
                },
            ],
            planSegmentTimers: {
                'planned-0-0-seg0': { status: 'paused', running: false, elapsedSeconds: 90, method: 'plan-segment' },
                'planned-0-0-seg1': { status: 'running', running: true, startedAt: 555, method: 'plan-segment' },
            },
        }),
        createSlot({ time: '5' }),
    ]);
    ctx.selectedPlannedFields = new Set([0, 1]);

    withDocumentQuery('Morning', () => mergeSelectedFields.call(ctx, 'planned'));

    assert.equal(ctx.mergedFields.get('planned-0-1'), 'Focus + Review');
    assert.deepEqual(ctx.timeSlots[0].planActivities.map((item) => ({
        label: item.label,
        activityId: item.activityId,
        titleActivityId: item.titleActivityId,
        titleText: item.titleText,
        startMinute: item.startMinute,
        endMinute: item.endMinute,
        durationMinutes: item.durationMinutes,
        seconds: item.seconds,
    })), [
        {
            label: 'Focus',
            activityId: 'focus-id',
            titleActivityId: 'title-id',
            titleText: 'Title Band',
            startMinute: 0,
            endMinute: 20,
            durationMinutes: 20,
            seconds: 1200,
        },
        {
            label: 'Review',
            activityId: 'review-id',
            titleActivityId: undefined,
            titleText: undefined,
            startMinute: 40,
            endMinute: 60,
            durationMinutes: 20,
            seconds: 1200,
        },
    ]);
    assert.deepEqual(planSegmentCore.calculateVirtualRestGaps(ctx.timeSlots[0].planActivities, {
        startMinute: 0,
        endMinute: 120,
    }).map((gap) => ({ startMinute: gap.startMinute, durationMinutes: gap.durationMinutes })), [
        { startMinute: 20, durationMinutes: 20 },
        { startMinute: 60, durationMinutes: 60 },
    ]);
    assert.equal(ctx.timeSlots[0].planTitle, 'Title Band');
    assert.equal(ctx.timeSlots[0].planTitleBandOn, true);
    assert.equal(ctx.timeSlots[0].planSegmentTimers['planned-0-1-seg0'].status, 'paused');
    assert.equal(ctx.timeSlots[0].planSegmentTimers['planned-0-1-seg1'].status, 'running');
    assert.deepEqual(ctx.timeSlots[1].planActivities, []);
    assert.deepEqual(ctx.timeSlots[1].planSegmentTimers, {});
});

test('mergeSelectedFields concatenates existing segmented merge boundaries in chronological order', () => {
    global.TimeTrackerPlanSegmentCore = planSegmentCore;
    const ctx = createMergeContext([
        createSlot({
            time: '4',
            planned: 'A',
            planActivities: [
                { label: 'A1', seconds: 1800, startMinute: 0, endMinute: 30, durationMinutes: 30 },
                { label: 'A2', seconds: 1200, startMinute: 40, endMinute: 60, durationMinutes: 20 },
            ],
        }),
        createSlot({ time: '5' }),
        createSlot({
            time: '6',
            planned: 'B',
            planActivities: [
                { label: 'B1', seconds: 600, startMinute: 0, endMinute: 10, durationMinutes: 10 },
            ],
        }),
    ]);
    ctx.mergedFields.set('planned-0-1', 'A');
    ctx.mergedFields.set('time-0-1', '4-5');
    ctx.mergedFields.set('actual-0-1', '');
    ctx.selectedPlannedFields = new Set([1, 2]);

    withDocumentQuery('A', () => mergeSelectedFields.call(ctx, 'planned'));

    assert.equal(ctx.mergedFields.has('planned-0-1'), false);
    assert.equal(ctx.mergedFields.has('planned-0-2'), true);
    assert.deepEqual(ctx.timeSlots[0].planActivities.map((item) => ({
        label: item.label,
        startMinute: item.startMinute,
        endMinute: item.endMinute,
    })), [
        { label: 'A1', startMinute: 0, endMinute: 30 },
        { label: 'A2', startMinute: 40, endMinute: 60 },
        { label: 'B1', startMinute: 120, endMinute: 130 },
    ]);
});

test('undoMerge restores original segmented slots and plan segment timers from merge metadata', () => {
    global.TimeTrackerPlanSegmentCore = planSegmentCore;
    const ctx = createMergeContext([
        createSlot({
            time: '4',
            planned: 'A',
            planActivities: [
                { label: 'A', seconds: 1800, startMinute: 0, endMinute: 30, durationMinutes: 30 },
            ],
            planSegmentTimers: {
                'planned-0-0-seg0': { status: 'paused', elapsedSeconds: 45, method: 'plan-segment' },
            },
        }),
        createSlot({
            time: '5',
            planned: 'B',
            planActivities: [
                { label: 'B', seconds: 1200, startMinute: 10, endMinute: 30, durationMinutes: 20 },
            ],
            planSegmentTimers: {
                'planned-1-1-seg0': { status: 'running', running: true, startedAt: 999, method: 'plan-segment' },
            },
        }),
    ]);
    ctx.selectedPlannedFields = new Set([0, 1]);
    withDocumentQuery('A', () => mergeSelectedFields.call(ctx, 'planned'));

    undoMerge.call(ctx, 'planned', 'planned-0-1');

    assert.equal(ctx.mergedFields.has('planned-0-1'), false);
    assert.deepEqual(ctx.timeSlots[0].planActivities.map((item) => item.label), ['A']);
    assert.deepEqual(ctx.timeSlots[1].planActivities.map((item) => item.label), ['B']);
    assert.equal(ctx.timeSlots[0].planSegmentTimers['planned-0-0-seg0'].status, 'paused');
    assert.equal(ctx.timeSlots[1].planSegmentTimers['planned-1-1-seg0'].status, 'running');
    assert.equal(ctx.timeSlots[1].planSegmentTimers['planned-1-1-seg0'].startedAt, 999);
});
