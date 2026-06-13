const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const controller = require('../controllers/selection-overlay-controller');
const fieldInteractionController = require('../controllers/field-interaction-controller');
const planSegmentCore = require('../core/plan-segment-core');
const stateCore = require('../core/timesheet-state-core');
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

function createListenerNode() {
    const listeners = {};
    return {
        dataset: {},
        addEventListener(type, handler) {
            if (!listeners[type]) listeners[type] = [];
            listeners[type].push(handler);
        },
        dispatchEvent(event) {
            (listeners[event.type] || []).forEach((handler) => handler(event));
        },
        closest() {
            return null;
        },
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
        notifications: [],
        showNotification(message, type, options) {
            this.notifications.push({ message, type, options });
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

function createListenerNode() {
    const listeners = {};
    return {
        dataset: {},
        closest() {
            return null;
        },
        addEventListener(type, handler) {
            if (!listeners[type]) listeners[type] = [];
            listeners[type].push(handler);
        },
        dispatchEvent(event) {
            (listeners[event.type] || []).forEach((handler) => handler(event));
        },
    };
}

function withMockDocument(fn) {
    const originalDocument = global.document;
    const listeners = {};
    global.document = {
        addEventListener(type, handler) {
            if (!listeners[type]) listeners[type] = [];
            listeners[type].push(handler);
        },
        removeEventListener(type, handler) {
            listeners[type] = (listeners[type] || []).filter((item) => item !== handler);
        },
        dispatchEvent(event) {
            (listeners[event.type] || []).slice().forEach((handler) => handler(event));
        },
    };
    try {
        return fn(global.document);
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

test('existing merged planned range selected from time slot shows undo instead of new merge', () => {
    const ctx = {
        timeSlots: new Array(6).fill({}),
        selectedPlannedFields: new Set(),
        selectedActualFields: new Set(),
        getPlannedRangeInfo(index) {
            if (index >= 1 && index <= 3) return { startIndex: 1, endIndex: 3, mergeKey: 'planned-1-3' };
            return { startIndex: index, endIndex: index, mergeKey: null };
        },
        findMergeKey(type, index) {
            return type === 'planned' && index >= 1 && index <= 3 ? 'planned-1-3' : null;
        },
        getMergeRangeBounds(mergeKey) {
            assert.equal(mergeKey, 'planned-1-3');
            return { start: 1, end: 3 };
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
        showUndoButtonCalls: [],
        showUndoButton(type, mergeKey) {
            this.showUndoButtonCalls.push({ type, mergeKey });
        },
        showScheduleButtonForSelectionCalls: [],
        showScheduleButtonForSelection(type) {
            this.showScheduleButtonForSelectionCalls.push(type);
        },
    };

    selectFieldRange.call(ctx, 'planned', 1, 3);

    assert.deepEqual(Array.from(ctx.selectedPlannedFields), [1, 2, 3]);
    assert.deepEqual(ctx.showMergeButtonCalls, []);
    assert.deepEqual(ctx.showUndoButtonCalls, [{ type: 'planned', mergeKey: 'planned-1-3' }]);
    assert.deepEqual(ctx.showScheduleButtonForSelectionCalls, ['planned']);
});

test('time-slot initiated selection can merge selected fields and preserve segmented planned data', () => {
    global.TimeTrackerPlanSegmentCore = planSegmentCore;
    const timeSlot = createListenerNode();
    const entryDiv = {
        querySelector(selector) {
            return selector === '.time-slot-container' ? timeSlot : null;
        },
    };
    const ctx = createMergeContext([
        createSlot({
            time: '4',
            planned: 'Morning',
            planActivities: [
                { label: 'Focus', seconds: 1200, startMinute: 0, endMinute: 20, durationMinutes: 20 },
            ],
            planSegmentTimers: {
                'planned-0-0-seg0': { status: 'paused', elapsedSeconds: 30, method: 'plan-segment' },
            },
        }),
        createSlot({
            time: '5',
            planned: 'Review',
            planActivities: [
                { label: 'Review', seconds: 900, startMinute: 10, endMinute: 25, durationMinutes: 15 },
            ],
        }),
    ]);
    Object.assign(ctx, {
        currentColumnType: null,
        isSelectingPlanned: false,
        dragStartIndex: -1,
        dragBaseEndIndex: -1,
        getPlannedRangeInfo(index) {
            return { startIndex: index, endIndex: index, mergeKey: null };
        },
        closeInlinePlanDropdown() {},
        clearSelection(type) {
            if (type === 'planned') this.selectedPlannedFields.clear();
            if (type === 'actual') this.selectedActualFields.clear();
        },
        updateSelectionOverlay() {},
        showMergeButton() {},
        showScheduleButtonForSelection() {},
        selectFieldRange,
    });

    fieldInteractionController.attachTimeSlotMergeEntryListeners.call(ctx, entryDiv, 0);
    timeSlot.dispatchEvent({
        type: 'mousedown',
        button: 0,
        target: timeSlot,
        preventDefault() {},
        stopPropagation() {},
    });
    selectFieldRange.call(ctx, 'planned', 0, 1);
    withDocumentQuery('Morning', () => mergeSelectedFields.call(ctx, 'planned'));

    assert.equal(ctx.mergedFields.get('planned-0-1'), 'Focus + Review');
    assert.deepEqual(ctx.timeSlots[0].planActivities.map((item) => ({
        label: item.label,
        startMinute: item.startMinute,
        endMinute: item.endMinute,
    })), [
        { label: 'Focus', startMinute: 0, endMinute: 20 },
        { label: 'Review', startMinute: 70, endMinute: 85 },
    ]);
    assert.equal(ctx.timeSlots[0].planSegmentTimers['planned-0-1-seg0'].status, 'paused');
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

test('time-slot-initiated selection can reuse mergeSelectedFields and preserve segmented planned data', () => {
    global.TimeTrackerPlanSegmentCore = planSegmentCore;
    const ctx = createMergeContext([
        createSlot({
            time: '4',
            planned: 'Morning',
            planActivities: [
                {
                    label: 'Focus',
                    activityId: 'focus-id',
                    activityText: 'Focus',
                    seconds: 1800,
                    startMinute: 0,
                    endMinute: 30,
                    durationMinutes: 30,
                },
            ],
        }),
        createSlot({
            time: '5',
            planned: 'Review',
            planActivities: [
                {
                    label: 'Review',
                    activityId: 'review-id',
                    activityText: 'Review',
                    seconds: 1200,
                    startMinute: 0,
                    endMinute: 20,
                    durationMinutes: 20,
                },
            ],
        }),
    ]);
    ctx.closeInlinePlanDropdown = () => {};
    ctx.clearSelection = (type) => {
        if (type === 'planned') ctx.selectedPlannedFields.clear();
    };
    ctx.selectFieldRange = (type, start, end) => {
        if (type !== 'planned') return;
        for (let i = Math.min(start, end); i <= Math.max(start, end); i += 1) {
            ctx.selectedPlannedFields.add(i);
        }
    };
    ctx.getIndexAtClientPosition = () => 1;

    withMockDocument((mockDocument) => {
        const timeSlot = createListenerNode();
        const entryDiv = {
            querySelector(selector) {
                return selector === '.time-slot-container' ? timeSlot : null;
            },
        };
        fieldInteractionController.attachTimeSlotMergeEntryListeners.call(ctx, entryDiv, 0);
        timeSlot.dispatchEvent({
            type: 'mousedown',
            button: 0,
            target: timeSlot,
            preventDefault() {},
            stopPropagation() {},
        });
        mockDocument.dispatchEvent({
            type: 'mousemove',
            buttons: 1,
            clientX: 10,
            clientY: 20,
        });
        mockDocument.dispatchEvent({
            type: 'mouseup',
            preventDefault() {},
            stopPropagation() {},
        });
    });

    assert.deepEqual(Array.from(ctx.selectedPlannedFields), [0, 1]);

    withDocumentQuery('Morning', () => mergeSelectedFields.call(ctx, 'planned'));

    assert.equal(ctx.mergedFields.get('planned-0-1'), 'Focus + Review');
    assert.deepEqual(ctx.timeSlots[0].planActivities.map((item) => ({
        label: item.label,
        activityId: item.activityId,
        startMinute: item.startMinute,
        endMinute: item.endMinute,
        durationMinutes: item.durationMinutes,
    })), [
        {
            label: 'Focus',
            activityId: 'focus-id',
            startMinute: 0,
            endMinute: 30,
            durationMinutes: 30,
        },
        {
            label: 'Review',
            activityId: 'review-id',
            startMinute: 60,
            endMinute: 80,
            durationMinutes: 20,
        },
    ]);
    assert.deepEqual(ctx.timeSlots[1].planActivities, []);
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

test('mergeSelectedFields rebases empty slot plus segmented slot and preserves title metadata', () => {
    global.TimeTrackerPlanSegmentCore = planSegmentCore;
    const ctx = createMergeContext([
        createSlot({ time: '4' }),
        createSlot({
            time: '5',
            planned: 'Study',
            planTitle: 'Study Block',
            planTitleBandOn: true,
            planActivities: [
                {
                    label: 'Read',
                    activityId: 'read-id',
                    activityText: 'Read',
                    titleActivityId: 'study-title',
                    titleText: 'Study Block',
                    seconds: 1200,
                    startMinute: 0,
                    endMinute: 20,
                    durationMinutes: 20,
                },
            ],
            planSegmentTimers: {
                'planned-1-1-seg0': { status: 'paused', running: false, elapsedSeconds: 120, method: 'plan-segment' },
            },
        }),
    ]);
    ctx.selectedPlannedFields = new Set([0, 1]);

    withDocumentQuery('', () => mergeSelectedFields.call(ctx, 'planned'));

    assert.deepEqual(ctx.timeSlots[0].planActivities.map((item) => ({
        label: item.label,
        activityId: item.activityId,
        activityText: item.activityText,
        titleActivityId: item.titleActivityId,
        titleText: item.titleText,
        startMinute: item.startMinute,
        endMinute: item.endMinute,
        durationMinutes: item.durationMinutes,
        seconds: item.seconds,
    })), [
        {
            label: 'Read',
            activityId: 'read-id',
            activityText: 'Read',
            titleActivityId: 'study-title',
            titleText: 'Study Block',
            startMinute: 60,
            endMinute: 80,
            durationMinutes: 20,
            seconds: 1200,
        },
    ]);
    assert.equal(ctx.timeSlots[0].planTitle, 'Study Block');
    assert.equal(ctx.timeSlots[0].planTitleBandOn, true);
    assert.equal(ctx.timeSlots[0].planSegmentTimers['planned-0-1-seg0'].elapsedSeconds, 120);
    assert.deepEqual(planSegmentCore.calculateVirtualRestGaps(ctx.timeSlots[0].planActivities, {
        startMinute: 0,
        endMinute: 120,
    }).map((gap) => ({ startMinute: gap.startMinute, durationMinutes: gap.durationMinutes })), [
        { startMinute: 0, durationMinutes: 60 },
        { startMinute: 80, durationMinutes: 40 },
    ]);
});

test('mergeSelectedFields never persists virtual-rest activities into merged slots', () => {
    global.TimeTrackerPlanSegmentCore = planSegmentCore;
    const ctx = createMergeContext([
        createSlot({
            time: '4',
            planned: 'Focus',
            planActivities: [
                { label: 'Focus', seconds: 1200, startMinute: 0, endMinute: 20, durationMinutes: 20 },
                { kind: 'virtual-rest', virtual: true, label: 'Rest', startMinute: 20, durationMinutes: 40 },
            ],
        }),
        createSlot({ time: '5' }),
    ]);
    ctx.selectedPlannedFields = new Set([0, 1]);

    withDocumentQuery('Focus', () => mergeSelectedFields.call(ctx, 'planned'));

    assert.equal(ctx.timeSlots[0].planActivities.some((item) => item.kind === 'virtual-rest' || item.virtual === true), false);
    assert.deepEqual(ctx.timeSlots[0].planActivities.map((item) => ({
        label: item.label,
        startMinute: item.startMinute,
        endMinute: item.endMinute,
    })), [
        { label: 'Focus', startMinute: 0, endMinute: 20 },
    ]);
    assert.deepEqual(planSegmentCore.calculateVirtualRestGaps(ctx.timeSlots[0].planActivities, {
        startMinute: 0,
        endMinute: 120,
    }).map((gap) => ({ startMinute: gap.startMinute, durationMinutes: gap.durationMinutes })), [
        { startMinute: 20, durationMinutes: 100 },
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

test('blocked segmented merge shows user notice and preserves state and selection', () => {
    global.TimeTrackerPlanSegmentCore = planSegmentCore;
    const ctx = createMergeContext([
        createSlot({
            time: '4',
            planned: 'A',
            planActivities: [
                { label: 'A', seconds: 600, startMinute: 0, endMinute: 10, durationMinutes: 10 },
            ],
            planSegmentTimers: {
                'planned-0-0-seg99': { status: 'running', running: true, startedAt: 123 },
            },
        }),
        createSlot({ time: '5', planned: '' }),
    ]);
    ctx.selectedPlannedFields = new Set([0, 1]);
    const beforeSlots = JSON.stringify(ctx.timeSlots);
    const beforeMerged = JSON.stringify([...ctx.mergedFields.entries()]);

    withDocumentQuery('A', () => mergeSelectedFields.call(ctx, 'planned'));

    assert.equal(JSON.stringify(ctx.timeSlots), beforeSlots);
    assert.equal(JSON.stringify([...ctx.mergedFields.entries()]), beforeMerged);
    assert.deepEqual([...ctx.selectedPlannedFields], [0, 1]);
    assert.equal(ctx.notifications.length, 1);
    assert.equal(ctx.notifications[0].type, 'error');
    assert.match(ctx.notifications[0].message, /계획 병합을 진행할 수 없습니다/);
    assert.equal(ctx.renderTimeEntriesCalls, 0);
    assert.equal(ctx.autoSaveCalls, 0);
});

test('undoMerge invalidates stale snapshot after merged base plan edit instead of restoring old data', () => {
    global.TimeTrackerPlanSegmentCore = planSegmentCore;
    const ctx = createMergeContext([
        createSlot({
            time: '4',
            planned: 'A',
            planActivities: [
                { label: 'A', seconds: 600, startMinute: 0, endMinute: 10, durationMinutes: 10 },
            ],
            planSegmentTimers: {},
        }),
        createSlot({
            time: '5',
            planned: 'B',
            planActivities: [
                { label: 'B', seconds: 600, startMinute: 0, endMinute: 10, durationMinutes: 10 },
            ],
            planSegmentTimers: {},
        }),
    ]);
    ctx.selectedPlannedFields = new Set([0, 1]);
    withDocumentQuery('A', () => mergeSelectedFields.call(ctx, 'planned'));
    assert.equal(Boolean(ctx.timeSlots[0].planMergeSnapshot), true);

    ctx.timeSlots[0].planned = 'Edited after merge';
    ctx.timeSlots[0].planActivities = [
        { label: 'Edited', seconds: 1200, startMinute: 0, endMinute: 20, durationMinutes: 20 },
    ];

    undoMerge.call(ctx, 'planned', 'planned-0-1');

    assert.equal(ctx.timeSlots[0].planned, 'Edited after merge');
    assert.deepEqual(ctx.timeSlots[0].planActivities.map((item) => item.label), ['Edited']);
    assert.equal(ctx.timeSlots[1].planned, '');
    assert.equal(ctx.timeSlots[0].planMergeSnapshot, undefined);
});

test('planMergeSnapshot survives state snapshot restore enough for undoMerge to restore segments and timers', () => {
    global.TimeTrackerPlanSegmentCore = planSegmentCore;
    const ctx = createMergeContext([
        createSlot({
            time: '4',
            planned: 'A',
            planActivities: [
                { label: 'A', seconds: 600, startMinute: 0, endMinute: 10, durationMinutes: 10 },
            ],
            planSegmentTimers: {
                'planned-0-0-seg0': { status: 'paused', elapsedSeconds: 12 },
            },
        }),
        createSlot({
            time: '5',
            planned: 'B',
            planActivities: [
                { label: 'B', seconds: 600, startMinute: 0, endMinute: 10, durationMinutes: 10 },
            ],
            planSegmentTimers: {
                'planned-1-1-seg0': { status: 'running', running: true, startedAt: 345 },
            },
        }),
    ]);
    ctx.selectedPlannedFields = new Set([0, 1]);
    withDocumentQuery('A', () => mergeSelectedFields.call(ctx, 'planned'));
    assert.equal(Boolean(ctx.timeSlots[0].planMergeSnapshot), true);

    const snapshot = stateCore.createStateSnapshot(ctx.timeSlots, ctx.mergedFields);
    const restored = stateCore.restoreStateSnapshot(snapshot, {
        templateSlots: [createSlot({ time: '4' }), createSlot({ time: '5' })],
        normalizePlanActivitiesArray(items) {
            return Array.isArray(items) ? items.map((item) => ({ ...item })) : [];
        },
        normalizeActivityText(value) {
            return String(value || '').trim();
        },
        normalizeTimerStatus(status) {
            const normalized = String(status || '').trim();
            return normalized === 'running' || normalized === 'paused' || normalized === 'completed' || normalized === 'idle'
                ? normalized
                : 'idle';
        },
        normalizeActivitiesArray(items) {
            return Array.isArray(items) ? items.map((item) => ({ ...item })) : [];
        },
        normalizeMergeKey(value) {
            const text = String(value || '').trim();
            return /^(planned|actual|time)-\d+-\d+$/.test(text) ? text : null;
        },
    });
    const restoredCtx = createMergeContext(restored.timeSlots);
    restoredCtx.mergedFields = restored.mergedFields;

    undoMerge.call(restoredCtx, 'planned', 'planned-0-1');

    assert.deepEqual(restoredCtx.timeSlots[0].planActivities.map((item) => item.label), ['A']);
    assert.deepEqual(restoredCtx.timeSlots[1].planActivities.map((item) => item.label), ['B']);
    assert.equal(restoredCtx.timeSlots[0].planSegmentTimers['planned-0-0-seg0'].status, 'paused');
    assert.equal(restoredCtx.timeSlots[1].planSegmentTimers['planned-1-1-seg0'].status, 'running');
    assert.equal(restoredCtx.timeSlots[1].planSegmentTimers['planned-1-1-seg0'].startedAt, 345);
    assert.equal(restoredCtx.timeSlots[0].planMergeSnapshot, undefined);
});
