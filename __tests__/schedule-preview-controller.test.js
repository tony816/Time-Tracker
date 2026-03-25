const test = require('node:test');
const assert = require('node:assert/strict');

const controller = require('../controllers/schedule-preview-controller');
const { buildMethod } = require('./helpers/script-method-builder');

const showActivityLogButtonOnHoverWrapper = buildMethod('showActivityLogButtonOnHover(index)', '(index)');
const getSchedulePreviewDataWrapper = buildMethod('getSchedulePreviewData()', '()');
const resetSchedulePreviewWrapper = buildMethod('resetSchedulePreview()', '()');
const updateSchedulePreviewWrapper = buildMethod('updateSchedulePreview()', '()');

test('schedule-preview-controller exports and global attach are available', () => {
    assert.ok(controller);
    assert.equal(typeof controller.showActivityLogButtonOnHover, 'function');
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
        showActivityLogButtonOnHover(index) {
            calls.push(['hover', this, index]);
            return 'hover-result';
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
        assert.equal(showActivityLogButtonOnHoverWrapper.call(ctx, 4), 'hover-result');
        assert.deepEqual(getSchedulePreviewDataWrapper.call(ctx), { ok: true });
        assert.equal(resetSchedulePreviewWrapper.call(ctx), 'reset-result');
        assert.equal(updateSchedulePreviewWrapper.call(ctx), 'update-result');
    } finally {
        globalThis.TimeTrackerSchedulePreviewController = original;
    }

    assert.deepEqual(calls, [
        ['hover', ctx, 4],
        ['get', ctx],
        ['reset', ctx],
        ['update', ctx],
    ]);
});
