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
        const slotPlanActivities = Array.isArray(options.slotPlanActivities) ? options.slotPlanActivities : [];
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

        const hasPlannedActivity = plannedText !== '' || slotPlanActivities.some(item => String((item && item.label) || '').trim() !== '');
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
            buttonIcon = '정지';
            buttonAction = 'stop';
            buttonDisabled = false;
        } else if (hasElapsed) {
            buttonIcon = '재생';
            buttonAction = 'resume';
            buttonDisabled = disabledByDate || !state.hasPlannedActivity;
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

function updateRunningTimers() {
    const today = this.getTodayLocalDateString();
    if (this.lastKnownTodayDate !== today) {
        this.lastKnownTodayDate = today;
        const hasRunningBeforeRollover = this.timeSlots.some((slot) => slot && slot.timer && slot.timer.running);
        if (hasRunningBeforeRollover && this.currentDate !== today) {
            this.transitionToDate(today);
            return;
        }
    }
     let hasRunningTimer = false;
     this.timeSlots.forEach((slot, index) => {
        if (slot.timer.running) {
            hasRunningTimer = true;
            const currentElapsed = slot.timer.elapsed + Math.floor((Date.now() - slot.timer.startTime) / 1000);
            const displayElement = document.querySelector(`[data-index="${index}"] .timer-display`);
            if (displayElement) {
                displayElement.textContent = this.formatTime(currentElapsed);
            }
        }
    });
     if (!hasRunningTimer) {
        this.stopTimerInterval();
    }
}

function commitRunningTimers(options = {}) {
    const shouldRender = Boolean(options.render);
    const shouldCalculate = Boolean(options.calculate);
    const shouldAutoSave = Boolean(options.autoSave);
    const nowMs = Date.now();
    let changed = false;
    this.timeSlots.forEach((slot) => {
        if (slot.timer.running) {
            const current = Number.isFinite(slot.timer.elapsed) ? Math.floor(slot.timer.elapsed) : 0;
            const elapsed = Math.max(0, current + Math.floor((nowMs - slot.timer.startTime) / 1000));
            slot.timer.elapsed = elapsed;
            slot.timer.rawElapsed = elapsed;
            slot.timer.running = false;
            slot.timer.startTime = null;
            slot.timer.status = elapsed > 0 ? 'paused' : 'idle';
            changed = true;
        }
    });
    this.stopTimerInterval();
    if (!changed) return false;
    if (shouldRender) this.renderTimeEntries();
    if (shouldCalculate) this.calculateTotals();
    if (shouldAutoSave) this.autoSave();
    return true;
}

function stopTimer(index) {
    const slot = this.timeSlots[index];
    const roundedBefore = this.normalizeActualRecordedTimerSeconds(slot.timer.elapsed);
    let additionalSeconds = 0;
    const elapsedBefore = Number.isFinite(slot.timer.elapsed) ? Math.floor(slot.timer.elapsed) : 0;
     if (slot.timer.running) {
        additionalSeconds = Math.max(0, Math.floor((Date.now() - slot.timer.startTime) / 1000));
        slot.timer.elapsed = elapsedBefore + additionalSeconds;
    }
     slot.timer.running = false;
    slot.timer.startTime = null;
    const rawElapsed = Number.isFinite(slot.timer.elapsed) ? Math.floor(slot.timer.elapsed) : 0;
    slot.timer.rawElapsed = rawElapsed;
    const recordedElapsed = this.normalizeActualRecordedTimerSeconds(rawElapsed);
    slot.timer.elapsed = recordedElapsed;
    slot.timer.status = rawElapsed > 0 ? 'completed' : 'idle';
    const roundedAdded = Math.max(0, recordedElapsed - roundedBefore);
     let recordedWithPlan = false;
     // 자동 기록: 타이머 시간을 실제 활동의 10분 그리드로 반영
    if (roundedAdded > 0) {
        const actualMergeKey = this.findMergeKey('actual', index);
        const actualBaseIndex = actualMergeKey ? parseInt(actualMergeKey.split('-')[1], 10) : index;
        if (this.isActualGridMode(actualBaseIndex)) {
            const range = this.getSplitRange('actual', actualBaseIndex);
            const currentTimeIndex = this.getCurrentTimeIndex ? this.getCurrentTimeIndex() : -1;
            const targetIndex = (Number.isInteger(currentTimeIndex)
                && currentTimeIndex >= range.start
                && currentTimeIndex <= range.end)
                ? currentTimeIndex
                : index;
            const startRow = Math.max(0, targetIndex - range.start);
            this.applyActualGridSeconds(actualBaseIndex, roundedAdded, startRow);
            recordedWithPlan = true;
        }
    }
     // 계획 분배에 실패했을 때의 기본 동작(기존 텍스트 기록 유지)
    if (!recordedWithPlan && roundedAdded > 0) {
        const timeStr = this.formatTime(slot.timer.elapsed);
         // 병합된 계획 값이 있으면 그 값을 우선 사용하여 라벨 구성
        let plannedLabel = '';
        const plannedMergeKey = this.findMergeKey('planned', index);
        if (plannedMergeKey) {
            plannedLabel = (this.mergedFields.get(plannedMergeKey) || '').trim();
        } else {
            plannedLabel = (slot.planned || '').trim();
        }
        const resultText = plannedLabel ? `${plannedLabel} (${timeStr})` : timeStr;
         // 실제(우측) 열이 병합 상태라면 병합 키 기준으로 값 업데이트
        const actualMergeKey = this.findMergeKey('actual', index);
        if (actualMergeKey) {
            const [, startStr, endStr] = actualMergeKey.split('-');
            const start = parseInt(startStr, 10);
            const end = parseInt(endStr, 10);
            this.mergedFields.set(actualMergeKey, resultText);
            for (let i = start; i <= end; i++) {
                this.timeSlots[i].actual = (i === start) ? resultText : '';
            }
        } else {
            // 단일 셀인 경우 해당 인덱스만 기록
            slot.actual = resultText;
        }
    }
     this.stopTimerInterval();
    this.renderTimeEntries();
    this.calculateTotals();
    this.autoSave();
}

function resumeTimer(index) {
    const reason = this.getTimerStartBlockReason(index);
    if (reason) {
        this.showNotification(reason, 'warn');
        if (reason.includes('계획된 활동')) {
            const plannedInput = document.querySelector(`.planned-input[data-index="${index}"]`);
            if (plannedInput && typeof plannedInput.focus === 'function') plannedInput.focus();
        }
        return;
    }
     // 다른 모든 타이머 정지
    this.stopAllTimers();
     const slot = this.timeSlots[index];
    const resumeBase = Math.max(
        Number.isFinite(slot.timer.elapsed) ? Math.floor(slot.timer.elapsed) : 0,
        Number.isFinite(slot.timer.rawElapsed) ? Math.floor(slot.timer.rawElapsed) : 0
    );
    slot.timer.elapsed = Math.max(0, resumeBase);
    slot.timer.rawElapsed = Math.max(0, resumeBase);
    slot.timer.running = true;
    slot.timer.startTime = Date.now();
    slot.timer.status = 'running';
     this.startTimerInterval();
    this.renderTimeEntries();
    this.autoSave();
}

function pauseTimer(index) {
    const slot = this.timeSlots[index];
    const nextElapsed = Number.isFinite(slot.timer.elapsed) ? Math.floor(slot.timer.elapsed) : 0;
    slot.timer.running = false;
    slot.timer.elapsed = Math.max(0, nextElapsed + Math.floor((Date.now() - slot.timer.startTime) / 1000));
    slot.timer.rawElapsed = slot.timer.elapsed;
    slot.timer.startTime = null;
    slot.timer.status = slot.timer.elapsed > 0 ? 'paused' : 'idle';
     this.stopTimerInterval();
    this.renderTimeEntries();
    this.autoSave();
}

function startTimer(index) {
    const reason = this.getTimerStartBlockReason(index);
    if (reason) {
        this.showNotification(reason, 'warn');
        if (reason.includes('계획된 활동')) {
            const plannedInput = document.querySelector(`.planned-input[data-index="${index}"]`);
            if (plannedInput && typeof plannedInput.focus === 'function') plannedInput.focus();
        }
        return;
    }
     // 다른 모든 타이머 정지
    this.stopAllTimers();
     const slot = this.timeSlots[index];
    slot.timer.rawElapsed = 0;
    slot.timer.running = true;
    slot.timer.startTime = Date.now();
    slot.timer.method = 'timer';
    slot.timer.status = 'running';
     this.startTimerInterval();
    this.renderTimeEntries();
    this.autoSave();
}

function attachTimerListeners(entryDiv, index) {
    const timerBtns = entryDiv.querySelectorAll('.timer-btn');
     timerBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const action = btn.dataset.action;
            const btnIndex = parseInt(btn.dataset.index);
             switch(action) {
                case 'start':
                    this.startTimer(btnIndex);
                    break;
                case 'pause':
                    this.pauseTimer(btnIndex);
                    break;
                case 'resume':
                    this.resumeTimer(btnIndex);
                    break;
                case 'stop':
                    this.stopTimer(btnIndex);
                    break;
            }
        });
    });
}

    return Object.freeze({
        parseMergeRange,
        resolveTimerEligibility,
        getStartBlockReason,
        resolveTimerControlState,
        attachTimerListeners,
        startTimer,
        pauseTimer,
        resumeTimer,
        stopTimer,
        commitRunningTimers,
        updateRunningTimers,
        DEFAULT_START_BLOCK_MESSAGES,
        DEFAULT_CONTROL_MESSAGES,
    });
});
