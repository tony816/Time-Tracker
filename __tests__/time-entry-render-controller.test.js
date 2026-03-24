const test = require('node:test');
const assert = require('node:assert/strict');

const controller = require('../controllers/time-entry-render-controller');
const { buildMethod } = require('./helpers/script-method-builder');

const buildTimeEntryRowModelWrapper = buildMethod(
    'buildTimeEntryRowModel(slot, index)',
    '(slot, index)'
);
const renderTimeEntriesWrapper = buildMethod(
    'renderTimeEntries(preserveInlineDropdown = false)',
    '(preserveInlineDropdown = false)'
);
const wrapWithSplitVisualizationWrapper = buildMethod(
    'wrapWithSplitVisualization(type, index, content)',
    '(type, index, content)'
);
const buildSplitVisualizationWrapper = buildMethod(
    'buildSplitVisualization(type, index)',
    '(type, index)'
);

test('time-entry-render-controller exports and global attach are available', () => {
    assert.ok(controller);
    assert.equal(typeof controller.buildTimeEntryRowModel, 'function');
    assert.equal(typeof controller.renderTimeEntries, 'function');
    assert.equal(typeof controller.wrapWithSplitVisualization, 'function');
    assert.equal(typeof controller.buildSplitVisualization, 'function');
    assert.equal(
        globalThis.TimeEntryRenderController.renderTimeEntries,
        controller.renderTimeEntries
    );
});

test('script time-entry render wrapper methods delegate to controller helpers', () => {
    const calls = [];
    const original = globalThis.TimeEntryRenderController;
    globalThis.TimeEntryRenderController = {
        buildTimeEntryRowModel(slot, index) {
            calls.push(['row', this, slot, index]);
            return 'row-result';
        },
        renderTimeEntries(preserveInlineDropdown) {
            calls.push(['render', this, preserveInlineDropdown]);
            return 'render-result';
        },
        wrapWithSplitVisualization(type, index, content) {
            calls.push(['wrap', this, type, index, content]);
            return 'wrap-result';
        },
        buildSplitVisualization(type, index) {
            calls.push(['split', this, type, index]);
            return 'split-result';
        },
    };

    const ctx = { id: 'tracker' };
    const slot = { time: '04' };

    try {
        assert.equal(buildTimeEntryRowModelWrapper.call(ctx, slot, 0), 'row-result');
        assert.equal(renderTimeEntriesWrapper.call(ctx, true), 'render-result');
        assert.equal(wrapWithSplitVisualizationWrapper.call(ctx, 'planned', 0, '<div />'), 'wrap-result');
        assert.equal(buildSplitVisualizationWrapper.call(ctx, 'actual', 3), 'split-result');
    } finally {
        globalThis.TimeEntryRenderController = original;
    }

    assert.deepEqual(calls, [
        ['row', ctx, slot, 0],
        ['render', ctx, true],
        ['wrap', ctx, 'planned', 0, '<div />'],
        ['split', ctx, 'actual', 3],
    ]);
});
