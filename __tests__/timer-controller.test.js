const test = require('node:test');
const assert = require('node:assert/strict');

const timerController = require('../controllers/timer-controller');
const { buildMethod } = require('./helpers/script-method-builder');

const attachTimerListenersWrapper = buildMethod('attachTimerListeners(entryDiv, index)', '(entryDiv, index)');
const startTimerWrapper = buildMethod('startTimer(index)', '(index)');
const pauseTimerWrapper = buildMethod('pauseTimer(index)', '(index)');
const resumeTimerWrapper = buildMethod('resumeTimer(index)', '(index)');
const stopTimerWrapper = buildMethod('stopTimer(index)', '(index)');
const commitRunningTimersWrapper = buildMethod('commitRunningTimers(options = {})', '(options = {})');
const updateRunningTimersWrapper = buildMethod('updateRunningTimers()', '()');
const normalizeTimerStatusWrapper = buildMethod('normalizeTimerStatus(rawStatus, slot = null)', '(rawStatus, slot = null)');
const getTimerRawElapsedWrapper = buildMethod('getTimerRawElapsed(slot)', '(slot)');
const getTimeUiHostIndexWrapper = buildMethod('getTimeUiHostIndex(index)', '(index)');
const getMobileTimeUiStateWrapper = buildMethod('getMobileTimeUiState(index, slotOverride = null)', '(index, slotOverride = null)');
const getTimerEligibilityWrapper = buildMethod('getTimerEligibility(index, slotOverride = null)', '(index, slotOverride = null)');
const getTimerStartBlockReasonWrapper = buildMethod('getTimerStartBlockReason(index)', '(index)');
const createTimerControlsWrapper = buildMethod('createTimerControls(index, slot)', '(index, slot)');
const handleSegmentTimerClickWrapper = buildMethod('handleSegmentTimerClick(segmentRef, segmentId = null)', '(segmentRef, segmentId = null)');
const startSegmentTimerWrapper = buildMethod('startSegmentTimer(segmentRef, segmentId = null)', '(segmentRef, segmentId = null)');
const pauseSegmentTimerWrapper = buildMethod('pauseSegmentTimer(segmentRef, segmentId = null)', '(segmentRef, segmentId = null)');
const resumeSegmentTimerWrapper = buildMethod('resumeSegmentTimer(segmentRef, segmentId = null)', '(segmentRef, segmentId = null)');
const resolvePlanSegmentBaseIndexWrapper = buildMethod('resolvePlanSegmentBaseIndex(segmentRef)', '(segmentRef)');
const getPlanSegmentIndexByIdWrapper = buildMethod('getPlanSegmentIndexById(segmentId)', '(segmentId)');
const resolvePlannedSlotContextWrapper = buildMethod('resolvePlannedSlotContext(index)', '(index)');

test('timer-controller exports and global attach are available', () => {
    assert.equal(typeof timerController.attachTimerListeners, 'function');
    assert.equal(typeof timerController.startTimer, 'function');
    assert.equal(typeof timerController.pauseTimer, 'function');
    assert.equal(typeof timerController.resumeTimer, 'function');
    assert.equal(typeof timerController.stopTimer, 'function');
    assert.equal(typeof timerController.commitRunningTimers, 'function');
    assert.equal(typeof timerController.updateRunningTimers, 'function');
    assert.equal(typeof timerController.resolveTimerEligibility, 'function');
    assert.equal(typeof timerController.getStartBlockReason, 'function');
    assert.equal(typeof timerController.resolveTimerControlState, 'function');
    assert.equal(typeof timerController.normalizeTimerStatus, 'function');
    assert.equal(typeof timerController.getTimerRawElapsed, 'function');
    assert.equal(typeof timerController.getTimeUiHostIndex, 'function');
    assert.equal(typeof timerController.getMobileTimeUiState, 'function');
    assert.equal(typeof timerController.getTimerEligibility, 'function');
    assert.equal(typeof timerController.getTimerStartBlockReason, 'function');
    assert.equal(typeof timerController.createTimerControls, 'function');
    assert.equal(typeof timerController.handleSegmentTimerClick, 'function');
    assert.equal(typeof timerController.startSegmentTimer, 'function');
    assert.equal(typeof timerController.pauseSegmentTimer, 'function');
    assert.equal(typeof timerController.resumeSegmentTimer, 'function');
    assert.equal(typeof timerController.startPlanSegmentTimer, 'function');
    assert.equal(typeof timerController.pausePlanSegmentTimer, 'function');
    assert.equal(typeof timerController.resumePlanSegmentTimer, 'function');
    assert.equal(typeof timerController.getPlanSegmentIndexById, 'function');
    assert.equal(typeof timerController.resolvePlanSegmentBaseIndex, 'function');
    assert.ok(globalThis.TimerController);
    assert.equal(typeof globalThis.TimerController.resolveTimerEligibility, 'function');
});

test('script timer wrapper methods delegate to controller helpers', () => {
    const original = globalThis.TimerController;
    const calls = [];

    globalThis.TimerController = {
        ...original,
        attachTimerListeners(entryDiv, index) {
            calls.push(['attach', this, entryDiv, index]);
            return 'attach';
        },
        startTimer(index) {
            calls.push(['start', this, index]);
            return 'start';
        },
        pauseTimer(index) {
            calls.push(['pause', this, index]);
            return 'pause';
        },
        resumeTimer(index) {
            calls.push(['resume', this, index]);
            return 'resume';
        },
        stopTimer(index) {
            calls.push(['stop', this, index]);
            return 'stop';
        },
        commitRunningTimers(options) {
            calls.push(['commit', this, options]);
            return true;
        },
        updateRunningTimers() {
            calls.push(['update', this]);
            return 'update';
        },
        normalizeTimerStatus(rawStatus, slot) {
            calls.push(['normalize', this, rawStatus, slot]);
            return 'paused';
        },
        getTimerRawElapsed(slot) {
            calls.push(['raw', this, slot]);
            return 900;
        },
        getTimeUiHostIndex(index) {
            calls.push(['host', this, index]);
            return 3;
        },
        getMobileTimeUiState(index, slotOverride) {
            calls.push(['mobile', this, index, slotOverride]);
            return { mode: 'running' };
        },
        getTimerEligibility(index, slotOverride) {
            calls.push(['eligibility', this, index, slotOverride]);
            return { canStartWithoutDate: true };
        },
        getTimerStartBlockReason(index) {
            calls.push(['reason', this, index]);
            return null;
        },
        createTimerControls(index, slot) {
            calls.push(['controls', this, index, slot]);
            return '<div>timer</div>';
        },
        handleSegmentTimerClick(index) {
            calls.push(['segment-click', this, index]);
            return true;
        },
        startSegmentTimer(segmentRef) {
            calls.push(['segment-start', this, segmentRef]);
            return 'segment-start';
        },
        pauseSegmentTimer(segmentRef) {
            calls.push(['segment-pause', this, segmentRef]);
            return 'segment-pause';
        },
        resumeSegmentTimer(segmentRef) {
            calls.push(['segment-resume', this, segmentRef]);
            return 'segment-resume';
        },
        getPlanSegmentIndexById(segmentId) {
            calls.push(['segment-id', this, segmentId]);
            return 7;
        },
        resolvePlanSegmentBaseIndex(segmentRef) {
            calls.push(['segment-resolve', this, segmentRef]);
            return 7;
        },
    };

    const ctx = { id: 'tracker' };
    const entryDiv = { id: 'row' };
    const options = { render: true };
    const slot = { timer: { running: false } };

    try {
        assert.equal(attachTimerListenersWrapper.call(ctx, entryDiv, 1), 'attach');
        assert.equal(startTimerWrapper.call(ctx, 1), 'start');
        assert.equal(pauseTimerWrapper.call(ctx, 1), 'pause');
        assert.equal(resumeTimerWrapper.call(ctx, 1), 'resume');
        assert.equal(stopTimerWrapper.call(ctx, 1), 'stop');
        assert.equal(commitRunningTimersWrapper.call(ctx, options), true);
        assert.equal(updateRunningTimersWrapper.call(ctx), 'update');
        assert.equal(normalizeTimerStatusWrapper.call(ctx, 'idle', slot), 'paused');
        assert.equal(getTimerRawElapsedWrapper.call(ctx, slot), 900);
        assert.equal(getTimeUiHostIndexWrapper.call(ctx, 5), 3);
        assert.deepEqual(getMobileTimeUiStateWrapper.call(ctx, 2, slot), { mode: 'running' });
        assert.deepEqual(getTimerEligibilityWrapper.call(ctx, 2, slot), { canStartWithoutDate: true });
        assert.equal(getTimerStartBlockReasonWrapper.call(ctx, 2), null);
        assert.equal(createTimerControlsWrapper.call(ctx, 2, slot), '<div>timer</div>');
        assert.equal(handleSegmentTimerClickWrapper.call(ctx, 2), true);
        assert.equal(startSegmentTimerWrapper.call(ctx, 'planned-7-8'), 'segment-start');
        assert.equal(pauseSegmentTimerWrapper.call(ctx, 'planned-7-8'), 'segment-pause');
        assert.equal(resumeSegmentTimerWrapper.call(ctx, 'planned-7-8'), 'segment-resume');
        assert.equal(getPlanSegmentIndexByIdWrapper.call(ctx, 'planned-7-8'), 7);
        assert.equal(resolvePlanSegmentBaseIndexWrapper.call(ctx, 'planned-7-8'), 7);
    } finally {
        globalThis.TimerController = original;
    }

    assert.deepEqual(calls, [
        ['attach', ctx, entryDiv, 1],
        ['start', ctx, 1],
        ['pause', ctx, 1],
        ['resume', ctx, 1],
        ['stop', ctx, 1],
        ['commit', ctx, options],
        ['update', ctx],
        ['normalize', ctx, 'idle', slot],
        ['raw', ctx, slot],
        ['host', ctx, 5],
        ['mobile', ctx, 2, slot],
        ['eligibility', ctx, 2, slot],
        ['reason', ctx, 2],
        ['controls', ctx, 2, slot],
        ['segment-click', ctx, 2],
        ['segment-start', ctx, 'planned-7-8'],
        ['segment-pause', ctx, 'planned-7-8'],
        ['segment-resume', ctx, 'planned-7-8'],
        ['segment-id', ctx, 'planned-7-8'],
        ['segment-resolve', ctx, 'planned-7-8'],
    ]);
});

test('handleSegmentTimerClick runs one plan segment timer without writing actual text', () => {
    const nowValues = [100_000, 130_000, 160_000];
    const originalNow = Date.now;
    Date.now = () => nowValues[0];

    const ctx = {
        timeSlots: [
            {
                planned: 'A',
                planSegmentTimers: {
                    'planned-0-0': { status: 'idle', running: false, elapsed: 0, rawElapsed: 0, startTime: null, startedAt: null, method: 'plan-segment' },
                },
                timer: { status: 'idle', running: false, elapsed: 0, rawElapsed: 0, startTime: null },
            },
            {
                planned: 'B',
                planSegmentTimers: {
                    'planned-1-1': { status: 'idle', running: false, elapsed: 0, rawElapsed: 0, startTime: null, startedAt: null, method: 'plan-segment' },
                },
                timer: { status: 'idle', running: false, elapsed: 0, rawElapsed: 0, startTime: null },
            },
        ],
        mergedFields: new Map(),
        findMergeKey: () => null,
        normalizeTimerStatus: timerController.normalizeTimerStatus,
        normalizePlanActivitiesArray: () => [],
        startTimerInterval() {},
        renderTimeEntries() {},
        calculateTotals() {},
        autoSave() {},
    };

    try {
        assert.equal(timerController.handleSegmentTimerClick.call(ctx, 0), true);
        assert.equal(ctx.timeSlots[0].planSegmentTimers['planned-0-0'].status, 'running');
        assert.equal(ctx.timeSlots[0].planSegmentTimers['planned-0-0'].method, 'plan-segment');

        nowValues[0] = nowValues[1];
        assert.equal(timerController.handleSegmentTimerClick.call(ctx, 1), true);
        assert.equal(ctx.timeSlots[0].planSegmentTimers['planned-0-0'].status, 'paused');
        assert.equal(ctx.timeSlots[0].planSegmentTimers['planned-0-0'].elapsed, 30);
        assert.equal(ctx.timeSlots[1].planSegmentTimers['planned-1-1'].status, 'running');
        assert.equal(ctx.timeSlots[0].actual, undefined);
    } finally {
        Date.now = originalNow;
    }
});

test('handleSegmentTimerClick accepts a plan segment id and pauses other running segments', () => {
    const originalNow = Date.now;
    Date.now = () => 200_000;

    const ctx = {
        timeSlots: [
            {
                planned: 'A',
                planSegmentTimers: {
                    'planned-0-0': { status: 'running', running: true, elapsed: 10, rawElapsed: 10, startTime: 190_000, startedAt: 190_000, method: 'plan-segment' },
                },
            },
            {
                planned: 'B',
                planSegmentTimers: {
                    'planned-1-1': { status: 'idle', running: false, elapsed: 0, rawElapsed: 0, startTime: null, startedAt: null, method: 'plan-segment' },
                },
            },
        ],
        mergedFields: new Map(),
        findMergeKey(type, idx) {
            if (type === 'planned' && idx === 0) return 'planned-0-0';
            if (type === 'planned' && idx === 1) return 'planned-1-1';
            return null;
        },
        normalizeTimerStatus: timerController.normalizeTimerStatus,
        normalizePlanActivitiesArray: () => [],
        startTimerInterval() {},
        renderTimeEntries() {},
        calculateTotals() {},
        autoSave() {},
        resolvePlanSegmentBaseIndex: timerController.resolvePlanSegmentBaseIndex,
    };

    try {
        assert.equal(timerController.handleSegmentTimerClick.call(ctx, 'planned-1-1'), true);
        assert.equal(ctx.timeSlots[0].planSegmentTimers['planned-0-0'].status, 'paused');
        assert.equal(ctx.timeSlots[1].planSegmentTimers['planned-1-1'].status, 'running');
    } finally {
        Date.now = originalNow;
    }
});

test('plan segment timers stay isolated within a merged slot', () => {
    const ctx = {
        timeSlots: [
            {
                planSegmentTimers: {
                    'planned-0-0-seg0': {
                        running: false,
                        elapsed: 5,
                        elapsedSeconds: 5,
                        rawElapsed: 5,
                        startTime: null,
                        startedAt: null,
                        lastPausedAt: null,
                        method: 'plan-segment',
                        status: 'idle',
                    },
                    'planned-0-0-seg1': {
                        running: false,
                        elapsed: 12,
                        elapsedSeconds: 12,
                        rawElapsed: 12,
                        startTime: null,
                        startedAt: null,
                        lastPausedAt: null,
                        method: 'plan-segment',
                        status: 'idle',
                    },
                },
                timer: { status: 'idle', running: false, elapsed: 0, rawElapsed: 0, startTime: null },
            },
        ],
        mergedFields: new Map(),
        findMergeKey: () => 'planned-0-0',
        normalizeTimerStatus: timerController.normalizeTimerStatus,
        normalizePlanActivitiesArray: () => [],
        startTimerInterval() {},
        renderTimeEntries() {},
        calculateTotals() {},
        autoSave() {},
        resolvePlanSegmentBaseIndex: timerController.resolvePlanSegmentBaseIndex,
    };

    assert.equal(timerController.startSegmentTimer.call(ctx, 'planned-0-0-seg0'), true);
    assert.equal(ctx.timeSlots[0].planSegmentTimers['planned-0-0-seg0'].running, true);
    assert.equal(ctx.timeSlots[0].planSegmentTimers['planned-0-0-seg1'].running, false);
});

test('plan segment timer from merged secondary row stores on base slot', () => {
    const originalNow = Date.now;
    Date.now = () => 300_000;
    const ctx = {
        timeSlots: [
            {
                planActivities: [{ label: 'A', seconds: 3600 }],
                planSegmentTimers: {},
                timer: { status: 'idle', running: false, elapsed: 0, rawElapsed: 0, startTime: null },
            },
            {
                planActivities: [],
                planSegmentTimers: {},
                timer: { status: 'idle', running: false, elapsed: 0, rawElapsed: 0, startTime: null },
            },
        ],
        mergedFields: new Map([['planned-0-1', 'A']]),
        findMergeKey(type, idx) {
            return type === 'planned' && idx >= 0 && idx <= 1 ? 'planned-0-1' : null;
        },
        resolvePlannedSlotContext(index) {
            return resolvePlannedSlotContextWrapper.call(this, index);
        },
        normalizeTimerStatus: timerController.normalizeTimerStatus,
        normalizePlanActivitiesArray(value) {
            return Array.isArray(value) ? value.map(item => ({ ...item })) : [];
        },
        startTimerInterval() {},
        renderTimeEntries() {},
        calculateTotals() {},
        autoSave() {},
    };

    try {
        assert.equal(timerController.handleSegmentTimerClick.call(ctx, 1), true);
        assert.equal(ctx.timeSlots[0].planSegmentTimers['planned-0-1'].status, 'running');
        assert.equal(ctx.timeSlots[1].planSegmentTimers['planned-0-1'], undefined);
    } finally {
        Date.now = originalNow;
    }
});

test('merged plan segment timer text uses each segment duration instead of the full block', () => {
    const ctx = {
        timeSlots: [
            {
                planActivities: [
                    { label: 'A', seconds: 3600 },
                    { label: 'B', seconds: 4800 },
                    { label: 'C', seconds: 2400 },
                ],
                planSegmentTimers: {},
            },
            {},
            {},
        ],
        resolvePlannedSlotContext(index) {
            return {
                clickedIndex: index,
                baseIndex: 0,
                rangeStart: 0,
                rangeEnd: 2,
                mergeKey: 'planned-0-2',
                isMerged: true,
                slotCount: 3,
                blockMinutes: 180,
            };
        },
        getPlanSegmentBaseIndex: timerController.getPlanSegmentBaseIndex,
        getPlanSegmentPlannedSeconds: timerController.getPlanSegmentPlannedSeconds,
        getPlanSegmentTimerCore() {
            return {
                formatSegmentTimerText(_timer, plannedSeconds) {
                    return `0m / ${Math.floor(plannedSeconds / 60)}m`;
                },
            };
        },
        normalizePlanActivitiesArray(value) {
            return Array.isArray(value) ? value.map(item => ({ ...item })) : [];
        },
    };

    assert.equal(timerController.getPlanSegmentTimerText.call(ctx, 0, 'planned-0-2-seg0', {
        segmentIndex: 0,
        startMinute: 0,
        durationMinutes: 60,
        endMinute: 60,
    }), '0m / 60m');
    assert.equal(timerController.getPlanSegmentTimerText.call(ctx, 0, 'planned-0-2-seg1', {
        segmentIndex: 1,
        startMinute: 60,
        durationMinutes: 80,
        endMinute: 140,
    }), '0m / 80m');
    assert.equal(timerController.getPlanSegmentTimerText.call(ctx, 0, 'planned-0-2-seg2', {
        segmentIndex: 2,
        startMinute: 140,
        durationMinutes: 40,
        endMinute: 180,
    }), '0m / 40m');
});

test('plan segment planned seconds without segment context keeps the full activity sum', () => {
    const ctx = {
        timeSlots: [
            {
                planActivities: [
                    { label: 'A', seconds: 1200 },
                    { label: 'B', seconds: 1800 },
                ],
            },
        ],
        resolvePlannedSlotContext() {
            return {
                clickedIndex: 0,
                baseIndex: 0,
                rangeStart: 0,
                rangeEnd: 0,
                mergeKey: null,
                isMerged: false,
                slotCount: 1,
                blockMinutes: 60,
            };
        },
        normalizePlanActivitiesArray(value) {
            return Array.isArray(value) ? value.map(item => ({ ...item })) : [];
        },
    };

    assert.equal(timerController.getPlanSegmentPlannedSeconds.call(ctx, 0), 3000);
});

test('plan segment planned seconds can fall back to the indexed activity duration', () => {
    const ctx = {
        timeSlots: [
            {
                planActivities: [
                    { label: 'A', seconds: 1200 },
                    { label: 'B', durationMinutes: 45 },
                ],
            },
        ],
        resolvePlannedSlotContext() {
            return {
                clickedIndex: 0,
                baseIndex: 0,
                rangeStart: 0,
                rangeEnd: 0,
                mergeKey: null,
                isMerged: false,
                slotCount: 1,
                blockMinutes: 60,
            };
        },
        normalizePlanActivitiesArray(value) {
            return Array.isArray(value) ? value.map(item => ({ ...item })) : [];
        },
    };

    assert.equal(timerController.getPlanSegmentPlannedSeconds.call(ctx, 0, { segmentIndex: 1 }), 2700);
});

test('plan segment timer tone compares elapsed time against the segment duration', () => {
    const ctx = {
        timeSlots: [
            {
                planActivities: [{ label: 'A', seconds: 1800 }],
                planSegmentTimers: {
                    'planned-0-2-seg0': {
                        running: false,
                        elapsed: 2400,
                        elapsedSeconds: 2400,
                        status: 'paused',
                    },
                },
            },
            {},
            {},
        ],
        resolvePlannedSlotContext() {
            return {
                clickedIndex: 0,
                baseIndex: 0,
                rangeStart: 0,
                rangeEnd: 2,
                mergeKey: 'planned-0-2',
                isMerged: true,
                slotCount: 3,
                blockMinutes: 180,
            };
        },
        getPlanSegmentBaseIndex: timerController.getPlanSegmentBaseIndex,
        getPlanSegmentPlannedSeconds: timerController.getPlanSegmentPlannedSeconds,
        getPlanSegmentTimerCore() {
            return {
                getSegmentTimeTone({ timer, plannedSeconds }) {
                    const elapsed = Math.max(timer.elapsedSeconds || 0, timer.elapsed || 0);
                    return elapsed >= plannedSeconds + 60 ? 'over' : 'under';
                },
            };
        },
        normalizePlanActivitiesArray(value) {
            return Array.isArray(value) ? value.map(item => ({ ...item })) : [];
        },
    };

    assert.equal(timerController.getPlanSegmentTimeTone.call(ctx, 0, 'planned-0-2-seg0', {
        segmentIndex: 0,
        startMinute: 0,
        durationMinutes: 30,
        endMinute: 30,
    }), 'over');
});

test('plan segment graphic clicks route to the inline plan dropdown anchor', () => {
    const calls = [];
    const plannedInput = {
        click() {
            calls.push('planned-input-click');
        },
    };
    const graphic = {
        dataset: { index: '4', segmentId: 'planned-4-4' },
        addEventListener(type, handler) {
            this[type] = handler;
        },
    };
    const entryDiv = {
        querySelector(selector) {
            if (selector === '.planned-input[data-index="4"]' || selector === '.planned-input') return plannedInput;
            return null;
        },
        querySelectorAll(selector) {
            if (selector === '.plan-segment-graphic') return [graphic];
            if (selector === '.plan-segment-timer-button') return [];
            return [];
        },
    };
    const ctx = {
        openInlinePlanDropdown(index, anchor, endIndex) {
            calls.push(['dropdown', index, anchor === plannedInput, endIndex]);
        },
    };

    timerController.attachTimerListeners.call(ctx, entryDiv, 4);
    assert.equal(typeof graphic.click, 'function');
    graphic.click({
        preventDefault() {},
        stopPropagation() {},
        target: {
            closest(selector) {
                if (selector === '.plan-segment-timer-button') return null;
                return null;
            },
        },
    });

    assert.deepEqual(calls, ['planned-input-click']);
});

test('updateRunningTimers keeps plan segment elapsed base stable while rendering live text', () => {
    const originalNow = Date.now;
    const originalDocument = globalThis.document;
    Date.now = () => 15_000;

    const timerDisplay = { textContent: '' };
    const segmentDisplay = {
        textContent: '',
        classList: {
            removed: [],
            added: [],
            remove(...classes) {
                this.removed.push(...classes);
            },
            add(className) {
                this.added.push(className);
            },
        },
    };

    globalThis.document = {
        querySelector(selector) {
            if (selector === '[data-index="0"] .timer-display') return timerDisplay;
            if (selector === '.plan-segment-timer-time[data-segment-id="planned-0-0"]') return segmentDisplay;
            return null;
        },
    };

    const ctx = {
        lastKnownTodayDate: '2026-05-09',
        currentDate: '2026-05-09',
        timeSlots: [
            {
                planSegmentTimers: {
                    'planned-0-0': {
                        running: true,
                        elapsed: 10,
                        elapsedSeconds: 10,
                        startTime: 10_000,
                        startedAt: 10_000,
                        status: 'running',
                        method: 'plan-segment',
                    },
                },
                timer: {
                    running: false,
                    elapsed: 0,
                    elapsedSeconds: 0,
                    startTime: null,
                    startedAt: null,
                    status: 'idle',
                },
            },
        ],
        getTodayLocalDateString() {
            return '2026-05-09';
        },
        formatTime(seconds) {
            return `${seconds}s`;
        },
        getPlanSegmentTimerText(index, segmentId) {
            assert.equal(index, 0);
            assert.equal(segmentId, 'planned-0-0');
            return '0:15 / 40m';
        },
        getPlanSegmentTimeTone(index, segmentId) {
            assert.equal(index, 0);
            assert.equal(segmentId, 'planned-0-0');
            return 'under';
        },
        stopTimerInterval() {
            assert.fail('running timer should keep interval active');
        },
    };

    try {
        timerController.updateRunningTimers.call(ctx);
    } finally {
        Date.now = originalNow;
        globalThis.document = originalDocument;
    }

    assert.equal(ctx.timeSlots[0].planSegmentTimers['planned-0-0'].elapsedSeconds, 10);
    assert.equal(ctx.timeSlots[0].planSegmentTimers['planned-0-0'].startedAt, 10_000);
    assert.equal(timerDisplay.textContent, '');
    assert.equal(segmentDisplay.textContent, '0:15 / 40m');
    assert.deepEqual(segmentDisplay.classList.added, ['tone-under']);
});

test('resolveTimerEligibility reflects merged ranges and merged planned text', () => {
    const state = timerController.resolveTimerEligibility({
        index: 6,
        currentIndex: 7,
        isCurrentDateToday: true,
        slotPlanned: 'fallback',
        findMergeKey: (type, idx) => {
            if (type === 'time' && idx === 6) return 'time-6-8';
            if (type === 'planned' && idx === 6) return 'planned-6-8';
            return null;
        },
        getMergedField: (key) => {
            if (key === 'planned-6-8') return '집중 작업';
            return '';
        },
    });

    assert.equal(state.timeStart, 6);
    assert.equal(state.timeEnd, 8);
    assert.equal(state.plannedText, '집중 작업');
    assert.equal(state.hasPlannedActivity, true);
    assert.equal(state.isCurrentTimeInRange, true);
    assert.equal(state.disabledByDate, false);
    assert.equal(state.canStartWithoutDate, true);
});

test('getStartBlockReason preserves reason priority', () => {
    const base = {
        currentIndex: 8,
        isCurrentDateToday: true,
        hasPlannedActivity: true,
        isCurrentTimeInRange: true,
    };

    assert.equal(
        timerController.getStartBlockReason({ ...base, isCurrentDateToday: false }),
        '오늘 날짜에서만 타이머를 사용할 수 있습니다.'
    );
    assert.equal(
        timerController.getStartBlockReason({ ...base, currentIndex: -1 }),
        '현재 시간 슬롯에서만 시작할 수 있습니다.'
    );
    assert.equal(
        timerController.getStartBlockReason({ ...base, hasPlannedActivity: false }),
        '계획된 활동이 있어야 타이머를 시작할 수 있습니다.'
    );
    assert.equal(
        timerController.getStartBlockReason({ ...base, isCurrentTimeInRange: false }),
        '현재 시간 범위의 칸에서만 타이머를 시작할 수 있습니다.'
    );
    assert.equal(timerController.getStartBlockReason(base), null);
});

test('resolveTimerControlState returns start/stop/resume actions and tooltip', () => {
    const eligible = {
        hasPlannedActivity: true,
        isCurrentTimeInRange: true,
        canStartWithoutDate: true,
        disabledByDate: false,
    };

    const running = timerController.resolveTimerControlState(eligible, { isRunning: true, hasElapsed: true });
    assert.equal(running.buttonAction, 'stop');
    assert.equal(running.buttonIcon, '정지');
    assert.equal(running.buttonDisabled, false);

    const resumeBlocked = timerController.resolveTimerControlState(
        { ...eligible, canStartWithoutDate: false, isCurrentTimeInRange: false },
        { isRunning: false, hasElapsed: true }
    );
    assert.equal(resumeBlocked.buttonAction, 'resume');
    assert.equal(resumeBlocked.buttonIcon, '재생');
    assert.equal(resumeBlocked.buttonDisabled, false);
    assert.equal(resumeBlocked.buttonTitle, '');

    const noPlan = timerController.resolveTimerControlState(
        { ...eligible, hasPlannedActivity: false, canStartWithoutDate: false },
        { isRunning: false, hasElapsed: false }
    );
    assert.equal(noPlan.buttonAction, 'start');
    assert.equal(noPlan.buttonDisabled, true);
    assert.equal(noPlan.buttonTitle, '계획을 먼저 입력해주세요.');
});
