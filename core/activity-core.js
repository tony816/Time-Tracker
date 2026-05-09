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
                if (item.isAutoLocked === false) {
                    normalized.isAutoLocked = false;
                } else if (item.isAutoLocked === true) {
                    normalized.isAutoLocked = true;
                }
                if (Array.isArray(item.lockUnits)) {
                    normalized.lockUnits = item.lockUnits
                        .filter((value) => Number.isFinite(value))
                        .map((value) => Math.floor(value));
                }
                const lockStart = Number.isFinite(item.lockStart) ? Math.floor(item.lockStart) : null;
                const lockEnd = Number.isFinite(item.lockEnd) ? Math.floor(item.lockEnd) : null;
                if (lockStart != null) {
                    normalized.lockStart = lockStart;
                }
                if (lockEnd != null) {
                    normalized.lockEnd = lockEnd;
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
                const normalized = { label, seconds };
                [
                    'titleActivityId',
                    'titleText',
                    'activityId',
                    'activityText',
                ].forEach((key) => {
                    if (!(key in item)) return;
                    const rawValue = item[key];
                    normalized[key] = rawValue == null ? null : normalizeActivityText(rawValue);
                });
                return normalized;
            })
            .filter((item) => item.label || item.seconds > 0);
    }

    function createActivityCatalogId(seed = '') {
        const base = String(seed || '').trim();
        if (base) {
            return `activity_${base.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'item'}`;
        }
        try {
            if (typeof crypto !== 'undefined' && crypto.randomUUID) {
                return `activity_${crypto.randomUUID()}`;
            }
        } catch (_) {}
        return `activity_${Date.now()}_${Math.random().toString(16).slice(2)}_${Math.random().toString(16).slice(2)}`;
    }

    function normalizeActivityCatalogEntry(raw, options = {}) {
        const normalizeActivityText = resolveNormalizeActivityText(options.normalizeActivityText);
        const normalizeDurationStep = resolveNormalizeDurationStep(options.normalizeDurationStep);
        const item = raw && typeof raw === 'object' ? raw : {};
        const name = normalizeActivityText(item.name ?? item.label ?? item.title ?? '');
        const normalizedName = normalizeActivityText(item.normalizedName ?? name);
        const id = String(item.id || '').trim() || createActivityCatalogId(normalizedName || name);
        const parentId = String(item.parentId || '').trim() || null;
        const colorKey = String(item.colorKey || '').trim() || null;
        const defaultDurationMinutes = Number.isFinite(item.defaultDurationMinutes)
            ? Math.max(0, Math.floor(Number(item.defaultDurationMinutes)))
            : (Number.isFinite(item.recommendedSeconds)
                ? Math.max(0, Math.floor(normalizeDurationStep(Number(item.recommendedSeconds)) / 60))
                : null);
        const displayMode = String(item.displayMode || '').trim() || 'chip';
        const pinned = Boolean(item.pinned);
        const archived = Boolean(item.archived);
        const usageCount = Number.isFinite(item.usageCount) ? Math.max(0, Math.floor(Number(item.usageCount))) : 0;
        const lastUsedAt = typeof item.lastUsedAt === 'string' && item.lastUsedAt.trim() ? item.lastUsedAt : null;
        const source = typeof item.source === 'string' ? item.source : 'local';
        const entry = {
            id,
            name,
            label: name,
            title: name,
            normalizedName,
            parentId,
            colorKey,
            defaultDurationMinutes,
            displayMode,
            pinned,
            archived,
            usageCount,
            lastUsedAt,
            source,
        };
        return entry;
    }

    function normalizeActivityCatalogArray(raw, options = {}) {
        if (!Array.isArray(raw)) return [];
        const seen = new Set();
        const normalized = [];
        raw.forEach((item) => {
            const entry = normalizeActivityCatalogEntry(item, options);
            if (!entry.normalizedName) return;
            if (seen.has(entry.normalizedName)) return;
            seen.add(entry.normalizedName);
            normalized.push(entry);
        });
        return normalized;
    }

    function groupActivityCatalogEntries(entries, options = {}) {
        const items = normalizeActivityCatalogArray(entries, options);
        const byParentId = new Map();
        const byId = new Map();
        items.forEach((item) => {
            byId.set(item.id, item);
            const parentKey = item.parentId || '';
            if (!byParentId.has(parentKey)) byParentId.set(parentKey, []);
            byParentId.get(parentKey).push(item);
        });
        const topLevel = items.filter((item) => !item.parentId);
        const pinned = topLevel.filter((item) => item.pinned && !item.archived);
        const recent = topLevel
            .filter((item) => !item.pinned && !item.archived)
            .sort((a, b) => {
                const at = a.lastUsedAt || '';
                const bt = b.lastUsedAt || '';
                if (at !== bt) return bt.localeCompare(at);
                return (b.usageCount || 0) - (a.usageCount || 0);
            })
            .slice(0, 8);
        const parents = topLevel.filter((item) => (byParentId.get(item.id) || []).some((child) => child.id !== item.id));
        const children = items.filter((item) => item.parentId && byId.has(item.parentId));
        return {
            items,
            byId,
            byParentId,
            pinned,
            recent,
            parents,
            children,
            topLevel,
        };
    }

    return Object.freeze({
        formatActivitiesSummary,
        createActivityCatalogId,
        normalizeActivityCatalogEntry,
        normalizeActivityCatalogArray,
        groupActivityCatalogEntries,
        normalizeActivitiesArray,
        normalizePlanActivitiesArray,
    });
});
