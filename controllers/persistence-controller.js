(function attachTimeTrackerPersistenceController(root, factory) {
    const api = factory(root);

    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    }

    if (root) {
        const existing = (root.TimeTrackerPersistenceController && typeof root.TimeTrackerPersistenceController === 'object')
            ? root.TimeTrackerPersistenceController
            : {};
        root.TimeTrackerPersistenceController = Object.assign(existing, api);
    }
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildTimeTrackerPersistenceController(root) {
    function getStateCore() {
        if (root && root.TimeTrackerStateCore && typeof root.TimeTrackerStateCore === 'object') {
            return root.TimeTrackerStateCore;
        }
        return null;
    }

    function getStorageAdapter() {
        if (root && root.TimeTrackerStorage && typeof root.TimeTrackerStorage === 'object') {
            return root.TimeTrackerStorage;
        }
        return null;
    }

    function serializeSnapshotFallback() {
        let mergedFieldsObject = {};
        if (this.mergedFields instanceof Map) {
            mergedFieldsObject = Object.fromEntries(this.mergedFields);
        } else if (this.mergedFields && typeof this.mergedFields === 'object') {
            mergedFieldsObject = { ...this.mergedFields };
        }
        return JSON.stringify({
            date: this.currentDate,
            timeSlots: this.timeSlots,
            mergedFields: mergedFieldsObject,
        });
    }

    async function saveData() {
        this.setSaveStatus('info', 'Saving');
        this._hasPendingRemoteSync = true;
        persistLocalSnapshotNow.call(this);

        this.setSaveStatus('success', 'Saved');
        try {
            const isOnline = typeof navigator === 'undefined' || !navigator || navigator.onLine !== false;
            this.setSyncStatus(
                isOnline ? 'info' : 'warn',
                isOnline ? 'Remote sync scheduled' : 'Offline (will sync when online)'
            );
            this.scheduleSupabaseSave && this.scheduleSupabaseSave();
        } catch (_) {}
    }

    function persistLocalSnapshotNow() {
        const stateCore = getStateCore();
        let serializedSnapshot = '';
        try {
            if (stateCore && typeof stateCore.serializeStateSnapshot === 'function') {
                serializedSnapshot = stateCore.serializeStateSnapshot(this.currentDate, this.timeSlots, this.mergedFields);
            } else {
                serializedSnapshot = serializeSnapshotFallback.call(this);
            }

            const storage = getStorageAdapter();
            if (storage && typeof storage.setTimesheetData === 'function') {
                storage.setTimesheetData(this.currentDate, serializedSnapshot);
            } else if (typeof localStorage !== 'undefined' && localStorage && typeof localStorage.setItem === 'function') {
                localStorage.setItem(`timesheetData:${String(this.currentDate || '').trim()}`, serializedSnapshot);
                localStorage.setItem('timesheetData:last', serializedSnapshot);
            }
            this._lastSavedSignature = serializedSnapshot;
        } catch (_) {}
        return serializedSnapshot;
    }

    function createStateSnapshot(timeSlots = this.timeSlots, mergedFields = this.mergedFields) {
        const stateCore = getStateCore();
        if (stateCore && typeof stateCore.createStateSnapshot === 'function') {
            return stateCore.createStateSnapshot(timeSlots, mergedFields);
        }

        const safeSlots = Array.isArray(timeSlots) ? timeSlots : [];
        let clonedSlots;
        try {
            clonedSlots = JSON.parse(JSON.stringify(safeSlots));
        } catch (_) {
            clonedSlots = safeSlots.map((slot) => ({ ...(slot || {}) }));
        }

        let mergedObject = {};
        if (mergedFields instanceof Map) {
            mergedObject = Object.fromEntries(mergedFields);
        } else if (mergedFields && typeof mergedFields === 'object') {
            mergedObject = { ...mergedFields };
        }

        return {
            timeSlots: clonedSlots,
            mergedFields: mergedObject,
        };
    }

    async function loadData() {
        this.generateTimeSlots();
        this.mergedFields.clear();

        try {
            let serialized = null;
            const storage = getStorageAdapter();
            if (storage && typeof storage.getTimesheetData === 'function') {
                serialized = storage.getTimesheetData(this.currentDate);
            } else if (typeof localStorage !== 'undefined' && localStorage && typeof localStorage.getItem === 'function') {
                serialized = localStorage.getItem(`timesheetData:${String(this.currentDate || '').trim()}`)
                    || localStorage.getItem('timesheetData:last');
            }

            if (serialized) {
                const parsed = JSON.parse(serialized);
                const stateCore = getStateCore();
                if (stateCore && typeof stateCore.restoreStateSnapshot === 'function') {
                    const restored = stateCore.restoreStateSnapshot(parsed, {
                        templateSlots: this.createEmptyTimeSlots(),
                        normalizePlanActivitiesArray: (items) => this.normalizePlanActivitiesArray(items),
                        normalizeActivityText: this.normalizeActivityText
                            ? (value) => this.normalizeActivityText(value)
                            : undefined,
                        normalizeTimerStatus: (status, slot) => this.normalizeTimerStatus(status, slot),
                        normalizeActivitiesArray: (items) => this.normalizeActivitiesArray(items),
                        normalizeMergeKey: this.normalizeMergeKey
                            ? (mergeKey) => this.normalizeMergeKey(mergeKey)
                            : undefined,
                    });
                    this.timeSlots = restored.timeSlots;
                    this.mergedFields = restored.mergedFields;
                } else {
                    if (Array.isArray(parsed && parsed.timeSlots) && parsed.timeSlots.length > 0) {
                        const nextSlots = this.createEmptyTimeSlots();
                        parsed.timeSlots.slice(0, nextSlots.length).forEach((sourceSlot, index) => {
                            if (!sourceSlot || typeof sourceSlot !== 'object') return;
                            const targetSlot = nextSlots[index];
                            targetSlot.planned = String(sourceSlot.planned || '');
                            targetSlot.actual = String(sourceSlot.actual || '');
                            targetSlot.planActivities = this.normalizePlanActivitiesArray(sourceSlot.planActivities);
                            targetSlot.planTitle = this.normalizeActivityText
                                ? this.normalizeActivityText(sourceSlot.planTitle || '')
                                : String(sourceSlot.planTitle || '').trim();
                            targetSlot.planTitleBandOn = Boolean(sourceSlot.planTitleBandOn);
                            targetSlot.timer = {
                                running: Boolean(sourceSlot.timer && sourceSlot.timer.running),
                                elapsed: Number.isFinite(sourceSlot.timer && sourceSlot.timer.elapsed)
                                    ? Math.max(0, Math.floor(sourceSlot.timer.elapsed))
                                    : 0,
                                rawElapsed: Number.isFinite(sourceSlot.timer && sourceSlot.timer.rawElapsed)
                                    ? Math.max(0, Math.floor(sourceSlot.timer.rawElapsed))
                                    : 0,
                                startTime: Number.isFinite(sourceSlot.timer && sourceSlot.timer.startTime)
                                    ? sourceSlot.timer.startTime
                                    : null,
                                method: (sourceSlot.timer && String(sourceSlot.timer.method || 'manual') === 'pomodoro')
                                    ? 'pomodoro'
                                    : 'manual',
                                status: this.normalizeTimerStatus(sourceSlot.timer && sourceSlot.timer.status, sourceSlot),
                            };
                            targetSlot.activityLog = {
                                title: String(sourceSlot.activityLog && sourceSlot.activityLog.title || ''),
                                details: String(sourceSlot.activityLog && sourceSlot.activityLog.details || ''),
                                subActivities: this.normalizeActivitiesArray(sourceSlot.activityLog && sourceSlot.activityLog.subActivities),
                                titleBandOn: Boolean(sourceSlot.activityLog && sourceSlot.activityLog.titleBandOn),
                                actualGridUnits: Array.isArray(sourceSlot.activityLog && sourceSlot.activityLog.actualGridUnits)
                                    ? sourceSlot.activityLog.actualGridUnits.map((value) => Boolean(value))
                                    : [],
                                actualExtraGridUnits: Array.isArray(sourceSlot.activityLog && sourceSlot.activityLog.actualExtraGridUnits)
                                    ? sourceSlot.activityLog.actualExtraGridUnits.map((value) => Boolean(value))
                                    : [],
                                actualFailedGridUnits: Array.isArray(sourceSlot.activityLog && sourceSlot.activityLog.actualFailedGridUnits)
                                    ? sourceSlot.activityLog.actualFailedGridUnits.map((value) => Boolean(value))
                                    : [],
                                actualOverride: Boolean(sourceSlot.activityLog && sourceSlot.activityLog.actualOverride),
                            };
                            this.normalizeActivityLog(targetSlot);
                        });
                        this.timeSlots = nextSlots;
                    }

                    const parsedMergedFields = (parsed && parsed.mergedFields && typeof parsed.mergedFields === 'object')
                        ? parsed.mergedFields
                        : {};
                    const nextMergedFields = new Map();
                    Object.entries(parsedMergedFields).forEach(([mergeKey, mergeValue]) => {
                        const safeMergeKey = this.normalizeMergeKey ? this.normalizeMergeKey(mergeKey) : mergeKey;
                        if (!safeMergeKey) return;
                        nextMergedFields.set(safeMergeKey, String(mergeValue || ''));
                    });
                    this.mergedFields = nextMergedFields;
                }
            }
        } catch (_) {}

        const routineApplied = this.applyRoutinesToDate
            ? this.applyRoutinesToDate(this.currentDate, { reason: 'load' })
            : false;

        this.renderTimeEntries();
        this.calculateTotals();
        if (routineApplied) {
            this.autoSave();
        }
        try { this.fetchFromSupabaseForDate && this.fetchFromSupabaseForDate(this.currentDate); } catch (_) {}
    }

    function clearLegacyLocalStorageData() {
        try {
            if (typeof localStorage === 'undefined' || !localStorage) return;
            if (typeof localStorage.removeItem !== 'function' || typeof localStorage.key !== 'function') return;

            const keysToDelete = [
                `timesheetData:${String(this.currentDate || '').trim()}`,
                'timesheetData:last',
                'tt.dayStartHour',
            ];
            keysToDelete.forEach((key) => {
                if (typeof key === 'string' && key) {
                    try { localStorage.removeItem(key); } catch (_) {}
                }
            });

            for (let i = localStorage.length - 1; i >= 0; i--) {
                const key = localStorage.key(i);
                if (typeof key === 'string' && key.startsWith('timesheetData:')) {
                    try { localStorage.removeItem(key); } catch (_) {}
                }
            }
        } catch (_) {}
    }

    function startChangeWatcher() {
        if (this._watcher) clearInterval(this._watcher);
        this._watcher = setInterval(() => {
            try {
                let shouldPersist = false;
                try {
                    for (let i = 0; i < (this.timeSlots?.length || 0); i++) {
                        const row = document.querySelector(`[data-index="${i}"]`);
                        if (!row) continue;
                        const input = row.querySelector('.timer-result-input');
                        if (!input || input.tagName !== 'INPUT') continue;
                        const value = String(input.value || '');
                        if (this.timeSlots[i].actual !== value) {
                            this.timeSlots[i].actual = value;
                            this.syncTimerElapsedFromActualInput(i, value);
                            shouldPersist = true;
                        }
                    }
                } catch (_) {}

                const sig = JSON.stringify({
                    date: this.currentDate,
                    timeSlots: this.timeSlots,
                    mergedFields: Object.fromEntries(this.mergedFields),
                });
                const currentTimeIndex = this.getCurrentTimeIndex ? this.getCurrentTimeIndex() : -1;
                if (currentTimeIndex !== this.lastRenderedCurrentTimeIndex) {
                    this.renderTimeEntries(Boolean(this.inlinePlanDropdown));
                    this.calculateTotals();
                    return;
                }
                if (sig !== this._lastSavedSignature) {
                    shouldPersist = true;
                }
                if (shouldPersist) {
                    this.autoSave();
                }
            } catch (_) {}
        }, 5000);
    }

    function autoSave() {
        clearTimeout(this.autoSaveTimeout);
        persistLocalSnapshotNow.call(this);
        this.autoSaveTimeout = setTimeout(() => {
            if (typeof this.saveData === 'function') {
                this.saveData();
            } else {
                saveData.call(this);
            }
        }, 1500);
    }

    return Object.freeze({
        saveData,
        persistLocalSnapshotNow,
        createStateSnapshot,
        loadData,
        clearLegacyLocalStorageData,
        startChangeWatcher,
        autoSave,
    });
});
