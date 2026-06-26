const test = require('node:test');
const assert = require('node:assert/strict');

const controller = require('../controllers/planned-catalog-routine-controller');
const { buildMethod } = require('./helpers/script-method-builder');

const applyPlannedCatalogJsonWrapper = buildMethod('applyPlannedCatalogJson(slotsJson)', '(slotsJson)');
const normalizeRoutineItemsWrapper = buildMethod('normalizeRoutineItems(items)', '(items)');
const applyRoutinesToDateWrapper = buildMethod('applyRoutinesToDate(date, options = {})', '(date, options = {})');
const upsertRoutineByWindowWrapper = buildMethod(
    'upsertRoutineByWindow(label, startHour, durationHours, patch = {})',
    '(label, startHour, durationHours, patch = {})'
);
const clearRoutineRangeForDateWrapper = buildMethod(
    'clearRoutineRangeForDate(routine, date, options = {})',
    '(routine, date, options = {})'
);

test('planned-catalog-routine-controller exports and global attach are available', () => {
    assert.ok(controller);
    assert.equal(typeof controller.applyPlannedCatalogJson, 'function');
    assert.equal(typeof controller.normalizeRoutineItems, 'function');
    assert.equal(typeof controller.applyRoutinesToDate, 'function');
    assert.equal(typeof controller.upsertRoutineByWindow, 'function');
    assert.equal(typeof controller.clearRoutineRangeForDate, 'function');
    assert.equal(typeof controller.ensureRoutinesAvailableOrNotify, 'function');
    assert.equal(
        globalThis.TimeTrackerPlannedCatalogRoutineController.applyRoutinesToDate,
        controller.applyRoutinesToDate
    );
});

test('script routine/catalog wrapper methods delegate to controller helpers', () => {
    const original = globalThis.TimeTrackerPlannedCatalogRoutineController;
    const calls = [];

    globalThis.TimeTrackerPlannedCatalogRoutineController = {
        applyPlannedCatalogJson(slotsJson) {
            calls.push(['catalog', this, slotsJson]);
            return true;
        },
        normalizeRoutineItems(items) {
            calls.push(['normalize', this, items]);
            return ['normalized'];
        },
        applyRoutinesToDate(date, options) {
            calls.push(['apply', this, date, options]);
            return 'applied';
        },
        upsertRoutineByWindow(label, startHour, durationHours, patch) {
            calls.push(['upsert', this, label, startHour, durationHours, patch]);
            return { id: 'routine-1' };
        },
        clearRoutineRangeForDate(routine, date, options) {
            calls.push(['clear', this, routine, date, options]);
            return false;
        },
    };

    const ctx = { id: 'tracker' };
    const patch = { pattern: 'weekday' };

    try {
        assert.equal(applyPlannedCatalogJsonWrapper.call(ctx, { catalog: {} }), true);
        assert.deepEqual(normalizeRoutineItemsWrapper.call(ctx, [{ label: 'A' }]), ['normalized']);
        assert.equal(applyRoutinesToDateWrapper.call(ctx, '2026-03-25', { reason: 'test' }), 'applied');
        assert.deepEqual(upsertRoutineByWindowWrapper.call(ctx, 'Focus', 4, 2, patch), { id: 'routine-1' });
        assert.equal(clearRoutineRangeForDateWrapper.call(ctx, { id: 'r1' }, '2026-03-25', {}), false);
    } finally {
        globalThis.TimeTrackerPlannedCatalogRoutineController = original;
    }

    assert.deepEqual(calls, [
        ['catalog', ctx, { catalog: {} }],
        ['normalize', ctx, [{ label: 'A' }]],
        ['apply', ctx, '2026-03-25', { reason: 'test' }],
        ['upsert', ctx, 'Focus', 4, 2, patch],
        ['clear', ctx, { id: 'r1' }, '2026-03-25', {}],
    ]);
});

test('applyRoutinesToDate fills empty planned slots for active routines only', () => {
    const ctx = Object.assign({
        currentDate: '2026-03-25',
        routinesLoaded: true,
        routines: [
            { id: 'r1', label: 'Focus', startHour: 4, durationHours: 2, pattern: 'daily', passDates: [], stoppedAtMs: null },
            { id: 'r2', label: 'Gym', startHour: 6, durationHours: 1, pattern: 'weekday', passDates: ['2026-03-25'], stoppedAtMs: null },
        ],
        timeSlots: [
            { time: '4', planned: '', planTitle: '', planActivities: [], planTitleBandOn: false },
            { time: '5', planned: '', planTitle: '', planActivities: [], planTitleBandOn: false },
            { time: '6', planned: 'Existing', planTitle: 'Existing', planActivities: [], planTitleBandOn: false },
        ],
        mergedFields: new Map(),
        normalizeActivityText(value) {
            return String(value || '').trim();
        },
        normalizePlanActivitiesArray(items) {
            return Array.isArray(items) ? items : [];
        },
        getPlannedValueForIndex(index) {
            const slot = this.timeSlots[index];
            return slot ? String(slot.planned || '').trim() : '';
        },
        findMergeKey() {
            return null;
        },
        hourToLabel(hour) {
            return String(hour);
        },
        labelToHour(label) {
            return Number(label);
        },
    }, controller);

    const changed = controller.applyRoutinesToDate.call(ctx, '2026-03-25', { reason: 'test' });

    assert.equal(changed, true);
    assert.equal(ctx.timeSlots[0].planned, 'Focus');
    assert.equal(ctx.timeSlots[0].planTitle, 'Focus');
    assert.equal(ctx.timeSlots[1].planned, 'Focus');
    assert.equal(ctx.timeSlots[2].planned, 'Existing');
});

test('clearRoutineRangeForDate removes merged planned blocks that match the routine label', () => {
    const slots = [
        { time: '4', planned: 'Focus', planTitle: 'Focus', planActivities: [{ label: 'Focus', seconds: 3600 }], planTitleBandOn: true },
        { time: '5', planned: '', planTitle: '', planActivities: [], planTitleBandOn: false },
        { time: '6', planned: 'Keep', planTitle: 'Keep', planActivities: [], planTitleBandOn: false },
    ];
    const mergedFields = new Map([['planned-0-1', 'Focus']]);
    const ctx = Object.assign({
        timeSlots: slots,
        mergedFields,
        normalizeActivityText(value) {
            return String(value || '').trim();
        },
        normalizePlanActivitiesArray(items) {
            return Array.isArray(items) ? items : [];
        },
        hourToLabel(hour) {
            return String(hour);
        },
        labelToHour(label) {
            return Number(label);
        },
    }, controller);

    const changed = controller.clearRoutineRangeForDate.call(ctx, {
        label: 'Focus',
        startHour: 4,
        durationHours: 2,
    }, '2026-03-25');

    assert.equal(changed, true);
    assert.equal(mergedFields.has('planned-0-1'), false);
    assert.equal(slots[0].planned, '');
    assert.equal(slots[0].planTitle, '');
    assert.deepEqual(slots[0].planActivities, []);
    assert.equal(slots[1].planned, '');
    assert.equal(slots[2].planned, 'Keep');
});
