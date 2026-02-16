(function attachTimeTrackerActualGridCore(root, factory) {
    const api = factory();

    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    }

    if (root) {
        const existing = (root.TimeTrackerActualGridCore && typeof root.TimeTrackerActualGridCore === 'object')
            ? root.TimeTrackerActualGridCore
            : {};
        root.TimeTrackerActualGridCore = Object.assign(existing, api);
    }
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildTimeTrackerActualGridCore() {
    function resolveStepSeconds(rawStepSeconds) {
        const parsed = Number(rawStepSeconds);
        if (!Number.isFinite(parsed) || parsed <= 0) return 600;
        return Math.max(1, Math.floor(parsed));
    }

    function getExtraActivityUnitCount(item, stepSeconds = 600) {
        if (!item) return 0;
        const step = resolveStepSeconds(stepSeconds);
        const assignedSeconds = Number.isFinite(item.seconds) ? Math.max(0, Math.floor(item.seconds)) : 0;
        const recordedSeconds = Number.isFinite(item.recordedSeconds)
            ? Math.max(0, Math.floor(item.recordedSeconds))
            : assignedSeconds;
        let assignedUnits = assignedSeconds > 0 ? Math.floor(assignedSeconds / step) : 0;
        let recordedUnits = recordedSeconds > 0 ? Math.floor(recordedSeconds / step) : 0;
        if (assignedSeconds > 0 && assignedUnits === 0) assignedUnits = 1;
        if (recordedSeconds > 0 && recordedUnits === 0) recordedUnits = 1;
        return Math.max(assignedUnits, recordedUnits);
    }

    function getActualGridBlockRange(planUnits, unitIndex, _unitsPerRow = 6) {
        if (!Array.isArray(planUnits) || !Number.isFinite(unitIndex)) return null;
        if (unitIndex < 0 || unitIndex >= planUnits.length) return null;
        const label = planUnits[unitIndex];
        if (!label) return null;

        let start = unitIndex;
        while (start > 0 && planUnits[start - 1] === label) {
            start -= 1;
        }
        let end = unitIndex;
        while (end < planUnits.length - 1 && planUnits[end + 1] === label) {
            end += 1;
        }
        return { start, end, label };
    }

    function buildActualUnitsFromActivities(planUnits, activities, options = {}) {
        if (!Array.isArray(planUnits) || !Array.isArray(activities)) return [];
        const normalizeLabel = typeof options.normalizeLabel === 'function'
            ? options.normalizeLabel
            : (value) => String(value || '').trim();
        const step = resolveStepSeconds(options.stepSeconds);
        const counts = new Map();

        activities.forEach((item) => {
            if (!item || !item.label) return;
            const label = normalizeLabel(item.label || '');
            if (!label) return;
            const seconds = Number.isFinite(item.seconds) ? Math.max(0, Math.floor(item.seconds)) : 0;
            const units = Math.floor(seconds / step);
            if (units > 0) {
                counts.set(label, (counts.get(label) || 0) + units);
            }
        });

        return planUnits.map((label) => {
            if (!label) return false;
            const remaining = counts.get(label) || 0;
            if (remaining > 0) {
                counts.set(label, remaining - 1);
                return true;
            }
            return false;
        });
    }

    function buildActualActivitiesFromGrid(planUnits, actualUnits, options = {}) {
        if (!Array.isArray(planUnits) || !Array.isArray(actualUnits)) return [];
        const step = resolveStepSeconds(options.stepSeconds);
        const counts = new Map();

        for (let i = 0; i < planUnits.length; i++) {
            if (!actualUnits[i]) continue;
            const label = planUnits[i];
            if (!label) continue;
            counts.set(label, (counts.get(label) || 0) + 1);
        }

        const activities = [];
        const seen = new Set();
        planUnits.forEach((label) => {
            if (!label || seen.has(label)) return;
            const units = counts.get(label);
            if (units) {
                activities.push({ label, seconds: units * step, source: 'grid' });
            }
            seen.add(label);
        });
        return activities;
    }

    return Object.freeze({
        getExtraActivityUnitCount,
        getActualGridBlockRange,
        buildActualUnitsFromActivities,
        buildActualActivitiesFromGrid,
    });
});
