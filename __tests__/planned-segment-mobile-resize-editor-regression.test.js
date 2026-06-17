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
        const deleteTarget = layer.querySelector('.plan-segment-resize-preview-delete-target');
        assert.ok(deleteTarget);
        assert.equal(hasClass(deleteTarget, 'plan-segment-resize-preview-delete-target'), true);
        const deleteDuration = deleteTarget.querySelector('.plan-segment-resize-preview-duration');
        assert.ok(deleteDuration);
        assert.match(deleteDuration.textContent, /\uB193\uC73C\uBA74 \uC0AD\uC81C/);
        const previewDurations = latestPreviewDurations(fixture.grid);
        assert.match(previewDurations[0], /\uB193\uC73C\uBA74 \uC0AD\uC81C/);
        assert.equal(previewDurations[1], '50m');

        listeners.pointerup(createPointerEvent('pointerup', fixture.handle, -100));

        assert.equal(ctx.timeSlots[0].planActivities.length, 0);
        assert.deepEqual(applyCalls, []);
    }, { planSegmentCore: realPlanSegmentCore });
});

test('delete-pending preview keeps label text unstruck', () => {
    const deleteLabelRule = interactionsCss.match(
        /\.plan-segment-resize-preview-segment\.plan-segment-resize-preview-delete-target \.plan-segment-resize-preview-label\s*\{[^}]*\}/
    );
    assert.ok(deleteLabelRule);
    assert.doesNotMatch(deleteLabelRule[0], /text-decoration/);
});

test('ten minute delete-pending preview exposes continuous shrink sizing', () => {
    withDocument(({ listeners }) => {
        const ctx = createTenMinuteResizeContext();
        const fixture = createResizeFixture({ endMinute: 10 });

        attachPlanSegmentResizeListeners.call(ctx, fixture.entry, 0);
        fixture.handle.dispatchEvent(createPointerEvent('pointerdown', fixture.handle, 0));
        listeners.pointermove(createPointerEvent('pointermove', fixture.handle, -50));

        const deleteTarget = latestDeleteTarget(fixture.grid);
        assert.ok(deleteTarget);
        assert.equal(deleteTarget.style.width, '50%');
        assert.equal(previewRatio(deleteTarget), 0.5);
        assert.match(deleteTarget.querySelector('.plan-segment-resize-preview-duration').textContent, /\uB193\uC73C\uBA74 \uC0AD\uC81C/);

        listeners.pointerup(createPointerEvent('pointerup', fixture.handle, -50));

        assert.equal(ctx.timeSlots[0].planActivities.length, 0);
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
        const deleteTarget = layer.querySelector('.plan-segment-resize-preview-delete-target');
        assert.ok(deleteTarget);
        assert.equal(hasClass(deleteTarget, 'plan-segment-resize-preview-delete-target'), true);
        const deleteDuration = deleteTarget.querySelector('.plan-segment-resize-preview-duration');
        assert.ok(deleteDuration);
        assert.match(deleteDuration.textContent, /\uB193\uC73C\uBA74 \uC0AD\uC81C/);
        const previewDurations = latestPreviewDurations(fixture.grid);
        assert.match(previewDurations[0], /\uB193\uC73C\uBA74 \uC0AD\uC81C/);
        assert.equal(previewDurations[1], '50m');

        listeners.pointerup(createPointerEvent('pointerup', fixture.handle, -100));

        assert.deepEqual(deleteCalls, [{ baseIndex: 0, segmentIndex: 0 }]);
        assert.deepEqual(applyCalls, []);
        assert.equal(ctx.timeSlots[0].planActivities.length, 0);
        assert.equal(fixture.grid.querySelector('.plan-segment-resize-preview-layer'), null);
        assert.equal(fixture.grid.classList.contains('is-delete-pending-plan-resize'), false);
    }, { planSegmentCore: realPlanSegmentCore });
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
        assert.ok(latestDeleteTarget(fixture.grid));

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

    const rightOnlyGuideRule = interactionsCss.match(/\.plan-segment-resize-preview-guide\.plan-segment-resize-preview-arrow-right-only\s*\{[^}]*\}/);
    assert.ok(rightOnlyGuideRule);
    assert.match(rightOnlyGuideRule[0], /transform:\s*translate\(calc\(-100%\s*-\s*3px\),\s*-50%\);/);

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
        assert.ok(shrinkLayer.querySelector('.plan-segment-resize-preview-delete-target'));

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

        listeners.touchmove(createTouchEvent('touchmove', fixture.handle, -50));
        const layer = latestPreviewLayer(fixture.grid);
        assert.ok(layer);
        assert.equal(layer.classList.contains('is-delete-pending-plan-resize'), true);
        const deleteTarget = layer.querySelector('.plan-segment-resize-preview-delete-target');
        assert.ok(deleteTarget);
        assert.equal(hasClass(deleteTarget, 'plan-segment-resize-preview-delete-target'), true);
        assert.equal(deleteTarget.style.width, '50%');
        assert.equal(previewRatio(deleteTarget), 0.5);
        const deleteDuration = deleteTarget.querySelector('.plan-segment-resize-preview-duration');
        assert.ok(deleteDuration);
        assert.match(deleteDuration.textContent, /\uB193\uC73C\uBA74 \uC0AD\uC81C/);
        const previewDurations = latestPreviewDurations(fixture.grid);
        assert.match(previewDurations[0], /\uB193\uC73C\uBA74 \uC0AD\uC81C/);
        assert.equal(previewDurations[1], '50m');

        listeners.touchend(createTouchEvent('touchend', fixture.handle, -50));

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
