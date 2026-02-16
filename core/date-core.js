(function attachTimeTrackerDateCore(root, factory) {
    const api = factory();

    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    }

    if (root) {
        const existing = (root.TimeTrackerDateCore && typeof root.TimeTrackerDateCore === 'object')
            ? root.TimeTrackerDateCore
            : {};
        root.TimeTrackerDateCore = Object.assign(existing, api);
    }
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildTimeTrackerDateCore() {
    function parseLocalDateParts(date) {
        const s = String(date || '').trim();
        const [yStr, mStr, dStr] = s.split('-');
        const year = parseInt(yStr, 10);
        const month = parseInt(mStr, 10);
        const day = parseInt(dStr, 10);
        if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
        return { year, month, day };
    }

    function getDateValue(date) {
        const parts = parseLocalDateParts(date);
        if (!parts) return null;
        const ms = new Date(parts.year, parts.month - 1, parts.day, 0, 0, 0, 0).getTime();
        return Number.isFinite(ms) ? ms : null;
    }

    function compareDateStrings(a, b) {
        const av = getDateValue(a);
        const bv = getDateValue(b);
        if (!Number.isFinite(av) || !Number.isFinite(bv)) return 0;
        if (av < bv) return -1;
        if (av > bv) return 1;
        return 0;
    }

    function formatDateFromMsLocal(ms) {
        if (!Number.isFinite(ms)) return '';
        const dt = new Date(ms);
        if (isNaN(dt.getTime())) return '';
        const y = dt.getFullYear();
        const m = String(dt.getMonth() + 1).padStart(2, '0');
        const d = String(dt.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    function getTodayLocalDateString() {
        return formatDateFromMsLocal(Date.now());
    }

    function getLocalSlotStartMs(date, hour) {
        const parts = parseLocalDateParts(date);
        if (!parts) return null;
        const h = Number.isFinite(hour) ? Math.floor(Number(hour)) : 0;
        const dt = new Date(parts.year, parts.month - 1, parts.day, h, 0, 0, 0);
        const ms = dt.getTime();
        return Number.isFinite(ms) ? ms : null;
    }

    function getDayOfWeek(date) {
        const parts = parseLocalDateParts(date);
        if (!parts) return 0;
        return new Date(parts.year, parts.month - 1, parts.day).getDay();
    }

    return Object.freeze({
        parseLocalDateParts,
        getDateValue,
        compareDateStrings,
        formatDateFromMsLocal,
        getTodayLocalDateString,
        getLocalSlotStartMs,
        getDayOfWeek,
    });
});
