(function attachTimeTrackerStorage(root, factory) {
    const api = factory(root);

    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    }

    if (root) {
        const existing = (root.TimeTrackerStorage && typeof root.TimeTrackerStorage === 'object')
            ? root.TimeTrackerStorage
            : {};
        root.TimeTrackerStorage = Object.assign(existing, api);
    }
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildTimeTrackerStorage(root) {
    const DAY_START_KEY = 'tt.dayStartHour';
    const LAST_TIMESHEET_KEY = 'timesheetData:last';

    function normalizeDayStartHour(value, fallback = 4) {
        const defaultHour = parseInt(String(fallback), 10) === 0 ? 0 : 4;
        const parsed = parseInt(String(value), 10);
        if (!Number.isFinite(parsed)) return defaultHour;
        return parsed === 0 ? 0 : 4;
    }

    function getTimesheetStorageKey(date) {
        return `timesheetData:${String(date || '').trim()}`;
    }

    function getDayStartHour(fallback = 4) {
        return normalizeDayStartHour(4, fallback);
    }

    function setDayStartHour(value) {
        return normalizeDayStartHour(value, 4);
    }

    function getTimesheetData(_date) {
        return null;
    }

    function setTimesheetData(_date, _serializedData) {
        return false;
    }

    function removeTimesheetData(_date) {
        return false;
    }

    return Object.freeze({
        DAY_START_KEY,
        LAST_TIMESHEET_KEY,
        getTimesheetStorageKey,
        getDayStartHour,
        setDayStartHour,
        getTimesheetData,
        setTimesheetData,
        removeTimesheetData,
    });
});
