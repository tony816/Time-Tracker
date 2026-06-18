const test = require('node:test');
const assert = require('node:assert/strict');

const controller = require('../controllers/time-entry-render-controller');
const { buildMethod } = require('./helpers/script-method-builder');

const buildTimeEntryRowModelWrapper = buildMethod(
    'buildTimeEntryRowModel(slot, index)',
    '(slot, index)'
);
const createMergedFieldWrapper = buildMethod(
    'createMergedField(mergeKey, type, index, value)',
    '(mergeKey, type, index, value)'
);
const createMergedTimeFieldWrapper = buildMethod(
    'createMergedTimeField(mergeKey, index, slot)',
    '(mergeKey, index, slot)'
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

test('createMergedField renders readable Korean placeholder text for merged planned slots', () => {
    const ctx = {
        mergedFields: new Map([['planned-2-4', '계획 내용']]),
        normalizeMergeKey(mergeKey) {
            return mergeKey;
        },
        escapeAttribute(value) {
            return String(value).replace(/"/g, '&quot;');
        },
    };

    const markup = createMergedFieldWrapper.call(ctx, 'planned-2-4', 'planned', 2, '');

    assert.match(markup, /계획을 입력하려면 클릭 또는 Enter/);
    assert.match(markup, /병합된 계획 활동 입력/);
    assert.match(markup, /클릭해서 계획 선택\/입력/);
});
test('createMergedTimeField renders merged slot time range through the ending boundary', () => {
    const ctx = {
        timeSlots: [
            { time: '4' },
            { time: '5' },
            { time: '6' },
        ],
        normalizeMergeKey(mergeKey) {
            return mergeKey;
        },
        formatSlotTimeLabel(rawHour) {
            const hour = parseInt(String(rawHour), 10);
            return Number.isFinite(hour) ? String(hour).padStart(2, '0') : String(rawHour || '');
        },
        createTimerControls() {
            return '<button class="timer-btn">run</button>';
        },
    };

    const mainMarkup = createMergedTimeFieldWrapper.call(ctx, 'time-0-1', 0, ctx.timeSlots[0]);
    const secondaryMarkup = createMergedTimeFieldWrapper.call(ctx, 'time-0-1', 1, ctx.timeSlots[1]);

    assert.match(mainMarkup, /<div class="time-label">04 ~ 06<\/div>/);
    assert.match(mainMarkup, /timer-btn/);
    assert.match(mainMarkup, /time-slot-merge-affordance/);
    assert.match(secondaryMarkup, /merged-time-secondary/);
    assert.doesNotMatch(secondaryMarkup, /time-slot-merge-affordance/);
    assert.doesNotMatch(secondaryMarkup, />05<\/div>/);
});
