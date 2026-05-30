const test = require('node:test');
const assert = require('node:assert/strict');

const { buildMethod } = require('./helpers/script-method-builder');

const attachPlanSegmentSelectionListeners = buildMethod(
    'attachPlanSegmentSelectionListeners(entryDiv, index)',
    '(entryDiv, index)'
);
const resolvePlanSegmentTapIntent = buildMethod(
    'resolvePlanSegmentTapIntent(event, segmentEl)',
    '(event, segmentEl)'
);
const isCoarsePlanSegmentPointerContext = buildMethod(
    'isCoarsePlanSegmentPointerContext()',
    '()'
);
const getPlanSegmentTitleEditElement = buildMethod(
    'getPlanSegmentTitleEditElement(segmentEl)',
    '(segmentEl)'
);
const getPlanSegmentActivityEditElement = buildMethod(
    'getPlanSegmentActivityEditElement(segmentEl)',
    '(segmentEl)'
);
const getPlanSegmentTapTextRect = buildMethod(
    'getPlanSegmentTapTextRect(textEl)',
    '(textEl)'
);
const expandRectWithinBounds = buildMethod(
    'expandRectWithinBounds(rect, bounds, padding = {})',
    '(rect, bounds, padding = {})'
);
const isPointInRect = buildMethod(
    'isPointInRect(clientX, clientY, rect)',
    '(clientX, clientY, rect)'
);
const applyPlanSegmentTitleTextEdit = buildMethod(
    'applyPlanSegmentTitleTextEdit(baseIndex, segmentIndex, rawTitle)',
    '(baseIndex, segmentIndex, rawTitle)'
);

function rect(left, top, right, bottom) {
    return {
        left,
        top,
        right,
        bottom,
        x: left,
        y: top,
        width: right - left,
        height: bottom - top,
    };
}

function getNodeClasses(node) {
    return String(node && node.className || '').split(/\s+/).filter(Boolean);
}

function hasNodeClass(node, className) {
    return getNodeClasses(node).includes(className);
}

function matchesDataSelector(node, selector) {
    if (!node || !node.dataset) return false;
    if (selector === '[data-segment-title-edit-trigger="true"]') {
        return node.dataset.segmentTitleEditTrigger === 'true';
    }
    if (selector === '[data-activity-edit-trigger="true"]') {
        return node.dataset.activityEditTrigger === 'true';
    }
    if (selector === '[data-title-edit-trigger="true"]') {
        return node.dataset.titleEditTrigger === 'true';
    }
    return false;
}

function matchesSelector(node, selector) {
    if (!node || !selector) return false;
    if (String(selector).includes(',')) {
        return String(selector).split(',').some(part => matchesSelector(node, part.trim()));
    }
    if (selector === '.split-grid-segment[data-segment-kind="real-plan"]') {
        return hasNodeClass(node, 'split-grid-segment')
            && node.dataset
            && node.dataset.segmentKind === 'real-plan';
    }
    if (selector.startsWith('[')) {
        return matchesDataSelector(node, selector);
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

function createElementNode(tagName = 'div', className = '', dataset = {}) {
    const listeners = {};
    const node = {
        tagName: tagName.toUpperCase(),
        className,
        dataset: { ...dataset },
        children: [],
        parentNode: null,
        textContent: '',
        style: {},
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
        appendChild(child) {
            child.parentNode = this;
            this.children.push(child);
            return child;
        },
        querySelector(selector) {
            return findDescendant(this, selector);
        },
        querySelectorAll(selector) {
            return findAllDescendants(this, selector);
        },
        closest(selector) {
            let current = this;
            while (current) {
                if (matchesSelector(current, selector)) return current;
                current = current.parentNode;
            }
            return null;
        },
        getBoundingClientRect() {
            return rect(0, 0, 0, 0);
        },
    };
    return node;
}

function createClickEvent(target, clientX, clientY) {
    return {
        type: 'click',
        button: 0,
        target,
        clientX,
        clientY,
        bubbles: true,
        defaultPrevented: false,
        propagationStopped: false,
        preventDefault() {
            this.defaultPrevented = true;
        },
        stopPropagation() {
            this.propagationStopped = true;
        },
    };
}

function createHarness(options = {}) {
    const entryDiv = createElementNode('div');
    const segment = createElementNode('div', 'split-grid-segment', {
        segmentKind: 'real-plan',
        segmentIndex: '0',
        segmentId: 'planned-0-0',
    });
    segment.getBoundingClientRect = () => rect(0, 0, 300, 90);

    const title = createElementNode('span', 'plan-segment-graphic-title', {
        segmentTitleEditTrigger: 'true',
    });
    title.textContent = 'Work';
    title.getBoundingClientRect = () => rect(104, 8, 144, 22);

    const label = createElementNode('span', 'plan-segment-label-text', {
        titleEditTrigger: 'true',
        activityEditTrigger: 'true',
    });
    label.textContent = 'Focus';
    label.getBoundingClientRect = () => rect(112, 36, 162, 52);

    const timerButton = createElementNode('button', 'plan-segment-timer-button');
    const resizeHandle = createElementNode('span', 'plan-segment-resize-handle plan-segment-resize-handle-right');
    const titleInput = createElementNode('input', 'plan-segment-title-edit-input');
    const inlineDropdown = createElementNode('div', 'inline-plan-dropdown');
    const chipBoard = createElementNode('div', 'activity-chip-board');
    const subsection = createElementNode('div', 'inline-plan-subsection');

    entryDiv.appendChild(segment);
    segment.appendChild(timerButton);
    segment.appendChild(title);
    segment.appendChild(label);
    segment.appendChild(resizeHandle);
    segment.appendChild(titleInput);
    segment.appendChild(inlineDropdown);
    segment.appendChild(chipBoard);
    segment.appendChild(subsection);

    const calls = [];
    const ctx = {
        coarsePlanSegmentPointerContext: options.coarse ?? true,
        ensurePlanSegmentSelectionGlobalListeners() {},
        getPlanSegmentBaseIndex(index) {
            return index;
        },
        isCoarsePlanSegmentPointerContext,
        resolvePlanSegmentTapIntent,
        getPlanSegmentTitleEditElement,
        getPlanSegmentActivityEditElement,
        getPlanSegmentTapTextRect,
        expandRectWithinBounds,
        isPointInRect,
        startPlanSegmentParentTitleEdit(el, index, event) {
            calls.push(['title-edit', el, index, event.defaultPrevented, event.propagationStopped]);
            return true;
        },
        startPlanSegmentActivityEdit(el, index, event) {
            calls.push(['activity-edit', el, index, event.defaultPrevented, event.propagationStopped]);
            return true;
        },
        openPlanSegmentReplacementDropdown(baseIndex, segmentIndex, segmentEl) {
            calls.push(['dropdown', baseIndex, segmentIndex, segmentEl]);
            return true;
        },
        setSelectedPlanSegment(baseIndex, segmentIndex) {
            calls.push(['selected', baseIndex, segmentIndex]);
            return true;
        },
    };

    attachPlanSegmentSelectionListeners.call(ctx, entryDiv, options.index ?? 0);

    return {
        ctx,
        entryDiv,
        segment,
        title,
        label,
        timerButton,
        resizeHandle,
        titleInput,
        inlineDropdown,
        chipBoard,
        subsection,
        calls,
    };
}

test('mobile title hit area tap starts title inline edit without opening replacement dropdown', () => {
    const harness = createHarness();
    const event = createClickEvent(harness.segment, 112, 14);

    harness.segment.dispatchEvent(event);

    assert.deepEqual(harness.calls, [
        ['title-edit', harness.title, 0, true, true],
    ]);
    assert.equal(event.defaultPrevented, true);
    assert.equal(event.propagationStopped, true);
});

test('mobile activity hit area tap starts activity inline edit without opening replacement dropdown', () => {
    const harness = createHarness();
    const event = createClickEvent(harness.segment, 118, 42);

    harness.segment.dispatchEvent(event);

    assert.deepEqual(harness.calls, [
        ['activity-edit', harness.label, 0, true, true],
    ]);
    assert.equal(event.defaultPrevented, true);
    assert.equal(event.propagationStopped, true);
});

test('mobile segment background tap outside text hit areas opens replacement dropdown', () => {
    const harness = createHarness();
    const event = createClickEvent(harness.segment, 260, 78);

    harness.segment.dispatchEvent(event);

    assert.deepEqual(harness.calls, [
        ['dropdown', 0, 0, harness.segment],
    ]);
    assert.equal(event.defaultPrevented, true);
    assert.equal(event.propagationStopped, true);
});

test('mobile plan segment tap intent keeps existing interactive exceptions ignored', () => {
    const harness = createHarness();
    const targets = [
        harness.timerButton,
        harness.resizeHandle,
        harness.titleInput,
        harness.inlineDropdown,
        harness.chipBoard,
        harness.subsection,
    ];

    targets.forEach((target, index) => {
        const event = createClickEvent(target, 120 + index, 42);
        harness.segment.dispatchEvent(event);
        assert.equal(event.defaultPrevented, false);
        assert.equal(event.propagationStopped, false);
    });

    assert.deepEqual(harness.calls, []);
});

test('desktop plan segment click behavior stays on existing selection and trigger rules', () => {
    const titleHarness = createHarness({ coarse: false });
    titleHarness.segment.dispatchEvent(createClickEvent(titleHarness.title, 112, 14));
    assert.deepEqual(titleHarness.calls, [
        ['dropdown', 0, 0, titleHarness.segment],
    ]);

    const labelHarness = createHarness({ coarse: false });
    labelHarness.segment.dispatchEvent(createClickEvent(labelHarness.label, 118, 42));
    assert.deepEqual(labelHarness.calls, []);

    const backgroundHarness = createHarness({ coarse: false });
    backgroundHarness.segment.dispatchEvent(createClickEvent(backgroundHarness.segment, 260, 78));
    assert.deepEqual(backgroundHarness.calls, [
        ['dropdown', 0, 0, backgroundHarness.segment],
    ]);
});

test('mobile text hit area expansion is clamped to the segment bounds', () => {
    const harness = createHarness();
    harness.title.getBoundingClientRect = () => rect(2, 2, 18, 12);

    assert.equal(resolvePlanSegmentTapIntent.call(harness.ctx, createClickEvent(harness.segment, 0, 0), harness.segment), 'title-edit');
    assert.equal(resolvePlanSegmentTapIntent.call(harness.ctx, createClickEvent(harness.segment, -1, 0), harness.segment), 'dropdown');
});

test('plan segment title text edit updates title metadata without changing activity label', () => {
    const calls = [];
    const ctx = {
        timeSlots: [
            {
                planned: 'Focus 1h',
                planTitle: 'Work',
                planTitleBandOn: true,
                planActivities: [
                    {
                        label: 'Focus',
                        activityText: 'Focus',
                        activityId: 'focus',
                        titleText: 'Work',
                        titleActivityId: 'work',
                        seconds: 3600,
                    },
                ],
            },
        ],
        normalizeActivityText(value) {
            return String(value || '').trim();
        },
        normalizeDurationStep(seconds) {
            return Math.max(0, Math.floor(seconds));
        },
        normalizePlanActivitiesPreservingSegments(raw) {
            return Array.isArray(raw) ? raw.map(item => ({ ...item })) : [];
        },
        formatActivitiesSummary(items) {
            return items.map(item => `${item.label} ${item.seconds}`).join(', ');
        },
        renderTimeEntries(preserve) {
            calls.push(['render', preserve]);
        },
        calculateTotals() {
            calls.push(['totals']);
        },
        autoSave() {
            calls.push(['save']);
        },
    };

    assert.equal(applyPlanSegmentTitleTextEdit.call(ctx, 0, 0, 'Deep Work'), true);
    assert.equal(ctx.timeSlots[0].planActivities[0].titleText, 'Deep Work');
    assert.equal(ctx.timeSlots[0].planActivities[0].titleActivityId, undefined);
    assert.equal(ctx.timeSlots[0].planActivities[0].label, 'Focus');
    assert.equal(ctx.timeSlots[0].planActivities[0].activityText, 'Focus');
    assert.equal(ctx.timeSlots[0].planTitle, 'Deep Work');
    assert.deepEqual(calls, [['render', true], ['totals'], ['save']]);
});
