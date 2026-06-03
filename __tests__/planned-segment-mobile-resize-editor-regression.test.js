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
        addEventListener(type, handler) {
            listeners[type] = listeners[type] || [];
            listeners[type].push(handler);
        },
        dispatchEvent(event) {
            if (!event.target) event.target = this;
            (listeners[event.type] || []).forEach(handler => handler(event));
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

function createResizeFixture() {
    const entry = createNode('div', 'time-entry');
    const grid = createNode('div', 'split-grid');
    const segment = createNode('div', 'split-grid-segment', {
        segmentKind: 'real-plan',
        segmentIndex: '0',
        segmentStartMinute: '0',
        segmentEndMinute: '30',
    });
    const handle = createNode('span', 'plan-segment-resize-handle plan-segment-resize-handle-right', {
        resizeEdge: 'right',
    });
    entry.appendChild(grid);
    grid.appendChild(segment);
    segment.appendChild(handle);
    return { entry, grid, segment, handle };
}

function createPointerEvent(type, target, clientX) {
    return {
        type,
        target,
        button: 0,
        pointerId: 7,
        clientX,
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
    const body = createNode('body');
    global.document = {
        body,
        activeElement: null,
        createElement: (tagName) => createNode(tagName),
        addEventListener(type, handler) {
            listeners[type] = handler;
        },
        removeEventListener(type, handler) {
            if (listeners[type] === handler) delete listeners[type];
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
        callback({ listeners, body });
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
        assert.equal(first.grid.querySelectorAll('.plan-segment-resize-preview-layer').length, 1);
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
