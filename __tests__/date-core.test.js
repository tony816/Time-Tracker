const test = require('node:test');
const assert = require('node:assert/strict');

const dateCore = require('../core/date-core');

test('date-core exports are available and attached to global', () => {
    assert.equal(typeof dateCore.parseLocalDateParts, 'function');
    assert.equal(typeof dateCore.getDateValue, 'function');
    assert.equal(typeof dateCore.compareDateStrings, 'function');
    assert.equal(typeof dateCore.formatDateFromMsLocal, 'function');
    assert.equal(typeof dateCore.getTodayLocalDateString, 'function');
    assert.equal(typeof dateCore.getLocalSlotStartMs, 'function');
    assert.equal(typeof dateCore.getDayOfWeek, 'function');

    assert.ok(globalThis.TimeTrackerDateCore);
    assert.equal(typeof globalThis.TimeTrackerDateCore.getDateValue, 'function');
});

test('date-core parses local date parts and computes comparable values', () => {
    assert.deepEqual(dateCore.parseLocalDateParts('2026-02-16'), { year: 2026, month: 2, day: 16 });
    assert.equal(dateCore.parseLocalDateParts('bad-value'), null);

    const expected = new Date(2026, 1, 16, 0, 0, 0, 0).getTime();
    assert.equal(dateCore.getDateValue('2026-02-16'), expected);
    assert.equal(dateCore.compareDateStrings('2026-02-16', '2026-02-17'), -1);
    assert.equal(dateCore.compareDateStrings('2026-02-16', '2026-02-16'), 0);
    assert.equal(dateCore.compareDateStrings('2026-02-18', '2026-02-17'), 1);
});

test('date-core formats local date strings and slot start timestamps', () => {
    const noonMs = new Date(2026, 1, 16, 12, 34, 56, 0).getTime();
    assert.equal(dateCore.formatDateFromMsLocal(noonMs), '2026-02-16');

    const slotMs = dateCore.getLocalSlotStartMs('2026-02-16', 9);
    assert.equal(slotMs, new Date(2026, 1, 16, 9, 0, 0, 0).getTime());

    assert.equal(dateCore.getDayOfWeek('2026-02-16'), new Date(2026, 1, 16).getDay());
});

test('date-core can derive today string from a mocked Date.now', () => {
    const originalNow = Date.now;
    const fixedMs = new Date(2026, 1, 16, 23, 59, 0, 0).getTime();
    Date.now = () => fixedMs;
    try {
        assert.equal(dateCore.getTodayLocalDateString(), '2026-02-16');
    } finally {
        Date.now = originalNow;
    }
});
