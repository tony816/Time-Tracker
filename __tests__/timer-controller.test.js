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
    ]);
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
