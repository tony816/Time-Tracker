const test = require('node:test');
const assert = require('node:assert/strict');

const controller = require('../controllers/selection-overlay-controller');

function createClassList(initial = []) {
    const classes = new Set(initial);
    return {
        add(...names) {
            names.forEach((name) => {
                if (name) classes.add(name);
            });
        },
        remove(...names) {
            names.forEach((name) => classes.delete(name));
        },
        toggle(name, force) {
            if (force === true) {
                classes.add(name);
                return true;
            }
            if (force === false) {
                classes.delete(name);
                return false;
            }
            if (classes.has(name)) {
                classes.delete(name);
                return false;
            }
            classes.add(name);
            return true;
        },
        contains(name) {
            return classes.has(name);
        },
        toArray() {
            return Array.from(classes).sort();
        },
    };
}

function createTimeEntry(index, rect = { left: 100, top: 40, width: 80, height: 44 }) {
    const timeSlot = {
        classList: createClassList(['time-slot-container']),
        getBoundingClientRect() {
            return rect;
        },
        closest() {
            return null;
        },
    };
    const row = {
        classList: createClassList(['time-entry']),
        getAttribute(name) {
            return name === 'data-index' ? String(index) : null;
        },
        querySelector(selector) {
            return selector === '.time-slot-container' ? timeSlot : null;
        },
    };
    return { row, timeSlot };
}

function withMockDocument(rows, fn) {
    const originalDocument = global.document;
    const originalWindow = global.window;
    global.document = {
        querySelectorAll(selector) {
            if (selector === '.time-entry[data-index]') {
                return rows.map((entry) => entry.row);
            }
            return [];
        },
        querySelector(selector) {
            const match = selector.match(/\[data-index="(\d+)"\] \.time-slot-container/);
            if (match) {
                const index = parseInt(match[1], 10);
                const entry = rows[index];
                return entry ? entry.timeSlot : null;
            }
            return null;
        },
        documentElement: {
            scrollLeft: 0,
            scrollTop: 0,
        },
    };
    global.window = {
        scrollX: 0,
        scrollY: 0,
    };
    try {
        return fn();
    } finally {
        global.document = originalDocument;
        global.window = originalWindow;
    }
}

test('syncTimeSlotMergeSelectionState applies selected range classes to time-slot containers', () => {
    const rows = [createTimeEntry(0), createTimeEntry(1), createTimeEntry(2)];
    const ctx = {
        selectedPlannedFields: new Set([1, 2]),
        isSelectingPlanned: true,
    };

    withMockDocument(rows, () => {
        controller.syncTimeSlotMergeSelectionState.call(ctx, 'planned');

        assert.equal(rows[0].timeSlot.classList.contains('merge-selected-range'), false);
        assert.equal(rows[1].timeSlot.classList.contains('merge-capable'), true);
        assert.equal(rows[1].timeSlot.classList.contains('merge-selected-range'), true);
        assert.equal(rows[1].timeSlot.classList.contains('merge-selecting'), true);
        assert.equal(rows[1].row.classList.contains('selected-merged-planned'), true);
        assert.equal(rows[1].row.classList.contains('merge-selected-range'), true);
        assert.equal(rows[2].timeSlot.classList.contains('merge-selected-range'), true);
    });
});

test('syncTimeSlotMergeSelectionState clears time-slot selected classes when selection is cleared', () => {
    const rows = [createTimeEntry(0), createTimeEntry(1), createTimeEntry(2)];
    const ctx = {
        selectedPlannedFields: new Set([1, 2]),
        isSelectingPlanned: false,
    };

    withMockDocument(rows, () => {
        controller.syncTimeSlotMergeSelectionState.call(ctx, 'planned');
        ctx.selectedPlannedFields.clear();
        controller.syncTimeSlotMergeSelectionState.call(ctx, 'planned');

        rows.forEach((entry) => {
            assert.equal(entry.row.classList.contains('merge-selected-range'), false);
            assert.equal(entry.row.classList.contains('existing-merged-range'), false);
            assert.equal(entry.timeSlot.classList.contains('merge-selected-range'), false);
            assert.equal(entry.timeSlot.classList.contains('existing-merged-range'), false);
        });
    });
});

test('syncTimeSlotMergeSelectionState marks exact merged ranges as existing-merged-range instead of a new candidate', () => {
    const rows = [createTimeEntry(0), createTimeEntry(1), createTimeEntry(2), createTimeEntry(3)];
    const ctx = {
        selectedPlannedFields: new Set([1, 2, 3]),
        isSelectingPlanned: false,
        findMergeKey(type, index) {
            return type === 'planned' && index >= 1 && index <= 3 ? 'planned-1-3' : null;
        },
        getMergeRangeBounds(mergeKey) {
            assert.equal(mergeKey, 'planned-1-3');
            return { start: 1, end: 3 };
        },
    };

    withMockDocument(rows, () => {
        controller.syncTimeSlotMergeSelectionState.call(ctx, 'planned');

        assert.equal(rows[1].timeSlot.classList.contains('existing-merged-range'), true);
        assert.equal(rows[1].timeSlot.classList.contains('merge-selected-range'), true);
        assert.equal(rows[1].timeSlot.classList.contains('merge-selecting'), false);
        assert.equal(rows[1].row.classList.contains('existing-merged-range'), true);
        assert.equal(rows[1].row.classList.contains('merge-selected-range'), true);
        assert.equal(rows[0].timeSlot.classList.contains('existing-merged-range'), false);
    });
});

test('repositionButtonsNextToSchedule anchors merge and undo buttons beside the selected time-slot range', () => {
    const rows = [
        createTimeEntry(0),
        createTimeEntry(1, { left: 100, top: 40, width: 80, height: 44 }),
        createTimeEntry(2),
        createTimeEntry(3),
    ];
    const ctx = {
        selectedPlannedFields: new Set([1, 2, 3]),
        mergeButton: { style: {}, classList: { contains: () => false } },
        undoButton: { style: {}, classList: { contains: (name) => name === 'undo-button' } },
    };

    withMockDocument(rows, () => {
        controller.repositionButtonsNextToSchedule.call(ctx);
    });

    assert.equal(ctx.mergeButton.style.left, '42px');
    assert.equal(ctx.mergeButton.style.top, '47px');
    assert.equal(ctx.undoButton.style.left, '64px');
    assert.equal(ctx.undoButton.style.top, '48px');
});

test('repositionButtonsNextToSchedule keeps hover undo near the merged time-slot range even without an active selection', () => {
    const rows = [
        createTimeEntry(0),
        createTimeEntry(1),
        createTimeEntry(2, { left: 120, top: 50, width: 80, height: 44 }),
        createTimeEntry(3),
    ];
    const ctx = {
        selectedPlannedFields: new Set(),
        activeUndoMergeKey: 'planned-2-3',
        undoButton: { style: {}, classList: { contains: (name) => name === 'undo-button' } },
    };

    withMockDocument(rows, () => {
        controller.repositionButtonsNextToSchedule.call(ctx);
    });

    assert.equal(ctx.undoButton.style.left, '84px');
    assert.equal(ctx.undoButton.style.top, '58px');
});
