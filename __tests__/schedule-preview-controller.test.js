const test = require('node:test');
const assert = require('node:assert/strict');

const controller = require('../controllers/schedule-preview-controller');
const { buildMethod } = require('./helpers/script-method-builder');

const showActivityLogButtonOnHoverWrapper = buildMethod('showActivityLogButtonOnHover(index)', '(index)');
const attachActualActivityHoverWrapper = buildMethod('attachActualActivityHover(entryDiv, index)', '(entryDiv, index)');
const hideHoverActivityLogButtonWrapper = buildMethod('hideHoverActivityLogButton()', '()');
const getSchedulePreviewDataWrapper = buildMethod('getSchedulePreviewData()', '()');
const resetSchedulePreviewWrapper = buildMethod('resetSchedulePreview()', '()');
const updateSchedulePreviewWrapper = buildMethod('updateSchedulePreview()', '()');

test('schedule-preview-controller exports and global attach are available', () => {
    assert.ok(controller);
    assert.equal(typeof controller.attachActualActivityHover, 'function');
    assert.equal(typeof controller.showActivityLogButtonOnHover, 'function');
    assert.equal(typeof controller.hideHoverActivityLogButton, 'function');
    assert.equal(typeof controller.getSchedulePreviewData, 'function');
    assert.equal(typeof controller.resetSchedulePreview, 'function');
    assert.equal(typeof controller.updateSchedulePreview, 'function');
    assert.equal(
        globalThis.TimeTrackerSchedulePreviewController.updateSchedulePreview,
        controller.updateSchedulePreview
    );
});

test('script schedule preview wrapper methods delegate to controller helpers', () => {
    const original = globalThis.TimeTrackerSchedulePreviewController;
    const calls = [];

    globalThis.TimeTrackerSchedulePreviewController = {
        attachActualActivityHover(entryDiv, index) {
            calls.push(['attach-hover', this, entryDiv, index]);
            return 'attach-hover-result';
        },
        showActivityLogButtonOnHover(index) {
            calls.push(['hover', this, index]);
            return 'hover-result';
        },
        hideHoverActivityLogButton() {
            calls.push(['hide-hover', this]);
            return 'hide-hover-result';
        },
        getSchedulePreviewData() {
            calls.push(['get', this]);
            return { ok: true };
        },
        resetSchedulePreview() {
            calls.push(['reset', this]);
            return 'reset-result';
        },
        updateSchedulePreview() {
            calls.push(['update', this]);
            return 'update-result';
        },
    };

    const ctx = { id: 'tracker' };

    try {
        assert.equal(attachActualActivityHoverWrapper.call(ctx, { id: 'row' }, 4), 'attach-hover-result');
        assert.equal(showActivityLogButtonOnHoverWrapper.call(ctx, 4), 'hover-result');
        assert.equal(hideHoverActivityLogButtonWrapper.call(ctx), 'hide-hover-result');
        assert.deepEqual(getSchedulePreviewDataWrapper.call(ctx), { ok: true });
        assert.equal(resetSchedulePreviewWrapper.call(ctx), 'reset-result');
        assert.equal(updateSchedulePreviewWrapper.call(ctx), 'update-result');
    } finally {
        globalThis.TimeTrackerSchedulePreviewController = original;
    }

    assert.deepEqual(calls, [
        ['attach-hover', ctx, { id: 'row' }, 4],
        ['hover', ctx, 4],
        ['hide-hover', ctx],
        ['get', ctx],
        ['reset', ctx],
        ['update', ctx],
    ]);
});

test('attachActualActivityHover binds hover handlers to actual surfaces', () => {
    const listeners = [];
    const createHoverNode = () => ({
        addEventListener(type, handler) {
            listeners.push(type);
            this[type] = handler;
        },
        closest(selector) {
            return selector === '.split-cell-wrapper.split-type-actual.split-has-data' ? { id: 'wrapper' } : null;
        },
    });
    const actualContainer = createHoverNode();
    const actualOverlay = createHoverNode();
    const actualSplitViz = createHoverNode();
    const calls = [];
    const entryDiv = {
        querySelector(selector) {
            if (selector === '.actual-field-container') return actualContainer;
            if (selector === '.actual-merged-overlay') return actualOverlay;
            if (selector === '.split-visualization-actual') return actualSplitViz;
            return null;
        },
    };
    const ctx = {
        showActivityLogButtonOnHover(index) {
            calls.push(['show', index]);
        },
        hideHoverActivityLogButton() {
            calls.push(['hide']);
        },
    };

    controller.attachActualActivityHover.call(ctx, entryDiv, 2);
    actualContainer.mouseenter();
    actualOverlay.mouseleave({ relatedTarget: null });

    assert.deepEqual(listeners, ['mouseenter', 'mouseleave', 'mouseenter', 'mouseleave', 'mouseenter', 'mouseleave']);
    assert.deepEqual(calls, [['show', 2], ['hide']]);
});
