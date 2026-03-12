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

    function getStorage() {
        try {
            if (root && root.localStorage && typeof root.localStorage.getItem === 'function' && typeof root.localStorage.setItem === 'function') {
                return root.localStorage;
            }
        } catch (_) {}
        return null;
    }

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
        const storage = getStorage();
        if (!storage) return normalizeDayStartHour(fallback, fallback);
        try {
            return normalizeDayStartHour(storage.getItem(DAY_START_KEY), fallback);
        } catch (_) {
            return normalizeDayStartHour(fallback, fallback);
        }
    }

    function setDayStartHour(value) {
        const normalized = normalizeDayStartHour(value, 4);
        const storage = getStorage();
        if (!storage) return normalized;
        try {
            storage.setItem(DAY_START_KEY, String(normalized));
        } catch (_) {}
        return normalized;
    }

    function getTimesheetData(date) {
        const storage = getStorage();
        if (!storage) return null;
        const dateKey = getTimesheetStorageKey(date);
        try {
            const exact = storage.getItem(dateKey);
            if (typeof exact === 'string' && exact) return exact;
            const last = storage.getItem(LAST_TIMESHEET_KEY);
            return (typeof last === 'string' && last) ? last : null;
        } catch (_) {
            return null;
        }
    }

    function setTimesheetData(date, serializedData) {
        const storage = getStorage();
        if (!storage) return false;
        const payload = String(serializedData == null ? '' : serializedData);
        const dateKey = getTimesheetStorageKey(date);
        try {
            storage.setItem(dateKey, payload);
            storage.setItem(LAST_TIMESHEET_KEY, payload);
            return true;
        } catch (_) {
            return false;
        }
    }

    function removeTimesheetData(date) {
        const storage = getStorage();
        if (!storage || typeof storage.removeItem !== 'function') return false;
        try {
            storage.removeItem(getTimesheetStorageKey(date));
            return true;
        } catch (_) {
            return false;
        }
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
