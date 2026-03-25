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

    function applySlotsJson(slotsJson) {
    if (!slotsJson || typeof slotsJson !== 'object') return false;
    let changed = false;
    const nextMergedFields = new Map();
    try {
        Object.keys(slotsJson).forEach((k) => {
            const hour = parseInt(k, 10);
            if (isNaN(hour)) return;
            const label = this.hourToLabel(hour);
            const idx = this.timeSlots.findIndex(s => String(s.time) === label);
            if (idx < 0) return;
            const row = slotsJson[k] || {};

            const plannedValue = typeof row.planned === 'string' ? row.planned : '';
            const actualValue = typeof row.actual === 'string' ? row.actual : '';
            const detailsValue = typeof row.details === 'string' ? row.details : '';
            const hasActivities = Array.isArray(row.activities);
            const hasPlanActivities = Array.isArray(row.planActivities);
            const planTitleValue = typeof row.planTitle === 'string'
                ? (this.normalizeActivityText ? this.normalizeActivityText(row.planTitle) : row.planTitle.trim())
                : '';
            const planTitleBand = Boolean(row.planTitleBandOn);
            const actualTitleBand = Boolean(row.actualTitleBandOn);
            const actualGridUnits = Array.isArray(row.actualGridUnits)
                ? row.actualGridUnits.map(value => Boolean(value))
                : [];
            const actualExtraGridUnits = Array.isArray(row.actualExtraGridUnits)
                ? row.actualExtraGridUnits.map(value => Boolean(value))
                : [];
            const actualFailedGridUnits = Array.isArray(row.actualFailedGridUnits)
                ? row.actualFailedGridUnits.map(value => Boolean(value))
                : [];
            const timerRow = row && typeof row.timer === 'object' ? row.timer : null;
            const normalizedTimer = {
                running: Boolean(timerRow && timerRow.running),
                elapsed: Number.isFinite(timerRow && timerRow.elapsed) ? Math.max(0, Math.floor(timerRow.elapsed)) : 0,
                rawElapsed: Number.isFinite(timerRow && timerRow.rawElapsed) ? Math.max(0, Math.floor(timerRow.rawElapsed)) : 0,
                startTime: Number.isFinite(timerRow && timerRow.startTime) ? timerRow.startTime : null,
                method: (timerRow && String(timerRow.method || 'manual') === 'pomodoro') ? 'pomodoro' : 'manual',
                status: this.normalizeTimerStatus(timerRow && timerRow.status, { timer: timerRow || {} }),
            };

            if (row && row.merged && typeof row.timeRange === 'string') {
                const parts = row.timeRange.split('~').map(part => String(part || '').trim()).filter(Boolean);
                if (parts.length === 2) {
                    const [startLabel, endLabel] = parts;
                    const startIdx = this.timeSlots.findIndex(s => String(s.time) === startLabel);
                    const endIdx = this.timeSlots.findIndex(s => String(s.time) === endLabel);
                    if (startIdx >= 0 && endIdx >= startIdx) {
                        const plannedKey = `planned-${startIdx}-${endIdx}`;
                        const timeKey = `time-${startIdx}-${endIdx}`;
                        const actualKey = `actual-${startIdx}-${endIdx}`;
                        const plannedTrimmed = String(plannedValue || '').trim();
                        const actualTrimmed = String(actualValue || '').trim();
                        const activitiesValue = hasActivities ? this.normalizeActivitiesArray(row.activities) : null;
                        const planActivitiesValue = hasPlanActivities ? this.normalizePlanActivitiesArray(row.planActivities) : null;
                        nextMergedFields.set(plannedKey, plannedTrimmed);
                        nextMergedFields.set(timeKey, `${startLabel}-${endLabel}`);
                        nextMergedFields.set(actualKey, actualTrimmed);

                        for (let i = startIdx; i <= endIdx; i++) {
                            const slot = this.timeSlots[i];
                            const nextPlanned = i === startIdx ? plannedTrimmed : '';
                            const nextActual = i === startIdx ? actualTrimmed : '';
                            if (slot.planned !== nextPlanned) { slot.planned = nextPlanned; changed = true; }
                            if (slot.actual !== nextActual) { slot.actual = nextActual; changed = true; }
                            if (!slot.activityLog || typeof slot.activityLog !== 'object') {
                                slot.activityLog = { title: '', details: '', subActivities: [], titleBandOn: false, actualGridUnits: [], actualExtraGridUnits: [], actualFailedGridUnits: [], actualOverride: false };
                            }
                            const desiredDetails = (i === startIdx) ? detailsValue : '';
                            if (slot.activityLog.details !== desiredDetails) {
                                slot.activityLog.details = desiredDetails;
                                changed = true;
                            }
                            const desiredPlanTitle = (i === startIdx) ? planTitleValue : '';
                            if (slot.planTitle !== desiredPlanTitle) {
                                slot.planTitle = desiredPlanTitle;
                                changed = true;
                            }
                            const desiredTimer = (i === startIdx)
                                ? normalizedTimer
                                : { running: false, elapsed: 0, rawElapsed: 0, startTime: null, method: 'manual', status: 'idle' };
                            const currentTimerSig = JSON.stringify(slot.timer || {});
                            const desiredTimerSig = JSON.stringify(desiredTimer);
                            if (currentTimerSig !== desiredTimerSig) {
                                slot.timer = { ...desiredTimer };
                                changed = true;
                            }
                            const shouldPlanBand = (i === startIdx) && planTitleBand && Boolean(planTitleValue);
                            if (slot.planTitleBandOn !== shouldPlanBand) {
                                slot.planTitleBandOn = shouldPlanBand;
                                changed = true;
                            }
                            const desiredTitleBand = (i === startIdx) && actualTitleBand && Array.isArray(activitiesValue) && activitiesValue.length > 0;
                            if (slot.activityLog.titleBandOn !== desiredTitleBand) {
                                slot.activityLog.titleBandOn = desiredTitleBand;
                                changed = true;
                            }
                            if (i === startIdx) {
                                slot.activityLog.actualGridUnits = actualGridUnits.slice();
                                slot.activityLog.actualExtraGridUnits = actualExtraGridUnits.slice();
                                slot.activityLog.actualFailedGridUnits = actualFailedGridUnits.slice();
                            } else {
                                slot.activityLog.actualGridUnits = [];
                                slot.activityLog.actualExtraGridUnits = [];
                                slot.activityLog.actualFailedGridUnits = [];
                            }
                            if (hasActivities) {
                                const desiredActivities = (i === startIdx) ? activitiesValue : [];
                                const currentActivities = Array.isArray(slot.activityLog.subActivities) ? slot.activityLog.subActivities : [];
                                const desiredSignature = JSON.stringify(desiredActivities);
                                const currentSignature = JSON.stringify(this.normalizeActivitiesArray(currentActivities));
                                if (desiredSignature !== currentSignature) {
                                    slot.activityLog.subActivities = desiredActivities.map(item => ({ ...item }));
                                    changed = true;
                                }
                            }
                            if (hasPlanActivities) {
                                const desiredPlan = (i === startIdx) ? planActivitiesValue : [];
                                const currentPlan = Array.isArray(slot.planActivities) ? slot.planActivities : [];
                                const desiredPlanSig = JSON.stringify(desiredPlan);
                                const currentPlanSig = JSON.stringify(this.normalizePlanActivitiesArray(currentPlan));
                                if (desiredPlanSig !== currentPlanSig) {
                                    slot.planActivities = desiredPlan.map(item => ({ ...item }));
                                    changed = true;
                                }
                            }
                        }
                        return;
                    }
                }
            }

            const slot = this.timeSlots[idx];
            if (slot.planned !== plannedValue) { slot.planned = plannedValue; changed = true; }
            if (slot.actual !== actualValue) { slot.actual = actualValue; changed = true; }
            const currentTimerSig = JSON.stringify(slot.timer || {});
            const desiredTimerSig = JSON.stringify(normalizedTimer);
            if (currentTimerSig !== desiredTimerSig) {
                slot.timer = { ...normalizedTimer };
                changed = true;
            }
            if (!slot.activityLog || typeof slot.activityLog !== 'object') slot.activityLog = { title: '', details: '', subActivities: [], titleBandOn: false, actualGridUnits: [], actualExtraGridUnits: [], actualFailedGridUnits: [], actualOverride: false };
            if (slot.activityLog.details !== detailsValue) { slot.activityLog.details = detailsValue; changed = true; }
            const normalizedActivities = hasActivities ? this.normalizeActivitiesArray(row.activities) : [];
            const normalizedPlanActivities = hasPlanActivities ? this.normalizePlanActivitiesArray(row.planActivities) : [];
            if (slot.planTitle !== planTitleValue) { slot.planTitle = planTitleValue; changed = true; }
            const appliedPlanBand = planTitleBand && Boolean(planTitleValue);
            if (slot.planTitleBandOn !== appliedPlanBand) { slot.planTitleBandOn = appliedPlanBand; changed = true; }
            const appliedTitleBand = actualTitleBand && normalizedActivities.length > 0;
            if (slot.activityLog.titleBandOn !== appliedTitleBand) { slot.activityLog.titleBandOn = appliedTitleBand; changed = true; }
            slot.activityLog.actualGridUnits = actualGridUnits.slice();
            slot.activityLog.actualExtraGridUnits = actualExtraGridUnits.slice();
            slot.activityLog.actualFailedGridUnits = actualFailedGridUnits.slice();
            if (hasActivities) {
                const currentActivities = Array.isArray(slot.activityLog.subActivities) ? slot.activityLog.subActivities : [];
                const desiredSignature = JSON.stringify(normalizedActivities);
                const currentSignature = JSON.stringify(this.normalizeActivitiesArray(currentActivities));
                if (desiredSignature !== currentSignature) {
                    slot.activityLog.subActivities = normalizedActivities.map(item => ({ ...item }));
                    changed = true;
                }
            }
            if (hasPlanActivities) {
                const currentPlan = Array.isArray(slot.planActivities) ? slot.planActivities : [];
                const desiredPlanSig = JSON.stringify(normalizedPlanActivities);
                const currentPlanSig = JSON.stringify(this.normalizePlanActivitiesArray(currentPlan));
                if (desiredPlanSig !== currentPlanSig) {
                    slot.planActivities = normalizedPlanActivities.map(item => ({ ...item }));
                    changed = true;
                }
            }
        });
    } catch (_) {}

    const currentMergedSignature = JSON.stringify(Object.fromEntries(this.mergedFields));
    const nextMergedSignature = JSON.stringify(Object.fromEntries(nextMergedFields));
    if (currentMergedSignature !== nextMergedSignature) {
        this.mergedFields = nextMergedFields;
        changed = true;
    } else {
        this.mergedFields = nextMergedFields;
    }
    return changed;
}

    function buildSlotsJson() {
    const slots = {};
    const handledMerges = new Set();
    try {
        this.timeSlots.forEach((slot, index) => {
            const timeMergeKey = this.findMergeKey('time', index);
            if (timeMergeKey) {
                if (handledMerges.has(timeMergeKey)) return;
                handledMerges.add(timeMergeKey);

                const [, startStr, endStr] = timeMergeKey.split('-');
                const start = parseInt(startStr, 10);
                const end = parseInt(endStr, 10);
                if (isNaN(start) || isNaN(end)) return;
                const startSlot = this.timeSlots[start];
                const endSlot = this.timeSlots[end];
                if (!startSlot || !endSlot) return;

                const startLabel = String(startSlot.time || '').trim();
                const endLabel = String(endSlot.time || '').trim();
                const plannedKey = `planned-${start}-${end}`;
                const actualKey = `actual-${start}-${end}`;
                const plannedValue = String((this.mergedFields.get(plannedKey) ?? startSlot.planned ?? '')).trim();
                const actualValue = String((this.mergedFields.get(actualKey) ?? startSlot.actual ?? '')).trim();
                const detailsValue = String((startSlot.activityLog && startSlot.activityLog.details) || '').trim();
                const activitiesValue = this.normalizeActivitiesArray(startSlot.activityLog && startSlot.activityLog.subActivities);
                const planActivitiesValue = this.normalizePlanActivitiesArray(startSlot.planActivities);
                const planTitleValue = this.normalizeActivityText
                    ? this.normalizeActivityText(startSlot.planTitle || '')
                    : String(startSlot.planTitle || '').trim();
                const planTitleBand = Boolean(startSlot.planTitleBandOn && planTitleValue);
                const actualTitleBand = Boolean(startSlot.activityLog && startSlot.activityLog.titleBandOn);
                const actualGridUnits = (startSlot.activityLog && Array.isArray(startSlot.activityLog.actualGridUnits))
                    ? startSlot.activityLog.actualGridUnits.map(value => Boolean(value))
                    : [];
                const hasActualGridUnits = actualGridUnits.some(value => value);
                const actualExtraGridUnits = (startSlot.activityLog && Array.isArray(startSlot.activityLog.actualExtraGridUnits))
                    ? startSlot.activityLog.actualExtraGridUnits.map(value => Boolean(value))
                    : [];
                const hasActualExtraGridUnits = actualExtraGridUnits.some(value => value);
                const actualFailedGridUnits = (startSlot.activityLog && Array.isArray(startSlot.activityLog.actualFailedGridUnits))
                    ? startSlot.activityLog.actualFailedGridUnits.map(value => Boolean(value))
                    : [];
                const hasActualFailedGridUnits = actualFailedGridUnits.some(value => value);
                const timerInfo = startSlot.timer && typeof startSlot.timer === 'object' ? startSlot.timer : {};
                const timerEntry = {
                    running: Boolean(timerInfo.running),
                    elapsed: Number.isFinite(timerInfo.elapsed) ? Math.max(0, Math.floor(timerInfo.elapsed)) : 0,
                    rawElapsed: Number.isFinite(timerInfo.rawElapsed) ? Math.max(0, Math.floor(timerInfo.rawElapsed)) : 0,
                    startTime: Number.isFinite(timerInfo.startTime) ? timerInfo.startTime : null,
                    method: String(timerInfo.method || 'manual') === 'pomodoro' ? 'pomodoro' : 'manual',
                    status: this.normalizeTimerStatus(timerInfo.status, startSlot),
                };
                const hasTimerEntry = timerEntry.running
                    || timerEntry.elapsed > 0
                    || timerEntry.rawElapsed > 0
                    || timerEntry.startTime != null
                    || timerEntry.method !== 'manual'
                    || timerEntry.status !== 'idle';

                if (plannedValue === ''
                    && actualValue === ''
                    && detailsValue === ''
                    && activitiesValue.length === 0
                    && planActivitiesValue.length === 0
                    && !planTitleValue
                    && !hasTimerEntry) {
                    return;
                }

                const storageKey = String(this.labelToHour(startLabel));
                slots[storageKey] = {
                    planned: plannedValue,
                    actual: actualValue,
                    details: detailsValue,
                    merged: true,
                    timeRange: `${startLabel} ~ ${endLabel}`
                };
                if (activitiesValue.length > 0) {
                    slots[storageKey].activities = activitiesValue.map(item => ({ ...item }));
                }
                if (planActivitiesValue.length > 0) {
                    slots[storageKey].planActivities = planActivitiesValue.map(item => ({ ...item }));
                }
                if (planTitleValue) {
                    slots[storageKey].planTitle = planTitleValue;
                }
                if (planTitleBand) {
                    slots[storageKey].planTitleBandOn = true;
                }
                if (actualTitleBand) {
                    slots[storageKey].actualTitleBandOn = true;
                }
                if (hasActualGridUnits) {
                    slots[storageKey].actualGridUnits = actualGridUnits;
                }
                if (hasActualExtraGridUnits) {
                    slots[storageKey].actualExtraGridUnits = actualExtraGridUnits;
                }
                if (hasActualFailedGridUnits) {
                    slots[storageKey].actualFailedGridUnits = actualFailedGridUnits;
                }
                if (hasTimerEntry) {
                    slots[storageKey].timer = timerEntry;
                }
                return;
            }

            const hour = this.labelToHour(slot.time);
            const planned = String(slot.planned || '').trim();
            const actual = String(slot.actual || '').trim();
            const details = String((slot.activityLog && slot.activityLog.details) || '').trim();
            const activitiesValue = this.normalizeActivitiesArray(slot.activityLog && slot.activityLog.subActivities);
            const planActivitiesValue = this.normalizePlanActivitiesArray(slot.planActivities);
            const planTitleValue = this.normalizeActivityText
                ? this.normalizeActivityText(slot.planTitle || '')
                : String(slot.planTitle || '').trim();
            const planTitleBand = Boolean(slot.planTitleBandOn && planTitleValue);
            const actualTitleBand = Boolean(slot.activityLog && slot.activityLog.titleBandOn);
            const actualGridUnits = (slot.activityLog && Array.isArray(slot.activityLog.actualGridUnits))
                ? slot.activityLog.actualGridUnits.map(value => Boolean(value))
                : [];
            const hasActualGridUnits = actualGridUnits.some(value => value);
            const actualExtraGridUnits = (slot.activityLog && Array.isArray(slot.activityLog.actualExtraGridUnits))
                ? slot.activityLog.actualExtraGridUnits.map(value => Boolean(value))
                : [];
            const hasActualExtraGridUnits = actualExtraGridUnits.some(value => value);
            const actualFailedGridUnits = (slot.activityLog && Array.isArray(slot.activityLog.actualFailedGridUnits))
                ? slot.activityLog.actualFailedGridUnits.map(value => Boolean(value))
                : [];
            const hasActualFailedGridUnits = actualFailedGridUnits.some(value => value);
            const timerInfo = slot.timer && typeof slot.timer === 'object' ? slot.timer : {};
            const timerEntry = {
                running: Boolean(timerInfo.running),
                elapsed: Number.isFinite(timerInfo.elapsed) ? Math.max(0, Math.floor(timerInfo.elapsed)) : 0,
                rawElapsed: Number.isFinite(timerInfo.rawElapsed) ? Math.max(0, Math.floor(timerInfo.rawElapsed)) : 0,
                startTime: Number.isFinite(timerInfo.startTime) ? timerInfo.startTime : null,
                method: String(timerInfo.method || 'manual') === 'pomodoro' ? 'pomodoro' : 'manual',
                status: this.normalizeTimerStatus(timerInfo.status, slot),
            };
            const hasTimerEntry = timerEntry.running
                || timerEntry.elapsed > 0
                || timerEntry.rawElapsed > 0
                || timerEntry.startTime != null
                || timerEntry.method !== 'manual'
                || timerEntry.status !== 'idle';
            if (planned !== ''
                || actual !== ''
                || details !== ''
                || activitiesValue.length > 0
                || planActivitiesValue.length > 0
                || planTitleValue
                || hasTimerEntry) {
                const entry = { planned, actual, details };
                if (activitiesValue.length > 0) {
                    entry.activities = activitiesValue.map(item => ({ ...item }));
                }
                if (planActivitiesValue.length > 0) {
                    entry.planActivities = planActivitiesValue.map(item => ({ ...item }));
                }
                if (planTitleValue) {
                    entry.planTitle = planTitleValue;
                }
                if (planTitleBand) {
                    entry.planTitleBandOn = true;
                }
                if (actualTitleBand) {
                    entry.actualTitleBandOn = true;
                }
                if (hasActualGridUnits) {
                    entry.actualGridUnits = actualGridUnits;
                }
                if (hasActualExtraGridUnits) {
                    entry.actualExtraGridUnits = actualExtraGridUnits;
                }
                if (hasActualFailedGridUnits) {
                    entry.actualFailedGridUnits = actualFailedGridUnits;
                }
                if (hasTimerEntry) {
                    entry.timer = timerEntry;
                }
                slots[String(hour)] = entry;
            }
        });
    } catch (_) {}
    return slots;
}

    return Object.freeze({
        saveData,
        persistLocalSnapshotNow,
        createStateSnapshot,
        buildSlotsJson,
        applySlotsJson,
        loadData,
        clearLegacyLocalStorageData,
        startChangeWatcher,
        autoSave,
    });
});
