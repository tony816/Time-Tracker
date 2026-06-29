const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { buildMethod } = require('./helpers/script-method-builder');
const realPlanSegmentCore = require('../core/plan-segment-core');
const interactionsCss = fs.readFileSync(path.join(__dirname, '..', 'styles', 'interactions.css'), 'utf8');

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
const closePlanSegmentMobileTextEditor = buildMethod(
    'closePlanSegmentMobileTextEditor(options = {})',
    '(options = {})'
);
const getPlanSegmentVisualIdentityKey = buildMethod(
    'getPlanSegmentVisualIdentityKey(segment)',
    '(segment)'
);
const resolveMergedPlanSegmentResizeGroup = buildMethod(
    'resolveMergedPlanSegmentResizeGroup(activities, segmentIndex)',
    '(activities, segmentIndex)'
);
const buildMergedPlanSegmentResizeSource = buildMethod(
    'buildMergedPlanSegmentResizeSource(activities, group)',
    '(activities, group)'
);
const applyPlanSegmentResize = buildMethod(
    'applyPlanSegmentResize(baseIndex, segmentIndex, edge, targetMinute)',
    '(baseIndex, segmentIndex, edge, targetMinute)'
);
const deletePlanSegment = buildMethod(
    'deletePlanSegment(baseIndex, segmentIndex)',
    '(baseIndex, segmentIndex)'
);
const replacePlanSegmentWithRest = buildMethod(
    'replacePlanSegmentWithRest(baseIndex, segmentIndex)',
    '(baseIndex, segmentIndex)'
);

function classesOf(node) {
    let className = '';
    try {
        className = typeof (node && node.className) === 'string' ? node.className : '';
    } catch (_) {
        className = '';
    }
    if (!className && node && typeof node.getAttribute === 'function') {
        className = node.getAttribute('class') || '';
    }
    return String(className).split(/\s+/).filter(Boolean);
}

function hasClass(node, className) {
    return classesOf(node).includes(className);
}

function getRealPreviewDurations(root) {
    return root.querySelectorAll('.plan-segment-resize-preview-segment')
        .filter(node => !hasClass(node, 'plan-segment-resize-preview-rest') && !hasClass(node, 'plan-segment-resize-preview-empty'))
        .map(node => {
            const duration = node.querySelector('.plan-segment-resize-preview-duration');
            return String(duration && duration.textContent || '');
        });
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
        _innerHTML: '',
        get innerHTML() {
            return this._innerHTML;
        },
        set innerHTML(value) {
            this._innerHTML = String(value || '');
            if (this._innerHTML === '') {
                this.children.forEach((child) => {
                    child.parentNode = null;
                });
                this.children = [];
            }
        },
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
    const handleEdge = options.handleEdge === 'left' ? 'left' : 'right';
    const segmentIndex = Number.isInteger(options.segmentIndex) ? options.segmentIndex : 0;
    const segment = createNode('div', 'split-grid-segment', {
        segmentKind: 'real-plan',
        segmentIndex: String(segmentIndex),
        segmentStartMinute: String(startMinute),
        segmentEndMinute: String(endMinute),
    });
    const handle = createNode('span', `plan-segment-resize-handle plan-segment-resize-handle-${handleEdge}`, {
        resizeEdge: handleEdge,
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

function createMergedResizeFixture(options = {}) {
    const entry = createNode('div', 'time-entry');
    const grid = createNode('div', 'split-grid');
    const handleEdge = options.handleEdge === 'left' ? 'left' : 'right';
    const segment = createNode('div', 'split-grid-segment connect-top', {
        segmentKind: 'real-plan',
        segmentIndex: String(Number.isInteger(options.segmentIndex) ? options.segmentIndex : 1),
        segmentStartMinute: String(Number.isFinite(options.startMinute) ? options.startMinute : 0),
        segmentEndMinute: String(Number.isFinite(options.endMinute) ? options.endMinute : 60),
    });
    const handle = createNode('span', `plan-segment-resize-handle plan-segment-resize-handle-${handleEdge}`, {
        resizeEdge: handleEdge,
    });
    entry.appendChild(grid);
    grid.appendChild(segment);
    segment.appendChild(handle);
    return { entry, grid, segment, handle };
}

function createSvgLikeNode(tagName = 'svg') {
    const node = createNode(tagName);
    Object.defineProperty(node, 'className', {
        configurable: true,
        get() {
            return { baseVal: '' };
        },
        set() {
            throw new Error('SVGElement.className assignment is not supported');
        },
    });
    return node;
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

function withDocument(callback, options = {}) {
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
        createElementNS: options.createElementNS,
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
        ...(options.planSegmentCore || {}),
        resizePlanSegmentInList: (options.planSegmentCore && options.planSegmentCore.resizePlanSegmentInList)
            || function resizePlanSegmentInList(items, segmentIndex, edge, targetMinute) {
            return items.map((item, index) => index === segmentIndex
                ? { ...item, endMinute: edge === 'right' ? targetMinute : item.endMinute, durationMinutes: targetMinute }
                : item);
        },
        calculateVirtualRestGaps: (options.planSegmentCore && options.planSegmentCore.calculateVirtualRestGaps)
            || function calculateVirtualRestGaps() {
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
        const activeGuide = first.grid.querySelector('.plan-segment-resize-preview-guide');
        assert.ok(activeGuide);
        assert.equal(activeGuide.style.pointerEvents, 'none');
        listeners.pointermove(createPointerEvent('pointermove', first.handle, 100));
        assert.equal(first.grid.querySelectorAll('.plan-segment-resize-preview-layer').length, 1);
        assert.ok(first.grid.querySelector('.plan-segment-resize-preview-guide'));
        listeners.pointerup(createPointerEvent('pointerup', first.handle, 100));

        assert.equal(first.grid.querySelectorAll('.plan-segment-resize-preview-layer').length, 0);
        assert.equal(first.grid.querySelectorAll('.plan-segment-resize-preview-guide').length, 0);
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

test('merged identical planned segment right handle resizes and persists the full visual span', () => {
    withDocument(({ listeners }) => {
        const fixture = createMergedResizeFixture({ handleEdge: 'right', startMinute: 0, endMinute: 60, segmentIndex: 1 });
        const ctx = {
            timeSlots: [{
                planActivities: [
                    { label: 'Focus', activityText: 'Focus', activityId: 'focus-id', startMinute: 0, endMinute: 30, durationMinutes: 30, seconds: 1800 },
                    { label: 'Focus', activityText: 'Focus', activityId: 'focus-id', startMinute: 30, endMinute: 60, durationMinutes: 30, seconds: 1800 },
                ],
            }],
            removePlanSegmentResizePreviewLayer,
            clearActivePlanSegmentResizeClasses,
            cleanupPlanSegmentResizeState,
            getPlanSegmentVisualIdentityKey,
            resolveMergedPlanSegmentResizeGroup,
            buildMergedPlanSegmentResizeSource,
            applyPlanSegmentResize,
            getPlanSegmentBaseIndex(index) { return index; },
            getBlockLength() { return 2; },
            normalizeActivityText(value) { return String(value || '').trim(); },
            normalizePlanActivitiesPreservingSegments(items) { return items.map(item => ({ ...item })); },
            formatActivitiesSummary(items) { return items.map(item => item.label).join(', '); },
            renderTimeEntries() {},
            calculateTotals() {},
            autoSave() {},
        };

        attachPlanSegmentResizeListeners.call(ctx, fixture.entry, 0);
        assert.equal(fixture.grid.querySelectorAll('.plan-segment-resize-handle').length, 1);

        fixture.handle.dispatchEvent(createPointerEvent('pointerdown', fixture.handle, 600));
        listeners.pointermove(createPointerEvent('pointermove', fixture.handle, 700));
        assert.deepEqual([...new Set(getRealPreviewDurations(fixture.grid))], ['70m']);
        listeners.pointerup(createPointerEvent('pointerup', fixture.handle, 700));

        assert.deepEqual(ctx.timeSlots[0].planActivities.map(item => ({
            label: item.label,
            startMinute: item.startMinute,
            endMinute: item.endMinute,
            durationMinutes: item.durationMinutes,
        })), [
            { label: 'Focus', startMinute: 0, endMinute: 70, durationMinutes: 70 },
        ]);

        const rerenderFixture = createMergedResizeFixture({ handleEdge: 'right', startMinute: 0, endMinute: 70, segmentIndex: 0 });
        attachPlanSegmentResizeListeners.call(ctx, rerenderFixture.entry, 0);
        assert.equal(rerenderFixture.grid.querySelectorAll('.plan-segment-resize-handle').length, 1);
    }, { planSegmentCore: realPlanSegmentCore });
});

test('merged planned segment right handle expands into next row first cell by dragging downward', () => {
    withDocument(({ listeners }) => {
        const fixture = createMergedResizeFixture({ handleEdge: 'right', startMinute: 0, endMinute: 60, segmentIndex: 1 });
        const ctx = {
            timeSlots: [{
                planActivities: [
                    { label: 'Focus', activityText: 'Focus', activityId: 'focus-id', startMinute: 0, endMinute: 30, durationMinutes: 30, seconds: 1800 },
                    { label: 'Focus', activityText: 'Focus', activityId: 'focus-id', startMinute: 30, endMinute: 60, durationMinutes: 30, seconds: 1800 },
                ],
            }],
            removePlanSegmentResizePreviewLayer,
            clearActivePlanSegmentResizeClasses,
            cleanupPlanSegmentResizeState,
            getPlanSegmentVisualIdentityKey,
            resolveMergedPlanSegmentResizeGroup,
            buildMergedPlanSegmentResizeSource,
            applyPlanSegmentResize,
            getPlanSegmentBaseIndex(index) { return index; },
            getBlockLength() { return 2; },
            normalizeActivityText(value) { return String(value || '').trim(); },
            normalizePlanActivitiesPreservingSegments(items) { return items.map(item => ({ ...item })); },
            formatActivitiesSummary(items) { return items.map(item => item.label).join(', '); },
            renderTimeEntries() {},
            calculateTotals() {},
            autoSave() {},
        };

        attachPlanSegmentResizeListeners.call(ctx, fixture.entry, 0);
        fixture.handle.dispatchEvent(createPointerEvent('pointerdown', fixture.handle, 600, 40));
        listeners.pointermove(createPointerEvent('pointermove', fixture.handle, 50, 120));

        assert.deepEqual([...new Set(getRealPreviewDurations(fixture.grid))], ['70m']);

        listeners.pointerup(createPointerEvent('pointerup', fixture.handle, 50, 120));

        assert.deepEqual(ctx.timeSlots[0].planActivities.map(item => ({
            label: item.label,
            startMinute: item.startMinute,
            endMinute: item.endMinute,
            durationMinutes: item.durationMinutes,
        })), [
            { label: 'Focus', startMinute: 0, endMinute: 70, durationMinutes: 70 },
        ]);
    }, { planSegmentCore: realPlanSegmentCore });
});

test('merged downward resize preview uses down guide and keeps row chunks within bounds', () => {
    withDocument(({ listeners }) => {
        const fixture = createMergedResizeFixture({ handleEdge: 'right', startMinute: 0, endMinute: 60, segmentIndex: 1 });
        const ctx = {
            timeSlots: [{
                planActivities: [
                    { label: 'Focus', activityText: 'Focus', activityId: 'focus-id', startMinute: 0, endMinute: 30, durationMinutes: 30, seconds: 1800 },
                    { label: 'Focus', activityText: 'Focus', activityId: 'focus-id', startMinute: 30, endMinute: 60, durationMinutes: 30, seconds: 1800 },
                ],
            }],
            removePlanSegmentResizePreviewLayer,
            clearActivePlanSegmentResizeClasses,
            cleanupPlanSegmentResizeState,
            getPlanSegmentVisualIdentityKey,
            resolveMergedPlanSegmentResizeGroup,
            buildMergedPlanSegmentResizeSource,
            applyPlanSegmentResize,
            getPlanSegmentBaseIndex(index) { return index; },
            getBlockLength() { return 2; },
            normalizeActivityText(value) { return String(value || '').trim(); },
            normalizePlanActivitiesPreservingSegments(items) { return items.map(item => ({ ...item })); },
            formatActivitiesSummary(items) { return items.map(item => item.label).join(', '); },
            renderTimeEntries() {},
            calculateTotals() {},
            autoSave() {},
        };

        attachPlanSegmentResizeListeners.call(ctx, fixture.entry, 0);
        fixture.handle.dispatchEvent(createPointerEvent('pointerdown', fixture.handle, 600, 40));
        listeners.pointermove(createPointerEvent('pointermove', fixture.handle, 150, 120));

        const guide = latestGuide(fixture.grid);
        assert.ok(guide);
        assert.equal(hasClass(guide, 'plan-segment-resize-preview-arrow-down'), true);
        assert.equal(hasClass(guide, 'plan-segment-resize-preview-arrow-left-only'), false);
        assert.equal(hasClass(guide, 'plan-segment-resize-preview-arrow-right-only'), false);
        assert.equal(guide.getAttribute('viewBox'), '0 0 40 28');
        assert.equal(guide.getAttribute('width'), '40');
        assert.equal(guide.getAttribute('height'), '28');
        assert.equal(guide.querySelectorAll('.plan-segment-resize-preview-arrow-shape').length, 1);
        assert.equal(guide.querySelectorAll('.plan-segment-resize-preview-arrow-sheen').length, 2);
        assert.equal(guide.querySelectorAll('.plan-segment-resize-preview-arrow-spark').length, 2);

        const realSegments = fixture.grid.querySelectorAll('.plan-segment-resize-preview-segment')
            .filter(node => !hasClass(node, 'plan-segment-resize-preview-rest') && !hasClass(node, 'plan-segment-resize-preview-empty'));
        assert.ok(realSegments.length >= 2);
        realSegments.forEach((segment) => {
            const width = parseFloat(segment.style.width || '100');
            assert.ok(width <= 100, `preview width should stay inside its grid chunk, got ${segment.style.width}`);
            assert.equal(segment.style.maxWidth, '100%');
            assert.equal(segment.style.boxSizing, 'border-box');
        });

        listeners.pointerup(createPointerEvent('pointerup', fixture.handle, 150, 120));

        assert.deepEqual(ctx.timeSlots[0].planActivities.map(item => ({
            startMinute: item.startMinute,
            endMinute: item.endMinute,
            durationMinutes: item.durationMinutes,
        })), [
            { startMinute: 0, endMinute: 80, durationMinutes: 80 },
        ]);
    }, { planSegmentCore: realPlanSegmentCore });
});

test('merged downward resize switches to horizontal guide when moving within the new row', () => {
    withDocument(({ listeners }) => {
        const fixture = createMergedResizeFixture({ handleEdge: 'right', startMinute: 0, endMinute: 60, segmentIndex: 1 });
        const ctx = {
            timeSlots: [{
                planActivities: [
                    { label: 'Focus', activityText: 'Focus', activityId: 'focus-id', startMinute: 0, endMinute: 30, durationMinutes: 30, seconds: 1800 },
                    { label: 'Focus', activityText: 'Focus', activityId: 'focus-id', startMinute: 30, endMinute: 60, durationMinutes: 30, seconds: 1800 },
                ],
            }],
            removePlanSegmentResizePreviewLayer,
            clearActivePlanSegmentResizeClasses,
            cleanupPlanSegmentResizeState,
            getPlanSegmentVisualIdentityKey,
            resolveMergedPlanSegmentResizeGroup,
            buildMergedPlanSegmentResizeSource,
            applyPlanSegmentResize,
            getPlanSegmentBaseIndex(index) { return index; },
            getBlockLength() { return 2; },
            normalizeActivityText(value) { return String(value || '').trim(); },
            normalizePlanActivitiesPreservingSegments(items) { return items.map(item => ({ ...item })); },
            formatActivitiesSummary(items) { return items.map(item => item.label).join(', '); },
            renderTimeEntries() {},
            calculateTotals() {},
            autoSave() {},
        };

        attachPlanSegmentResizeListeners.call(ctx, fixture.entry, 0);
        fixture.handle.dispatchEvent(createPointerEvent('pointerdown', fixture.handle, 600, 40));
        listeners.pointermove(createPointerEvent('pointermove', fixture.handle, 50, 120));

        let guide = latestGuide(fixture.grid);
        assert.ok(guide);
        assert.equal(hasClass(guide, 'plan-segment-resize-preview-arrow-down'), true);

        listeners.pointermove(createPointerEvent('pointermove', fixture.handle, 150, 120));

        guide = latestGuide(fixture.grid);
        assert.ok(guide);
        assert.equal(hasClass(guide, 'plan-segment-resize-preview-arrow-down'), false);
        assert.equal(hasClass(guide, 'plan-segment-resize-preview-arrow-right-only'), true);
        assert.equal(hasClass(guide, 'plan-segment-resize-preview-arrow-left-only'), false);
        assert.equal(guide.getAttribute('viewBox'), '56 0 40 28');
        assert.equal(guide.getAttribute('width'), '40');
        assert.equal(guide.getAttribute('height'), '28');
        assert.equal(guide.querySelectorAll('.plan-segment-resize-preview-arrow-shape').length, 1);
        assert.deepEqual([...new Set(getRealPreviewDurations(fixture.grid))], ['80m']);

        listeners.pointermove(createPointerEvent('pointermove', fixture.handle, 250, 120));
        guide = latestGuide(fixture.grid);
        assert.ok(guide);
        assert.equal(hasClass(guide, 'plan-segment-resize-preview-arrow-down'), false);
        assert.equal(hasClass(guide, 'plan-segment-resize-preview-arrow-right-only'), true);
        assert.deepEqual([...new Set(getRealPreviewDurations(fixture.grid))], ['90m']);

        listeners.pointermove(createPointerEvent('pointermove', fixture.handle, 150, 120));
        guide = latestGuide(fixture.grid);
        assert.ok(guide);
        assert.equal(hasClass(guide, 'plan-segment-resize-preview-arrow-down'), false);
        assert.equal(hasClass(guide, 'plan-segment-resize-preview-arrow-left-only'), true);
        assert.equal(hasClass(guide, 'plan-segment-resize-preview-arrow-right-only'), false);
        assert.equal(guide.getAttribute('viewBox'), '0 0 40 28');
        assert.deepEqual([...new Set(getRealPreviewDurations(fixture.grid))], ['80m']);

        listeners.pointerup(createPointerEvent('pointerup', fixture.handle, 150, 120));

        assert.deepEqual(ctx.timeSlots[0].planActivities.map(item => ({
            startMinute: item.startMinute,
            endMinute: item.endMinute,
            durationMinutes: item.durationMinutes,
        })), [
            { startMinute: 0, endMinute: 80, durationMinutes: 80 },
        ]);
    }, { planSegmentCore: realPlanSegmentCore });
});

test('merged planned segment right handle combines downward and right movement for wrapped rows', () => {
    withDocument(({ listeners }) => {
        const fixture = createMergedResizeFixture({ handleEdge: 'right', startMinute: 0, endMinute: 60, segmentIndex: 1 });
        const ctx = {
            timeSlots: [{
                planActivities: [
                    { label: 'Focus', activityText: 'Focus', activityId: 'focus-id', startMinute: 0, endMinute: 30, durationMinutes: 30, seconds: 1800 },
                    { label: 'Focus', activityText: 'Focus', activityId: 'focus-id', startMinute: 30, endMinute: 60, durationMinutes: 30, seconds: 1800 },
                ],
            }],
            removePlanSegmentResizePreviewLayer,
            clearActivePlanSegmentResizeClasses,
            cleanupPlanSegmentResizeState,
            getPlanSegmentVisualIdentityKey,
            resolveMergedPlanSegmentResizeGroup,
            buildMergedPlanSegmentResizeSource,
            applyPlanSegmentResize,
            getPlanSegmentBaseIndex(index) { return index; },
            getBlockLength() { return 2; },
            normalizeActivityText(value) { return String(value || '').trim(); },
            normalizePlanActivitiesPreservingSegments(items) { return items.map(item => ({ ...item })); },
            formatActivitiesSummary(items) { return items.map(item => item.label).join(', '); },
            renderTimeEntries() {},
            calculateTotals() {},
            autoSave() {},
        };

        attachPlanSegmentResizeListeners.call(ctx, fixture.entry, 0);
        fixture.handle.dispatchEvent(createPointerEvent('pointerdown', fixture.handle, 600, 40));
        listeners.pointermove(createPointerEvent('pointermove', fixture.handle, 150, 120));

        assert.deepEqual([...new Set(getRealPreviewDurations(fixture.grid))], ['80m']);

        listeners.pointerup(createPointerEvent('pointerup', fixture.handle, 150, 120));

        assert.deepEqual(ctx.timeSlots[0].planActivities.map(item => ({
            startMinute: item.startMinute,
            endMinute: item.endMinute,
            durationMinutes: item.durationMinutes,
        })), [
            { startMinute: 0, endMinute: 80, durationMinutes: 80 },
        ]);
    }, { planSegmentCore: realPlanSegmentCore });
});

test('normal sixty minute planned slot ignores downward drag as over-sixty expansion', () => {
    withDocument(({ listeners }) => {
        const applyCalls = [];
        const ctx = {
            timeSlots: [{ planActivities: [{ label: 'Focus', startMinute: 0, endMinute: 60, durationMinutes: 60, seconds: 3600 }] }],
            removePlanSegmentResizePreviewLayer,
            clearActivePlanSegmentResizeClasses,
            cleanupPlanSegmentResizeState,
            getPlanSegmentBaseIndex(index) { return index; },
            getBlockLength() { return 1; },
            normalizePlanActivitiesPreservingSegments(items) { return items.map(item => ({ ...item })); },
            applyPlanSegmentResize(baseIndex, segmentIndex, edge, targetMinute) {
                applyCalls.push({ baseIndex, segmentIndex, edge, targetMinute });
                return true;
            },
            closePlanSegmentMobileTextEditor() { return false; },
            closeInlinePlanDropdown() {},
        };
        const fixture = createResizeFixture({ endMinute: 60 });

        attachPlanSegmentResizeListeners.call(ctx, fixture.entry, 0);
        fixture.handle.dispatchEvent(createPointerEvent('pointerdown', fixture.handle, 600, 40));
        listeners.pointermove(createPointerEvent('pointermove', fixture.handle, 600, 120));

        assert.deepEqual(latestPreviewDurations(fixture.grid), ['60m']);

        listeners.pointerup(createPointerEvent('pointerup', fixture.handle, 600, 120));

        assert.deepEqual(applyCalls, []);
        assert.equal(ctx.timeSlots[0].planActivities[0].endMinute, 60);
    }, { planSegmentCore: realPlanSegmentCore });
});

test('merged planned segment touch resize uses vertical row movement like pointer resize', () => {
    withDocument(({ listeners }) => {
        const fixture = createMergedResizeFixture({ handleEdge: 'right', startMinute: 0, endMinute: 60, segmentIndex: 1 });
        const ctx = {
            timeSlots: [{
                planActivities: [
                    { label: 'Focus', activityText: 'Focus', activityId: 'focus-id', startMinute: 0, endMinute: 30, durationMinutes: 30, seconds: 1800 },
                    { label: 'Focus', activityText: 'Focus', activityId: 'focus-id', startMinute: 30, endMinute: 60, durationMinutes: 30, seconds: 1800 },
                ],
            }],
            removePlanSegmentResizePreviewLayer,
            clearActivePlanSegmentResizeClasses,
            cleanupPlanSegmentResizeState,
            getPlanSegmentVisualIdentityKey,
            resolveMergedPlanSegmentResizeGroup,
            buildMergedPlanSegmentResizeSource,
            applyPlanSegmentResize,
            getPlanSegmentBaseIndex(index) { return index; },
            getBlockLength() { return 2; },
            normalizeActivityText(value) { return String(value || '').trim(); },
            normalizePlanActivitiesPreservingSegments(items) { return items.map(item => ({ ...item })); },
            formatActivitiesSummary(items) { return items.map(item => item.label).join(', '); },
            renderTimeEntries() {},
            calculateTotals() {},
            autoSave() {},
        };

        attachPlanSegmentResizeListeners.call(ctx, fixture.entry, 0);
        fixture.handle.dispatchEvent(createTouchEvent('touchstart', fixture.handle, 600, 40));
        listeners.touchmove(createTouchEvent('touchmove', fixture.handle, 50, 120));

        const guide = latestGuide(fixture.grid);
        assert.ok(guide);
        assert.equal(hasClass(guide, 'plan-segment-resize-preview-arrow-down'), true);
        fixture.grid.querySelectorAll('.plan-segment-resize-preview-segment').forEach((segment) => {
            const width = parseFloat(segment.style.width || '100');
            assert.ok(width <= 100, `touch preview width should stay inside its grid chunk, got ${segment.style.width}`);
        });
        assert.deepEqual([...new Set(getRealPreviewDurations(fixture.grid))], ['70m']);

        listeners.touchmove(createTouchEvent('touchmove', fixture.handle, 150, 120));
        const horizontalGuide = latestGuide(fixture.grid);
        assert.ok(horizontalGuide);
        assert.equal(hasClass(horizontalGuide, 'plan-segment-resize-preview-arrow-down'), false);
        assert.equal(hasClass(horizontalGuide, 'plan-segment-resize-preview-arrow-right-only'), true);
        assert.deepEqual([...new Set(getRealPreviewDurations(fixture.grid))], ['80m']);

        listeners.touchend(createTouchEvent('touchend', fixture.handle, 150, 120));

        assert.deepEqual(ctx.timeSlots[0].planActivities.map(item => ({
            startMinute: item.startMinute,
            endMinute: item.endMinute,
            durationMinutes: item.durationMinutes,
        })), [
            { startMinute: 0, endMinute: 80, durationMinutes: 80 },
        ]);
    }, { planSegmentCore: realPlanSegmentCore });
});

test('merged identical planned segment left handle resizes and persists the full visual span', () => {
    withDocument(({ listeners }) => {
        const fixture = createMergedResizeFixture({ handleEdge: 'left', startMinute: 20, endMinute: 80, segmentIndex: 1 });
        const ctx = {
            timeSlots: [{
                planActivities: [
                    { label: 'Focus', activityText: 'Focus', activityId: 'focus-id', startMinute: 20, endMinute: 50, durationMinutes: 30, seconds: 1800 },
                    { label: 'Focus', activityText: 'Focus', activityId: 'focus-id', startMinute: 50, endMinute: 80, durationMinutes: 30, seconds: 1800 },
                ],
            }],
            removePlanSegmentResizePreviewLayer,
            clearActivePlanSegmentResizeClasses,
            cleanupPlanSegmentResizeState,
            getPlanSegmentVisualIdentityKey,
            resolveMergedPlanSegmentResizeGroup,
            buildMergedPlanSegmentResizeSource,
            applyPlanSegmentResize,
            getPlanSegmentBaseIndex(index) { return index; },
            getBlockLength() { return 2; },
            normalizeActivityText(value) { return String(value || '').trim(); },
            normalizePlanActivitiesPreservingSegments(items) { return items.map(item => ({ ...item })); },
            formatActivitiesSummary(items) { return items.map(item => item.label).join(', '); },
            renderTimeEntries() {},
            calculateTotals() {},
            autoSave() {},
        };

        attachPlanSegmentResizeListeners.call(ctx, fixture.entry, 0);
        assert.equal(fixture.grid.querySelectorAll('.plan-segment-resize-handle').length, 1);

        fixture.handle.dispatchEvent(createPointerEvent('pointerdown', fixture.handle, 200));
        listeners.pointermove(createPointerEvent('pointermove', fixture.handle, 100));
        assert.deepEqual([...new Set(getRealPreviewDurations(fixture.grid))], ['70m']);
        listeners.pointerup(createPointerEvent('pointerup', fixture.handle, 100));

        assert.deepEqual(ctx.timeSlots[0].planActivities.map(item => ({
            label: item.label,
            startMinute: item.startMinute,
            endMinute: item.endMinute,
            durationMinutes: item.durationMinutes,
        })), [
            { label: 'Focus', startMinute: 10, endMinute: 80, durationMinutes: 70 },
        ]);
    }, { planSegmentCore: realPlanSegmentCore });
});

test('merged planned resize resolution does not use label-only identity', () => {
    const ctx = {
        normalizeActivityText(value) { return String(value || '').trim(); },
        getPlanSegmentVisualIdentityKey,
        resolveMergedPlanSegmentResizeGroup,
    };
    const activities = [
        { label: 'Focus', activityText: 'Focus', activityId: 'focus-a', startMinute: 0, endMinute: 30, durationMinutes: 30 },
        { label: 'Focus', activityText: 'Focus', activityId: 'focus-b', startMinute: 30, endMinute: 60, durationMinutes: 30 },
    ];

    assert.equal(resolveMergedPlanSegmentResizeGroup.call(ctx, activities, 1), null);
});

test('merged planned resize resolution follows chronological visual grouping for out-of-order activities', () => {
    const ctx = {
        normalizeActivityText(value) { return String(value || '').trim(); },
        getPlanSegmentVisualIdentityKey,
        resolveMergedPlanSegmentResizeGroup,
        buildMergedPlanSegmentResizeSource,
    };
    const activities = [
        { label: 'Email', activityText: 'Email', activityId: 'email-id', startMinute: 60, endMinute: 90, durationMinutes: 30 },
        { label: 'Focus', activityText: 'Focus', activityId: 'focus-id', startMinute: 30, endMinute: 60, durationMinutes: 30 },
        { label: 'Focus', activityText: 'Focus', activityId: 'focus-id', startMinute: 0, endMinute: 30, durationMinutes: 30 },
    ];

    const group = resolveMergedPlanSegmentResizeGroup.call(ctx, activities, 1);
    assert.deepEqual(group.originalIndices, [2, 1]);
    assert.equal(group.sourceSegmentIndex, 0);
    assert.equal(group.startMinute, 0);
    assert.equal(group.endMinute, 60);

    const source = buildMergedPlanSegmentResizeSource.call(ctx, activities, group);
    assert.equal(source.segmentIndex, 0);
    assert.deepEqual(source.activities.map(item => ({
        label: item.label,
        startMinute: item.startMinute,
        endMinute: item.endMinute,
        durationMinutes: item.durationMinutes,
    })), [
        { label: 'Focus', startMinute: 0, endMinute: 60, durationMinutes: 60 },
        { label: 'Email', startMinute: 60, endMinute: 90, durationMinutes: 30 },
    ]);
});

test('plan segment resize preview guide uses svg class attribute without className assignment', () => {
    withDocument(({ listeners }) => {
        const resizeCalls = [];
        const ctx = {
            timeSlots: [{ planActivities: [{ label: 'Focus', startMinute: 0, endMinute: 30, durationMinutes: 30 }] }],
            removePlanSegmentResizePreviewLayer,
            clearActivePlanSegmentResizeClasses,
            cleanupPlanSegmentResizeState,
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
        fixture.handle.dispatchEvent(createPointerEvent('pointerdown', fixture.handle, 0));

        const guide = fixture.grid.querySelector('.plan-segment-resize-preview-guide');
        assert.ok(guide);
        assert.equal(
            guide.getAttribute('class'),
            'plan-segment-resize-preview-guide plan-segment-resize-preview-arrow'
        );
        assert.equal(guide.getAttribute('viewBox'), '0 0 96 28');
        assert.equal(guide.style.pointerEvents, 'none');

        listeners.pointermove(createPointerEvent('pointermove', fixture.handle, 100));
        listeners.pointerup(createPointerEvent('pointerup', fixture.handle, 100));

        assert.deepEqual(resizeCalls, [['resize', 0, 0, 'right', 40]]);
        assert.equal(fixture.grid.querySelectorAll('.plan-segment-resize-preview-layer').length, 0);
        assert.equal(hasClass(fixture.grid, 'is-previewing-plan-resize'), false);
        assert.equal(hasClass(fixture.segment, 'is-resizing-plan-segment'), false);
    }, {
        createElementNS(_namespace, tagName) {
            return createSvgLikeNode(tagName);
        },
    });
});

function latestGuide(grid) {
    const guides = grid.querySelectorAll('.plan-segment-resize-preview-guide');
    return guides[guides.length - 1] || null;
}

function latestPreviewDurations(grid) {
    return grid.querySelectorAll('.plan-segment-resize-preview-duration')
        .map(node => node.textContent);
}

function latestPreviewLayer(grid) {
    return grid.querySelector('.plan-segment-resize-preview-layer');
}

function latestDeleteTarget(grid) {
    const targets = grid.querySelectorAll('.plan-segment-resize-preview-delete-target');
    return targets[targets.length - 1] || null;
}

function latestPreviewSegments(grid) {
    return grid.querySelectorAll('.plan-segment-resize-preview-segment');
}

function previewRatio(segment) {
    return Number(segment && segment.style && segment.style['--plan-resize-preview-ratio']);
}

function createTenMinuteResizeContext(applyCalls = []) {
    return {
        timeSlots: [{ planActivities: [{ label: 'Focus', startMinute: 0, endMinute: 10, durationMinutes: 10, seconds: 600 }] }],
        removePlanSegmentResizePreviewLayer,
        clearActivePlanSegmentResizeClasses,
        cleanupPlanSegmentResizeState,
        getPlanSegmentBaseIndex(index) { return index; },
        getBlockLength() { return 1; },
        normalizePlanActivitiesPreservingSegments(items) { return items.map(item => ({ ...item })); },
        applyPlanSegmentResize(baseIndex, segmentIndex, edge, targetMinute) {
            const slot = this.timeSlots[baseIndex];
            slot.planActivities = realPlanSegmentCore.resizePlanSegmentInList(
                slot.planActivities,
                segmentIndex,
                edge,
                targetMinute,
                { startMinute: 0, endMinute: 60 }
            );
            applyCalls.push({
                baseIndex,
                segmentIndex,
                edge,
                targetMinute,
                durationMinutes: slot.planActivities[0].durationMinutes,
                endMinute: slot.planActivities[0].endMinute,
            });
            return true;
        },
        deletePlanSegment(baseIndex, segmentIndex) {
            const slot = this.timeSlots[baseIndex];
            slot.planActivities = slot.planActivities.filter((_, index) => index !== segmentIndex);
            return true;
        },
        closePlanSegmentMobileTextEditor() { return false; },
        closeInlinePlanDropdown() {},
    };
}

test('ten minute plan segment right-shrink preview uses bidirectional guide at current boundary', () => {
    withDocument(({ listeners }) => {
        const applyCalls = [];
        const ctx = createTenMinuteResizeContext(applyCalls);
        const fixture = createResizeFixture({ endMinute: 10 });

        attachPlanSegmentResizeListeners.call(ctx, fixture.entry, 0);
        fixture.handle.dispatchEvent(createPointerEvent('pointerdown', fixture.handle, 0));
        listeners.pointermove(createPointerEvent('pointermove', fixture.handle, -100));

        const guide = latestGuide(fixture.grid);
        assert.equal(guide, null);
        const layer = latestPreviewLayer(fixture.grid);
        assert.equal(layer.classList.contains('is-delete-pending-plan-resize'), true);
        assert.equal(latestDeleteTarget(fixture.grid), null);
        assert.deepEqual(latestPreviewDurations(fixture.grid), ['10m', '50m']);

        listeners.pointerup(createPointerEvent('pointerup', fixture.handle, -100));

        assert.equal(ctx.timeSlots[0].planActivities.length, 0);
        assert.deepEqual(applyCalls, []);
    }, { planSegmentCore: realPlanSegmentCore });
});

test('delete-pending preview no longer uses delete-target styling', () => {
    assert.doesNotMatch(interactionsCss, /plan-segment-resize-preview-delete-target/);
});

test('ten minute sub-ten preview shrinks without delete-target styling or deletion', () => {
    withDocument(({ listeners }) => {
        const deleteCalls = [];
        const ctx = createTenMinuteResizeContext();
        ctx.deletePlanSegment = function(baseIndex, segmentIndex) {
            deleteCalls.push({ baseIndex, segmentIndex });
            this.timeSlots[baseIndex].planActivities.splice(segmentIndex, 1);
            return true;
        };
        const fixture = createResizeFixture({ endMinute: 10 });

        attachPlanSegmentResizeListeners.call(ctx, fixture.entry, 0);
        fixture.handle.dispatchEvent(createPointerEvent('pointerdown', fixture.handle, 0));
        listeners.pointermove(createPointerEvent('pointermove', fixture.handle, -50));

        const activeSegment = latestPreviewSegments(fixture.grid)[0];
        assert.equal(activeSegment.style.width, '50%');
        assert.equal(previewRatio(activeSegment), 0.5);
        assert.equal(latestDeleteTarget(fixture.grid), null);
        assert.equal(latestPreviewLayer(fixture.grid).classList.contains('is-delete-pending-plan-resize'), false);

        listeners.pointerup(createPointerEvent('pointerup', fixture.handle, -50));

        assert.deepEqual(deleteCalls, []);
        assert.equal(ctx.timeSlots[0].planActivities.length, 1);
    }, { planSegmentCore: realPlanSegmentCore });
});

test('ten minute plan segment right-shrink enters delete-pending preview and deletes on release', () => {
    withDocument(({ listeners }) => {
        const applyCalls = [];
        const deleteCalls = [];
        const ctx = createTenMinuteResizeContext(applyCalls);
        ctx.deletePlanSegment = function(baseIndex, segmentIndex) {
            deleteCalls.push({ baseIndex, segmentIndex });
            this.timeSlots[baseIndex].planActivities.splice(segmentIndex, 1);
            return true;
        };
        const fixture = createResizeFixture({ endMinute: 10 });

        attachPlanSegmentResizeListeners.call(ctx, fixture.entry, 0);
        fixture.handle.dispatchEvent(createPointerEvent('pointerdown', fixture.handle, 0));
        listeners.pointermove(createPointerEvent('pointermove', fixture.handle, -100));

        const layer = latestPreviewLayer(fixture.grid);
        assert.ok(layer);
        assert.equal(layer.classList.contains('is-delete-pending-plan-resize'), true);
        assert.equal(latestDeleteTarget(fixture.grid), null);
        assert.deepEqual(latestPreviewDurations(fixture.grid), ['10m', '50m']);

        listeners.pointerup(createPointerEvent('pointerup', fixture.handle, -100));

        assert.deepEqual(deleteCalls, [{ baseIndex: 0, segmentIndex: 0 }]);
        assert.deepEqual(applyCalls, []);
        assert.equal(ctx.timeSlots[0].planActivities.length, 0);
        assert.equal(fixture.grid.querySelector('.plan-segment-resize-preview-layer'), null);
        assert.equal(fixture.grid.classList.contains('is-delete-pending-plan-resize'), false);
    }, { planSegmentCore: realPlanSegmentCore });
});

test('deletePlanSegment preserves neighboring positions by replacing the deleted item with rest', () => {
    const slot = {
        planned: '',
        planActivities: [
            {
                label: 'A',
                startMinute: 0,
                endMinute: 20,
                durationMinutes: 20,
                seconds: 1200,
            },
            {
                label: 'B',
                startMinute: 20,
                endMinute: 40,
                durationMinutes: 20,
                seconds: 1200,
            },
            {
                label: 'C',
                startMinute: 40,
                endMinute: 60,
                durationMinutes: 20,
                seconds: 1200,
            },
        ],
    };
    const calls = [];
    const ctx = {
        timeSlots: [slot],
        replacePlanSegmentWithRest,
        formatActivitiesSummary(items) {
            return items
                .filter((item) => !(item && (item.virtual || item.kind === 'virtual-rest')))
                .map((item) => item.label)
                .join(', ');
        },
        renderTimeEntries(force) {
            calls.push(['renderTimeEntries', force]);
        },
        repositionOpenInlinePlanDropdown() {
            calls.push(['repositionOpenInlinePlanDropdown']);
        },
        calculateTotals() {
            calls.push(['calculateTotals']);
        },
        autoSave() {
            calls.push(['autoSave']);
        },
    };

    const result = deletePlanSegment.call(ctx, 0, 1);

    assert.equal(result, true);
    assert.deepEqual(slot.planActivities, [
        {
            label: 'A',
            startMinute: 0,
            endMinute: 20,
            durationMinutes: 20,
            seconds: 1200,
        },
        {
            kind: 'virtual-rest',
            virtual: true,
            label: '휴식',
            startMinute: 20,
            durationMinutes: 20,
            endMinute: 40,
        },
        {
            label: 'C',
            startMinute: 40,
            endMinute: 60,
            durationMinutes: 20,
            seconds: 1200,
        },
    ]);
    assert.equal(slot.planned, 'A, C');
    assert.deepEqual(calls, [
        ['renderTimeEntries', true],
        ['repositionOpenInlinePlanDropdown'],
        ['calculateTotals'],
        ['autoSave'],
    ]);
});

test('longer segment preview responds to sub-unit shrink before commit snap changes', () => {
    withDocument(({ listeners }) => {
        const applyCalls = [];
        const ctx = {
            timeSlots: [{ planActivities: [{ label: 'Focus', startMinute: 0, endMinute: 20, durationMinutes: 20, seconds: 1200 }] }],
            removePlanSegmentResizePreviewLayer,
            clearActivePlanSegmentResizeClasses,
            cleanupPlanSegmentResizeState,
            getPlanSegmentBaseIndex(index) { return index; },
            getBlockLength() { return 1; },
            normalizePlanActivitiesPreservingSegments(items) { return items.map(item => ({ ...item })); },
            applyPlanSegmentResize(baseIndex, segmentIndex, edge, targetMinute) {
                applyCalls.push({ baseIndex, segmentIndex, edge, targetMinute });
                return true;
            },
            closePlanSegmentMobileTextEditor() { return false; },
            closeInlinePlanDropdown() {},
        };
        const fixture = createResizeFixture({ endMinute: 20 });

        attachPlanSegmentResizeListeners.call(ctx, fixture.entry, 0);
        fixture.handle.dispatchEvent(createPointerEvent('pointerdown', fixture.handle, 0));
        listeners.pointermove(createPointerEvent('pointermove', fixture.handle, -40));

        const activeSegment = latestPreviewSegments(fixture.grid)[0];
        assert.equal(activeSegment.style.width, '80%');
        assert.equal(previewRatio(activeSegment), 0.8);
        assert.deepEqual(latestPreviewDurations(fixture.grid), ['20m', '40m']);

        listeners.pointerup(createPointerEvent('pointerup', fixture.handle, -40));

        assert.deepEqual(applyCalls, []);
    }, { planSegmentCore: realPlanSegmentCore });
});

test('longer segment right-shrink preview continues below ten minutes', () => {
    withDocument(({ listeners }) => {
        const applyCalls = [];
        const ctx = {
            timeSlots: [{ planActivities: [{ label: 'Focus', startMinute: 0, endMinute: 20, durationMinutes: 20, seconds: 1200 }] }],
            removePlanSegmentResizePreviewLayer,
            clearActivePlanSegmentResizeClasses,
            cleanupPlanSegmentResizeState,
            getPlanSegmentBaseIndex(index) { return index; },
            getBlockLength() { return 1; },
            normalizePlanActivitiesPreservingSegments(items) { return items.map(item => ({ ...item })); },
            applyPlanSegmentResize(baseIndex, segmentIndex, edge, targetMinute) {
                applyCalls.push({ baseIndex, segmentIndex, edge, targetMinute });
                const slot = this.timeSlots[baseIndex];
                slot.planActivities = realPlanSegmentCore.resizePlanSegmentInList(
                    slot.planActivities,
                    segmentIndex,
                    edge,
                    targetMinute,
                    { startMinute: 0, endMinute: 60 }
                );
                return true;
            },
            closePlanSegmentMobileTextEditor() { return false; },
            closeInlinePlanDropdown() {},
        };
        const fixture = createResizeFixture({ endMinute: 20 });

        attachPlanSegmentResizeListeners.call(ctx, fixture.entry, 0);
        fixture.handle.dispatchEvent(createPointerEvent('pointerdown', fixture.handle, 0));
        listeners.pointermove(createPointerEvent('pointermove', fixture.handle, -150));

        const activeSegment = latestPreviewSegments(fixture.grid)[0];
        assert.equal(activeSegment.style.width, '50%');
        assert.equal(activeSegment.style.justifySelf, 'start');
        assert.equal(previewRatio(activeSegment), 0.5);
        assert.equal(activeSegment.style['--plan-resize-preview-duration-minutes'], '5');
        assert.equal(latestDeleteTarget(fixture.grid), null);
        assert.deepEqual(latestPreviewDurations(fixture.grid), ['10m', '50m']);
        assert.equal(latestGuide(fixture.grid).style.left, `${(0.5 / 6) * 100}%`);

        listeners.pointerup(createPointerEvent('pointerup', fixture.handle, -150));

        assert.deepEqual(applyCalls, [{ baseIndex: 0, segmentIndex: 0, edge: 'right', targetMinute: 10 }]);
        assert.equal(ctx.timeSlots[0].planActivities[0].durationMinutes, 10);
    }, { planSegmentCore: realPlanSegmentCore });
});

test('longer segment right-shrink deletes in one gesture when collapsed to start', () => {
    withDocument(({ listeners }) => {
        const applyCalls = [];
        const deleteCalls = [];
        const ctx = {
            timeSlots: [{ planActivities: [{ label: 'Focus', startMinute: 0, endMinute: 20, durationMinutes: 20, seconds: 1200 }] }],
            removePlanSegmentResizePreviewLayer,
            clearActivePlanSegmentResizeClasses,
            cleanupPlanSegmentResizeState,
            getPlanSegmentBaseIndex(index) { return index; },
            getBlockLength() { return 1; },
            normalizePlanActivitiesPreservingSegments(items) { return items.map(item => ({ ...item })); },
            applyPlanSegmentResize(baseIndex, segmentIndex, edge, targetMinute) {
                applyCalls.push({ baseIndex, segmentIndex, edge, targetMinute });
                return true;
            },
            deletePlanSegment(baseIndex, segmentIndex) {
                deleteCalls.push({ baseIndex, segmentIndex });
                this.timeSlots[baseIndex].planActivities.splice(segmentIndex, 1);
                return true;
            },
            closePlanSegmentMobileTextEditor() { return false; },
            closeInlinePlanDropdown() {},
        };
        const fixture = createResizeFixture({ endMinute: 20 });

        attachPlanSegmentResizeListeners.call(ctx, fixture.entry, 0);
        fixture.handle.dispatchEvent(createPointerEvent('pointerdown', fixture.handle, 0));
        listeners.pointermove(createPointerEvent('pointermove', fixture.handle, -200));

        const activeSegment = latestPreviewSegments(fixture.grid)[0];
        assert.equal(activeSegment.style.width, '0%');
        assert.equal(latestPreviewLayer(fixture.grid).classList.contains('is-delete-pending-plan-resize'), true);
        assert.equal(latestDeleteTarget(fixture.grid), null);

        listeners.pointerup(createPointerEvent('pointerup', fixture.handle, -200));

        assert.deepEqual(deleteCalls, [{ baseIndex: 0, segmentIndex: 0 }]);
        assert.deepEqual(applyCalls, []);
        assert.equal(ctx.timeSlots[0].planActivities.length, 0);
    }, { planSegmentCore: realPlanSegmentCore });
});

test('longer segment left-shrink preview continues below ten minutes from the right edge', () => {
    withDocument(({ listeners }) => {
        const applyCalls = [];
        const ctx = {
            timeSlots: [{ planActivities: [{ label: 'Focus', startMinute: 0, endMinute: 20, durationMinutes: 20, seconds: 1200 }] }],
            removePlanSegmentResizePreviewLayer,
            clearActivePlanSegmentResizeClasses,
            cleanupPlanSegmentResizeState,
            getPlanSegmentBaseIndex(index) { return index; },
            getBlockLength() { return 1; },
            normalizePlanActivitiesPreservingSegments(items) { return items.map(item => ({ ...item })); },
            applyPlanSegmentResize(baseIndex, segmentIndex, edge, targetMinute) {
                applyCalls.push({ baseIndex, segmentIndex, edge, targetMinute });
                const slot = this.timeSlots[baseIndex];
                slot.planActivities = realPlanSegmentCore.resizePlanSegmentInList(
                    slot.planActivities,
                    segmentIndex,
                    edge,
                    targetMinute,
                    { startMinute: 0, endMinute: 60 }
                );
                return true;
            },
            closePlanSegmentMobileTextEditor() { return false; },
            closeInlinePlanDropdown() {},
        };
        const fixture = createResizeFixture({ endMinute: 20, handleEdge: 'left' });

        attachPlanSegmentResizeListeners.call(ctx, fixture.entry, 0);
        fixture.handle.dispatchEvent(createPointerEvent('pointerdown', fixture.handle, 0));
        listeners.pointermove(createPointerEvent('pointermove', fixture.handle, 150));

        const activeSegment = latestPreviewSegments(fixture.grid)[1];
        assert.equal(activeSegment.style.width, '50%');
        assert.equal(activeSegment.style.justifySelf, 'end');
        assert.equal(previewRatio(activeSegment), 0.5);
        assert.equal(activeSegment.style['--plan-resize-preview-duration-minutes'], '5');
        assert.equal(latestDeleteTarget(fixture.grid), null);
        assert.deepEqual(latestPreviewDurations(fixture.grid), ['10m', '10m', '40m']);
        assert.equal(latestGuide(fixture.grid).style.left, `${(1.5 / 6) * 100}%`);

        listeners.pointerup(createPointerEvent('pointerup', fixture.handle, 150));

        assert.deepEqual(applyCalls, [{ baseIndex: 0, segmentIndex: 0, edge: 'left', targetMinute: 20 }]);
        assert.equal(ctx.timeSlots[0].planActivities[0].durationMinutes, 10);
    }, { planSegmentCore: realPlanSegmentCore });
});

test('longer segment left-shrink deletes in one gesture when collapsed to end', () => {
    withDocument(({ listeners }) => {
        const applyCalls = [];
        const deleteCalls = [];
        const ctx = {
            timeSlots: [{ planActivities: [{ label: 'Focus', startMinute: 0, endMinute: 20, durationMinutes: 20, seconds: 1200 }] }],
            removePlanSegmentResizePreviewLayer,
            clearActivePlanSegmentResizeClasses,
            cleanupPlanSegmentResizeState,
            getPlanSegmentBaseIndex(index) { return index; },
            getBlockLength() { return 1; },
            normalizePlanActivitiesPreservingSegments(items) { return items.map(item => ({ ...item })); },
            applyPlanSegmentResize(baseIndex, segmentIndex, edge, targetMinute) {
                applyCalls.push({ baseIndex, segmentIndex, edge, targetMinute });
                return true;
            },
            deletePlanSegment(baseIndex, segmentIndex) {
                deleteCalls.push({ baseIndex, segmentIndex });
                this.timeSlots[baseIndex].planActivities.splice(segmentIndex, 1);
                return true;
            },
            closePlanSegmentMobileTextEditor() { return false; },
            closeInlinePlanDropdown() {},
        };
        const fixture = createResizeFixture({ endMinute: 20, handleEdge: 'left' });

        attachPlanSegmentResizeListeners.call(ctx, fixture.entry, 0);
        fixture.handle.dispatchEvent(createPointerEvent('pointerdown', fixture.handle, 0));
        listeners.pointermove(createPointerEvent('pointermove', fixture.handle, 200));

        const activeSegment = latestPreviewSegments(fixture.grid)[1];
        assert.equal(activeSegment.style.width, '0%');
        assert.equal(latestPreviewLayer(fixture.grid).classList.contains('is-delete-pending-plan-resize'), true);
        assert.equal(latestDeleteTarget(fixture.grid), null);

        listeners.pointerup(createPointerEvent('pointerup', fixture.handle, 200));

        assert.deepEqual(deleteCalls, [{ baseIndex: 0, segmentIndex: 0 }]);
        assert.deepEqual(applyCalls, []);
        assert.equal(ctx.timeSlots[0].planActivities.length, 0);
    }, { planSegmentCore: realPlanSegmentCore });
});

test('longer segment preview responds to sub-unit expansion before commit snap changes', () => {
    withDocument(({ listeners }) => {
        const applyCalls = [];
        const ctx = {
            timeSlots: [{ planActivities: [{ label: 'Focus', startMinute: 0, endMinute: 20, durationMinutes: 20, seconds: 1200 }] }],
            removePlanSegmentResizePreviewLayer,
            clearActivePlanSegmentResizeClasses,
            cleanupPlanSegmentResizeState,
            getPlanSegmentBaseIndex(index) { return index; },
            getBlockLength() { return 1; },
            normalizePlanActivitiesPreservingSegments(items) { return items.map(item => ({ ...item })); },
            applyPlanSegmentResize(baseIndex, segmentIndex, edge, targetMinute) {
                applyCalls.push({ baseIndex, segmentIndex, edge, targetMinute });
                return true;
            },
            closePlanSegmentMobileTextEditor() { return false; },
            closeInlinePlanDropdown() {},
        };
        const fixture = createResizeFixture({ endMinute: 20 });

        attachPlanSegmentResizeListeners.call(ctx, fixture.entry, 0);
        fixture.handle.dispatchEvent(createPointerEvent('pointerdown', fixture.handle, 0));
        listeners.pointermove(createPointerEvent('pointermove', fixture.handle, 40));

        const activeSegment = latestPreviewSegments(fixture.grid)[0];
        assert.equal(activeSegment.style.width, '120%');
        assert.equal(previewRatio(activeSegment), 1.2);
        assert.deepEqual(latestPreviewDurations(fixture.grid), ['20m', '40m']);

        listeners.pointerup(createPointerEvent('pointerup', fixture.handle, 40));

        assert.deepEqual(applyCalls, []);
    }, { planSegmentCore: realPlanSegmentCore });
});

test('longer segment shrinks to ten minutes instead of deleting when dragged below minimum', () => {
    withDocument(({ listeners }) => {
        const applyCalls = [];
        const deleteCalls = [];
        const ctx = {
            timeSlots: [{ planActivities: [{ label: 'Focus', startMinute: 0, endMinute: 20, durationMinutes: 20, seconds: 1200 }] }],
            removePlanSegmentResizePreviewLayer,
            clearActivePlanSegmentResizeClasses,
            cleanupPlanSegmentResizeState,
            getPlanSegmentBaseIndex(index) { return index; },
            getBlockLength() { return 1; },
            normalizePlanActivitiesPreservingSegments(items) { return items.map(item => ({ ...item })); },
            applyPlanSegmentResize(baseIndex, segmentIndex, edge, targetMinute) {
                applyCalls.push({ baseIndex, segmentIndex, edge, targetMinute });
                const slot = this.timeSlots[baseIndex];
                slot.planActivities = realPlanSegmentCore.resizePlanSegmentInList(
                    slot.planActivities,
                    segmentIndex,
                    edge,
                    targetMinute,
                    { startMinute: 0, endMinute: 60 }
                );
                return true;
            },
            deletePlanSegment(baseIndex, segmentIndex) {
                deleteCalls.push({ baseIndex, segmentIndex });
                this.timeSlots[baseIndex].planActivities.splice(segmentIndex, 1);
                return true;
            },
            closePlanSegmentMobileTextEditor() { return false; },
            closeInlinePlanDropdown() {},
        };
        const fixture = createResizeFixture({ endMinute: 20 });

        attachPlanSegmentResizeListeners.call(ctx, fixture.entry, 0);
        fixture.handle.dispatchEvent(createPointerEvent('pointerdown', fixture.handle, 0));
        listeners.pointermove(createPointerEvent('pointermove', fixture.handle, -100));

        const layer = latestPreviewLayer(fixture.grid);
        assert.ok(layer);
        assert.equal(layer.classList.contains('is-delete-pending-plan-resize'), false);
        assert.equal(latestDeleteTarget(fixture.grid), null);
        assert.deepEqual(latestPreviewDurations(fixture.grid), ['10m', '50m']);

        listeners.pointerup(createPointerEvent('pointerup', fixture.handle, -100));

        assert.deepEqual(applyCalls, [{ baseIndex: 0, segmentIndex: 0, edge: 'right', targetMinute: 10 }]);
        assert.deepEqual(deleteCalls, []);
        assert.equal(ctx.timeSlots[0].planActivities[0].durationMinutes, 10);
    }, { planSegmentCore: realPlanSegmentCore });
});

test('delete-pending clears when a ten minute resize reverses before release', () => {
    withDocument(({ listeners }) => {
        const applyCalls = [];
        const deleteCalls = [];
        const ctx = createTenMinuteResizeContext(applyCalls);
        ctx.deletePlanSegment = function(baseIndex, segmentIndex) {
            deleteCalls.push({ baseIndex, segmentIndex });
            this.timeSlots[baseIndex].planActivities.splice(segmentIndex, 1);
            return true;
        };
        const fixture = createResizeFixture({ endMinute: 10 });

        attachPlanSegmentResizeListeners.call(ctx, fixture.entry, 0);
        fixture.handle.dispatchEvent(createPointerEvent('pointerdown', fixture.handle, 0));
        listeners.pointermove(createPointerEvent('pointermove', fixture.handle, -100));
        assert.equal(latestPreviewLayer(fixture.grid).classList.contains('is-delete-pending-plan-resize'), true);
        assert.equal(latestDeleteTarget(fixture.grid), null);

        listeners.pointermove(createPointerEvent('pointermove', fixture.handle, 100));
        const layer = latestPreviewLayer(fixture.grid);
        assert.ok(layer);
        assert.equal(layer.classList.contains('is-delete-pending-plan-resize'), false);
        assert.equal(latestDeleteTarget(fixture.grid), null);
        assert.ok(latestGuide(fixture.grid));
        assert.deepEqual(latestPreviewDurations(fixture.grid), ['20m', '40m']);

        listeners.pointerup(createPointerEvent('pointerup', fixture.handle, 100));

        assert.deepEqual(deleteCalls, []);
        assert.deepEqual(applyCalls, [{
            baseIndex: 0,
            segmentIndex: 0,
            edge: 'right',
            targetMinute: 20,
            durationMinutes: 20,
            endMinute: 20,
        }]);
    }, { planSegmentCore: realPlanSegmentCore });
});

test('right-only preview guide anchors inside rightward 10m resize while bidirectional guide remains centered', () => {
    const defaultGuideRule = interactionsCss.match(/\.plan-segment-resize-preview-guide\s*\{[^}]*\}/);
    assert.ok(defaultGuideRule);
    assert.match(defaultGuideRule[0], /transform:\s*translate\(-50%,\s*-50%\);/);

    const insideBeforeGuideRule = interactionsCss.match(/\.plan-segment-resize-preview-guide\.plan-segment-resize-preview-arrow-inside-before\s*\{[^}]*\}/);
    assert.ok(insideBeforeGuideRule);
    assert.match(insideBeforeGuideRule[0], /transform:\s*translate\(calc\(-100%\s*-\s*3px\),\s*-50%\);/);

    const insideAfterGuideRule = interactionsCss.match(/\.plan-segment-resize-preview-guide\.plan-segment-resize-preview-arrow-inside-after\s*\{[^}]*\}/);
    assert.ok(insideAfterGuideRule);
    assert.match(insideAfterGuideRule[0], /transform:\s*translate\(3px,\s*-50%\);/);

    withDocument(({ listeners }) => {
        const shrinkCalls = [];
        const shrinkCtx = createTenMinuteResizeContext(shrinkCalls);
        const shrinkFixture = createResizeFixture({ endMinute: 10 });

        attachPlanSegmentResizeListeners.call(shrinkCtx, shrinkFixture.entry, 0);
        shrinkFixture.handle.dispatchEvent(createPointerEvent('pointerdown', shrinkFixture.handle, 0));
        listeners.pointermove(createPointerEvent('pointermove', shrinkFixture.handle, -100));

        const shrinkGuide = latestGuide(shrinkFixture.grid);
        assert.equal(shrinkGuide, null);
        const shrinkLayer = latestPreviewLayer(shrinkFixture.grid);
        assert.equal(shrinkLayer.classList.contains('is-delete-pending-plan-resize'), true);
        assert.equal(shrinkLayer.querySelector('.plan-segment-resize-preview-delete-target'), null);

        listeners.pointerup(createPointerEvent('pointerup', shrinkFixture.handle, -100));

        const resizeCalls = [];
        const bidirectionalCtx = {
            timeSlots: [{ planActivities: [{ label: 'Focus', startMinute: 0, endMinute: 30, durationMinutes: 30 }] }],
            removePlanSegmentResizePreviewLayer,
            clearActivePlanSegmentResizeClasses,
            cleanupPlanSegmentResizeState,
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
        const bidirectionalFixture = createResizeFixture();

        attachPlanSegmentResizeListeners.call(bidirectionalCtx, bidirectionalFixture.entry, 0);
        bidirectionalFixture.handle.dispatchEvent(createPointerEvent('pointerdown', bidirectionalFixture.handle, 0));

        const bidirectionalGuide = latestGuide(bidirectionalFixture.grid);
        assert.ok(bidirectionalGuide);
        assert.equal(hasClass(bidirectionalGuide, 'plan-segment-resize-preview-arrow-right-only'), false);
        assert.equal(hasClass(bidirectionalGuide, 'plan-segment-resize-preview-arrow-inside-before'), false);
        assert.equal(hasClass(bidirectionalGuide, 'plan-segment-resize-preview-arrow-inside-after'), false);
        assert.equal(
            bidirectionalGuide.getAttribute('class'),
            'plan-segment-resize-preview-guide plan-segment-resize-preview-arrow'
        );
        assert.equal(bidirectionalGuide.getAttribute('viewBox'), '0 0 96 28');
        assert.equal(bidirectionalGuide.getAttribute('width'), '96');
        assert.equal(bidirectionalGuide.style.width || '', '');
        assert.equal(bidirectionalGuide.style.minWidth || '', '');
        assert.equal(bidirectionalGuide.querySelectorAll('.plan-segment-resize-preview-arrow-shape').length, 2);
        assert.equal(bidirectionalGuide.querySelectorAll('.plan-segment-resize-preview-arrow-sheen').length, 4);
        assert.equal(bidirectionalGuide.querySelectorAll('.plan-segment-resize-preview-arrow-spark').length, 4);
    }, { planSegmentCore: realPlanSegmentCore });
});

test('plan resize preview keeps only left arrow after leftward movement starts', () => {
    withDocument(({ listeners }) => {
        const resizeCalls = [];
        const ctx = {
            timeSlots: [{ planActivities: [{ label: 'Focus', startMinute: 0, endMinute: 30, durationMinutes: 30 }] }],
            removePlanSegmentResizePreviewLayer,
            clearActivePlanSegmentResizeClasses,
            cleanupPlanSegmentResizeState,
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
        fixture.handle.dispatchEvent(createPointerEvent('pointerdown', fixture.handle, 0));
        listeners.pointermove(createPointerEvent('pointermove', fixture.handle, -100));

        const guide = latestGuide(fixture.grid);
        assert.ok(guide);
        assert.equal(hasClass(guide, 'plan-segment-resize-preview-arrow-left-only'), true);
        assert.equal(hasClass(guide, 'plan-segment-resize-preview-arrow-right-only'), false);
        assert.equal(hasClass(guide, 'plan-segment-resize-preview-arrow-inside-before'), true);
        assert.equal(hasClass(guide, 'plan-segment-resize-preview-arrow-inside-after'), false);
        assert.equal(guide.getAttribute('viewBox'), '0 0 40 28');
        assert.equal(guide.getAttribute('width'), '40');

        const arrowShapes = guide.querySelectorAll('.plan-segment-resize-preview-arrow-shape');
        assert.equal(arrowShapes.length, 1);
        assert.match(arrowShapes[0].getAttribute('d'), /^M34\.3/);
        assert.equal(guide.querySelectorAll('.plan-segment-resize-preview-arrow-sheen').length, 2);
        assert.equal(guide.querySelectorAll('.plan-segment-resize-preview-arrow-spark').length, 2);

        listeners.pointerup(createPointerEvent('pointerup', fixture.handle, -100));

        assert.deepEqual(resizeCalls, [['resize', 0, 0, 'right', 20]]);
    }, { planSegmentCore: realPlanSegmentCore });
});

test('plan resize preview switches single arrow direction and returns to bidirectional at origin', () => {
    withDocument(({ listeners }) => {
        const resizeCalls = [];
        const ctx = {
            timeSlots: [{ planActivities: [{ label: 'Focus', startMinute: 0, endMinute: 30, durationMinutes: 30 }] }],
            removePlanSegmentResizePreviewLayer,
            clearActivePlanSegmentResizeClasses,
            cleanupPlanSegmentResizeState,
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
        fixture.handle.dispatchEvent(createPointerEvent('pointerdown', fixture.handle, 0));

        listeners.pointermove(createPointerEvent('pointermove', fixture.handle, 100));
        let guide = latestGuide(fixture.grid);
        assert.equal(hasClass(guide, 'plan-segment-resize-preview-arrow-right-only'), true);
        assert.equal(hasClass(guide, 'plan-segment-resize-preview-arrow-left-only'), false);
        assert.equal(hasClass(guide, 'plan-segment-resize-preview-arrow-inside-before'), true);

        listeners.pointermove(createPointerEvent('pointermove', fixture.handle, -100));
        guide = latestGuide(fixture.grid);
        assert.equal(hasClass(guide, 'plan-segment-resize-preview-arrow-left-only'), true);
        assert.equal(hasClass(guide, 'plan-segment-resize-preview-arrow-right-only'), false);
        assert.equal(hasClass(guide, 'plan-segment-resize-preview-arrow-inside-before'), true);

        listeners.pointermove(createPointerEvent('pointermove', fixture.handle, -80));
        guide = latestGuide(fixture.grid);
        assert.equal(hasClass(guide, 'plan-segment-resize-preview-arrow-left-only'), true);
        assert.equal(hasClass(guide, 'plan-segment-resize-preview-arrow-right-only'), false);
        assert.equal(hasClass(guide, 'plan-segment-resize-preview-arrow-inside-before'), true);

        listeners.pointermove(createPointerEvent('pointermove', fixture.handle, 0));
        guide = latestGuide(fixture.grid);
        assert.ok(guide);
        assert.equal(guide.getAttribute('class'), 'plan-segment-resize-preview-guide plan-segment-resize-preview-arrow');
        assert.equal(guide.getAttribute('viewBox'), '0 0 96 28');
        assert.equal(guide.querySelectorAll('.plan-segment-resize-preview-arrow-shape').length, 2);

        listeners.pointerup(createPointerEvent('pointerup', fixture.handle, 0));

        assert.deepEqual(resizeCalls, []);
    }, { planSegmentCore: realPlanSegmentCore });
});

test('left-edge resize keeps single arrows inside the segment on the right side of the boundary', () => {
    withDocument(({ listeners }) => {
        const ctx = {
            timeSlots: [{ planActivities: [{ label: 'Focus', startMinute: 10, endMinute: 30, durationMinutes: 20 }] }],
            removePlanSegmentResizePreviewLayer,
            clearActivePlanSegmentResizeClasses,
            cleanupPlanSegmentResizeState,
            getPlanSegmentBaseIndex(index) { return index; },
            getBlockLength() { return 1; },
            normalizePlanActivitiesPreservingSegments(items) { return items.map(item => ({ ...item })); },
            applyPlanSegmentResize() { return true; },
            closePlanSegmentMobileTextEditor() { return false; },
            closeInlinePlanDropdown() {},
        };
        const fixture = createResizeFixture({ startMinute: 10, endMinute: 30, handleEdge: 'left' });

        attachPlanSegmentResizeListeners.call(ctx, fixture.entry, 0);
        fixture.handle.dispatchEvent(createPointerEvent('pointerdown', fixture.handle, 0));

        listeners.pointermove(createPointerEvent('pointermove', fixture.handle, -100));
        let guide = latestGuide(fixture.grid);
        assert.equal(hasClass(guide, 'plan-segment-resize-preview-arrow-right-only'), true);
        assert.equal(hasClass(guide, 'plan-segment-resize-preview-arrow-inside-after'), true);

        listeners.pointermove(createPointerEvent('pointermove', fixture.handle, 100));
        guide = latestGuide(fixture.grid);
        assert.equal(hasClass(guide, 'plan-segment-resize-preview-arrow-left-only'), true);
        assert.equal(hasClass(guide, 'plan-segment-resize-preview-arrow-inside-after'), true);

        listeners.pointerup(createPointerEvent('pointerup', fixture.handle, 100));
    }, { planSegmentCore: realPlanSegmentCore });
});

test('right-edge fast expansion preview guide clamps to the resized segment boundary', () => {
    withDocument(({ listeners }) => {
        const ctx = {
            timeSlots: [{ planActivities: [
                { label: 'Focus', startMinute: 0, endMinute: 30, durationMinutes: 30 },
                { label: 'Review', startMinute: 40, endMinute: 60, durationMinutes: 20 },
            ] }],
            removePlanSegmentResizePreviewLayer,
            clearActivePlanSegmentResizeClasses,
            cleanupPlanSegmentResizeState,
            getPlanSegmentBaseIndex(index) { return index; },
            getBlockLength() { return 1; },
            normalizePlanActivitiesPreservingSegments(items) { return items.map(item => ({ ...item })); },
            applyPlanSegmentResize() { return true; },
            closePlanSegmentMobileTextEditor() { return false; },
            closeInlinePlanDropdown() {},
        };
        const fixture = createResizeFixture({ startMinute: 0, endMinute: 30 });

        attachPlanSegmentResizeListeners.call(ctx, fixture.entry, 0);
        fixture.handle.dispatchEvent(createPointerEvent('pointerdown', fixture.handle, 0));
        listeners.pointermove(createPointerEvent('pointermove', fixture.handle, 300));

        const guide = latestGuide(fixture.grid);
        const activeSegment = latestPreviewSegments(fixture.grid)[0];
        assert.ok(guide);
        assert.equal(hasClass(guide, 'plan-segment-resize-preview-arrow-right-only'), true);
        assert.equal(hasClass(guide, 'plan-segment-resize-preview-arrow-inside-before'), true);
        assert.equal(guide.style.left, `${(4 / 6) * 100}%`);
        assert.equal(activeSegment.style.width, '100%');
        assert.deepEqual(latestPreviewDurations(fixture.grid), ['40m', '20m']);

        listeners.pointerup(createPointerEvent('pointerup', fixture.handle, 300));
    }, { planSegmentCore: realPlanSegmentCore });
});

test('left-edge fast expansion preview guide clamps to the resized segment boundary', () => {
    withDocument(({ listeners }) => {
        const ctx = {
            timeSlots: [{ planActivities: [
                { label: 'Prep', startMinute: 0, endMinute: 20, durationMinutes: 20 },
                { label: 'Focus', startMinute: 30, endMinute: 60, durationMinutes: 30 },
            ] }],
            removePlanSegmentResizePreviewLayer,
            clearActivePlanSegmentResizeClasses,
            cleanupPlanSegmentResizeState,
            getPlanSegmentBaseIndex(index) { return index; },
            getBlockLength() { return 1; },
            normalizePlanActivitiesPreservingSegments(items) { return items.map(item => ({ ...item })); },
            applyPlanSegmentResize() { return true; },
            closePlanSegmentMobileTextEditor() { return false; },
            closeInlinePlanDropdown() {},
        };
        const fixture = createResizeFixture({ startMinute: 30, endMinute: 60, handleEdge: 'left', segmentIndex: 1 });

        attachPlanSegmentResizeListeners.call(ctx, fixture.entry, 0);
        fixture.handle.dispatchEvent(createPointerEvent('pointerdown', fixture.handle, 0));
        listeners.pointermove(createPointerEvent('pointermove', fixture.handle, -300));

        const guide = latestGuide(fixture.grid);
        const activeSegment = latestPreviewSegments(fixture.grid)[1];
        assert.ok(guide);
        assert.equal(hasClass(guide, 'plan-segment-resize-preview-arrow-right-only'), true);
        assert.equal(hasClass(guide, 'plan-segment-resize-preview-arrow-inside-after'), true);
        assert.equal(guide.style.left, `${(2 / 6) * 100}%`);
        assert.equal(activeSegment.style.width, '100%');
        assert.deepEqual(latestPreviewDurations(fixture.grid), ['20m', '40m']);

        listeners.pointerup(createPointerEvent('pointerup', fixture.handle, -300));
    }, { planSegmentCore: realPlanSegmentCore });
});

test('ten minute plan segment right-expansion preview follows expanded boundary', () => {
    withDocument(({ listeners }) => {
        const applyCalls = [];
        const ctx = createTenMinuteResizeContext(applyCalls);
        const fixture = createResizeFixture({ endMinute: 10 });

        attachPlanSegmentResizeListeners.call(ctx, fixture.entry, 0);
        fixture.handle.dispatchEvent(createPointerEvent('pointerdown', fixture.handle, 0));
        listeners.pointermove(createPointerEvent('pointermove', fixture.handle, 100));

        const guide = latestGuide(fixture.grid);
        assert.ok(guide);
        assert.equal(guide.style.left, `${(2 / 6) * 100}%`);
        assert.equal(guide.getAttribute('viewBox'), '56 0 40 28');
        assert.equal(guide.getAttribute('width'), '40');
        assert.deepEqual(latestPreviewDurations(fixture.grid), ['20m', '40m']);

        const arrowShapes = guide.querySelectorAll('.plan-segment-resize-preview-arrow-shape');
        assert.equal(arrowShapes.length, 1);
        assert.match(arrowShapes[0].getAttribute('d'), /^M61\.7/);
        assert.equal(guide.querySelectorAll('.plan-segment-resize-preview-arrow-sheen').length, 2);
        assert.equal(guide.querySelectorAll('.plan-segment-resize-preview-arrow-spark').length, 2);

        listeners.pointerup(createPointerEvent('pointerup', fixture.handle, 100));

        assert.equal(ctx.timeSlots[0].planActivities[0].durationMinutes, 20);
        assert.deepEqual(applyCalls, [{
            baseIndex: 0,
            segmentIndex: 0,
            edge: 'right',
            targetMinute: 20,
            durationMinutes: 20,
            endMinute: 20,
        }]);
    }, { planSegmentCore: realPlanSegmentCore });
});

test('plan segment resize still applies and cleans up when preview guide creation fails', () => {
    withDocument(({ listeners, listenerCounts }) => {
        const resizeCalls = [];
        const ctx = {
            timeSlots: [{ planActivities: [{ label: 'Focus', startMinute: 0, endMinute: 30, durationMinutes: 30 }] }],
            removePlanSegmentResizePreviewLayer,
            clearActivePlanSegmentResizeClasses,
            cleanupPlanSegmentResizeState,
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
        fixture.handle.dispatchEvent(createPointerEvent('pointerdown', fixture.handle, 0));

        assert.equal(fixture.grid.querySelectorAll('.plan-segment-resize-preview-layer').length, 1);
        assert.equal(fixture.grid.querySelectorAll('.plan-segment-resize-preview-guide').length, 0);
        assert.equal(hasClass(fixture.grid, 'is-previewing-plan-resize'), true);
        assert.equal(hasClass(fixture.segment, 'is-resizing-plan-segment'), true);
        assert.equal(listenerCounts.pointermove, 1);

        listeners.pointermove(createPointerEvent('pointermove', fixture.handle, 100));
        listeners.pointerup(createPointerEvent('pointerup', fixture.handle, 100));

        assert.deepEqual(resizeCalls, [['resize', 0, 0, 'right', 40]]);
        assert.equal(fixture.grid.querySelectorAll('.plan-segment-resize-preview-layer').length, 0);
        assert.equal(fixture.grid.querySelectorAll('.plan-segment-resize-preview-guide').length, 0);
        assert.equal(hasClass(fixture.grid, 'is-previewing-plan-resize'), false);
        assert.equal(hasClass(fixture.segment, 'is-resizing-plan-segment'), false);
        assert.equal(listenerCounts.pointermove, 0);
        assert.equal(listenerCounts.pointerup, 0);
        assert.equal(listenerCounts.pointercancel, 0);
    }, {
        createElementNS() {
            throw new Error('svg unavailable');
        },
    });
});

test('failed initial plan resize preview render cleans hidden preview state immediately', () => {
    withDocument(({ listenerCounts }) => {
        const resizeCalls = [];
        const originalResize = global.TimeTrackerPlanSegmentCore.resizePlanSegmentInList;
        global.TimeTrackerPlanSegmentCore.resizePlanSegmentInList = () => {
            throw new Error('preview render failed');
        };
        const ctx = {
            timeSlots: [{ planActivities: [{ label: 'Focus', startMinute: 0, endMinute: 30, durationMinutes: 30 }] }],
            removePlanSegmentResizePreviewLayer,
            clearActivePlanSegmentResizeClasses,
            cleanupPlanSegmentResizeState,
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

        try {
            attachPlanSegmentResizeListeners.call(ctx, fixture.entry, 0);
            const down = createPointerEvent('pointerdown', fixture.handle, 0);
            fixture.handle.dispatchEvent(down);

            assert.equal(down.defaultPrevented, true);
            assert.equal(down.propagationStopped, true);
            assert.deepEqual(resizeCalls, []);
            assert.equal(fixture.grid.querySelectorAll('.plan-segment-resize-preview-layer').length, 0);
            assert.equal(fixture.grid.querySelectorAll('.plan-segment-resize-preview-guide').length, 0);
            assert.equal(hasClass(fixture.grid, 'is-previewing-plan-resize'), false);
            assert.equal(hasClass(fixture.segment, 'is-resizing-plan-segment'), false);
            assert.equal(listenerCounts.pointermove || 0, 0);
            assert.equal(listenerCounts.pointerup || 0, 0);
            assert.equal(listenerCounts.pointercancel || 0, 0);
            assert.equal(listenerCounts.keydown || 0, 0);
        } finally {
            global.TimeTrackerPlanSegmentCore.resizePlanSegmentInList = originalResize;
        }
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
        assert.equal(listenerCounts.keydown, 1);
        listeners.pointermove(createPointerEvent('pointermove', firstHandle, 100));
        assert.equal(current.grid.querySelectorAll('.plan-segment-resize-preview-layer').length, 1);
        listeners.pointerup(createPointerEvent('pointerup', firstHandle, 100));

        assert.deepEqual(resizeCalls, [['resize', 0, 0, 'right', 40]]);
        assert.equal(listenerCounts.pointermove, 0);
        assert.equal(listenerCounts.pointerup, 0);
        assert.equal(listenerCounts.pointercancel, 0);
        assert.equal(listenerCounts.keydown, 0);
        assert.deepEqual(captureCalls.slice(0, 2), [['set', 7], ['release', 7]]);
        assert.equal(current.grid.querySelectorAll('.plan-segment-resize-preview-layer').length, 0);
        assert.equal(current.grid.querySelectorAll('.plan-segment-resize-preview-guide').length, 0);
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

test('plan segment resize commits once when pointer capture is lost after movement', () => {
    withDocument(({ listeners, listenerCounts }) => {
        const captureCalls = [];
        const resizeCalls = [];
        const ctx = {
            timeSlots: [{ planActivities: [{ label: 'Focus', startMinute: 0, endMinute: 30, durationMinutes: 30 }] }],
            removePlanSegmentResizePreviewLayer,
            clearActivePlanSegmentResizeClasses,
            cleanupPlanSegmentResizeState,
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
        const fixture = createResizeFixture({ captureCalls });

        attachPlanSegmentResizeListeners.call(ctx, fixture.entry, 0);
        fixture.handle.dispatchEvent(createPointerEvent('pointerdown', fixture.handle, 0));
        listeners.pointermove(createPointerEvent('pointermove', fixture.handle, 100));
        assert.equal(fixture.grid.querySelectorAll('.plan-segment-resize-preview-layer').length, 1);

        fixture.handle.dispatchEvent({
            type: 'lostpointercapture',
            target: fixture.handle,
            pointerId: 7,
            defaultPrevented: false,
            propagationStopped: false,
            preventDefault() {
                this.defaultPrevented = true;
            },
            stopPropagation() {
                this.propagationStopped = true;
            },
        });
        if (listeners.pointerup) {
            listeners.pointerup(createPointerEvent('pointerup', fixture.handle, 100));
        }

        assert.deepEqual(resizeCalls, [['resize', 0, 0, 'right', 40]]);
        assert.deepEqual(captureCalls, [['set', 7], ['release', 7]]);
        assert.equal(listenerCounts.pointermove, 0);
        assert.equal(listenerCounts.pointerup, 0);
        assert.equal(listenerCounts.pointercancel, 0);
        assert.equal(listenerCounts.keydown, 0);
        assert.equal(fixture.grid.querySelectorAll('.plan-segment-resize-preview-layer').length, 0);
        assert.equal(fixture.grid.querySelectorAll('.plan-segment-resize-preview-guide').length, 0);
        assert.equal(hasClass(fixture.grid, 'is-previewing-plan-resize'), false);
        assert.equal(hasClass(fixture.segment, 'is-resizing-plan-segment'), false);
    });
});

test('plan segment resize preview does not rebuild layer repeatedly inside the same snapped target', () => {
    withDocument(({ listeners }) => {
        const ctx = {
            timeSlots: [{ planActivities: [{ label: 'Focus', startMinute: 0, endMinute: 30, durationMinutes: 30 }] }],
            removePlanSegmentResizePreviewLayer,
            clearActivePlanSegmentResizeClasses,
            cleanupPlanSegmentResizeState,
            getPlanSegmentBaseIndex(index) { return index; },
            getBlockLength() { return 1; },
            normalizePlanActivitiesPreservingSegments(items) { return items.map(item => ({ ...item })); },
            applyPlanSegmentResize() {
                return true;
            },
            closePlanSegmentMobileTextEditor() { return false; },
            closeInlinePlanDropdown() {},
        };
        const fixture = createResizeFixture();
        let previewLayer = null;
        let layerClearCount = 0;
        const appendChild = fixture.grid.appendChild.bind(fixture.grid);
        fixture.grid.appendChild = (child) => {
            if (hasClass(child, 'plan-segment-resize-preview-layer')) {
                previewLayer = child;
                const descriptor = Object.getOwnPropertyDescriptor(child, 'innerHTML');
                Object.defineProperty(child, 'innerHTML', {
                    configurable: true,
                    get() {
                        return descriptor.get.call(child);
                    },
                    set(value) {
                        if (String(value || '') === '') layerClearCount += 1;
                        descriptor.set.call(child, value);
                    },
                });
            }
            return appendChild(child);
        };

        attachPlanSegmentResizeListeners.call(ctx, fixture.entry, 0);
        fixture.handle.dispatchEvent(createPointerEvent('pointerdown', fixture.handle, 0));
        assert.ok(previewLayer);
        const clearsAfterInitialPreview = layerClearCount;

        for (let i = 0; i < 20; i += 1) {
            listeners.pointermove(createPointerEvent('pointermove', fixture.handle, 55 + i));
        }

        assert.equal(layerClearCount - clearsAfterInitialPreview, 1);
        assert.equal(fixture.grid.querySelectorAll('.plan-segment-resize-preview-guide').length, 1);
        listeners.pointerup(createPointerEvent('pointerup', fixture.handle, 74));
    });
});

test('plan segment resize pointermove preview is coalesced with requestAnimationFrame and commits the latest point', () => {
    const previousRAF = global.requestAnimationFrame;
    const previousCancelRAF = global.cancelAnimationFrame;
    const rafQueue = [];
    const cancelled = new Set();
    global.requestAnimationFrame = (callback) => {
        const id = rafQueue.length + 1;
        rafQueue.push({ id, callback });
        return id;
    };
    global.cancelAnimationFrame = (id) => {
        cancelled.add(id);
    };
    try {
        withDocument(({ listeners }) => {
            const resizeCalls = [];
            const ctx = {
                timeSlots: [{ planActivities: [{ label: 'Focus', startMinute: 0, endMinute: 30, durationMinutes: 30 }] }],
                removePlanSegmentResizePreviewLayer,
                clearActivePlanSegmentResizeClasses,
                cleanupPlanSegmentResizeState,
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
            fixture.handle.dispatchEvent(createPointerEvent('pointerdown', fixture.handle, 0));
            for (let i = 0; i < 20; i += 1) {
                listeners.pointermove(createPointerEvent('pointermove', fixture.handle, 60 + (i * 10)));
            }

            assert.equal(rafQueue.length, 1);
            assert.deepEqual(getRealPreviewDurations(fixture.grid), ['30m']);
            const frame = rafQueue.shift();
            assert.equal(cancelled.has(frame.id), false);
            frame.callback();
            assert.deepEqual(getRealPreviewDurations(fixture.grid), ['60m']);

            listeners.pointerup(createPointerEvent('pointerup', fixture.handle, 250));
            assert.deepEqual(resizeCalls, [['resize', 0, 0, 'right', 60]]);
        });
    } finally {
        if (previousRAF === undefined) {
            delete global.requestAnimationFrame;
        } else {
            global.requestAnimationFrame = previousRAF;
        }
        if (previousCancelRAF === undefined) {
            delete global.cancelAnimationFrame;
        } else {
            global.cancelAnimationFrame = previousCancelRAF;
        }
    }
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
        assert.equal(fixture.grid.querySelectorAll('.plan-segment-resize-preview-layer').length, 1);

        listeners.pointermove(createPointerEvent('pointermove', fixture.segment, 690));
        listeners.pointerup(createPointerEvent('pointerup', fixture.segment, 690));

        assert.deepEqual(resizeCalls, [['resize', 0, 0, 'right', 40]]);
        assert.equal(fixture.grid.querySelectorAll('.plan-segment-resize-preview-layer').length, 0);
        assert.equal(fixture.grid.querySelectorAll('.plan-segment-resize-preview-guide').length, 0);
        assert.equal(hasClass(fixture.segment, 'is-resizing-plan-segment'), false);
    });
});

test('merged mobile edge-zone resize uses downward row movement', () => {
    withDocument(({ listeners }) => {
        const fixture = createMergedResizeFixture({ handleEdge: 'right', startMinute: 0, endMinute: 60, segmentIndex: 1 });
        const ctx = {
            timeSlots: [{
                planActivities: [
                    { label: 'Focus', activityText: 'Focus', activityId: 'focus-id', startMinute: 0, endMinute: 30, durationMinutes: 30, seconds: 1800 },
                    { label: 'Focus', activityText: 'Focus', activityId: 'focus-id', startMinute: 30, endMinute: 60, durationMinutes: 30, seconds: 1800 },
                ],
            }],
            removePlanSegmentResizePreviewLayer,
            clearActivePlanSegmentResizeClasses,
            cleanupPlanSegmentResizeState,
            getPlanSegmentVisualIdentityKey,
            resolveMergedPlanSegmentResizeGroup,
            buildMergedPlanSegmentResizeSource,
            applyPlanSegmentResize,
            isCoarsePlanSegmentPointerContext() { return true; },
            getPlanSegmentBaseIndex(index) { return index; },
            getBlockLength() { return 2; },
            normalizeActivityText(value) { return String(value || '').trim(); },
            normalizePlanActivitiesPreservingSegments(items) { return items.map(item => ({ ...item })); },
            formatActivitiesSummary(items) { return items.map(item => item.label).join(', '); },
            renderTimeEntries() {},
            calculateTotals() {},
            autoSave() {},
        };

        attachPlanSegmentResizeListeners.call(ctx, fixture.entry, 0);
        const down = createPointerEvent('pointerdown', fixture.segment, 590, 40);
        fixture.segment.dispatchEvent(down);

        assert.equal(down.defaultPrevented, true);
        assert.equal(down.propagationStopped, true);

        listeners.pointermove(createPointerEvent('pointermove', fixture.segment, 50, 120));
        assert.deepEqual([...new Set(getRealPreviewDurations(fixture.grid))], ['70m']);
        listeners.pointerup(createPointerEvent('pointerup', fixture.segment, 50, 120));

        assert.deepEqual(ctx.timeSlots[0].planActivities.map(item => ({
            startMinute: item.startMinute,
            endMinute: item.endMinute,
            durationMinutes: item.durationMinutes,
        })), [
            { startMinute: 0, endMinute: 70, durationMinutes: 70 },
        ]);
    }, { planSegmentCore: realPlanSegmentCore });
});

test('plan segment resize preview guide is removed on escape cancel', () => {
    withDocument(({ listeners, listenerCounts }) => {
        const resizeCalls = [];
        const ctx = {
            timeSlots: [{ planActivities: [{ label: 'Focus', startMinute: 0, endMinute: 30, durationMinutes: 30 }] }],
            removePlanSegmentResizePreviewLayer,
            clearActivePlanSegmentResizeClasses,
            cleanupPlanSegmentResizeState,
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
        fixture.handle.dispatchEvent(createPointerEvent('pointerdown', fixture.handle, 0));

        assert.equal(fixture.grid.querySelectorAll('.plan-segment-resize-preview-layer').length, 1);
        assert.equal(fixture.grid.querySelectorAll('.plan-segment-resize-preview-guide').length, 1);
        assert.equal(listenerCounts.keydown, 1);

        listeners.keydown({ type: 'keydown', key: 'Escape' });

        assert.deepEqual(resizeCalls, []);
        assert.equal(fixture.grid.querySelectorAll('.plan-segment-resize-preview-layer').length, 0);
        assert.equal(fixture.grid.querySelectorAll('.plan-segment-resize-preview-guide').length, 0);
        assert.equal(hasClass(fixture.grid, 'is-previewing-plan-resize'), false);
        assert.equal(hasClass(fixture.segment, 'is-resizing-plan-segment'), false);
        assert.equal(listenerCounts.pointermove, 0);
        assert.equal(listenerCounts.pointerup, 0);
        assert.equal(listenerCounts.pointercancel, 0);
        assert.equal(listenerCounts.keydown, 0);
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
        assert.equal(fixture.grid.querySelectorAll('.plan-segment-resize-preview-layer').length, 1);

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

test('touch handle resize enters delete-pending and deletes on release for ten minute segments', () => {
    withDocument(({ listeners, listenerCounts }) => {
        const deleteCalls = [];
        const ctx = createTenMinuteResizeContext();
        ctx.isCoarsePlanSegmentPointerContext = () => true;
        ctx.deletePlanSegment = function(baseIndex, segmentIndex) {
            deleteCalls.push({ baseIndex, segmentIndex });
            this.timeSlots[baseIndex].planActivities.splice(segmentIndex, 1);
            return true;
        };
        const fixture = createResizeFixture({ endMinute: 10 });

        attachPlanSegmentResizeListeners.call(ctx, fixture.entry, 0);
        const touchStart = createTouchEvent('touchstart', fixture.handle, 0);
        fixture.handle.dispatchEvent(touchStart);

        assert.equal(touchStart.defaultPrevented, true);
        assert.equal(touchStart.propagationStopped, true);
        assert.equal(listenerCounts.touchmove, 1);
        assert.equal(listenerCounts.touchend, 1);
        assert.equal(listenerCounts.touchcancel, 1);

        listeners.touchmove(createTouchEvent('touchmove', fixture.handle, -100));
        const layer = latestPreviewLayer(fixture.grid);
        assert.ok(layer);
        assert.equal(layer.classList.contains('is-delete-pending-plan-resize'), true);
        assert.equal(latestDeleteTarget(fixture.grid), null);
        assert.deepEqual(latestPreviewDurations(fixture.grid), ['10m', '50m']);

        listeners.touchend(createTouchEvent('touchend', fixture.handle, -100));

        assert.deepEqual(deleteCalls, [{ baseIndex: 0, segmentIndex: 0 }]);
        assert.equal(listenerCounts.touchmove, 0);
        assert.equal(listenerCounts.touchend, 0);
        assert.equal(listenerCounts.touchcancel, 0);
        assert.equal(fixture.grid.querySelector('.plan-segment-resize-preview-layer'), null);
        assert.equal(fixture.grid.classList.contains('is-delete-pending-plan-resize'), false);
    }, { planSegmentCore: realPlanSegmentCore });
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
        assert.equal(grid.querySelectorAll('.plan-segment-resize-preview-guide').length, 1);

        listeners.pointermove(createPointerEvent('pointermove', secondSegment, 120));
        listeners.pointerup(createPointerEvent('pointerup', secondSegment, 120));

        assert.deepEqual(resizeCalls, [['resize', 0, 0, 'right', 40]]);
        assert.equal(hasClass(firstSegment, 'is-resizing-plan-segment'), false);
        assert.equal(grid.querySelectorAll('.plan-segment-resize-preview-guide').length, 0);
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
