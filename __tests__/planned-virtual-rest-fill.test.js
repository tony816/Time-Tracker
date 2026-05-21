const test = require('node:test');
const assert = require('node:assert/strict');

const inlineController = require('../controllers/inline-plan-dropdown-controller');
const renderController = require('../controllers/time-entry-render-controller');
const planSegmentCore = require('../core/plan-segment-core');
const { buildMethod } = require('./helpers/script-method-builder');

const attachVirtualRestGapListeners = buildMethod(
    'attachVirtualRestGapListeners(entryDiv, index)',
    '(entryDiv, index)'
);
const attachPlanSegmentResizeListeners = buildMethod(
    'attachPlanSegmentResizeListeners(entryDiv, index)',
    '(entryDiv, index)'
);
const normalizePlanActivitiesForSegmentResize = buildMethod(
    'normalizePlanActivitiesForSegmentResize(raw)',
    '(raw)'
);
const applyPlanSegmentResize = buildMethod(
    'applyPlanSegmentResize(baseIndex, segmentIndex, edge, targetMinute)',
    '(baseIndex, segmentIndex, edge, targetMinute)'
);

function createNode() {
    const listeners = {};
    const node = {
        children: [],
        dataset: {},
        className: '',
        hidden: false,
        style: {},
        textContent: '',
        type: '',
        title: '',
        classList: {
            add() {},
            remove() {},
            contains() { return false; },
        },
        appendChild(child) {
            this.children.push(child);
            child.parentNode = this;
            return child;
        },
        addEventListener(type, handler) {
            listeners[type] = handler;
        },
        dispatchEvent(event) {
            const handler = listeners[event.type];
            if (handler) handler(event);
        },
        setAttribute(name, value) {
            this[name] = String(value);
        },
        querySelector(selector) {
            return this.parts ? this.parts[selector] || null : null;
        },
    };
    return node;
}

function createGapFillContext() {
    const section = createNode();
    const subBoard = createNode();
    const actions = createNode();
    const title = createNode();
    const close = createNode();
    section.parts = {
        '.inline-plan-sub-board': subBoard,
        '.inline-plan-child-actions': actions,
        '.inline-plan-subsection-title': title,
        '.inline-plan-subsection-close': close,
    };
    const dropdown = createNode();
    dropdown.parts = {
        '.inline-plan-subsection': section,
        '.inline-plan-sub-board': subBoard,
        '.inline-plan-child-actions': actions,
        '.inline-plan-subsection-title': title,
        '.inline-plan-subsection-close': close,
    };
    const anchor = { isConnected: true, dataset: {}, getBoundingClientRect() { return { left: 0, top: 0, bottom: 0, width: 10, height: 10 }; } };
    return {
        section,
        subBoard,
        anchor,
        ctx: {
            inlinePlanDropdown: dropdown,
            inlinePlanTarget: {
                startIndex: 0,
                endIndex: 0,
                anchor,
                mode: 'virtual-rest-gap',
                gapStartMinute: 20,
                gapDurationMinutes: 20,
            },
            timeSlots: [
                {
                    planned: 'A, B',
                    planTitle: '',
                    planTitleBandOn: false,
                    planActivities: [
                        { label: 'A', seconds: 20 * 60 },
                        { label: 'B', seconds: 20 * 60, startMinute: 40 },
                    ],
                },
            ],
            plannedActivities: [],
            modalPlanActivities: [],
            modalPlanActiveRow: -1,
            modalPlanTitle: '',
            modalPlanTitleBandOn: false,
            mergedFields: new Map(),
            normalizeActivityText(value) {
                return String(value || '').trim();
            },
            normalizePlanActivitiesArray(value) {
                return Array.isArray(value) ? value.map(item => ({ ...item })) : [];
            },
            formatActivitiesSummary(items) {
                return items.map(item => item.label).join(', ');
            },
            renderTimeEntries() {},
            calculateTotals() {},
            autoSave() {},
            closeInlinePlanDropdown() {
                this.closed = true;
            },
            isInlinePlanMobileInputContext() {
                return false;
            },
            positionInlinePlanDropdown() {},
            dedupeAndSortPlannedActivities() {},
            savePlannedActivities() {},
            renderInlinePlanDropdownOptions() {},
            openPlanActivityChildMenu(parentItem, anchorEl, children) {
                return inlineController.openPlanActivityChildMenu.call(this, parentItem, anchorEl, children);
            },
            closePlanActivityChildMenu(options = {}) {
                return inlineController.closePlanActivityChildMenu.call(this, options);
            },
        },
    };
}

test('clicking a virtual rest gap opens the existing inline plan dropdown with gap metadata', () => {
    const gap = createNode();
    gap.dataset = {
        gapStartMinute: '20',
        gapDurationMinutes: '20',
    };
    gap.closest = () => ({ id: 'planned-wrapper' });
    const entryDiv = {
        querySelectorAll(selector) {
            assert.equal(selector, '.split-grid-segment-virtual-rest[data-segment-kind="virtual-rest"]');
            return [gap];
        },
    };
    const calls = [];
    const ctx = {
        getPlannedRangeInfo(index) {
            assert.equal(index, 0);
            return { startIndex: 0, endIndex: 0 };
        },
        openInlinePlanDropdown(startIndex, anchor, endIndex, options) {
            calls.push({ startIndex, anchor, endIndex, options });
        },
    };

    attachVirtualRestGapListeners.call(ctx, entryDiv, 0);
    gap.dispatchEvent({
        type: 'click',
        preventDefault() {},
        stopPropagation() {},
    });

    assert.equal(calls.length, 1);
    assert.equal(calls[0].startIndex, 0);
    assert.equal(calls[0].endIndex, 0);
    assert.equal(calls[0].options.mode, 'virtual-rest-gap');
    assert.equal(calls[0].options.gapStartMinute, 20);
    assert.equal(calls[0].options.gapDurationMinutes, 20);
});

test('selecting a parent activity fills the clicked virtual gap duration at the correct position', () => {
    const { ctx, subBoard, anchor } = createGapFillContext();
    const originalDocument = globalThis.document;
    globalThis.document = {
        createElement: createNode,
        querySelector() {
            return anchor;
        },
    };

    try {
        inlineController.openPlanActivityChildMenu.call(ctx, { id: 'study', label: 'Study' }, anchor, []);
        const selfRow = subBoard.children.find((node) => node.children[0] && String(node.children[0].className).includes('activity-chip-self'));
        selfRow.children[0].dispatchEvent({
            type: 'click',
            preventDefault() {},
            stopPropagation() {},
        });
    } finally {
        globalThis.document = originalDocument;
    }

    assert.deepEqual(ctx.timeSlots[0].planActivities, [
        { label: 'A', seconds: 20 * 60 },
        {
            label: 'Study',
            seconds: 20 * 60,
            titleActivityId: null,
            titleText: null,
            activityId: 'study',
            activityText: 'Study',
        },
        { label: 'B', seconds: 20 * 60, startMinute: 40 },
    ]);
    assert.equal(ctx.timeSlots[0].planActivities.some(item => item.kind === 'virtual-rest' || item.virtual), false);
});

test('selecting a child activity fills the gap and preserves parent child metadata', () => {
    const { ctx, subBoard, anchor } = createGapFillContext();
    const originalDocument = globalThis.document;
    globalThis.document = {
        createElement: createNode,
        querySelector() {
            return anchor;
        },
    };

    try {
        inlineController.openPlanActivityChildMenu.call(ctx, { id: 'study', label: 'Study' }, anchor, [
            { id: 'english', label: 'English', parentId: 'study' },
        ]);
        const childRow = subBoard.children.find((node) => node.children[1] && String(node.children[1].className).includes('activity-chip'));
        childRow.children[1].dispatchEvent({
            type: 'click',
            preventDefault() {},
            stopPropagation() {},
        });
    } finally {
        globalThis.document = originalDocument;
    }

    assert.deepEqual(ctx.timeSlots[0].planActivities[1], {
        label: 'English',
        seconds: 20 * 60,
        titleActivityId: 'study',
        titleText: 'Study',
        activityId: 'english',
        activityText: 'English',
    });
});

test('filled gap is rendered as a real planned segment instead of a virtual rest gap', () => {
    const ctx = {
        actualRecordingDisabled: true,
        computeSplitSegments() {
            return {
                showTitleBand: false,
                gridSegments: [
                    { label: 'Study', span: 2, connectTop: false, connectBottom: false, durationMinutes: 20 },
                ],
            };
        },
        escapeHtml(value) {
            return String(value);
        },
        escapeAttribute(value) {
            return String(value);
        },
        getSplitColor() {
            return '#abcdef';
        },
        getPlanSegmentBaseIndex() {
            return 0;
        },
        buildPlanSegmentViewModel() {
            return {
                id: 'planned-0-0',
                display: { icon: 'play', timeText: '0m / 20m', tone: 'under' },
            };
        },
    };

    const html = renderController.buildSplitVisualization.call(ctx, 'planned', 0);

    assert.doesNotMatch(html, /split-grid-segment-virtual-rest/);
    assert.match(html, /class="plan-segment-timer-button"/);
});

test('plan segment resize starts only from resize handles and stops propagation', () => {
    const originalDocument = globalThis.document;
    const documentListeners = {};
    const grid = {
        getBoundingClientRect() {
            return { width: 60 };
        },
    };
    const segmentClassList = {
        added: [],
        removed: [],
        contains() { return false; },
        add(cls) { this.added.push(cls); },
        remove(cls) { this.removed.push(cls); },
    };
    const segment = {
        dataset: {
            segmentIndex: '0',
            segmentStartMinute: '0',
            segmentEndMinute: '30',
        },
        classList: segmentClassList,
        closest(selector) {
            if (selector === '.split-grid') return grid;
            return null;
        },
    };
    const handle = {
        dataset: { resizeEdge: 'right' },
        addEventListener(type, handler) {
            this[type] = handler;
        },
        closest(selector) {
            if (selector === '.split-grid-segment[data-segment-kind="real-plan"]') return segment;
            return null;
        },
    };
    const entryDiv = {
        querySelectorAll(selector) {
            assert.equal(selector, '.plan-segment-resize-handle');
            return [handle];
        },
    };
    const calls = [];
    const ctx = {
        getBlockLength(type, index) {
            assert.equal(type, 'planned');
            assert.equal(index, 0);
            return 1;
        },
        applyPlanSegmentResize(baseIndex, segmentIndex, edge, targetMinute) {
            calls.push({ baseIndex, segmentIndex, edge, targetMinute });
        },
    };
    let stopped = false;
    let prevented = false;
    globalThis.document = {
        addEventListener(type, handler) {
            documentListeners[type] = handler;
        },
        removeEventListener() {},
    };

    try {
        attachPlanSegmentResizeListeners.call(ctx, entryDiv, 0);
        handle.pointerdown({
            target: handle,
            clientX: 0,
            preventDefault() { prevented = true; },
            stopPropagation() { stopped = true; },
        });
        documentListeners.pointerup({ clientX: 20 });
    } finally {
        globalThis.document = originalDocument;
    }

    assert.equal(prevented, true);
    assert.equal(stopped, true);
    assert.deepEqual(calls, [{ baseIndex: 0, segmentIndex: 0, edge: 'right', targetMinute: 50 }]);
    assert.deepEqual(segmentClassList.added, ['is-resizing-plan-segment']);
    assert.deepEqual(segmentClassList.removed, ['is-resizing-plan-segment']);
});

test('applyPlanSegmentResize preserves existing gap positions while resizing', () => {
    const slot = {
        planned: '',
        planActivities: [
            {
                label: 'A',
                seconds: 20 * 60,
                titleActivityId: 'title-a',
                titleText: 'Title A',
                activityId: 'activity-a',
                activityText: 'Activity A',
                startMinute: 0,
                durationMinutes: 20,
                endMinute: 20,
            },
            {
                label: 'B',
                seconds: 20 * 60,
                titleActivityId: 'title-b',
                titleText: 'Title B',
                activityId: 'activity-b',
                activityText: 'Activity B',
                startMinute: 40,
                durationMinutes: 20,
                endMinute: 60,
            },
            {
                kind: 'virtual-rest',
                virtual: true,
                label: '휴식',
                startMinute: 20,
                durationMinutes: 20,
                endMinute: 40,
            },
        ],
    };
    const calls = [];
    const ctx = {
        timeSlots: [slot],
        normalizePlanActivitiesForSegmentResize,
        normalizeActivityText(value) {
            return String(value || '').trim();
        },
        normalizeDurationStep(seconds) {
            return Math.max(0, Math.round(Number(seconds) || 0));
        },
        getBlockLength(type, index) {
            assert.equal(type, 'planned');
            assert.equal(index, 0);
            return 1;
        },
        formatActivitiesSummary(items) {
            return items.map(item => item.label).join(', ');
        },
        renderTimeEntries(force) {
            calls.push(['renderTimeEntries', force]);
        },
        calculateTotals() {
            calls.push(['calculateTotals']);
        },
        autoSave() {
            calls.push(['autoSave']);
        },
    };

    const result = applyPlanSegmentResize.call(ctx, 0, 0, 'right', 30);

    assert.equal(result, true);
    assert.equal(slot.planActivities.length, 2);
    assert.deepEqual(slot.planActivities[0], {
        label: 'A',
        seconds: 30 * 60,
        titleActivityId: 'title-a',
        titleText: 'Title A',
        activityId: 'activity-a',
        activityText: 'Activity A',
        startMinute: 0,
        durationMinutes: 30,
        endMinute: 30,
    });
    assert.deepEqual(slot.planActivities[1], {
        label: 'B',
        seconds: 20 * 60,
        titleActivityId: 'title-b',
        titleText: 'Title B',
        activityId: 'activity-b',
        activityText: 'Activity B',
        startMinute: 40,
        durationMinutes: 20,
        endMinute: 60,
    });
    assert.equal(slot.planActivities.some(item => item.kind === 'virtual-rest' || item.virtual === true), false);
    assert.deepEqual(planSegmentCore.calculateVirtualRestGaps(slot.planActivities, { startMinute: 0, endMinute: 60 }), [
        {
            id: 'virtual-rest-30-10',
            kind: 'virtual-rest',
            label: '휴식',
            startMinute: 30,
            durationMinutes: 10,
            virtual: true,
        },
    ]);
    assert.deepEqual(calls, [
        ['renderTimeEntries', true],
        ['calculateTotals'],
        ['autoSave'],
    ]);
});
