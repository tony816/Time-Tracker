(function attachTimeTrackerGridMetricsCore(root, factory) {
    const api = factory();

    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    }

    if (root) {
        const existing = (root.TimeTrackerGridMetricsCore && typeof root.TimeTrackerGridMetricsCore === 'object')
            ? root.TimeTrackerGridMetricsCore
            : {};
        root.TimeTrackerGridMetricsCore = Object.assign(existing, api);
    }
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildTimeTrackerGridMetricsCore() {
    function resolveNormalizeActivityText(fn) {
        if (typeof fn === 'function') return fn;
        return (value) => String(value || '').trim();
    }

    function resolveStepSeconds(rawStepSeconds) {
        const parsed = Number(rawStepSeconds);
        if (!Number.isFinite(parsed) || parsed <= 0) return 600;
        return Math.max(1, Math.floor(parsed));
    }

    function pickUnits(primary, fallback) {
        if (Array.isArray(primary)) return primary;
        if (Array.isArray(fallback)) return fallback;
        return null;
    }

    function getActualGridSecondsMap(planUnits = null, actualUnits = null, options = {}) {
        const units = pickUnits(planUnits, options.fallbackPlanUnits);
        const activeUnits = pickUnits(actualUnits, options.fallbackActualUnits);
        const normalizeActivityText = resolveNormalizeActivityText(options.normalizeActivityText);
        const step = resolveStepSeconds(options.stepSeconds);
        const map = new Map();
        if (!Array.isArray(units) || !Array.isArray(activeUnits)) return map;

        for (let i = 0; i < units.length; i++) {
            if (!activeUnits[i]) continue;
            const normalized = normalizeActivityText(units[i] || '');
            if (!normalized) continue;
            map.set(normalized, (map.get(normalized) || 0) + step);
        }
        return map;
    }

    function getActualGridSecondsForLabel(label, options = {}) {
        const normalizeActivityText = resolveNormalizeActivityText(options.normalizeActivityText);
        const normalized = normalizeActivityText(label || '');
        if (!normalized) return 0;

        let map = options.gridMap instanceof Map ? options.gridMap : null;
        if (!map && typeof options.resolveGridMap === 'function') {
            try {
                const resolved = options.resolveGridMap();
                if (resolved instanceof Map) {
                    map = resolved;
                }
            } catch (_) {}
        }
        if (!map) return 0;
        return map.get(normalized) || 0;
    }

    function getActualGridUnitCounts(planUnits = null, actualUnits = null, options = {}) {
        const units = pickUnits(planUnits, options.fallbackPlanUnits);
        const activeUnits = pickUnits(actualUnits, options.fallbackActualUnits);
        const normalizeActivityText = resolveNormalizeActivityText(options.normalizeActivityText);
        const counts = new Map();
        if (!Array.isArray(units) || !Array.isArray(activeUnits)) return counts;

        for (let i = 0; i < units.length; i++) {
            if (!activeUnits[i]) continue;
            const normalized = normalizeActivityText(units[i] || '');
            if (!normalized) continue;
            counts.set(normalized, (counts.get(normalized) || 0) + 1);
        }
        return counts;
    }

    function getActualAssignedSecondsMap(activities = null, options = {}) {
        const normalizeActivityText = resolveNormalizeActivityText(options.normalizeActivityText);
        const aggregateDuplicates = options.aggregateDuplicates === true;
        const map = new Map();
        (Array.isArray(activities) ? activities : []).forEach((item) => {
            if (!item) return;
            const label = normalizeActivityText(item.label || '');
            if (!label) return;
            const seconds = Number.isFinite(item.seconds) ? Math.max(0, Math.floor(item.seconds)) : 0;
            if (aggregateDuplicates) {
                map.set(label, (map.get(label) || 0) + seconds);
            } else {
                map.set(label, seconds);
            }
        });
        return map;
    }

    return Object.freeze({
        getActualGridSecondsMap,
        getActualGridSecondsForLabel,
        getActualGridUnitCounts,
        getActualAssignedSecondsMap,
    });
});
