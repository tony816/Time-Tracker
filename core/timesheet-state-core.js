(function attachTimeTrackerStateCore(root, factory) {
    const api = factory();

    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    }

    if (root) {
        const existing = (root.TimeTrackerStateCore && typeof root.TimeTrackerStateCore === 'object')
            ? root.TimeTrackerStateCore
            : {};
        root.TimeTrackerStateCore = Object.assign(existing, api);
    }
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildTimeTrackerStateCore() {
    function createEmptyActivityLog() {
        return {
            title: '',
            details: '',
            subActivities: [],
            titleBandOn: false,
            actualGridUnits: [],
            actualExtraGridUnits: [],
            actualFailedGridUnits: [],
            actualOverride: false,
        };
    }

    function resolveNormalizeActivitiesArray(fn) {
        if (typeof fn === 'function') return fn;
        return (items) => Array.isArray(items)
            ? items.filter((item) => item && typeof item === 'object').map((item) => ({ ...item }))
            : [];
    }

    function resolveNormalizePlanActivitiesArray(fn) {
        if (typeof fn === 'function') return fn;
        return (items) => Array.isArray(items)
            ? items
                .filter((item) => item && typeof item === 'object')
                .map((item) => ({
                    label: String(item.label || item.title || '').trim(),
                    seconds: Number.isFinite(item.seconds) ? Math.max(0, Math.floor(item.seconds)) : 0,
                }))
                .filter((item) => item.label || item.seconds > 0)
            : [];
    }

    function resolveNormalizeActivityText(fn) {
        if (typeof fn === 'function') return fn;
        return (value) => String(value || '').trim();
    }

    function resolveNormalizeTimerStatus(fn) {
        if (typeof fn === 'function') return fn;
        return (rawStatus, slot = null) => {
            const normalized = String(rawStatus || '').trim();
            if (normalized === 'running' || normalized === 'paused' || normalized === 'completed' || normalized === 'idle') {
                return normalized;
            }
            return slot && slot.timer && slot.timer.running ? 'running' : 'idle';
        };
    }

    function resolveNormalizeMergeKey(fn) {
        if (typeof fn === 'function') return fn;
        return (value) => String(value || '').trim();
    }

    function toMergedFieldsObject(mergedFields) {
        if (mergedFields instanceof Map) {
            return Object.fromEntries(mergedFields);
        }
        if (mergedFields && typeof mergedFields === 'object') {
            return { ...mergedFields };
        }
        return {};
    }

    function cloneTimeSlots(timeSlots) {
        const safeSlots = Array.isArray(timeSlots) ? timeSlots : [];
        try {
            return JSON.parse(JSON.stringify(safeSlots));
        } catch (_) {
            return safeSlots.map((slot) => ({ ...(slot || {}) }));
        }
    }

    function createStateSnapshot(timeSlots, mergedFields) {
        return {
            timeSlots: cloneTimeSlots(timeSlots),
            mergedFields: toMergedFieldsObject(mergedFields),
        };
    }

    function serializeStateSnapshot(date, timeSlots, mergedFields) {
        const snapshot = createStateSnapshot(timeSlots, mergedFields);
        return JSON.stringify({
            date,
            timeSlots: snapshot.timeSlots,
            mergedFields: snapshot.mergedFields,
        });
    }

    function normalizeActivityLog(activityLog, options = {}) {
        const normalizeActivitiesArray = resolveNormalizeActivitiesArray(options.normalizeActivitiesArray);
        const normalized = createEmptyActivityLog();

        if (!activityLog || typeof activityLog !== 'object') {
            return normalized;
        }

        normalized.title = String(activityLog.title || '');
        normalized.details = String(activityLog.details || '');
        normalized.subActivities = Array.isArray(activityLog.subActivities)
            ? normalizeActivitiesArray(activityLog.subActivities)
            : [];
        normalized.titleBandOn = Boolean(activityLog.titleBandOn);
        normalized.actualGridUnits = Array.isArray(activityLog.actualGridUnits)
            ? activityLog.actualGridUnits.map((value) => Boolean(value))
            : [];
        normalized.actualExtraGridUnits = Array.isArray(activityLog.actualExtraGridUnits)
            ? activityLog.actualExtraGridUnits.map((value) => Boolean(value))
            : [];
        normalized.actualFailedGridUnits = Array.isArray(activityLog.actualFailedGridUnits)
            ? activityLog.actualFailedGridUnits.map((value) => Boolean(value))
            : [];
        normalized.actualOverride = Boolean(activityLog.actualOverride);

        return normalized;
    }

    function restoreStateSnapshot(parsedSnapshot, options = {}) {
        const parsed = (parsedSnapshot && typeof parsedSnapshot === 'object') ? parsedSnapshot : {};
        const templateSlots = Array.isArray(options.templateSlots) ? options.templateSlots : [];
        const normalizePlanActivitiesArray = resolveNormalizePlanActivitiesArray(options.normalizePlanActivitiesArray);
        const normalizeActivityText = resolveNormalizeActivityText(options.normalizeActivityText);
        const normalizeTimerStatus = resolveNormalizeTimerStatus(options.normalizeTimerStatus);
        const normalizeActivitiesArray = resolveNormalizeActivitiesArray(options.normalizeActivitiesArray);
        const normalizeMergeKey = resolveNormalizeMergeKey(options.normalizeMergeKey);

        if (Array.isArray(parsed.timeSlots) && parsed.timeSlots.length > 0) {
            parsed.timeSlots.slice(0, templateSlots.length).forEach((sourceSlot, index) => {
                if (!sourceSlot || typeof sourceSlot !== 'object') return;
                const targetSlot = templateSlots[index];
                if (!targetSlot || typeof targetSlot !== 'object') return;

                targetSlot.planned = String(sourceSlot.planned || '');
                targetSlot.actual = String(sourceSlot.actual || '');
                targetSlot.planActivities = normalizePlanActivitiesArray(sourceSlot.planActivities);
                targetSlot.planTitle = normalizeActivityText(sourceSlot.planTitle || '');
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
                    status: normalizeTimerStatus(sourceSlot.timer && sourceSlot.timer.status, sourceSlot),
                };
                targetSlot.activityLog = normalizeActivityLog(sourceSlot.activityLog, {
                    normalizeActivitiesArray,
                });
            });
        }

        const parsedMergedFields = (parsed.mergedFields && typeof parsed.mergedFields === 'object')
            ? parsed.mergedFields
            : {};
        const nextMergedFields = new Map();
        Object.entries(parsedMergedFields).forEach(([mergeKey, mergeValue]) => {
            const safeMergeKey = normalizeMergeKey(mergeKey);
            if (!safeMergeKey) return;
            nextMergedFields.set(safeMergeKey, String(mergeValue || ''));
        });

        return {
            timeSlots: templateSlots,
            mergedFields: nextMergedFields,
        };
    }

    return Object.freeze({
        createEmptyActivityLog,
        toMergedFieldsObject,
        cloneTimeSlots,
        createStateSnapshot,
        serializeStateSnapshot,
        normalizeActivityLog,
        restoreStateSnapshot,
    });
});
