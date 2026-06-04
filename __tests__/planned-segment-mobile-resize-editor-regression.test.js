const test = require('node:test');
const assert = require('node:assert/strict');

const { buildMethod } = require('./helpers/script-method-builder');

const attachPlanSegmentResizeListeners = buildMethod(
    'attachPlanSegmentResizeListeners(entryDiv, index)',
    '(entryDiv, index)'
);
const removePlanSegmentResizePreviewLayer = buildMethod(
    'removePlanSegmentResizePreviewLayer(grid)',
    '(grid)'
);
const clearActivePlanSegmentResizeClasses = buildMethod(
    'clearActivePlanSegmentResizeClasses(root)',
    '(root)'
);
const cleanupPlanSegmentResizeState = buildMethod(
    'cleanupPlanSegmentResizeState(rootOrGrid)',
    '(rootOrGrid)'
);
const openPlanSegmentMobileTextEditor = buildMethod(
    'openPlanSegmentMobileTextEditor(labelEl, index, event, options = {})',
    '(labelEl, index, event, options = {})'
);
const closePlanSegmentMobileTextEditor = buildMethod(
    'closePlanSegmentMobileTextEditor(options = {})',
    '(options = {})'
);

function classesOf(node) {
    return String(node && node.className || '').split(/\s+/).filter(Boolean);
}

function hasClass(node, className) {
    return classesOf(node).includes(className);
}

function matches(node, selector) {
    if (!node || !selector) return false;
    if (selector === '*') return true;
    if (selector.includes(',')) return selector.split(',').some(part => matches(node, part.trim()));
    if (selector === '.split-grid-segment[data-segment-kind="real-plan"]') {
        return hasClass(node, 'split-grid-segment') && node.dataset && node.dataset.segmentKind === 'real-plan';
    }
    if (selector === '.split-grid.is-previewing-plan-resize') {
        return hasClass(node, 'split-grid') && hasClass(node, 'is-previewing-plan-resize');
    }
    if (selector === '[tabindex]:not([tabindex="-1"])') return node.tabIndex != null && node.tabIndex !== -1;
    if (selector.startsWith('.')) {
        return selector.slice(1).split('.').every(className => hasClass(node, className));
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

function createNode(tagName = 'div', className = '', dataset = {}) {
    const listeners = {};
    const node = {
        tagName: tagName.toUpperCase(),
        className,
        dataset: { ...dataset },
        children: [],
        parentNode: null,
        style: {},
        textContent: '',
        value: '',
        disabled: false,
        classList: {
            add(...classNames) {
                const next = new Set(classesOf(node));
                classNames.forEach(className => next.add(className));
                node.className = Array.from(next).join(' ');
            },
            remove(...classNames) {
                const removeSet = new Set(classNames);
                node.className = classesOf(node).filter(className => !removeSet.has(className)).join(' ');
            },
            contains(className) {
                return hasClass(node, className);
            },
        },
        setAttribute(name, value) {
            this.attributes = this.attributes || {};
            this.attributes[name] = String(value);
            if (name === 'aria-label') this.ariaLabel = String(value);
            if (name === 'tabindex') this.tabIndex = Number(value);
        },
        getAttribute(name) {
            return this.attributes ? this.attributes[name] : undefined;
        },
        addEventListener(type, handler, options = false) {
            listeners[type] = listeners[type] || [];
            listeners[type].push({
                handler,
                capture: options === true || Boolean(options && options.capture),
            });
            node._listeners = listeners;
        },
        dispatchEvent(event) {
            if (!event.target) event.target = this;
            const getPath = (target) => {
                const path = [];
                let current = target;
                while (current) {
                    path.unshift(current);
                    current = current.parentNode;
                }
                return path;
            };
            const invoke = (node, capture) => {
                ((node && node._listeners && node._listeners[event.type]) || []).forEach((listener) => {
                    if (event.propagationStopped || listener.capture !== capture) return;
                    listener.handler(event);
                });
            };
            const path = getPath(event.target);
            path.slice(0, -1).forEach(ancestor => invoke(ancestor, true));
            if (!event.propagationStopped) {
                invoke(event.target, true);
                invoke(event.target, false);
            }
            if (event.bubbles && !event.propagationStopped) {
                path.slice(0, -1).reverse().forEach(ancestor => invoke(ancestor, false));
            }
        },
        appendChild(child) {
            child.parentNode = this;
            this.children.push(child);
            return child;
        },
        removeChild(child) {
            this.children = this.children.filter(item => item !== child);
            child.parentNode = null;
            return child;
        },
        querySelectorAll(selector) {
            if (selector === 'button, input, select, textarea, [tabindex]:not([tabindex="-1"])') {
                return findAll(this, '*').filter(child => (
                    matches(child, 'button')
                    || matches(child, 'input')
                    || matches(child, 'select')
                    || matches(child, 'textarea')
                    || matches(child, '[tabindex]:not([tabindex="-1"])')
                ));
            }
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
        contains(target) {
            return target === this || findAll(this, '*').includes(target);
        },
        focus() {
            if (global.document) global.document.activeElement = this;
        },
        blur() {
            if (global.document && global.document.activeElement === this) global.document.activeElement = null;
        },
        select() {},
        getBoundingClientRect() {
            return { left: 0, top: 0, right: 600, bottom: 80, width: 600, height: 80 };
        },
    };
    return node;
}

function createResizeFixture(options = {}) {
    const entry = createNode('div', 'time-entry');
    const grid = createNode('div', 'split-grid');
    const startMinute = Number.isFinite(options.startMinute) ? options.startMinute : 0;
    const endMinute = Number.isFinite(options.endMinute) ? options.endMinute : 30;
    const segment = createNode('div', 'split-grid-segment', {
        segmentKind: 'real-plan',
        segmentIndex: '0',
        segmentStartMinute: String(startMinute),
        segmentEndMinute: String(endMinute),
    });
    const handle = createNode('span', 'plan-segment-resize-handle plan-segment-resize-handle-right', {
        resizeEdge: 'right',
    });
    if (options.captureCalls) {
        handle.setPointerCapture = (pointerId) => {
            options.captureCalls.push(['set', pointerId]);
        };
        handle.releasePointerCapture = (pointerId) => {
            options.captureCalls.push(['release', pointerId]);
        };
    }
    entry.appendChild(grid);
    grid.appendChild(segment);
    segment.appendChild(handle);
    return { entry, grid, segment, handle };
}

function createPointerEvent(type, target, clientX, clientY = 40) {
    return {
        type,
        target,
        button: 0,
        pointerId: 7,
        clientX,
        clientY,
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

function createTouchEvent(type, target, clientX, clientY = 40) {
    const touch = { clientX, clientY };
    return {
        type,
        target,
        changedTouches: [touch],
        touches: type === 'touchend' || type === 'touchcancel' ? [] : [touch],
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

function withDocument(callback) {
    const previousDocument = global.document;
    const previousCore = global.TimeTrackerPlanSegmentCore;
    const listeners = {};
    const listenerBuckets = {};
    const listenerCounts = {};
    const syncListener = (type) => {
        listenerCounts[type] = (listenerBuckets[type] || []).length;
        if (listenerCounts[type] > 0) {
            listeners[type] = (event) => {
                [...listenerBuckets[type]].forEach(handler => handler(event));
            };
        } else {
            delete listeners[type];
        }
    };
    const body = createNode('body');
    global.document = {
        body,
        activeElement: null,
        createElement: (tagName) => createNode(tagName),
        addEventListener(type, handler) {
            listenerBuckets[type] = listenerBuckets[type] || [];
            listenerBuckets[type].push(handler);
            syncListener(type);
        },
        removeEventListener(type, handler) {
            listenerBuckets[type] = (listenerBuckets[type] || []).filter(item => item !== handler);
            syncListener(type);
        },
    };
    global.TimeTrackerPlanSegmentCore = {
        resizePlanSegmentInList(items, segmentIndex, edge, targetMinute) {
            return items.map((item, index) => index === segmentIndex
                ? { ...item, endMinute: edge === 'right' ? targetMinute : item.endMinute, durationMinutes: targetMinute }
                : item);
        },
        calculateVirtualRestGaps() {
            return [];
        },
    };
    try {
        callback({ listeners, listenerCounts, body });
    } finally {
        if (previousDocument === undefined) {
            delete global.document;
        } else {
            global.document = previousDocument;
        }
        if (previousCore === undefined) {
            delete global.TimeTrackerPlanSegmentCore;
        } else {
            global.TimeTrackerPlanSegmentCore = previousCore;
        }
    }
}

test('plan segment resize cleans preview state and lets a newly rendered handle resize again', () => {
    withDocument(({ listeners }) => {
        const calls = [];
        const ctx = {
            timeSlots: [{ planActivities: [{ label: 'Focus', startMinute: 0, endMinute: 30, durationMinutes: 30 }] }],
            removePlanSegmentResizePreviewLayer,
            clearActivePlanSegmentResizeClasses,
            cleanupPlanSegmentResizeState,
            getPlanSegmentBaseIndex(index) { return index; },
            getBlockLength() { return 1; },
            normalizePlanActivitiesPreservingSegments(items) { return items.map(item => ({ ...item })); },
            applyPlanSegmentResize(baseIndex, segmentIndex, edge, targetMinute) {
                calls.push(['resize', baseIndex, segmentIndex, edge, targetMinute]);
                return true;
            },
            closePlanSegmentMobileTextEditor() {
                calls.push(['close-mobile-editor']);
                return false;
            },
            closeInlinePlanDropdown() {
                calls.push(['close-dropdown']);
            },
        };

        const first = createResizeFixture();
        attachPlanSegmentResizeListeners.call(ctx, first.entry, 0);
        first.handle.dispatchEvent(createPointerEvent('pointerdown', first.handle, 0));
        listeners.pointermove(createPointerEvent('pointermove', first.handle, 100));
        assert.equal(first.grid.querySelectorAll('.plan-segment-resize-preview-layer').length, 0);
        listeners.pointerup(createPointerEvent('pointerup', first.handle, 100));

        assert.equal(first.grid.querySelectorAll('.plan-segment-resize-preview-layer').length, 0);
        assert.equal(hasClass(first.grid, 'is-previewing-plan-resize'), false);
        assert.equal(hasClass(first.segment, 'is-resizing-plan-segment'), false);

        const second = createResizeFixture();
        attachPlanSegmentResizeListeners.call(ctx, second.entry, 0);
        assert.equal(second.handle.dataset.resizeListenerAttached, 'true');
        second.handle.dispatchEvent(createPointerEvent('pointerdown', second.handle, 0));
        listeners.pointermove(createPointerEvent('pointermove', second.handle, 100));
        listeners.pointerup(createPointerEvent('pointerup', second.handle, 100));

        assert.deepEqual(calls.filter(call => call[0] === 'resize'), [
            ['resize', 0, 0, 'right', 40],
            ['resize', 0, 0, 'right', 40],
        ]);
    });
});

test('plan segment resize remains interactive after renderTimeEntries replaces handles', () => {
    withDocument(({ listeners, listenerCounts }) => {
        const container = createNode('div', 'time-entries');
        const captureCalls = [];
        const resizeCalls = [];
        let current = null;
        const ctx = {
            timeSlots: [{ planActivities: [{ label: 'Focus', startMinute: 0, endMinute: 30, durationMinutes: 30 }] }],
            removePlanSegmentResizePreviewLayer,
            clearActivePlanSegmentResizeClasses,
            cleanupPlanSegmentResizeState,
            getPlanSegmentBaseIndex(index) { return index; },
            getBlockLength() { return 1; },
            normalizePlanActivitiesPreservingSegments(items) { return items.map(item => ({ ...item })); },
            renderTimeEntries(preserveInlineDropdown) {
                assert.equal(preserveInlineDropdown, true);
                container.children.slice().forEach(child => container.removeChild(child));
                const segment = this.timeSlots[0].planActivities[0];
                current = createResizeFixture({
                    captureCalls,
                    startMinute: Number(segment.startMinute),
                    endMinute: Number(segment.endMinute),
                });
                container.appendChild(current.entry);
                attachPlanSegmentResizeListeners.call(this, current.entry, 0);
            },
            applyPlanSegmentResize(baseIndex, segmentIndex, edge, targetMinute) {
                resizeCalls.push(['resize', baseIndex, segmentIndex, edge, targetMinute]);
                this.timeSlots[baseIndex].planActivities[segmentIndex] = {
                    ...this.timeSlots[baseIndex].planActivities[segmentIndex],
                    endMinute: targetMinute,
                    durationMinutes: targetMinute,
                };
                this.renderTimeEntries(true);
                return true;
            },
            closePlanSegmentMobileTextEditor() {
                return false;
            },
            closeInlinePlanDropdown() {},
        };

        ctx.renderTimeEntries(true);
        const firstHandle = current.handle;
        assert.equal(firstHandle.dataset.resizeListenerAttached, 'true');

        firstHandle.dispatchEvent(createPointerEvent('pointerdown', firstHandle, 0));
        assert.equal(listenerCounts.pointermove, 1);
        assert.equal(listenerCounts.pointerup, 1);
        assert.equal(listenerCounts.pointercancel, 1);
        listeners.pointermove(createPointerEvent('pointermove', firstHandle, 100));
        assert.equal(current.grid.querySelectorAll('.plan-segment-resize-preview-layer').length, 0);
        listeners.pointerup(createPointerEvent('pointerup', firstHandle, 100));

        assert.deepEqual(resizeCalls, [['resize', 0, 0, 'right', 40]]);
        assert.equal(listenerCounts.pointermove, 0);
        assert.equal(listenerCounts.pointerup, 0);
        assert.equal(listenerCounts.pointercancel, 0);
        assert.deepEqual(captureCalls.slice(0, 2), [['set', 7], ['release', 7]]);
        assert.equal(current.grid.querySelectorAll('.plan-segment-resize-preview-layer').length, 0);
        assert.equal(container.querySelectorAll('.plan-segment-resize-preview-layer').length, 0);
        assert.equal(container.querySelectorAll('.split-grid.is-previewing-plan-resize').length, 0);
        assert.equal(container.querySelectorAll('.is-resizing-plan-segment').length, 0);

        const secondHandle = current.handle;
        assert.notEqual(secondHandle, firstHandle);
        assert.equal(secondHandle.dataset.resizeListenerAttached, 'true');
        assert.equal(firstHandle.dataset.resizeListenerAttached, 'true');

        secondHandle.dispatchEvent(createPointerEvent('pointerdown', secondHandle, 0));
        assert.equal(listenerCounts.pointermove, 1);
        assert.equal(listenerCounts.pointerup, 1);
        assert.equal(listenerCounts.pointercancel, 1);
        listeners.pointermove(createPointerEvent('pointermove', secondHandle, 100));
        listeners.pointerup(createPointerEvent('pointerup', secondHandle, 100));

        assert.deepEqual(resizeCalls, [
            ['resize', 0, 0, 'right', 40],
            ['resize', 0, 0, 'right', 50],
        ]);
        assert.equal(listenerCounts.pointermove, 0);
        assert.equal(listenerCounts.pointerup, 0);
        assert.equal(listenerCounts.pointercancel, 0);
        assert.deepEqual(captureCalls, [
            ['set', 7],
            ['release', 7],
            ['set', 7],
            ['release', 7],
        ]);
        assert.equal(container.querySelectorAll('.plan-segment-resize-preview-layer').length, 0);
        assert.equal(container.querySelectorAll('.split-grid.is-previewing-plan-resize').length, 0);
        assert.equal(container.querySelectorAll('.is-resizing-plan-segment').length, 0);
    });
});

test('handle target pointerdown is not intercepted by segment edge capture listener', () => {
    withDocument(({ listeners, listenerCounts }) => {
        const resizeCalls = [];
        const ctx = {
            timeSlots: [{ planActivities: [{ label: 'Focus', startMinute: 0, endMinute: 30, durationMinutes: 30 }] }],
            removePlanSegmentResizePreviewLayer,
            clearActivePlanSegmentResizeClasses,
            cleanupPlanSegmentResizeState,
            isCoarsePlanSegmentPointerContext() { return true; },
            getPlanSegmentBaseIndex(index) { return index; },
            getBlockLength() { return 1; },
            normalizePlanActivitiesPreservingSegments(items) { return items.map(item => ({ ...item })); },
            applyPlanSegmentResize(baseIndex, segmentIndex, edge, targetMinute) {
                resizeCalls.push(['resize', baseIndex, segmentIndex, edge, targetMinute]);
                return true;
            },
            closePlanSegmentMobileTextEditor() { return false; },
            closeInlinePlanDropdown() {},
        };
        const fixture = createResizeFixture();

        attachPlanSegmentResizeListeners.call(ctx, fixture.entry, 0);
        const pointerDown = createPointerEvent('pointerdown', fixture.handle, 0);
        fixture.handle.dispatchEvent(pointerDown);

        assert.equal(pointerDown.defaultPrevented, true);
        assert.equal(pointerDown.propagationStopped, true);
        assert.equal(listenerCounts.pointermove, 1);
        assert.equal(listenerCounts.pointerup, 1);
        assert.equal(listenerCounts.pointercancel, 1);

        fixture.handle.dispatchEvent(createPointerEvent('mousedown', fixture.handle, 0));
        assert.equal(listenerCounts.mousemove || 0, 0);
        assert.equal(listenerCounts.mouseup || 0, 0);

        listeners.pointermove(createPointerEvent('pointermove', fixture.handle, 100));
        listeners.pointerup(createPointerEvent('pointerup', fixture.handle, 100));

        assert.deepEqual(resizeCalls, [['resize', 0, 0, 'right', 40]]);
        assert.equal(listenerCounts.pointermove, 0);
        assert.equal(listenerCounts.pointerup, 0);
        assert.equal(listenerCounts.pointercancel, 0);
    });
});

test('mobile segment edge zone starts resize without targeting the handle', () => {
    withDocument(({ listeners }) => {
        const resizeCalls = [];
        const ctx = {
            timeSlots: [{ planActivities: [{ label: 'Focus', startMinute: 0, endMinute: 30, durationMinutes: 30 }] }],
            removePlanSegmentResizePreviewLayer,
            clearActivePlanSegmentResizeClasses,
            cleanupPlanSegmentResizeState,
            isCoarsePlanSegmentPointerContext() { return true; },
            getPlanSegmentBaseIndex(index) { return index; },
            getBlockLength() { return 1; },
            normalizePlanActivitiesPreservingSegments(items) { return items.map(item => ({ ...item })); },
            applyPlanSegmentResize(baseIndex, segmentIndex, edge, targetMinute) {
                resizeCalls.push(['resize', baseIndex, segmentIndex, edge, targetMinute]);
                return true;
            },
            closePlanSegmentMobileTextEditor() { return false; },
            closeInlinePlanDropdown() {},
        };
        const fixture = createResizeFixture();

        attachPlanSegmentResizeListeners.call(ctx, fixture.entry, 0);
        const down = createPointerEvent('pointerdown', fixture.segment, 590);
        fixture.segment.dispatchEvent(down);

        assert.equal(down.defaultPrevented, true);
        assert.equal(down.propagationStopped, true);
        assert.equal(hasClass(fixture.segment, 'is-resizing-plan-segment'), true);
        assert.equal(fixture.grid.querySelectorAll('.plan-segment-resize-preview-layer').length, 0);

        listeners.pointermove(createPointerEvent('pointermove', fixture.segment, 690));
        listeners.pointerup(createPointerEvent('pointerup', fixture.segment, 690));

        assert.deepEqual(resizeCalls, [['resize', 0, 0, 'right', 40]]);
        assert.equal(fixture.grid.querySelectorAll('.plan-segment-resize-preview-layer').length, 0);
        assert.equal(hasClass(fixture.segment, 'is-resizing-plan-segment'), false);
    });
});

test('touch handle resize works without pointer events and cleans up', () => {
    withDocument(({ listeners, listenerCounts }) => {
        const resizeCalls = [];
        const ctx = {
            timeSlots: [{ planActivities: [{ label: 'Focus', startMinute: 0, endMinute: 30, durationMinutes: 30 }] }],
            removePlanSegmentResizePreviewLayer,
            clearActivePlanSegmentResizeClasses,
            cleanupPlanSegmentResizeState,
            isCoarsePlanSegmentPointerContext() { return true; },
            getPlanSegmentBaseIndex(index) { return index; },
            getBlockLength() { return 1; },
            normalizePlanActivitiesPreservingSegments(items) { return items.map(item => ({ ...item })); },
            applyPlanSegmentResize(baseIndex, segmentIndex, edge, targetMinute) {
                resizeCalls.push(['resize', baseIndex, segmentIndex, edge, targetMinute]);
                return true;
            },
            closePlanSegmentMobileTextEditor() { return false; },
            closeInlinePlanDropdown() {},
        };
        const fixture = createResizeFixture();

        attachPlanSegmentResizeListeners.call(ctx, fixture.entry, 0);
        const touchStart = createTouchEvent('touchstart', fixture.handle, 0);
        fixture.handle.dispatchEvent(touchStart);

        assert.equal(touchStart.defaultPrevented, true);
        assert.equal(touchStart.propagationStopped, true);
        assert.equal(listenerCounts.touchmove, 1);
        assert.equal(listenerCounts.touchend, 1);
        assert.equal(listenerCounts.touchcancel, 1);
        assert.equal(fixture.grid.querySelectorAll('.plan-segment-resize-preview-layer').length, 0);

        listeners.touchmove(createTouchEvent('touchmove', fixture.handle, 100));
        listeners.touchend(createTouchEvent('touchend', fixture.handle, 100));

        assert.deepEqual(resizeCalls, [['resize', 0, 0, 'right', 40]]);
        assert.equal(listenerCounts.touchmove, 0);
        assert.equal(listenerCounts.touchend, 0);
        assert.equal(listenerCounts.touchcancel, 0);
        assert.equal(fixture.grid.querySelectorAll('.plan-segment-resize-preview-layer').length, 0);
        assert.equal(hasClass(fixture.segment, 'is-resizing-plan-segment'), false);
        assert.ok(Number(fixture.segment.dataset.planResizeClickSuppressUntil) >= Date.now());
        assert.ok(Number(ctx.planSegmentResizeClickSuppressUntil) >= Date.now());
    });
});

test('touch edge-zone resize works without pointer events and cleans up', () => {
    withDocument(({ listeners, listenerCounts }) => {
        const resizeCalls = [];
        const ctx = {
            timeSlots: [{ planActivities: [{ label: 'Focus', startMinute: 0, endMinute: 30, durationMinutes: 30 }] }],
            removePlanSegmentResizePreviewLayer,
            clearActivePlanSegmentResizeClasses,
            cleanupPlanSegmentResizeState,
            isCoarsePlanSegmentPointerContext() { return true; },
            getPlanSegmentBaseIndex(index) { return index; },
            getBlockLength() { return 1; },
            normalizePlanActivitiesPreservingSegments(items) { return items.map(item => ({ ...item })); },
            applyPlanSegmentResize(baseIndex, segmentIndex, edge, targetMinute) {
                resizeCalls.push(['resize', baseIndex, segmentIndex, edge, targetMinute]);
                return true;
            },
            closePlanSegmentMobileTextEditor() { return false; },
            closeInlinePlanDropdown() {},
        };
        const fixture = createResizeFixture();

        attachPlanSegmentResizeListeners.call(ctx, fixture.entry, 0);
        const touchStart = createTouchEvent('touchstart', fixture.segment, 590);
        fixture.segment.dispatchEvent(touchStart);

        assert.equal(touchStart.defaultPrevented, true);
        assert.equal(touchStart.propagationStopped, true);
        assert.equal(listenerCounts.touchmove, 1);
        assert.equal(listenerCounts.touchend, 1);
        assert.equal(listenerCounts.touchcancel, 1);

        listeners.touchmove(createTouchEvent('touchmove', fixture.segment, 690));
        listeners.touchend(createTouchEvent('touchend', fixture.segment, 690));

        assert.deepEqual(resizeCalls, [['resize', 0, 0, 'right', 40]]);
        assert.equal(listenerCounts.touchmove, 0);
        assert.equal(listenerCounts.touchend, 0);
        assert.equal(listenerCounts.touchcancel, 0);
        assert.equal(fixture.grid.querySelectorAll('.plan-segment-resize-preview-layer').length, 0);
        assert.equal(hasClass(fixture.segment, 'is-resizing-plan-segment'), false);
    });
});

test('mobile left edge-zone on an adjacent segment uses the previous segment right boundary', () => {
    withDocument(({ listeners }) => {
        const resizeCalls = [];
        const ctx = {
            timeSlots: [{ planActivities: [
                { label: 'A', startMinute: 0, endMinute: 30, durationMinutes: 30 },
                { label: 'B', startMinute: 30, endMinute: 60, durationMinutes: 30 },
            ] }],
            removePlanSegmentResizePreviewLayer,
            clearActivePlanSegmentResizeClasses,
            cleanupPlanSegmentResizeState,
            isCoarsePlanSegmentPointerContext() { return true; },
            getPlanSegmentBaseIndex(index) { return index; },
            getBlockLength() { return 1; },
            normalizePlanActivitiesPreservingSegments(items) { return items.map(item => ({ ...item })); },
            applyPlanSegmentResize(baseIndex, segmentIndex, edge, targetMinute) {
                resizeCalls.push(['resize', baseIndex, segmentIndex, edge, targetMinute]);
                return true;
            },
        };
        const entry = createNode('div', 'time-entry');
        const grid = createNode('div', 'split-grid');
        const firstSegment = createNode('div', 'split-grid-segment', {
            segmentKind: 'real-plan',
            segmentIndex: '0',
            segmentStartMinute: '0',
            segmentEndMinute: '30',
        });
        const secondSegment = createNode('div', 'split-grid-segment', {
            segmentKind: 'real-plan',
            segmentIndex: '1',
            segmentStartMinute: '30',
            segmentEndMinute: '60',
        });
        entry.appendChild(grid);
        grid.appendChild(firstSegment);
        grid.appendChild(secondSegment);

        attachPlanSegmentResizeListeners.call(ctx, entry, 0);
        const pointerStart = createPointerEvent('pointerdown', secondSegment, 20);
        secondSegment.dispatchEvent(pointerStart);
        assert.equal(pointerStart.defaultPrevented, true);
        assert.equal(pointerStart.propagationStopped, true);
        assert.equal(hasClass(firstSegment, 'is-resizing-plan-segment'), true);
        assert.equal(hasClass(secondSegment, 'is-resizing-plan-segment'), false);

        listeners.pointermove(createPointerEvent('pointermove', secondSegment, 120));
        listeners.pointerup(createPointerEvent('pointerup', secondSegment, 120));

        assert.deepEqual(resizeCalls, [['resize', 0, 0, 'right', 40]]);
        assert.equal(hasClass(firstSegment, 'is-resizing-plan-segment'), false);
    });
});

test('mobile left edge-zone on the first segment does not create an independent resize target', () => {
    withDocument(({ listenerCounts }) => {
        const resizeCalls = [];
        const ctx = {
            timeSlots: [{ planActivities: [{ label: 'Focus', startMinute: 0, endMinute: 30, durationMinutes: 30 }] }],
            removePlanSegmentResizePreviewLayer,
            clearActivePlanSegmentResizeClasses,
            cleanupPlanSegmentResizeState,
            isCoarsePlanSegmentPointerContext() { return true; },
            getPlanSegmentBaseIndex(index) { return index; },
            getBlockLength() { return 1; },
            normalizePlanActivitiesPreservingSegments(items) { return items.map(item => ({ ...item })); },
            applyPlanSegmentResize(baseIndex, segmentIndex, edge, targetMinute) {
                resizeCalls.push(['resize', baseIndex, segmentIndex, edge, targetMinute]);
                return true;
            },
        };
        const fixture = createResizeFixture();

        attachPlanSegmentResizeListeners.call(ctx, fixture.entry, 0);
        const pointerStart = createPointerEvent('pointerdown', fixture.segment, 20);
        fixture.segment.dispatchEvent(pointerStart);

        assert.equal(pointerStart.defaultPrevented, false);
        assert.deepEqual(resizeCalls, []);
        assert.equal(listenerCounts.pointermove || 0, 0);
        assert.equal(hasClass(fixture.segment, 'is-resizing-plan-segment'), false);
    });
});

test('mobile segment edge zone does not steal clear label title or timer targets', () => {
    withDocument(({ listenerCounts }) => {
        const resizeCalls = [];
        const ctx = {
            timeSlots: [{ planActivities: [{ label: 'Focus', startMinute: 0, endMinute: 30, durationMinutes: 30 }] }],
            removePlanSegmentResizePreviewLayer,
            clearActivePlanSegmentResizeClasses,
            cleanupPlanSegmentResizeState,
            isCoarsePlanSegmentPointerContext() { return true; },
            getPlanSegmentBaseIndex(index) { return index; },
            getBlockLength() { return 1; },
            normalizePlanActivitiesPreservingSegments(items) { return items.map(item => ({ ...item })); },
            applyPlanSegmentResize(baseIndex, segmentIndex, edge, targetMinute) {
                resizeCalls.push(['resize', baseIndex, segmentIndex, edge, targetMinute]);
                return true;
            },
        };
        const fixture = createResizeFixture();
        const label = createNode('span', 'plan-segment-label-text');
        const title = createNode('span', 'plan-segment-graphic-title');
        const timer = createNode('button', 'plan-segment-timer-button');
        fixture.segment.appendChild(label);
        fixture.segment.appendChild(title);
        fixture.segment.appendChild(timer);

        attachPlanSegmentResizeListeners.call(ctx, fixture.entry, 0);
        [
            { target: label, clientX: 590 },
            { target: title, clientX: 590 },
            { target: timer, clientX: 20 },
        ].forEach(({ target, clientX }) => {
            const event = createPointerEvent('pointerdown', target, clientX);
            fixture.segment.dispatchEvent(event);
            assert.equal(event.defaultPrevented, false);
            assert.equal(event.propagationStopped, false);
        });
        [
            { target: label, clientX: 590 },
            { target: title, clientX: 590 },
            { target: timer, clientX: 20 },
        ].forEach(({ target, clientX }) => {
            const event = createTouchEvent('touchstart', target, clientX);
            fixture.segment.dispatchEvent(event);
            assert.equal(event.defaultPrevented, false);
            assert.equal(event.propagationStopped, false);
        });

        assert.deepEqual(resizeCalls, []);
        assert.equal(listenerCounts.pointermove || 0, 0);
        assert.equal(listenerCounts.touchmove || 0, 0);
        assert.equal(hasClass(fixture.segment, 'is-resizing-plan-segment'), false);
    });
});

test('desktop segment background edge does not start edge-zone resize but handle resize still works', () => {
    withDocument(({ listeners, listenerCounts }) => {
        const resizeCalls = [];
        const ctx = {
            timeSlots: [{ planActivities: [{ label: 'Focus', startMinute: 0, endMinute: 30, durationMinutes: 30 }] }],
            removePlanSegmentResizePreviewLayer,
            clearActivePlanSegmentResizeClasses,
            cleanupPlanSegmentResizeState,
            isCoarsePlanSegmentPointerContext() { return false; },
            getPlanSegmentBaseIndex(index) { return index; },
            getBlockLength() { return 1; },
            normalizePlanActivitiesPreservingSegments(items) { return items.map(item => ({ ...item })); },
            applyPlanSegmentResize(baseIndex, segmentIndex, edge, targetMinute) {
                resizeCalls.push(['resize', baseIndex, segmentIndex, edge, targetMinute]);
                return true;
            },
        };
        const fixture = createResizeFixture();

        attachPlanSegmentResizeListeners.call(ctx, fixture.entry, 0);
        fixture.segment.dispatchEvent(createPointerEvent('pointerdown', fixture.segment, 590));
        assert.equal(listenerCounts.pointermove || 0, 0);

        fixture.handle.dispatchEvent(createPointerEvent('pointerdown', fixture.handle, 0));
        listeners.pointermove(createPointerEvent('pointermove', fixture.handle, 100));
        listeners.pointerup(createPointerEvent('pointerup', fixture.handle, 100));

        assert.deepEqual(resizeCalls, [['resize', 0, 0, 'right', 40]]);
    });
});

test('edge-zone resize remains interactive after renderTimeEntries replaces segment nodes', () => {
    withDocument(({ listeners, listenerCounts }) => {
        const container = createNode('div', 'time-entries');
        const resizeCalls = [];
        let current = null;
        const ctx = {
            timeSlots: [{ planActivities: [{ label: 'Focus', startMinute: 0, endMinute: 30, durationMinutes: 30 }] }],
            removePlanSegmentResizePreviewLayer,
            clearActivePlanSegmentResizeClasses,
            cleanupPlanSegmentResizeState,
            isCoarsePlanSegmentPointerContext() { return true; },
            getPlanSegmentBaseIndex(index) { return index; },
            getBlockLength() { return 1; },
            normalizePlanActivitiesPreservingSegments(items) { return items.map(item => ({ ...item })); },
            renderTimeEntries(preserveInlineDropdown) {
                assert.equal(preserveInlineDropdown, true);
                container.children.slice().forEach(child => container.removeChild(child));
                const segment = this.timeSlots[0].planActivities[0];
                current = createResizeFixture({
                    startMinute: Number(segment.startMinute),
                    endMinute: Number(segment.endMinute),
                });
                container.appendChild(current.entry);
                attachPlanSegmentResizeListeners.call(this, current.entry, 0);
            },
            applyPlanSegmentResize(baseIndex, segmentIndex, edge, targetMinute) {
                resizeCalls.push(['resize', baseIndex, segmentIndex, edge, targetMinute]);
                this.timeSlots[baseIndex].planActivities[segmentIndex] = {
                    ...this.timeSlots[baseIndex].planActivities[segmentIndex],
                    endMinute: targetMinute,
                    durationMinutes: targetMinute,
                };
                this.renderTimeEntries(true);
                return true;
            },
            closePlanSegmentMobileTextEditor() { return false; },
            closeInlinePlanDropdown() {},
        };

        ctx.renderTimeEntries(true);
        const firstSegment = current.segment;
        firstSegment.dispatchEvent(createPointerEvent('pointerdown', firstSegment, 590));
        listeners.pointermove(createPointerEvent('pointermove', firstSegment, 690));
        listeners.pointerup(createPointerEvent('pointerup', firstSegment, 690));

        const secondSegment = current.segment;
        assert.notEqual(secondSegment, firstSegment);
        secondSegment.dispatchEvent(createPointerEvent('pointerdown', secondSegment, 590));
        listeners.pointermove(createPointerEvent('pointermove', secondSegment, 690));
        listeners.pointerup(createPointerEvent('pointerup', secondSegment, 690));

        assert.deepEqual(resizeCalls, [
            ['resize', 0, 0, 'right', 40],
            ['resize', 0, 0, 'right', 50],
        ]);
        assert.equal(listenerCounts.pointermove, 0);
        assert.equal(listenerCounts.pointerup, 0);
        assert.equal(listenerCounts.pointercancel, 0);
        assert.equal(container.querySelectorAll('.plan-segment-resize-preview-layer').length, 0);
        assert.equal(container.querySelectorAll('.split-grid.is-previewing-plan-resize').length, 0);
        assert.equal(container.querySelectorAll('.is-resizing-plan-segment').length, 0);
    });
});

test('mobile segment text editor uses Korean labels and traps focus', () => {
    withDocument(({ body }) => {
        const segment = createNode('div', 'split-grid-segment', {
            segmentKind: 'real-plan',
            segmentIndex: '0',
        });
        const label = createNode('span', 'plan-segment-label-text');
        label.textContent = 'Focus';
        segment.appendChild(label);
        const calls = [];
        const ctx = {
            mobilePlanSegmentEditor: null,
            inlinePlanDropdown: null,
            normalizeActivityText(value) { return String(value || '').trim(); },
            getPlanSegmentBaseIndex(index) { return index; },
            applyPlanSegmentTitleEdit(baseIndex, segmentIndex, value) {
                calls.push(['save', baseIndex, segmentIndex, value]);
            },
            closePlanSegmentMobileTextEditor,
        };

        assert.equal(openPlanSegmentMobileTextEditor.call(ctx, label, 0, null, {
            baseIndex: 0,
            segmentIndex: 0,
            mobileAriaLabel: '\uD65C\uB3D9\uBA85 \uC218\uC815',
        }), true);

        const editor = ctx.mobilePlanSegmentEditor;
        const root = editor.root;
        const closeBtn = root.querySelector('.plan-segment-mobile-editor-close');
        const input = root.querySelector('.plan-segment-mobile-editor-input');
        const cancelBtn = root.querySelector('.plan-segment-mobile-editor-cancel');
        const saveBtn = root.querySelector('.plan-segment-mobile-editor-save');

        assert.equal(root.ariaLabel, '활동명 수정');
        assert.equal(root.querySelector('.plan-segment-mobile-editor-title').textContent, '활동명 수정');
        assert.equal(closeBtn.ariaLabel, '닫기');
        assert.equal(cancelBtn.textContent, '취소');
        assert.equal(saveBtn.textContent, '저장');
        assert.equal(global.document.activeElement, input);

        global.document.activeElement = saveBtn;
        root.dispatchEvent({
            type: 'keydown',
            key: 'Tab',
            preventDefault() { this.prevented = true; },
            stopPropagation() {},
        });
        assert.equal(global.document.activeElement, closeBtn);

        global.document.activeElement = closeBtn;
        root.dispatchEvent({
            type: 'keydown',
            key: 'Tab',
            shiftKey: true,
            preventDefault() { this.prevented = true; },
            stopPropagation() {},
        });
        assert.equal(global.document.activeElement, saveBtn);

        root.dispatchEvent({
            type: 'keydown',
            key: 'Escape',
            preventDefault() {},
            stopPropagation() {},
        });
        assert.equal(ctx.mobilePlanSegmentEditor, null);
        assert.equal(body.children.includes(root), false);
        assert.equal(hasClass(body, 'inline-plan-sheet-open'), false);
    });
});
