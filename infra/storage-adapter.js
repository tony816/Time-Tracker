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

    function getLocalStorage() {
        try {
            return root && root.localStorage ? root.localStorage : null;
        } catch (_) {
            return null;
        }
    }

    function safeGetItem(key) {
        const storage = getLocalStorage();
        if (!storage || typeof storage.getItem !== 'function') return null;
        try {
            return storage.getItem(String(key));
        } catch (_) {
            return null;
        }
    }

    function safeSetItem(key, value) {
        const storage = getLocalStorage();
        if (!storage || typeof storage.setItem !== 'function') return false;
        try {
            storage.setItem(String(key), String(value));
            return true;
        } catch (_) {
            return false;
        }
    }

    function safeRemoveItem(key) {
        const storage = getLocalStorage();
        if (!storage || typeof storage.removeItem !== 'function') return false;
        try {
            storage.removeItem(String(key));
            return true;
        } catch (_) {
            return false;
        }
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
        const raw = safeGetItem(DAY_START_KEY);
        return normalizeDayStartHour(raw, fallback);
    }

    function setDayStartHour(value) {
        const normalized = normalizeDayStartHour(value, 4);
        safeSetItem(DAY_START_KEY, String(normalized));
        return normalized;
    }

    function getTimesheetData(date) {
        const byDate = safeGetItem(getTimesheetStorageKey(date));
        if (byDate != null) return byDate;
        return safeGetItem(LAST_TIMESHEET_KEY);
    }

    function setTimesheetData(date, serializedData) {
        const payload = String(serializedData || '');
        if (!payload) return false;
        const byDateSaved = safeSetItem(getTimesheetStorageKey(date), payload);
        const lastSaved = safeSetItem(LAST_TIMESHEET_KEY, payload);
        return byDateSaved && lastSaved;
    }

    function removeTimesheetData(date) {
        return safeRemoveItem(getTimesheetStorageKey(date));
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
