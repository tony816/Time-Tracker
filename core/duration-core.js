(function attachTimeTrackerDurationCore(root, factory) {
    const api = factory();

    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    }

    if (root) {
        const existing = (root.TimeTrackerDurationCore && typeof root.TimeTrackerDurationCore === 'object')
            ? root.TimeTrackerDurationCore
            : {};
        root.TimeTrackerDurationCore = Object.assign(existing, api);
    }
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildTimeTrackerDurationCore() {
    function formatTime(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    function formatDurationSummary(rawSeconds) {
        if (!Number.isFinite(rawSeconds) || rawSeconds <= 0) {
            return '0시간';
        }
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
    }

    function normalizeDurationStep(seconds) {
        if (!Number.isFinite(seconds)) return null;
        return Math.max(0, Math.floor(seconds));
    }

    function normalizeActualDurationStep(seconds, stepSeconds = 600) {
        if (!Number.isFinite(seconds)) return 0;
        const parsedStep = Number(stepSeconds);
        const step = Number.isFinite(parsedStep) && parsedStep > 0
            ? Math.max(1, Math.floor(parsedStep))
            : 600;
        return Math.max(0, Math.round(seconds / step) * step);
    }

    return Object.freeze({
        formatTime,
        formatDurationSummary,
        normalizeDurationStep,
        normalizeActualDurationStep,
    });
});
