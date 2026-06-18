const test = require('node:test');
const assert = require('node:assert/strict');

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
    if (selector === '.split-grid-segment[data-segment-kind="real-plan"]') {
        return hasClass(node, 'split-grid-segment') && node.dataset && node.dataset.segmentKind === 'real-plan';
    }
    if (selector === '.plan-segment-reorder-insert-marker') return hasClass(node, 'plan-segment-reorder-insert-marker');
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

function createNode(tagName = 'div', className = '', dataset = {}, rect = null) {
    const listeners = {};
    const node = {
        tagName: tagName.toUpperCase(),
        className,
        dataset: { ...dataset },
        children: [],
        parentNode: null,
        style: {},
        attributes: {},
        _rect: rect || { left: 0, top: 0, right: 300, bottom: 60, width: 300, height: 60 },
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

function withDom(fn) {
    const originalDocument = global.document;
    const originalSetTimeout = global.setTimeout;
    const originalClearTimeout = global.clearTimeout;
    const listeners = {};
    const timers = [];
    const root = createNode('div', 'document-root');
    global.document = {
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
    global.setTimeout = (handler) => {
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
    }, { left: 0, top: 0, right: 150, bottom: 60, width: 150, height: 60 });
    const second = createNode('div', 'split-grid-segment', {
        segmentKind: 'real-plan',
        segmentIndex: '1',
    }, { left: 150, top: 0, right: 300, bottom: 60, width: 150, height: 60 });
    entry.appendChild(grid);
    grid.appendChild(first);
    grid.appendChild(second);
    return { entry, grid, first, second };
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

test('long press on planned segment body starts reorder without move mode', () => withDom(({ timers, root }) => {
    const ctx = createCtx({ plannedSlotMoveMode: false });
    const { entry, grid, first } = createEntry();
    root.appendChild(entry);

    controller.attachPlannedSegmentReorderListeners.call(ctx, entry, 0);
    first.dispatchEvent(createPointerEvent('pointerdown', first, 40));
    assert.equal(timers.length, 1);
    timers[0]();

    assert.equal(ctx.plannedSegmentReorderState.active, true);
    assert.equal(hasClass(first, 'is-plan-segment-reorder-dragging'), true);
    assert.equal(hasClass(grid, 'is-plan-segment-reorder-active'), true);
    assert.equal(ctx.plannedSlotMoveMode, false);
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

test('resize handle, edge-zone, and timer controls never start reorder', () => withDom(({ timers, root }) => {
    const ctx = createCtx({
        isCoarsePlanSegmentPointerContext() {
            return true;
        },
    });
    const { entry, first } = createEntry();
    const handle = createNode('span', 'plan-segment-resize-handle');
    const timerButton = createNode('button', 'plan-segment-timer-button');
    first.appendChild(handle);
    first.appendChild(timerButton);
    root.appendChild(entry);

    controller.attachPlannedSegmentReorderListeners.call(ctx, entry, 0);
    handle.dispatchEvent(createPointerEvent('pointerdown', handle, 40));
    timerButton.dispatchEvent(createPointerEvent('pointerdown', timerButton, 40));
    first.dispatchEvent(createPointerEvent('pointerdown', first, 4));

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
