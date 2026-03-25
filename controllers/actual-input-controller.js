(function attachTimeTrackerActualInputController(root, factory) {
    const api = factory(root);

    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    }

    if (root) {
        const existing = (root.TimeTrackerActualInputController && typeof root.TimeTrackerActualInputController === 'object')
            ? root.TimeTrackerActualInputController
            : {};
        root.TimeTrackerActualInputController = Object.assign(existing, api);
    }
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildTimeTrackerActualInputController() {
    function isActualInputTarget(target) {
        return Boolean(
            target
            && target.classList
            && target.tagName === 'INPUT'
            && target.classList.contains('timer-result-input')
        );
    }

    function shouldHandleActualInputKey(key) {
        const safeKey = String(key || '');
        return safeKey.length === 1
            || safeKey === 'Backspace'
            || safeKey === 'Enter'
            || safeKey === 'Delete';
    }

    function writeActualInputValue(index, value) {
        const actualMergeKey = this.findMergeKey('actual', index);
        if (actualMergeKey) {
            const [, startStr, endStr] = actualMergeKey.split('-');
            const start = parseInt(startStr, 10);
            const end = parseInt(endStr, 10);
            this.mergedFields.set(actualMergeKey, value);
            for (let i = start; i <= end; i++) {
                if (!this.timeSlots[i]) continue;
                this.timeSlots[i].actual = (i === start) ? value : '';
            }
            return actualMergeKey;
        }

        if (this.timeSlots[index]) {
            this.timeSlots[index].actual = value;
        }
        return null;
    }

    function parseActualDurationInput(value) {
        const text = String(value || '').trim();
        if (!text) return 0;
        const parsed = this.parseDurationFromText(text);
        if (parsed != null && Number.isFinite(parsed)) {
            return parsed;
        }
        if (/^\d+$/.test(text)) {
            return parseInt(text, 10) * 60;
        }
        return null;
    }

    function syncTimerElapsedFromActualInput(index, text) {
        const secs = this.parseDurationFromText(text);
        if (secs == null || Number.isNaN(secs)) return;
        const slot = this.timeSlots[index];
        if (!slot || !slot.timer) return;
        slot.timer.elapsed = Math.max(0, Math.floor(secs));
        slot.timer.running = false;
        slot.timer.startTime = null;
        slot.timer.method = 'manual';
        slot.timer.status = slot.timer.elapsed > 0 ? 'completed' : 'idle';

        try {
            const row = document.querySelector(`[data-index="${index}"]`);
            if (row) {
                const disp = row.querySelector('.timer-display');
                if (disp) {
                    disp.textContent = this.formatTime(slot.timer.elapsed);
                    if (slot.timer.elapsed > 0) disp.style.display = 'block';
                }
            }
        } catch (_) {}
    }

    function clearSubActivitiesForIndex(index) {
        const clearSlotActivityLog = (slot) => {
            if (!slot || !slot.activityLog || !Array.isArray(slot.activityLog.subActivities)) return;
            slot.activityLog.subActivities = [];
            slot.activityLog.titleBandOn = false;
            slot.activityLog.actualOverride = false;
            if (Array.isArray(slot.activityLog.actualGridUnits)) {
                slot.activityLog.actualGridUnits = [];
            }
            if (Array.isArray(slot.activityLog.actualExtraGridUnits)) {
                slot.activityLog.actualExtraGridUnits = [];
            }
            if (Array.isArray(slot.activityLog.actualFailedGridUnits)) {
                slot.activityLog.actualFailedGridUnits = [];
            }
        };

        const mergeKey = this.findMergeKey('actual', index);
        if (mergeKey) {
            const [, startStr, endStr] = mergeKey.split('-');
            const start = parseInt(startStr, 10);
            const end = parseInt(endStr, 10);
            for (let i = start; i <= end; i++) {
                clearSlotActivityLog(this.timeSlots[i]);
            }
            return;
        }
        clearSlotActivityLog(this.timeSlots[index]);
    }

    function enforceActualLimit(index) {
        const actualMergeKey = this.findMergeKey('actual', index);
        let baseIndex = index;
        let rangeStart = index;
        let rangeEnd = index;
        if (actualMergeKey) {
            const [, startStr, endStr] = actualMergeKey.split('-');
            const parsedStart = parseInt(startStr, 10);
            const parsedEnd = parseInt(endStr, 10);
            if (Number.isFinite(parsedStart)) {
                baseIndex = parsedStart;
                rangeStart = parsedStart;
            }
            if (Number.isFinite(parsedEnd)) {
                rangeEnd = parsedEnd;
            }
        }
        const limit = this.getBlockLength('actual', baseIndex) * 3600;
        if (!(limit > 0)) return;
        const slot = this.timeSlots[baseIndex];
        if (!slot) return;
        const value = actualMergeKey
            ? String(this.mergedFields.get(actualMergeKey) || slot.actual || '').trim()
            : String(slot.actual || '').trim();
        const secs = this.parseDurationFromText(value);
        if (secs != null && Number.isFinite(secs) && secs > limit) {
            const clamped = this.formatDurationSummary(limit);
            if (actualMergeKey) {
                this.mergedFields.set(actualMergeKey, clamped);
                for (let i = rangeStart; i <= rangeEnd; i++) {
                    if (!this.timeSlots[i]) continue;
                    this.timeSlots[i].actual = (i === rangeStart) ? clamped : '';
                }
            } else {
                if (slot.actual === clamped) return;
                slot.actual = clamped;
            }
            try {
                const row = document.querySelector(`[data-index="${baseIndex}"]`);
                if (row) {
                    const input = row.querySelector('.timer-result-input');
                    if (input) {
                        input.textContent = clamped;
                        input.setAttribute('data-value', clamped);
                    }
                }
            } catch (_) {}
            this.showNotification('湲곕줉 ?쒓컙? ??移몃떦 理쒕? 60遺꾧퉴吏 ?낅젰?????덉뒿?덈떎.');
        }
    }

    function applyActualInputValue(index, value, options = {}) {
        const safeIndex = Number.isFinite(index) ? Math.floor(index) : -1;
        if (safeIndex < 0 || !Array.isArray(this.timeSlots) || !this.timeSlots[safeIndex]) return false;

        writeActualInputValue.call(this, safeIndex, value);

        if (options.enforceLimit !== false && typeof this.enforceActualLimit === 'function') {
            this.enforceActualLimit(safeIndex);
        }
        if (typeof this.clearSubActivitiesForIndex === 'function') {
            this.clearSubActivitiesForIndex(safeIndex);
        }
        if (typeof this.syncTimerElapsedFromActualInput === 'function') {
            this.syncTimerElapsedFromActualInput(safeIndex, value);
        }
        if (typeof this.calculateTotals === 'function') {
            this.calculateTotals();
        }
        if (typeof this.autoSave === 'function') {
            this.autoSave();
        }
        if (options.persistSnapshot && typeof this.saveData === 'function') {
            this.saveData().catch(() => {});
        }
        return true;
    }

    function handleActualInputEvent(eventType, target, event = null) {
        if (!isActualInputTarget(target)) return false;
        if (eventType === 'keyup' && !shouldHandleActualInputKey(event && event.key)) {
            return false;
        }

        try {
            const index = parseInt(target.dataset.index, 10);
            if (!Number.isFinite(index)) return false;
            return applyActualInputValue.call(this, index, target.value, {
                enforceLimit: eventType !== 'keyup',
                persistSnapshot: eventType === 'input',
            });
        } catch (err) {
            console.error(`[actual-input] ${eventType} handler error:`, err);
            return false;
        }
    }

    return Object.freeze({
        isActualInputTarget,
        shouldHandleActualInputKey,
        writeActualInputValue,
        parseActualDurationInput,
        syncTimerElapsedFromActualInput,
        clearSubActivitiesForIndex,
        enforceActualLimit,
        applyActualInputValue,
        handleActualInputEvent,
    });
});
