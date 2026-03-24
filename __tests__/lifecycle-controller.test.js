const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const controller = require('../controllers/lifecycle-controller');
const scriptSource = fs.readFileSync(path.join(__dirname, '..', 'script.js'), 'utf8');

test('lifecycle-controller exports and global attach are available', () => {
    assert.equal(globalThis.TimeTrackerLifecycleController.handleClearButtonClick, controller.handleClearButtonClick);
    assert.equal(globalThis.TimeTrackerLifecycleController.clearData, controller.clearData);
    assert.equal(globalThis.TimeTrackerLifecycleController.changeDate, controller.changeDate);
    assert.equal(globalThis.TimeTrackerLifecycleController.transitionToDate, controller.transitionToDate);
});

test('script lifecycle wrapper methods delegate to controller helpers', () => {
    assert.match(scriptSource, /handleClearButtonClick\(\)\s*\{\s*return\s+globalThis\.TimeTrackerLifecycleController\.handleClearButtonClick\.call\(this\);\s*\}/);
    assert.match(scriptSource, /clearData\(\)\s*\{\s*return\s+globalThis\.TimeTrackerLifecycleController\.clearData\.call\(this\);\s*\}/);
    assert.match(scriptSource, /changeDate\(days\)\s*\{\s*return\s+globalThis\.TimeTrackerLifecycleController\.changeDate\.call\(this,\s*days\);\s*\}/);
    assert.match(scriptSource, /transitionToDate\(nextDate\)\s*\{\s*return\s+globalThis\.TimeTrackerLifecycleController\.transitionToDate\.call\(this,\s*nextDate\);\s*\}/);
});

test('handleClearButtonClick clears data and wires undo notification callbacks', () => {
    const snapshot = {
        timeSlots: [{ planned: 'Deep Work' }],
        mergedFields: { 'planned-0-1': 'Deep Work' }
    };
    let notification = null;
    let clearCalls = 0;
    let clearPendingCalls = [];
    let saveCalls = 0;
    let successNotice = null;
    let scheduled = 0;
    const originalConfirm = global.confirm;
    global.confirm = () => true;

    const ctx = {
        currentDate: '2026-03-24',
        timeSlots: [{ planned: '' }],
        mergedFields: new Map(),
        pendingClearUndo: null,
        createStateSnapshot() {
            return snapshot;
        },
        clearData() {
            clearCalls += 1;
        },
        showNotification(message, kind, options) {
            if (kind === 'warn') {
                notification = { message, kind, options };
                return;
            }
            successNotice = { message, kind };
        },
        clearTimesheetClearPending(date) {
            clearPendingCalls.push(date);
        },
        renderTimeEntries() {
            saveCalls += 1;
        },
        calculateTotals() {
            saveCalls += 1;
        },
        autoSave() {
            saveCalls += 1;
        },
        scheduleSupabaseSave() {
            scheduled += 1;
        },
        _hasPendingRemoteSync: false,
    };

    try {
        controller.handleClearButtonClick.call(ctx);
    } finally {
        global.confirm = originalConfirm;
    }

    assert.equal(clearCalls, 1);
    assert.deepEqual(ctx.pendingClearUndo, snapshot);
    assert.equal(notification.kind, 'warn');
    assert.equal(typeof notification.options.onAction, 'function');
    assert.equal(typeof notification.options.onClose, 'function');

    notification.options.onAction();

    assert.deepEqual(ctx.timeSlots, snapshot.timeSlots);
    assert.deepEqual(Object.fromEntries(ctx.mergedFields), snapshot.mergedFields);
    assert.deepEqual(clearPendingCalls, ['2026-03-24']);
    assert.equal(saveCalls, 3);
    assert.equal(ctx._hasPendingRemoteSync, true);
    assert.equal(scheduled, 1);
    assert.equal(ctx.pendingClearUndo, null);
    assert.equal(successNotice.kind, 'success');
});

test('clearData resets in-memory day state and marks pending remote clear', () => {
    const calls = [];
    const mergedFields = new Map([['planned-0-1', 'Deep Work']]);
    const ctx = {
        currentDate: '2026-03-24',
        timeSlots: [{ planned: 'Deep Work' }],
        mergedFields,
        routinesLoaded: false,
        routines: [],
        commitRunningTimers(options) {
            calls.push(['commit', options]);
        },
        generateTimeSlots() {
            calls.push('generate');
            this.timeSlots = [{ planned: '' }];
        },
        renderTimeEntries() {
            calls.push('render');
        },
        calculateTotals() {
            calls.push('totals');
        },
        renderInlinePlanDropdownOptions() {
            calls.push('dropdown');
        },
        closeRoutineMenu() {
            calls.push('closeRoutineMenu');
        },
        markTimesheetClearPending(date) {
            calls.push(['markPending', date]);
        },
        deleteFromSupabaseForDate(date) {
            calls.push(['deleteRemote', date]);
        },
        autoSave() {
            calls.push('autoSave');
        },
    };

    controller.clearData.call(ctx);

    assert.equal(ctx.mergedFields.size, 0);
    assert.deepEqual(calls[0], ['commit', { render: false, calculate: false, autoSave: false }]);
    assert.ok(calls.includes('generate'));
    assert.ok(calls.includes('render'));
    assert.ok(calls.includes('totals'));
    assert.ok(calls.includes('dropdown'));
    assert.ok(calls.includes('closeRoutineMenu'));
    assert.ok(calls.some((entry) => Array.isArray(entry) && entry[0] === 'markPending' && entry[1] === '2026-03-24'));
    assert.ok(calls.some((entry) => Array.isArray(entry) && entry[0] === 'deleteRemote' && entry[1] === '2026-03-24'));
    assert.ok(calls.includes('autoSave'));
    assert.equal(typeof ctx._lastSavedSignature, 'string');
});

test('changeDate computes the target date and forwards to transitionToDate', () => {
    let transitionedTo = null;
    const ctx = {
        currentDate: '2026-03-24',
        getDateValue() {
            return new Date('2026-03-24T00:00:00').getTime();
        },
        formatDateFromMsLocal(ms) {
            const date = new Date(ms);
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        },
        transitionToDate(date) {
            transitionedTo = date;
        },
    };

    controller.changeDate.call(ctx, 2);
    assert.equal(transitionedTo, '2026-03-26');
});
