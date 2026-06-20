const test = require('node:test');
const assert = require('node:assert/strict');

const controller = require('../controllers/field-interaction-controller');
const { buildMethod } = require('./helpers/script-method-builder');

const handleMergedClickCaptureWrapper = buildMethod('handleMergedClickCapture(e)', '(e)');
const attachPlannedFieldSelectionListenersWrapper = buildMethod(
    'attachPlannedFieldSelectionListeners(entryDiv, index, plannedField)',
    '(entryDiv, index, plannedField)'
);
const attachTimeSlotMergeEntryListenersWrapper = buildMethod(
    'attachTimeSlotMergeEntryListeners(entryDiv, index)',
    '(entryDiv, index)'
);
const attachRowWideClickTargetsWrapper = buildMethod(
    'attachRowWideClickTargets(entryDiv, index)',
    '(entryDiv, index)'
);
const attachCellClickListenersWrapper = buildMethod(
    'attachCellClickListeners(entryDiv, index)',
    '(entryDiv, index)'
);

function createListenerNode() {
    const listeners = {};
    return {
        dataset: {},
        addEventListener(type, handler) {
            if (!listeners[type]) listeners[type] = [];
            listeners[type].push(handler);
        },
        dispatchEvent(event) {
            const handlers = listeners[event.type] || [];
            for (const handler of handlers) {
                handler(event);
                if (event.immediatePropagationStopped) break;
            }
        },
        closest() {
            return null;
        },
    };
}

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
    };
}

function createDocumentListenerHarness() {
    const listeners = {};
    return {
        addEventListener(type, handler) {
            if (!listeners[type]) listeners[type] = [];
            listeners[type].push(handler);
        },
        removeEventListener(type, handler) {
            listeners[type] = (listeners[type] || []).filter((item) => item !== handler);
        },
        dispatchEvent(event) {
            const handlers = listeners[event.type] || [];
            handlers.slice().forEach((handler) => handler(event));
        },
        listenerCount(type) {
            return (listeners[type] || []).length;
        },
    };
}

function withMockDocument(fn) {
    const originalDocument = global.document;
    global.document = createDocumentListenerHarness();
    try {
        return fn(global.document);
    } finally {
        global.document = originalDocument;
    }
}

test('field-interaction-controller exports and global attach are available', () => {
    assert.ok(controller);
    assert.equal(typeof controller.handleMergedClickCapture, 'function');
    assert.equal(typeof controller.attachPlannedFieldSelectionListeners, 'function');
    assert.equal(typeof controller.attachTimeSlotMergeEntryListeners, 'function');
    assert.equal(typeof controller.attachRowWideClickTargets, 'function');
    assert.equal(typeof controller.attachCellClickListeners, 'function');
    assert.equal(
        globalThis.TimeTrackerFieldInteractionController.handleMergedClickCapture,
        controller.handleMergedClickCapture
    );
    assert.equal(
        globalThis.TimeTrackerFieldInteractionController.attachPlannedFieldSelectionListeners,
        controller.attachPlannedFieldSelectionListeners
    );
    assert.equal(
        globalThis.TimeTrackerFieldInteractionController.attachTimeSlotMergeEntryListeners,
        controller.attachTimeSlotMergeEntryListeners
    );
    assert.equal(
        globalThis.TimeTrackerFieldInteractionController.attachRowWideClickTargets,
        controller.attachRowWideClickTargets
    );
    assert.equal(
        globalThis.TimeTrackerFieldInteractionController.attachCellClickListeners,
        controller.attachCellClickListeners
    );
});

test('script field interaction wrapper methods delegate to controller helpers', () => {
    const calls = [];
    const original = globalThis.TimeTrackerFieldInteractionController;
    globalThis.TimeTrackerFieldInteractionController = {
        handleMergedClickCapture(event) {
            calls.push(['merged', this, event]);
            return 'merged-result';
        },
        attachPlannedFieldSelectionListeners(entryDiv, index, plannedField) {
            calls.push(['planned', this, entryDiv, index, plannedField]);
            return 'planned-result';
        },
        attachTimeSlotMergeEntryListeners(entryDiv, index) {
            calls.push(['time-slot-merge', this, entryDiv, index]);
            return 'time-slot-merge-result';
        },
        attachRowWideClickTargets(entryDiv, index) {
            calls.push(['row', this, entryDiv, index]);
            return 'row-result';
        },
        attachCellClickListeners(entryDiv, index) {
            calls.push(['cell', this, entryDiv, index]);
            return 'cell-result';
        },
    };

    const ctx = { id: 'tracker' };
    const entryDiv = { id: 'row' };
    const plannedField = { id: 'planned' };
    const event = { type: 'click' };

    try {
        assert.equal(handleMergedClickCaptureWrapper.call(ctx, event), 'merged-result');
        assert.equal(
            attachPlannedFieldSelectionListenersWrapper.call(ctx, entryDiv, 4, plannedField),
            'planned-result'
        );
        assert.equal(attachTimeSlotMergeEntryListenersWrapper.call(ctx, entryDiv, 4), 'time-slot-merge-result');
        assert.equal(attachRowWideClickTargetsWrapper.call(ctx, entryDiv, 4), 'row-result');
        assert.equal(attachCellClickListenersWrapper.call(ctx, entryDiv, 4), 'cell-result');
    } finally {
        globalThis.TimeTrackerFieldInteractionController = original;
    }

    assert.deepEqual(calls, [
        ['merged', ctx, event],
        ['planned', ctx, entryDiv, 4, plannedField],
        ['time-slot-merge', ctx, entryDiv, 4],
        ['row', ctx, entryDiv, 4],
        ['cell', ctx, entryDiv, 4],
    ]);
});

test('attachCellClickListeners passes planned slot width to empty slot dropdowns', () => {
    const plannedField = createListenerNode();
    const wrapper = createListenerNode();
    wrapper.getBoundingClientRect = () => ({ width: 876 });
    plannedField.closest = (selector) => selector === '.split-cell-wrapper.split-type-planned' ? wrapper : null;
    const entryDiv = {
        querySelector(selector) {
            return selector === '.planned-input' ? plannedField : null;
        },
    };
    const calls = [];
    const ctx = {
        getPlannedRangeInfo(index) {
            assert.equal(index, 4);
            return { startIndex: 4, endIndex: 4 };
        },
        inlinePlanDropdown: null,
        isSameInlinePlanTarget() {
            return false;
        },
        openInlinePlanDropdown(startIndex, anchor, endIndex, options) {
            calls.push({ startIndex, anchor, endIndex, options });
        },
    };

    controller.attachCellClickListeners.call(ctx, entryDiv, 4);
    plannedField.dispatchEvent({
        type: 'click',
        preventDefault() {},
        stopPropagation() {},
    });

    assert.equal(calls.length, 1);
    assert.equal(calls[0].startIndex, 4);
    assert.equal(calls[0].anchor, wrapper);
    assert.equal(calls[0].endIndex, 4);
    assert.equal(calls[0].options.anchorMinWidth, 876);
    assert.equal(calls[0].options.sheetTargetEl, plannedField);
    assert.equal(calls[0].options.anchorAlign, undefined);
    assert.equal(calls[0].options.mode, undefined);
});

test('move mode prevents inline plan dropdown open', () => {
    const plannedField = createListenerNode();
    plannedField.closest = () => null;
    const entryDiv = {
        querySelector(selector) {
            return selector === '.planned-input' ? plannedField : null;
        },
    };
    const calls = [];
    const ctx = {
        isPlannedSlotMoveMode() {
            return true;
        },
        getPlannedRangeInfo() {
            calls.push(['range']);
            return { startIndex: 1, endIndex: 1 };
        },
        openInlinePlanDropdown() {
            calls.push(['open']);
        },
    };

    controller.attachCellClickListeners.call(ctx, entryDiv, 1);
    plannedField.dispatchEvent({
        type: 'click',
        preventDefault() {
            calls.push(['prevent']);
        },
        stopPropagation() {
            calls.push(['stop']);
        },
    });

    assert.deepEqual(calls, [['prevent'], ['stop']]);
});

test('move mode prevents time-slot merge selection', () => {
    const timeSlot = createListenerNode();
    const entryDiv = {
        querySelector(selector) {
            return selector === '.time-slot-container' ? timeSlot : null;
        },
    };
    const calls = [];
    const ctx = {
        isPlannedSlotMoveMode() {
            return true;
        },
        findMergeKey() {
            calls.push(['find']);
            return null;
        },
        closeInlinePlanDropdown() {
            calls.push(['close']);
        },
        selectFieldRange() {
            calls.push(['select']);
        },
    };

    controller.attachTimeSlotMergeEntryListeners.call(ctx, entryDiv, 2);
    timeSlot.dispatchEvent({
        type: 'mousedown',
        button: 0,
        target: timeSlot,
        preventDefault() {
            calls.push(['prevent']);
        },
        stopPropagation() {
            calls.push(['stop']);
        },
    });

    assert.deepEqual(calls, []);
});

test('attachTimeSlotMergeEntryListeners toggles merge-hover on the row and clears it after selection reset', () => {
    const listeners = {};
    const timeSlot = {
        classList: createClassList(['time-slot-container']),
        addEventListener(type, handler) {
            if (!listeners[type]) listeners[type] = [];
            listeners[type].push(handler);
        },
        dispatchEvent(event) {
            const handlers = listeners[event.type] || [];
            handlers.forEach((handler) => handler(event));
        },
        closest(selector) {
            if (selector === '.time-slot-container') return timeSlot;
            if (selector === '.time-entry') return entryDiv;
            return null;
        },
    };
    const entryDiv = {
        classList: createClassList(['time-entry']),
        querySelector(selector) {
            return selector === '.time-slot-container' ? timeSlot : null;
        },
    };
    const calls = [];
    const ctx = {
        currentColumnType: null,
        isSelectingPlanned: false,
        pendingMergedMouseSelection: null,
        dragStartIndex: -1,
        dragBaseEndIndex: -1,
        findMergeKey() {
            return null;
        },
        getMergeRangeBounds() {
            return null;
        },
        closeInlinePlanDropdown() {
            calls.push('closeInlinePlanDropdown');
        },
        clearSelection(type) {
            calls.push(['clearSelection', type]);
        },
        selectFieldRange(type, startIndex, endIndex) {
            calls.push(['selectFieldRange', type, startIndex, endIndex]);
        },
        clearAllSelections() {
            calls.push('clearAllSelections');
        },
        selectMergedRange(type, mergeKey, opts) {
            calls.push(['selectMergedRange', type, mergeKey, opts]);
        },
        getIndexAtClientPosition() {
            return 3;
        },
    };
    const doc = createDocumentListenerHarness();
    const originalDocument = global.document;
    global.document = doc;

    try {
        controller.attachTimeSlotMergeEntryListeners.call(ctx, entryDiv, 3);

        timeSlot.dispatchEvent({ type: 'mouseenter' });
        assert.equal(entryDiv.classList.contains('merge-hover'), true);

        timeSlot.dispatchEvent({
            type: 'mousedown',
            button: 0,
            target: timeSlot,
            preventDefault() {},
            stopPropagation() {},
        });
        assert.equal(entryDiv.classList.contains('merge-hover'), true);
        assert.equal(ctx.isSelectingPlanned, true);

        doc.dispatchEvent({
            type: 'mouseup',
            preventDefault() {},
            stopPropagation() {},
        });

        assert.equal(entryDiv.classList.contains('merge-hover'), false);
        assert.equal(ctx.isSelectingPlanned, false);
        assert.equal(ctx.currentColumnType, null);
        assert.ok(calls.some((entry) => Array.isArray(entry) && entry[0] === 'selectFieldRange'));
    } finally {
        global.document = originalDocument;
    }
});

test('attachCellClickListeners pre-scrolls mobile empty planned slots before opening dropdown', () => {
    const previousWindow = global.window;
    const plannedField = createListenerNode();
    const wrapper = createListenerNode();
    wrapper.getBoundingClientRect = () => ({ width: 640 });
    plannedField.closest = (selector) => selector === '.split-cell-wrapper.split-type-planned' ? wrapper : null;
    const entryDiv = {
        querySelector(selector) {
            return selector === '.planned-input' ? plannedField : null;
        },
    };
    const rafCalls = [];
    const calls = [];
    const ctx = {
        getPlannedRangeInfo() {
            return { startIndex: 4, endIndex: 4 };
        },
        inlinePlanDropdown: null,
        isSameInlinePlanTarget() {
            return false;
        },
        closeInlinePlanDropdown() {
            calls.push(['close']);
        },
        preparePlannedSlotReplacementViewport(targetEl) {
            calls.push(['prepare', targetEl]);
            return true;
        },
        openInlinePlanDropdown(startIndex, anchor, endIndex, options) {
            calls.push(['open', startIndex, anchor, endIndex, options]);
        },
    };

    global.window = {
        requestAnimationFrame(callback) {
            rafCalls.push(callback);
        },
    };

    try {
        controller.attachCellClickListeners.call(ctx, entryDiv, 4);
        plannedField.dispatchEvent({
            type: 'click',
            preventDefault() {},
            stopPropagation() {},
        });

        assert.deepEqual(calls, [['prepare', wrapper]]);
        assert.equal(rafCalls.length, 1);

        rafCalls[0]();
        assert.equal(rafCalls.length, 2);
        rafCalls[1]();

        assert.equal(calls.length, 2);
        assert.equal(calls[1][0], 'open');
        assert.equal(calls[1][1], 4);
        assert.equal(calls[1][2], wrapper);
        assert.equal(calls[1][3], 4);
        assert.equal(calls[1][4].anchorMinWidth, 640);
        assert.equal(calls[1][4].sheetTargetEl, plannedField);
    } finally {
        if (previousWindow === undefined) {
            delete global.window;
        } else {
            global.window = previousWindow;
        }
    }
});

test('attachCellClickListeners keeps an open mobile sheet on same empty slot retap', () => {
    const plannedField = createListenerNode();
    plannedField.closest = () => null;
    const entryDiv = {
        querySelector(selector) {
            return selector === '.planned-input' ? plannedField : null;
        },
    };
    const calls = [];
    const ctx = {
        inlinePlanDropdown: {
            classList: {
                contains(className) {
                    return className === 'inline-plan-dropdown-sheet';
                },
            },
        },
        getPlannedRangeInfo() {
            return { startIndex: 4, endIndex: 4 };
        },
        isSameInlinePlanTarget() {
            return true;
        },
        isInlinePlanMobileInputContext() {
            return true;
        },
        scheduleInlinePlanSheetTargetViewportCorrection(targetEl) {
            calls.push(['sync', targetEl]);
        },
        clearSelection() {
            calls.push(['clear']);
        },
        closeInlinePlanDropdown() {
            calls.push(['close']);
        },
    };
    const event = {
        type: 'click',
        preventDefault() {
            calls.push(['prevent']);
        },
        stopPropagation() {
            calls.push(['stop']);
        },
    };

    controller.attachCellClickListeners.call(ctx, entryDiv, 4);
    plannedField.dispatchEvent(event);

    assert.deepEqual(calls, [
        ['prevent'],
        ['stop'],
        ['sync', plannedField],
    ]);
});

test('merged secondary retap keeps mobile sheet synced to the tapped row target', () => {
    const originalDocument = globalThis.document;
    const baseAnchor = createListenerNode();
    const secondaryField = createListenerNode();
    secondaryField.dataset.index = '1';
    secondaryField.closest = (selector) => selector === '.planned-input' ? secondaryField : null;
    const calls = [];
    const ctx = {
        inlinePlanDropdown: {
            classList: {
                contains(className) {
                    return className === 'inline-plan-dropdown-sheet';
                },
            },
        },
        suppressInlinePlanClickOnce: null,
        getPlannedRangeInfo(index) {
            assert.equal(index, 1);
            return { startIndex: 0, endIndex: 2, mergeKey: 'planned-0-2' };
        },
        resolvePlannedSlotContext(index) {
            assert.equal(index, 1);
            return {
                clickedIndex: 1,
                baseIndex: 0,
                rangeStart: 0,
                rangeEnd: 2,
                mergeKey: 'planned-0-2',
                isMerged: true,
                slotCount: 3,
                blockMinutes: 180,
            };
        },
        isSameInlinePlanTarget(range) {
            assert.deepEqual(range, { startIndex: 0, endIndex: 2, mergeKey: 'planned-0-2' });
            return true;
        },
        isInlinePlanMobileInputContext() {
            return true;
        },
        scheduleInlinePlanSheetTargetViewportCorrection(targetEl) {
            calls.push(['sync', targetEl]);
        },
        clearSelection() {
            calls.push(['clear']);
        },
        closeInlinePlanDropdown() {
            calls.push(['close']);
        },
    };

    globalThis.document = {
        querySelector(selector) {
            if (selector === '[data-index="0"] .planned-merged-main-container') return baseAnchor;
            return null;
        },
    };

    try {
        controller.handleMergedClickCapture.call(ctx, {
            type: 'click',
            target: secondaryField,
            preventDefault() {
                calls.push(['prevent']);
            },
            stopPropagation() {
                calls.push(['stop']);
            },
        });
    } finally {
        globalThis.document = originalDocument;
    }

    assert.deepEqual(calls, [
        ['prevent'],
        ['stop'],
        ['sync', secondaryField],
    ]);
});

test('planned mousedown retap keeps open mobile inline plan sheet', () => {
    const plannedField = createListenerNode();
    plannedField.closest = () => null;
    plannedField.matches = () => false;
    const entryDiv = {
        querySelector(selector) {
            return selector === '.planned-input' ? plannedField : null;
        },
    };
    const calls = [];
    const ctx = {
        inlinePlanDropdown: {
            classList: {
                contains(className) {
                    return className === 'inline-plan-dropdown-sheet';
                },
            },
        },
        currentColumnType: null,
        selectedPlannedFields: new Set(),
        suppressInlinePlanClickOnce: null,
        getPlannedRangeInfo(index) {
            assert.equal(index, 4);
            return { startIndex: 4, endIndex: 4 };
        },
        isSameInlinePlanTarget(range) {
            assert.deepEqual(range, { startIndex: 4, endIndex: 4 });
            return true;
        },
        isInlinePlanMobileInputContext() {
            return true;
        },
        findMergeKey() {
            return null;
        },
        scheduleInlinePlanSheetTargetViewportCorrection(targetEl) {
            calls.push(['sync', targetEl]);
        },
        clearSelection(type) {
            calls.push(['clear', type]);
        },
        closeInlinePlanDropdown() {
            calls.push(['close']);
        },
        openInlinePlanDropdown() {
            calls.push(['open']);
        },
    };
    const makeEvent = (type) => ({
        type,
        target: plannedField,
        ctrlKey: false,
        metaKey: false,
        preventDefault() {
            calls.push(['prevent', type]);
        },
        stopPropagation() {
            calls.push(['stop', type]);
        },
    });

    controller.attachPlannedFieldSelectionListeners.call(ctx, entryDiv, 4, plannedField);
    controller.attachCellClickListeners.call(ctx, entryDiv, 4);
    plannedField.dispatchEvent(makeEvent('mousedown'));
    plannedField.dispatchEvent(makeEvent('mouseup'));
    plannedField.dispatchEvent(makeEvent('click'));

    assert.equal(calls.some((call) => call[0] === 'close'), false);
    assert.equal(calls.some((call) => call[0] === 'open'), false);
    assert.ok(calls.some((call) => call[0] === 'sync' && call[1] === plannedField));
    assert.ok(calls.some((call) => call[0] === 'prevent' && call[1] === 'mousedown'));
    assert.ok(calls.some((call) => call[0] === 'stop' && call[1] === 'mousedown'));
    assert.equal(ctx.suppressInlinePlanClickOnce, null);
});

test('selected planned retap closes an open mobile inline plan sheet and clears selection', () => {
    const plannedField = createListenerNode();
    const calls = [];
    plannedField.dataset.index = '4';
    plannedField.matches = (selector) => selector === '.planned-input';
    plannedField.classList = {
        contains(className) {
            return className === 'planned-input';
        },
        add() {},
        remove() {},
    };
    plannedField.closest = () => null;
    plannedField.blur = () => {
        calls.push(['blur']);
    };
    const entryDiv = {
        querySelector(selector) {
            return selector === '.planned-input' ? plannedField : null;
        },
    };
    const ctx = {
        inlinePlanDropdown: {
            classList: {
                contains(className) {
                    return className === 'inline-plan-dropdown-sheet';
                },
            },
        },
        selectedPlannedFields: new Set([4]),
        suppressInlinePlanClickOnce: null,
        getPlannedRangeInfo(index) {
            assert.equal(index, 4);
            return { startIndex: 4, endIndex: 4, mergeKey: null };
        },
        isSameInlinePlanTarget(range) {
            assert.deepEqual(range, { startIndex: 4, endIndex: 4, mergeKey: null });
            return true;
        },
        isInlinePlanMobileInputContext() {
            return true;
        },
        findMergeKey() {
            return null;
        },
        scheduleInlinePlanSheetTargetViewportCorrection(targetEl) {
            calls.push(['sync', targetEl]);
        },
        clearSelection(type) {
            calls.push(['clear', type]);
            this.selectedPlannedFields.clear();
        },
        closeInlinePlanDropdown() {
            calls.push(['close']);
            this.inlinePlanDropdown = null;
        },
        openInlinePlanDropdown() {
            calls.push(['open']);
        },
    };
    const makeEvent = (type) => ({
        type,
        target: plannedField,
        ctrlKey: false,
        metaKey: false,
        preventDefault() {
            calls.push(['prevent', type]);
        },
        stopPropagation() {
            calls.push(['stop', type]);
        },
        stopImmediatePropagation() {
            calls.push(['stopImmediate', type]);
            this.immediatePropagationStopped = true;
        },
    });

    controller.attachPlannedFieldSelectionListeners.call(ctx, entryDiv, 4, plannedField);
    controller.attachCellClickListeners.call(ctx, entryDiv, 4);
    plannedField.dispatchEvent(makeEvent('mousedown'));
    plannedField.dispatchEvent(makeEvent('click'));

    assert.deepEqual(calls, [
        ['close'],
        ['clear', 'planned'],
        ['blur'],
        ['prevent', 'mousedown'],
        ['stop', 'mousedown'],
        ['stopImmediate', 'mousedown'],
        ['prevent', 'click'],
        ['stop', 'click'],
    ]);
    assert.deepEqual(Array.from(ctx.selectedPlannedFields), []);
    assert.equal(ctx.suppressInlinePlanClickOnce, null);
    assert.equal(calls.some((call) => call[0] === 'sync'), false);
    assert.equal(calls.some((call) => call[0] === 'open'), false);
});

test('planned field retap clears an already selected single planned slot', () => {
    const plannedField = createListenerNode();
    plannedField.dataset.index = '4';
    plannedField.matches = (selector) => selector === '.planned-input';
    plannedField.classList = {
        contains(className) {
            return className === 'planned-input';
        },
    };
    plannedField.closest = () => null;
    const entryDiv = {
        querySelector(selector) {
            return selector === '.planned-input' ? plannedField : null;
        },
    };
    const calls = [];
    plannedField.blur = () => {
        calls.push(['blur']);
    };
    const ctx = {
        selectedPlannedFields: new Set([4]),
        suppressInlinePlanClickOnce: null,
        getPlannedRangeInfo(index) {
            assert.equal(index, 4);
            return { startIndex: 4, endIndex: 4, mergeKey: null };
        },
        inlinePlanDropdown: null,
        isSameInlinePlanTarget() {
            return false;
        },
        findMergeKey() {
            return null;
        },
        clearSelection(type) {
            calls.push(['clear', type]);
            this.selectedPlannedFields.clear();
        },
        closeInlinePlanDropdown() {
            calls.push(['close']);
        },
    };

    controller.attachPlannedFieldSelectionListeners.call(ctx, entryDiv, 4, plannedField);
    plannedField.dispatchEvent({
        type: 'mousedown',
        target: plannedField,
        ctrlKey: false,
        metaKey: false,
        preventDefault() {
            calls.push(['prevent']);
        },
        stopPropagation() {
            calls.push(['stop']);
        },
    });

    assert.deepEqual(calls, [
        ['prevent'],
        ['stop'],
        ['clear', 'planned'],
        ['blur'],
    ]);
    assert.deepEqual(Array.from(ctx.selectedPlannedFields), []);
    assert.equal(ctx.suppressInlinePlanClickOnce, 4);
});

test('merged planned field retap clears an already selected merged planned range', () => {
    const plannedField = createListenerNode();
    plannedField.dataset.index = '2';
    plannedField.matches = (selector) => selector === '.planned-input';
    plannedField.classList = {
        contains(className) {
            return className === 'planned-input';
        },
    };
    plannedField.closest = () => null;
    const entryDiv = {
        querySelector(selector) {
            return selector === '.planned-input' ? plannedField : null;
        },
    };
    const calls = [];
    plannedField.blur = () => {
        calls.push(['blur']);
    };
    const ctx = {
        selectedPlannedFields: new Set([1, 2, 3]),
        suppressInlinePlanClickOnce: null,
        getPlannedRangeInfo(index) {
            assert.equal(index, 2);
            return { startIndex: 1, endIndex: 3, mergeKey: 'planned-1-3' };
        },
        inlinePlanDropdown: null,
        isSameInlinePlanTarget() {
            return false;
        },
        findMergeKey(type, rowIndex) {
            return type === 'planned' && rowIndex >= 1 && rowIndex <= 3 ? 'planned-1-3' : null;
        },
        clearSelection(type) {
            calls.push(['clear', type]);
            this.selectedPlannedFields.clear();
        },
        closeInlinePlanDropdown() {
            calls.push(['close']);
        },
    };

    controller.attachPlannedFieldSelectionListeners.call(ctx, entryDiv, 2, plannedField);
    plannedField.dispatchEvent({
        type: 'mousedown',
        target: plannedField,
        ctrlKey: false,
        metaKey: false,
        preventDefault() {
            calls.push(['prevent']);
        },
        stopPropagation() {
            calls.push(['stop']);
        },
    });

    assert.deepEqual(calls, [
        ['clear', 'planned'],
        ['blur'],
        ['prevent'],
        ['stop'],
    ]);
    assert.deepEqual(Array.from(ctx.selectedPlannedFields), []);
    assert.equal(ctx.suppressInlinePlanClickOnce, 2);
});

test('mobile planned click retap clears an already selected single planned slot', () => {
    const plannedField = createListenerNode();
    plannedField.dataset.index = '4';
    plannedField.matches = (selector) => selector === '.planned-input';
    plannedField.classList = {
        contains(className) {
            return className === 'planned-input';
        },
        add() {},
        remove() {},
    };
    plannedField.closest = () => null;
    plannedField.blur = () => {
        calls.push(['blur']);
    };
    const entryDiv = {
        querySelector(selector) {
            return selector === '.planned-input' ? plannedField : null;
        },
    };
    const ctx = {
        selectedPlannedFields: new Set([4]),
        suppressInlinePlanClickOnce: null,
        inlinePlanDropdown: null,
        getPlannedRangeInfo(index) {
            assert.equal(index, 4);
            return { startIndex: 4, endIndex: 4, mergeKey: null };
        },
        isSameInlinePlanTarget() {
            return false;
        },
        clearSelection(type) {
            calls.push(['clear', type]);
            this.selectedPlannedFields.clear();
        },
        closeInlinePlanDropdown() {
            calls.push(['close']);
        },
        openInlinePlanDropdown() {
            calls.push(['open']);
        },
    };

    controller.attachCellClickListeners.call(ctx, entryDiv, 4);
    plannedField.dispatchEvent({
        type: 'click',
        target: plannedField,
        preventDefault() {
            calls.push(['prevent']);
        },
        stopPropagation() {
            calls.push(['stop']);
        },
    });

    assert.deepEqual(calls, [
        ['clear', 'planned'],
        ['blur'],
        ['prevent'],
        ['stop'],
    ]);
    assert.deepEqual(Array.from(ctx.selectedPlannedFields), []);
    assert.equal(calls.some((call) => call[0] === 'open'), false);
});

test('merged planned click capture no longer starts merge selection from planned field target', () => {
    const wrapper = createListenerNode();
    wrapper.getBoundingClientRect = () => ({ width: 520 });
    const plannedField = createListenerNode();
    plannedField.dataset.index = '14';
    plannedField.getAttribute = (name) => name === 'data-merge-key' ? 'planned-8-14' : null;
    plannedField.closest = (selector) => {
        if (selector === '.planned-input') return plannedField;
        if (selector === '.planned-input[data-merge-key]') return plannedField;
        if (selector === '.split-cell-wrapper.split-type-planned') return wrapper;
        return null;
    };
    const calls = [];
    const ctx = {
        inlinePlanDropdown: null,
        pendingMergedMouseSelection: { id: 'pending' },
        getPlannedRangeInfo() {
            return { startIndex: 8, endIndex: 14, mergeKey: 'planned-8-14' };
        },
        activateMergedPlannedSelection(mergeKey, index) {
            calls.push(['activate', mergeKey, index]);
            return { start: 8, end: 14 };
        },
        preparePlannedSlotReplacementViewport(targetEl) {
            calls.push(['prepare', targetEl]);
            return false;
        },
        openInlinePlanDropdown(startIndex, anchor, endIndex, options) {
            calls.push(['open', startIndex, anchor, endIndex, options]);
        },
    };
    const event = {
        type: 'click',
        target: plannedField,
        preventDefault() {
            calls.push(['prevent']);
        },
        stopPropagation() {
            calls.push(['stop']);
        },
    };

    controller.handleMergedClickCapture.call(ctx, event);

    assert.equal(calls.some((call) => call[0] === 'activate'), false);
    assert.equal(calls.some((call) => call[0] === 'open'), false);
    assert.equal(calls.some((call) => call[0] === 'prevent'), false);
    assert.equal(calls.some((call) => call[0] === 'stop'), false);
});

test('merged planned secondary click no longer starts merge selection from planned field target', () => {
    const originalDocument = globalThis.document;
    const baseAnchor = createListenerNode();
    baseAnchor.getBoundingClientRect = () => ({ width: 640 });
    const secondaryField = createListenerNode();
    secondaryField.dataset.index = '1';
    secondaryField.getAttribute = (name) => name === 'data-merge-key' ? 'planned-0-1' : null;
    secondaryField.closest = (selector) => {
        if (selector === '.planned-input') return secondaryField;
        if (selector === '.planned-input[data-merge-key]') return secondaryField;
        if (selector === '.split-cell-wrapper.split-type-planned') return null;
        return null;
    };
    const calls = [];
    const ctx = {
        inlinePlanDropdown: null,
        pendingMergedMouseSelection: null,
        resolvePlannedSlotContext(index) {
            assert.ok(index === 0 || index === 1);
            return {
                clickedIndex: index,
                baseIndex: 0,
                rangeStart: 0,
                rangeEnd: 1,
                mergeKey: 'planned-0-1',
                isMerged: true,
                slotCount: 2,
                blockMinutes: 120,
            };
        },
        getPlannedRangeInfo() {
            return {
                startIndex: 0,
                endIndex: 1,
                baseIndex: 0,
                rangeStart: 0,
                rangeEnd: 1,
                mergeKey: 'planned-0-1',
                blockMinutes: 120,
            };
        },
        activateMergedPlannedSelection(mergeKey, index) {
            calls.push(['activate', mergeKey, index]);
            return { start: 0, end: 1 };
        },
        preparePlannedSlotReplacementViewport(targetEl) {
            calls.push(['prepare', targetEl]);
            return false;
        },
        openInlinePlanDropdown(startIndex, anchor, endIndex, options) {
            calls.push(['open', startIndex, anchor, endIndex, options]);
        },
    };

    globalThis.document = {
        querySelector(selector) {
            if (selector === '[data-index="0"] .planned-merged-main-container') return baseAnchor;
            return null;
        },
    };

    try {
        controller.handleMergedClickCapture.call(ctx, {
            type: 'click',
            target: secondaryField,
            preventDefault() {
                calls.push(['prevent']);
            },
            stopPropagation() {
                calls.push(['stop']);
            },
        });
    } finally {
        globalThis.document = originalDocument;
    }

    assert.equal(calls.some((call) => call[0] === 'activate'), false);
    assert.equal(calls.some((call) => call[0] === 'prepare'), false);
    assert.equal(calls.some((call) => call[0] === 'open'), false);
});

test('attachCellClickListeners keeps desktop empty planned slot open immediate when no pre-scroll occurs', () => {
    const plannedField = createListenerNode();
    const wrapper = createListenerNode();
    wrapper.getBoundingClientRect = () => ({ width: 420 });
    plannedField.closest = (selector) => selector === '.split-cell-wrapper.split-type-planned' ? wrapper : null;
    const entryDiv = {
        querySelector(selector) {
            return selector === '.planned-input' ? plannedField : null;
        },
    };
    const calls = [];
    const ctx = {
        getPlannedRangeInfo() {
            return { startIndex: 4, endIndex: 4 };
        },
        inlinePlanDropdown: null,
        isSameInlinePlanTarget() {
            return false;
        },
        preparePlannedSlotReplacementViewport(targetEl) {
            calls.push(['prepare', targetEl]);
            return false;
        },
        openInlinePlanDropdown(startIndex, anchor, endIndex, options) {
            calls.push(['open', startIndex, anchor, endIndex, options]);
        },
    };

    controller.attachCellClickListeners.call(ctx, entryDiv, 4);
    plannedField.dispatchEvent({
        type: 'click',
        preventDefault() {},
        stopPropagation() {},
    });

    assert.equal(calls.length, 2);
    assert.deepEqual(calls[0], ['prepare', wrapper]);
    assert.equal(calls[1][0], 'open');
    assert.equal(calls[1][2], wrapper);
    assert.equal(calls[1][4].sheetTargetEl, plannedField);
});

test('time-slot merge entry selects planned range through existing selection rules', () => {
    const timeSlot = createListenerNode();
    timeSlot.closest = () => null;
    const entryDiv = {
        querySelector(selector) {
            return selector === '.time-slot-container' ? timeSlot : null;
        },
    };
    const calls = [];
    const ctx = {
        currentColumnType: null,
        isSelectingPlanned: false,
        dragStartIndex: -1,
        dragBaseEndIndex: -1,
        findMergeKey(type, index) {
            assert.equal(type, 'planned');
            assert.equal(index, 2);
            return null;
        },
        closeInlinePlanDropdown() {
            calls.push(['close']);
        },
        clearSelection(type) {
            calls.push(['clear', type]);
        },
        selectFieldRange(type, start, end) {
            calls.push(['select', type, start, end]);
        },
    };
    const event = {
        type: 'mousedown',
        button: 0,
        target: timeSlot,
        ctrlKey: false,
        metaKey: false,
        preventDefault() {
            calls.push(['prevent']);
        },
        stopPropagation() {
            calls.push(['stop']);
        },
    };

    controller.attachTimeSlotMergeEntryListeners.call(ctx, entryDiv, 2);
    timeSlot.dispatchEvent(event);

    assert.deepEqual(calls, [
        ['close'],
        ['clear', 'planned'],
        ['select', 'planned', 2, 2],
        ['prevent'],
        ['stop'],
    ]);
    assert.equal(ctx.currentColumnType, 'planned');
    assert.equal(ctx.isSelectingPlanned, true);
    assert.equal(ctx.dragStartIndex, 2);
    assert.equal(ctx.dragBaseEndIndex, 2);
});

test('time-slot merge entry expands an existing planned merge range and shows undo path', () => {
    const timeSlot = createListenerNode();
    timeSlot.closest = () => null;
    const entryDiv = {
        querySelector(selector) {
            return selector === '.time-slot-container' ? timeSlot : null;
        },
    };
    const calls = [];
    const ctx = {
        findMergeKey(type, index) {
            return type === 'planned' && index === 3 ? 'planned-1-3' : null;
        },
        getMergeRangeBounds(mergeKey, fallbackIndex) {
            calls.push(['bounds', mergeKey, fallbackIndex]);
            return { start: 1, end: 3 };
        },
        closeInlinePlanDropdown() {
            calls.push(['close']);
        },
        clearAllSelections() {
            calls.push(['clearAll']);
        },
        selectMergedRange(type, mergeKey, options) {
            calls.push(['selectMerged', type, mergeKey, options]);
        },
    };

    controller.attachTimeSlotMergeEntryListeners.call(ctx, entryDiv, 3);
    timeSlot.dispatchEvent({
        type: 'mousedown',
        button: 0,
        target: timeSlot,
        preventDefault() {},
        stopPropagation() {},
    });

    assert.deepEqual(calls, [
        ['bounds', 'planned-1-3', 3],
        ['close'],
        ['clearAll'],
        ['selectMerged', 'planned', 'planned-1-3', { append: false }],
    ]);
});

test('time-slot merge entry retap clears an already selected single slot', () => {
    const timeSlot = createListenerNode();
    timeSlot.closest = () => null;
    const entryDiv = {
        querySelector(selector) {
            return selector === '.time-slot-container' ? timeSlot : null;
        },
    };
    const calls = [];
    const ctx = {
        currentColumnType: null,
        isSelectingPlanned: false,
        dragStartIndex: -1,
        dragBaseEndIndex: -1,
        selectedPlannedFields: new Set([2]),
        findMergeKey() {
            return null;
        },
        closeInlinePlanDropdown() {
            calls.push(['close']);
        },
        clearSelection(type) {
            calls.push(['clear', type]);
            this.selectedPlannedFields.clear();
        },
        selectFieldRange(type, start, end) {
            calls.push(['select', type, start, end]);
        },
    };

    controller.attachTimeSlotMergeEntryListeners.call(ctx, entryDiv, 2);
    timeSlot.dispatchEvent({
        type: 'mousedown',
        button: 0,
        target: timeSlot,
        ctrlKey: false,
        metaKey: false,
        preventDefault() {
            calls.push(['prevent']);
        },
        stopPropagation() {
            calls.push(['stop']);
        },
    });

    assert.deepEqual(calls, [
        ['close'],
        ['clear', 'planned'],
        ['prevent'],
        ['stop'],
    ]);
    assert.deepEqual(Array.from(ctx.selectedPlannedFields), []);
    assert.equal(ctx.isSelectingPlanned, false);
    assert.equal(ctx.currentColumnType, null);
    assert.equal(ctx.dragStartIndex, -1);
    assert.equal(ctx.dragBaseEndIndex, -1);
});

test('merged time-slot entry retap clears an already selected merged range', () => {
    const timeSlot = createListenerNode();
    timeSlot.closest = () => null;
    const entryDiv = {
        querySelector(selector) {
            return selector === '.time-slot-container' ? timeSlot : null;
        },
    };
    const calls = [];
    const ctx = {
        currentColumnType: null,
        isSelectingPlanned: false,
        dragStartIndex: -1,
        dragBaseEndIndex: -1,
        selectedPlannedFields: new Set([1, 2, 3]),
        findMergeKey(type, rowIndex) {
            return type === 'planned' && rowIndex === 2 ? 'planned-1-3' : null;
        },
        getMergeRangeBounds(mergeKey, fallbackIndex) {
            calls.push(['bounds', mergeKey, fallbackIndex]);
            return { start: 1, end: 3 };
        },
        closeInlinePlanDropdown() {
            calls.push(['close']);
        },
        clearSelection(type) {
            calls.push(['clear', type]);
            this.selectedPlannedFields.clear();
        },
        clearAllSelections() {
            calls.push(['clearAll']);
        },
        selectMergedRange(type, mergeKey, options) {
            calls.push(['selectMerged', type, mergeKey, options]);
        },
    };

    controller.attachTimeSlotMergeEntryListeners.call(ctx, entryDiv, 2);
    timeSlot.dispatchEvent({
        type: 'mousedown',
        button: 0,
        target: timeSlot,
        preventDefault() {
            calls.push(['prevent']);
        },
        stopPropagation() {
            calls.push(['stop']);
        },
    });

    assert.deepEqual(calls, [
        ['bounds', 'planned-1-3', 2],
        ['close'],
        ['clear', 'planned'],
        ['prevent'],
        ['stop'],
    ]);
    assert.equal(calls.some((call) => call[0] === 'selectMerged'), false);
    assert.deepEqual(Array.from(ctx.selectedPlannedFields), []);
});

test('desktop time-slot drag selects multiple planned slots and mouseup resets state', () => {
    withMockDocument((mockDocument) => {
        const timeSlot = createListenerNode();
        timeSlot.ownerDocument = mockDocument;
        const entryDiv = {
            querySelector(selector) {
                return selector === '.time-slot-container' ? timeSlot : null;
            },
        };
        const calls = [];
        const ctx = {
            currentColumnType: null,
            isSelectingPlanned: false,
            dragStartIndex: -1,
            dragBaseEndIndex: -1,
            findMergeKey() {
                return null;
            },
            closeInlinePlanDropdown() {
                calls.push(['close']);
            },
            clearSelection(type) {
                calls.push(['clear', type]);
            },
            selectFieldRange(type, start, end) {
                calls.push(['select', type, start, end]);
            },
            getIndexAtClientPosition(type, clientX, clientY) {
                calls.push(['hit', type, clientX, clientY]);
                return clientY >= 300 ? 4 : 2;
            },
        };

        controller.attachTimeSlotMergeEntryListeners.call(ctx, entryDiv, 2);
        timeSlot.dispatchEvent({
            type: 'mousedown',
            button: 0,
            target: timeSlot,
            clientX: 10,
            clientY: 200,
            preventDefault() {
                calls.push(['preventDown']);
            },
            stopPropagation() {
                calls.push(['stopDown']);
            },
        });
        assert.equal(mockDocument.listenerCount('mousemove'), 1);
        assert.equal(mockDocument.listenerCount('mouseup'), 1);

        mockDocument.dispatchEvent({
            type: 'mousemove',
            buttons: 1,
            clientX: 12,
            clientY: 320,
        });
        assert.ok(calls.some((call) => call[0] === 'select' && call[2] === 2 && call[3] === 4));
        assert.equal(ctx.isSelectingPlanned, true);

        mockDocument.dispatchEvent({
            type: 'mouseup',
            preventDefault() {
                calls.push(['preventUp']);
            },
            stopPropagation() {
                calls.push(['stopUp']);
            },
        });

        assert.equal(ctx.isSelectingPlanned, false);
        assert.equal(ctx.currentColumnType, null);
        assert.equal(ctx.dragStartIndex, -1);
        assert.equal(ctx.dragBaseEndIndex, -1);
        assert.equal(mockDocument.listenerCount('mousemove'), 0);
        assert.equal(mockDocument.listenerCount('mouseup'), 0);
    });
});

test('existing merged planned range selected from time slot keeps undo path while moving inside range', () => {
    withMockDocument((mockDocument) => {
        const timeSlot = createListenerNode();
        timeSlot.ownerDocument = mockDocument;
        const entryDiv = {
            querySelector(selector) {
                return selector === '.time-slot-container' ? timeSlot : null;
            },
        };
        const calls = [];
        const ctx = {
            findMergeKey(type, rowIndex) {
                return type === 'planned' && rowIndex === 2 ? 'planned-1-3' : null;
            },
            getMergeRangeBounds() {
                return { start: 1, end: 3 };
            },
            closeInlinePlanDropdown() {
                calls.push(['close']);
            },
            clearAllSelections() {
                calls.push(['clearAll']);
            },
            selectMergedRange(type, mergeKey, options) {
                calls.push(['selectMerged', type, mergeKey, options]);
            },
            clearSelection(type) {
                calls.push(['clear', type]);
            },
            selectFieldRange(type, start, end) {
                calls.push(['select', type, start, end]);
            },
            getIndexAtClientPosition() {
                return 3;
            },
        };

        controller.attachTimeSlotMergeEntryListeners.call(ctx, entryDiv, 2);
        timeSlot.dispatchEvent({
            type: 'mousedown',
            button: 0,
            target: timeSlot,
            preventDefault() {},
            stopPropagation() {},
        });
        mockDocument.dispatchEvent({
            type: 'mousemove',
            buttons: 1,
            clientX: 10,
            clientY: 20,
        });

        assert.deepEqual(calls, [
            ['close'],
            ['clearAll'],
            ['selectMerged', 'planned', 'planned-1-3', { append: false }],
        ]);
        assert.equal(calls.some((call) => call[0] === 'select'), false);
    });
});

test('time-slot merge entry does not intercept timer controls', () => {
    const timerButton = {
        closest(selector) {
            return selector === '.timer-btn' ? timerButton : null;
        },
    };
    const timeSlot = createListenerNode();
    const entryDiv = {
        querySelector(selector) {
            return selector === '.time-slot-container' ? timeSlot : null;
        },
    };
    const calls = [];
    const ctx = {
        findMergeKey() {
            calls.push(['find']);
            return null;
        },
        closeInlinePlanDropdown() {
            calls.push(['close']);
        },
        clearSelection(type) {
            calls.push(['clear', type]);
        },
        selectFieldRange(type, start, end) {
            calls.push(['select', type, start, end]);
        },
    };

    controller.attachTimeSlotMergeEntryListeners.call(ctx, entryDiv, 2);
    timeSlot.dispatchEvent({
        type: 'mousedown',
        button: 0,
        target: timerButton,
        preventDefault() {
            calls.push(['prevent']);
        },
        stopPropagation() {
            calls.push(['stop']);
        },
    });

    assert.deepEqual(calls, []);
});

test('time-slot merge entry ignores explicit controls and merge-ignore markers', () => {
    const buttonTarget = {
        closest(selector) {
            return selector === 'button' ? buttonTarget : null;
        },
    };
    const inputTarget = {
        closest(selector) {
            return selector === 'input' ? inputTarget : null;
        },
    };
    const ignoreTarget = {
        closest(selector) {
            return selector === '[data-time-slot-merge-ignore="true"]' ? ignoreTarget : null;
        },
    };
    const timeSlot = createListenerNode();
    const entryDiv = {
        querySelector(selector) {
            return selector === '.time-slot-container' ? timeSlot : null;
        },
    };
    const calls = [];
    const ctx = {
        findMergeKey() {
            calls.push(['find']);
            return null;
        },
        closeInlinePlanDropdown() {
            calls.push(['close']);
        },
        clearSelection(type) {
            calls.push(['clear', type]);
        },
        selectFieldRange(type, start, end) {
            calls.push(['select', type, start, end]);
        },
    };

    controller.attachTimeSlotMergeEntryListeners.call(ctx, entryDiv, 2);
    [buttonTarget, inputTarget, ignoreTarget].forEach((target) => {
        timeSlot.dispatchEvent({
            type: 'mousedown',
            button: 0,
            target,
            preventDefault() {
                calls.push(['prevent', target]);
            },
            stopPropagation() {
                calls.push(['stop', target]);
            },
        });
    });

    assert.deepEqual(calls, []);
});

test('time-slot merge entry ignores future explicit time controls', () => {
    const futureControl = {
        closest(selector) {
            return selector.includes('[data-time-slot-control') ? futureControl : null;
        },
    };
    const timeSlot = createListenerNode();
    const entryDiv = {
        querySelector(selector) {
            return selector === '.time-slot-container' ? timeSlot : null;
        },
    };
    const calls = [];
    const ctx = {
        findMergeKey() {
            calls.push(['find']);
            return null;
        },
        closeInlinePlanDropdown() {
            calls.push(['close']);
        },
        clearSelection(type) {
            calls.push(['clear', type]);
        },
        selectFieldRange(type, start, end) {
            calls.push(['select', type, start, end]);
        },
    };

    controller.attachTimeSlotMergeEntryListeners.call(ctx, entryDiv, 2);
    timeSlot.dispatchEvent({
        type: 'mousedown',
        button: 0,
        target: futureControl,
        preventDefault() {
            calls.push(['prevent']);
        },
        stopPropagation() {
            calls.push(['stop']);
        },
    });

    assert.deepEqual(calls, []);
});

test('mobile time-slot touchstart immediately begins selection without long-press timer', () => {
    const originalSetTimeout = global.setTimeout;
    const originalClearTimeout = global.clearTimeout;
    const calls = [];
    global.setTimeout = () => {
        calls.push(['setTimeout']);
        throw new Error('time-slot merge touchstart should not use a timer');
    };
    global.clearTimeout = () => {
        calls.push(['clearTimeout']);
    };
    try {
        const timeSlot = createListenerNode();
        const entryDiv = {
            querySelector(selector) {
                return selector === '.time-slot-container' ? timeSlot : null;
            },
        };
        const ctx = {
            currentColumnType: null,
            isSelectingPlanned: false,
            dragStartIndex: -1,
            dragBaseEndIndex: -1,
            findMergeKey() {
                return null;
            },
            closeInlinePlanDropdown() {
                calls.push(['close']);
            },
            clearSelection(type) {
                calls.push(['clear', type]);
            },
            selectFieldRange(type, start, end) {
                calls.push(['select', type, start, end]);
            },
        };

        controller.attachTimeSlotMergeEntryListeners.call(ctx, entryDiv, 2);
        timeSlot.dispatchEvent({
            type: 'touchstart',
            target: timeSlot,
            touches: [{ clientX: 10, clientY: 10 }],
            preventDefault() {
                calls.push(['preventStart']);
            },
            stopPropagation() {
                calls.push(['stopStart']);
            },
        });

        assert.deepEqual(calls, [
            ['close'],
            ['clear', 'planned'],
            ['select', 'planned', 2, 2],
            ['preventStart'],
            ['stopStart'],
        ]);
        assert.equal(ctx.currentColumnType, 'planned');
        assert.equal(ctx.isSelectingPlanned, true);
        assert.equal(ctx.dragStartIndex, 2);
        assert.equal(ctx.dragBaseEndIndex, 2);
    } finally {
        global.setTimeout = originalSetTimeout;
        global.clearTimeout = originalClearTimeout;
    }
});

test('mobile time-slot touchmove expands immediate selection and prevents scroll while active', () => {
    const timeSlot = createListenerNode();
    const entryDiv = {
        querySelector(selector) {
            return selector === '.time-slot-container' ? timeSlot : null;
        },
    };
    const calls = [];
    const ctx = {
        currentColumnType: null,
        isSelectingPlanned: false,
        dragStartIndex: -1,
        dragBaseEndIndex: -1,
        findMergeKey() {
            return null;
        },
        closeInlinePlanDropdown() {
            calls.push(['close']);
        },
        clearSelection(type) {
            calls.push(['clear', type]);
        },
        selectFieldRange(type, start, end) {
            calls.push(['select', type, start, end]);
        },
        getIndexAtClientPosition(type, clientX, clientY) {
            calls.push(['hit', type, clientX, clientY]);
            return clientY >= 300 ? 4 : 2;
        },
    };

    controller.attachTimeSlotMergeEntryListeners.call(ctx, entryDiv, 2);
    timeSlot.dispatchEvent({
        type: 'touchstart',
        target: timeSlot,
        touches: [{ clientX: 10, clientY: 200 }],
        preventDefault() {
            calls.push(['preventStart']);
        },
        stopPropagation() {
            calls.push(['stopStart']);
        },
    });
    timeSlot.dispatchEvent({
        type: 'touchmove',
        target: timeSlot,
        touches: [{ clientX: 12, clientY: 320 }],
        preventDefault() {
            calls.push(['preventMove']);
        },
    });
    timeSlot.dispatchEvent({
        type: 'touchend',
        preventDefault() {
            calls.push(['preventEnd']);
        },
        stopPropagation() {
            calls.push(['stopEnd']);
        },
    });

    assert.ok(calls.some((call) => call[0] === 'preventMove'));
    assert.ok(calls.some((call) => call[0] === 'select' && call[2] === 2 && call[3] === 4));
    assert.equal(ctx.isSelectingPlanned, false);
    assert.equal(ctx.currentColumnType, null);
    assert.equal(ctx.dragStartIndex, -1);
    assert.equal(ctx.dragBaseEndIndex, -1);
});

test('mobile time-slot touchstart ignores non-merge controls without preventing default', () => {
    const timerButton = {
        closest(selector) {
            return selector === '.timer-btn' ? timerButton : null;
        },
    };
    const timeSlot = createListenerNode();
    const entryDiv = {
        querySelector(selector) {
            return selector === '.time-slot-container' ? timeSlot : null;
        },
    };
    const calls = [];
    const ctx = {
        findMergeKey() {
            calls.push(['find']);
            return null;
        },
        closeInlinePlanDropdown() {
            calls.push(['close']);
        },
        clearSelection(type) {
            calls.push(['clear', type]);
        },
        selectFieldRange(type, start, end) {
            calls.push(['select', type, start, end]);
        },
    };

    controller.attachTimeSlotMergeEntryListeners.call(ctx, entryDiv, 2);
    timeSlot.dispatchEvent({
        type: 'touchstart',
        target: timerButton,
        touches: [{ clientX: 10, clientY: 10 }],
        preventDefault() {
            calls.push(['prevent']);
        },
        stopPropagation() {
            calls.push(['stop']);
        },
    });

    assert.deepEqual(calls, []);
});

test('planned slot move mode blocks mobile time-slot merge selection', () => {
    const timeSlot = createListenerNode();
    const entryDiv = {
        querySelector(selector) {
            return selector === '.time-slot-container' ? timeSlot : null;
        },
    };
    const calls = [];
    const ctx = {
        isPlannedSlotMoveMode() {
            return true;
        },
        findMergeKey() {
            calls.push(['find']);
            return null;
        },
        closeInlinePlanDropdown() {
            calls.push(['close']);
        },
        selectFieldRange() {
            calls.push(['select']);
        },
    };

    controller.attachTimeSlotMergeEntryListeners.call(ctx, entryDiv, 2);
    timeSlot.dispatchEvent({
        type: 'touchstart',
        target: timeSlot,
        touches: [{ clientX: 10, clientY: 10 }],
        preventDefault() {
            calls.push(['prevent']);
        },
        stopPropagation() {
            calls.push(['stop']);
        },
    });

    assert.deepEqual(calls, []);
});

test('planned mouseup path no longer starts merge selection from planned slot UI', () => {
    const previousWindow = global.window;
    const plannedField = createListenerNode();
    const wrapper = createListenerNode();
    wrapper.getBoundingClientRect = () => ({ width: 360 });
    plannedField.closest = (selector) => selector === '.split-cell-wrapper.split-type-planned' ? wrapper : null;
    plannedField.matches = () => false;
    const entryDiv = {
        querySelector(selector) {
            return selector === '.planned-input' ? plannedField : null;
        },
    };
    const rafCalls = [];
    const calls = [];
    const ctx = {
        currentColumnType: 'planned',
        selectedPlannedFields: new Set(),
        suppressInlinePlanClickOnce: null,
        getPlannedRangeInfo() {
            return { startIndex: 4, endIndex: 4 };
        },
        findMergeKey() {
            return null;
        },
        clearAllSelections() {
            calls.push(['clearAll']);
        },
        clearSelection(type) {
            calls.push(['clear', type]);
        },
        selectFieldRange(type, start, end) {
            calls.push(['select', type, start, end]);
            this.selectedPlannedFields.add(start);
        },
        closeInlinePlanDropdown() {
            calls.push(['close']);
        },
        preparePlannedSlotReplacementViewport(targetEl) {
            calls.push(['prepare', targetEl]);
            return true;
        },
        openInlinePlanDropdown(startIndex, anchor, endIndex, options) {
            calls.push(['open', startIndex, anchor, endIndex, options]);
        },
    };

    global.window = {
        requestAnimationFrame(callback) {
            rafCalls.push(callback);
        },
    };

    try {
        controller.attachPlannedFieldSelectionListeners.call(ctx, entryDiv, 4, plannedField);
        plannedField.dispatchEvent({
            type: 'mousedown',
            target: plannedField,
            ctrlKey: false,
            metaKey: false,
            preventDefault() {},
        });
        plannedField.dispatchEvent({
            type: 'mouseup',
            target: plannedField,
            ctrlKey: false,
            metaKey: false,
            preventDefault() {},
            stopPropagation() {},
        });

        assert.equal(calls.some((call) => call[0] === 'select'), false);
        assert.equal(calls.some((call) => call[0] === 'prepare'), false);
        assert.equal(calls.some((call) => call[0] === 'open'), false);
        assert.equal(rafCalls.length, 0);
    } finally {
        if (previousWindow === undefined) {
            delete global.window;
        } else {
            global.window = previousWindow;
        }
    }
});
