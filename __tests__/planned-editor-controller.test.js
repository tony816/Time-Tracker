const test = require('node:test');
const assert = require('node:assert/strict');

const controller = require('../controllers/planned-editor-controller');
const { buildMethod } = require('./helpers/script-method-builder');

const getPlanActivitiesForIndexWrapper = buildMethod('getPlanActivitiesForIndex(index)', '(index)');
const renderPlanActivitiesListWrapper = buildMethod('renderPlanActivitiesList()', '()');
const openPlanActivityMenuWrapper = buildMethod('openPlanActivityMenu(index, anchorEl)', '(index, anchorEl)');
const openPlanTitleMenuWrapper = buildMethod('openPlanTitleMenu(anchorEl, options = {})', '(anchorEl, options = {})');
const openInlinePriorityMenuWrapper = buildMethod('openInlinePriorityMenu(anchorEl, options = {})', '(anchorEl, options = {})');
const syncInlinePlanToSlotsWrapper = buildMethod('syncInlinePlanToSlots()', '()');
const setPlanTitleWrapper = buildMethod('setPlanTitle(text)', '(text)');

function withPatchedDocument(documentValue, fn) {
    const originalDocument = global.document;
    global.document = documentValue;
    try {
        return fn();
    } finally {
        global.document = originalDocument;
    }
}

test('planned-editor-controller exports and global attach are available', () => {
    assert.ok(controller);
    assert.equal(typeof controller.getPlanActivitiesForIndex, 'function');
    assert.equal(typeof controller.renderPlanActivitiesList, 'function');
    assert.equal(typeof controller.openPlanActivityMenu, 'function');
    assert.equal(typeof controller.openPlanTitleMenu, 'function');
    assert.equal(typeof controller.openInlinePriorityMenu, 'function');
    assert.equal(typeof controller.syncInlinePlanToSlots, 'function');
    assert.equal(typeof controller.setPlanTitle, 'function');
    assert.equal(
        globalThis.TimeTrackerPlannedEditorController.syncInlinePlanToSlots,
        controller.syncInlinePlanToSlots
    );
});

test('script planned editor wrapper methods delegate to controller helpers', () => {
    const original = globalThis.TimeTrackerPlannedEditorController;
    const calls = [];

    globalThis.TimeTrackerPlannedEditorController = {
        getPlanActivitiesForIndex(index) {
            calls.push(['get', this, index]);
            return [{ label: 'Focus', seconds: 600 }];
        },
        renderPlanActivitiesList() {
            calls.push(['render', this]);
            return 'rendered';
        },
        openPlanActivityMenu(index, anchorEl) {
            calls.push(['activity-menu', this, index, anchorEl]);
            return 'activity-menu-open';
        },
        openPlanTitleMenu(anchorEl, options) {
            calls.push(['title-menu', this, anchorEl, options]);
            return 'title-menu-open';
        },
        openInlinePriorityMenu(anchorEl, options) {
            calls.push(['priority-menu', this, anchorEl, options]);
            return 'priority-menu-open';
        },
        syncInlinePlanToSlots() {
            calls.push(['sync', this]);
            return 'sync-result';
        },
        setPlanTitle(text) {
            calls.push(['title', this, text]);
            return 'title-result';
        },
    };

    const ctx = { id: 'tracker' };
    const anchor = { id: 'anchor' };

    try {
        assert.deepEqual(getPlanActivitiesForIndexWrapper.call(ctx, 2), [{ label: 'Focus', seconds: 600 }]);
        assert.equal(renderPlanActivitiesListWrapper.call(ctx), 'rendered');
        assert.equal(openPlanActivityMenuWrapper.call(ctx, 1, anchor), 'activity-menu-open');
        assert.equal(openPlanTitleMenuWrapper.call(ctx, anchor, { inline: true }), 'title-menu-open');
        assert.equal(openInlinePriorityMenuWrapper.call(ctx, anchor, { label: 'Focus' }), 'priority-menu-open');
        assert.equal(syncInlinePlanToSlotsWrapper.call(ctx), 'sync-result');
        assert.equal(setPlanTitleWrapper.call(ctx, 'Deep Work'), 'title-result');
    } finally {
        globalThis.TimeTrackerPlannedEditorController = original;
    }

    assert.deepEqual(calls, [
        ['get', ctx, 2],
        ['render', ctx],
        ['activity-menu', ctx, 1, anchor],
        ['title-menu', ctx, anchor, { inline: true }],
        ['priority-menu', ctx, anchor, { label: 'Focus' }],
        ['sync', ctx],
        ['title', ctx, 'Deep Work'],
    ]);
});

test('syncInlinePlanToSlots writes plan activities, title band, merged text, and triggers downstream updates', () => {
    const renderCalls = [];
    const anchor = { isConnected: true };
    const slotQueryMap = new Map([
        ['[data-index=\"0\"] .planned-input', anchor],
        ['[data-index=\"0\"]', anchor],
    ]);

    withPatchedDocument({
        querySelector(selector) {
            return slotQueryMap.get(selector) || null;
        },
    }, () => {
        const ctx = Object.assign({
            inlinePlanTarget: {
                startIndex: 0,
                endIndex: 1,
                mergeKey: 'planned-0-1',
                anchor,
            },
            inlinePlanDropdown: null,
            modalPlanActivities: [
                { label: 'Focus', seconds: 1800, invalid: false },
                { label: '', seconds: 0, invalid: true },
            ],
            modalPlanTitle: 'Deep Work',
            modalPlanTitleBandOn: true,
            timeSlots: [
                { planned: '', planTitle: '', planTitleBandOn: false, planActivities: [] },
                { planned: '', planTitle: '', planTitleBandOn: false, planActivities: [] },
            ],
            mergedFields: new Map(),
            normalizeActivityText(value) {
                return String(value || '').trim();
            },
            normalizeDurationStep(value) {
                return value;
            },
            formatActivitiesSummary(items) {
                return items.map((item) => item.label).filter(Boolean).join(', ');
            },
            renderTimeEntries(force) {
                renderCalls.push(['render', force]);
            },
            positionInlinePlanDropdown(nextAnchor) {
                renderCalls.push(['position', nextAnchor]);
            },
            calculateTotals() {
                renderCalls.push(['totals']);
            },
            autoSave() {
                renderCalls.push(['save']);
            },
        }, controller);

        controller.syncInlinePlanToSlots.call(ctx);

        assert.deepEqual(ctx.timeSlots[0].planActivities, [{ label: 'Focus', seconds: 1800 }]);
        assert.equal(ctx.timeSlots[0].planned, 'Focus');
        assert.equal(ctx.timeSlots[0].planTitle, 'Deep Work');
        assert.equal(ctx.timeSlots[0].planTitleBandOn, true);
        assert.equal(ctx.timeSlots[1].planned, '');
        assert.equal(ctx.mergedFields.get('planned-0-1'), 'Focus');
        assert.deepEqual(renderCalls, [
            ['render', true],
            ['position', anchor],
            ['totals'],
            ['save'],
        ]);
    });
});
