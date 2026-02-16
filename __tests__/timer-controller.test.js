const test = require('node:test');
const assert = require('node:assert/strict');

const timerController = require('../controllers/timer-controller');

test('timer-controller exports and global attach are available', () => {
    assert.equal(typeof timerController.resolveTimerEligibility, 'function');
    assert.equal(typeof timerController.getStartBlockReason, 'function');
    assert.equal(typeof timerController.resolveTimerControlState, 'function');
    assert.ok(globalThis.TimerController);
    assert.equal(typeof globalThis.TimerController.resolveTimerEligibility, 'function');
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

test('resolveTimerControlState returns start/pause/resume actions and tooltip', () => {
    const eligible = {
        hasPlannedActivity: true,
        isCurrentTimeInRange: true,
        canStartWithoutDate: true,
        disabledByDate: false,
    };

    const running = timerController.resolveTimerControlState(eligible, { isRunning: true, hasElapsed: true });
    assert.equal(running.buttonAction, 'pause');
    assert.equal(running.buttonIcon, '일시정지');
    assert.equal(running.buttonDisabled, false);

    const resumeBlocked = timerController.resolveTimerControlState(
        { ...eligible, canStartWithoutDate: false, isCurrentTimeInRange: false },
        { isRunning: false, hasElapsed: true }
    );
    assert.equal(resumeBlocked.buttonAction, 'resume');
    assert.equal(resumeBlocked.buttonDisabled, true);
    assert.equal(resumeBlocked.buttonTitle, '현재 시간 범위에서만 시작할 수 있습니다.');

    const noPlan = timerController.resolveTimerControlState(
        { ...eligible, hasPlannedActivity: false, canStartWithoutDate: false },
        { isRunning: false, hasElapsed: false }
    );
    assert.equal(noPlan.buttonAction, 'start');
    assert.equal(noPlan.buttonDisabled, true);
    assert.equal(noPlan.buttonTitle, '계획을 먼저 입력해주세요.');
});
