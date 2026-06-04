const test = require('node:test');
const assert = require('node:assert/strict');

const controller = require('../controllers/field-interaction-controller');
const { buildMethod } = require('./helpers/script-method-builder');

const handleMergedClickCaptureWrapper = buildMethod('handleMergedClickCapture(e)', '(e)');
const attachPlannedFieldSelectionListenersWrapper = buildMethod(
    'attachPlannedFieldSelectionListeners(entryDiv, index, plannedField)',
    '(entryDiv, index, plannedField)'
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
            handlers.forEach((handler) => handler(event));
        },
    };
}

test('field-interaction-controller exports and global attach are available', () => {
    assert.ok(controller);
    assert.equal(typeof controller.handleMergedClickCapture, 'function');
    assert.equal(typeof controller.attachPlannedFieldSelectionListeners, 'function');
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
        assert.equal(attachRowWideClickTargetsWrapper.call(ctx, entryDiv, 4), 'row-result');
        assert.equal(attachCellClickListenersWrapper.call(ctx, entryDiv, 4), 'cell-result');
    } finally {
        globalThis.TimeTrackerFieldInteractionController = original;
    }

    assert.deepEqual(calls, [
        ['merged', ctx, event],
        ['planned', ctx, entryDiv, 4, plannedField],
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

test('merged secondary retap keeps mobile sheet synced to the base block anchor', () => {
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
        ['sync', baseAnchor],
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

test('merged planned click capture keeps logical range but opens against the clicked field target', () => {
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
            return { startIndex: 8, endIndex: 14 };
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

    const openCall = calls.find((call) => call[0] === 'open');
    assert.ok(openCall);
    assert.equal(openCall[1], 8);
    assert.equal(openCall[2], wrapper);
    assert.equal(openCall[3], 14);
    assert.equal(openCall[4].sheetTargetEl, plannedField);
    assert.deepEqual(calls.slice(0, 3), [
        ['prevent'],
        ['stop'],
        ['activate', 'planned-8-14', 14],
    ]);
});

test('merged planned secondary click delegates inline dropdown target to base range anchor', () => {
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

    const openCall = calls.find((call) => call[0] === 'open');
    assert.ok(openCall);
    assert.equal(openCall[1], 0);
    assert.equal(openCall[2], baseAnchor);
    assert.equal(openCall[3], 1);
    assert.equal(openCall[4].sheetTargetEl, baseAnchor);
    assert.equal(openCall[4].baseIndex, 0);
    assert.equal(openCall[4].rangeStart, 0);
    assert.equal(openCall[4].rangeEnd, 1);
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

test('planned mouseup path pre-scrolls before opening empty planned slot sheet', () => {
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

        assert.deepEqual(calls.filter((call) => call[0] === 'prepare'), [['prepare', wrapper]]);
        assert.equal(rafCalls.length, 1);
        rafCalls[0]();
        rafCalls[1]();
        const openCall = calls.find((call) => call[0] === 'open');
        assert.ok(openCall);
        assert.equal(openCall[1], 4);
        assert.equal(openCall[2], wrapper);
        assert.equal(openCall[3], 4);
        assert.equal(openCall[4].anchorMinWidth, 360);
        assert.equal(openCall[4].sheetTargetEl, plannedField);
    } finally {
        if (previousWindow === undefined) {
            delete global.window;
        } else {
            global.window = previousWindow;
        }
    }
});
