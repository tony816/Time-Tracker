const test = require('node:test');
const assert = require('node:assert/strict');

require('../core/plan-segment-core');
const controller = require('../controllers/persistence-controller');
const { buildMethod } = require('./helpers/script-method-builder');

const buildSlotsJsonWrapper = buildMethod('buildSlotsJson()', '()');
const applySlotsJsonWrapper = buildMethod('applySlotsJson(slotsJson)', '(slotsJson)');

function createSlot(time, overrides = {}) {
    return {
        time,
        planned: '',
        actual: '',
        planActivities: [],
        planTitle: '',
        planTitleBandOn: false,
        planSegmentTimers: {},
        timer: { running: false, elapsed: 0, elapsedSeconds: 0, rawElapsed: 0, startTime: null, startedAt: null, lastPausedAt: null, method: 'manual', status: 'idle' },
        activityLog: {
            title: '',
            details: '',
            subActivities: [],
            titleBandOn: false,
            actualGridUnits: [],
            actualExtraGridUnits: [],
            actualFailedGridUnits: [],
            actualOverride: false,
        },
        ...overrides,
    };
}

function createCtx() {
    return {
        timeSlots: [createSlot('4'), createSlot('5'), createSlot('6'), createSlot('7')],
        mergedFields: new Map(),
        createEmptyTimeSlots() {
            return this.timeSlots.map(slot => createSlot(slot.time));
        },
        hourToLabel(hour) {
            return hour === 0 ? '00' : String(hour);
        },
        labelToHour(label) {
            return String(label) === '00' ? 0 : parseInt(label, 10);
        },
        findMergeKey(type, index) {
            for (const key of this.mergedFields.keys()) {
                if (!key.startsWith(`${type}-`)) continue;
                const [, startText, endText] = key.split('-');
                const start = parseInt(startText, 10);
                const end = parseInt(endText, 10);
                if (index >= start && index <= end) return key;
            }
            return null;
        },
        normalizeActivityText(value) {
            return String(value || '').trim();
        },
        normalizePlanActivitiesArray(items) {
            return Array.isArray(items)
                ? items
                    .filter(item => item && typeof item === 'object')
                    .map(item => ({ ...item }))
                : [];
        },
        normalizeActivitiesArray(items) {
            return Array.isArray(items)
                ? items
                    .filter(item => item && typeof item === 'object')
                    .map(item => ({ ...item }))
                : [];
        },
        normalizeTimerStatus(status, slot) {
            const value = String(status || '').trim();
            if (['idle', 'running', 'paused', 'completed'].includes(value)) return value;
            return slot && slot.timer && slot.timer.running ? 'running' : 'idle';
        },
    };
}

function createPlanMergeSnapshot() {
    return {
        version: 2,
        mergeKey: 'planned-0-1',
        startIndex: 0,
        endIndex: 1,
        slots: [
            {
                time: '4',
                planned: 'Alpha',
                planActivities: [{ label: 'A', seconds: 600 }],
                planSegmentTimers: { 'planned-0-0-seg0': { status: 'paused', elapsedSeconds: 120 } },
                activityLog: {},
            },
            {
                time: '5',
                planned: 'Beta',
                planActivities: [{ label: 'B', seconds: 300 }],
                planSegmentTimers: { 'planned-1-1-seg0': { status: 'idle', elapsedSeconds: 0 } },
                activityLog: {},
            },
        ],
        mergedFields: [
            { key: 'planned-0-1', value: 'Merged plan' },
            { key: 'time-0-1', value: '4-5' },
        ],
    };
}

test('persistence-controller exports and global attach are available', () => {
    assert.ok(controller);
    assert.equal(typeof controller.buildSlotsJson, 'function');
    assert.equal(typeof controller.applySlotsJson, 'function');
    assert.equal(typeof controller.saveData, 'function');
    assert.equal(typeof controller.persistLocalSnapshotNow, 'function');
    assert.equal(typeof controller.createStateSnapshot, 'function');
    assert.equal(typeof controller.loadData, 'function');
    assert.equal(typeof controller.autoSave, 'function');
    assert.equal(globalThis.TimeTrackerPersistenceController.saveData, controller.saveData);
});

test('script persistence wrapper methods delegate build/apply slot helpers to controller', () => {
    const original = globalThis.TimeTrackerPersistenceController;
    const calls = [];

    globalThis.TimeTrackerPersistenceController = {
        ...original,
        buildSlotsJson() {
            calls.push(['build', this]);
            return { ok: 'build' };
        },
        applySlotsJson(slotsJson) {
            calls.push(['apply', this, slotsJson]);
            return true;
        },
    };

    const ctx = { id: 'tracker' };
    const payload = { 4: { planned: 'Focus' } };

    try {
        assert.deepEqual(buildSlotsJsonWrapper.call(ctx), { ok: 'build' });
        assert.equal(applySlotsJsonWrapper.call(ctx, payload), true);
    } finally {
        globalThis.TimeTrackerPersistenceController = original;
    }

    assert.deepEqual(calls, [
        ['build', ctx],
        ['apply', ctx, payload],
    ]);
});

test('persistLocalSnapshotNow prefers storage adapter when available', () => {
    const writes = [];
    const originalStorage = globalThis.TimeTrackerStorage;

    globalThis.TimeTrackerStorage = {
        setTimesheetData(date, serializedSnapshot) {
            writes.push([date, serializedSnapshot]);
        },
    };

    const ctx = {
        currentDate: '2026-03-24',
        timeSlots: [{ time: '4', planned: 'focus', actual: '' }],
        mergedFields: new Map([['planned-0-0', 'focus']]),
        _lastSavedSignature: '',
    };

    try {
        const serialized = controller.persistLocalSnapshotNow.call(ctx);
        assert.equal(writes.length, 1);
        assert.equal(writes[0][0], '2026-03-24');
        assert.equal(writes[0][1], serialized);
        assert.equal(ctx._lastSavedSignature, serialized);
    } finally {
        if (originalStorage === undefined) {
            delete globalThis.TimeTrackerStorage;
        } else {
            globalThis.TimeTrackerStorage = originalStorage;
        }
    }
});

test('buildSlotsJson includes non-empty planSegmentTimers for single planned rows', () => {
    const ctx = createCtx();
    ctx.timeSlots[0].planned = 'Focus';
    ctx.timeSlots[0].planSegmentTimers = {
        'planned-0-0-seg0': { status: 'paused', running: false, elapsedSeconds: 90 },
    };

    const slots = controller.buildSlotsJson.call(ctx);

    assert.deepEqual(slots['4'].planSegmentTimers, {
        'planned-0-0-seg0': { status: 'paused', running: false, elapsedSeconds: 90 },
    });
});

test('applySlotsJson restores planSegmentTimers for single planned rows', () => {
    const ctx = createCtx();

    controller.applySlotsJson.call(ctx, {
        4: {
            planned: 'Focus',
            planSegmentTimers: {
                'planned-0-0-seg0': { status: 'paused', running: false, elapsedSeconds: 90 },
            },
        },
    });

    assert.equal(ctx.timeSlots[0].planned, 'Focus');
    assert.deepEqual(ctx.timeSlots[0].planSegmentTimers, {
        'planned-0-0-seg0': { status: 'paused', running: false, elapsedSeconds: 90 },
    });
});

test('buildSlotsJson includes valid planMergeSnapshot for single planned rows', () => {
    const ctx = createCtx();
    const snapshot = createPlanMergeSnapshot();
    ctx.timeSlots[0].planned = 'Merged plan';
    ctx.timeSlots[0].planMergeSnapshot = snapshot;

    const slots = controller.buildSlotsJson.call(ctx);

    assert.deepEqual(slots['4'].planMergeSnapshot, snapshot);
});

test('applySlotsJson restores valid planMergeSnapshot for single planned rows', () => {
    const ctx = createCtx();
    const snapshot = createPlanMergeSnapshot();

    controller.applySlotsJson.call(ctx, {
        4: {
            planned: 'Merged plan',
            planMergeSnapshot: snapshot,
        },
    });

    assert.deepEqual(ctx.timeSlots[0].planMergeSnapshot, snapshot);
});

test('planned segment order and ranges roundtrip through slots JSON with preserving normalizer', () => {
    const ctx = createCtx();
    ctx.normalizePlanActivitiesArray = function(items) {
        return Array.isArray(items)
            ? items.map((item) => ({
                label: String(item.label || '').trim(),
                seconds: Number(item.seconds) || 0,
                activityId: item.activityId || null,
                activityText: item.activityText || item.label || '',
            }))
            : [];
    };
    ctx.normalizePlanActivitiesPreservingSegments = function(items) {
        return Array.isArray(items)
            ? items.map((item) => ({ ...item }))
            : [];
    };
    ctx.timeSlots[0].planned = 'Interview, Prep';
    ctx.timeSlots[0].planActivities = [
        { label: 'Interview', activityText: 'Interview', activityId: 'interview', startMinute: 0, endMinute: 30, durationMinutes: 30, seconds: 1800 },
        { label: 'Prep', activityText: 'Prep', activityId: 'prep', startMinute: 30, endMinute: 60, durationMinutes: 30, seconds: 1800 },
    ];
    ctx.timeSlots[0].planSegmentTimers = {
        'planned-0-0-seg0': { status: 'paused', elapsedSeconds: 90 },
        'planned-0-0-seg1': { status: 'idle', elapsedSeconds: 10 },
    };

    const slots = controller.buildSlotsJson.call(ctx);
    const restored = createCtx();
    restored.normalizePlanActivitiesArray = ctx.normalizePlanActivitiesArray;
    restored.normalizePlanActivitiesPreservingSegments = ctx.normalizePlanActivitiesPreservingSegments;
    controller.applySlotsJson.call(restored, slots);

    assert.deepEqual(slots['4'].planActivities.map((item) => ({
        label: item.label,
        activityId: item.activityId,
        startMinute: item.startMinute,
        endMinute: item.endMinute,
        durationMinutes: item.durationMinutes,
    })), [
        { label: 'Interview', activityId: 'interview', startMinute: 0, endMinute: 30, durationMinutes: 30 },
        { label: 'Prep', activityId: 'prep', startMinute: 30, endMinute: 60, durationMinutes: 30 },
    ]);
    assert.deepEqual(restored.timeSlots[0].planActivities.map((item) => ({
        label: item.label,
        activityId: item.activityId,
        startMinute: item.startMinute,
        endMinute: item.endMinute,
        durationMinutes: item.durationMinutes,
    })), [
        { label: 'Interview', activityId: 'interview', startMinute: 0, endMinute: 30, durationMinutes: 30 },
        { label: 'Prep', activityId: 'prep', startMinute: 30, endMinute: 60, durationMinutes: 30 },
    ]);
    assert.equal(restored.timeSlots[0].planSegmentTimers['planned-0-0-seg0'].elapsedSeconds, 90);
});

test('applySlotsJson clears stale local source slot when remote sparse JSON omits that hour', () => {
    const ctx = createCtx();
    ctx.timeSlots[0].planned = 'Old source';
    ctx.timeSlots[0].planActivities = [{ label: 'Old', seconds: 60 }];
    ctx.timeSlots[0].planTitle = 'Old title';
    ctx.timeSlots[0].planTitleBandOn = true;
    ctx.timeSlots[0].planSegmentTimers = { 'planned-0-0-seg0': { status: 'paused' } };
    ctx.timeSlots[0].planMergeSnapshot = createPlanMergeSnapshot();

    controller.applySlotsJson.call(ctx, {
        5: { planned: 'Remote target' },
    });

    assert.equal(ctx.timeSlots[0].time, '4');
    assert.equal(ctx.timeSlots[0].planned, '');
    assert.deepEqual(ctx.timeSlots[0].planActivities, []);
    assert.equal(ctx.timeSlots[0].planTitle, '');
    assert.equal(ctx.timeSlots[0].planTitleBandOn, false);
    assert.deepEqual(ctx.timeSlots[0].planSegmentTimers, {});
    assert.equal(ctx.timeSlots[0].planMergeSnapshot, undefined);
    assert.equal(ctx.timeSlots[1].planned, 'Remote target');
});

test('applySlotsJson treats move remote payload as authoritative sparse snapshot', () => {
    const ctx = createCtx();
    ctx.timeSlots[0].planned = 'Move me';
    ctx.timeSlots[0].planActivities = [{ label: 'Draft', seconds: 300 }];
    ctx.timeSlots[0].planSegmentTimers = {
        'planned-0-0-seg0': { status: 'idle', elapsedSeconds: 45 },
    };

    controller.applySlotsJson.call(ctx, {
        6: {
            planned: 'Move me',
            planActivities: [{ label: 'Draft', seconds: 300 }],
            planSegmentTimers: {
                'planned-2-2-seg0': { status: 'idle', elapsedSeconds: 45 },
            },
        },
    });

    assert.equal(ctx.timeSlots[0].planned, '');
    assert.deepEqual(ctx.timeSlots[0].planActivities, []);
    assert.deepEqual(ctx.timeSlots[0].planSegmentTimers, {});
    assert.equal(ctx.timeSlots[2].planned, 'Move me');
    assert.deepEqual(ctx.timeSlots[2].planActivities, [{ label: 'Draft', seconds: 300 }]);
    assert.deepEqual(ctx.timeSlots[2].planSegmentTimers, {
        'planned-2-2-seg0': { status: 'idle', elapsedSeconds: 45 },
    });
});

test('merged planned block with timers and snapshot roundtrips through build and apply', () => {
    const sourceCtx = createCtx();
    const snapshot = createPlanMergeSnapshot();
    sourceCtx.timeSlots[0].planned = 'Alpha';
    sourceCtx.timeSlots[0].planActivities = [{ label: 'A', seconds: 600 }];
    sourceCtx.timeSlots[0].planSegmentTimers = {
        'planned-0-1-seg0': { status: 'paused', running: false, elapsedSeconds: 120 },
    };
    sourceCtx.timeSlots[0].planMergeSnapshot = snapshot;
    sourceCtx.timeSlots[1].planned = 'Beta';
    sourceCtx.mergedFields.set('planned-0-1', 'Merged plan');
    sourceCtx.mergedFields.set('time-0-1', '4-5');
    sourceCtx.mergedFields.set('actual-0-1', '');

    const slots = controller.buildSlotsJson.call(sourceCtx);

    assert.deepEqual(slots['4'].planSegmentTimers, {
        'planned-0-1-seg0': { status: 'paused', running: false, elapsedSeconds: 120 },
    });
    assert.deepEqual(slots['4'].planMergeSnapshot, snapshot);

    const targetCtx = createCtx();
    controller.applySlotsJson.call(targetCtx, slots);

    assert.equal(targetCtx.mergedFields.get('planned-0-1'), 'Merged plan');
    assert.equal(targetCtx.mergedFields.get('time-0-1'), '4-5');
    assert.equal(targetCtx.timeSlots[0].planned, 'Merged plan');
    assert.deepEqual(targetCtx.timeSlots[0].planSegmentTimers, {
        'planned-0-1-seg0': { status: 'paused', running: false, elapsedSeconds: 120 },
    });
    assert.deepEqual(targetCtx.timeSlots[0].planMergeSnapshot, snapshot);
    assert.equal(targetCtx.timeSlots[1].planned, '');
    assert.deepEqual(targetCtx.timeSlots[1].planSegmentTimers, {});
});
