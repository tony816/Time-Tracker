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

test('showScheduleButtonOnHover creates and clears a hover button for a planned slot', () => {
    const originalDocument = global.document;
    const originalWindow = global.window;
    const created = [];
    const appended = [];
    const removed = [];
    const field = {
        getBoundingClientRect() {
            return { left: 100, top: 200, width: 80, height: 24 };
        },
    };
    const body = {
        appendChild(node) {
            appended.push(node);
            node.parentNode = body;
        },
        removeChild(node) {
            removed.push(node);
            node.parentNode = null;
        },
    };

    global.document = {
        querySelector(selector) {
            if (selector === '[data-index="3"] .planned-input') return field;
            if (selector === '[data-index="3"]') return { id: 'row-3' };
            return null;
        },
        createElement(tag) {
            const listeners = {};
            const node = {
                tagName: tag,
                style: {},
                className: '',
                textContent: '',
                title: '',
                attributes: {},
                parentNode: null,
                setAttribute(name, value) {
                    this.attributes[name] = value;
                },
                addEventListener(type, handler) {
                    listeners[type] = handler;
                },
                matches() {
                    return false;
                },
                get listeners() {
                    return listeners;
                },
            };
            created.push(node);
            return node;
        },
        body,
        documentElement: { scrollLeft: 0, scrollTop: 0 },
    };
    global.window = { scrollX: 10, scrollY: 20 };

    const calls = [];
    const ctx = {
        selectedPlannedFields: new Set(),
        selectedActualFields: new Set(),
        scheduleHoverButton: null,
        hoveredMergeKey: null,
        undoButton: null,
        hideHoverScheduleButton() {
            return controller.hideHoverScheduleButton.call(this);
        },
        findMergeKey() {
            return null;
        },
        isMergeRangeSelected() {
            return false;
        },
        removeHoverSelectionOverlay(type) {
            calls.push(['removeHoverSelectionOverlay', type]);
        },
        updateHoverSelectionOverlay(type, start, end) {
            calls.push(['updateHoverSelectionOverlay', type, start, end]);
        },
        showUndoButton(type, mergeKey) {
            calls.push(['showUndoButton', type, mergeKey]);
        },
        hideUndoButton() {
            calls.push(['hideUndoButton']);
        },
        repositionButtonsNextToSchedule() {
            calls.push(['repositionButtonsNextToSchedule']);
        },
        openInlinePlanDropdown(index, anchor, endIndex) {
            calls.push(['openInlinePlanDropdown', index, anchor, endIndex]);
        },
    };

    try {
        controller.showScheduleButtonOnHover.call(ctx, 3);

        assert.equal(created.length, 1);
        assert.equal(appended.length, 1);
        assert.equal(ctx.scheduleHoverButton, created[0]);
        assert.equal(created[0].style.left, '136px');
        assert.equal(created[0].style.top, '218px');
        assert.deepEqual(calls, [
            ['removeHoverSelectionOverlay', 'planned'],
            ['removeHoverSelectionOverlay', 'planned'],
            ['updateHoverSelectionOverlay', 'planned', 3, 3],
            ['hideUndoButton'],
            ['repositionButtonsNextToSchedule'],
        ]);

        controller.hideHoverScheduleButton.call(ctx);

        assert.equal(ctx.scheduleHoverButton, null);
        assert.equal(removed.length, 1);
        assert.deepEqual(calls.slice(-1)[0], ['removeHoverSelectionOverlay', 'planned']);
    } finally {
        global.document = originalDocument;
        global.window = originalWindow;
    }
});
