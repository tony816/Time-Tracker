(function attachTimeTrackerPlanSegmentCore(root, factory) {
    const api = factory();

    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    }

    if (root) {
        const existing = (root.TimeTrackerPlanSegmentCore && typeof root.TimeTrackerPlanSegmentCore === 'object')
            ? root.TimeTrackerPlanSegmentCore
            : {};
        root.TimeTrackerPlanSegmentCore = Object.assign(existing, api);
    }
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildTimeTrackerPlanSegmentCore() {
    const TEN_MINUTES = 10;
    const DEFAULT_DAY_START_MINUTE = 0;
    const DEFAULT_DAY_END_MINUTE = 24 * 60;
    const REST_LABEL = '\ud734\uc2dd';

    function toFiniteNumber(value, fallback = 0) {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : fallback;
    }

    function snapToTenMinutes(value, options = {}) {
        const mode = options.mode || 'round';
        const step = Number.isFinite(options.stepMinutes) && options.stepMinutes > 0
            ? Math.floor(options.stepMinutes)
            : TEN_MINUTES;
        const numeric = toFiniteNumber(value, 0);
        if (mode === 'floor') return Math.floor(numeric / step) * step;
        if (mode === 'ceil') return Math.ceil(numeric / step) * step;
        return Math.round(numeric / step) * step;
    }

    function normalizePlanSegmentRange(segment = {}, options = {}) {
        const minDuration = Number.isFinite(options.minDurationMinutes)
            ? Math.max(0, Math.floor(options.minDurationMinutes))
            : TEN_MINUTES;
        const clampStart = Number.isFinite(options.minMinute)
            ? Math.floor(options.minMinute)
            : DEFAULT_DAY_START_MINUTE;
        const clampEnd = Number.isFinite(options.maxMinute)
            ? Math.floor(options.maxMinute)
            : DEFAULT_DAY_END_MINUTE;

        const rawStart = Number.isFinite(segment.startMinute)
            ? Number(segment.startMinute)
            : (Number.isFinite(segment.startIndex) ? Number(segment.startIndex) * 60 : clampStart);
        const rawEnd = Number.isFinite(segment.endMinute)
            ? Number(segment.endMinute)
            : (Number.isFinite(segment.durationMinutes) ? rawStart + Number(segment.durationMinutes) : rawStart + minDuration);

        let startMinute = snapToTenMinutes(rawStart, { mode: 'round' });
        let endMinute = snapToTenMinutes(rawEnd, { mode: 'round' });
        startMinute = Math.max(clampStart, Math.min(clampEnd, startMinute));
        endMinute = Math.max(clampStart, Math.min(clampEnd, endMinute));

        if (endMinute < startMinute) {
            const tmp = startMinute;
            startMinute = endMinute;
            endMinute = tmp;
        }
        if (endMinute - startMinute < minDuration) {
            endMinute = Math.min(clampEnd, startMinute + minDuration);
            if (endMinute - startMinute < minDuration) {
                startMinute = Math.max(clampStart, endMinute - minDuration);
            }
        }

        return {
            ...segment,
            kind: segment.kind || 'real',
            startMinute,
            endMinute,
            durationMinutes: Math.max(0, endMinute - startMinute),
        };
    }

    function createSegmentId(segment = {}, prefix = 'planned') {
        const start = Number.isFinite(segment.startMinute) ? Math.floor(segment.startMinute) : 0;
        const end = Number.isFinite(segment.endMinute)
            ? Math.floor(segment.endMinute)
            : start + Math.max(0, Math.floor(Number(segment.durationMinutes) || 0));
        const suffix = segment.activityId || segment.label || segment.kind || '';
        const normalizedSuffix = String(suffix)
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
        return [prefix, start, end, normalizedSuffix].filter(Boolean).join('-');
    }

    function mergeAdjacentGaps(gaps = []) {
        const normalized = (Array.isArray(gaps) ? gaps : [])
            .map((gap) => normalizePlanSegmentRange({ ...gap, kind: 'virtual-rest' }, { minDurationMinutes: 0 }))
            .filter((gap) => gap.durationMinutes > 0)
            .sort((a, b) => a.startMinute - b.startMinute || a.endMinute - b.endMinute);

        const merged = [];
        normalized.forEach((gap) => {
            const previous = merged[merged.length - 1];
            if (previous && gap.startMinute <= previous.endMinute) {
                previous.endMinute = Math.max(previous.endMinute, gap.endMinute);
                previous.durationMinutes = previous.endMinute - previous.startMinute;
                previous.id = createSegmentId(previous, 'virtual-rest');
                return;
            }
            merged.push({ ...gap, virtual: true, persisted: false, label: gap.label || REST_LABEL, id: gap.id || createSegmentId(gap, 'virtual-rest') });
        });
        return merged;
    }

    function findOverlaps(segments = []) {
        const normalized = (Array.isArray(segments) ? segments : [])
            .map((segment) => normalizePlanSegmentRange(segment, { minDurationMinutes: 0 }))
            .filter((segment) => segment.durationMinutes > 0)
            .sort((a, b) => a.startMinute - b.startMinute || a.endMinute - b.endMinute);
        const overlaps = [];
        for (let i = 1; i < normalized.length; i += 1) {
            const previous = normalized[i - 1];
            const current = normalized[i];
            if (current.startMinute < previous.endMinute) {
                overlaps.push({ left: previous, right: current, overlapMinutes: previous.endMinute - current.startMinute });
            }
        }
        return overlaps;
    }

    function calculateVirtualRestGaps(realSegments = [], options = {}) {
        const minGapMinutes = Number.isFinite(options.minGapMinutes)
            ? Math.max(0, Math.floor(options.minGapMinutes))
            : TEN_MINUTES;
        const slotStartMinute = Number.isFinite(options.startMinute) ? Math.floor(options.startMinute) : DEFAULT_DAY_START_MINUTE;
        const slotEndMinute = Number.isFinite(options.endMinute) ? Math.floor(options.endMinute) : DEFAULT_DAY_END_MINUTE;
        const ranges = (Array.isArray(realSegments) ? realSegments : [])
            .filter((segment) => segment && segment.kind !== 'virtual-rest' && segment.virtual !== true)
            .map((segment) => normalizePlanSegmentRange(segment, {
                minDurationMinutes: 0,
                minMinute: slotStartMinute,
                maxMinute: slotEndMinute,
            }))
            .filter((segment) => segment.durationMinutes > 0)
            .sort((a, b) => a.startMinute - b.startMinute || a.endMinute - b.endMinute);

        const gaps = [];
        let cursor = slotStartMinute;
        ranges.forEach((segment) => {
            if (segment.startMinute > cursor) {
                const duration = segment.startMinute - cursor;
                if (duration >= minGapMinutes) {
                    gaps.push({
                        id: createSegmentId({ startMinute: cursor, endMinute: segment.startMinute, kind: 'virtual-rest' }, 'virtual-rest'),
                        kind: 'virtual-rest',
                        virtual: true,
                        persisted: false,
                        label: REST_LABEL,
                        startMinute: cursor,
                        endMinute: segment.startMinute,
                        durationMinutes: duration,
                    });
                }
            }
            cursor = Math.max(cursor, segment.endMinute);
        });
        if (slotEndMinute > cursor) {
            const duration = slotEndMinute - cursor;
            if (duration >= minGapMinutes) {
                gaps.push({
                    id: createSegmentId({ startMinute: cursor, endMinute: slotEndMinute, kind: 'virtual-rest' }, 'virtual-rest'),
                    kind: 'virtual-rest',
                    virtual: true,
                    persisted: false,
                    label: REST_LABEL,
                    startMinute: cursor,
                    endMinute: slotEndMinute,
                    durationMinutes: duration,
                });
            }
        }
        return mergeAdjacentGaps(gaps);
    }

    function stripVirtualSegmentsForPersistence(segments = []) {
        return (Array.isArray(segments) ? segments : [])
            .filter((segment) => segment && segment.kind !== 'virtual-rest' && segment.virtual !== true)
            .map((segment) => ({ ...segment }));
    }

    return Object.freeze({
        TEN_MINUTES,
        REST_LABEL,
        snapToTenMinutes,
        normalizePlanSegmentRange,
        calculateVirtualRestGaps,
        mergeAdjacentGaps,
        findOverlaps,
        createSegmentId,
        stripVirtualSegmentsForPersistence,
    });
});
