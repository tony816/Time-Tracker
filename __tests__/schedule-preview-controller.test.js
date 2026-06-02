const test = require('node:test');
const assert = require('node:assert/strict');

const controller = require('../controllers/schedule-preview-controller');
const { buildMethod } = require('./helpers/script-method-builder');

const getSchedulePreviewDataWrapper = buildMethod('getSchedulePreviewData()', '()');
const resetSchedulePreviewWrapper = buildMethod('resetSchedulePreview()', '()');
const updateSchedulePreviewWrapper = buildMethod('updateSchedulePreview()', '()');

function createFakeElement(tagName) {
    return {
        tagName: String(tagName || '').toUpperCase(),
        children: [],
        dataset: {},
        style: {},
        textContent: '',
        innerHTML: '',
        value: '',
        className: '',
        appendChild(child) {
            this.children.push(child);
            return child;
        },
    };
}

function collectHtml(node) {
    if (!node) return '';
    return `${node.innerHTML || ''}${(node.children || []).map(collectHtml).join('')}`;
}

test('schedule-preview-controller exports and global attach are available', () => {
    assert.ok(controller);
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
        assert.deepEqual(getSchedulePreviewDataWrapper.call(ctx), { ok: true });
        assert.equal(resetSchedulePreviewWrapper.call(ctx), 'reset-result');
        assert.equal(updateSchedulePreviewWrapper.call(ctx), 'update-result');
    } finally {
        globalThis.TimeTrackerSchedulePreviewController = original;
    }

    assert.deepEqual(calls, [
        ['get', ctx],
        ['reset', ctx],
        ['update', ctx],
    ]);
});

test('updateSchedulePreview renders plan-only preview without actual column', () => {
    const originalDocument = global.document;
    const modal = createFakeElement('div');
    modal.style.display = 'flex';
    modal.dataset.startIndex = '0';
    modal.dataset.endIndex = '0';
    modal.dataset.type = 'planned';

    const list = createFakeElement('div');
    const meta = createFakeElement('div');
    const note = createFakeElement('div');
    const timeField = createFakeElement('input');
    timeField.value = '09:00';
    const elements = {
        scheduleModal: modal,
        schedulePreviewList: list,
        schedulePreviewMeta: meta,
        schedulePreviewNote: note,
        scheduleTime: timeField,
    };

    global.document = {
        getElementById(id) {
            return elements[id] || null;
        },
        createElement(tagName) {
            return createFakeElement(tagName);
        },
    };

    const ctx = {
        timeSlots: [{ time: '09:00', planned: 'Focus', actual: 'Legacy actual', timer: {} }],
        mergedFields: new Map([['actual-0-0', 'Legacy actual']]),
        modalSelectedActivities: ['Focus'],
        modalPlanActivities: [{ label: 'Focus', seconds: 3600 }],
        modalPlanTitle: '',
        modalPlanTitleBandOn: false,
        modalPlanTotalSeconds: 3600,
        formatDurationSummary() {
            return '1시간';
        },
        formatActivitiesSummary(items) {
            return items.map((item) => item.label).join(', ');
        },
        normalizeActivityText(value) {
            return String(value || '').trim();
        },
        getSchedulePreviewData: controller.getSchedulePreviewData,
        resetSchedulePreview: controller.resetSchedulePreview,
        findMergeKey(type) {
            if (type === 'actual') return 'actual-0-0';
            return null;
        },
        createMergedField() {
            return '<div class="merged-field">merged</div>';
        },
        wrapWithSplitVisualization(type, index, content) {
            return `<div class="split-cell-wrapper split-type-${type}">${content}</div>`;
        },
        createTimerControls() {
            return '<div class="timer-controls"></div>';
        },
        createMergedTimeField() {
            return '<div class="time-slot-container"></div>';
        },
        escapeAttribute(value) {
            return String(value || '');
        },
        centerMergedTimeContent() {},
        resizeMergedPlannedContent() {},
    };

    try {
        controller.updateSchedulePreview.call(ctx);
    } finally {
        global.document = originalDocument;
    }

    const rendered = collectHtml(list);
    assert.match(rendered, /planned-label/);
    assert.match(rendered, /time-label/);
    assert.doesNotMatch(rendered, /actual-label|actual-input|split-type-actual|Legacy actual|activity-log-btn/);
});
