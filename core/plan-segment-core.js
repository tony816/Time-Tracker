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

    function toFiniteNumber(value, fallback = null) {
        if (value == null || value === '') return fallback;
        const numeric = Number(value);
        return Number.isFinite(numeric) ? numeric : fallback;
    }

    function snapToTenMinutes(value, options = {}) {
        const min = Math.floor(toFiniteNumber(options.min, DEFAULT_DAY_START_MINUTE));
        const max = Math.floor(toFiniteNumber(options.max, DEFAULT_DAY_END_MINUTE));
        const lower = Math.min(min, max);
        const upper = Math.max(min, max);
        const numeric = toFiniteNumber(value, lower);
        if (!Number.isFinite(numeric)) return lower;
        const snapped = Math.round(numeric / TEN_MINUTES) * TEN_MINUTES;
        return Math.max(lower, Math.min(upper, snapped));
    }

    function normalizePlanSegmentRange(range = {}) {
        const rawStart = toFiniteNumber(range.startMinute, DEFAULT_DAY_START_MINUTE);
        const rawEnd = toFiniteNumber(range.endMinute, DEFAULT_DAY_END_MINUTE);
        const startMinute = snapToTenMinutes(Math.min(rawStart, rawEnd));
        const endMinute = snapToTenMinutes(Math.max(rawStart, rawEnd), { min: startMinute });
        return { startMinute, endMinute, durationMinutes: Math.max(0, endMinute - startMinute) };
    }

    function createSegmentId(prefix, startMinute, durationMinutes) {
        const safePrefix = String(prefix || 'segment').trim() || 'segment';
        const safeStart = Math.floor(toFiniteNumber(startMinute, 0));
        const safeDuration = Math.floor(toFiniteNumber(durationMinutes, 0));
        return `${safePrefix}-${safeStart}-${safeDuration}`;
    }

    function normalizeRealSegment(segment, range) {
        if (!segment || typeof segment !== 'object' || segment.virtual || segment.kind === 'virtual-rest') {
            return null;
        }
        const startSource = toFiniteNumber(segment.startMinute, null);
        const durationSource = toFiniteNumber(segment.durationMinutes, null);
        const endSource = toFiniteNumber(segment.endMinute, null);
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
            .filter((gap) => toFiniteNumber(gap.durationMinutes, 0) >= TEN_MINUTES)
            .map((gap) => {
                const startMinute = snapToTenMinutes(gap.startMinute);
                const rawDuration = toFiniteNumber(gap.durationMinutes, 0);
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
                const duration = Math.max(0, toFiniteNumber(segment.durationMinutes, 0));
                const rawEnd = toFiniteNumber(segment.endMinute, startMinute + duration);
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

    function normalizePlanSegmentListForResize(segments = []) {
        const safeSegments = Array.isArray(segments) ? segments : [];
        let cursor = 0;
        return safeSegments
            .filter((segment) => segment && typeof segment === 'object' && !segment.virtual && segment.kind !== 'virtual-rest')
            .map((segment, index) => {
                const rawDurationMinutes = toFiniteNumber(segment.durationMinutes, null);
                const durationMinutes = rawDurationMinutes != null
                    ? Math.max(0, Math.floor(rawDurationMinutes))
                    : Math.max(0, Math.floor((Number(segment.seconds) || 0) / 60));
                const rawStartMinute = toFiniteNumber(segment.startMinute, null);
                const startMinute = rawStartMinute != null
                    ? Math.max(0, Math.floor(rawStartMinute))
                    : cursor;
                const rawEndMinute = toFiniteNumber(segment.endMinute, null);
                const endMinute = rawEndMinute != null
                    ? Math.max(startMinute, Math.floor(rawEndMinute))
                    : startMinute + durationMinutes;
                cursor = Math.max(cursor, endMinute);
                return {
                    index,
                    segment,
                    startMinute: snapToTenMinutes(startMinute),
                    endMinute: snapToTenMinutes(endMinute, { min: startMinute }),
                    durationMinutes: Math.max(0, snapToTenMinutes(endMinute, { min: startMinute }) - snapToTenMinutes(startMinute)),
                };
            })
            .filter((segment) => segment.durationMinutes > 0)
            .sort((a, b) => a.startMinute - b.startMinute);
    }

    function canResizePlanSegment(segments = [], segmentIndex = 0, edge = 'right', targetMinute = 0, rangeInput = {}) {
        const normalized = normalizePlanSegmentListForResize(segments);
        const target = normalized.find((item) => item.index === segmentIndex);
        if (!target) return { allowed: false, startMinute: 0, endMinute: 0, durationMinutes: 0 };

        const range = normalizePlanSegmentRange({
            startMinute: toFiniteNumber(rangeInput.startMinute, 0),
            endMinute: toFiniteNumber(rangeInput.endMinute, Math.max(60, target.endMinute)),
        });
        const position = normalized.indexOf(target);
        const previous = position > 0 ? normalized[position - 1] : null;
        const next = position >= 0 && position < normalized.length - 1 ? normalized[position + 1] : null;
        const minStart = previous ? previous.endMinute : range.startMinute;
        const maxEnd = next ? next.startMinute : range.endMinute;
        const snappedTarget = snapToTenMinutes(targetMinute, { min: range.startMinute, max: range.endMinute });

        let startMinute = target.startMinute;
        let endMinute = target.endMinute;
        if (edge === 'left') {
            startMinute = Math.max(minStart, Math.min(snappedTarget, target.endMinute - TEN_MINUTES));
        } else {
            endMinute = Math.min(maxEnd, Math.max(snappedTarget, target.startMinute + TEN_MINUTES));
        }
        const durationMinutes = Math.max(0, endMinute - startMinute);

        return {
            allowed: durationMinutes >= TEN_MINUTES,
            startMinute,
            endMinute,
            durationMinutes,
            clamped: (edge === 'left' ? startMinute : endMinute) !== snappedTarget,
        };
    }

    function resizePlanSegmentInList(segments = [], segmentIndex = 0, edge = 'right', targetMinute = 0, rangeInput = {}) {
        const source = Array.isArray(segments) ? segments : [];
        const normalized = normalizePlanSegmentListForResize(source);
        const target = normalized.find((item) => item.index === segmentIndex);
        if (target) {
            const range = normalizePlanSegmentRange({
                startMinute: toFiniteNumber(rangeInput.startMinute, 0),
                endMinute: toFiniteNumber(rangeInput.endMinute, Math.max(60, target.endMinute)),
            });
            const position = normalized.indexOf(target);
            const previous = position > 0 ? normalized[position - 1] : null;
            const next = position >= 0 && position < normalized.length - 1 ? normalized[position + 1] : null;
            const snappedTarget = snapToTenMinutes(targetMinute, { min: range.startMinute, max: range.endMinute });
            const isRightSharedBoundary = edge !== 'left'
                && next
                && next.startMinute === target.endMinute;
            const isLeftSharedBoundary = edge === 'left'
                && previous
                && previous.endMinute === target.startMinute;

            if (isRightSharedBoundary || isLeftSharedBoundary) {
                const left = isRightSharedBoundary ? target : previous;
                const right = isRightSharedBoundary ? next : target;
                const minBoundary = left.startMinute + TEN_MINUTES;
                const maxBoundary = right.endMinute - TEN_MINUTES;
                const boundaryMinute = Math.max(minBoundary, Math.min(maxBoundary, snappedTarget));
                return source
                    .filter((item) => item && item.kind !== 'virtual-rest' && item.virtual !== true)
                    .map((item, index) => {
                        const result = { ...item };
                        delete result.kind;
                        delete result.virtual;
                        if (index === left.index) {
                            result.startMinute = left.startMinute;
                            result.endMinute = boundaryMinute;
                            result.durationMinutes = boundaryMinute - left.startMinute;
                            result.seconds = result.durationMinutes * 60;
                        } else if (index === right.index) {
                            result.startMinute = boundaryMinute;
                            result.endMinute = right.endMinute;
                            result.durationMinutes = right.endMinute - boundaryMinute;
                            result.seconds = result.durationMinutes * 60;
                        }
                        return result;
                    });
            }
        }

        const resize = canResizePlanSegment(segments, segmentIndex, edge, targetMinute, rangeInput);
        if (!resize.allowed) {
            return source
                .filter((item) => item && item.kind !== 'virtual-rest' && item.virtual !== true)
                .map((item) => ({ ...item }));
        }

        return source
            .filter((item) => item && item.kind !== 'virtual-rest' && item.virtual !== true)
            .map((item, index) => {
                const next = { ...item };
                delete next.kind;
                delete next.virtual;
                if (index !== segmentIndex) return next;
                next.startMinute = resize.startMinute;
                next.endMinute = resize.endMinute;
                next.durationMinutes = resize.durationMinutes;
                next.seconds = resize.durationMinutes * 60;
                return next;
            });
    }

    function clonePlainObject(value, fallback) {
        if (value == null) return fallback;
        if (typeof value !== 'object') return value;
        try {
            return JSON.parse(JSON.stringify(value));
        } catch (_) {
            return { ...value };
        }
    }

    function parsePlannedSegmentId(segmentId) {
        const match = String(segmentId || '').trim().match(/^planned-(\d+)-(\d+)(?:-seg(\d+))?$/);
        if (!match) return null;
        const start = parseInt(match[1], 10);
        const end = parseInt(match[2], 10);
        const segmentIndex = match[3] == null ? null : parseInt(match[3], 10);
        if (!Number.isInteger(start) || !Number.isInteger(end)) return null;
        return { start, end, segmentIndex };
    }

    function isActiveSegmentTimer(timer) {
        if (!timer || typeof timer !== 'object') return false;
        const status = String(timer.status || '').trim();
        return Boolean(timer.running)
            || status === 'running'
            || status === 'paused';
    }

    function getSegmentDurationMinutes(segment) {
        const startMinute = toFiniteNumber(segment.startMinute, null);
        const endMinute = toFiniteNumber(segment.endMinute, null);
        if (startMinute != null && endMinute != null && endMinute > startMinute) {
            return Math.max(0, Math.floor(endMinute - startMinute));
        }
        const durationMinutes = toFiniteNumber(segment.durationMinutes, null);
        if (durationMinutes != null && durationMinutes > 0) {
            return Math.max(0, Math.floor(durationMinutes));
        }
        const seconds = toFiniteNumber(segment.seconds, 0);
        return Math.max(0, Math.floor(seconds / 60));
    }

    function summarizeSegments(segments = []) {
        const labels = (Array.isArray(segments) ? segments : [])
            .map((segment) => String(segment && segment.label ? segment.label : '').trim())
            .filter(Boolean);
        if (labels.length <= 0) return '';
        if (labels.length === 1) return labels[0];
        return `${labels[0]} +${labels.length - 1}`;
    }

    function stableJson(value) {
        if (value == null || typeof value !== 'object') return JSON.stringify(value);
        if (Array.isArray(value)) {
            return `[${value.map((item) => stableJson(item)).join(',')}]`;
        }
        const keys = Object.keys(value).sort();
        return `{${keys.map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
    }

    function sanitizeSnapshotSlot(slot = {}) {
        const source = slot && typeof slot === 'object' ? slot : {};
        const sanitized = {};
        [
            'time',
            'planned',
            'actual',
            'planActivities',
            'planTitle',
            'planTitleBandOn',
            'timer',
            'planSegmentTimers',
            'activityLog',
        ].forEach((key) => {
            if (!(key in source)) return;
            sanitized[key] = clonePlainObject(source[key], Array.isArray(source[key]) ? [] : {});
        });
        return sanitized;
    }

    function buildPlanMergeBaseSignature(slot = {}) {
        const source = slot && typeof slot === 'object' ? slot : {};
        return stableJson({
            planned: source.planned || '',
            planActivities: Array.isArray(source.planActivities) ? source.planActivities : [],
            planTitle: source.planTitle || '',
            planTitleBandOn: Boolean(source.planTitleBandOn),
            planSegmentTimers: source.planSegmentTimers && typeof source.planSegmentTimers === 'object'
                ? source.planSegmentTimers
                : {},
        });
    }

    function sanitizePlanMergeSnapshot(snapshot = {}) {
        if (!snapshot || typeof snapshot !== 'object') return null;
        const startIndex = parseInt(snapshot.startIndex, 10);
        const endIndex = parseInt(snapshot.endIndex, 10);
        const mergeKey = String(snapshot.mergeKey || '').trim();
        if (!mergeKey || !Number.isInteger(startIndex) || !Number.isInteger(endIndex) || endIndex < startIndex) {
            return null;
        }
        const slots = Array.isArray(snapshot.slots)
            ? snapshot.slots.map((slot) => sanitizeSnapshotSlot(slot))
            : [];
        if (slots.length !== (endIndex - startIndex + 1)) return null;
        const mergedFields = Array.isArray(snapshot.mergedFields)
            ? snapshot.mergedFields
                .filter((entry) => entry && typeof entry.key === 'string')
                .map((entry) => ({
                    key: String(entry.key),
                    value: entry.value == null ? '' : String(entry.value),
                }))
            : [];
        const sanitized = {
            version: 2,
            mergeKey,
            startIndex,
            endIndex,
            slots,
            mergedFields,
        };
        if (typeof snapshot.postMergeSignature === 'string' && snapshot.postMergeSignature) {
            sanitized.postMergeSignature = snapshot.postMergeSignature;
        }
        return sanitized;
    }

    function createPlanMergeSnapshot(options = {}) {
        const startIndex = parseInt(options.startIndex, 10);
        const endIndex = parseInt(options.endIndex, 10);
        const mergeKey = String(options.mergeKey || '').trim();
        const slots = Array.isArray(options.slots) ? options.slots : [];
        const mergedFields = Array.isArray(options.mergedFields) ? options.mergedFields : [];
        return sanitizePlanMergeSnapshot({
            version: 2,
            mergeKey,
            startIndex,
            endIndex,
            slots: slots.slice(0, Math.max(0, endIndex - startIndex + 1)),
            mergedFields,
        });
    }

    function attachPlanMergePostState(snapshot, baseSlot = {}) {
        const sanitized = sanitizePlanMergeSnapshot(snapshot);
        if (!sanitized) return null;
        sanitized.postMergeSignature = buildPlanMergeBaseSignature(baseSlot);
        return sanitized;
    }

    function isPlanMergeSnapshotRestorable(snapshot = {}, options = {}) {
        const sanitized = sanitizePlanMergeSnapshot(snapshot);
        if (!sanitized) return false;
        const start = parseInt(options.startIndex, 10);
        const end = parseInt(options.endIndex, 10);
        const mergeKey = String(options.mergeKey || '').trim();
        if (mergeKey && sanitized.mergeKey !== mergeKey) return false;
        if (Number.isInteger(start) && sanitized.startIndex !== start) return false;
        if (Number.isInteger(end) && sanitized.endIndex !== end) return false;
        const expectedSlotCount = Math.max(1, sanitized.endIndex - sanitized.startIndex + 1);
        if (sanitized.slots.length !== expectedSlotCount) return false;
        if (options.baseSlot && sanitized.postMergeSignature) {
            return sanitized.postMergeSignature === buildPlanMergeBaseSignature(options.baseSlot);
        }
        return true;
    }

    function buildMergedPlanSegmentPayload(slots = [], options = {}) {
        const rangeStart = parseInt(options.rangeStart, 10);
        const rangeEnd = parseInt(options.rangeEnd, 10);
        if (!Number.isInteger(rangeStart) || !Number.isInteger(rangeEnd) || rangeEnd < rangeStart) {
            return { blocked: true, reason: 'invalid-range', activities: [], timers: {} };
        }

        const normalizePlanActivities = typeof options.normalizePlanActivities === 'function'
            ? options.normalizePlanActivities
            : (items) => Array.isArray(items)
                ? items.filter((item) => item && typeof item === 'object').map((item) => ({ ...item }))
                : [];
        const findMergeKey = typeof options.findMergeKey === 'function' ? options.findMergeKey : null;
        const blockMinutes = Math.max(1, rangeEnd - rangeStart + 1) * 60;
        const sourceBlocks = [];
        const seenBlocks = new Set();

        for (let index = rangeStart; index <= rangeEnd; index += 1) {
            let blockStart = index;
            let blockEnd = index;
            const mergeKey = findMergeKey ? findMergeKey(index) : null;
            const parsed = parsePlannedSegmentId(mergeKey);
            if (parsed && parsed.start <= index && index <= parsed.end) {
                blockStart = parsed.start;
                blockEnd = parsed.end;
            }
            if (blockEnd < rangeStart || blockStart > rangeEnd) continue;
            const blockKey = `${blockStart}-${blockEnd}`;
            if (seenBlocks.has(blockKey)) continue;
            seenBlocks.add(blockKey);
            sourceBlocks.push({ blockStart, blockEnd, baseIndex: blockStart });
        }

        const collected = [];
        sourceBlocks.forEach((block) => {
            const slot = slots[block.baseIndex] || {};
            const sourceActivities = normalizePlanActivities(slot.planActivities);
            let cursor = 0;
            sourceActivities.forEach((segment, segmentIndex) => {
                if (!segment || typeof segment !== 'object' || segment.virtual || segment.kind === 'virtual-rest') return;
                const rawStart = toFiniteNumber(segment.startMinute, null);
                const startMinute = rawStart != null ? Math.max(0, Math.floor(rawStart)) : cursor;
                const durationMinutes = getSegmentDurationMinutes({ ...segment, startMinute });
                if (durationMinutes <= 0) return;
                const endMinute = toFiniteNumber(segment.endMinute, null) != null
                    ? Math.max(startMinute, Math.floor(toFiniteNumber(segment.endMinute)))
                    : startMinute + durationMinutes;
                cursor = Math.max(cursor, endMinute);
                const absoluteStart = ((block.blockStart - rangeStart) * 60) + startMinute;
                const absoluteEnd = ((block.blockStart - rangeStart) * 60) + endMinute;
                if (absoluteEnd <= 0 || absoluteStart >= blockMinutes) return;
                collected.push({
                    sourceBaseIndex: block.baseIndex,
                    sourceRangeStart: block.blockStart,
                    sourceRangeEnd: block.blockEnd,
                    sourceSegmentIndex: segmentIndex,
                    sourceSegment: segment,
                    sourceStartMinute: startMinute,
                    sourceEndMinute: endMinute,
                    startMinute: Math.max(0, absoluteStart),
                    endMinute: Math.min(blockMinutes, absoluteEnd),
                    order: collected.length,
                });
            });
        });

        collected.sort((a, b) => (a.startMinute - b.startMinute) || (a.order - b.order));

        const consumedTimerKeys = new Set();
        const timers = {};
        const activities = collected
            .filter((entry) => entry.endMinute > entry.startMinute)
            .map((entry, nextSegmentIndex) => {
                const next = { ...entry.sourceSegment };
                delete next.kind;
                delete next.virtual;
                next.startMinute = entry.startMinute;
                next.endMinute = entry.endMinute;
                next.durationMinutes = entry.endMinute - entry.startMinute;
                next.seconds = next.durationMinutes * 60;

                const sourceSlot = slots[entry.sourceBaseIndex] || {};
                const sourceTimers = (sourceSlot.planSegmentTimers && typeof sourceSlot.planSegmentTimers === 'object')
                    ? sourceSlot.planSegmentTimers
                    : {};
                const candidates = [
                    `planned-${entry.sourceRangeStart}-${entry.sourceRangeEnd}-seg${entry.sourceSegmentIndex}`,
                    `planned-${entry.sourceBaseIndex}-${entry.sourceBaseIndex}-seg${entry.sourceSegmentIndex}`,
                ];
                if (collected.length === 1 || entry.sourceSegmentIndex === 0) {
                    candidates.push(`planned-${entry.sourceRangeStart}-${entry.sourceRangeEnd}`);
                    candidates.push(`planned-${entry.sourceBaseIndex}-${entry.sourceBaseIndex}`);
                }
                const matchedKey = candidates.find((key) => sourceTimers[key]);
                if (matchedKey) {
                    const nextId = `planned-${rangeStart}-${rangeEnd}-seg${nextSegmentIndex}`;
                    timers[nextId] = clonePlainObject(sourceTimers[matchedKey], {});
                    consumedTimerKeys.add(`${entry.sourceBaseIndex}:${matchedKey}`);
                }
                return next;
            });

        for (const block of sourceBlocks) {
            const sourceSlot = slots[block.baseIndex] || {};
            const sourceTimers = (sourceSlot.planSegmentTimers && typeof sourceSlot.planSegmentTimers === 'object')
                ? sourceSlot.planSegmentTimers
                : {};
            for (const [timerKey, timer] of Object.entries(sourceTimers)) {
                if (consumedTimerKeys.has(`${block.baseIndex}:${timerKey}`)) continue;
                if (isActiveSegmentTimer(timer)) {
                    return {
                        blocked: true,
                        reason: 'unmatched-active-segment-timer',
                        timerKey,
                        sourceBaseIndex: block.baseIndex,
                        activities: [],
                        timers: {},
                    };
                }
            }
        }

        return {
            blocked: false,
            activities,
            timers,
            summary: summarizeSegments(activities),
        };
    }

    return Object.freeze({
        snapToTenMinutes,
        normalizePlanSegmentRange,
        calculateVirtualRestGaps,
        mergeAdjacentGaps,
        findOverlaps,
        createSegmentId,
        normalizePlanSegmentListForResize,
        canResizePlanSegment,
        resizePlanSegmentInList,
        buildMergedPlanSegmentPayload,
        sanitizePlanMergeSnapshot,
        createPlanMergeSnapshot,
        attachPlanMergePostState,
        buildPlanMergeBaseSignature,
        isPlanMergeSnapshotRestorable,
    });
});
