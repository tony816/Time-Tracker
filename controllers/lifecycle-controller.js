(function attachTimeTrackerLifecycleController(root, factory) {
    const api = factory(root);

    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    }

    if (root) {
        const existing = (root.TimeTrackerLifecycleController && typeof root.TimeTrackerLifecycleController === 'object')
            ? root.TimeTrackerLifecycleController
            : {};
        root.TimeTrackerLifecycleController = Object.assign(existing, api);
    }
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildTimeTrackerLifecycleController(root) {
    function handleClearButtonClick() {
        if (!confirm('모든 데이터를 초기화하시겠습니까? (5초 안에 실행 취소 가능)')) return;
        const snapshot = this.createStateSnapshot();
        this.clearData();
        this.pendingClearUndo = snapshot;
        this.showNotification('데이터가 초기화되었습니다. 실행 취소 가능', 'warn', {
            duration: 5000,
            actionLabel: '실행 취소',
            onAction: () => {
                if (!this.pendingClearUndo) return;
                this.timeSlots = this.pendingClearUndo.timeSlots;
                this.mergedFields = new Map(Object.entries(this.pendingClearUndo.mergedFields || {}));
                this.clearTimesheetClearPending(this.currentDate);
                this.renderTimeEntries();
                this.calculateTotals();
                this.autoSave();
                this._hasPendingRemoteSync = true;
                this.scheduleSupabaseSave && this.scheduleSupabaseSave();
                this.pendingClearUndo = null;
                this.showNotification('초기화를 되돌렸습니다.', 'success');
            },
            onClose: () => { this.pendingClearUndo = null; }
        });
    }

    function clearData() {
        this.commitRunningTimers({ render: false, calculate: false, autoSave: false });
        let routineChanged = false;
        if (this.routinesLoaded && Array.isArray(this.routines)) {
            this.routines.forEach((routine) => {
                if (!routine || typeof routine !== 'object') return;
                if (this.isRoutineStoppedForDate(routine, this.currentDate)) return;
                if (!this.isRoutineActiveOnDate(routine, this.currentDate)) return;
                if (!this.isRoutinePresentOnDate(routine)) return;
                const updated = this.passRoutineForDate(routine.id, this.currentDate);
                if (updated) routineChanged = true;
            });
            if (routineChanged) {
                this.scheduleSupabaseRoutineSave();
            }
        }
        this.generateTimeSlots();
        this.mergedFields.clear();
        this.renderTimeEntries();
        this.calculateTotals();
        this.renderInlinePlanDropdownOptions();
        this.closeRoutineMenu();
        // If user refreshes quickly, Supabase fetch could re-apply stale data.
        // Mark this day as "pending clear" so the next load will delete remote first.
        this.markTimesheetClearPending(this.currentDate);
        try { this.deleteFromSupabaseForDate(this.currentDate); } catch (_) {}
        try {
            this._lastSavedSignature = JSON.stringify({
                date: this.currentDate,
                timeSlots: this.timeSlots,
                mergedFields: {}
            });
        } catch (_) {
            this._lastSavedSignature = '';
        }
        // 자동 저장 시스템: 초기화 후에도 서버에 반영
        this.autoSave();
    }

    function changeDate(days) {
        const baseMs = this.getDateValue(this.currentDate);
        if (!Number.isFinite(baseMs)) return;
        const currentDate = new Date(baseMs);
        currentDate.setDate(currentDate.getDate() + days);
        this.transitionToDate(this.formatDateFromMsLocal(currentDate.getTime()));
    }

    function transitionToDate(nextDate) {
        const targetDate = String(nextDate || '').trim();
        if (!targetDate) return;

        const previousDate = this.currentDate;
        const committed = this.commitRunningTimers({ render: false, calculate: false, autoSave: false });

        if (committed && previousDate) {
            const snapshotSlots = JSON.parse(JSON.stringify(this.timeSlots || []));
            const snapshotMergedObj = Object.fromEntries(this.mergedFields || new Map());
            this.persistSnapshotForDate(previousDate, snapshotSlots, snapshotMergedObj).catch((e) => {
                console.warn('[date-transition] snapshot persist failed:', e);
            });
        }

        this.currentDate = targetDate;
        this.setCurrentDate();

        // 날짜 전환 시 이전 시트가 잠시라도 남지 않도록 즉시 초기화
        if (typeof this.generateTimeSlots === 'function') this.generateTimeSlots();
        if (this.mergedFields && typeof this.mergedFields.clear === 'function') this.mergedFields.clear();
        if (typeof this.renderTimeEntries === 'function') this.renderTimeEntries();
        if (typeof this.calculateTotals === 'function') this.calculateTotals();

        this.loadData();
        try { this.resubscribeSupabaseRealtime && this.resubscribeSupabaseRealtime(); } catch(_) {}
    }

    return Object.freeze({
        handleClearButtonClick,
        clearData,
        changeDate,
        transitionToDate
    });
});
