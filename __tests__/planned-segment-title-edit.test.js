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
const startPlanSegmentInlineTextEdit = buildMethod(
    'startPlanSegmentInlineTextEdit(labelEl, index, event, options = {})',
    '(labelEl, index, event, options = {})'
);
const startPlanSegmentActivityEdit = buildMethod(
    'startPlanSegmentActivityEdit(labelEl, index, event, options = {})',
    '(labelEl, index, event, options = {})'
);
const startPlanSegmentParentTitleEdit = buildMethod(
    'startPlanSegmentParentTitleEdit(titleEl, index, event)',
    '(titleEl, index, event)'
);
const applyPlanSegmentTitleEdit = buildMethod(
    'applyPlanSegmentTitleEdit(baseIndex, segmentIndex, rawTitle)',
    '(baseIndex, segmentIndex, rawTitle)'
);
const applyPlanSegmentTitleTextEdit = buildMethod(
    'applyPlanSegmentTitleTextEdit(baseIndex, segmentIndex, rawTitle)',
    '(baseIndex, segmentIndex, rawTitle)'
);
const resolvePlannedSlotContext = buildMethod(
    'resolvePlannedSlotContext(index)',
    '(index)'
);
const attachPlanSegmentSelectionListeners = buildMethod(
    'attachPlanSegmentSelectionListeners(entryDiv, index)',
    '(entryDiv, index)'
);
const openPlanSegmentReplacementDropdown = buildMethod(
    'openPlanSegmentReplacementDropdown(baseIndex, segmentIndex, segmentEl, options = {})',
    '(baseIndex, segmentIndex, segmentEl, options = {})'
);
const addInlinePlanSheetTargetClasses = buildMethod(
    'addInlinePlanSheetTargetClasses(targetEl, specificClass = \'\')',
    '(targetEl, specificClass = \'\')'
);
const repositionOpenInlinePlanDropdown = buildMethod(
    'repositionOpenInlinePlanDropdown()',
    '()'
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
        style: {},
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
        contains(target) {
            if (target === this) return true;
            const stack = Array.isArray(this.children) ? this.children.slice() : [];
            while (stack.length) {
                const candidate = stack.shift();
                if (candidate === target) return true;
                if (candidate && Array.isArray(candidate.children)) {
                    stack.push(...candidate.children);
                }
            }
            return false;
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
            const index = this.children.indexOf(child);
            if (index >= 0) this.children.splice(index, 1);
            child.parentNode = null;
            return child;
        },
        focus() {
            this.focused = true;
            if (globalThis.document) globalThis.document.activeElement = this;
        },
        blur() {
            this.focused = false;
            if (globalThis.document && globalThis.document.activeElement === this) {
                globalThis.document.activeElement = null;
            }
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
    if (String(selector).includes(',')) {
        return String(selector).split(',').some(part => matchesSelector(node, part.trim()));
    }
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
    if (selector === '[data-title-edit-trigger="true"]') {
        return node.dataset && node.dataset.titleEditTrigger === 'true';
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
    const outerLabel = createElementNode('span');
    outerLabel.className = 'plan-segment-graphic-label';
    const label = createElementNode('span');
    label.className = 'plan-segment-label-text';
    label.dataset.titleEditTrigger = 'true';
    label.textContent = options.label || 'Focus';
    label.getBoundingClientRect = () => ({ width: options.textWidth ?? 40 });
    const parent = createElementNode('div');
    parent.appendChild(outerLabel);
    outerLabel.appendChild(label);
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
            assert.equal(selector, '[data-title-edit-trigger="true"]');
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
        applyPlanSegmentTitleTextEdit(baseIndex, segmentIndex, rawTitle) {
            calls.push({ baseIndex, segmentIndex, rawTitle, kind: 'titleText' });
            return applyPlanSegmentTitleTextEdit.call(this, baseIndex, segmentIndex, rawTitle);
        },
        startPlanSegmentInlineTextEdit(labelEl, rowIndex, event, options = {}) {
            return startPlanSegmentInlineTextEdit.call(this, labelEl, rowIndex, event, options);
        },
        startPlanSegmentActivityEdit(labelEl, rowIndex, event, options = {}) {
            return startPlanSegmentActivityEdit.call(this, labelEl, rowIndex, event, options);
        },
        startPlanSegmentParentTitleEdit(titleEl, rowIndex, event) {
            return startPlanSegmentParentTitleEdit.call(this, titleEl, rowIndex, event);
        },
        openPlanSegmentReplacementDropdown(baseIndex, segmentIndex, segmentEl, options = {}) {
            return openPlanSegmentReplacementDropdown.call(this, baseIndex, segmentIndex, segmentEl, options);
        },
        ...options.ctx,
    };
    return { ctx, entryDiv, outerLabel, label, calls };
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
    return harness.label.querySelector('.plan-segment-title-edit-input');
}

test('clicking plan segment title text does not open inline editing UI', () => {
    withDocument(() => {
        const harness = createTitleEditHarness();
        const input = startTitleEdit(harness);

        assert.equal(input, null);
        assert.equal(harness.label.textContent, 'Focus');
        assert.equal(hasNodeClass(harness.label, 'is-editing'), false);
    });
});

function withMobileEditorDocument(run) {
    const originalDocument = globalThis.document;
    const body = createElementNode('body');
    body.classList = {
        add(name) {
            const tokens = getNodeClasses(body);
            if (!tokens.includes(name)) tokens.push(name);
            body.className = tokens.join(' ');
        },
        remove(name) {
            body.className = getNodeClasses(body).filter(token => token !== name).join(' ');
        },
        contains(name) {
            return getNodeClasses(body).includes(name);
        },
    };
    globalThis.document = {
        activeElement: null,
        body,
        createElement(tagName) {
            return createElementNode(tagName);
        },
    };
    try {
        return run(body);
    } finally {
        globalThis.document = originalDocument;
    }
}

test('mobile segment title tap does not open an inline text editor', () => {
    withMobileEditorDocument((body) => {
        const dropdownCalls = [];
        const harness = createTitleEditHarness({
            ctx: {
                isInlinePlanMobileInputContext() {
                    return true;
                },
                openInlinePlanDropdown(startIndex, anchor, endIndex, options) {
                    dropdownCalls.push({ startIndex, anchor, endIndex, options });
                    const dropdown = createElementNode('div');
                    dropdown.className = options.forceAnchored
                        ? 'inline-plan-dropdown'
                        : 'inline-plan-dropdown inline-plan-dropdown-sheet';
                    this.inlinePlanDropdown = dropdown;
                    body.appendChild(dropdown);
                    return dropdown;
                },
                scheduleInlinePlanInputVisibilitySync(inputEl) {
                    harness.calls.push(['visibility', inputEl]);
                },
            },
        });

        const opened = startPlanSegmentActivityEdit.call(harness.ctx, harness.label, 0, {
            type: 'click',
            button: 0,
            target: harness.label,
            preventDefault() {},
            stopPropagation() {},
        }, {
            openDropdown: true,
            dropdownAnchor: harness.label,
        });

        assert.equal(opened, false);
        assert.equal(harness.label.querySelector('.plan-segment-title-edit-input'), null);
        assert.equal(dropdownCalls.length, 0);
        assert.equal(body.querySelector('.inline-plan-dropdown-sheet'), null);
    });
});

test('mobile segment title tap does not close the dropdown at entry', () => {
    withMobileEditorDocument((body) => {
        const calls = [];
        const harness = createTitleEditHarness({
            ctx: {
                isInlinePlanMobileInputContext() {
                    return true;
                },
                inlinePlanDropdown: { id: 'dropdown' },
                closeInlinePlanDropdown() {
                    calls.push('close-inline-dropdown');
                    this.inlinePlanDropdown = null;
                },
                openInlinePlanDropdown(startIndex, anchor, endIndex, options) {
                    calls.push(['open-inline-dropdown', startIndex, anchor, endIndex, options]);
                    const dropdown = createElementNode('div');
                    dropdown.className = options.forceAnchored
                        ? 'inline-plan-dropdown'
                        : 'inline-plan-dropdown inline-plan-dropdown-sheet';
                    this.inlinePlanDropdown = dropdown;
                    body.appendChild(dropdown);
                    return dropdown;
                },
                scheduleInlinePlanInputVisibilitySync(inputEl) {
                    calls.push(['visibility', inputEl]);
                },
            },
        });

        const opened = startPlanSegmentActivityEdit.call(harness.ctx, harness.label, 0, {
            type: 'click',
            button: 0,
            target: harness.label,
            preventDefault() {},
            stopPropagation() {},
        }, {
            openDropdown: true,
            dropdownAnchor: harness.label,
        });

        assert.equal(opened, false);
        assert.notEqual(calls[0], 'close-inline-dropdown');
        assert.equal(calls.some(call => call === 'close-inline-dropdown'), false);
        assert.equal(harness.label.querySelector('.plan-segment-title-edit-input'), null);
        assert.equal(body.querySelector('.inline-plan-dropdown-sheet'), null);
        assert.equal(body.querySelector('.inline-plan-dropdown') != null, false);
    });
});

test('mobile segment title tap does not create save or cancel paths', () => {
    withMobileEditorDocument(() => {
        const saveHarness = createTitleEditHarness({
            ctx: {
                isInlinePlanMobileInputContext() {
                    return true;
                },
            },
        });
        const opened = startPlanSegmentActivityEdit.call(saveHarness.ctx, saveHarness.label, 0, {
            type: 'click',
            button: 0,
            target: saveHarness.label,
            preventDefault() {},
            stopPropagation() {},
        });
        assert.equal(opened, false);
        assert.equal(saveHarness.label.querySelector('.plan-segment-title-edit-input'), null);
        assert.equal(saveHarness.ctx.timeSlots[0].planActivities[0].label, 'Focus');

        const cancelHarness = createTitleEditHarness({
            ctx: {
                isInlinePlanMobileInputContext() {
                    return true;
                },
            },
        });
        const cancelOpened = startPlanSegmentActivityEdit.call(cancelHarness.ctx, cancelHarness.label, 0, {
            type: 'click',
            button: 0,
            target: cancelHarness.label,
            preventDefault() {},
            stopPropagation() {},
        });
        assert.equal(cancelOpened, false);
        assert.equal(cancelHarness.label.querySelector('.plan-segment-title-edit-input'), null);
        assert.equal(cancelHarness.ctx.timeSlots[0].planActivities[0].label, 'Focus');
    });
});

test('clicking outer plan label space does not open inline editing UI', () => {
    withDocument(() => {
        const harness = createTitleEditHarness();
        attachPlanSegmentTitleEditListeners.call(harness.ctx, harness.entryDiv, 0);

        harness.outerLabel.dispatchEvent({
            type: 'click',
            button: 0,
            target: harness.outerLabel,
            preventDefault() {},
            stopPropagation() {},
        });

        assert.equal(harness.label.querySelector('.plan-segment-title-edit-input'), null);
        assert.equal(harness.label.textContent, 'Focus');
    });
});

test('clicking segment background does not open inline editing UI', () => {
    const harness = createTitleEditHarness();
    attachPlanSegmentTitleEditListeners.call(harness.ctx, harness.entryDiv, 0);

    assert.equal(harness.label.insertedElement, undefined);
    assert.equal(harness.label.querySelector('.plan-segment-title-edit-input'), null);
});

test('pressing Enter does not create a segment title editor', () => {
    withDocument(() => {
        const harness = createTitleEditHarness();
        const input = startTitleEdit(harness);
        assert.equal(input, null);
        assert.equal(harness.ctx.timeSlots[0].planActivities[0].label, 'Focus');
        assert.equal(harness.ctx.timeSlots[0].planned, 'Focus');
    });
});

test('pressing Escape does not create a segment title editor', () => {
    withDocument(() => {
        const harness = createTitleEditHarness();
        const input = startTitleEdit(harness);
        assert.equal(input, null);
        assert.equal(harness.label.textContent, 'Focus');
        assert.equal(hasNodeClass(harness.label, 'is-editing'), false);
    });
});

test('blurring the title does not create an inline editor', () => {
    withDocument(() => {
        const harness = createTitleEditHarness();
        const input = startTitleEdit(harness);
        assert.equal(input, null);
        assert.equal(harness.ctx.timeSlots[0].planActivities[0].label, 'Focus');
    });
});

test('empty inline title edit no longer mutates the title', () => {
    withDocument(() => {
        const harness = createTitleEditHarness();
        const input = startTitleEdit(harness);
        assert.equal(input, null);
        assert.equal(harness.ctx.timeSlots[0].planActivities[0].label, 'Focus');
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

test('plan segment title edit clears stale activity identity metadata', () => {
    const ctx = createTitleEditHarness().ctx;
    ctx.timeSlots[0].planActivities = [
        {
            label: '샤워',
            seconds: 1800,
            titleActivityId: 'routine',
            titleText: 'Morning',
            activityId: 'shower',
            activityText: '샤워',
        },
    ];
    ctx.timeSlots[0].planned = '샤워';

    applyPlanSegmentTitleEdit.call(ctx, 0, 0, '공부');

    assert.equal(ctx.timeSlots[0].planActivities[0].label, '공부');
    assert.equal(ctx.timeSlots[0].planActivities[0].activityText, '공부');
    assert.equal(ctx.timeSlots[0].planActivities[0].activityId, undefined);
    assert.equal(ctx.timeSlots[0].planActivities[0].titleActivityId, undefined);
    assert.equal(ctx.timeSlots[0].planActivities[0].titleText, undefined);
});

test('child segment title edit preserves title band state while clearing stale ids', () => {
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
        activityText: 'Leg Day',
    });
    assert.equal(ctx.timeSlots[0].planTitle, 'Exercise');
    assert.equal(ctx.timeSlots[0].planTitleBandOn, true);
});

test('merged planned segment title edit from secondary row stores on base slot', () => {
    const ctx = createTitleEditHarness().ctx;
    ctx.timeSlots.push({
        planned: '',
        planTitle: '',
        planTitleBandOn: false,
        planActivities: [],
    });
    ctx.mergedFields = new Map([['planned-0-1', 'Focus']]);
    ctx.findMergeKey = (type, index) => (type === 'planned' && index >= 0 && index <= 1 ? 'planned-0-1' : null);
    ctx.resolvePlannedSlotContext = function(index) {
        return resolvePlannedSlotContext.call(this, index);
    };

    applyPlanSegmentTitleEdit.call(ctx, 1, 0, 'Merged Focus');

    assert.equal(ctx.timeSlots[0].planActivities[0].label, 'Merged Focus');
    assert.equal(ctx.timeSlots[0].planned, 'Merged Focus');
    assert.deepEqual(ctx.timeSlots[1].planActivities, []);
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

    const title = createElementNode('span');
    title.className = 'plan-segment-graphic-title';
    title.textContent = 'Parent';

    const labelContainer = createElementNode('span');
    labelContainer.className = 'plan-segment-graphic-label';

    const label = createElementNode('span');
    label.className = 'plan-segment-label-text';
    label.dataset.titleEditTrigger = 'true';
    label.textContent = 'Focus';
    label.getBoundingClientRect = () => ({ width: 44 });

    const timerTime = createElementNode('span');
    timerTime.className = 'plan-segment-timer-time';
    timerTime.textContent = '0m / 60m';

    attachDomParent(segment, entryDiv);
    attachDomParent(resizeHandle, segment);
    attachDomParent(graphic, segment);
    attachDomParent(timerButton, graphic);
    attachDomParent(main, graphic);
    attachDomParent(title, main);
    attachDomParent(labelContainer, main);
    attachDomParent(label, labelContainer);
    attachDomParent(timerTime, main);

    entryDiv.querySelectorAll = (selector) => findAllDescendants(entryDiv, selector);

    const calls = [];
    const ctx = createTitleEditHarness({
        ctx: {
            ensurePlanSegmentSelectionGlobalListeners() {},
            setSelectedPlanSegment(baseIndex, segmentIndex) {
                this.selectedPlanSegment = { baseIndex, segmentIndex };
                return true;
            },
            applyPlanSegmentTitleEdit(baseIndex, segmentIndex, rawTitle) {
                calls.push({ baseIndex, segmentIndex, rawTitle });
                return applyPlanSegmentTitleEdit.call(this, baseIndex, segmentIndex, rawTitle);
            },
        },
    }).ctx;

    return { ctx, entryDiv, segment, timerButton, resizeHandle, title, labelContainer, label, timerTime, calls };
}

test('real planned segment DOM does not open title editing from any direct trigger', () => {
    withDocument(() => {
        const { ctx, entryDiv, segment, timerButton, resizeHandle, labelContainer, label, timerTime } = createRealisticPlanSegmentDom();
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

        timerTime.dispatchEvent({
            type: 'click',
            button: 0,
            target: timerTime,
            bubbles: true,
            preventDefault() {},
            stopPropagation() {},
        });
        assert.equal(entryDiv.querySelector('.plan-segment-title-edit-input'), null);

        labelContainer.dispatchEvent({
            type: 'click',
            button: 0,
            target: labelContainer,
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

        assert.equal(entryDiv.querySelector('.plan-segment-title-edit-input'), null);
        assert.equal(label.textContent, 'Focus');
        assert.equal(hasNodeClass(label, 'is-editing'), false);
    });
});

test('clicking label container space opens segment dropdown without title editing', () => {
    withDocument(() => {
        const { ctx, entryDiv, segment, labelContainer, label } = createRealisticPlanSegmentDom();
        const dropdownCalls = [];
        segment.getBoundingClientRect = () => ({ width: 640 });
        ctx.timeSlots = [
            {
                planned: 'Focus',
                planActivities: [
                    { label: 'Focus', activityText: 'Focus', activityId: 'focus', seconds: 3600 },
                ],
            },
        ];
        ctx.openPlanSegmentReplacementDropdown = function(baseIndex, segmentIndex, segmentEl, options = {}) {
            return openPlanSegmentReplacementDropdown.call(this, baseIndex, segmentIndex, segmentEl, options);
        };
        ctx.addInlinePlanSheetTargetClasses = addInlinePlanSheetTargetClasses;
        ctx.openInlinePlanDropdown = function(startIndex, anchor, endIndex, options) {
            dropdownCalls.push({ startIndex, anchor, endIndex, options });
        };
        attachPlanSegmentTitleEditListeners.call(ctx, entryDiv, 0);
        attachPlanSegmentSelectionListeners.call(ctx, entryDiv, 0);

        labelContainer.dispatchEvent({
            type: 'click',
            button: 0,
            target: labelContainer,
            bubbles: true,
            preventDefault() {},
            stopPropagation() {},
        });

        assert.equal(entryDiv.querySelector('.plan-segment-title-edit-input'), null);
        assert.equal(ctx.selectedPlanSegment, undefined);
        assert.equal(dropdownCalls.length, 1);
        assert.equal(dropdownCalls[0].anchor, label);
        assert.equal(dropdownCalls[0].options.mode, 'plan-segment-replace');
        assert.equal(dropdownCalls[0].options.segmentIndex, 0);
        assert.equal(dropdownCalls[0].options.segmentId, 'planned-0-0');
        assert.equal(dropdownCalls[0].options.anchorAlign, 'center');
        assert.equal(dropdownCalls[0].options.anchorMinWidth, 640);
        assert.equal(hasNodeClass(segment, 'inline-plan-sheet-context-target'), true);
        assert.equal(hasNodeClass(segment, 'inline-plan-segment-context-target'), true);
    });
});

test('segment replacement dropdown falls back from label text to graphic label and segment', () => {
    withDocument(() => {
        const { ctx, segment, labelContainer, label } = createRealisticPlanSegmentDom();
        const calls = [];
        ctx.timeSlots = [
            {
                planned: 'Focus',
                planActivities: [
                    { label: 'Focus', activityText: 'Focus', activityId: 'focus', seconds: 3600 },
                ],
            },
        ];
        ctx.openInlinePlanDropdown = function(startIndex, anchor, endIndex, options) {
            calls.push({ startIndex, anchor, endIndex, options });
        };

        labelContainer.children = labelContainer.children.filter(child => child !== label);
        label.parentNode = null;
        openPlanSegmentReplacementDropdown.call(ctx, 0, 0, segment);
        assert.equal(calls[0].anchor, labelContainer);
        assert.equal(calls[0].options.anchorAlign, 'center');

        labelContainer.className = '';
        openPlanSegmentReplacementDropdown.call(ctx, 0, 0, segment);
        assert.equal(calls[1].anchor, segment);
        assert.equal(calls[1].options.anchorAlign, 'center');
    });
});

test('repositionOpenInlinePlanDropdown refreshes segment label anchor after render', () => {
    const oldAnchor = { id: 'old-anchor' };
    const newAnchor = { id: 'new-label-anchor' };
    const calls = [];
    const ctx = {
        inlinePlanDropdown: { id: 'dropdown' },
        inlinePlanTarget: {
            startIndex: 2,
            endIndex: 2,
            mode: 'plan-segment-replace',
            segmentIndex: 1,
            segmentId: 'segment-1',
            anchor: oldAnchor,
            anchorAlign: 'center',
            anchorMinWidth: 640,
        },
        findPlanSegmentDropdownAnchorInfo(startIndex, segmentIndex, segmentId) {
            calls.push(['find', startIndex, segmentIndex, segmentId]);
            return {
                anchor: newAnchor,
                segmentEl: { id: 'segment-el' },
                anchorMinWidth: 480,
            };
        },
        positionInlinePlanDropdown(anchor) {
            calls.push(['position', anchor]);
        },
    };

    assert.equal(repositionOpenInlinePlanDropdown.call(ctx), true);
    assert.equal(ctx.inlinePlanAnchor, newAnchor);
    assert.equal(ctx.inlinePlanTarget.anchor, newAnchor);
    assert.equal(ctx.inlinePlanTarget.anchorAlign, 'center');
    assert.equal(ctx.inlinePlanTarget.anchorMinWidth, 480);
    assert.equal(ctx.inlinePlanTarget.mode, 'plan-segment-replace');
    assert.deepEqual(calls, [
        ['find', 2, 1, 'segment-1'],
        ['position', newAnchor],
    ]);
});

test('repositionOpenInlinePlanDropdown refreshes segment width when the rendered segment grows', () => {
    const newAnchor = { id: 'label-anchor' };
    const ctx = {
        inlinePlanDropdown: { id: 'dropdown' },
        inlinePlanTarget: {
            startIndex: 4,
            endIndex: 4,
            mode: 'plan-segment-replace',
            segmentIndex: 2,
            segmentId: 'segment-2',
            anchor: { id: 'old-anchor' },
            anchorAlign: 'center',
            anchorMinWidth: 420,
        },
        findPlanSegmentDropdownAnchorInfo(startIndex, segmentIndex, segmentId) {
            assert.equal(startIndex, 4);
            assert.equal(segmentIndex, 2);
            assert.equal(segmentId, 'segment-2');
            return {
                anchor: newAnchor,
                segmentEl: { id: 'segment-el' },
                anchorMinWidth: 720,
            };
        },
        positionInlinePlanDropdown(anchor) {
            assert.equal(anchor, newAnchor);
        },
    };

    assert.equal(repositionOpenInlinePlanDropdown.call(ctx), true);
    assert.equal(ctx.inlinePlanTarget.anchor, newAnchor);
    assert.equal(ctx.inlinePlanTarget.anchorMinWidth, 720);
});

test('clicking parent title band does not open parent title inline editing UI', () => {
    withDocument(() => {
        const { ctx, entryDiv, title } = createRealisticPlanSegmentDom();
        const dropdownCalls = [];
        ctx.timeSlots = [
            {
                planned: 'Focus',
                planActivities: [
                    { label: 'Focus', activityText: 'Focus', activityId: 'focus', titleText: 'Parent', titleActivityId: 'parent', seconds: 3600 },
                ],
            },
        ];
        ctx.openPlanSegmentReplacementDropdown = function(baseIndex, segmentIndex, segmentEl, options = {}) {
            return openPlanSegmentReplacementDropdown.call(this, baseIndex, segmentIndex, segmentEl, options);
        };
        ctx.openInlinePlanDropdown = function(startIndex, anchor, endIndex, options) {
            dropdownCalls.push({ startIndex, anchor, endIndex, options });
        };
        attachPlanSegmentTitleEditListeners.call(ctx, entryDiv, 0);
        attachPlanSegmentSelectionListeners.call(ctx, entryDiv, 0);

        title.dispatchEvent({
            type: 'click',
            button: 0,
            target: title,
            bubbles: true,
            preventDefault() {},
            stopPropagation() {},
        });

        assert.equal(entryDiv.querySelector('.plan-segment-title-edit-input'), null);
        assert.deepEqual(ctx.selectedPlanSegment, { baseIndex: 0, segmentIndex: 0 });
        assert.equal(dropdownCalls.length, 0);
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
    assert.equal(harness.label.querySelector('.plan-segment-title-edit-input'), null);
});
