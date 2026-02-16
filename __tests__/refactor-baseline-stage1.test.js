const test = require('node:test');
const assert = require('node:assert/strict');

const { buildMethod } = require('./helpers/script-method-builder');

const formatSlotTimeLabel = buildMethod('formatSlotTimeLabel(rawHour)', '(rawHour)');
const createEmptyTimeSlots = buildMethod('createEmptyTimeSlots()', '()');
const createStateSnapshot = buildMethod('createStateSnapshot(timeSlots = this.timeSlots, mergedFields = this.mergedFields)', '(timeSlots = this.timeSlots, mergedFields = this.mergedFields)');
const parseDurationFromText = buildMethod('parseDurationFromText(text)', '(text)');
const openScheduleModal = buildMethod('openScheduleModal(type, startIndex, endIndex = null)', '(type, startIndex, endIndex = null)');
const saveData = buildMethod('async saveData()', 'async ()');

function withPatchedGlobal(name, value, fn) {
    const hadOwn = Object.prototype.hasOwnProperty.call(global, name);
    const original = global[name];
    Object.defineProperty(global, name, {
        value,
        configurable: true,
        writable: true,
    });

    return Promise.resolve()
        .then(() => fn())
        .finally(() => {
            if (hadOwn) {
                Object.defineProperty(global, name, {
                    value: original,
                    configurable: true,
                    writable: true,
                });
            } else {
                delete global[name];
            }
        });
}

test('createEmptyTimeSlots keeps 24-slot order and default shape', () => {
    const slots = createEmptyTimeSlots.call({});
    assert.equal(slots.length, 24);

    const expectedTimes = Array.from({ length: 20 }, (_, idx) => String(idx + 4)).concat(['00', '1', '2', '3']);
    assert.deepEqual(slots.map((slot) => slot.time), expectedTimes);

    slots.forEach((slot) => {
        assert.equal(slot.planned, '');
        assert.equal(slot.actual, '');
        assert.deepEqual(slot.planActivities, []);
        assert.equal(slot.planTitle, '');
        assert.equal(slot.planTitleBandOn, false);
        assert.deepEqual(slot.timer, { running: false, elapsed: 0, startTime: null, method: 'manual' });
        assert.deepEqual(slot.activityLog, {
            title: '',
            details: '',
            subActivities: [],
            titleBandOn: false,
            actualGridUnits: [],
            actualExtraGridUnits: [],
            actualOverride: false,
        });
    });

    assert.notEqual(slots[0].timer, slots[1].timer);
    assert.notEqual(slots[0].activityLog, slots[1].activityLog);
});

test('formatSlotTimeLabel keeps two-digit hour labels', () => {
    assert.equal(formatSlotTimeLabel.call({}, '4'), '04');
    assert.equal(formatSlotTimeLabel.call({}, '00'), '00');
    assert.equal(formatSlotTimeLabel.call({}, '23'), '23');
    assert.equal(formatSlotTimeLabel.call({}, 'bad'), 'bad');
});

test('parseDurationFromText prefers last time token and supports ko/en units', () => {
    const ctx = {
        normalizeDurationStep(seconds) {
            return seconds;
        },
    };

    assert.equal(parseDurationFromText.call(ctx, 'start 00:10 end 01:15:20'), 4520);
    assert.equal(parseDurationFromText.call(ctx, '집중 1시간 20분'), 4800);
    assert.equal(parseDurationFromText.call(ctx, '45min'), 2700);
    assert.equal(parseDurationFromText.call(ctx, '75:99'), null);
    assert.equal(parseDurationFromText.call(ctx, 'no duration'), null);
});

test('createStateSnapshot deep-clones slots and serializes merged fields', () => {
    const timeSlots = [{ planned: 'deep work', timer: { elapsed: 1200 } }];
    const mergedFields = new Map([['planned-0-0', 'deep work']]);

    const snapshot = createStateSnapshot.call({}, timeSlots, mergedFields);

    assert.deepEqual(snapshot.mergedFields, { 'planned-0-0': 'deep work' });
    assert.deepEqual(snapshot.timeSlots, [{ planned: 'deep work', timer: { elapsed: 1200 } }]);

    snapshot.timeSlots[0].planned = 'changed';
    assert.equal(timeSlots[0].planned, 'deep work');
});

test('openScheduleModal routes planned edits to inline dropdown anchor', async () => {
    const calls = [];
    const plannedAnchor = { id: 'planned-anchor' };

    await withPatchedGlobal('document', {
        querySelector(selector) {
            if (selector.includes('.planned-input')) return plannedAnchor;
            return null;
        },
    }, () => {
        const ctx = {
            openInlinePlanDropdown(startIndex, anchor, endIndex) {
                calls.push([startIndex, anchor, endIndex]);
            },
        };

        openScheduleModal.call(ctx, 'planned', 5, 7);
        openScheduleModal.call(ctx, 'actual', 5, 7);
        openScheduleModal.call(ctx, 'planned', 9, null);
    });

    assert.deepEqual(calls, [
        [5, plannedAnchor, 7],
        [9, plannedAnchor, 9],
    ]);
});

test('saveData persists current-date and last snapshots using timesheetData keys', async () => {
    const writes = [];
    const saveStatuses = [];
    const syncStatuses = [];
    const scheduled = [];

    await withPatchedGlobal('localStorage', {
        setItem(key, value) {
            writes.push([key, value]);
        },
    }, async () => {
        await withPatchedGlobal('navigator', { onLine: true }, async () => {
            const ctx = {
                currentDate: '2026-02-16',
                timeSlots: [{ time: '4', planned: '집중', actual: '' }],
                mergedFields: new Map([['planned-0-0', '집중']]),
                _lastSavedSignature: '',
                setSaveStatus(kind, message) {
                    saveStatuses.push([kind, message]);
                },
                setSyncStatus(kind, message) {
                    syncStatuses.push([kind, message]);
                },
                scheduleSupabaseSave() {
                    scheduled.push('called');
                },
            };

            await saveData.call(ctx);

            assert.equal(ctx._hasPendingRemoteSync, true);
            assert.match(ctx._lastSavedSignature, /"date":"2026-02-16"/);
        });
    });

    assert.equal(writes.length, 2);
    assert.equal(writes[0][0], 'timesheetData:2026-02-16');
    assert.equal(writes[1][0], 'timesheetData:last');
    assert.equal(saveStatuses[0][0], 'info');
    assert.equal(saveStatuses.at(-1)[0], 'success');
    assert.equal(syncStatuses.at(-1)[0], 'info');
    assert.deepEqual(scheduled, ['called']);
});
