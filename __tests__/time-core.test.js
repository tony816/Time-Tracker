const test = require('node:test');
const assert = require('node:assert/strict');

const core = require('../core/time-core');

test('time-core exports are available and attached to global', () => {
    assert.equal(typeof core.createEmptyTimeSlots, 'function');
    assert.equal(typeof core.formatSlotTimeLabel, 'function');
    assert.equal(typeof core.parseDurationFromText, 'function');

    assert.ok(globalThis.TimeTrackerCore);
    assert.equal(typeof globalThis.TimeTrackerCore.createEmptyTimeSlots, 'function');
    assert.equal(typeof globalThis.TimeTrackerCore.formatSlotTimeLabel, 'function');
    assert.equal(typeof globalThis.TimeTrackerCore.parseDurationFromText, 'function');
});

test('time-core createEmptyTimeSlots returns 24 independent default slots', () => {
    const slots = core.createEmptyTimeSlots();
    assert.equal(slots.length, 24);
    assert.deepEqual(slots.map((slot) => slot.time), core.TIME_SLOT_LABELS);

    assert.deepEqual(slots[0].timer, { running: false, elapsed: 0, startTime: null, method: 'manual' });
    assert.deepEqual(slots[0].activityLog, {
        title: '',
        details: '',
        subActivities: [],
        titleBandOn: false,
        actualGridUnits: [],
        actualExtraGridUnits: [],
        actualOverride: false,
    });

    assert.notEqual(slots[0].timer, slots[1].timer);
    assert.notEqual(slots[0].activityLog, slots[1].activityLog);
});

test('time-core formatSlotTimeLabel keeps two-digit display behavior', () => {
    assert.equal(core.formatSlotTimeLabel('4'), '04');
    assert.equal(core.formatSlotTimeLabel('00'), '00');
    assert.equal(core.formatSlotTimeLabel('23'), '23');
    assert.equal(core.formatSlotTimeLabel('bad'), 'bad');
});

test('time-core parseDurationFromText supports hh:mm:ss and ko/en units', () => {
    const normalizeDurationStep = (seconds) => Math.max(0, Math.floor(seconds));

    assert.equal(core.parseDurationFromText('before 00:10 after 01:15:20', normalizeDurationStep), 4520);
    assert.equal(core.parseDurationFromText('집중 1시간 20분', normalizeDurationStep), 4800);
    assert.equal(core.parseDurationFromText('45min', normalizeDurationStep), 2700);
    assert.equal(core.parseDurationFromText('75:99', normalizeDurationStep), null);
    assert.equal(core.parseDurationFromText('no duration', normalizeDurationStep), null);
});
