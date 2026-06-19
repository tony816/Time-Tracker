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

function createClassList(node) {
    const set = new Set();
    const syncFromName = () => {
        set.clear();
        String(node.className || '').split(/\s+/).filter(Boolean).forEach((name) => set.add(name));
    };
    const syncToName = () => {
        node.className = Array.from(set).join(' ');
    };
    return {
        add(...classes) {
            syncFromName();
            classes.forEach((name) => set.add(name));
            syncToName();
        },
        contains(name) {
            syncFromName();
            return set.has(name);
        },
    };
}

function createRenderNode(tagName = 'div') {
    const node = {
        tagName: String(tagName).toUpperCase(),
        children: [],
        parentNode: null,
        className: '',
        dataset: {},
        _innerHTML: '',
        appendChild(child) {
            child.parentNode = this;
            this.children.push(child);
            return child;
        },
        querySelector(selector) {
            if (selector === '.planned-input' && this._innerHTML.includes('planned-input')) {
                return { className: 'planned-input', dataset: {} };
            }
            return null;
        },
    };
    node.classList = createClassList(node);
    Object.defineProperty(node, 'innerHTML', {
        get() {
            return this._innerHTML;
        },
        set(value) {
            this._innerHTML = String(value || '');
        },
    });
    return node;
}

function createRenderTimeEntriesContext({ mobile }) {
    const container = createRenderNode('div');
    const documentStub = {
        createElement(tagName) {
            return createRenderNode(tagName);
        },
        getElementById(id) {
            return id === 'timeEntries' ? container : null;
        },
    };
    const ctx = {
        timeSlots: [{ time: '6', planned: 'Focus', timer: { status: 'running', running: true } }],
        closeInlinePlanDropdown() {},
        validateSelectedPlanSegment() {},
        getCurrentTimeIndex() {
            return 0;
        },
        isMobileTimeExpansionEnabled() {
            return mobile;
        },
        buildTimeEntryRowModel() {
            return {
                routineMatch: null,
                hasPlannedMergeContinuation: false,
                hasActualMergeContinuation: false,
                innerHtml: '<input class="planned-input"><div class="time-slot-container"><div class="time-label time-slot-label">06</div></div>',
            };
        },
        getMobileTimeUiState() {
            if (mobile) assert.fail('mobile render should not query time UI state');
            return {
                hostIndex: 0,
                mode: 'running',
                showControls: true,
                isCurrent: true,
                status: 'running',
            };
        },
        attachFieldSelectionListeners() {},
        attachCellClickListeners() {},
        attachTimeSlotMergeEntryListeners() {},
        attachVirtualRestGapListeners() {},
        attachPlannedSlotMoveListeners() {},
        attachPlanSegmentResizeListeners() {},
        attachPlannedSegmentReorderListeners() {},
        attachPlanSegmentTitleEditListeners() {},
        attachPlanSegmentSelectionListeners() {},
        attachTimerListeners() {},
        attachRowWideClickTargets() {},
        syncTimeSlotMergeSelectionState() {},
        centerMergedTimeContent() {},
        resizeMergedPlannedContent() {},
    };
    return { ctx, container, documentStub };
}

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

test('renderTimeEntries does not apply time UI state classes on mobile', () => {
    const originalDocument = globalThis.document;
    const { ctx, container, documentStub } = createRenderTimeEntriesContext({ mobile: true });
    globalThis.document = documentStub;

    try {
        controller.renderTimeEntries.call(ctx);
    } finally {
        globalThis.document = originalDocument;
    }

    const row = container.children[0];
    assert.ok(row);
    assert.equal(row.classList.contains('time-ui-running'), false);
    assert.equal(row.classList.contains('time-ui-visible'), false);
    assert.equal(row.classList.contains('current-time-slot'), false);
    assert.equal(row.classList.contains('running-timer-slot'), false);
    assert.equal(row.classList.contains('paused-timer-slot'), false);
    assert.equal(row.classList.contains('completed-timer-slot'), false);
});

test('renderTimeEntries keeps desktop time UI state classes', () => {
    const originalDocument = globalThis.document;
    const { ctx, container, documentStub } = createRenderTimeEntriesContext({ mobile: false });
    globalThis.document = documentStub;

    try {
        controller.renderTimeEntries.call(ctx);
    } finally {
        globalThis.document = originalDocument;
    }

    const row = container.children[0];
    assert.ok(row);
    assert.equal(row.classList.contains('time-ui-running'), true);
    assert.equal(row.classList.contains('time-ui-visible'), true);
    assert.equal(row.classList.contains('current-time-slot'), true);
    assert.equal(row.classList.contains('running-timer-slot'), true);
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
    assert.equal(mainMarkup.includes('04\u201306'), true);
    assert.equal(mainMarkup.includes('04 \u2013 06'), false);

    assert.match(mainMarkup, /<div class="time-label time-slot-label time-range-label">04–06<\/div>/);
    assert.match(mainMarkup, /<div class="time-label time-slot-label time-range-label">04–06<\/div>\s*<span class="time-slot-merge-affordance"/);
    assert.match(mainMarkup, /timer-btn/);
    assert.match(mainMarkup, /time-slot-merge-affordance/);
    assert.match(secondaryMarkup, /merged-time-secondary/);
    assert.doesNotMatch(secondaryMarkup, /time-slot-merge-affordance/);
    assert.doesNotMatch(secondaryMarkup, />05<\/div>/);
});

test('createMergedTimeField keeps mobile merged range compact and omits time-column timer controls', () => {
    const ctx = {
        timeSlots: [
            { time: '6' },
            { time: '7' },
            { time: '8' },
        ],
        normalizeMergeKey(mergeKey) {
            return mergeKey;
        },
        formatSlotTimeLabel(rawHour) {
            const hour = parseInt(String(rawHour), 10);
            return Number.isFinite(hour) ? String(hour).padStart(2, '0') : String(rawHour || '');
        },
        isMobileTimeExpansionEnabled() {
            return true;
        },
        createTimerControls() {
            return '<button class="timer-btn">run</button>';
        },
    };

    const markup = createMergedTimeFieldWrapper.call(ctx, 'time-0-1', 0, ctx.timeSlots[0]);
    assert.equal(markup.includes('06\u201308'), true);
    assert.equal(markup.includes('06 \u2013 08'), false);

    assert.match(markup, /class="time-label time-slot-label time-range-label">06–08<\/div>/);
    assert.doesNotMatch(markup, /06\s*<br/i);
    assert.doesNotMatch(markup, /06\s*<\/div>\s*<div[^>]*>\s*08/);
    assert.doesNotMatch(markup, /timer-btn/);
    assert.doesNotMatch(markup, /timer-controls-container/);
});
