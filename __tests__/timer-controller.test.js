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
    };

    const ctx = { id: 'tracker' };
    const entryDiv = { id: 'row' };
    const options = { render: true };

    try {
        assert.equal(attachTimerListenersWrapper.call(ctx, entryDiv, 1), 'attach');
        assert.equal(startTimerWrapper.call(ctx, 1), 'start');
        assert.equal(pauseTimerWrapper.call(ctx, 1), 'pause');
        assert.equal(resumeTimerWrapper.call(ctx, 1), 'resume');
        assert.equal(stopTimerWrapper.call(ctx, 1), 'stop');
        assert.equal(commitRunningTimersWrapper.call(ctx, options), true);
        assert.equal(updateRunningTimersWrapper.call(ctx), 'update');
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
