const test = require('node:test');
const assert = require('node:assert/strict');

const controller = require('../controllers/actual-input-controller');
const { buildMethod } = require('./helpers/script-method-builder');

const handleActualInputEventWrapper = buildMethod('handleActualInputEvent(eventType, target, event = null)', '(eventType, target, event = null)');
const parseActualDurationInputWrapper = buildMethod('parseActualDurationInput(value)', '(value)');
const syncTimerElapsedFromActualInputWrapper = buildMethod('syncTimerElapsedFromActualInput(index, text)', '(index, text)');
const clearSubActivitiesForIndexWrapper = buildMethod('clearSubActivitiesForIndex(index)', '(index)');
const enforceActualLimitWrapper = buildMethod('enforceActualLimit(index)', '(index)');

test('actual-input-controller exports and global attach are available', () => {
    assert.equal(typeof controller.handleActualInputEvent, 'function');
    assert.equal(typeof controller.parseActualDurationInput, 'function');
    assert.equal(typeof controller.syncTimerElapsedFromActualInput, 'function');
    assert.equal(typeof controller.clearSubActivitiesForIndex, 'function');
    assert.equal(typeof controller.enforceActualLimit, 'function');
    assert.ok(globalThis.TimeTrackerActualInputController);
    assert.equal(globalThis.TimeTrackerActualInputController.handleActualInputEvent, controller.handleActualInputEvent);
});

test('script actual-input wrapper methods delegate to controller helpers', () => {
    const original = globalThis.TimeTrackerActualInputController;
    const calls = [];
    globalThis.TimeTrackerActualInputController = {
        handleActualInputEvent(eventType, target, event) {
            calls.push(['handle', this, eventType, target, event]);
            return 'handled';
        },
        parseActualDurationInput(value) {
            calls.push(['parse', this, value]);
            return 1200;
        },
        syncTimerElapsedFromActualInput(index, text) {
            calls.push(['sync', this, index, text]);
            return 'synced';
        },
        clearSubActivitiesForIndex(index) {
            calls.push(['clear', this, index]);
            return 'cleared';
        },
        enforceActualLimit(index) {
            calls.push(['limit', this, index]);
            return 'limited';
        },
    };

    const ctx = { id: 'tracker' };
    const target = { value: '01:00' };
    const event = { key: 'Enter' };

    try {
        assert.equal(handleActualInputEventWrapper.call(ctx, 'input', target, event), 'handled');
        assert.equal(parseActualDurationInputWrapper.call(ctx, '20'), 1200);
        assert.equal(syncTimerElapsedFromActualInputWrapper.call(ctx, 2, '00:20'), 'synced');
        assert.equal(clearSubActivitiesForIndexWrapper.call(ctx, 2), 'cleared');
        assert.equal(enforceActualLimitWrapper.call(ctx, 2), 'limited');
    } finally {
        globalThis.TimeTrackerActualInputController = original;
    }

    assert.deepEqual(calls, [
        ['handle', ctx, 'input', target, event],
        ['parse', ctx, '20'],
        ['sync', ctx, 2, '00:20'],
        ['clear', ctx, 2],
        ['limit', ctx, 2],
    ]);
});

test('handleActualInputEvent writes merged actual values and triggers persistence side effects', async () => {
    const target = {
        tagName: 'INPUT',
        value: '01:20',
        dataset: { index: '1' },
        classList: {
            contains(token) {
                return token === 'timer-result-input';
            },
        },
    };
    const calls = [];
    const ctx = {
        timeSlots: [
            { actual: '', timer: {} },
            { actual: '', timer: {} },
            { actual: '', timer: {} },
        ],
        mergedFields: new Map(),
        findMergeKey(type, index) {
            if (type === 'actual' && index === 1) return 'actual-1-2';
            return null;
        },
        enforceActualLimit(index) {
            calls.push(['limit', index]);
        },
        clearSubActivitiesForIndex(index) {
            calls.push(['clear', index]);
        },
        syncTimerElapsedFromActualInput(index, text) {
            calls.push(['sync', index, text]);
        },
        calculateTotals() {
            calls.push(['totals']);
        },
        autoSave() {
            calls.push(['save']);
        },
        saveData() {
            calls.push(['persist']);
            return Promise.resolve();
        },
    };

    const handled = controller.handleActualInputEvent.call(ctx, 'input', target, { key: '1' });
    await new Promise((resolve) => setTimeout(resolve, 0));

    assert.equal(handled, true);
    assert.equal(ctx.mergedFields.get('actual-1-2'), '01:20');
    assert.equal(ctx.timeSlots[1].actual, '01:20');
    assert.equal(ctx.timeSlots[2].actual, '');
    assert.deepEqual(calls, [
        ['limit', 1],
        ['clear', 1],
        ['sync', 1, '01:20'],
        ['totals'],
        ['save'],
        ['persist'],
    ]);
});

test('handleActualInputEvent ignores unrelated keyup keys', () => {
    const target = {
        tagName: 'INPUT',
        value: '00:10',
        dataset: { index: '0' },
        classList: {
            contains(token) {
                return token === 'timer-result-input';
            },
        },
    };
    const ctx = {
        timeSlots: [{ actual: '' }],
    };

    const handled = controller.handleActualInputEvent.call(ctx, 'keyup', target, { key: 'ArrowLeft' });
    assert.equal(handled, false);
    assert.equal(ctx.timeSlots[0].actual, '');
});

test('clearSubActivitiesForIndex clears merged actual-grid payload together', () => {
    const makeLog = () => ({
        subActivities: [{ label: 'A', seconds: 600 }],
        titleBandOn: true,
        actualOverride: true,
        actualGridUnits: [true],
        actualExtraGridUnits: [true],
        actualFailedGridUnits: [true],
    });
    const ctx = {
        timeSlots: [
            { activityLog: makeLog() },
            { activityLog: makeLog() },
        ],
        findMergeKey(type) {
            return type === 'actual' ? 'actual-0-1' : null;
        },
    };

    controller.clearSubActivitiesForIndex.call(ctx, 0);

    ctx.timeSlots.forEach((slot) => {
        assert.deepEqual(slot.activityLog.subActivities, []);
        assert.equal(slot.activityLog.titleBandOn, false);
        assert.equal(slot.activityLog.actualOverride, false);
        assert.deepEqual(slot.activityLog.actualGridUnits, []);
        assert.deepEqual(slot.activityLog.actualExtraGridUnits, []);
        assert.deepEqual(slot.activityLog.actualFailedGridUnits, []);
    });
});
