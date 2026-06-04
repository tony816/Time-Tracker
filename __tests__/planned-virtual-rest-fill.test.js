const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const inlineController = require('../controllers/inline-plan-dropdown-controller');
const renderController = require('../controllers/time-entry-render-controller');
require('../core/actual-grid-core');
const planSegmentCore = require('../core/plan-segment-core');
const { buildMethod } = require('./helpers/script-method-builder');

const repoRoot = path.resolve(__dirname, '..');

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
const resolvePlannedSlotContext = buildMethod(
    'resolvePlannedSlotContext(index)',
    '(index)'
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
const attachPlanSegmentSelectionListeners = buildMethod(
    'attachPlanSegmentSelectionListeners(entryDiv, index)',
    '(entryDiv, index)'
);
const ensurePlanSegmentSelectionGlobalListeners = buildMethod(
    'ensurePlanSegmentSelectionGlobalListeners()',
    '()'
);
const getSelectedPlanSegment = buildMethod(
    'getSelectedPlanSegment()',
    '()'
);
const setSelectedPlanSegment = buildMethod(
    'setSelectedPlanSegment(baseIndex, segmentIndex, options = {})',
    '(baseIndex, segmentIndex, options = {})'
);
const openPlanSegmentReplacementDropdown = buildMethod(
    'openPlanSegmentReplacementDropdown(baseIndex, segmentIndex, segmentEl)',
    '(baseIndex, segmentIndex, segmentEl)'
);
const replacePlanSegmentActivity = buildMethod(
    'replacePlanSegmentActivity(baseIndex, segmentIndex, activityItem, parentItem = null)',
    '(baseIndex, segmentIndex, activityItem, parentItem = null)'
);
const replaceSelectedPlanSegmentActivity = buildMethod(
    'replaceSelectedPlanSegmentActivity(activityItem, parentItem = null)',
    '(activityItem, parentItem = null)'
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
        removeChild(child) {
            this.children = this.children.filter(item => item !== child);
            child.parentNode = null;
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
            this[String(name).replace(/-([a-z])/g, (_, ch) => ch.toUpperCase())] = String(value);
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

test('resolvePlannedSlotContext maps merged planned secondary rows to the base range', () => {
    const ctx = {
        mergedFields: new Map([['planned-0-1', 'Focus']]),
        findMergeKey(type, index) {
            if (type !== 'planned') return null;
            return index >= 0 && index <= 1 ? 'planned-0-1' : null;
        },
    };

    assert.deepEqual(resolvePlannedSlotContext.call(ctx, 1), {
        clickedIndex: 1,
        baseIndex: 0,
        rangeStart: 0,
        rangeEnd: 1,
        mergeKey: 'planned-0-1',
        isMerged: true,
        slotCount: 2,
        blockMinutes: 120,
    });
});

test('merged planned visualization uses base planActivities across the full merged block', () => {
    const ctx = createPlannedRenderContext([
        { label: 'A', seconds: 30 * 60, startMinute: 0, durationMinutes: 30, endMinute: 30 },
        { label: 'B', seconds: 30 * 60, startMinute: 60, durationMinutes: 30, endMinute: 90 },
    ]);
    ctx.timeSlots.push({ planned: '', planTitle: '', planTitleBandOn: false, planActivities: [] });
    ctx.mergedFields = new Map([['planned-0-1', 'A, B']]);
    ctx.findMergeKey = (type, index) => (type === 'planned' && index >= 0 && index <= 1 ? 'planned-0-1' : null);
    ctx.resolvePlannedSlotContext = function(index) {
        return resolvePlannedSlotContext.call(this, index);
    };
    ctx.getPlanSegmentBaseIndex = function(index) {
        return this.resolvePlannedSlotContext(index).baseIndex;
    };

    const baseResult = computeSplitSegments.call(ctx, 'planned', 0);
    const secondaryResult = computeSplitSegments.call(ctx, 'planned', 1);

    assert.equal(secondaryResult, null);
    assert.equal(baseResult.gridSegments.reduce((sum, segment) => sum + segment.span, 0), 12);
    const virtualGaps = baseResult.gridSegments.filter((segment) => segment.kind === 'virtual-rest');
    assert.deepEqual(virtualGaps.map((segment) => segment.durationMinutes), [30, 30]);
});

test('merged planned virtual rest fill writes only to the base slot timeline', () => {
    const { ctx, subBoard, anchor } = createGapFillContext();
    ctx.inlinePlanTarget = {
        startIndex: 0,
        endIndex: 1,
        baseIndex: 0,
        rangeStart: 0,
        rangeEnd: 1,
        mergeKey: 'planned-0-1',
        anchor,
        mode: 'virtual-rest-gap',
        gapStartMinute: 20,
        gapDurationMinutes: 20,
        blockMinutes: 120,
    };
    ctx.timeSlots.push({
        planned: 'stale secondary',
        planTitle: 'stale',
        planTitleBandOn: true,
        planActivities: [{ label: 'stale', seconds: 3600 }],
    });
    ctx.mergedFields.set('planned-0-1', 'A, B');

    const originalDocument = globalThis.document;
    globalThis.document = {
        createElement: createNode,
        querySelector() {
            return anchor;
        },
    };

    try {
        inlineController.openPlanActivityChildMenu.call(ctx, { id: 'fill', label: 'Fill' }, anchor, []);
        const selfRow = subBoard.children.find((node) => node.children[0] && String(node.children[0].className).includes('activity-chip-self'));
        selfRow.children[0].dispatchEvent({
            type: 'click',
            preventDefault() {},
            stopPropagation() {},
        });
    } finally {
        globalThis.document = originalDocument;
    }

    assert.deepEqual(ctx.timeSlots[0].planActivities.map((item) => ({
        label: item.label,
        seconds: item.seconds,
    })), [
        { label: 'A', seconds: 20 * 60 },
        { label: 'Fill', seconds: 20 * 60 },
        { label: 'B', seconds: 20 * 60 },
    ]);
    assert.deepEqual(ctx.timeSlots[1].planActivities, []);
    assert.equal(ctx.timeSlots[1].planned, '');
});

test('merged planned segment resize uses merged blockMinutes and stores on base slot', () => {
    const ctx = createPlannedRenderContext([
        { label: 'A', seconds: 60 * 60, startMinute: 0, durationMinutes: 60, endMinute: 60 },
    ]);
    ctx.timeSlots.push({ planned: '', planTitle: '', planTitleBandOn: false, planActivities: [] });
    ctx.mergedFields = new Map([['planned-0-1', 'A']]);
    ctx.findMergeKey = (type, index) => (type === 'planned' && index >= 0 && index <= 1 ? 'planned-0-1' : null);
    ctx.resolvePlannedSlotContext = function(index) {
        return resolvePlannedSlotContext.call(this, index);
    };
    ctx.getPlanSegmentBaseIndex = function(index) {
        return this.resolvePlannedSlotContext(index).baseIndex;
    };

    const result = applyPlanSegmentResize.call(ctx, 1, 0, 'right', 90);

    assert.equal(result, true);
    assert.equal(ctx.timeSlots[0].planActivities[0].durationMinutes, 90);
    assert.equal(ctx.timeSlots[0].planActivities[0].endMinute, 90);
    assert.deepEqual(ctx.timeSlots[1].planActivities, []);
    assert.equal(ctx.lastRenderContext.gridSegments.reduce((sum, segment) => sum + segment.span, 0), 12);
});

test('merged planned segment replacement from secondary row stores on base slot', () => {
    const ctx = createPlannedRenderContext([
        { label: 'A', seconds: 60 * 60, startMinute: 0, durationMinutes: 60, endMinute: 60 },
    ]);
    ctx.timeSlots.push({ planned: '', planTitle: '', planTitleBandOn: false, planActivities: [] });
    ctx.mergedFields = new Map([['planned-0-1', 'A']]);
    ctx.findMergeKey = (type, index) => (type === 'planned' && index >= 0 && index <= 1 ? 'planned-0-1' : null);
    ctx.resolvePlannedSlotContext = function(index) {
        return resolvePlannedSlotContext.call(this, index);
    };

    const replaced = replacePlanSegmentActivity.call(ctx, 1, 0, { id: 'b', label: 'B' });

    assert.equal(replaced, true);
    assert.equal(ctx.timeSlots[0].planActivities[0].label, 'B');
    assert.equal(ctx.timeSlots[0].planActivities[0].activityId, 'b');
    assert.deepEqual(ctx.timeSlots[1].planActivities, []);
});

function toDatasetKey(name) {
    return String(name || '').replace(/-([a-z])/g, (_, ch) => ch.toUpperCase());
}

function parseDataset(text = '') {
    const dataset = {};
    const pattern = /data-([a-z0-9-]+)="([^"]*)"/gi;
    let match;
    while ((match = pattern.exec(text))) {
        dataset[toDatasetKey(match[1])] = match[2];
    }
    return dataset;
}

function createClassList(node) {
    return {
        add(value) {
            const classes = new Set(String(node.className || '').split(/\s+/).filter(Boolean));
            classes.add(value);
            node.className = Array.from(classes).join(' ');
        },
        remove(value) {
            const classes = new Set(String(node.className || '').split(/\s+/).filter(Boolean));
            classes.delete(value);
            node.className = Array.from(classes).join(' ');
        },
        contains(value) {
            return String(node.className || '').split(/\s+/).includes(value);
        },
    };
}

function matchesSelector(node, selector) {
    if (!node || !selector) return false;
    if (String(selector).includes(',')) {
        return String(selector).split(',').some(part => matchesSelector(node, part.trim()));
    }
    const classMatch = /^\.([a-z0-9_-]+)/i.exec(selector);
    if (classMatch && !node.classList.contains(classMatch[1])) return false;
    const dataPattern = /\[data-([a-z0-9-]+)="([^"]*)"\]/gi;
    let dataMatch;
    while ((dataMatch = dataPattern.exec(selector))) {
        if (node.dataset[toDatasetKey(dataMatch[1])] !== dataMatch[2]) return false;
    }
    return Boolean(classMatch || selector.startsWith('[data-'));
}

function createRenderNode(tagName = 'div', state = {}) {
    const listeners = {};
    const node = {
        tagName: String(tagName || 'div').toUpperCase(),
        children: [],
        parentNode: null,
        dataset: {},
        className: '',
        style: {},
        textContent: '',
        _innerHTML: '',
        classList: null,
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
        setPointerCapture(pointerId) {
            this.capturedPointerId = pointerId;
        },
        releasePointerCapture(pointerId) {
            this.releasedPointerId = pointerId;
        },
        setAttribute(name, value) {
            this[name] = String(value);
            this[String(name).replace(/-([a-z])/g, (_, ch) => ch.toUpperCase())] = String(value);
        },
        getBoundingClientRect() {
            return this.rect || { width: state.gridWidth || 60, height: 24, left: 0, right: state.gridWidth || 60 };
        },
        closest(selector) {
            let current = this;
            while (current) {
                if (matchesSelector(current, selector)) return current;
                current = current.parentNode;
            }
            return null;
        },
        querySelector(selector) {
            return this.querySelectorAll(selector)[0] || null;
        },
        querySelectorAll(selector) {
            const result = [];
            const visit = (child) => {
                if (matchesSelector(child, selector)) result.push(child);
                child.children.forEach(visit);
            };
            this.children.forEach(visit);
            return result;
        },
    };
    node.classList = createClassList(node);
    Object.defineProperty(node, 'innerHTML', {
        get() {
            return this._innerHTML;
        },
        set(value) {
            this._innerHTML = String(value || '');
            this.children = [];
            if (!this._innerHTML) return;
            parseRenderedEntryHtml(this, this._innerHTML, state);
        },
    });
    return node;
}

function parseRenderedEntryHtml(entryNode, html, state) {
    if (/class="[^"]*\bplanned-input\b/.test(html)) {
        const input = createRenderNode('input', state);
        input.className = 'input-field planned-input';
        entryNode.appendChild(input);
    }

    if (!html.includes('class="split-grid"')) return;
    const grid = createRenderNode('div', state);
    grid.className = 'split-grid';
    grid.rect = { width: state.gridWidth || 60, height: 24, left: 0, right: state.gridWidth || 60 };
    entryNode.appendChild(grid);

    const segmentPattern = /<div class="split-grid-segment([^"]*)"([^>]*)>/g;
    const matches = Array.from(html.matchAll(segmentPattern));
    matches.forEach((match, index) => {
        const segmentHtmlStart = match.index;
        const segmentHtmlEnd = index + 1 < matches.length ? matches[index + 1].index : html.length;
        const segmentHtml = html.slice(segmentHtmlStart, segmentHtmlEnd);
        const segment = createRenderNode('div', state);
        segment.className = `split-grid-segment${match[1]}`;
        segment.dataset = parseDataset(match[2]);
        grid.appendChild(segment);

        if (segmentHtml.includes('plan-segment-resize-handle-left')) {
            const left = createRenderNode('span', state);
            left.className = 'plan-segment-resize-handle plan-segment-resize-handle-left';
            left.dataset = { resizeEdge: 'left' };
            segment.appendChild(left);
        }
        if (segmentHtml.includes('plan-segment-resize-handle-right')) {
            const right = createRenderNode('span', state);
            right.className = 'plan-segment-resize-handle plan-segment-resize-handle-right';
            right.dataset = { resizeEdge: 'right' };
            segment.appendChild(right);
        }
    });
}

function createRenderDocument(state = {}) {
    const container = createRenderNode('div', state);
    const documentListeners = {};
    return {
        container,
        document: {
            createElement(tagName) {
                return createRenderNode(tagName, state);
            },
            getElementById(id) {
                return id === 'timeEntries' ? container : null;
            },
            addEventListener(type, handler) {
                documentListeners[type] = handler;
            },
            removeEventListener(type, handler) {
                if (documentListeners[type] === handler) delete documentListeners[type];
            },
            dispatch(type, event = {}) {
                if (documentListeners[type]) documentListeners[type](event);
            },
        },
    };
}

function createRenderedResizeContext(planActivities, options = {}) {
    const state = { gridWidth: options.gridWidth || 60 };
    const { container, document } = createRenderDocument(state);
    const ctx = createPlannedRenderContext(planActivities, {
        resizeAttachCalls: 0,
        getCurrentTimeIndex() {
            return 0;
        },
        closeInlinePlanDropdown() {},
        buildTimeEntryRowModel(slot, index) {
            const planned = renderController.wrapWithSplitVisualization.call(
                this,
                'planned',
                index,
                `<input type="text" class="input-field planned-input" data-index="${index}" data-type="planned">`
            );
            return {
                routineMatch: null,
                hasPlannedMergeContinuation: false,
                hasActualMergeContinuation: false,
                innerHtml: planned,
            };
        },
        buildSplitVisualization(type, index) {
            return renderController.buildSplitVisualization.call(this, type, index);
        },
        computeSplitSegments(type, index) {
            return computeSplitSegments.call(this, type, index);
        },
        renderTimeEntries(preserveInlineDropdown = false) {
            return renderController.renderTimeEntries.call(this, preserveInlineDropdown);
        },
        attachPlanSegmentResizeListeners(entryDiv, index) {
            this.resizeAttachCalls += 1;
            return attachPlanSegmentResizeListeners.call(this, entryDiv, index);
        },
        attachPlanSegmentSelectionListeners(entryDiv, index) {
            return attachPlanSegmentSelectionListeners.call(this, entryDiv, index);
        },
        ensurePlanSegmentSelectionGlobalListeners() {
            return ensurePlanSegmentSelectionGlobalListeners.call(this);
        },
        setSelectedPlanSegment(baseIndex, segmentIndex, options = {}) {
            return setSelectedPlanSegment.call(this, baseIndex, segmentIndex, options);
        },
        attachFieldSelectionListeners() {},
        attachCellClickListeners() {},
        attachTimerListeners() {},
        attachActivityLogListener() {},
        attachRowWideClickTargets() {},
        centerMergedTimeContent() {},
        resizeMergedActualContent() {},
        resizeMergedPlannedContent() {},
        getMobileTimeUiState(index) {
            return { hostIndex: index, mode: 'idle', showControls: false, isCurrent: false, status: 'idle' };
        },
        escapeHtml(value) {
            return String(value);
        },
        escapeAttribute(value) {
            return String(value);
        },
        ...options.overrides,
    });
    return { ctx, container, document };
}

function dragResizeHandle(documentStub, handle, originX, moveX) {
    let prevented = false;
    let stopped = false;
    handle.dispatchEvent({
        type: 'pointerdown',
        target: handle,
        button: 0,
        pointerId: 1,
        clientX: originX,
        preventDefault() { prevented = true; },
        stopPropagation() { stopped = true; },
    });
    documentStub.dispatch('pointermove', {
        clientX: moveX,
        preventDefault() {},
        stopPropagation() {},
    });
    documentStub.dispatch('pointerup', {});
    return { prevented, stopped };
}

function startResizePreview(handle, originX) {
    let prevented = false;
    let stopped = false;
    handle.dispatchEvent({
        type: 'pointerdown',
        target: handle,
        button: 0,
        pointerId: 1,
        clientX: originX,
        preventDefault() { prevented = true; },
        stopPropagation() { stopped = true; },
    });
    return { prevented, stopped };
}

function moveResizePreview(documentStub, clientX) {
    documentStub.dispatch('pointermove', {
        clientX,
        preventDefault() {},
        stopPropagation() {},
    });
}

function finishResizePreview(documentStub, clientX) {
    documentStub.dispatch('pointerup', {
        clientX,
        preventDefault() {},
        stopPropagation() {},
    });
}

function cancelResizePreview(documentStub) {
    documentStub.dispatch('pointercancel', {
        preventDefault() {},
        stopPropagation() {},
    });
}

function getPreviewSegments(container) {
    return container.querySelectorAll('.plan-segment-resize-preview-segment').map((segment) => ({
        className: segment.className,
        gridColumn: segment.style.gridColumn,
        color: segment.style['--split-segment-color'] || '',
        label: segment.children[0] ? segment.children[0].textContent : '',
        duration: segment.children[1] ? segment.children[1].textContent : '',
    }));
}

test('clicking a virtual rest gap opens the existing inline plan dropdown with gap metadata', () => {
    const gap = createNode();
    gap.dataset = {
        gapStartMinute: '20',
        gapDurationMinutes: '20',
    };
    gap.getBoundingClientRect = () => ({ width: 620 });
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
    assert.equal(calls[0].anchor, gap);
    assert.equal(calls[0].options.mode, 'virtual-rest-gap');
    assert.equal(calls[0].options.gapStartMinute, 20);
    assert.equal(calls[0].options.gapDurationMinutes, 20);
    assert.equal(calls[0].options.anchorMinWidth, 620);
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

test('renderTimeEntries attaches resize listeners to rendered plan segment handles', () => {
    const originalDocument = globalThis.document;
    const { ctx, container, document } = createRenderedResizeContext([
        { label: 'A', seconds: 60 * 60, startMinute: 0, durationMinutes: 60, endMinute: 60 },
    ]);
    globalThis.document = document;

    try {
        ctx.renderTimeEntries(true);
    } finally {
        globalThis.document = originalDocument;
    }

    const handle = container.querySelector('.plan-segment-resize-handle-right');
    assert.ok(handle);
    assert.equal(ctx.resizeAttachCalls, 1);
    assert.equal(handle.dataset.resizeListenerAttached, 'true');
});

test('renderTimeEntries does not render full-row virtual rest for empty planned slots', () => {
    const originalDocument = globalThis.document;
    const { ctx, container, document } = createRenderedResizeContext([]);
    globalThis.document = document;

    try {
        ctx.renderTimeEntries(true);
    } finally {
        globalThis.document = originalDocument;
    }

    assert.equal(container.querySelector('.split-grid-segment-virtual-rest'), null);
    assert.equal(container.querySelector('[data-segment-kind="virtual-rest"]'), null);
    assert.equal(container._innerHTML.includes('휴식'), false);
});

test('index.html loads plan segment core before app bootstrap for rendered resize', () => {
    const indexHtml = fs.readFileSync(path.join(repoRoot, 'index.html'), 'utf8');
    const planCoreIndex = indexHtml.indexOf('src="core/plan-segment-core.js"');
    const scriptIndex = indexHtml.indexOf('src="script.js"');
    const mainIndex = indexHtml.indexOf('src="main.js"');

    assert.ok(planCoreIndex >= 0);
    assert.ok(scriptIndex > planCoreIndex);
    assert.ok(mainIndex > scriptIndex);
});

test('rendered DOM right-handle drag shrinks segment, rerenders gap, and reattaches listener', () => {
    const originalDocument = globalThis.document;
    const { ctx, container, document } = createRenderedResizeContext([
        { label: 'A', seconds: 60 * 60, startMinute: 0, durationMinutes: 60, endMinute: 60 },
    ]);
    const applyCalls = [];
    ctx.applyPlanSegmentResize = function(baseIndex, segmentIndex, edge, targetMinute) {
        applyCalls.push({ baseIndex, segmentIndex, edge, targetMinute });
        return applyPlanSegmentResize.call(this, baseIndex, segmentIndex, edge, targetMinute);
    };
    globalThis.document = document;

    try {
        ctx.renderTimeEntries(true);
        const firstHandle = container.querySelector('.plan-segment-resize-handle-right');
        assert.ok(firstHandle);

        const dragState = dragResizeHandle(document, firstHandle, 0, -10);
        assert.deepEqual(dragState, { prevented: true, stopped: true });
        assert.deepEqual(applyCalls[0], { baseIndex: 0, segmentIndex: 0, edge: 'right', targetMinute: 50 });
        assert.deepEqual(ctx.timeSlots[0].planActivities[0], {
            label: 'A',
            seconds: 50 * 60,
            startMinute: 0,
            durationMinutes: 50,
            endMinute: 50,
        });
        assert.equal(ctx.timeSlots[0].planActivities.some(item => item.kind === 'virtual-rest' || item.virtual === true), false);
        assert.equal(container.querySelector('.split-grid-segment[data-segment-kind="real-plan"]').dataset.segmentEndMinute, '50');
        const firstGap = container.querySelector('.split-grid-segment-virtual-rest[data-segment-kind="virtual-rest"]');
        assert.equal(firstGap.dataset.gapStartMinute, '50');
        assert.equal(firstGap.dataset.gapDurationMinutes, '10');
        assert.equal(firstGap.querySelector('.plan-segment-resize-handle-left'), null);

        const secondHandle = container.querySelector('.plan-segment-resize-handle-right');
        assert.ok(secondHandle);
        assert.equal(secondHandle.dataset.resizeListenerAttached, 'true');
        dragResizeHandle(document, secondHandle, 0, -10);
        assert.deepEqual(applyCalls[1], { baseIndex: 0, segmentIndex: 0, edge: 'right', targetMinute: 40 });
        assert.equal(ctx.timeSlots[0].planActivities[0].durationMinutes, 40);
        assert.equal(ctx.timeSlots[0].planActivities[0].endMinute, 40);
    } finally {
        globalThis.document = originalDocument;
    }
});

test('rendered DOM drag consumes adjacent gap but clamps before next real segment', () => {
    const originalDocument = globalThis.document;
    const gapCase = createRenderedResizeContext([
        { label: 'A', seconds: 30 * 60, startMinute: 0, durationMinutes: 30, endMinute: 30 },
    ]);
    gapCase.ctx.applyPlanSegmentResize = function(baseIndex, segmentIndex, edge, targetMinute) {
        return applyPlanSegmentResize.call(this, baseIndex, segmentIndex, edge, targetMinute);
    };
    globalThis.document = gapCase.document;

    try {
        gapCase.ctx.renderTimeEntries(true);
        dragResizeHandle(gapCase.document, gapCase.container.querySelector('.plan-segment-resize-handle-right'), 0, 10);
        assert.equal(gapCase.ctx.timeSlots[0].planActivities[0].endMinute, 40);
        assert.equal(gapCase.ctx.timeSlots[0].planActivities[0].durationMinutes, 40);
        const gap = gapCase.container.querySelector('.split-grid-segment-virtual-rest[data-segment-kind="virtual-rest"]');
        assert.equal(gap.dataset.gapStartMinute, '40');
        assert.equal(gap.dataset.gapDurationMinutes, '20');

        const blockedCase = createRenderedResizeContext([
            { label: 'A', seconds: 30 * 60, startMinute: 0, durationMinutes: 30, endMinute: 30 },
            { label: 'B', seconds: 20 * 60, startMinute: 40, durationMinutes: 20, endMinute: 60 },
        ]);
        const calls = [];
        blockedCase.ctx.applyPlanSegmentResize = function(baseIndex, segmentIndex, edge, targetMinute) {
            calls.push({ baseIndex, segmentIndex, edge, targetMinute });
            return applyPlanSegmentResize.call(this, baseIndex, segmentIndex, edge, targetMinute);
        };
        globalThis.document = blockedCase.document;
        blockedCase.ctx.renderTimeEntries(true);
        dragResizeHandle(blockedCase.document, blockedCase.container.querySelector('.plan-segment-resize-handle-right'), 0, 30);
        assert.deepEqual(calls, [{ baseIndex: 0, segmentIndex: 0, edge: 'right', targetMinute: 60 }]);
        assert.deepEqual(blockedCase.ctx.timeSlots[0].planActivities.map(item => ({
            label: item.label,
            startMinute: item.startMinute,
            endMinute: item.endMinute,
            durationMinutes: item.durationMinutes,
        })), [
            { label: 'A', startMinute: 0, endMinute: 40, durationMinutes: 40 },
            { label: 'B', startMinute: 40, endMinute: 60, durationMinutes: 20 },
        ]);
        const realSegments = blockedCase.container.querySelectorAll('.split-grid-segment[data-segment-kind="real-plan"]');
        assert.equal(realSegments[0].dataset.segmentEndMinute, '40');
        assert.equal(realSegments[1].dataset.segmentStartMinute, '40');
        assert.equal(blockedCase.container.querySelector('.split-grid-segment-virtual-rest[data-segment-kind="virtual-rest"]'), null);
    } finally {
        globalThis.document = originalDocument;
    }
});

test('rendered DOM drag moves adjacent planned segment boundary without opening title edit', () => {
    const originalDocument = globalThis.document;
    const { ctx, container, document } = createRenderedResizeContext([
        { label: '샤워', seconds: 30 * 60, startMinute: 0, durationMinutes: 30, endMinute: 30 },
        { label: '이동/저녁준비', seconds: 30 * 60, startMinute: 30, durationMinutes: 30, endMinute: 60 },
    ]);
    const calls = [];
    ctx.applyPlanSegmentResize = function(baseIndex, segmentIndex, edge, targetMinute) {
        calls.push({ baseIndex, segmentIndex, edge, targetMinute });
        return applyPlanSegmentResize.call(this, baseIndex, segmentIndex, edge, targetMinute);
    };
    globalThis.document = document;

    try {
        ctx.renderTimeEntries(true);
        const firstRightHandle = container.querySelector('.plan-segment-resize-handle-right');
        assert.ok(firstRightHandle);

        const dragState = dragResizeHandle(document, firstRightHandle, 0, 10);
        assert.deepEqual(dragState, { prevented: true, stopped: true });
        assert.deepEqual(calls, [{ baseIndex: 0, segmentIndex: 0, edge: 'right', targetMinute: 40 }]);
        assert.deepEqual(ctx.timeSlots[0].planActivities.map(item => ({
            label: item.label,
            startMinute: item.startMinute,
            endMinute: item.endMinute,
            durationMinutes: item.durationMinutes,
            seconds: item.seconds,
        })), [
            { label: '샤워', startMinute: 0, endMinute: 40, durationMinutes: 40, seconds: 40 * 60 },
            { label: '이동/저녁준비', startMinute: 40, endMinute: 60, durationMinutes: 20, seconds: 20 * 60 },
        ]);
        assert.equal(container.querySelector('.split-grid-segment-virtual-rest[data-segment-kind="virtual-rest"]'), null);
        assert.equal(container.querySelector('.plan-segment-title-edit-input'), null);
    } finally {
        globalThis.document = originalDocument;
    }
});

test('clicking real planned segment background opens segment-scoped inline dropdown', () => {
    const originalDocument = globalThis.document;
    const dropdownCalls = [];
    const { ctx, container, document } = createRenderedResizeContext([
        { label: 'A', seconds: 30 * 60, startMinute: 0, durationMinutes: 30, endMinute: 30 },
        { label: 'B', seconds: 30 * 60, startMinute: 30, durationMinutes: 30, endMinute: 60 },
    ], { overrides: {
        openPlanSegmentReplacementDropdown(baseIndex, segmentIndex, segmentEl) {
            return openPlanSegmentReplacementDropdown.call(this, baseIndex, segmentIndex, segmentEl);
        },
        openInlinePlanDropdown(startIndex, anchor, endIndex, options) {
            dropdownCalls.push({ startIndex, anchor, endIndex, options });
            this.inlinePlanTarget = { startIndex, endIndex, anchor, ...options };
        },
    } });
    globalThis.document = document;

    try {
        ctx.renderTimeEntries(true);
        const firstSegment = container.querySelector('.split-grid-segment[data-segment-kind="real-plan"]');
        assert.ok(firstSegment);
        const resizeHandle = firstSegment.querySelector('.plan-segment-resize-handle');
        assert.ok(resizeHandle);
        firstSegment.dispatchEvent({
            type: 'click',
            button: 0,
            target: resizeHandle,
            preventDefault() {},
            stopPropagation() {},
        });
        assert.equal(ctx.selectedPlanSegment, undefined);
        assert.equal(dropdownCalls.length, 0);

        firstSegment.dispatchEvent({
            type: 'click',
            button: 0,
            target: firstSegment,
            preventDefault() {},
            stopPropagation() {},
        });

        assert.equal(dropdownCalls.length, 1);
        assert.equal(dropdownCalls[0].startIndex, 0);
        assert.equal(dropdownCalls[0].endIndex, 0);
        assert.equal(dropdownCalls[0].anchor, firstSegment);
        assert.equal(dropdownCalls[0].options.mode, 'plan-segment-replace');
        assert.equal(dropdownCalls[0].options.segmentIndex, 0);
        assert.equal(dropdownCalls[0].options.segmentId, firstSegment.dataset.segmentId);
        assert.equal(ctx.selectedPlanSegment, undefined);
        assert.equal(container.querySelector('.plan-segment-title-edit-input'), null);
    } finally {
        globalThis.document = originalDocument;
    }
});

test('selected planned segment activity replacement preserves range and neighbors', () => {
    const ctx = createPlannedRenderContext([
        { label: 'A', activityText: 'A', activityId: 'a', seconds: 20 * 60, startMinute: 0, durationMinutes: 20, endMinute: 20 },
        { label: 'B', activityText: 'B', activityId: 'b', seconds: 40 * 60, startMinute: 20, durationMinutes: 40, endMinute: 60 },
    ], {
        renderCalls: 0,
        selectedPlanSegment: { baseIndex: 0, segmentIndex: 1 },
        renderTimeEntries() {
            this.renderCalls += 1;
        },
    });
    ctx.replacePlanSegmentActivity = function(baseIndex, segmentIndex, activityItem, parentItem = null) {
        return replacePlanSegmentActivity.call(this, baseIndex, segmentIndex, activityItem, parentItem);
    };
    ctx.replaceSelectedPlanSegmentActivity = function(activityItem, parentItem = null) {
        return replaceSelectedPlanSegmentActivity.call(this, activityItem, parentItem);
    };
    ctx.getSelectedPlanSegment = function() {
        return getSelectedPlanSegment.call(this);
    };

    const catalogItem = { id: 'c', label: 'C' };
    assert.equal(ctx.replaceSelectedPlanSegmentActivity(catalogItem), true);

    assert.deepEqual(ctx.timeSlots[0].planActivities.map((item) => ({
        label: item.label,
        activityText: item.activityText,
        activityId: item.activityId,
        startMinute: item.startMinute,
        endMinute: item.endMinute,
        durationMinutes: item.durationMinutes,
        seconds: item.seconds,
    })), [
        { label: 'A', activityText: 'A', activityId: 'a', startMinute: 0, endMinute: 20, durationMinutes: 20, seconds: 1200 },
        { label: 'C', activityText: 'C', activityId: 'c', startMinute: 20, endMinute: 60, durationMinutes: 40, seconds: 2400 },
    ]);
    assert.deepEqual(catalogItem, { id: 'c', label: 'C' });
    assert.deepEqual(ctx.selectedPlanSegment, { baseIndex: 0, segmentIndex: 1 });
    assert.equal(ctx.renderCalls, 1);

    const childItem = { id: 'child-review', label: 'Review' };
    const parentItem = { id: 'parent-study', label: 'Study' };
    assert.equal(ctx.replaceSelectedPlanSegmentActivity(childItem, parentItem), true);
    assert.equal(ctx.timeSlots[0].planActivities[1].label, 'Review');
    assert.equal(ctx.timeSlots[0].planActivities[1].activityText, 'Review');
    assert.equal(ctx.timeSlots[0].planActivities[1].activityId, 'child-review');
    assert.equal(ctx.timeSlots[0].planActivities[1].titleText, 'Study');
    assert.equal(ctx.timeSlots[0].planActivities[1].titleActivityId, 'parent-study');
    assert.equal(ctx.timeSlots[0].planActivities[1].startMinute, 20);
    assert.equal(ctx.timeSlots[0].planActivities[1].endMinute, 60);
    assert.deepEqual(childItem, { id: 'child-review', label: 'Review' });
    assert.deepEqual(parentItem, { id: 'parent-study', label: 'Study' });
});

test('plan segment replacement without id clears stale activity id', () => {
    const ctx = createPlannedRenderContext([
        { label: 'Shower', activityText: 'Shower', activityId: 'shower', seconds: 20 * 60, startMinute: 0, durationMinutes: 20, endMinute: 20 },
    ]);

    assert.equal(replacePlanSegmentActivity.call(ctx, 0, 0, { label: 'Reading', name: 'Reading', activityText: 'Reading' }), true);

    assert.deepEqual(ctx.timeSlots[0].planActivities.map((item) => ({
        label: item.label,
        activityText: item.activityText,
        activityId: item.activityId,
        startMinute: item.startMinute,
        endMinute: item.endMinute,
        durationMinutes: item.durationMinutes,
        seconds: item.seconds,
    })), [
        { label: 'Reading', activityText: 'Reading', activityId: null, startMinute: 0, endMinute: 20, durationMinutes: 20, seconds: 1200 },
    ]);
    assert.notEqual(ctx.timeSlots[0].planActivities[0].activityId, 'shower');
});

test('plan segment replacement with id uses new activity id', () => {
    const ctx = createPlannedRenderContext([
        { label: 'Shower', activityText: 'Shower', activityId: 'shower', seconds: 20 * 60, startMinute: 0, durationMinutes: 20, endMinute: 20 },
    ]);

    assert.equal(replacePlanSegmentActivity.call(ctx, 0, 0, { id: 'reading', label: 'Reading', name: 'Reading' }), true);

    assert.equal(ctx.timeSlots[0].planActivities[0].label, 'Reading');
    assert.equal(ctx.timeSlots[0].planActivities[0].activityText, 'Reading');
    assert.equal(ctx.timeSlots[0].planActivities[0].activityId, 'reading');
    assert.notEqual(ctx.timeSlots[0].planActivities[0].activityId, 'shower');
    assert.equal(ctx.timeSlots[0].planActivities[0].startMinute, 0);
    assert.equal(ctx.timeSlots[0].planActivities[0].endMinute, 20);
    assert.equal(ctx.timeSlots[0].planActivities[0].durationMinutes, 20);
    assert.equal(ctx.timeSlots[0].planActivities[0].seconds, 1200);
});

test('plan segment replacement preserves numeric zero activity id', () => {
    const ctx = createPlannedRenderContext([
        { label: 'Old', activityText: 'Old', activityId: 'old-id', seconds: 20 * 60, startMinute: 0, durationMinutes: 20, endMinute: 20 },
    ]);

    assert.equal(replacePlanSegmentActivity.call(ctx, 0, 0, { id: 0, label: 'Zero Id Activity', name: 'Zero Id Activity' }), true);

    assert.deepEqual(ctx.timeSlots[0].planActivities.map((item) => ({
        label: item.label,
        activityText: item.activityText,
        activityId: item.activityId,
        startMinute: item.startMinute,
        endMinute: item.endMinute,
        durationMinutes: item.durationMinutes,
        seconds: item.seconds,
    })), [
        { label: 'Zero Id Activity', activityText: 'Zero Id Activity', activityId: '0', startMinute: 0, endMinute: 20, durationMinutes: 20, seconds: 1200 },
    ]);
    assert.notEqual(ctx.timeSlots[0].planActivities[0].activityId, null);
    assert.notEqual(ctx.timeSlots[0].planActivities[0].activityId, 'old-id');
});

test('child plan segment replacement clears stale child and parent ids when new items lack ids', () => {
    const ctx = createPlannedRenderContext([
        {
            label: 'Squat',
            activityText: 'Squat',
            activityId: 'squat',
            titleText: 'Exercise',
            titleActivityId: 'exercise',
            seconds: 30 * 60,
            startMinute: 0,
            durationMinutes: 30,
            endMinute: 30,
        },
    ]);

    assert.equal(
        replacePlanSegmentActivity.call(ctx, 0, 0, { label: 'Reading Notes', name: 'Reading Notes' }, { label: 'Reading', name: 'Reading' }),
        true
    );

    assert.deepEqual(ctx.timeSlots[0].planActivities.map((item) => ({
        label: item.label,
        activityText: item.activityText,
        activityId: item.activityId,
        titleText: item.titleText,
        titleActivityId: item.titleActivityId,
        startMinute: item.startMinute,
        endMinute: item.endMinute,
        durationMinutes: item.durationMinutes,
        seconds: item.seconds,
    })), [
        {
            label: 'Reading Notes',
            activityText: 'Reading Notes',
            activityId: null,
            titleText: 'Reading',
            titleActivityId: null,
            startMinute: 0,
            endMinute: 30,
            durationMinutes: 30,
            seconds: 1800,
        },
    ]);
    assert.notEqual(ctx.timeSlots[0].planActivities[0].activityId, 'squat');
    assert.notEqual(ctx.timeSlots[0].planActivities[0].titleActivityId, 'exercise');
});

test('child plan segment replacement preserves numeric zero child and parent ids', () => {
    const ctx = createPlannedRenderContext([
        {
            label: 'Old Child',
            activityText: 'Old Child',
            activityId: 'old-child-id',
            titleText: 'Old Parent',
            titleActivityId: 'old-parent-id',
            seconds: 30 * 60,
            startMinute: 0,
            durationMinutes: 30,
            endMinute: 30,
        },
    ]);

    assert.equal(
        replacePlanSegmentActivity.call(ctx, 0, 0, { id: 0, label: 'Zero Child', name: 'Zero Child' }, { id: 0, label: 'Zero Parent', name: 'Zero Parent' }),
        true
    );

    assert.deepEqual(ctx.timeSlots[0].planActivities.map((item) => ({
        label: item.label,
        activityText: item.activityText,
        activityId: item.activityId,
        titleText: item.titleText,
        titleActivityId: item.titleActivityId,
        startMinute: item.startMinute,
        endMinute: item.endMinute,
        durationMinutes: item.durationMinutes,
        seconds: item.seconds,
    })), [
        {
            label: 'Zero Child',
            activityText: 'Zero Child',
            activityId: '0',
            titleText: 'Zero Parent',
            titleActivityId: '0',
            startMinute: 0,
            endMinute: 30,
            durationMinutes: 30,
            seconds: 1800,
        },
    ]);
    assert.notEqual(ctx.timeSlots[0].planActivities[0].activityId, 'old-child-id');
    assert.notEqual(ctx.timeSlots[0].planActivities[0].titleActivityId, 'old-parent-id');
});

test('parent plan segment replacement clears previous child metadata', () => {
    const ctx = createPlannedRenderContext([
        {
            label: 'Squat',
            activityText: 'Squat',
            activityId: 'squat',
            titleText: 'Exercise',
            titleActivityId: 'exercise',
            seconds: 30 * 60,
            startMinute: 0,
            durationMinutes: 30,
            endMinute: 30,
        },
    ]);

    assert.equal(replacePlanSegmentActivity.call(ctx, 0, 0, { id: 'study', label: 'Study', name: 'Study' }), true);

    assert.deepEqual(ctx.timeSlots[0].planActivities.map((item) => ({
        label: item.label,
        activityText: item.activityText,
        activityId: item.activityId,
        titleText: item.titleText,
        titleActivityId: item.titleActivityId,
        startMinute: item.startMinute,
        endMinute: item.endMinute,
        durationMinutes: item.durationMinutes,
        seconds: item.seconds,
    })), [
        {
            label: 'Study',
            activityText: 'Study',
            activityId: 'study',
            titleText: undefined,
            titleActivityId: undefined,
            startMinute: 0,
            endMinute: 30,
            durationMinutes: 30,
            seconds: 1800,
        },
    ]);
});

test('plan segment resize preview updates adjacent boundary without mutating data on pointermove', () => {
    const originalDocument = globalThis.document;
    const { ctx, container, document } = createRenderedResizeContext([
        { label: '샤워', seconds: 30 * 60, startMinute: 0, durationMinutes: 30, endMinute: 30 },
        { label: '이동/저녁준비', seconds: 30 * 60, startMinute: 30, durationMinutes: 30, endMinute: 60 },
    ]);
    const originalPlan = JSON.stringify(ctx.timeSlots[0].planActivities);
    const applyCalls = [];
    ctx.applyPlanSegmentResize = function(baseIndex, segmentIndex, edge, targetMinute) {
        applyCalls.push({ baseIndex, segmentIndex, edge, targetMinute });
        return true;
    };
    ctx.renderTimeEntries = function(preserveInlineDropdown = false) {
        return renderController.renderTimeEntries.call(this, preserveInlineDropdown);
    };
    globalThis.document = document;

    try {
        ctx.renderTimeEntries(true);
        const handle = container.querySelector('.plan-segment-resize-handle-right');
        assert.ok(handle);
        assert.deepEqual(startResizePreview(handle, 0), { prevented: true, stopped: true });

        moveResizePreview(document, 10);

        const layer = container.querySelector('.plan-segment-resize-preview-layer');
        assert.ok(layer);
        assert.equal(layer.ariaHidden, 'true');
        assert.equal(layer.style.gridTemplateColumns, 'repeat(6, 1fr)');
        assert.equal(container.querySelector('.split-grid').classList.contains('is-previewing-plan-resize'), true);
        assert.deepEqual(getPreviewSegments(container), [
            { className: 'plan-segment-resize-preview-segment', gridColumn: 'span 4', color: '#abcdef', label: '샤워', duration: '40m' },
            { className: 'plan-segment-resize-preview-segment', gridColumn: 'span 2', color: '#abcdef', label: '이동/저녁준비', duration: '20m' },
        ]);
        assert.equal(JSON.stringify(ctx.timeSlots[0].planActivities), originalPlan);
        assert.deepEqual(applyCalls, []);
        assert.equal(container.querySelector('.plan-segment-title-edit-input'), null);

        finishResizePreview(document, 10);

        assert.equal(container.querySelector('.plan-segment-resize-preview-layer'), null);
        assert.equal(container.querySelector('.split-grid').classList.contains('is-previewing-plan-resize'), false);
        assert.deepEqual(applyCalls, [{ baseIndex: 0, segmentIndex: 0, edge: 'right', targetMinute: 40 }]);
    } finally {
        globalThis.document = originalDocument;
    }
});

test('merged plan segment resize preview uses the same six-unit row wrap as rendered segments', () => {
    const originalDocument = globalThis.document;
    const { ctx, container, document } = createRenderedResizeContext([
        { label: 'A', seconds: 60 * 60, startMinute: 0, durationMinutes: 60, endMinute: 60 },
        { label: 'B', seconds: 80 * 60, startMinute: 60, durationMinutes: 80, endMinute: 140 },
        { label: 'C', seconds: 40 * 60, startMinute: 140, durationMinutes: 40, endMinute: 180 },
    ], {
        overrides: {
            timeSlots: [
                {
                    planned: 'A, B, C',
                    planTitle: '',
                    planTitleBandOn: false,
                    planActivities: [
                        { label: 'A', seconds: 60 * 60, startMinute: 0, durationMinutes: 60, endMinute: 60 },
                        { label: 'B', seconds: 80 * 60, startMinute: 60, durationMinutes: 80, endMinute: 140 },
                        { label: 'C', seconds: 40 * 60, startMinute: 140, durationMinutes: 40, endMinute: 180 },
                    ],
                },
                { planned: '', planTitle: '', planTitleBandOn: false, planActivities: [] },
                { planned: '', planTitle: '', planTitleBandOn: false, planActivities: [] },
            ],
            mergedFields: new Map([['planned-0-2', 'A, B, C']]),
            findMergeKey(type, index) {
                return type === 'planned' && index >= 0 && index <= 2 ? 'planned-0-2' : null;
            },
            resolvePlannedSlotContext(index) {
                return resolvePlannedSlotContext.call(this, index);
            },
            getSplitBaseIndex(type, index) {
                assert.equal(type, 'planned');
                return this.resolvePlannedSlotContext(index).baseIndex;
            },
            getSplitRange(type, index) {
                assert.equal(type, 'planned');
                const context = this.resolvePlannedSlotContext(index);
                return { start: context.rangeStart, end: context.rangeEnd };
            },
            getPlanSegmentBaseIndex(index) {
                return this.resolvePlannedSlotContext(index).baseIndex;
            },
            getBlockLength(type, index) {
                assert.equal(type, 'planned');
                assert.equal(index, 0);
                return 3;
            },
        },
    });
    const applyCalls = [];
    ctx.applyPlanSegmentResize = function(baseIndex, segmentIndex, edge, targetMinute) {
        applyCalls.push({ baseIndex, segmentIndex, edge, targetMinute });
        return true;
    };
    ctx.renderTimeEntries = function(preserveInlineDropdown = false) {
        return renderController.renderTimeEntries.call(this, preserveInlineDropdown);
    };
    globalThis.document = document;

    try {
        ctx.renderTimeEntries(true);
        const handle = container.querySelector('.plan-segment-resize-handle-right');
        assert.ok(handle);
        assert.deepEqual(startResizePreview(handle, 0), { prevented: true, stopped: true });
        moveResizePreview(document, 10);

        const layer = container.querySelector('.plan-segment-resize-preview-layer');
        assert.ok(layer);
        assert.equal(layer.style.gridTemplateColumns, 'repeat(6, 1fr)');
        assert.equal(container.querySelector('.split-grid').classList.contains('is-previewing-plan-resize'), true);
        const preview = getPreviewSegments(container);
        assert.deepEqual(preview.map(segment => segment.gridColumn), ['span 6', 'span 1', 'span 5', 'span 2', 'span 4']);
        assert.deepEqual(preview.map(segment => segment.label), ['A', 'A', 'B', 'B', 'C']);
        assert.deepEqual(applyCalls, []);

        finishResizePreview(document, 10);
        assert.deepEqual(applyCalls, [{ baseIndex: 0, segmentIndex: 0, edge: 'right', targetMinute: 70 }]);
        assert.equal(container.querySelector('.plan-segment-resize-preview-layer'), null);
    } finally {
        globalThis.document = originalDocument;
    }
});

test('plan segment resize preview shows virtual rest gap and cancels without applying', () => {
    const originalDocument = globalThis.document;
    const { ctx, container, document } = createRenderedResizeContext([
        { label: '샤워', seconds: 40 * 60, startMinute: 0, durationMinutes: 40, endMinute: 40 },
    ]);
    const originalPlan = JSON.stringify(ctx.timeSlots[0].planActivities);
    const applyCalls = [];
    ctx.applyPlanSegmentResize = function(baseIndex, segmentIndex, edge, targetMinute) {
        applyCalls.push({ baseIndex, segmentIndex, edge, targetMinute });
        return true;
    };
    ctx.renderTimeEntries = function(preserveInlineDropdown = false) {
        return renderController.renderTimeEntries.call(this, preserveInlineDropdown);
    };
    globalThis.document = document;

    try {
        ctx.renderTimeEntries(true);
        const handle = container.querySelector('.plan-segment-resize-handle-right');
        assert.ok(handle);
        startResizePreview(handle, 0);

        moveResizePreview(document, -10);

        assert.deepEqual(getPreviewSegments(container), [
            { className: 'plan-segment-resize-preview-segment', gridColumn: 'span 3', color: '#abcdef', label: '샤워', duration: '30m' },
            { className: 'plan-segment-resize-preview-segment plan-segment-resize-preview-rest', gridColumn: 'span 3', color: '', label: '휴식', duration: '30m' },
        ]);
        assert.equal(JSON.stringify(ctx.timeSlots[0].planActivities), originalPlan);
        assert.deepEqual(applyCalls, []);

        cancelResizePreview(document);

        assert.equal(container.querySelector('.plan-segment-resize-preview-layer'), null);
        assert.equal(container.querySelector('.split-grid').classList.contains('is-previewing-plan-resize'), false);
        assert.deepEqual(applyCalls, []);
        assert.equal(JSON.stringify(ctx.timeSlots[0].planActivities), originalPlan);
    } finally {
        globalThis.document = originalDocument;
    }
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
            if (selector === '.plan-segment-resize-handle') return [handle];
            if (selector === '.split-grid-segment[data-segment-kind="real-plan"]') return [];
            assert.fail(`Unexpected selector: ${selector}`);
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
        querySelectorAll(selector) {
            if (selector === '.plan-segment-resize-handle') return [handle];
            if (selector === '.split-grid-segment[data-segment-kind="real-plan"]') return [];
            return [];
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
