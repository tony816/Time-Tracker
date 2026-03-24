const test = require('node:test');
const assert = require('node:assert/strict');

const activityCore = require('../core/activity-core');
const stateCore = require('../core/timesheet-state-core');

function createEmptySlot() {
    return {
        planned: '',
        actual: '',
        planActivities: [],
        planTitle: '',
        planTitleBandOn: false,
        timer: {
            running: false,
            elapsed: 0,
            rawElapsed: 0,
            startTime: null,
            method: 'manual',
            status: 'idle',
        },
        activityLog: stateCore.createEmptyActivityLog(),
    };
}

test('timesheet-state-core exposes snapshot and activity-log helpers', () => {
    assert.equal(typeof stateCore.createStateSnapshot, 'function');
    assert.equal(typeof stateCore.serializeStateSnapshot, 'function');
    assert.equal(typeof stateCore.normalizeActivityLog, 'function');
    assert.equal(typeof stateCore.restoreStateSnapshot, 'function');

    assert.ok(globalThis.TimeTrackerStateCore);
    assert.equal(typeof globalThis.TimeTrackerStateCore.createEmptyActivityLog, 'function');
});

test('createStateSnapshot clones slots and normalizes merged-fields containers', () => {
    const timeSlots = [{ planned: 'deep work', activityLog: { title: 'focus' } }];
    const mergedFields = new Map([['planned-0-1', 'deep work']]);

    const snapshot = stateCore.createStateSnapshot(timeSlots, mergedFields);
    assert.deepEqual(snapshot.mergedFields, { 'planned-0-1': 'deep work' });
    assert.notEqual(snapshot.timeSlots, timeSlots);
    assert.notEqual(snapshot.timeSlots[0], timeSlots[0]);

    timeSlots[0].planned = 'changed';
    assert.equal(snapshot.timeSlots[0].planned, 'deep work');
});

test('normalizeActivityLog preserves lock-related arrays while stripping legacy outcome field', () => {
    const normalized = stateCore.normalizeActivityLog({
        title: 12,
        details: 34,
        subActivities: [
            { label: ' Locked ', seconds: 601.9, isAutoLocked: true, lockUnits: [0, 'x', 2], lockStart: 1.7, lockEnd: 3.1 },
        ],
        titleBandOn: 1,
        actualGridUnits: [1, 0, null],
        actualExtraGridUnits: [false, 'x'],
        actualFailedGridUnits: [undefined, 1],
        actualOverride: 'yes',
        outcome: 'legacy',
    }, {
        normalizeActivitiesArray: activityCore.normalizeActivitiesArray,
    });

    assert.deepEqual(normalized, {
        title: '12',
        details: '34',
        subActivities: [
            {
                label: 'Locked',
                seconds: 601,
                source: null,
                isAutoLocked: true,
                lockUnits: [0, 2],
                lockStart: 1,
                lockEnd: 3,
            },
        ],
        titleBandOn: true,
        actualGridUnits: [true, false, false],
        actualExtraGridUnits: [false, true],
        actualFailedGridUnits: [false, true],
        actualOverride: true,
    });
    assert.equal('outcome' in normalized, false);
});

test('restoreStateSnapshot hydrates slots with normalized actual-grid state and safe merge keys', () => {
    const restored = stateCore.restoreStateSnapshot({
        timeSlots: [
            {
                planned: 'Plan A',
                actual: 'Done A',
                planActivities: [{ label: ' Plan A ', seconds: 1800.4 }],
                planTitle: '  Focus  ',
                planTitleBandOn: 1,
                timer: {
                    running: 1,
                    elapsed: 125.9,
                    rawElapsed: 130.2,
                    startTime: 456,
                    method: 'pomodoro',
                    status: 'weird',
                },
                activityLog: {
                    title: 'Title',
                    details: 'Details',
                    subActivities: [
                        { label: ' Manual ', seconds: 600, isAutoLocked: false, lockUnits: [4, 5] },
                        { label: ' Auto ', seconds: 1200, isAutoLocked: true, lockStart: 6, lockEnd: 7 },
                    ],
                    titleBandOn: true,
                    actualGridUnits: [1, 0, 1],
                    actualExtraGridUnits: [0, 1],
                    actualFailedGridUnits: [0, 1],
                    actualOverride: true,
                },
            },
        ],
        mergedFields: {
            ' actual-0-2 ': 'Done A',
            'bad<script>': 'ignored',
        },
    }, {
        templateSlots: [createEmptySlot(), createEmptySlot()],
        normalizePlanActivitiesArray: activityCore.normalizePlanActivitiesArray,
        normalizeActivityText(value) {
            return String(value || '').trim();
        },
        normalizeTimerStatus(rawStatus, slot) {
            const normalized = String(rawStatus || '').trim();
            if (normalized === 'running' || normalized === 'paused' || normalized === 'completed' || normalized === 'idle') {
                return normalized;
            }
            return slot && slot.timer && slot.timer.running ? 'running' : 'idle';
        },
        normalizeActivitiesArray: activityCore.normalizeActivitiesArray,
        normalizeMergeKey(rawMergeKey) {
            const value = String(rawMergeKey || '').trim();
            return /^(planned|actual|time)-\d+-\d+$/.test(value) ? value : null;
        },
    });

    assert.equal(restored.timeSlots[0].planTitle, 'Focus');
    assert.equal(restored.timeSlots[0].planTitleBandOn, true);
    assert.deepEqual(restored.timeSlots[0].planActivities, [{ label: 'Plan A', seconds: 1800 }]);
    assert.deepEqual(restored.timeSlots[0].timer, {
        running: true,
        elapsed: 125,
        rawElapsed: 130,
        startTime: 456,
        method: 'pomodoro',
        status: 'running',
    });
    assert.deepEqual(restored.timeSlots[0].activityLog.actualGridUnits, [true, false, true]);
    assert.deepEqual(restored.timeSlots[0].activityLog.actualExtraGridUnits, [false, true]);
    assert.deepEqual(restored.timeSlots[0].activityLog.actualFailedGridUnits, [false, true]);
    assert.equal(restored.timeSlots[0].activityLog.subActivities[0].isAutoLocked, false);
    assert.equal(restored.timeSlots[0].activityLog.subActivities[1].isAutoLocked, true);
    assert.deepEqual([...restored.mergedFields.entries()], [['actual-0-2', 'Done A']]);

    assert.equal(restored.timeSlots[1].planned, '');
    assert.deepEqual(restored.timeSlots[1].activityLog, stateCore.createEmptyActivityLog());
});
