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
            if (!event.target) event.target = this;
            const handler = listeners[event.type];
            if (handler) handler(event);
            if (event.bubbles && this.parentNode && typeof this.parentNode.dispatchEvent === 'function') {
                this.parentNode.dispatchEvent(event);
            }
        },
        querySelector(selector) {
            return findDescendant(this, selector);
        },
        insertAdjacentElement(position, child) {
            assert.equal(position, 'afterend');
            child.parentNode = this.parentNode || this;
            this.insertedElement = child;
            if (this.parentNode && Array.isArray(this.parentNode.children)) {
                const index = this.parentNode.children.indexOf(this);
                if (index >= 0) {
                    this.parentNode.children.splice(index + 1, 0, child);
                } else {
                    this.parentNode.children.push(child);
                }
            }
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

function getNodeClasses(node) {
    return String(node && node.className || '').split(/\s+/).filter(Boolean);
}

function hasNodeClass(node, className) {
    return getNodeClasses(node).includes(className);
}

function matchesSelector(node, selector) {
    if (!node || !selector) return false;
    if (selector === '.split-grid-segment[data-segment-kind="real-plan"]') {
        return hasNodeClass(node, 'split-grid-segment')
            && node.dataset
            && node.dataset.segmentKind === 'real-plan';
    }
    if (selector === '.plan-segment-graphic-label[data-title-edit-trigger="true"]') {
        return hasNodeClass(node, 'plan-segment-graphic-label')
            && node.dataset
            && node.dataset.titleEditTrigger === 'true';
    }
    if (selector.startsWith('.')) {
        return hasNodeClass(node, selector.slice(1));
    }
    return false;
}

function findDescendant(root, selector) {
    const children = Array.isArray(root && root.children) ? root.children : [];
    for (const child of children) {
        if (matchesSelector(child, selector)) return child;
        const nested = findDescendant(child, selector);
        if (nested) return nested;
    }
    return null;
}

function findAllDescendants(root, selector, matches = []) {
    const children = Array.isArray(root && root.children) ? root.children : [];
    children.forEach((child) => {
        if (matchesSelector(child, selector)) matches.push(child);
        findAllDescendants(child, selector, matches);
    });
    return matches;
}

function attachDomParent(child, parent) {
    parent.appendChild(child);
    child.closest = (selector) => {
        let current = child;
        while (current) {
            if (matchesSelector(current, selector)) return current;
            current = current.parentNode;
        }
        return null;
    };
    return child;
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

function createRealisticPlanSegmentDom() {
    const entryDiv = createElementNode('div');
    const segment = createElementNode('div');
    segment.className = 'split-grid-segment';
    segment.dataset.segmentKind = 'real-plan';
    segment.dataset.segmentIndex = '0';
    segment.dataset.segmentId = 'planned-0-0';

    const resizeHandle = createElementNode('span');
    resizeHandle.className = 'plan-segment-resize-handle plan-segment-resize-handle-right';

    const graphic = createElementNode('div');
    graphic.className = 'plan-segment-graphic';

    const timerButton = createElementNode('button');
    timerButton.className = 'plan-segment-timer-button';

    const main = createElementNode('div');
    main.className = 'plan-segment-graphic-main';

    const label = createElementNode('span');
    label.className = 'plan-segment-graphic-label';
    label.dataset.titleEditTrigger = 'true';
    label.textContent = 'Focus';

    const timerTime = createElementNode('span');
    timerTime.className = 'plan-segment-timer-time';
    timerTime.textContent = '0m / 60m';

    attachDomParent(segment, entryDiv);
    attachDomParent(resizeHandle, segment);
    attachDomParent(graphic, segment);
    attachDomParent(timerButton, graphic);
    attachDomParent(main, graphic);
    attachDomParent(label, main);
    attachDomParent(timerTime, main);

    entryDiv.querySelectorAll = (selector) => findAllDescendants(entryDiv, selector);

    const calls = [];
    const ctx = createTitleEditHarness({
        ctx: {
            applyPlanSegmentTitleEdit(baseIndex, segmentIndex, rawTitle) {
                calls.push({ baseIndex, segmentIndex, rawTitle });
                return applyPlanSegmentTitleEdit.call(this, baseIndex, segmentIndex, rawTitle);
            },
        },
    }).ctx;

    return { ctx, entryDiv, segment, timerButton, resizeHandle, label, calls };
}

test('real planned segment DOM only opens title editing from the label trigger', () => {
    withDocument(() => {
        const { ctx, entryDiv, segment, timerButton, resizeHandle, label } = createRealisticPlanSegmentDom();
        attachPlanSegmentTitleEditListeners.call(ctx, entryDiv, 0);

        segment.dispatchEvent({
            type: 'click',
            button: 0,
            target: segment,
            bubbles: true,
            preventDefault() {},
            stopPropagation() {},
        });
        assert.equal(entryDiv.querySelector('.plan-segment-title-edit-input'), null);

        timerButton.dispatchEvent({
            type: 'click',
            button: 0,
            target: timerButton,
            bubbles: true,
            preventDefault() {},
            stopPropagation() {},
        });
        assert.equal(entryDiv.querySelector('.plan-segment-title-edit-input'), null);

        resizeHandle.dispatchEvent({
            type: 'click',
            button: 0,
            target: resizeHandle,
            bubbles: true,
            preventDefault() {},
            stopPropagation() {},
        });
        assert.equal(entryDiv.querySelector('.plan-segment-title-edit-input'), null);

        label.dispatchEvent({
            type: 'click',
            button: 0,
            target: label,
            bubbles: true,
            preventDefault() {},
            stopPropagation() {},
        });

        const input = entryDiv.querySelector('.plan-segment-title-edit-input');
        assert.ok(input);
        assert.equal(input.value, 'Focus');
    });
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
