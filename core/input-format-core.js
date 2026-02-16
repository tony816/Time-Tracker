(function attachTimeTrackerInputFormatCore(root, factory) {
    const api = factory();

    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    }

    if (root) {
        const existing = (root.TimeTrackerInputFormatCore && typeof root.TimeTrackerInputFormatCore === 'object')
            ? root.TimeTrackerInputFormatCore
            : {};
        root.TimeTrackerInputFormatCore = Object.assign(existing, api);
    }
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildTimeTrackerInputFormatCore() {
    function formatSecondsForInput(seconds) {
        if (!Number.isFinite(seconds) || seconds <= 0) return '00:00';
        const total = Math.floor(seconds);
        const hrs = Math.floor(total / 3600);
        const mins = Math.floor((total % 3600) / 60);
        const secs = total % 60;
        if (secs === 0) {
            return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
        }
        return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    function formatMinutesForInput(seconds) {
        if (!Number.isFinite(seconds) || seconds <= 0) return '0';
        return String(Math.round(seconds / 60));
    }

    function formatSpinnerValue(kind, seconds) {
        return kind === 'actual'
            ? formatMinutesForInput(seconds)
            : formatSecondsForInput(seconds);
    }

    return Object.freeze({
        formatSecondsForInput,
        formatMinutesForInput,
        formatSpinnerValue,
    });
});
