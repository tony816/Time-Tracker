(function attachTimeTrackerTextCore(root, factory) {
    const api = factory();

    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    }

    if (root) {
        const existing = (root.TimeTrackerTextCore && typeof root.TimeTrackerTextCore === 'object')
            ? root.TimeTrackerTextCore
            : {};
        root.TimeTrackerTextCore = Object.assign(existing, api);
    }
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildTimeTrackerTextCore() {
    function escapeHtml(text) {
        if (text == null) return '';
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function escapeAttribute(text) {
        return escapeHtml(text);
    }

    function normalizeActivityText(text) {
        if (!text) return '';
        return String(text)
            .replace(/[\r\n\t]+/g, '')
            .replace(/\s{2,}/g, ' ')
            .trim();
    }

    function normalizeMergeKey(rawMergeKey, expectedType = null, slotCount = null) {
        const match = /^(planned|actual|time)-(\d+)-(\d+)$/.exec(String(rawMergeKey || '').trim());
        if (!match) return null;
        const type = match[1];
        const start = parseInt(match[2], 10);
        const end = parseInt(match[3], 10);
        if (expectedType && type !== expectedType) return null;
        if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start) return null;
        if (Number.isFinite(slotCount) && slotCount >= 0 && end >= slotCount) return null;
        return `${type}-${start}-${end}`;
    }

    return Object.freeze({
        escapeHtml,
        escapeAttribute,
        normalizeActivityText,
        normalizeMergeKey,
    });
});
