const test = require('node:test');
const assert = require('node:assert/strict');

const controller = require('../controllers/persistence-controller');

test('persistence-controller exports and global attach are available', () => {
    assert.ok(controller);
    assert.equal(typeof controller.saveData, 'function');
    assert.equal(typeof controller.persistLocalSnapshotNow, 'function');
    assert.equal(typeof controller.createStateSnapshot, 'function');
    assert.equal(typeof controller.loadData, 'function');
    assert.equal(typeof controller.autoSave, 'function');
    assert.equal(globalThis.TimeTrackerPersistenceController.saveData, controller.saveData);
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
