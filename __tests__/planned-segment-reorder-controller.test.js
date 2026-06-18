const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const planSegmentCore = require('../core/plan-segment-core');
const controller = require('../controllers/planned-segment-reorder-controller');

function classesOf(node) {
    return String(node && node.className || '').split(/\s+/).filter(Boolean);
}

function hasClass(node, className) {
    return classesOf(node).includes(className);
}

function matches(node, selector) {
    if (!node || !selector) return false;
    if (selector.includes(',')) return selector.split(',').some((part) => matches(node, part.trim()));
    if (selector === '*') return true;
    if (selector === '.split-grid-segment[data-segment-kind="real-plan"]') {
        return hasClass(node, 'split-grid-segment') && node.dataset && node.dataset.segmentKind === 'real-plan';
    }
    if (selector === '.split-grid-segment-virtual-rest[data-segment-kind="virtual-rest"]') {
        return hasClass(node, 'split-grid-segment-virtual-rest') && node.dataset && node.dataset.segmentKind === 'virtual-rest';
    }
    if (selector === '.plan-segment-reorder-insert-marker') return hasClass(node, 'plan-segment-reorder-insert-marker');
    if (selector === '.plan-segment-reorder-preview-layer') return hasClass(node, 'plan-segment-reorder-preview-layer');
    if (selector === '.split-grid') return hasClass(node, 'split-grid');
    if (selector.startsWith('.')) {
        return selector.slice(1).split('.').every((className) => hasClass(node, className));
    }
    return String(node.tagName || '').toLowerCase() === selector.toLowerCase();
}

function findAll(root, selector, result = []) {
    (root.children || []).forEach((child) => {
        if (matches(child, selector)) result.push(child);
        findAll(child, selector, result);
    });
    return result;
}

function serializeNode(node) {
    if (!node) return '';
    const tag = String(node.tagName || 'div').toLowerCase();
    const classAttr = node.className ? ` class="${node.className}"` : '';
    const datasetAttrs = Object.entries(node.dataset || {})
        .map(([key, value]) => ` data-${key.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`)}="${value}"`)
        .join('');
    const styleEntries = Object.entries(node.style || {})
        .filter(([key, value]) => key !== 'setProperty' && value != null && value !== '')
        .map(([key, value]) => `${key}: ${value};`)
        .join(' ');
    const styleAttr = styleEntries ? ` style="${styleEntries}"` : '';
    const attrs = Object.entries(node.attributes || {})
        .map(([key, value]) => ` ${key}="${value}"`)
        .join('');
    const text = node.textContent || '';
    return `<${tag}${classAttr}${datasetAttrs}${styleAttr}${attrs}>${text}${(node.children || []).map(serializeNode).join('')}</${tag}>`;
}

function createNode(tagName = 'div', className = '', dataset = {}, rect = null) {
    const listeners = {};
    const node = {
        tagName: tagName.toUpperCase(),
        className,
        dataset: { ...dataset },
        children: [],
        parentNode: null,
        style: {
            setProperty(name, value) {
                this[name] = String(value);
            },
        },
        attributes: {},
        textContent: '',
        title: '',
        _rect: rect || { left: 0, top: 0, right: 300, bottom: 60, width: 300, height: 60 },
        get innerHTML() {
            return this.children.map(serializeNode).join('');
        },
        set innerHTML(value) {
            this.children.forEach((child) => {
                child.parentNode = null;
            });
            this.children = [];
            this._innerHTML = String(value || '');
        },
        classList: {
            add(...classNames) {
                const next = new Set(classesOf(node));
                classNames.forEach((className) => next.add(className));
                node.className = Array.from(next).join(' ');
            },
            remove(...classNames) {
                const remove = new Set(classNames);
                node.className = classesOf(node).filter((className) => !remove.has(className)).join(' ');
            },
            contains(className) {
                return hasClass(node, className);
            },
        },
        setAttribute(name, value) {
            this.attributes[name] = String(value);
        },
        removeAttribute(name) {
            delete this.attributes[name];
        },
        appendChild(child) {
            child.parentNode = this;
            this.children.push(child);
            return child;
        },
        removeChild(child) {
            this.children = this.children.filter((item) => item !== child);
            child.parentNode = null;
            return child;
        },
        addEventListener(type, handler, options = false) {
            listeners[type] = listeners[type] || [];
            listeners[type].push({ handler, capture: options === true || Boolean(options && options.capture) });
            node._listeners = listeners;
        },
        removeEventListener(type, handler) {
            listeners[type] = (listeners[type] || []).filter((listener) => listener.handler !== handler);
            node._listeners = listeners;
        },
        setPointerCapture(pointerId) {
            node.capturedPointerId = pointerId;
        },
        releasePointerCapture(pointerId) {
            node.releasedPointerId = pointerId;
        },
        cloneNode(deep = false) {
            const clone = createNode(tagName, node.className, { ...node.dataset }, node._rect ? { ...node._rect } : null);
            Object.entries(node.style || {})
                .filter(([key]) => key !== 'setProperty')
                .forEach(([key, value]) => {
                    clone.style[key] = value;
                });
            clone.attributes = { ...node.attributes };
            clone.textContent = node.textContent;
            clone.title = node.title;
            if (deep) {
                node.children.forEach((child) => {
                    clone.appendChild(child.cloneNode ? child.cloneNode(true) : child);
                });
            }
            return clone;
        },
        dispatchEvent(event) {
            if (!event.target) event.target = this;
            const path = [];
            let current = event.target;
            while (current) {
                path.unshift(current);
                current = current.parentNode;
            }
            const invoke = (target, capture) => {
                ((target && target._listeners && target._listeners[event.type]) || []).forEach((listener) => {
                    if (event.propagationStopped || listener.capture !== capture) return;
                    listener.handler(event);
                });
            };
            path.slice(0, -1).forEach((target) => invoke(target, true));
            invoke(event.target, true);
            invoke(event.target, false);
            if (event.bubbles !== false && !event.propagationStopped) {
                path.slice(0, -1).reverse().forEach((target) => invoke(target, false));
            }
        },
        querySelectorAll(selector) {
            return findAll(this, selector);
        },
        querySelector(selector) {
            return this.querySelectorAll(selector)[0] || null;
        },
        closest(selector) {
            let current = this;
            while (current) {
                if (matches(current, selector)) return current;
                current = current.parentNode;
            }
            return null;
        },
        getBoundingClientRect() {
            return this._rect;
        },
    };
    return node;
}

function createPointerEvent(type, target, clientX, clientY = 20) {
    return {
        type,
        target,
        button: 0,
        pointerId: 1,
        clientX,
        clientY,
        defaultPrevented: false,
        propagationStopped: false,
        preventDefault() { this.defaultPrevented = true; },
        stopPropagation() { this.propagationStopped = true; },
    };
}

function createTouchEvent(type, target, clientX, clientY = 20) {
    const touch = { clientX, clientY };
    return {
        type,
        target,
        touches: type === 'touchend' || type === 'touchcancel' ? [] : [touch],
        changedTouches: [touch],
        defaultPrevented: false,
        propagationStopped: false,
        preventDefault() { this.defaultPrevented = true; },
        stopPropagation() { this.propagationStopped = true; },
    };
}

function createBrowserGestureEvent(type, target) {
    return {
        type,
        target,
        bubbles: true,
        cancelable: true,
        defaultPrevented: false,
        propagationStopped: false,
        preventDefault() { this.defaultPrevented = true; },
        stopPropagation() { this.propagationStopped = true; },
    };
}

function withDom(fn) {
    const originalDocument = global.document;
    const originalSetTimeout = global.setTimeout;
    const originalClearTimeout = global.clearTimeout;
    const listeners = {};
    const timers = [];
    const root = createNode('div', 'document-root');
    global.document = {
        body: root,
        documentElement: root,
        createElement(tagName) {
            return createNode(tagName);
        },
        addEventListener(type, handler) {
            listeners[type] = listeners[type] || [];
            listeners[type].push(handler);
        },
        removeEventListener(type, handler) {
            listeners[type] = (listeners[type] || []).filter((item) => item !== handler);
        },
        querySelectorAll(selector) {
            return root.querySelectorAll(selector);
        },
    };
    global.setTimeout = (handler, delay) => {
        handler.delay = delay;
        timers.push(handler);
        return timers.length;
    };
    global.clearTimeout = () => {};
    try {
        return fn({ listeners, timers, root });
    } finally {
        global.document = originalDocument;
        global.setTimeout = originalSetTimeout;
        global.clearTimeout = originalClearTimeout;
    }
}

function createEntry() {
    const entry = createNode('div', 'time-entry');
    const grid = createNode('div', 'split-grid', {}, { left: 0, top: 0, right: 300, bottom: 60, width: 300, height: 60 });
    const first = createNode('div', 'split-grid-segment', {
        segmentKind: 'real-plan',
        segmentIndex: '0',
        reorderItemType: 'real',
        reorderItemId: 'real-0',
    }, { left: 0, top: 0, right: 150, bottom: 60, width: 150, height: 60 });
    const second = createNode('div', 'split-grid-segment', {
        segmentKind: 'real-plan',
        segmentIndex: '1',
        reorderItemType: 'real',
        reorderItemId: 'real-1',
    }, { left: 150, top: 0, right: 300, bottom: 60, width: 150, height: 60 });
    entry.appendChild(grid);
    grid.appendChild(first);
    grid.appendChild(second);
    return { entry, grid, first, second };
}

function createEntryWithRest() {
    const entry = createNode('div', 'time-entry');
    const grid = createNode('div', 'split-grid', {}, { left: 0, top: 0, right: 300, bottom: 60, width: 300, height: 60 });
    const first = createNode('div', 'split-grid-segment', {
        segmentKind: 'real-plan',
        segmentIndex: '0',
        reorderItemType: 'real',
        reorderItemId: 'real-0',
    }, { left: 0, top: 0, right: 100, bottom: 60, width: 100, height: 60 });
    const rest = createNode('div', 'split-grid-segment split-grid-segment-virtual-rest', {
        segmentKind: 'virtual-rest',
        reorderItemType: 'virtual-rest',
        reorderItemId: 'rest-0',
        gapStartMinute: '20',
        gapDurationMinutes: '20',
    }, { left: 100, top: 0, right: 200, bottom: 60, width: 100, height: 60 });
    const second = createNode('div', 'split-grid-segment', {
        segmentKind: 'real-plan',
        segmentIndex: '1',
        reorderItemType: 'real',
        reorderItemId: 'real-1',
    }, { left: 200, top: 0, right: 300, bottom: 60, width: 100, height: 60 });
    entry.appendChild(grid);
    grid.appendChild(first);
    grid.appendChild(rest);
    grid.appendChild(second);
    return { entry, grid, first, rest, second };
}

function appendSegmentChrome(segment, options = {}) {
    const graphic = createNode('div', 'plan-segment-graphic');
    const main = createNode('div', 'plan-segment-graphic-main');
    const label = createNode('span', 'plan-segment-label-text', {
        titleEditTrigger: 'true',
        activityEditTrigger: 'true',
    });
    const title = createNode('span', 'plan-segment-graphic-title', {
        segmentTitleEditTrigger: 'true',
    });
    const input = createNode('input', 'plan-segment-title-edit-input');
    const timerTime = createNode('span', 'plan-segment-timer-time');
    graphic.appendChild(main);
    if (options.title !== false) main.appendChild(title);
    main.appendChild(label);
    main.appendChild(timerTime);
    if (options.input) main.appendChild(input);
    segment.appendChild(graphic);
    return { graphic, main, label, title, input, timerTime };
}

function createCtx(overrides = {}) {
    const ctx = {
        timeSlots: [
            {
                planned: 'Prep, Interview',
                planActivities: [
                    { label: 'Prep', activityText: 'Prep', activityId: 'prep', startMinute: 0, endMinute: 30, durationMinutes: 30, seconds: 1800 },
                    { label: 'Interview', activityText: 'Interview', activityId: 'interview', startMinute: 30, endMinute: 60, durationMinutes: 30, seconds: 1800 },
                ],
                planSegmentTimers: {
                    'planned-0-0-seg0': { status: 'idle', elapsedSeconds: 10 },
                    'planned-0-0-seg1': { status: 'paused', elapsedSeconds: 90, progress: { ratio: 0.5 } },
                },
            },
        ],
        renderCalls: 0,
        totalCalls: 0,
        saveCalls: 0,
        resolvePlannedSlotContext(index) {
            return { baseIndex: index, rangeStart: index, rangeEnd: index, slotCount: 1, blockMinutes: 60, mergeKey: null, isMerged: false };
        },
        normalizePlanActivitiesPreservingSegments(items) {
            return Array.isArray(items) ? items.map((item) => ({ ...item })) : [];
        },
        normalizePlanActivitiesForBlockRelative(items) {
            return Array.isArray(items) ? items.map((item) => ({ ...item })) : [];
        },
        formatActivitiesSummary(items) {
            return items.map((item) => item.label).join(', ');
        },
        renderTimeEntries() {
            this.renderCalls += 1;
        },
        calculateTotals() {
            this.totalCalls += 1;
        },
        autoSave() {
            this.saveCalls += 1;
        },
        getSplitColor(type, label, isExtra, reservedIndices, role) {
            this.colorCalls = this.colorCalls || [];
            this.colorCalls.push({ type, label, isExtra, reservedIndices, role });
            return label === 'Interview' ? '#123456' : '#abcdef';
        },
        closeInlinePlanDropdown() {
            this.closedDropdown = true;
        },
        cleanupPlanSegmentResizeState() {
            this.cleanedResize = true;
        },
        isCoarsePlanSegmentPointerContext() {
            return false;
        },
        ...overrides,
    };
    return ctx;
}

test('planned segment reorder controller exports and attaches to global', () => {
    assert.equal(typeof controller.attachPlannedSegmentReorderListeners, 'function');
    assert.equal(typeof controller.applyPlanSegmentReorder, 'function');
    assert.equal(globalThis.TimeTrackerPlannedSegmentReorderController.applyPlanSegmentReorder, controller.applyPlanSegmentReorder);
});

test('planned segment reorder preview css does not keep obsolete blue preview segment styling', () => {
    const css = fs.readFileSync(path.join(__dirname, '..', 'styles', 'interactions.css'), 'utf8');
    assert.doesNotMatch(css, /\.plan-segment-reorder-preview-segment\s*\{/);
    assert.doesNotMatch(css, /plan-segment-reorder-preview-segment[\s\S]*rgba\(59,\s*130,\s*246/);
    assert.match(css, /\.plan-segment-reorder-drag-ghost\s*\{[\s\S]*position:\s*fixed/);
    assert.match(css, /\.plan-segment-reorder-drag-ghost\s*\{[\s\S]*pointer-events:\s*none/);
    assert.match(css, /\.plan-segment-reorder-drag-ghost\s*\{[\s\S]*z-index:\s*10000/);
});

test('mobile planned reorder css scopes native selection and zoom protections to segment surfaces', () => {
    const css = fs.readFileSync(path.join(__dirname, '..', 'styles', 'interactions.css'), 'utf8');
    assert.match(css, /\.split-visualization-planned \.split-grid-segment\[data-segment-kind="real-plan"\]/);
    assert.match(css, /\.split-visualization-planned \.split-grid-segment-virtual-rest\[data-segment-kind="virtual-rest"\]/);
    assert.match(css, /-webkit-touch-callout:\s*none/);
    assert.match(css, /-webkit-user-select:\s*none/);
    assert.match(css, /user-select:\s*none/);
    assert.match(css, /-webkit-tap-highlight-color:\s*transparent/);
    assert.match(css, /touch-action:\s*manipulation/);
    assert.match(css, /\.is-plan-segment-reorder-suppressing-selection[\s\S]*touch-action:\s*none/);
    assert.match(css, /\.plan-segment-title-edit-input[\s\S]*user-select:\s*text/);
    assert.doesNotMatch(css, /body\s*\{[\s\S]*user-select:\s*none/);
    assert.doesNotMatch(css, /meta name="viewport"[\s\S]*user-scalable=no/);
});

test('single planned slot reorders different activity segments and remaps timers', () => {
    const ctx = createCtx();

    assert.equal(controller.applyPlanSegmentReorder.call(ctx, 0, 1, 0, 'before'), true);
    assert.deepEqual(ctx.timeSlots[0].planActivities.map((item) => ({
        label: item.label,
        activityId: item.activityId,
        startMinute: item.startMinute,
        endMinute: item.endMinute,
        durationMinutes: item.durationMinutes,
    })), [
        { label: 'Interview', activityId: 'interview', startMinute: 0, endMinute: 30, durationMinutes: 30 },
        { label: 'Prep', activityId: 'prep', startMinute: 30, endMinute: 60, durationMinutes: 30 },
    ]);
    assert.equal(ctx.timeSlots[0].planSegmentTimers['planned-0-0-seg0'].elapsedSeconds, 90);
    assert.deepEqual(ctx.timeSlots[0].planSegmentTimers['planned-0-0-seg0'].progress, { ratio: 0.5 });
    assert.equal(ctx.timeSlots[0].planSegmentTimers['planned-0-0-seg1'].elapsedSeconds, 10);
    assert.equal(ctx.selectedPlanSegment.segmentIndex, 0);
    assert.equal(ctx.renderCalls, 1);
    assert.equal(ctx.totalCalls, 1);
    assert.equal(ctx.saveCalls, 1);
});

test('single planned slot reorders virtual rest after a real segment without persisting rest', () => {
    const ctx = createCtx({
        timeSlots: [
            {
                planned: 'A, B',
                planActivities: [
                    { label: 'A', activityId: 'a', startMinute: 0, endMinute: 20, durationMinutes: 20, seconds: 1200 },
                    { label: 'B', activityId: 'b', startMinute: 40, endMinute: 60, durationMinutes: 20, seconds: 1200 },
                ],
                planSegmentTimers: {
                    'planned-0-0-seg0': { status: 'idle', elapsedSeconds: 10 },
                    'planned-0-0-seg1': { status: 'paused', elapsedSeconds: 90 },
                },
            },
        ],
    });

    assert.equal(controller.applyPlanSegmentReorder.call(ctx, 0, 'rest-0', 'real-1', 'after'), true);
    assert.deepEqual(ctx.timeSlots[0].planActivities.map((item) => ({
        label: item.label,
        activityId: item.activityId,
        startMinute: item.startMinute,
        endMinute: item.endMinute,
        durationMinutes: item.durationMinutes,
    })), [
        { label: 'A', activityId: 'a', startMinute: 0, endMinute: 20, durationMinutes: 20 },
        { label: 'B', activityId: 'b', startMinute: 20, endMinute: 40, durationMinutes: 20 },
    ]);
    assert.equal(ctx.timeSlots[0].planActivities.some((item) => item.kind === 'virtual-rest' || item.virtual === true), false);
    assert.equal(ctx.timeSlots[0].planSegmentTimers['planned-0-0-seg1'].elapsedSeconds, 90);
    assert.deepEqual(planSegmentCore.calculateVirtualRestGaps(ctx.timeSlots[0].planActivities, { startMinute: 0, endMinute: 60 }).map((gap) => ({
        startMinute: gap.startMinute,
        durationMinutes: gap.durationMinutes,
    })), [
        { startMinute: 40, durationMinutes: 20 },
    ]);
});

test('single planned slot drops a real segment before virtual rest and remaps timers', () => {
    const ctx = createCtx({
        timeSlots: [
            {
                planned: 'A, B',
                planActivities: [
                    { label: 'A', activityId: 'a', startMinute: 0, endMinute: 20, durationMinutes: 20, seconds: 1200 },
                    { label: 'B', activityId: 'b', startMinute: 40, endMinute: 60, durationMinutes: 20, seconds: 1200 },
                ],
                planSegmentTimers: {
                    'planned-0-0-seg0': { status: 'idle', elapsedSeconds: 10 },
                    'planned-0-0-seg1': { status: 'running', running: true, elapsedSeconds: 90, startedAt: 1234 },
                },
            },
        ],
    });

    assert.equal(controller.applyPlanSegmentReorder.call(ctx, 0, 'real-1', 'rest-0', 'before'), true);
    assert.deepEqual(ctx.timeSlots[0].planActivities.map((item) => ({
        label: item.label,
        startMinute: item.startMinute,
        endMinute: item.endMinute,
    })), [
        { label: 'A', startMinute: 0, endMinute: 20 },
        { label: 'B', startMinute: 20, endMinute: 40 },
    ]);
    assert.equal(ctx.timeSlots[0].planSegmentTimers['planned-0-0-seg1'].running, true);
    assert.equal(ctx.timeSlots[0].planSegmentTimers['planned-0-0-seg1'].startedAt, 1234);
});

test('merged planned row reorders inside the base slot and refreshes merge snapshot signature', () => {
    const ctx = createCtx({
        timeSlots: [
            {
                planned: 'Move, Shower, Prep',
                planActivities: [
                    { label: 'Move', activityId: 'move', startMinute: 0, endMinute: 90, durationMinutes: 90, seconds: 5400 },
                    { label: 'Shower', activityId: 'shower', startMinute: 90, endMinute: 150, durationMinutes: 60, seconds: 3600 },
                    { label: 'Prep', activityId: 'prep', startMinute: 150, endMinute: 180, durationMinutes: 30, seconds: 1800 },
                ],
                planSegmentTimers: {
                    'planned-0-2-seg0': { status: 'idle', elapsedSeconds: 1 },
                    'planned-0-2-seg1': { status: 'paused', elapsedSeconds: 2 },
                    'planned-0-2-seg2': { status: 'running', elapsedSeconds: 3 },
                },
                planMergeSnapshot: {
                    version: 2,
                    mergeKey: 'planned-0-2',
                    startIndex: 0,
                    endIndex: 2,
                    slots: [
                        { time: '4', planned: 'Move', planActivities: [{ label: 'Move', seconds: 5400 }], activityLog: {} },
                        { time: '5', planned: 'Shower', planActivities: [{ label: 'Shower', seconds: 3600 }], activityLog: {} },
                        { time: '6', planned: 'Prep', planActivities: [{ label: 'Prep', seconds: 1800 }], activityLog: {} },
                    ],
                    mergedFields: [{ key: 'planned-0-2', value: 'Move, Shower, Prep' }],
                },
            },
            { planned: '', planActivities: [], planSegmentTimers: {} },
            { planned: '', planActivities: [], planSegmentTimers: {} },
        ],
        resolvePlannedSlotContext() {
            return { baseIndex: 0, rangeStart: 0, rangeEnd: 2, slotCount: 3, blockMinutes: 180, mergeKey: 'planned-0-2', isMerged: true };
        },
    });

    assert.equal(controller.applyPlanSegmentReorder.call(ctx, 2, 2, 1, 'before'), true);
    assert.deepEqual(ctx.timeSlots[0].planActivities.map((item) => ({
        label: item.label,
        startMinute: item.startMinute,
        endMinute: item.endMinute,
        durationMinutes: item.durationMinutes,
    })), [
        { label: 'Move', startMinute: 0, endMinute: 90, durationMinutes: 90 },
        { label: 'Prep', startMinute: 90, endMinute: 120, durationMinutes: 30 },
        { label: 'Shower', startMinute: 120, endMinute: 180, durationMinutes: 60 },
    ]);
    assert.equal(ctx.timeSlots[0].planSegmentTimers['planned-0-2-seg1'].elapsedSeconds, 3);
    assert.equal(ctx.timeSlots[0].planSegmentTimers['planned-0-2-seg2'].elapsedSeconds, 2);
    assert.equal(ctx.timeSlots[0].planMergeSnapshot.postMergeSignature, planSegmentCore.buildPlanMergeBaseSignature(ctx.timeSlots[0]));
});

test('merged planned row supports virtual rest reorder and refreshes merge snapshot signature', () => {
    const ctx = createCtx({
        timeSlots: [
            {
                planned: 'A, B',
                planActivities: [
                    { label: 'A', activityId: 'a', startMinute: 0, endMinute: 30, durationMinutes: 30, seconds: 1800 },
                    { label: 'B', activityId: 'b', startMinute: 90, endMinute: 120, durationMinutes: 30, seconds: 1800 },
                ],
                planSegmentTimers: {
                    'planned-0-1-seg0': { status: 'idle', elapsedSeconds: 10 },
                    'planned-0-1-seg1': { status: 'paused', elapsedSeconds: 90 },
                },
                planMergeSnapshot: {
                    version: 2,
                    mergeKey: 'planned-0-1',
                    startIndex: 0,
                    endIndex: 1,
                    slots: [
                        { time: '4', planned: 'A', planActivities: [{ label: 'A', seconds: 1800 }], activityLog: {} },
                        { time: '5', planned: 'B', planActivities: [{ label: 'B', seconds: 1800 }], activityLog: {} },
                    ],
                    mergedFields: [{ key: 'planned-0-1', value: 'A, B' }],
                },
            },
            { planned: '', planActivities: [], planSegmentTimers: {} },
        ],
        resolvePlannedSlotContext() {
            return { baseIndex: 0, rangeStart: 0, rangeEnd: 1, slotCount: 2, blockMinutes: 120, mergeKey: 'planned-0-1', isMerged: true };
        },
    });

    assert.equal(controller.applyPlanSegmentReorder.call(ctx, 1, 'rest-0', 'real-1', 'after'), true);
    assert.deepEqual(ctx.timeSlots[0].planActivities.map((item) => ({
        label: item.label,
        startMinute: item.startMinute,
        endMinute: item.endMinute,
    })), [
        { label: 'A', startMinute: 0, endMinute: 30 },
        { label: 'B', startMinute: 30, endMinute: 60 },
    ]);
    assert.deepEqual(planSegmentCore.calculateVirtualRestGaps(ctx.timeSlots[0].planActivities, { startMinute: 0, endMinute: 120 }).map((gap) => ({
        startMinute: gap.startMinute,
        durationMinutes: gap.durationMinutes,
    })), [
        { startMinute: 60, durationMinutes: 60 },
    ]);
    assert.equal(ctx.timeSlots[0].planMergeSnapshot.postMergeSignature, planSegmentCore.buildPlanMergeBaseSignature(ctx.timeSlots[0]));
});

test('long press on planned segment body starts reorder without move mode', () => withDom(({ timers, root }) => {
    const ctx = createCtx({ plannedSlotMoveMode: false });
    const { entry, grid, first } = createEntry();
    appendSegmentChrome(first);
    root.appendChild(entry);

    controller.attachPlannedSegmentReorderListeners.call(ctx, entry, 0);
    first.dispatchEvent(createPointerEvent('pointerdown', first, 40));
    assert.equal(timers.length, 1);
    assert.equal(timers[0].delay, 220);
    timers[0]();

    assert.equal(ctx.plannedSegmentReorderState.active, true);
    assert.equal(hasClass(first, 'is-plan-segment-reorder-dragging'), true);
    assert.equal(hasClass(grid, 'is-plan-segment-reorder-active'), true);
    assert.equal(ctx.plannedSlotMoveMode, false);
    const ghost = root.querySelector('.plan-segment-reorder-drag-ghost');
    assert.ok(ghost);
    assert.equal(ctx.plannedSegmentReorderState.dragGhostEl, ghost);
    assert.equal(hasClass(ghost, 'split-grid-segment'), true);
    assert.equal(hasClass(ghost, 'plan-segment-reorder-preview-segment'), false);
    assert.equal(ghost.dataset.segmentKind, 'real-plan');
    assert.ok(ghost.querySelector('.plan-segment-graphic'));
    assert.equal(ghost.style.width, '150px');
    assert.equal(ghost.style.height, '60px');
    assert.equal(ghost.style.transform, 'translate3d(0px, 0px, 0)');
    assert.equal(hasClass(root, 'is-plan-segment-reorder-ghost-active'), true);
}));

test('drag ghost follows horizontal vertical and diagonal movement while outside valid targets', () => withDom(({ listeners, timers, root }) => {
    const ctx = createCtx();
    const { entry, grid, second } = createEntry();
    appendSegmentChrome(second);
    root.appendChild(entry);
    const original = JSON.stringify(ctx.timeSlots[0].planActivities);

    controller.attachPlannedSegmentReorderListeners.call(ctx, entry, 0);
    second.dispatchEvent(createPointerEvent('pointerdown', second, 220));
    timers[0]();
    const ghost = root.querySelector('.plan-segment-reorder-drag-ghost');
    assert.ok(ghost);

    listeners.pointermove[0](createPointerEvent('pointermove', second, 280, 80));
    assert.equal(ghost.style.transform, 'translate3d(210px, 60px, 0)');
    assert.equal(root.querySelector('.plan-segment-reorder-drag-ghost'), ghost);
    assert.equal(grid.querySelector('.plan-segment-reorder-preview-layer'), null);
    assert.equal(hasClass(grid, 'is-plan-segment-reorder-cancel'), true);

    listeners.pointermove[0](createPointerEvent('pointermove', second, 90, -40));
    assert.equal(ghost.style.transform, 'translate3d(20px, -60px, 0)');
    assert.equal(root.querySelector('.plan-segment-reorder-drag-ghost'), ghost);

    listeners.pointerup[0](createPointerEvent('pointerup', second, 90, -40));
    assert.equal(root.querySelector('.plan-segment-reorder-drag-ghost'), null);
    assert.equal(hasClass(root, 'is-plan-segment-reorder-ghost-active'), false);
    assert.equal(JSON.stringify(ctx.timeSlots[0].planActivities), original);
}));

test('movement beyond threshold before activation cancels reorder', () => withDom(({ listeners, timers, root }) => {
    const ctx = createCtx();
    const { entry, grid, first } = createEntry();
    root.appendChild(entry);

    controller.attachPlannedSegmentReorderListeners.call(ctx, entry, 0);
    first.dispatchEvent(createPointerEvent('pointerdown', first, 40));
    listeners.pointermove[0](createPointerEvent('pointermove', first, 60));

    assert.equal(timers.length, 1);
    assert.equal(ctx.plannedSegmentReorderState, null);
    assert.equal(hasClass(first, 'is-plan-segment-reorder-armed'), false);
    assert.equal(hasClass(grid, 'is-plan-segment-reorder-armed'), false);
    assert.equal(((first._listeners && first._listeners.selectstart) || []).length, 0);
}));

test('long press on planned segment label text starts reorder', () => withDom(({ timers, root }) => {
    const ctx = createCtx();
    const { entry, grid, first } = createEntry();
    const { label } = appendSegmentChrome(first);
    root.appendChild(entry);

    controller.attachPlannedSegmentReorderListeners.call(ctx, entry, 0);
    label.dispatchEvent(createPointerEvent('pointerdown', label, 40));
    assert.equal(timers.length, 1);
    timers[0]();

    assert.equal(ctx.plannedSegmentReorderState.active, true);
    assert.equal(hasClass(first, 'is-plan-segment-reorder-dragging'), true);
    assert.equal(hasClass(grid, 'is-plan-segment-reorder-active'), true);
}));

test('long press on planned segment graphic title starts reorder', () => withDom(({ timers, root }) => {
    const ctx = createCtx();
    const { entry, first } = createEntry();
    const { title } = appendSegmentChrome(first);
    root.appendChild(entry);

    controller.attachPlannedSegmentReorderListeners.call(ctx, entry, 0);
    title.dispatchEvent(createPointerEvent('pointerdown', title, 40));
    assert.equal(timers.length, 1);
    timers[0]();

    assert.equal(ctx.plannedSegmentReorderState.active, true);
    assert.equal(hasClass(first, 'is-plan-segment-reorder-dragging'), true);
}));

test('long press on planned segment timer display starts reorder', () => withDom(({ timers, root }) => {
    const ctx = createCtx();
    const { entry, first } = createEntry();
    const { timerTime } = appendSegmentChrome(first);
    root.appendChild(entry);

    controller.attachPlannedSegmentReorderListeners.call(ctx, entry, 0);
    timerTime.dispatchEvent(createPointerEvent('pointerdown', timerTime, 40));
    assert.equal(timers.length, 1);
    timers[0]();

    assert.equal(ctx.plannedSegmentReorderState.active, true);
    assert.equal(hasClass(first, 'is-plan-segment-reorder-dragging'), true);
}));

test('armed mobile reorder suppresses text selection, callout, and native drag on segment chrome', () => withDom(({ timers, root }) => {
    const ctx = createCtx();
    const { entry, grid, first } = createEntry();
    const { label, title, timerTime } = appendSegmentChrome(first);
    root.appendChild(entry);

    controller.attachPlannedSegmentReorderListeners.call(ctx, entry, 0);
    const startEvent = createTouchEvent('touchstart', label, 40);
    label.dispatchEvent(startEvent);

    assert.equal(timers.length, 1);
    assert.equal(hasClass(first, 'is-plan-segment-reorder-armed'), true);
    assert.equal(hasClass(grid, 'is-plan-segment-reorder-armed'), true);

    const selectEvent = createBrowserGestureEvent('selectstart', title);
    title.dispatchEvent(selectEvent);
    const calloutEvent = createBrowserGestureEvent('contextmenu', timerTime);
    timerTime.dispatchEvent(calloutEvent);
    const dragEvent = createBrowserGestureEvent('dragstart', label);
    label.dispatchEvent(dragEvent);

    assert.equal(selectEvent.defaultPrevented, true);
    assert.equal(calloutEvent.defaultPrevented, true);
    assert.equal(dragEvent.defaultPrevented, true);
    assert.equal(ctx.plannedSegmentReorderState.active, false);

    timers[0]();
    assert.equal(startEvent.defaultPrevented, true);
    assert.equal(hasClass(first, 'is-plan-segment-reorder-suppressing-selection'), true);
    assert.equal(hasClass(grid, 'is-plan-segment-reorder-suppressing-selection'), true);
}));

test('normal tap before long press does not start reorder or suppress click', () => withDom(({ listeners, timers, root }) => {
    const ctx = createCtx();
    const { entry, first } = createEntry();
    root.appendChild(entry);

    controller.attachPlannedSegmentReorderListeners.call(ctx, entry, 0);
    first.dispatchEvent(createPointerEvent('pointerdown', first, 40));
    assert.equal(timers.length, 1);
    listeners.pointerup[0](createPointerEvent('pointerup', first, 40));
    const click = createPointerEvent('click', first, 40);
    first.dispatchEvent(click);

    assert.equal(click.defaultPrevented, false);
    assert.equal(ctx.renderCalls, 0);
    assert.equal(ctx.plannedSegmentReorderState, null);
}));

test('normal tap on label or title still allows click handling', () => withDom(({ listeners, timers, root }) => {
    const ctx = createCtx();
    const { entry, first } = createEntry();
    const { label, title } = appendSegmentChrome(first);
    root.appendChild(entry);

    controller.attachPlannedSegmentReorderListeners.call(ctx, entry, 0);

    label.dispatchEvent(createPointerEvent('pointerdown', label, 40));
    listeners.pointerup[0](createPointerEvent('pointerup', label, 40));
    const labelClick = createPointerEvent('click', label, 40);
    label.dispatchEvent(labelClick);

    title.dispatchEvent(createPointerEvent('pointerdown', title, 40));
    listeners.pointerup[0](createPointerEvent('pointerup', title, 40));
    const titleClick = createPointerEvent('click', title, 40);
    title.dispatchEvent(titleClick);

    assert.equal(timers.length, 2);
    assert.equal(labelClick.defaultPrevented, false);
    assert.equal(titleClick.defaultPrevented, false);
    assert.equal(ctx.renderCalls, 0);
    assert.equal(ctx.plannedSegmentReorderState, null);
}));

test('resize handle, edge-zone, and timer button controls never start reorder', () => withDom(({ timers, root }) => {
    const ctx = createCtx({
        isCoarsePlanSegmentPointerContext() {
            return true;
        },
    });
    const { entry, first } = createEntry();
    const handle = createNode('span', 'plan-segment-resize-handle');
    const timerButton = createNode('button', 'plan-segment-timer-button');
    const input = createNode('input', 'plan-segment-title-edit-input');
    first.appendChild(handle);
    first.appendChild(timerButton);
    first.appendChild(input);
    root.appendChild(entry);

    controller.attachPlannedSegmentReorderListeners.call(ctx, entry, 0);
    handle.dispatchEvent(createPointerEvent('pointerdown', handle, 40));
    timerButton.dispatchEvent(createPointerEvent('pointerdown', timerButton, 40));
    input.dispatchEvent(createPointerEvent('pointerdown', input, 40));
    first.dispatchEvent(createPointerEvent('pointerdown', first, 4));

    assert.equal(timers.length, 0);
    assert.equal(ctx.plannedSegmentReorderState, undefined);
}));

test('resize-disabled running segment can reorder and keeps running timer state', () => withDom(({ listeners, timers, root }) => {
    const ctx = createCtx();
    ctx.timeSlots[0].planSegmentTimers = {
        'planned-0-0-seg0': { status: 'idle', elapsedSeconds: 10 },
        'planned-0-0-seg1': { status: 'running', running: true, elapsedSeconds: 90, startedAt: 1234 },
    };
    const { entry, first, second } = createEntry();
    second.classList.add('is-plan-segment-resize-disabled');
    root.appendChild(entry);

    controller.attachPlannedSegmentReorderListeners.call(ctx, entry, 0);
    second.dispatchEvent(createPointerEvent('pointerdown', second, 220));
    assert.equal(timers.length, 1);
    timers[0]();
    listeners.pointermove[0](createPointerEvent('pointermove', first, 40));
    listeners.pointerup[0](createPointerEvent('pointerup', first, 40));

    assert.deepEqual(ctx.timeSlots[0].planActivities.map((item) => item.label), ['Interview', 'Prep']);
    assert.equal(ctx.timeSlots[0].planSegmentTimers['planned-0-0-seg0'].status, 'running');
    assert.equal(ctx.timeSlots[0].planSegmentTimers['planned-0-0-seg0'].running, true);
    assert.equal(ctx.timeSlots[0].planSegmentTimers['planned-0-0-seg0'].startedAt, 1234);
}));

test('planned slot move mode blocks planned segment reorder start', () => withDom(({ timers, root }) => {
    const ctx = createCtx({
        plannedSlotMoveMode: true,
        isPlannedSlotMoveMode() {
            return true;
        },
    });
    const { entry, first } = createEntry();
    const { label } = appendSegmentChrome(first);
    root.appendChild(entry);

    controller.attachPlannedSegmentReorderListeners.call(ctx, entry, 0);
    first.dispatchEvent(createPointerEvent('pointerdown', first, 40));
    label.dispatchEvent(createPointerEvent('pointerdown', label, 40));

    assert.equal(timers.length, 0);
    assert.equal(ctx.plannedSegmentReorderState, undefined);
}));

test('touch long press reorders before target segment', () => withDom(({ listeners, timers, root }) => {
    const ctx = createCtx();
    const { entry, first, second } = createEntry();
    root.appendChild(entry);

    controller.attachPlannedSegmentReorderListeners.call(ctx, entry, 0);
    second.dispatchEvent(createTouchEvent('touchstart', second, 220));
    timers[0]();
    listeners.touchmove[0](createTouchEvent('touchmove', first, 40));
    listeners.touchend[0](createTouchEvent('touchend', first, 40));

    assert.deepEqual(ctx.timeSlots[0].planActivities.map((item) => item.label), ['Interview', 'Prep']);
    assert.equal(ctx.timeSlots[0].planSegmentTimers['planned-0-0-seg0'].elapsedSeconds, 90);
    assert.equal(ctx.plannedSegmentReorderState, null);
}));

test('reorder activation prevents default on armed touch and pointer paths', () => withDom(({ timers, root }) => {
    const touchCtx = createCtx();
    const touchEntry = createEntry();
    root.appendChild(touchEntry.entry);
    controller.attachPlannedSegmentReorderListeners.call(touchCtx, touchEntry.entry, 0);

    const touchStart = createTouchEvent('touchstart', touchEntry.second, 220);
    touchEntry.second.dispatchEvent(touchStart);
    timers[0]();

    assert.equal(touchStart.defaultPrevented, true);
    assert.equal(touchStart.propagationStopped, true);

    controller.clearPlannedSegmentReorderState.call(touchCtx);

    const pointerCtx = createCtx();
    const pointerEntry = createEntry();
    root.appendChild(pointerEntry.entry);
    controller.attachPlannedSegmentReorderListeners.call(pointerCtx, pointerEntry.entry, 0);

    const pointerStart = createPointerEvent('pointerdown', pointerEntry.second, 220);
    pointerEntry.second.dispatchEvent(pointerStart);
    timers[1]();

    assert.equal(pointerStart.defaultPrevented, true);
    assert.equal(pointerStart.propagationStopped, true);
    assert.equal(pointerEntry.second.capturedPointerId, 1);
}));

test('active drag over a valid target renders preview before drop and commit matches preview', () => withDom(({ listeners, timers, root }) => {
    const ctx = createCtx();
    const { entry, grid, first, second } = createEntry();
    appendSegmentChrome(second);
    root.appendChild(entry);

    controller.attachPlannedSegmentReorderListeners.call(ctx, entry, 0);
    second.dispatchEvent(createPointerEvent('pointerdown', second, 220));
    timers[0]();
    const ghost = root.querySelector('.plan-segment-reorder-drag-ghost');
    assert.ok(ghost);
    listeners.pointermove[0](createPointerEvent('pointermove', first, 40));

    const layer = grid.querySelector('.plan-segment-reorder-preview-layer');
    assert.ok(layer);
    assert.equal(hasClass(grid, 'is-previewing-plan-reorder'), true);
    assert.match(layer.innerHTML, /Interview/);
    assert.match(layer.innerHTML, /Prep/);
    const previewSegments = layer.querySelectorAll('.split-grid-segment');
    assert.equal(previewSegments.length, 2);
    previewSegments.forEach((segment) => {
        assert.equal(hasClass(segment, 'split-grid-segment'), true);
        assert.equal(hasClass(segment, 'plan-segment-reorder-preview-segment'), false);
        assert.equal(segment.dataset.segmentKind, 'real-plan');
        assert.ok(segment.querySelector('.plan-segment-graphic'));
        assert.ok(segment.style['--split-segment-color']);
    });
    assert.equal(previewSegments[0].style['--split-segment-color'], '#123456');
    assert.deepEqual(ctx.colorCalls.map((call) => ({
        type: call.type,
        label: call.label,
        role: call.role,
    })), [
        { type: 'planned', label: 'Interview', role: 'grid' },
        { type: 'planned', label: 'Prep', role: 'grid' },
    ]);
    assert.deepEqual(ctx.timeSlots[0].planActivities.map((item) => item.label), ['Prep', 'Interview']);

    listeners.pointerup[0](createPointerEvent('pointerup', first, 40));

    assert.deepEqual(ctx.timeSlots[0].planActivities.map((item) => item.label), ['Interview', 'Prep']);
    assert.equal(grid.querySelector('.plan-segment-reorder-preview-layer'), null);
    assert.equal(root.querySelector('.plan-segment-reorder-drag-ghost'), null);
    assert.equal(hasClass(grid, 'is-previewing-plan-reorder'), false);
    assert.equal(hasClass(grid, 'is-plan-segment-reorder-active'), false);
    assert.equal(hasClass(root, 'is-plan-segment-reorder-ghost-active'), false);
    assert.equal(hasClass(grid, 'is-plan-segment-reorder-armed'), false);
    assert.equal(hasClass(grid, 'is-plan-segment-reorder-suppressing-selection'), false);
    assert.equal(hasClass(second, 'is-plan-segment-reorder-armed'), false);
    assert.equal(hasClass(second, 'is-plan-segment-reorder-suppressing-selection'), false);
    assert.equal(((second._listeners && second._listeners.selectstart) || []).length, 0);
    assert.equal(((grid._listeners && grid._listeners.contextmenu) || []).length, 0);
    assert.equal(second.releasedPointerId, 1);
}));

test('repeated pointermove over same target does not rebuild preview layer', () => withDom(({ listeners, timers, root }) => {
    const ctx = createCtx();
    const { entry, grid, first, second } = createEntry();
    root.appendChild(entry);

    controller.attachPlannedSegmentReorderListeners.call(ctx, entry, 0);
    second.dispatchEvent(createPointerEvent('pointerdown', second, 220));
    timers[0]();
    listeners.pointermove[0](createPointerEvent('pointermove', first, 40));
    const layer = grid.querySelector('.plan-segment-reorder-preview-layer');
    const html = layer.innerHTML;
    listeners.pointermove[0](createPointerEvent('pointermove', first, 42));

    assert.equal(grid.querySelector('.plan-segment-reorder-preview-layer'), layer);
    assert.equal(layer.innerHTML, html);
}));

test('preview clears on outside drag and outside drop leaves data unchanged', () => withDom(({ listeners, timers, root }) => {
    const ctx = createCtx();
    const { entry, grid, first, second } = createEntry();
    appendSegmentChrome(second);
    root.appendChild(entry);
    const original = JSON.stringify(ctx.timeSlots[0].planActivities);

    controller.attachPlannedSegmentReorderListeners.call(ctx, entry, 0);
    second.dispatchEvent(createPointerEvent('pointerdown', second, 220));
    timers[0]();
    assert.ok(root.querySelector('.plan-segment-reorder-drag-ghost'));
    listeners.pointermove[0](createPointerEvent('pointermove', first, 40));
    assert.ok(grid.querySelector('.plan-segment-reorder-preview-layer'));

    listeners.pointermove[0](createPointerEvent('pointermove', second, 400, 120));
    assert.equal(grid.querySelector('.plan-segment-reorder-preview-layer'), null);
    assert.ok(root.querySelector('.plan-segment-reorder-drag-ghost'));
    assert.equal(hasClass(grid, 'is-previewing-plan-reorder'), false);
    listeners.pointerup[0](createPointerEvent('pointerup', second, 400, 120));

    assert.equal(root.querySelector('.plan-segment-reorder-drag-ghost'), null);
    assert.equal(JSON.stringify(ctx.timeSlots[0].planActivities), original);
    assert.equal(ctx.renderCalls, 0);
}));

test('escape clears active preview and leaves data unchanged', () => withDom(({ listeners, timers, root }) => {
    const ctx = createCtx();
    const { entry, grid, first, second } = createEntry();
    root.appendChild(entry);
    const original = JSON.stringify(ctx.timeSlots[0].planActivities);

    controller.attachPlannedSegmentReorderListeners.call(ctx, entry, 0);
    second.dispatchEvent(createPointerEvent('pointerdown', second, 220));
    timers[0]();
    listeners.pointermove[0](createPointerEvent('pointermove', first, 40));
    assert.ok(grid.querySelector('.plan-segment-reorder-preview-layer'));
    assert.ok(root.querySelector('.plan-segment-reorder-drag-ghost'));

    listeners.keydown[0]({ key: 'Escape' });

    assert.equal(grid.querySelector('.plan-segment-reorder-preview-layer'), null);
    assert.equal(root.querySelector('.plan-segment-reorder-drag-ghost'), null);
    assert.equal(JSON.stringify(ctx.timeSlots[0].planActivities), original);
    assert.equal(ctx.plannedSegmentReorderState, null);
}));

test('virtual rest segment can start long press reorder and drop after real segment', () => withDom(({ listeners, timers, root }) => {
    const ctx = createCtx({
        timeSlots: [
            {
                planned: 'A, B',
                planActivities: [
                    { label: 'A', activityId: 'a', startMinute: 0, endMinute: 20, durationMinutes: 20, seconds: 1200 },
                    { label: 'B', activityId: 'b', startMinute: 40, endMinute: 60, durationMinutes: 20, seconds: 1200 },
                ],
                planSegmentTimers: {
                    'planned-0-0-seg0': { status: 'idle', elapsedSeconds: 10 },
                    'planned-0-0-seg1': { status: 'paused', elapsedSeconds: 90 },
                },
            },
        ],
    });
    const { entry, grid, rest, second } = createEntryWithRest();
    root.appendChild(entry);

    controller.attachPlannedSegmentReorderListeners.call(ctx, entry, 0);
    rest.dispatchEvent(createPointerEvent('pointerdown', rest, 140));
    assert.equal(timers.length, 1);
    timers[0]();
    const ghost = root.querySelector('.plan-segment-reorder-drag-ghost');
    assert.ok(ghost);
    assert.equal(hasClass(ghost, 'split-grid-segment-virtual-rest'), true);
    assert.equal(ghost.dataset.segmentKind, 'virtual-rest');
    assert.equal(hasClass(ghost, 'plan-segment-reorder-preview-segment'), false);
    listeners.pointermove[0](createPointerEvent('pointermove', second, 260));
    const layer = grid.querySelector('.plan-segment-reorder-preview-layer');
    assert.ok(layer);
    const restPreview = layer.querySelector('.split-grid-segment-virtual-rest');
    assert.ok(restPreview);
    assert.equal(restPreview.dataset.segmentKind, 'virtual-rest');
    assert.equal(hasClass(restPreview, 'plan-segment-reorder-preview-rest'), true);
    assert.equal(hasClass(restPreview, 'plan-segment-reorder-preview-segment'), false);
    assert.match(layer.innerHTML, /휴식/);
    listeners.pointerup[0](createPointerEvent('pointerup', second, 260));
    assert.equal(root.querySelector('.plan-segment-reorder-drag-ghost'), null);

    assert.deepEqual(ctx.timeSlots[0].planActivities.map((item) => ({
        label: item.label,
        startMinute: item.startMinute,
        endMinute: item.endMinute,
    })), [
        { label: 'A', startMinute: 0, endMinute: 20 },
        { label: 'B', startMinute: 20, endMinute: 40 },
    ]);
    assert.deepEqual(planSegmentCore.calculateVirtualRestGaps(ctx.timeSlots[0].planActivities, { startMinute: 0, endMinute: 60 }).map((gap) => ({
        startMinute: gap.startMinute,
        durationMinutes: gap.durationMinutes,
    })), [
        { startMinute: 40, durationMinutes: 20 },
    ]);
}));

test('pointer cancel removes active drag ghost and leaves data unchanged', () => withDom(({ listeners, timers, root }) => {
    const ctx = createCtx();
    const { entry, second } = createEntry();
    appendSegmentChrome(second);
    root.appendChild(entry);
    const original = JSON.stringify(ctx.timeSlots[0].planActivities);

    controller.attachPlannedSegmentReorderListeners.call(ctx, entry, 0);
    second.dispatchEvent(createPointerEvent('pointerdown', second, 220));
    timers[0]();
    assert.ok(root.querySelector('.plan-segment-reorder-drag-ghost'));

    listeners.pointercancel[0](createPointerEvent('pointercancel', second, 260, 80));

    assert.equal(root.querySelector('.plan-segment-reorder-drag-ghost'), null);
    assert.equal(hasClass(root, 'is-plan-segment-reorder-ghost-active'), false);
    assert.equal(JSON.stringify(ctx.timeSlots[0].planActivities), original);
    assert.equal(ctx.plannedSegmentReorderState, null);
}));

test('virtual rest reorder arms the same no-selection and no-callout protection', () => withDom(({ timers, root }) => {
    const ctx = createCtx({
        timeSlots: [
            {
                planned: 'A, B',
                planActivities: [
                    { label: 'A', activityId: 'a', startMinute: 0, endMinute: 20, durationMinutes: 20, seconds: 1200 },
                    { label: 'B', activityId: 'b', startMinute: 40, endMinute: 60, durationMinutes: 20, seconds: 1200 },
                ],
                planSegmentTimers: {},
            },
        ],
    });
    const { entry, grid, rest } = createEntryWithRest();
    root.appendChild(entry);

    controller.attachPlannedSegmentReorderListeners.call(ctx, entry, 0);
    rest.dispatchEvent(createTouchEvent('touchstart', rest, 140));

    assert.equal(timers.length, 1);
    assert.equal(hasClass(rest, 'is-plan-segment-reorder-armed'), true);
    assert.equal(hasClass(grid, 'is-plan-segment-reorder-armed'), true);

    const selectEvent = createBrowserGestureEvent('selectstart', rest);
    rest.dispatchEvent(selectEvent);
    const calloutEvent = createBrowserGestureEvent('contextmenu', rest);
    rest.dispatchEvent(calloutEvent);

    assert.equal(selectEvent.defaultPrevented, true);
    assert.equal(calloutEvent.defaultPrevented, true);
}));

test('real segment can use virtual rest as a drop target', () => withDom(({ listeners, timers, root }) => {
    const ctx = createCtx({
        timeSlots: [
            {
                planned: 'A, B',
                planActivities: [
                    { label: 'A', activityId: 'a', startMinute: 0, endMinute: 20, durationMinutes: 20, seconds: 1200 },
                    { label: 'B', activityId: 'b', startMinute: 40, endMinute: 60, durationMinutes: 20, seconds: 1200 },
                ],
                planSegmentTimers: {
                    'planned-0-0-seg0': { status: 'idle', elapsedSeconds: 10 },
                    'planned-0-0-seg1': { status: 'running', running: true, elapsedSeconds: 90 },
                },
            },
        ],
    });
    const { entry, rest, second } = createEntryWithRest();
    root.appendChild(entry);

    controller.attachPlannedSegmentReorderListeners.call(ctx, entry, 0);
    second.dispatchEvent(createPointerEvent('pointerdown', second, 240));
    timers[0]();
    listeners.pointermove[0](createPointerEvent('pointermove', rest, 120));
    listeners.pointerup[0](createPointerEvent('pointerup', rest, 120));

    assert.deepEqual(ctx.timeSlots[0].planActivities.map((item) => ({
        label: item.label,
        startMinute: item.startMinute,
        endMinute: item.endMinute,
    })), [
        { label: 'A', startMinute: 0, endMinute: 20 },
        { label: 'B', startMinute: 20, endMinute: 40 },
    ]);
    assert.equal(ctx.timeSlots[0].planSegmentTimers['planned-0-0-seg1'].running, true);
}));

test('dropping outside the origin planned grid cancels and reverts', () => withDom(({ listeners, timers, root }) => {
    const ctx = createCtx();
    const { entry, second } = createEntry();
    root.appendChild(entry);
    const original = JSON.stringify(ctx.timeSlots[0].planActivities);

    controller.attachPlannedSegmentReorderListeners.call(ctx, entry, 0);
    second.dispatchEvent(createPointerEvent('pointerdown', second, 220));
    timers[0]();
    listeners.pointermove[0](createPointerEvent('pointermove', second, 400, 120));
    listeners.pointerup[0](createPointerEvent('pointerup', second, 400, 120));

    assert.equal(JSON.stringify(ctx.timeSlots[0].planActivities), original);
    assert.equal(ctx.renderCalls, 0);
    assert.equal(ctx.plannedSegmentReorderState, null);
}));
