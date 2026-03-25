const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

require('../controllers/controller-state-access');
const controller = require('../controllers/selection-overlay-controller');
const scriptSource = fs.readFileSync(path.join(__dirname, '..', 'script.js'), 'utf8');

test('selection-overlay-controller exports and global attach are available', () => {
    assert.equal(globalThis.TimeTrackerSelectionOverlayController.selectFieldRange, controller.selectFieldRange);
    assert.equal(globalThis.TimeTrackerSelectionOverlayController.clearSelection, controller.clearSelection);
    assert.equal(globalThis.TimeTrackerSelectionOverlayController.selectMergedRange, controller.selectMergedRange);
    assert.equal(globalThis.TimeTrackerSelectionOverlayController.repositionButtonsNextToSchedule, controller.repositionButtonsNextToSchedule);
});

test('script selection wrapper methods delegate to controller helpers', () => {
    assert.match(scriptSource, /selectFieldRange\(type, startIndex, endIndex\)\s*\{\s*return\s+globalThis\.TimeTrackerSelectionOverlayController\.selectFieldRange\.call\(this,\s*type,\s*startIndex,\s*endIndex\);\s*\}/);
    assert.match(scriptSource, /clearSelection\(type\)\s*\{\s*return\s+globalThis\.TimeTrackerSelectionOverlayController\.clearSelection\.call\(this,\s*type\);\s*\}/);
    assert.match(scriptSource, /selectMergedRange\(type, mergeKey, opts = \{\}\)\s*\{\s*return\s+globalThis\.TimeTrackerSelectionOverlayController\.selectMergedRange\.call\(this,\s*type,\s*mergeKey,\s*opts\);\s*\}/);
    assert.match(scriptSource, /showUndoButton\(type, mergeKey\)\s*\{\s*return\s+globalThis\.TimeTrackerSelectionOverlayController\.showUndoButton\.call\(this,\s*type,\s*mergeKey\);\s*\}/);
});

test('clearSelection clears planned state and tears down floating UI', () => {
    const originalDocument = global.document;
    global.document = { querySelector: () => null };
    const calls = [];
    const ctx = {
        selectedPlannedFields: new Set([1, 2, 3]),
        selectedActualFields: new Set([4]),
        hideMergeButton() { calls.push('hideMergeButton'); },
        hideUndoButton() { calls.push('hideUndoButton'); },
        removeSelectionOverlay(type) { calls.push(['removeSelectionOverlay', type]); },
        hideScheduleButton() { calls.push('hideScheduleButton'); },
    };

    try {
        controller.clearSelection.call(ctx, 'planned');
    } finally {
        global.document = originalDocument;
    }

    assert.deepEqual(Array.from(ctx.selectedPlannedFields), []);
    assert.deepEqual(Array.from(ctx.selectedActualFields), [4]);
    assert.ok(calls.includes('hideMergeButton'));
    assert.ok(calls.includes('hideUndoButton'));
    assert.ok(calls.includes('hideScheduleButton'));
    assert.ok(calls.some((entry) => Array.isArray(entry) && entry[0] === 'removeSelectionOverlay' && entry[1] === 'planned'));
});

test('repositionButtonsNextToSchedule aligns merge and undo buttons next to the active schedule anchor', () => {
    const ctx = {
        scheduleButton: {
            getBoundingClientRect() {
                return { left: 20, top: 12, width: 28 };
            }
        },
        scheduleHoverButton: null,
        mergeButton: { style: {} },
        undoButton: { style: {} },
    };
    const originalWindow = global.window;
    global.window = { scrollX: 5, scrollY: 7 };

    try {
        controller.repositionButtonsNextToSchedule.call(ctx);
    } finally {
        global.window = originalWindow;
    }

    assert.equal(ctx.mergeButton.style.left, '61px');
    assert.equal(ctx.mergeButton.style.top, '19px');
    assert.equal(ctx.undoButton.style.left, '61px');
    assert.equal(ctx.undoButton.style.top, '19px');
});

test('repositionButtonsNextToSchedule can consume the shared schedule anchor surface', () => {
    const originalAccess = globalThis.TimeTrackerControllerStateAccess;
    const ctx = {
        scheduleButton: null,
        scheduleHoverButton: null,
        mergeButton: { style: {} },
        undoButton: { style: {} },
    };
    const anchor = {
        getBoundingClientRect() {
            return { left: 40, top: 22, width: 30 };
        }
    };
    const originalWindow = global.window;
    global.window = { scrollX: 3, scrollY: 4 };
    globalThis.TimeTrackerControllerStateAccess = {
        ...originalAccess,
        getScheduleAnchor() {
            return anchor;
        }
    };

    try {
        controller.repositionButtonsNextToSchedule.call(ctx);
    } finally {
        global.window = originalWindow;
        globalThis.TimeTrackerControllerStateAccess = originalAccess;
    }

    assert.equal(ctx.mergeButton.style.left, '81px');
    assert.equal(ctx.mergeButton.style.top, '26px');
    assert.equal(ctx.undoButton.style.left, '81px');
    assert.equal(ctx.undoButton.style.top, '26px');
});
