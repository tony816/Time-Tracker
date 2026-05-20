const test = require('node:test');
const assert = require('node:assert/strict');

const inlineController = require('../controllers/inline-plan-dropdown-controller');
const renderController = require('../controllers/time-entry-render-controller');
const { buildMethod } = require('./helpers/script-method-builder');

const attachVirtualRestGapListeners = buildMethod(
    'attachVirtualRestGapListeners(entryDiv, index)',
    '(entryDiv, index)'
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
