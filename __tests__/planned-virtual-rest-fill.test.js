const test = require('node:test');
const assert = require('node:assert/strict');

const inlineController = require('../controllers/inline-plan-dropdown-controller');
const renderController = require('../controllers/time-entry-render-controller');
require('../core/actual-grid-core');
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
const computeSplitSegments = buildMethod(
    'computeSplitSegments(type, index)',
    '(type, index)'
);
const getSplitActivities = buildMethod(
    'getSplitActivities(type, baseIndex)',
    '(type, baseIndex)'
);
const normalizePlanActivitiesPreservingSegments = buildMethod(
    'normalizePlanActivitiesPreservingSegments(raw)',
    '(raw)'
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

function createPlannedRenderContext(planActivities, overrides = {}) {
    const ctx = {
        timeSlots: [
            {
                planned: '',
                planTitle: '',
                planTitleBandOn: false,
                planActivities: Array.isArray(planActivities) ? planActivities.map(item => ({ ...item })) : [],
            },
        ],
        mergedFields: new Map(),
        actualRecordingDisabled: true,
        findMergeKey() {
            return null;
        },
        getSplitBaseIndex(type, index) {
            assert.equal(type, 'planned');
            return index;
        },
        getSplitRange(type, index) {
            assert.equal(type, 'planned');
            return { start: index, end: index };
        },
        normalizeActivityText(value) {
            return String(value || '').trim();
        },
        normalizeDurationStep(seconds) {
            return Math.max(0, Math.round(Number(seconds) || 0));
        },
        formatDurationSummary(seconds) {
            return `${Math.floor(seconds / 60)}m`;
        },
        normalizePlanActivitiesPreservingSegments(raw) {
            return normalizePlanActivitiesPreservingSegments.call(this, raw);
        },
        normalizePlanActivitiesForSegmentResize(raw) {
            return normalizePlanActivitiesForSegmentResize.call(this, raw);
        },
        getSplitActivities(type, baseIndex) {
            return getSplitActivities.call(this, type, baseIndex);
        },
        getPlannedLabelForIndex() {
            return '';
        },
        getBlockLength(type, index) {
            assert.equal(type, 'planned');
            assert.equal(index, 0);
            return 1;
        },
        getPlanSegmentBaseIndex(index) {
            return index;
        },
        getPlanSegmentId(index, segmentIndex) {
            return `planned-${index}-seg${segmentIndex}`;
        },
        buildPlanSegmentViewModel(baseIndex, segmentId) {
            return {
                id: segmentId,
                display: { icon: 'play', timeText: '', tone: 'under' },
            };
        },
        getSplitColor() {
            return '#abcdef';
        },
        formatActivitiesSummary(items) {
            return items.map(item => item.label).join(', ');
        },
        renderTimeEntries(force) {
            this.lastRenderForce = force;
            this.lastRenderContext = computeSplitSegments.call(this, 'planned', 0);
        },
        calculateTotals() {},
        autoSave() {},
        ...overrides,
    };
    return ctx;
}

function summarizeGridSegments(context) {
    return context.gridSegments.map(segment => ({
        label: segment.label,
        startMinute: segment.startMinute,
        endMinute: segment.endMinute,
        durationMinutes: segment.durationMinutes,
        span: segment.span,
        kind: segment.kind,
        virtual: segment.virtual,
    }));
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

test('plan segment resize uses pointer drag movement, base index, and suppresses synthetic mouse', () => {
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
        captured: [],
        released: [],
        addEventListener(type, handler) {
            this[type] = handler;
        },
        setPointerCapture(pointerId) {
            this.captured.push(pointerId);
        },
        releasePointerCapture(pointerId) {
            this.released.push(pointerId);
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
        getPlanSegmentBaseIndex(index) {
            assert.equal(index, 3);
            return 2;
        },
        getBlockLength(type, index) {
            assert.equal(type, 'planned');
            assert.equal(index, 2);
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
        removeEventListener(type, handler) {
            if (documentListeners[type] === handler) {
                delete documentListeners[type];
            }
        },
    };

    try {
        attachPlanSegmentResizeListeners.call(ctx, entryDiv, 3);
        handle.pointerdown({
            type: 'pointerdown',
            target: handle,
            button: 0,
            pointerId: 7,
            clientX: 0,
            preventDefault() { prevented = true; },
            stopPropagation() { stopped = true; },
        });
        handle.mousedown({
            type: 'mousedown',
            target: handle,
            button: 0,
            clientX: 0,
            preventDefault() {
                throw new Error('synthetic mouse should be suppressed');
            },
            stopPropagation() {},
        });
        documentListeners.pointermove({
            clientX: 10,
            preventDefault() {},
            stopPropagation() {},
        });
        documentListeners.pointermove({
            clientX: 20,
            preventDefault() {},
            stopPropagation() {},
        });
        documentListeners.pointerup({});
    } finally {
        globalThis.document = originalDocument;
    }

    assert.equal(prevented, true);
    assert.equal(stopped, true);
    assert.deepEqual(calls, [{ baseIndex: 2, segmentIndex: 0, edge: 'right', targetMinute: 50 }]);
    assert.deepEqual(segmentClassList.added, ['is-resizing-plan-segment']);
    assert.deepEqual(segmentClassList.removed, ['is-resizing-plan-segment']);
    assert.deepEqual(handle.captured, [7]);
    assert.deepEqual(handle.released, [7]);
    assert.equal(documentListeners.pointermove, undefined);
    assert.equal(documentListeners.pointerup, undefined);
    assert.equal(documentListeners.pointercancel, undefined);
});

test('plan segment resize skips apply when drag does not cross a ten minute target', () => {
    const originalDocument = globalThis.document;
    const documentListeners = {};
    const grid = {
        getBoundingClientRect() {
            return { width: 60 };
        },
    };
    const segment = {
        dataset: {
            segmentIndex: '0',
            segmentStartMinute: '0',
            segmentEndMinute: '30',
        },
        classList: {
            contains() { return false; },
            add() {},
            remove() {},
        },
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
        querySelectorAll() {
            return [handle];
        },
    };
    const calls = [];
    const ctx = {
        getBlockLength() {
            return 1;
        },
        applyPlanSegmentResize(baseIndex, segmentIndex, edge, targetMinute) {
            calls.push({ baseIndex, segmentIndex, edge, targetMinute });
        },
    };
    globalThis.document = {
        addEventListener(type, handler) {
            documentListeners[type] = handler;
        },
        removeEventListener(type, handler) {
            if (documentListeners[type] === handler) {
                delete documentListeners[type];
            }
        },
    };

    try {
        attachPlanSegmentResizeListeners.call(ctx, entryDiv, 0);
        handle.pointerdown({
            type: 'pointerdown',
            target: handle,
            button: 0,
            pointerId: 1,
            clientX: 0,
            preventDefault() {},
            stopPropagation() {},
        });
        documentListeners.pointermove({
            clientX: 4,
            preventDefault() {},
            stopPropagation() {},
        });
        documentListeners.pointerup({});
    } finally {
        globalThis.document = originalDocument;
    }

    assert.deepEqual(calls, []);
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

test('planned render keeps resized segment span and virtual rest gap after right shrink', () => {
    const ctx = createPlannedRenderContext([
        {
            label: 'A',
            seconds: 60 * 60,
            startMinute: 0,
            durationMinutes: 60,
            endMinute: 60,
        },
    ]);

    const result = applyPlanSegmentResize.call(ctx, 0, 0, 'right', 50);
    const rendered = summarizeGridSegments(ctx.lastRenderContext);

    assert.equal(result, true);
    assert.equal(ctx.lastRenderForce, true);
    assert.equal(ctx.timeSlots[0].planActivities[0].durationMinutes, 50);
    assert.equal(ctx.timeSlots[0].planActivities[0].endMinute, 50);
    assert.equal(ctx.timeSlots[0].planActivities.some(item => item.kind === 'virtual-rest' || item.virtual === true), false);
    assert.deepEqual(rendered, [
        {
            label: 'A',
            startMinute: 0,
            endMinute: 50,
            durationMinutes: 50,
            span: 5,
            kind: undefined,
            virtual: undefined,
        },
        {
            label: '휴식',
            startMinute: 50,
            endMinute: undefined,
            durationMinutes: 10,
            span: 1,
            kind: 'virtual-rest',
            virtual: true,
        },
    ]);
});

test('planned render keeps following segment position after resizing into an existing gap', () => {
    const ctx = createPlannedRenderContext([
        {
            label: 'A',
            seconds: 20 * 60,
            startMinute: 0,
            durationMinutes: 20,
            endMinute: 20,
        },
        {
            label: 'B',
            seconds: 20 * 60,
            startMinute: 40,
            durationMinutes: 20,
            endMinute: 60,
        },
    ]);

    const result = applyPlanSegmentResize.call(ctx, 0, 0, 'right', 30);
    const rendered = summarizeGridSegments(ctx.lastRenderContext);

    assert.equal(result, true);
    assert.deepEqual(ctx.timeSlots[0].planActivities.map(item => ({
        label: item.label,
        startMinute: item.startMinute,
        endMinute: item.endMinute,
        durationMinutes: item.durationMinutes,
    })), [
        { label: 'A', startMinute: 0, endMinute: 30, durationMinutes: 30 },
        { label: 'B', startMinute: 40, endMinute: 60, durationMinutes: 20 },
    ]);
    assert.deepEqual(rendered, [
        {
            label: 'A',
            startMinute: 0,
            endMinute: 30,
            durationMinutes: 30,
            span: 3,
            kind: undefined,
            virtual: undefined,
        },
        {
            label: '휴식',
            startMinute: 30,
            endMinute: undefined,
            durationMinutes: 10,
            span: 1,
            kind: 'virtual-rest',
            virtual: true,
        },
        {
            label: 'B',
            startMinute: 40,
            endMinute: 60,
            durationMinutes: 20,
            span: 2,
            kind: undefined,
            virtual: undefined,
        },
    ]);
});

test('getSplitActivities planned preserves segment positions and strips virtual metadata', () => {
    const ctx = createPlannedRenderContext([
        {
            label: ' A ',
            seconds: 20 * 60,
            titleActivityId: ' title-a ',
            titleText: ' Title A ',
            activityId: ' activity-a ',
            activityText: ' Activity A ',
            startMinute: 0,
            durationMinutes: 20,
            endMinute: 20,
        },
        {
            kind: 'virtual-rest',
            virtual: true,
            label: '?댁떇',
            startMinute: 20,
            durationMinutes: 20,
            endMinute: 40,
        },
        {
            label: 'B',
            seconds: 20 * 60,
            startMinute: 40,
            durationMinutes: 20,
            endMinute: 60,
        },
    ]);

    const result = getSplitActivities.call(ctx, 'planned', 0);

    assert.deepEqual(result, [
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
            startMinute: 40,
            durationMinutes: 20,
            endMinute: 60,
        },
    ]);
    assert.equal(result.some(item => item.kind === 'virtual-rest' || item.virtual === true), false);
});
