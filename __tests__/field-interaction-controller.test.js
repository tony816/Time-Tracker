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
