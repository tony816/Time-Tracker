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
            listeners[type] = handler;
        },
        dispatchEvent(event) {
            const handler = listeners[event.type];
            if (handler) handler(event);
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
    assert.equal(calls[0].options.anchorAlign, undefined);
    assert.equal(calls[0].options.mode, undefined);
});
