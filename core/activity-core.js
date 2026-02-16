(function attachTimeTrackerActivityCore(root, factory) {
    const api = factory();

    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    }

    if (root) {
        const existing = (root.TimeTrackerActivityCore && typeof root.TimeTrackerActivityCore === 'object')
            ? root.TimeTrackerActivityCore
            : {};
        root.TimeTrackerActivityCore = Object.assign(existing, api);
    }
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildTimeTrackerActivityCore() {
    function resolveNormalizeActivityText(fn) {
        if (typeof fn === 'function') return fn;
        return (value) => String(value || '').trim();
    }

    function resolveNormalizeDurationStep(fn) {
        if (typeof fn === 'function') return fn;
        return (seconds) => {
            if (!Number.isFinite(seconds)) return null;
            return Math.max(0, Math.floor(seconds));
        };
    }

    function resolveFormatDurationSummary(fn) {
        if (typeof fn === 'function') return fn;
        return (rawSeconds) => {
            if (!Number.isFinite(rawSeconds) || rawSeconds <= 0) return '0시간';
            const seconds = Math.floor(rawSeconds);
            const hours = Math.floor(seconds / 3600);
            const minutes = Math.floor((seconds % 3600) / 60);
            const secs = seconds % 60;
            const parts = [];
            if (hours > 0) parts.push(`${hours}시간`);
            if (minutes > 0) parts.push(`${minutes}분`);
            if (secs > 0 && parts.length === 0) {
                parts.push(`${secs}초`);
            } else if (secs > 0 && parts.length > 0) {
                parts.push(`${secs}초`);
            }
            return parts.join(' ') || '0시간';
        };
    }

    function formatActivitiesSummary(activities, options = {}) {
        const normalizeActivityText = resolveNormalizeActivityText(options.normalizeActivityText);
        const normalizeDurationStep = resolveNormalizeDurationStep(options.normalizeDurationStep);
        const formatDurationSummary = resolveFormatDurationSummary(options.formatDurationSummary);
        const items = Array.isArray(activities) ? activities : [];
        if (items.length === 0) return '';

        const normalized = items
            .map((item) => ({
                label: normalizeActivityText(item.label || ''),
                seconds: normalizeDurationStep(Number.isFinite(item.seconds) ? Number(item.seconds) : 0),
            }))
            .filter((item) => item.label || item.seconds > 0);
        if (normalized.length === 0) return '';

        const parts = normalized.map((item) => {
            const label = item.label || '';
            const duration = formatDurationSummary(item.seconds);
            return label ? `${label} ${duration}` : duration;
        });
        const total = normalized.reduce((sum, item) => sum + item.seconds, 0);
        const totalLabel = options.hideTotal ? '' : ` (총 ${formatDurationSummary(total)})`;
        return `${parts.join(' · ')}${totalLabel}`.trim();
    }

    function normalizeActivitiesArray(raw, options = {}) {
        const normalizeActivityText = resolveNormalizeActivityText(options.normalizeActivityText);
        const normalizeDurationStep = resolveNormalizeDurationStep(options.normalizeDurationStep);
        if (!Array.isArray(raw)) return [];
        return raw
            .filter((item) => item && typeof item === 'object')
            .map((item) => {
                const labelSource = (item.label ?? item.title ?? '').toString();
                const label = normalizeActivityText(labelSource);
                const rawSeconds = Number.isFinite(item.seconds) ? Number(item.seconds) : 0;
                const seconds = normalizeDurationStep(rawSeconds) ?? 0;
                const source = typeof item.source === 'string' ? item.source : null;
                const rawRecorded = Number.isFinite(item.recordedSeconds) ? Number(item.recordedSeconds) : null;
                const recordedSeconds = rawRecorded == null
                    ? null
                    : (normalizeDurationStep(rawRecorded) ?? 0);
                const order = Number.isFinite(item.order) ? Math.max(0, Math.floor(item.order)) : null;
                const normalized = { label, seconds, source };
                if (rawRecorded != null) {
                    normalized.recordedSeconds = recordedSeconds;
                }
                if (order != null) {
                    normalized.order = order;
                }
                return normalized;
            })
            .filter((item) => item.label || item.seconds > 0);
    }

    function normalizePlanActivitiesArray(raw, options = {}) {
        const normalizeActivityText = resolveNormalizeActivityText(options.normalizeActivityText);
        const normalizeDurationStep = resolveNormalizeDurationStep(options.normalizeDurationStep);
        if (!Array.isArray(raw)) return [];
        return raw
            .filter((item) => item && typeof item === 'object')
            .map((item) => {
                const labelSource = (item.label ?? item.title ?? '').toString();
                const label = normalizeActivityText(labelSource);
                const rawSeconds = Number.isFinite(item.seconds) ? Number(item.seconds) : 0;
                const seconds = normalizeDurationStep(rawSeconds) ?? 0;
                return { label, seconds };
            })
            .filter((item) => item.label || item.seconds > 0);
    }

    return Object.freeze({
        formatActivitiesSummary,
        normalizeActivitiesArray,
        normalizePlanActivitiesArray,
    });
});
