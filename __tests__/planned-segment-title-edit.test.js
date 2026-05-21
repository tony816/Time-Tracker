const test = require('node:test');
const assert = require('node:assert/strict');

const renderController = require('../controllers/time-entry-render-controller');
require('../core/actual-grid-core');
require('../core/plan-segment-core');
const { buildMethod } = require('./helpers/script-method-builder');

const attachPlanSegmentTitleEditListeners = buildMethod(
    'attachPlanSegmentTitleEditListeners(entryDiv, index)',
    '(entryDiv, index)'
);
const applyPlanSegmentTitleEdit = buildMethod(
    'applyPlanSegmentTitleEdit(baseIndex, segmentIndex, rawTitle)',
    '(baseIndex, segmentIndex, rawTitle)'
);

function createElementNode(tagName = 'span') {
    const listeners = {};
    const node = {
        tagName: tagName.toUpperCase(),
        children: [],
        dataset: {},
        className: '',
        hidden: false,
        parentNode: null,
        textContent: '',
        value: '',
        type: '',
        focused: false,
        selected: false,
        removedChildren: [],
        setAttribute(name, value) {
            this[name] = String(value);
        },
        addEventListener(type, handler) {
            listeners[type] = handler;
        },
        dispatchEvent(event) {
            const handler = listeners[event.type];
            if (handler) handler(event);
        },
        querySelector() {
            return null;
        },
        insertAdjacentElement(position, child) {
            assert.equal(position, 'afterend');
            child.parentNode = this.parentNode || this;
            this.insertedElement = child;
            return child;
        },
        appendChild(child) {
            child.parentNode = this;
            this.children.push(child);
            return child;
        },
        removeChild(child) {
            this.removedChildren.push(child);
            child.parentNode = null;
            return child;
        },
        focus() {
            this.focused = true;
        },
        select() {
            this.selected = true;
        },
    };
    return node;
}

function createTitleEditHarness(options = {}) {
    const label = createElementNode('span');
    label.className = 'plan-segment-graphic-label';
    label.dataset.titleEditTrigger = 'true';
    label.textContent = options.label || 'Focus';
    const parent = createElementNode('div');
    label.parentNode = parent;
    const segment = {
        dataset: {
            segmentKind: 'real-plan',
            segmentIndex: String(options.segmentIndex ?? 0),
        },
    };
    label.closest = (selector) => {
        if (selector === '.split-grid-segment[data-segment-kind="real-plan"]') return segment;
        return null;
    };
    const entryDiv = {
        querySelectorAll(selector) {
            assert.equal(selector, '.plan-segment-graphic-label[data-title-edit-trigger="true"]');
            return [label];
        },
    };
    const calls = [];
    const ctx = {
        timeSlots: [
            {
                planned: 'Focus',
                planTitle: '',
                planTitleBandOn: false,
                planActivities: [
                    { label: 'Focus', seconds: 3600, activityId: 'focus', activityText: 'Focus' },
                ],
            },
        ],
        normalizeActivityText(value) {
            return String(value || '').trim();
        },
        normalizePlanActivitiesPreservingSegments(raw) {
            return Array.isArray(raw) ? raw.map(item => ({ ...item })) : [];
        },
        formatActivitiesSummary(items) {
            return items.map(item => item.label).join(', ');
        },
        getPlanSegmentBaseIndex(index) {
            return index;
        },
        renderTimeEntries() {
            calls.push('render');
        },
        calculateTotals() {
            calls.push('totals');
        },
        autoSave() {
            calls.push('save');
        },
        applyPlanSegmentTitleEdit(baseIndex, segmentIndex, rawTitle) {
            calls.push({ baseIndex, segmentIndex, rawTitle });
            return applyPlanSegmentTitleEdit.call(this, baseIndex, segmentIndex, rawTitle);
        },
        ...options.ctx,
    };
    return { ctx, entryDiv, label, calls };
}

function withDocument(run) {
    const originalDocument = globalThis.document;
    globalThis.document = {
        createElement(tagName) {
            return createElementNode(tagName);
        },
    };
    try {
        return run();
    } finally {
        globalThis.document = originalDocument;
    }
}

function startTitleEdit(harness) {
    attachPlanSegmentTitleEditListeners.call(harness.ctx, harness.entryDiv, 0);
    harness.label.dispatchEvent({
        type: 'click',
        button: 0,
        target: harness.label,
        preventDefault() {},
        stopPropagation() {},
    });
    return harness.label.insertedElement;
}

test('clicking plan segment title text opens inline editing UI', () => {
    withDocument(() => {
        const harness = createTitleEditHarness();
        const input = startTitleEdit(harness);

        assert.ok(input);
        assert.equal(input.className, 'plan-segment-title-edit-input');
        assert.equal(input.value, 'Focus');
        assert.equal(input.focused, true);
        assert.equal(input.selected, true);
        assert.equal(harness.label.hidden, true);
    });
});

test('clicking segment background does not open inline editing UI', () => {
    const harness = createTitleEditHarness();
    attachPlanSegmentTitleEditListeners.call(harness.ctx, harness.entryDiv, 0);

    assert.equal(harness.label.insertedElement, undefined);
});

test('pressing Enter saves the new segment title', () => {
    withDocument(() => {
        const harness = createTitleEditHarness();
        const input = startTitleEdit(harness);
        input.value = 'Deep Work';

        input.dispatchEvent({
            type: 'keydown',
            key: 'Enter',
            preventDefault() {},
            stopPropagation() {},
        });

        assert.equal(harness.ctx.timeSlots[0].planActivities[0].label, 'Deep Work');
        assert.equal(harness.ctx.timeSlots[0].planActivities[0].activityText, 'Deep Work');
        assert.equal(harness.ctx.timeSlots[0].planActivities[0].activityId, 'focus');
        assert.equal(harness.ctx.timeSlots[0].planned, 'Deep Work');
        assert.deepEqual(harness.calls.slice(-3), ['render', 'totals', 'save']);
    });
});

test('pressing Escape cancels and keeps the previous title', () => {
    withDocument(() => {
        const harness = createTitleEditHarness();
        const input = startTitleEdit(harness);
        input.value = 'Canceled';

        input.dispatchEvent({
            type: 'keydown',
            key: 'Escape',
            preventDefault() {},
            stopPropagation() {},
        });

        assert.equal(harness.ctx.timeSlots[0].planActivities[0].label, 'Focus');
        assert.equal(harness.ctx.timeSlots[0].planActivities[0].activityText, 'Focus');
        assert.equal(harness.calls.some(call => call === 'save'), false);
        assert.equal(harness.label.hidden, false);
    });
});

test('blurring the editor saves the new title', () => {
    withDocument(() => {
        const harness = createTitleEditHarness();
        const input = startTitleEdit(harness);
        input.value = 'Review';

        input.dispatchEvent({ type: 'blur' });

        assert.equal(harness.ctx.timeSlots[0].planActivities[0].label, 'Review');
        assert.equal(harness.ctx.timeSlots[0].planActivities[0].activityText, 'Review');
        assert.equal(harness.ctx.timeSlots[0].planned, 'Review');
    });
});

test('empty inline title input keeps the previous title', () => {
    withDocument(() => {
        const harness = createTitleEditHarness();
        const input = startTitleEdit(harness);
        input.value = '   ';

        input.dispatchEvent({ type: 'blur' });

        assert.equal(harness.ctx.timeSlots[0].planActivities[0].label, 'Focus');
        assert.equal(harness.ctx.timeSlots[0].planActivities[0].activityText, 'Focus');
        assert.equal(harness.calls.some(call => call === 'save'), false);
    });
});

test('plan segment title edit does not mutate catalog activity names', () => {
    const catalog = [{ id: 'focus', label: 'Focus', name: 'Focus' }];
    const ctx = createTitleEditHarness({
        ctx: {
            plannedActivities: catalog,
        },
    }).ctx;

    applyPlanSegmentTitleEdit.call(ctx, 0, 0, 'Renamed Segment');

    assert.deepEqual(catalog, [{ id: 'focus', label: 'Focus', name: 'Focus' }]);
    assert.equal(ctx.timeSlots[0].planActivities[0].label, 'Renamed Segment');
});

test('child segment title edit preserves parent metadata and activity ids', () => {
    const ctx = createTitleEditHarness().ctx;
    ctx.timeSlots[0].planActivities = [
        {
            label: 'Squat',
            seconds: 1800,
            titleActivityId: 'exercise',
            titleText: 'Exercise',
            activityId: 'squat',
            activityText: 'Squat',
        },
    ];
    ctx.timeSlots[0].planTitle = 'Exercise';
    ctx.timeSlots[0].planTitleBandOn = true;

    applyPlanSegmentTitleEdit.call(ctx, 0, 0, 'Leg Day');

    assert.deepEqual(ctx.timeSlots[0].planActivities[0], {
        label: 'Leg Day',
        seconds: 1800,
        titleActivityId: 'exercise',
        titleText: 'Exercise',
        activityId: 'squat',
        activityText: 'Leg Day',
    });
    assert.equal(ctx.timeSlots[0].planTitle, 'Exercise');
    assert.equal(ctx.timeSlots[0].planTitleBandOn, true);
});

test('virtual rest gap markup has no title edit affordance', () => {
    const ctx = {
        actualRecordingDisabled: true,
        computeSplitSegments() {
            return {
                showTitleBand: false,
                gridSegments: [
                    {
                        label: 'Rest',
                        span: 2,
                        kind: 'virtual-rest',
                        virtual: true,
                        startMinute: 20,
                        durationMinutes: 20,
                    },
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
            return '#eee';
        },
    };

    const html = renderController.buildSplitVisualization.call(ctx, 'planned', 0);

    assert.match(html, /data-segment-kind="virtual-rest"/);
    assert.doesNotMatch(html, /data-title-edit-trigger="true"/);
    assert.doesNotMatch(html, /plan-segment-graphic-label/);
});

test('resize handle and timer button clicks do not start title editing', () => {
    const harness = createTitleEditHarness();
    const resizeHandle = createElementNode('span');
    const timerButton = createElementNode('button');

    attachPlanSegmentTitleEditListeners.call(harness.ctx, harness.entryDiv, 0);
    resizeHandle.dispatchEvent({ type: 'click', target: resizeHandle });
    timerButton.dispatchEvent({ type: 'click', target: timerButton });

    assert.equal(harness.label.insertedElement, undefined);
});
