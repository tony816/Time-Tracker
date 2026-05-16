(function attachTimeTrackerPlanSegmentCore(root, factory) {
    const api = factory();

    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    }

    if (root) {
        root.TimeTrackerPlanSegmentCore = api;
    }
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildTimeTrackerPlanSegmentCore() {
    const TEN_MINUTES = 10;
    const DEFAULT_DAY_START_MINUTE = 0;
    const DEFAULT_DAY_END_MINUTE = 24 * 60;

    function snapToTenMinutes(value, options = {}) {
        const min = Number.isFinite(options.min) ? Math.floor(options.min) : DEFAULT_DAY_START_MINUTE;
        const max = Number.isFinite(options.max) ? Math.floor(options.max) : DEFAULT_DAY_END_MINUTE;
        const lower = Math.min(min, max);
        const upper = Math.max(min, max);
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) return lower;
        const snapped = Math.round(numeric / TEN_MINUTES) * TEN_MINUTES;
        return Math.max(lower, Math.min(upper, snapped));
    }

    function normalizePlanSegmentRange(range = {}) {
        const rawStart = Number.isFinite(range.startMinute) ? range.startMinute : DEFAULT_DAY_START_MINUTE;
        const rawEnd = Number.isFinite(range.endMinute) ? range.endMinute : DEFAULT_DAY_END_MINUTE;
        const startMinute = snapToTenMinutes(Math.min(rawStart, rawEnd));
        const endMinute = snapToTenMinutes(Math.max(rawStart, rawEnd), { min: startMinute });
        return { startMinute, endMinute, durationMinutes: Math.max(0, endMinute - startMinute) };
    }

    function createSegmentId(prefix, startMinute, durationMinutes) {
        const safePrefix = String(prefix || 'segment').trim() || 'segment';
        const safeStart = Number.isFinite(startMinute) ? Math.floor(startMinute) : 0;
        const safeDuration = Number.isFinite(durationMinutes) ? Math.floor(durationMinutes) : 0;
        return `${safePrefix}-${safeStart}-${safeDuration}`;
    }

    function normalizeRealSegment(segment, range) {
        if (!segment || typeof segment !== 'object' || segment.virtual || segment.kind === 'virtual-rest') {
            return null;
        }
        const startSource = Number.isFinite(segment.startMinute) ? segment.startMinute : null;
        const durationSource = Number.isFinite(segment.durationMinutes) ? segment.durationMinutes : null;
        const endSource = Number.isFinite(segment.endMinute) ? segment.endMinute : null;
        if (startSource == null) return null;

        const startMinute = snapToTenMinutes(startSource, {
            min: range.startMinute,
            max: range.endMinute,
        });
        const rawEnd = endSource != null
            ? endSource
            : startSource + Math.max(0, durationSource || 0);
        const endMinute = snapToTenMinutes(rawEnd, {
            min: range.startMinute,
            max: range.endMinute,
        });
        if (endMinute <= startMinute) return null;

        return {
            ...segment,
            startMinute,
            durationMinutes: endMinute - startMinute,
            endMinute,
        };
    }

    function createVirtualRestGap(startMinute, durationMinutes) {
        return {
            id: createSegmentId('virtual-rest', startMinute, durationMinutes),
            kind: 'virtual-rest',
            label: '휴식',
            startMinute,
            durationMinutes,
            virtual: true,
        };
    }

    function mergeAdjacentGaps(gaps = []) {
        if (!Array.isArray(gaps)) return [];
        const normalized = gaps
            .filter((gap) => gap && typeof gap === 'object')
            .filter((gap) => Number.isFinite(gap.durationMinutes) && gap.durationMinutes >= TEN_MINUTES)
            .map((gap) => {
                const startMinute = snapToTenMinutes(gap.startMinute);
                const rawDuration = Number.isFinite(gap.durationMinutes) ? gap.durationMinutes : 0;
                const endMinute = snapToTenMinutes(startMinute + Math.max(0, rawDuration), { min: startMinute });
                return { startMinute, durationMinutes: endMinute - startMinute };
            })
            .filter((gap) => gap.durationMinutes >= TEN_MINUTES)
            .sort((a, b) => a.startMinute - b.startMinute);

        const merged = [];
        normalized.forEach((gap) => {
            const last = merged[merged.length - 1];
            if (last && last.startMinute + last.durationMinutes >= gap.startMinute) {
                const nextEnd = Math.max(
                    last.startMinute + last.durationMinutes,
                    gap.startMinute + gap.durationMinutes
                );
                last.durationMinutes = nextEnd - last.startMinute;
                last.id = createSegmentId('virtual-rest', last.startMinute, last.durationMinutes);
                return;
            }
            merged.push(createVirtualRestGap(gap.startMinute, gap.durationMinutes));
        });

        return merged.filter((gap) => gap.durationMinutes >= TEN_MINUTES);
    }

    function calculateVirtualRestGaps(segments = [], rangeInput = {}) {
        const range = normalizePlanSegmentRange(rangeInput);
        if (range.durationMinutes < TEN_MINUTES) return [];

        const realSegments = (Array.isArray(segments) ? segments : [])
            .map((segment) => normalizeRealSegment(segment, range))
            .filter(Boolean)
            .sort((a, b) => a.startMinute - b.startMinute);

        const gaps = [];
        let cursor = range.startMinute;
        realSegments.forEach((segment) => {
            if (segment.startMinute - cursor >= TEN_MINUTES) {
                gaps.push({ startMinute: cursor, durationMinutes: segment.startMinute - cursor });
            }
            cursor = Math.max(cursor, segment.endMinute);
        });

        if (range.endMinute - cursor >= TEN_MINUTES) {
            gaps.push({ startMinute: cursor, durationMinutes: range.endMinute - cursor });
        }

        return mergeAdjacentGaps(gaps);
    }

    function findOverlaps(segments = []) {
        if (!Array.isArray(segments)) return [];
        const realSegments = segments
            .filter((segment) => segment && typeof segment === 'object' && !segment.virtual && segment.kind !== 'virtual-rest')
            .map((segment, index) => {
                const startMinute = snapToTenMinutes(segment.startMinute);
                const duration = Number.isFinite(segment.durationMinutes) ? Math.max(0, segment.durationMinutes) : 0;
                const rawEnd = Number.isFinite(segment.endMinute) ? segment.endMinute : startMinute + duration;
                const endMinute = snapToTenMinutes(rawEnd, { min: startMinute });
                return { index, segment, startMinute, endMinute };
            })
            .filter((segment) => segment.endMinute > segment.startMinute)
            .sort((a, b) => a.startMinute - b.startMinute);

        const overlaps = [];
        for (let i = 1; i < realSegments.length; i += 1) {
            const previous = realSegments[i - 1];
            const current = realSegments[i];
            if (current.startMinute < previous.endMinute) {
                overlaps.push({
                    previousIndex: previous.index,
                    currentIndex: current.index,
                    startMinute: current.startMinute,
                    endMinute: Math.min(previous.endMinute, current.endMinute),
                    segments: [previous.segment, current.segment],
                });
            }
        }
        return overlaps;
    }

    return Object.freeze({
        snapToTenMinutes,
        normalizePlanSegmentRange,
        calculateVirtualRestGaps,
        mergeAdjacentGaps,
        findOverlaps,
        createSegmentId,
    });
});
