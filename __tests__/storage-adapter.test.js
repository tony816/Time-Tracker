const test = require('node:test');
const assert = require('node:assert/strict');

const storageAdapter = require('../infra/storage-adapter');

function withMockLocalStorage(seed = {}, fn) {
    const hadOwn = Object.prototype.hasOwnProperty.call(globalThis, 'localStorage');
    const original = globalThis.localStorage;

    const store = new Map(Object.entries(seed));
    const mock = {
        getItem(key) {
            return store.has(String(key)) ? store.get(String(key)) : null;
        },
        setItem(key, value) {
            store.set(String(key), String(value));
        },
        removeItem(key) {
            store.delete(String(key));
        },
        _store: store,
    };

    Object.defineProperty(globalThis, 'localStorage', {
        value: mock,
        configurable: true,
        writable: true,
    });

    return Promise.resolve()
        .then(() => fn(mock))
        .finally(() => {
            if (hadOwn) {
                Object.defineProperty(globalThis, 'localStorage', {
                    value: original,
                    configurable: true,
                    writable: true,
                });
            } else {
                delete globalThis.localStorage;
            }
        });
}

test('storage-adapter exposes expected API on module and global', () => {
    assert.equal(typeof storageAdapter.getDayStartHour, 'function');
    assert.equal(typeof storageAdapter.setDayStartHour, 'function');
    assert.equal(typeof storageAdapter.getTimesheetData, 'function');
    assert.equal(typeof storageAdapter.setTimesheetData, 'function');

    assert.ok(globalThis.TimeTrackerStorage);
    assert.equal(typeof globalThis.TimeTrackerStorage.getTimesheetStorageKey, 'function');
});

test('day-start settings normalize values and persist as 0/4 only', async () => {
    await withMockLocalStorage({}, (mock) => {
        assert.equal(storageAdapter.getDayStartHour(), 4);
        assert.equal(storageAdapter.setDayStartHour(0), 0);
        assert.equal(mock.getItem('tt.dayStartHour'), '0');

        assert.equal(storageAdapter.setDayStartHour(7), 4);
        assert.equal(mock.getItem('tt.dayStartHour'), '4');

        mock.setItem('tt.dayStartHour', 'not-number');
        assert.equal(storageAdapter.getDayStartHour(0), 0);
    });
});

test('timesheet payload uses date key + last key and supports fallback lookup', async () => {
    await withMockLocalStorage({}, (mock) => {
        const payload = JSON.stringify({ date: '2026-02-16', slots: [1, 2, 3] });
        const saved = storageAdapter.setTimesheetData('2026-02-16', payload);
        assert.equal(saved, true);

        assert.equal(mock.getItem('timesheetData:2026-02-16'), payload);
        assert.equal(mock.getItem('timesheetData:last'), payload);

        assert.equal(storageAdapter.getTimesheetData('2026-02-16'), payload);
        assert.equal(storageAdapter.getTimesheetData('2026-02-17'), payload);

        storageAdapter.removeTimesheetData('2026-02-16');
        assert.equal(mock.getItem('timesheetData:2026-02-16'), null);
        assert.equal(storageAdapter.getTimesheetData('2026-02-16'), payload);
    });
});
