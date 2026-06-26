const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

require('../controllers/controller-state-access');
const controller = require('../controllers/selection-overlay-controller');
const { buildMethod } = require('./helpers/script-method-builder');
const scriptSource = fs.readFileSync(path.join(__dirname, '..', 'script.js'), 'utf8');
const controllerSource = fs.readFileSync(path.join(__dirname, '..', 'controllers', 'selection-overlay-controller.js'), 'utf8');
const ensureSelectionOverlayWrapper = buildMethod('ensureSelectionOverlay(type)', '(type)');

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
    assert.match(scriptSource, /syncTimeSlotMergeSelectionState\(type\)\s*\{\s*return\s+globalThis\.TimeTrackerSelectionOverlayController\.syncTimeSlotMergeSelectionState\.call\(this,\s*type\);\s*\}/);
});

test('selection overlay writes merge visual state metadata for planned selections', () => {
    assert.match(controllerSource, /const selectionContext = type === 'planned'\s*\?\s*getPlannedSelectionContext\.call\(this, type\)\s*:\s*\{ exactExistingMerge: false \};[\s\S]*overlay\.dataset\.mergeVisualState/);
    assert.match(controllerSource, /overlay\.dataset\.mergeVisualState\s*=\s*selectionContext\.exactExistingMerge\s*\?\s*'existing'\s*:\s*\(selectedSet\.size > 1\s*\?\s*'candidate'\s*:\s*'single'\)/);
    assert.match(controllerSource, /delete el\.dataset\.mergeVisualState/);
});

test('planned overlay delegates pointer start to canonical merge selection and preserves action buttons', () => {
    assert.match(controllerSource, /beginPlannedTimeSlotMergeSelection/);
    assert.match(controllerSource, /\.schedule-button, \.undo-button, \.merge-button/);
    assert.match(controllerSource, /touchstart/);
    assert.match(controllerSource, /pointerdown/);
});

test('planned overlay starts at most once across pointerdown and mousedown', () => {
    const originalDocument = global.document;
    const calls = [];
    const listeners = {};
    const overlay = {
        dataset: {},
        style: {},
        parentNode: null,
        addEventListener(type, handler) {
            if (!listeners[type]) listeners[type] = [];
            listeners[type].push(handler);
        },
    };
    global.document = {
        createElement() {
            return overlay;
        },
        addEventListener(type, handler) {
            if (!listeners[type]) listeners[type] = [];
            listeners[type].push(handler);
        },
        removeEventListener(type, handler) {
            listeners[type] = (listeners[type] || []).filter((item) => item !== handler);
        },
        body: {
            appendChild(node) {
                node.parentNode = this;
            },
        },
    };
    const ctx = {
        beginPlannedTimeSlotMergeSelection(event) {
            calls.push(event.type);
            return true;
        },
        getSelectionOverlay() {
            return null;
        },
        setSelectionOverlay(type, node) {
            this._overlay = node;
            return node;
        },
    };

    try {
        const result = ensureSelectionOverlayWrapper.call(ctx, 'planned');
        assert.equal(result, overlay);
        listeners.pointerdown[0]({
            type: 'pointerdown',
            button: 0,
            target: { closest() { return null; } },
            preventDefault() {},
            stopPropagation() {},
            target: { closest() { return null; }, ownerDocument: global.document },
        });
        listeners.mousedown[0]({
            type: 'mousedown',
            button: 0,
            target: { closest() { return null; }, ownerDocument: global.document },
            preventDefault() {},
            stopPropagation() {},
        });
        assert.deepEqual(calls, ['pointerdown']);
    } finally {
        global.document = originalDocument;
    }
});

test('planned overlay buttons bypass gesture handling', () => {
    const originalDocument = global.document;
    const calls = [];
    const listeners = {};
    const overlay = {
        dataset: {},
        style: {},
        parentNode: null,
        addEventListener(type, handler) {
            if (!listeners[type]) listeners[type] = [];
            listeners[type].push(handler);
        },
    };
    global.document = {
        createElement() {
            return overlay;
        },
        addEventListener() {},
        removeEventListener() {},
        body: {
            appendChild(node) {
                node.parentNode = this;
            },
        },
    };
    const ctx = {
        beginPlannedTimeSlotMergeSelection(event) {
            calls.push(event.type);
            return true;
        },
        getSelectionOverlay() {
            return null;
        },
        setSelectionOverlay(type, node) {
            this._overlay = node;
            return node;
        },
    };

    try {
        ensureSelectionOverlayWrapper.call(ctx, 'planned');
        const buttonTarget = {
            closest(selector) {
                return selector.includes('.schedule-button') ? this : null;
            },
            ownerDocument: global.document,
        };
        listeners.mousedown[0]({
            type: 'mousedown',
            button: 0,
            target: buttonTarget,
            preventDefault() {},
            stopPropagation() {},
        });
        assert.deepEqual(calls, []);
    } finally {
        global.document = originalDocument;
    }
});

test('planned overlay touchstart forwards the touch point once', () => {
    const originalDocument = global.document;
    const calls = [];
    const listeners = {};
    const overlay = {
        dataset: {},
        style: {},
        parentNode: null,
        addEventListener(type, handler) {
            if (!listeners[type]) listeners[type] = [];
            listeners[type].push(handler);
        },
    };
    global.document = {
        createElement() {
            return overlay;
        },
        addEventListener() {},
        removeEventListener() {},
        body: {
            appendChild(node) {
                node.parentNode = this;
            },
        },
    };
    const ctx = {
        beginPlannedTimeSlotMergeSelection(event) {
            calls.push([event.type, event.touches && event.touches[0].clientX, event.touches && event.touches[0].clientY]);
            return true;
        },
        getSelectionOverlay() {
            return null;
        },
        setSelectionOverlay(type, node) {
            this._overlay = node;
            return node;
        },
    };

    try {
        ensureSelectionOverlayWrapper.call(ctx, 'planned');
        listeners.touchstart[0]({
            type: 'touchstart',
            touches: [{ clientX: 112, clientY: 223 }],
            target: { closest() { return null; }, ownerDocument: global.document },
            preventDefault() {},
            stopPropagation() {},
        });
        assert.deepEqual(calls, [['touchstart', 112, 223]]);
    } finally {
        global.document = originalDocument;
    }
});

test('updateSelectionOverlay does not throw when planned selection overlay refreshes', () => {
    const originalDocument = global.document;
    const originalWindow = global.window;
    const overlay = {
        dataset: {},
        style: {},
        parentNode: { removeChild() {} },
    };
    const rows = [
        {
            classList: { toggle() {}, add() {}, remove() {} },
            getAttribute(name) {
                return name === 'data-index' ? '1' : null;
            },
            querySelector(selector) {
                return selector === '.time-slot-container'
                    ? { classList: { add() {}, toggle() {} } }
                    : null;
            },
        },
        {
            classList: { toggle() {}, add() {}, remove() {} },
            getAttribute(name) {
                return name === 'data-index' ? '2' : null;
            },
            querySelector(selector) {
                return selector === '.time-slot-container'
                    ? { classList: { add() {}, toggle() {} } }
                    : null;
            },
        },
    ];
    global.document = {
        querySelectorAll(selector) {
            if (selector === '.time-entry[data-index]') return rows;
            return [];
        },
        querySelector(selector) {
            if (selector === '[data-index="1"] .planned-input') return { getBoundingClientRect() { return { left: 10, top: 20, width: 80, height: 44 }; }, closest() { return null; } };
            if (selector === '[data-index="2"] .planned-input') return { getBoundingClientRect() { return { left: 10, top: 64, width: 80, height: 44 }; }, closest() { return null; } };
            return null;
        },
        documentElement: { scrollLeft: 0, scrollTop: 0 },
        body: { appendChild() {} },
    };
    global.window = { scrollX: 0, scrollY: 0 };

    const ctx = {
        selectedPlannedFields: new Set([1, 2]),
        isSelectingPlanned: false,
        removeHoverSelectionOverlay() {},
        ensureSelectionOverlay() {
            return overlay;
        },
        getSelectionCellRect(type, index) {
            assert.equal(type, 'planned');
            return index === 1
                ? { left: 10, top: 20, width: 80, height: 44 }
                : { left: 10, top: 64, width: 80, height: 44 };
        },
        getPlannedRangeInfo(index) {
            return { startIndex: index, endIndex: index, mergeKey: null };
        },
        findMergeKey() {
            return null;
        },
        getMergeRangeBounds() {
            return null;
        },
        removeSelectionOverlay() {},
    };

    try {
        assert.doesNotThrow(() => {
            controller.updateSelectionOverlay.call(ctx, 'planned');
        });
        assert.equal(overlay.dataset.mergeVisualState, 'candidate');
    } finally {
        global.document = originalDocument;
        global.window = originalWindow;
    }
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

test('showScheduleButtonForSelection remains disabled in plan-only mode', () => {
    const originalDocument = global.document;
    const calls = [];
    global.document = {
        createElement() {
            throw new Error('schedule button should not be created');
        },
        querySelector() {
            throw new Error('schedule modal anchor should not be queried');
        },
    };
    const ctx = {
        selectedPlannedFields: new Set([0, 1]),
        scheduleButton: { parentNode: { removeChild() {} } },
        hideScheduleButton() {
            calls.push('hideScheduleButton');
            this.scheduleButton = null;
        },
        openInlinePlanDropdown() {
            calls.push('openInlinePlanDropdown');
        },
        openScheduleModal() {
            calls.push('openScheduleModal');
        },
    };

    try {
        const result = controller.showScheduleButtonForSelection.call(ctx, 'planned');

        assert.equal(result, false);
        assert.deepEqual(calls, ['hideScheduleButton']);
        assert.equal(ctx.scheduleButton, null);
    } finally {
        global.document = originalDocument;
    }
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

function createButtonNode() {
    const node = {
        style: {},
        className: '',
        textContent: '',
        parentNode: null,
        listeners: {},
        classList: {
            contains(name) {
                return String(node.className || '').split(/\s+/).includes(name);
            },
        },
        addEventListener(type, handler) {
            this.listeners[type] = handler;
        },
    };
    return node;
}

function withPlannedSelectionDocument(fn) {
    const originalDocument = global.document;
    const originalWindow = global.window;
    const appended = [];
    const body = {
        appendChild(node) {
            appended.push(node);
            node.parentNode = body;
        },
        removeChild(node) {
            node.parentNode = null;
        },
    };
    const rects = {
        planned5: { left: 110, top: 200, right: 310, bottom: 244, width: 200, height: 44 },
        planned6: { left: 110, top: 244, right: 310, bottom: 288, width: 200, height: 44 },
        time5: { left: 30, top: 200, right: 110, bottom: 244, width: 80, height: 44 },
    };
    const row6 = {
        getBoundingClientRect() {
            return { left: 30, top: 244, right: 310, bottom: 290, width: 280, height: 46 };
        },
    };
    const planned5 = {
        getBoundingClientRect() {
            return rects.planned5;
        },
        closest() {
            return null;
        },
    };
    const planned6 = {
        getBoundingClientRect() {
            return rects.planned6;
        },
        closest(selector) {
            return selector === '.time-entry' ? row6 : null;
        },
    };
    const time5 = {
        getBoundingClientRect() {
            return rects.time5;
        },
    };
    global.document = {
        querySelector(selector) {
            if (selector === '[data-index="5"] .planned-input') return planned5;
            if (selector === '[data-index="6"] .planned-input') return planned6;
            if (selector === '[data-index="5"] .time-slot-container') return time5;
            return null;
        },
        createElement() {
            return createButtonNode();
        },
        body,
        documentElement: { scrollLeft: 0, scrollTop: 0 },
    };
    global.window = { scrollX: 0, scrollY: 0 };

    try {
        return fn({ appended, rects });
    } finally {
        global.document = originalDocument;
        global.window = originalWindow;
    }
}

test('showMergeButton positions planned merge action inside the planned selection', () => {
    withPlannedSelectionDocument(({ rects }) => {
        const ctx = {
            selectedPlannedFields: new Set([5, 6]),
            selectedActualFields: new Set(),
            mergeButton: null,
            hideMergeButton() {
                return controller.hideMergeButton.call(this);
            },
            repositionButtonsNextToSchedule() {
                return controller.repositionButtonsNextToSchedule.call(this);
            },
            hideScheduleButton() {},
            mergeSelectedFields() {},
            getSelectionCellRect(type, index) {
                assert.equal(type, 'planned');
                return index === 5 ? rects.planned5 : rects.planned6;
            },
            findMergeKey() {
                return null;
            },
            getMergeRangeBounds() {
                return null;
            },
        };

        controller.showMergeButton.call(ctx, 'planned');

        assert.ok(ctx.mergeButton);
        const left = parseInt(ctx.mergeButton.style.left, 10);
        const top = parseInt(ctx.mergeButton.style.top, 10);
        assert.ok(left >= rects.planned5.left + 4, `left ${left} should stay inside planned rect`);
        assert.ok(left + 50 <= rects.planned5.right - 4, `right ${left + 50} should stay inside planned rect`);
        assert.ok(left > rects.time5.right, `left ${left} should be right of time column ${rects.time5.right}`);
        assert.ok(top >= rects.planned5.top);
        assert.ok(top + 30 <= 290);
    });
});

test('showUndoButton positions existing planned merge action inside the planned selection', () => {
    withPlannedSelectionDocument(({ rects }) => {
        const ctx = {
            selectedPlannedFields: new Set([5, 6]),
            selectedActualFields: new Set(),
            undoButton: null,
            timeSlots: Array.from({ length: 8 }, () => ({})),
            hideUndoButton() {
                return controller.hideUndoButton.call(this);
            },
            repositionButtonsNextToSchedule() {
                return controller.repositionButtonsNextToSchedule.call(this);
            },
            undoMerge() {},
            getSelectionCellRect(type, index) {
                assert.equal(type, 'planned');
                return index === 5 ? rects.planned5 : rects.planned6;
            },
            findMergeKey(type, index) {
                return type === 'planned' && (index === 5 || index === 6) ? 'planned-5-6' : null;
            },
            getMergeRangeBounds() {
                return { start: 5, end: 6 };
            },
        };

        controller.showUndoButton.call(ctx, 'planned', 'planned-5-6');

        assert.ok(ctx.undoButton);
        const left = parseInt(ctx.undoButton.style.left, 10);
        const top = parseInt(ctx.undoButton.style.top, 10);
        assert.ok(left >= rects.planned5.left + 4, `left ${left} should stay inside planned rect`);
        assert.ok(left + 28 <= rects.planned5.right - 4, `right ${left + 28} should stay inside planned rect`);
        assert.ok(left > rects.time5.right, `left ${left} should be right of time column ${rects.time5.right}`);
        assert.ok(top >= rects.planned5.top);
        assert.ok(top + 28 <= 290);
    });
});

test('repositionButtonsNextToSchedule keeps planned merge actions on planned range instead of time slot', () => {
    withPlannedSelectionDocument(({ rects }) => {
        const ctx = {
            selectedPlannedFields: new Set([5, 6]),
            selectedActualFields: new Set(),
            mergeButton: createButtonNode(),
            undoButton: createButtonNode(),
            activeUndoMergeKey: 'planned-5-6',
            getSelectionCellRect(type, index) {
                assert.equal(type, 'planned');
                return index === 5 ? rects.planned5 : rects.planned6;
            },
            findMergeKey(type, index) {
                return type === 'planned' && (index === 5 || index === 6) ? 'planned-5-6' : null;
            },
            getMergeRangeBounds() {
                return { start: 5, end: 6 };
            },
        };
        ctx.mergeButton.className = 'merge-button';
        ctx.undoButton.className = 'undo-button';

        controller.repositionButtonsNextToSchedule.call(ctx);

        const mergeLeft = parseInt(ctx.mergeButton.style.left, 10);
        const undoLeft = parseInt(ctx.undoButton.style.left, 10);
        assert.ok(mergeLeft > rects.time5.right);
        assert.ok(undoLeft > rects.time5.right);
        assert.ok(mergeLeft >= rects.planned5.left + 4);
        assert.ok(undoLeft >= rects.planned5.left + 4);
    });
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
