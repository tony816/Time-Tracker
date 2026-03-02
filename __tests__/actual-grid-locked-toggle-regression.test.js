const test = require('node:test');
const assert = require('node:assert/strict');
const { buildMethod } = require('./helpers/script-method-builder');

const getActualGridLockedUnitsForBase = buildMethod(
    'getActualGridLockedUnitsForBase(baseIndex, planUnits = null, activities = null)',
    '(baseIndex, planUnits = null, activities = null)'
);
const toggleActualGridLockedUnit = buildMethod(
    'toggleActualGridLockedUnit(index, unitIndex)',
    '(index, unitIndex)'
);

const STEP_SECONDS = 600;

function mkBasePlanUnits(count = 4) {
    return Array.from({ length: count }, () => 'A');
}

function extractLockedRowsFromActivities(activities = [], totalUnits = 0) {
    const total = Math.max(0, Math.floor(Number(totalUnits) || 0));
    const manualRows = [];
    const autoRows = [];
    const manualRowsByIndex = new Set();
    const autoRowsByIndex = new Set();
    const manualMask = new Array(total).fill(false);
    const autoMask = new Array(total).fill(false);

    const normalizeUnits = (rawUnits) => {
        const seen = new Set();
        const out = [];
        (Array.isArray(rawUnits) ? rawUnits : []).forEach((value) => {
            const unit = Number.isFinite(value) ? Math.floor(value) : null;
            if (!Number.isFinite(unit) || unit < 0 || unit >= total) return;
            if (seen.has(unit)) return;
            seen.add(unit);
            out.push(unit);
        });
        return out;
    };

    const isLockedRow = (item) => item && item.source === 'locked';
    const isManual = (item) => {
        if (!isLockedRow(item)) return false;
        return item.isAutoLocked === false;
    };

    const parseRowUnits = (item) => {
        if (!isLockedRow(item)) return [];
        if (Array.isArray(item.lockUnits)) {
            return normalizeUnits(item.lockUnits);
        }
        const lockStart = Number.isFinite(item.lockStart) ? Math.floor(item.lockStart) : null;
        const lockEnd = Number.isFinite(item.lockEnd) ? Math.floor(item.lockEnd) : null;
        if (lockStart == null || lockEnd == null) return [];
        const from = Math.min(lockStart, lockEnd);
        const to = Math.max(lockStart, lockEnd);
        const out = [];
        for (let unit = from; unit <= to; unit += 1) {
            if (unit >= 0 && unit < total) {
                out.push(unit);
            }
        }
        return out;
    };

    const addRowUnits = (item, sourceIndex, targetRows, targetMask, set) => {
        const rowUnits = parseRowUnits(item);
        if (rowUnits.length === 0) {
            targetRows.push({
                sourceIndex,
                sourceRow: item,
                unitList: [],
                lockStart: null,
                lockEnd: null,
                isLegacyAuto: !isManual(item),
            });
            return;
        }
        let first = null;
        let last = null;
        rowUnits.forEach((unit) => {
            targetMask[unit] = true;
            if (first == null || unit < first) first = unit;
            if (last == null || unit > last) last = unit;
        });
        targetRows.push({
            sourceIndex,
            sourceRow: item,
            unitList: rowUnits,
            lockStart: first,
            lockEnd: last,
            isLegacyAuto: !isManual(item) && !Array.isArray(item.lockUnits) && !Number.isFinite(item.lockStart) && !Number.isFinite(item.lockEnd),
        });
        set.add(sourceIndex);
    };

    if (!Array.isArray(activities)) {
        return {
            manualRows,
            autoRows,
            manualRowsByIndex,
            autoRowsByIndex,
            manualMask,
            autoMask,
            manualCount: 0,
        };
    }

    activities.forEach((item, sourceIndex) => {
        if (!isLockedRow(item)) return;
        if (isManual(item)) {
            addRowUnits(item, sourceIndex, manualRows, manualMask, manualRowsByIndex);
            return;
        }
        addRowUnits(item, sourceIndex, autoRows, autoMask, autoRowsByIndex);
    });

    return {
        manualRows,
        autoRows,
        manualRowsByIndex,
        autoRowsByIndex,
        manualMask,
        autoMask,
        manualCount: manualMask.reduce((sum, value) => sum + (value ? 1 : 0), 0),
    };
}

function normalizeActualActivitiesList(raw) {
    if (!Array.isArray(raw)) return [];
    return raw
        .filter((item) => item && typeof item === 'object')
        .map((item) => {
            const labelSource = (item.label ?? item.title ?? '').toString();
            const label = String(labelSource || '').trim();
            const rawSeconds = Number.isFinite(item.seconds) ? Number(item.seconds) : 0;
            const seconds = Math.max(0, Math.floor(rawSeconds));
            const rawRecorded = Number.isFinite(item.recordedSeconds) ? Number(item.recordedSeconds) : null;
            const recordedSeconds = (rawRecorded == null) ? null : Math.max(0, Math.floor(rawRecorded));
            const source = typeof item.source === 'string' ? item.source : null;
            const order = Number.isFinite(item.order) ? Math.max(0, Math.floor(item.order)) : null;
            const normalized = {
                label,
                seconds,
                source,
                recordedSeconds,
            };
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
            if (lockStart != null) normalized.lockStart = lockStart;
            if (lockEnd != null) normalized.lockEnd = lockEnd;
            return normalized;
        })
        .filter((item) => item.label || item.seconds > 0 || item.source === 'locked');
}

function makeCtx(overrides = {}) {
    const methods = {
        timeSlots: [{ activityLog: { subActivities: [] } }],
        getSplitBaseIndex: () => 0,
        getSplitRange: () => ({ start: 0, end: 0 }),
        buildPlanUnitsForActualGrid: () => ({ units: mkBasePlanUnits(4) }),
        extractLockedRowsFromActivities: (rows, totalUnits) => extractLockedRowsFromActivities(rows, totalUnits),
        normalizeActualActivitiesList: (rows) => normalizeActualActivitiesList(rows),
        getActualGridLockedUnitsForBase,
        getActualDurationStepSeconds() {
            return STEP_SECONDS;
        },
        normalizeActualDurationStep(seconds) {
            return Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
        },
        normalizeActivityText(value) {
            return String(value || '').trim();
        },
        isLockedActivityRow(item) {
            return item && item.source === 'locked';
        },
        isManualLockedActivityRow(item) {
            if (!this.isLockedActivityRow(item)) return false;
            return item.isAutoLocked === false;
        },
        rebuildLockedRowsFromUnitSet(unitMask = [], options = {}) {
            const units = Array.isArray(unitMask) ? unitMask.map((value) => Boolean(value)) : [];
            const isAutoLocked = options.isAutoLocked === true;
            const step = Number.isFinite(this.getActualDurationStepSeconds()) ? this.getActualDurationStepSeconds() : 600;
            const normalizeDurationStep = (value) => {
                const raw = Number.isFinite(value) ? Math.floor(value) : 0;
                return this.normalizeActualDurationStep(raw);
            };
            const rows = [];
            for (let i = 0; i < units.length; i += 1) {
                if (!units[i]) continue;
                let end = i;
                while (end + 1 < units.length && units[end + 1]) {
                    end += 1;
                }
                const length = end - i + 1;
                const seconds = normalizeDurationStep(length * step);
                const lockUnits = [];
                for (let unit = i; unit <= end; unit += 1) {
                    lockUnits.push(unit);
                }
                rows.push({
                    label: '',
                    seconds,
                    recordedSeconds: seconds,
                    source: 'locked',
                    isAutoLocked,
                    lockStart: i,
                    lockEnd: end,
                    lockUnits,
                });
                i = end;
            }
            return rows;
        },
        renderTimeEntries: () => {},
        calculateTotals: () => {},
        autoSave: () => {},
    };
    return Object.assign(methods, overrides);
}

function manualUnitsFromRows(rows) {
    return rows
        .map((item) => (Array.isArray(item.lockUnits) ? item.lockUnits.slice() : []))
        .sort((a, b) => {
            const aFirst = Number.isFinite(a[0]) ? a[0] : Infinity;
            const bFirst = Number.isFinite(b[0]) ? b[0] : Infinity;
            return aFirst - bFirst;
        });
}

test('getActualGridLockedUnitsForBase merges manual+auto locked masks', () => {
    const ctx = {
        timeSlots: [{ activityLog: { subActivities: [] } }],
        extractLockedRowsFromActivities: (rows, totalUnits) => extractLockedRowsFromActivities(rows, totalUnits),
        getActualDurationStepSeconds() {
            return STEP_SECONDS;
        },
        normalizeActivityText(value) {
            return String(value || '').trim();
        },
        getActualGridDisplayOrderIndices(planUnits) {
            return planUnits.map((_label, idx) => idx);
        },
    };

    const locked = getActualGridLockedUnitsForBase.call(ctx, 0, ['A', 'A', 'B', 'B'], [
        { label: '', seconds: 600, recordedSeconds: 600, source: 'locked', isAutoLocked: false, lockStart: 1, lockEnd: 1, lockUnits: [1] },
        { label: 'A', seconds: 1200, source: 'grid' }
    ]);

    assert.deepEqual(locked, [false, true, true, true]);
});

test('toggleActualGridLockedUnit preserves existing manual lock units when adding another unit', () => {
    const ctx = makeCtx({
        timeSlots: [{
            activityLog: {
                subActivities: [
                    { label: '', seconds: 600, recordedSeconds: 600, source: 'locked', isAutoLocked: false, lockStart: 0, lockEnd: 0, lockUnits: [0] },
                    { label: 'A', seconds: 2400, source: 'grid' }
                ]
            }
        }],
        buildPlanUnitsForActualGrid: () => ({ units: mkBasePlanUnits(4) }),
    });

    toggleActualGridLockedUnit.call(ctx, 0, 3);

    const rows = (ctx.timeSlots[0].activityLog.subActivities || []);
    const manualRows = rows.filter((item) => item && item.source === 'locked' && item.isAutoLocked !== true);
    assert.equal(manualRows.length, 2);
    assert.deepEqual(manualRows.every((row) => row.isAutoLocked === false), true);
    assert.deepEqual(manualUnitsFromRows(manualRows), [[0], [3]]);
});

test('toggleActualGridLockedUnit long-press locks only target unit when no auto lock row exists', () => {
    const ctx = makeCtx({
        timeSlots: [{
            activityLog: {
                subActivities: [
                    { label: 'A', seconds: 600, source: 'grid' }
                ]
            }
        }],
        buildPlanUnitsForActualGrid: () => ({ units: mkBasePlanUnits(4) }),
    });

    toggleActualGridLockedUnit.call(ctx, 0, 1);

    const rows = (ctx.timeSlots[0].activityLog.subActivities || []);
    const manualRows = rows.filter((item) => item && item.source === 'locked' && item.isAutoLocked === false);
    const autoRows = rows.filter((item) => item && item.source === 'locked' && item.isAutoLocked === true);
    assert.equal(manualRows.length, 1);
    assert.deepEqual(manualRows[0].lockUnits, [1]);
    assert.equal(autoRows.length, 0);
});

test('toggleActualGridLockedUnit removes manual lock target while keeping non-target manual locks', () => {
    const ctx = makeCtx({
        timeSlots: [{
            activityLog: {
                subActivities: [
                    { label: '', seconds: 1200, recordedSeconds: 1200, source: 'locked', isAutoLocked: false, lockStart: 0, lockEnd: 1, lockUnits: [0, 1] },
                    { label: 'A', seconds: 2400, source: 'grid' }
                ]
            }
        }],
        buildPlanUnitsForActualGrid: () => ({ units: mkBasePlanUnits(4) }),
    });

    toggleActualGridLockedUnit.call(ctx, 0, 1);

    const rows = (ctx.timeSlots[0].activityLog.subActivities || []);
    const manualRows = rows.filter((item) => item && item.source === 'locked' && item.isAutoLocked !== true);
    assert.equal(manualRows.length, 1);
    assert.deepEqual(manualRows[0].lockUnits, [0]);
});

test('toggleActualGridLockedUnit keeps automatic lock row while manual lock changes', () => {
    const ctx = makeCtx({
        timeSlots: [{
            activityLog: {
                subActivities: [
                    { label: 'A', seconds: 600, source: 'grid' },
                    { label: '', seconds: 600, recordedSeconds: 600, source: 'locked', isAutoLocked: false, lockStart: 0, lockEnd: 0, lockUnits: [0] },
                    { label: '', seconds: 600, recordedSeconds: 600, source: 'locked', isAutoLocked: true, lockStart: 2, lockEnd: 2, lockUnits: [2] }
                ]
            }
        }],
        buildPlanUnitsForActualGrid: () => ({ units: mkBasePlanUnits(4) }),
    });

    toggleActualGridLockedUnit.call(ctx, 0, 3);

    const rows = (ctx.timeSlots[0].activityLog.subActivities || []);
    const manualRows = rows.filter((item) => item && item.source === 'locked' && item.isAutoLocked === false);
    const autoRows = rows.filter((item) => item && item.source === 'locked' && item.isAutoLocked === true);

    assert.deepEqual(manualRows.length, 2);
    assert.deepEqual(manualUnitsFromRows(manualRows), [[0], [3]]);
    assert.equal(autoRows.length, 1);
    assert.deepEqual(autoRows[0].lockUnits, [2]);
});
