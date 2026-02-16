(function attachTimerController(root, factory) {
    const api = factory();

    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    }

    if (root) {
        const existing = (root.TimerController && typeof root.TimerController === 'object')
            ? root.TimerController
            : {};
        root.TimerController = Object.assign(existing, api);
    }
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildTimerController() {
    const DEFAULT_START_BLOCK_MESSAGES = Object.freeze({
        notToday: '오늘 날짜에서만 타이머를 사용할 수 있습니다.',
        invalidCurrentSlot: '현재 시간 슬롯에서만 시작할 수 있습니다.',
        noPlanned: '계획된 활동이 있어야 타이머를 시작할 수 있습니다.',
        outOfRange: '현재 시간 범위의 칸에서만 타이머를 시작할 수 있습니다.',
    });

    const DEFAULT_CONTROL_MESSAGES = Object.freeze({
        notToday: '오늘 날짜에서만 타이머를 사용할 수 있습니다.',
        noPlanned: '계획을 먼저 입력해주세요.',
        outOfRange: '현재 시간 범위에서만 시작할 수 있습니다.',
    });

    function parseMergeRange(mergeKey) {
        if (!mergeKey || typeof mergeKey !== 'string') return null;
        const parts = mergeKey.split('-');
        if (parts.length !== 3) return null;
        const start = parseInt(parts[1], 10);
        const end = parseInt(parts[2], 10);
        if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
        return { start, end };
    }

    function resolveTimerEligibility(options = {}) {
        const index = Number(options.index);
        const currentIndex = Number(options.currentIndex);
        const isCurrentDateToday = Boolean(options.isCurrentDateToday);
        const slotPlanned = String(options.slotPlanned || '');
        const findMergeKey = (typeof options.findMergeKey === 'function') ? options.findMergeKey : (() => null);
        const getMergedField = (typeof options.getMergedField === 'function') ? options.getMergedField : (() => '');

        let timeStart = index;
        let timeEnd = index;
        const timeMergeKey = findMergeKey('time', index);
        const timeRange = parseMergeRange(timeMergeKey);
        if (timeRange) {
            timeStart = timeRange.start;
            timeEnd = timeRange.end;
        }

        let plannedText = '';
        const plannedMergeKeyForIndex = findMergeKey('planned', index);
        const plannedMergeKeyForCurrent = Number.isFinite(currentIndex) && currentIndex >= 0
            ? findMergeKey('planned', currentIndex)
            : null;

        if (plannedMergeKeyForIndex) {
            plannedText = String(getMergedField(plannedMergeKeyForIndex) || '').trim();
        } else if (plannedMergeKeyForCurrent) {
            plannedText = String(getMergedField(plannedMergeKeyForCurrent) || '').trim();
        } else {
            plannedText = slotPlanned.trim();
        }

        const hasPlannedActivity = plannedText !== '';
        const isCurrentTimeInRange = Number.isFinite(currentIndex)
            ? (currentIndex >= timeStart && currentIndex <= timeEnd)
            : false;
        const disabledByDate = !isCurrentDateToday;
        const canStartWithoutDate = hasPlannedActivity && isCurrentTimeInRange;

        return {
            index,
            currentIndex,
            isCurrentDateToday,
            timeStart,
            timeEnd,
            plannedText,
            hasPlannedActivity,
            isCurrentTimeInRange,
            disabledByDate,
            canStartWithoutDate,
            plannedMergeKeyForIndex,
            plannedMergeKeyForCurrent,
            timeMergeKey,
        };
    }

    function getStartBlockReason(state = {}, messages = {}) {
        const merged = Object.assign({}, DEFAULT_START_BLOCK_MESSAGES, messages || {});

        if (!state.isCurrentDateToday) {
            return merged.notToday;
        }
        if (!Number.isFinite(state.currentIndex) || state.currentIndex < 0) {
            return merged.invalidCurrentSlot;
        }
        if (!state.hasPlannedActivity) {
            return merged.noPlanned;
        }
        if (!state.isCurrentTimeInRange) {
            return merged.outOfRange;
        }
        return null;
    }

    function resolveTimerControlState(state = {}, flags = {}, messages = {}) {
        const merged = Object.assign({}, DEFAULT_CONTROL_MESSAGES, messages || {});
        const isRunning = Boolean(flags.isRunning);
        const hasElapsed = Boolean(flags.hasElapsed);
        const disabledByDate = Boolean(state.disabledByDate);
        const canStartWithoutDate = Boolean(state.canStartWithoutDate);

        let buttonIcon = '시작';
        let buttonAction = 'start';
        let buttonDisabled = (!canStartWithoutDate && !isRunning) || disabledByDate;
        let buttonTitle = '';

        if (isRunning) {
            buttonIcon = '일시정지';
            buttonAction = 'pause';
            buttonDisabled = false;
        } else if (hasElapsed) {
            buttonIcon = '재개';
            buttonAction = 'resume';
            buttonDisabled = !canStartWithoutDate || disabledByDate;
        }

        if (buttonDisabled) {
            if (disabledByDate) {
                buttonTitle = merged.notToday;
            } else if (!state.hasPlannedActivity) {
                buttonTitle = merged.noPlanned;
            } else if (!state.isCurrentTimeInRange) {
                buttonTitle = merged.outOfRange;
            }
        }

        return {
            buttonIcon,
            buttonAction,
            buttonDisabled,
            buttonTitle,
        };
    }

    return Object.freeze({
        parseMergeRange,
        resolveTimerEligibility,
        getStartBlockReason,
        resolveTimerControlState,
        DEFAULT_START_BLOCK_MESSAGES,
        DEFAULT_CONTROL_MESSAGES,
    });
});
