const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

require('../controllers/controller-state-access');
const controller = require('../controllers/inline-plan-dropdown-controller');
const { buildMethod } = require('./helpers/script-method-builder');
const controllerSource = fs.readFileSync(path.join(__dirname, '..', 'controllers', 'inline-plan-dropdown-controller.js'), 'utf8');
const indexHtml = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const interactionsCss = fs.readFileSync(path.join(__dirname, '..', 'styles', 'interactions.css'), 'utf8');

const buildPlannedActivityOptionsWrapper = buildMethod(
    'buildPlannedActivityOptions(extraLabels = [])',
    '(extraLabels = [])'
);
const groupActivityBoardWrapper = buildMethod(
    'groupActivityBoard(entries)',
    '(entries)'
);
const renderInlinePlanDropdownOptionsWrapper = buildMethod(
    'renderInlinePlanDropdownOptions()',
    '()'
);
const positionInlinePlanDropdownWrapper = buildMethod(
    'positionInlinePlanDropdown(anchorEl)',
    '(anchorEl)'
);
const positionInlinePlanChildPopoverWrapper = buildMethod(
    'positionInlinePlanChildPopover(anchorEl = null)',
    '(anchorEl = null)'
);
const openInlinePlanDropdownWrapper = buildMethod(
    'openInlinePlanDropdown(index, anchorEl, endIndex = null, options = {})',
    '(index, anchorEl, endIndex = null, options = {})'
);
const closeInlinePlanDropdownWrapper = buildMethod(
    'closeInlinePlanDropdown()',
    '()'
);
const closePlanActivityChildMenuWrapper = buildMethod(
    'closePlanActivityChildMenu(options = {})',
    '(options = {})'
);
const applyInlinePlanSelectionWrapper = buildMethod(
    'applyInlinePlanSelection(label, options = {})',
    '(label, options = {})'
);
const touchPlannedActivityUsageWrapper = buildMethod(
    'touchPlannedActivityUsage(activityItem, parentItem = null)',
    '(activityItem, parentItem = null)'
);

function createInlinePlanPositionHarness({ viewport, sheet = false, querySelector = null } = {}) {
    const dropdownClasses = new Set(['inline-plan-dropdown']);
    if (sheet) dropdownClasses.add('inline-plan-dropdown-sheet');
    const dropdown = {
        style: {},
        scrollHeight: 260,
        offsetHeight: 260,
        classList: {
            contains(name) {
                return dropdownClasses.has(name);
            },
        },
        querySelector() {
            return null;
        },
    };
    const metrics = viewport || { left: 0, top: 0, right: 1000, bottom: 800, width: 1000, height: 800 };
    const childLayer = { parentNode: { removeChild() {} }, style: {} };
    const ctx = {
        inlinePlanDropdown: dropdown,
        resolveInlinePlanAnchor(anchorEl) {
            return anchorEl;
        },
        getInlinePlanViewportMetrics() {
            return metrics;
        },
        measureInlinePlanPanel(panel, fallbackWidth) {
            return controller.measureInlinePlanPanel.call(this, panel, fallbackWidth);
        },
        layoutInlinePlanAnchoredPanel(panel, anchorRect, options) {
            return controller.layoutInlinePlanAnchoredPanel.call(this, panel, anchorRect, options);
        },
        getInlinePlanMinimumInteractiveHeight(dropdownEl) {
            return controller.getInlinePlanMinimumInteractiveHeight.call(this, dropdownEl);
        },
        isInlinePlanMobileInputContext() {
            return false;
        },
        positionInlinePlanChildPopover() {},
    };
    return { ctx, dropdown, viewport: metrics };
}

function createInlinePlanAnchor({ left = 100, top = 100, width = 80, height = 30 } = {}) {
    return {
        isConnected: true,
        getBoundingClientRect() {
            return {
                left,
                top,
                right: left + width,
                bottom: top + height,
                width,
                height,
            };
        },
    };
}

function installInlinePlanPositionGlobals({ querySelector = null } = {}) {
    const originalDocument = globalThis.document;
    const originalWindow = globalThis.window;
    globalThis.document = {
        documentElement: {
            scrollLeft: 0,
            scrollTop: 0,
        },
        querySelector(selector) {
            return typeof querySelector === 'function' ? querySelector(selector) : null;
        },
    };
    globalThis.window = {
        scrollX: 0,
        scrollY: 0,
    };
    return () => {
        globalThis.document = originalDocument;
        globalThis.window = originalWindow;
    };
}

test('inline-plan-dropdown-controller exports and global attach are available', () => {
    assert.ok(controller);
    assert.equal(typeof controller.buildPlannedActivityOptions, 'function');
    assert.equal(typeof controller.groupActivityBoard, 'function');
        assert.equal(typeof controller.renderInlinePlanDropdownOptions, 'function');
        assert.equal(typeof controller.positionInlinePlanDropdown, 'function');
        assert.equal(typeof controller.positionInlinePlanChildPopover, 'function');
        assert.equal(typeof controller.layoutInlinePlanAnchoredPanel, 'function');
        assert.equal(typeof controller.openInlinePlanDropdown, 'function');
        assert.equal(typeof controller.closeInlinePlanDropdown, 'function');
        assert.equal(typeof controller.closePlanActivityChildMenu, 'function');
        assert.equal(typeof controller.applyInlinePlanSelection, 'function');
        assert.equal(
            globalThis.TimeTrackerInlinePlanDropdownController.openInlinePlanDropdown,
            controller.openInlinePlanDropdown
        );
});

test('index html does not load the temporary inline plan chipboard patch module', () => {
    assert.doesNotMatch(indexHtml, /inline-plan-chipboard-patch\.js/);
});

test('segment replacement resolver never falls back to generic planned input', () => {
    const originalDocument = globalThis.document;
    const segment = createInlineSelectionNode('div');
    segment.className = 'split-grid-segment';
    segment.dataset.segmentKind = 'real-plan';
    segment.dataset.segmentIndex = '1';
    segment.dataset.segmentId = 'seg-1';
    segment.isConnected = true;
    const label = createInlineSelectionNode('span');
    label.className = 'plan-segment-label-text';
    label.isConnected = true;
    segment.appendChild(label);
    segment.querySelector = (selector) => {
        if (selector === '.plan-segment-label-text') return label;
        if (selector === '.plan-segment-graphic-label') return null;
        return null;
    };

    const genericInput = { isConnected: true, className: 'planned-input' };
    const row = {
        querySelectorAll(selector) {
            if (selector === '.split-grid-segment[data-segment-kind="real-plan"][data-segment-index="1"]') {
                return [segment];
            }
            return [];
        },
    };
    globalThis.document = {
        querySelector(selector) {
            if (selector === '.time-entry[data-index="4"], [data-index="4"]') return row;
            if (selector === '[data-index="4"] .planned-input') return genericInput;
            return null;
        },
    };

    const ctx = {
        inlinePlanTarget: {
            mode: 'plan-segment-replace',
            baseIndex: 4,
            startIndex: 4,
            segmentIndex: 1,
            segmentId: 'seg-1',
        },
    };

    try {
        assert.equal(controller.resolveInlinePlanAnchor.call(ctx, null, 4), label);
        assert.equal(controller.resolvePlanSegmentInlinePlanAnchor.call(ctx, ctx.inlinePlanTarget, 4), label);
    } finally {
        globalThis.document = originalDocument;
    }
});

test('layoutInlinePlanAnchoredPanel keeps absolute panels on page coordinates', () => {
    const restore = installInlinePlanPositionGlobals();
    const panel = {
        style: {},
        scrollHeight: 260,
        offsetHeight: 260,
        scrollWidth: 240,
        offsetWidth: 240,
        getBoundingClientRect() {
            return { width: 240, height: 260 };
        },
    };
    const ctx = {
        getInlinePlanViewportMetrics() {
            return { left: 200, top: 240, right: 590, bottom: 660, width: 390, height: 420 };
        },
    };
    try {
        globalThis.window.scrollX = 200;
        globalThis.window.scrollY = 240;
        globalThis.document.documentElement.scrollLeft = 200;
        globalThis.document.documentElement.scrollTop = 240;
        const layout = controller.layoutInlinePlanAnchoredPanel.call(ctx, panel, {
            left: 100,
            top: 380,
            right: 140,
            bottom: 410,
            width: 40,
            height: 30,
        }, {
            positionMode: 'absolute',
            preferredWidth: 240,
            minWidth: 240,
            minHeight: 160,
            margin: 12,
            gap: 6,
        });

        assert.equal(layout.placement, 'above');
        assert.equal(panel.style.left, '300px');
        assert.equal(panel.style.top, '354px');
        assert.equal(panel.style.maxHeight, '362px');
    } finally {
        restore();
    }
});

test('layoutInlinePlanAnchoredPanel keeps fixed panels anchored to the viewport', () => {
    const restore = installInlinePlanPositionGlobals();
    const panel = {
        style: {},
        scrollHeight: 260,
        offsetHeight: 260,
        scrollWidth: 240,
        offsetWidth: 240,
        getBoundingClientRect() {
            return { width: 240, height: 260 };
        },
    };
    const ctx = {
        getInlinePlanViewportMetrics() {
            return { left: 200, top: 240, right: 590, bottom: 660, width: 390, height: 420 };
        },
    };
    try {
        globalThis.window.scrollX = 200;
        globalThis.window.scrollY = 240;
        globalThis.document.documentElement.scrollLeft = 200;
        globalThis.document.documentElement.scrollTop = 240;
        const layout = controller.layoutInlinePlanAnchoredPanel.call(ctx, panel, {
            left: 100,
            top: 380,
            right: 140,
            bottom: 410,
            width: 40,
            height: 30,
        }, {
            positionMode: 'fixed',
            preferredWidth: 240,
            minWidth: 240,
            minHeight: 160,
            margin: 12,
            gap: 6,
        });

        assert.equal(layout.placement, 'above');
        assert.equal(panel.style.left, '100px');
        assert.equal(panel.style.top, '114px');
        assert.equal(panel.style.maxHeight, '362px');
    } finally {
        restore();
    }
});

test('positionInlinePlanDropdown applies anchored collision layout to segment replacement', () => {
    const restore = installInlinePlanPositionGlobals();
    const { ctx, dropdown } = createInlinePlanPositionHarness({
        viewport: { left: 0, top: 0, right: 360, bottom: 300, width: 360, height: 300 },
    });
    const anchor = createInlinePlanAnchor({ left: 320, top: 250, width: 32, height: 28 });
    ctx.inlinePlanTarget = {
        startIndex: 0,
        endIndex: 0,
        mode: 'plan-segment-replace',
        anchorAlign: 'center',
        anchorMinWidth: 500,
    };
    try {
        controller.positionInlinePlanDropdown.call(ctx, anchor);

        assert.equal(dropdown.style.visibility, 'visible');
        assert.equal(dropdown.style.left, '12px');
        assert.ok(Number.parseInt(dropdown.style.top, 10) >= 284);
        assert.equal(dropdown.style.maxHeight, '4px');
        assert.equal(dropdown.style.width, '336px');
    } finally {
        restore();
    }
});

test('positionInlinePlanDropdown uses segment source rect for replacement placement', () => {
    const restoreGlobals = installInlinePlanPositionGlobals();
    const { ctx, dropdown } = createInlinePlanPositionHarness({
        viewport: { left: 0, top: 0, right: 1000, bottom: 800, width: 1000, height: 800 },
    });
    const sourceRect = { left: 100, top: 100, right: 600, bottom: 150, width: 500, height: 50 };
    ctx.inlinePlanTarget = {
        mode: 'plan-segment-replace',
        anchorAlign: 'center',
        anchorMinWidth: 500,
        sourceRect,
    };
    const labelAnchor = createInlinePlanAnchor({ left: 140, top: 112, width: 24, height: 18 });

    try {
        controller.positionInlinePlanDropdown.call(ctx, labelAnchor);

        assert.equal(dropdown.style.width, '500px');
        assert.equal(dropdown.style.left, '100px');
        assert.equal(dropdown.style.top, '156px');
    } finally {
        restoreGlobals();
    }
});

test('positionInlinePlanDropdown keeps normal planned dropdown collision behavior', () => {
    const restoreGlobals = installInlinePlanPositionGlobals();
    const { ctx, dropdown } = createInlinePlanPositionHarness({
        viewport: { left: 0, top: 0, right: 360, bottom: 300, width: 360, height: 300 },
    });
    ctx.inlinePlanTarget = { startIndex: 0, endIndex: 0, anchorMinWidth: 500 };
    const anchor = createInlinePlanAnchor({ left: 80, top: 250, width: 120, height: 28 });

    try {
        controller.positionInlinePlanDropdown.call(ctx, anchor);

        assert.equal(dropdown.style.width, '336px');
        assert.ok(Number.parseInt(dropdown.style.top, 10) < 250);
        assert.notEqual(dropdown.style.maxHeight, '4px');
    } finally {
        restoreGlobals();
    }
});

test('sheet touch dismiss does not arm from chip board interactions', () => {
    const listeners = {};
    const dropdown = {
        scrollTop: 0,
        style: {},
        classList: {
            contains(className) {
                return className === 'inline-plan-dropdown-sheet';
            },
        },
        querySelector() {
            return null;
        },
        addEventListener(type, handler) {
            listeners[type] = handler;
        },
        removeEventListener() {},
    };
    const chipTarget = {
        closest(selector) {
            return String(selector).includes('.activity-chip-board') ? { className: 'activity-chip-board' } : null;
        },
    };
    const calls = [];
    const ctx = {
        inlinePlanDropdown: dropdown,
        inlinePlanSheetTouchHandlers: null,
        cleanupInlinePlanSheetTouchDismiss() {
            controller.cleanupInlinePlanSheetTouchDismiss.call(this);
        },
        closeInlinePlanDropdown() {
            calls.push('close');
        },
    };

    controller.setupInlinePlanSheetTouchDismiss.call(ctx, dropdown);
    listeners.touchstart({ target: chipTarget, touches: [{ clientY: 10 }] });
    listeners.touchmove({
        target: chipTarget,
        touches: [{ clientY: 140 }],
        cancelable: true,
        preventDefault() {
            calls.push('prevent');
        },
    });
    listeners.touchend({ target: chipTarget, changedTouches: [{ clientY: 140 }] });

    assert.equal(dropdown.style.transform || '', '');
    assert.deepEqual(calls, []);
});

test('sheet touch dismiss closes after dragging the handle downward past threshold', () => {
    const listeners = {};
    const timers = [];
    const originalSetTimeout = globalThis.setTimeout;
    const originalClearTimeout = globalThis.clearTimeout;
    const handle = {
        closest(selector) {
            return selector === '.inline-plan-sheet-drag-handle' ? handle : null;
        },
    };
    const dropdown = {
        scrollTop: 0,
        style: {},
        classList: {
            contains(className) {
                return className === 'inline-plan-dropdown-sheet';
            },
        },
        querySelector(selector) {
            return selector === '.inline-plan-sheet-drag-handle' ? handle : null;
        },
        addEventListener(type, handler) {
            listeners[type] = handler;
        },
        removeEventListener() {},
    };
    const calls = [];
    const ctx = {
        inlinePlanDropdown: dropdown,
        inlinePlanSheetTouchHandlers: null,
        cleanupInlinePlanSheetTouchDismiss() {
            controller.cleanupInlinePlanSheetTouchDismiss.call(this);
        },
        closeInlinePlanDropdown() {
            calls.push('close');
        },
    };

    globalThis.setTimeout = (fn) => {
        timers.push(fn);
        return timers.length;
    };
    globalThis.clearTimeout = () => {};

    try {
        controller.setupInlinePlanSheetTouchDismiss.call(ctx, dropdown);
        listeners.touchstart({ target: handle, touches: [{ clientY: 24 }], pointerId: 7 });
        listeners.touchmove({
            target: handle,
            touches: [{ clientY: 146 }],
            pointerId: 7,
            cancelable: true,
            preventDefault() {
                calls.push('prevent');
            },
        });
        listeners.touchend({ target: handle, changedTouches: [{ clientY: 146 }], pointerId: 7 });

        assert.equal(dropdown.style.transform, 'translateY(100%)');
        assert.deepEqual(calls, ['prevent']);
        assert.equal(timers.length, 1);

        timers[0]();

        assert.deepEqual(calls, ['prevent', 'close']);
    } finally {
        globalThis.setTimeout = originalSetTimeout;
        globalThis.clearTimeout = originalClearTimeout;
    }
});

test('sheet touch dismiss snaps back open when drag stays below threshold', () => {
    const listeners = {};
    const timers = [];
    const originalSetTimeout = globalThis.setTimeout;
    const originalClearTimeout = globalThis.clearTimeout;
    const handle = {
        closest(selector) {
            return selector === '.inline-plan-sheet-drag-handle' ? handle : null;
        },
    };
    const dropdown = {
        scrollTop: 0,
        style: {},
        classList: {
            contains(className) {
                return className === 'inline-plan-dropdown-sheet';
            },
        },
        querySelector(selector) {
            return selector === '.inline-plan-sheet-drag-handle' ? handle : null;
        },
        addEventListener(type, handler) {
            listeners[type] = handler;
        },
        removeEventListener() {},
    };
    const calls = [];
    const ctx = {
        inlinePlanDropdown: dropdown,
        inlinePlanSheetTouchHandlers: null,
        cleanupInlinePlanSheetTouchDismiss() {
            controller.cleanupInlinePlanSheetTouchDismiss.call(this);
        },
        closeInlinePlanDropdown() {
            calls.push('close');
        },
    };

    globalThis.setTimeout = (fn) => {
        timers.push(fn);
        return timers.length;
    };
    globalThis.clearTimeout = () => {};

    try {
        controller.setupInlinePlanSheetTouchDismiss.call(ctx, dropdown);
        listeners.touchstart({ target: handle, touches: [{ clientY: 24 }], pointerId: 9 });
        listeners.touchmove({
            target: handle,
            touches: [{ clientY: 52 }],
            pointerId: 9,
            cancelable: true,
            preventDefault() {
                calls.push('prevent');
            },
        });
        listeners.touchend({ target: handle, changedTouches: [{ clientY: 52 }], pointerId: 9 });

        assert.equal(dropdown.style.transform, 'translateY(0px)');
        assert.deepEqual(calls, ['prevent']);
        assert.equal(timers.length, 0);
        assert.equal(ctx.inlinePlanSheetTouchState.armed, false);
        assert.equal(calls.includes('close'), false);
    } finally {
        globalThis.setTimeout = originalSetTimeout;
        globalThis.clearTimeout = originalClearTimeout;
    }
});

test('sheet touch dismiss clears pending close timeout and works again after reopen', () => {
    const timerQueue = [];
    const cleared = [];
    const originalSetTimeout = globalThis.setTimeout;
    const originalClearTimeout = globalThis.clearTimeout;
    const createDropdown = () => {
        const handle = {
            closest(selector) {
                return selector === '.inline-plan-sheet-drag-handle' ? handle : null;
            },
        };
        const listeners = {};
        const dropdown = {
            scrollTop: 0,
            style: {},
            classList: {
                contains(className) {
                    return className === 'inline-plan-dropdown-sheet';
                },
            },
            querySelector(selector) {
                return selector === '.inline-plan-sheet-drag-handle' ? handle : null;
            },
            addEventListener(type, handler) {
                listeners[type] = handler;
            },
            removeEventListener() {},
        };
        return { dropdown, handle, listeners };
    };
    const first = createDropdown();
    const second = createDropdown();
    const calls = [];
    const ctx = {
        inlinePlanDropdown: first.dropdown,
        inlinePlanSheetTouchHandlers: null,
        cleanupInlinePlanSheetTouchDismiss() {
            controller.cleanupInlinePlanSheetTouchDismiss.call(this);
        },
        closeInlinePlanDropdown() {
            calls.push('close');
            this.inlinePlanDropdown = null;
        },
    };

    globalThis.setTimeout = (fn) => {
        const id = timerQueue.length + 1;
        timerQueue.push({ id, fn, cleared: false });
        return id;
    };
    globalThis.clearTimeout = (id) => {
        cleared.push(id);
        const item = timerQueue.find((entry) => entry.id === id);
        if (item) item.cleared = true;
    };
    const fireTimer = (id) => {
        const item = timerQueue.find((entry) => entry.id === id);
        if (item && !item.cleared) item.fn();
    };

    try {
        controller.setupInlinePlanSheetTouchDismiss.call(ctx, first.dropdown);
        first.listeners.touchstart({ type: 'touchstart', target: first.handle, touches: [{ clientY: 20 }], pointerId: 1 });
        first.listeners.touchmove({
            type: 'touchmove',
            target: first.handle,
            touches: [{ clientY: 90 }],
            pointerId: 1,
            cancelable: true,
            preventDefault() {},
        });
        first.listeners.touchend({ type: 'touchend', target: first.handle, changedTouches: [{ clientY: 90 }], pointerId: 1 });

        assert.equal(timerQueue.length, 1);
        const firstTimerId = timerQueue[0].id;

        ctx.inlinePlanDropdown = second.dropdown;
        controller.setupInlinePlanSheetTouchDismiss.call(ctx, second.dropdown);

        assert.ok(cleared.includes(firstTimerId));

        second.listeners.touchstart({ type: 'touchstart', target: second.handle, touches: [{ clientY: 20 }], pointerId: 2 });
        second.listeners.touchmove({
            type: 'touchmove',
            target: second.handle,
            touches: [{ clientY: 85 }],
            pointerId: 2,
            cancelable: true,
            preventDefault() {},
        });
        second.listeners.touchend({ type: 'touchend', target: second.handle, changedTouches: [{ clientY: 85 }], pointerId: 2 });
        assert.equal(timerQueue.length, 2);

        fireTimer(firstTimerId);
        assert.deepEqual(calls, []);

        fireTimer(timerQueue[1].id);

        assert.deepEqual(calls, ['close']);
    } finally {
        globalThis.setTimeout = originalSetTimeout;
        globalThis.clearTimeout = originalClearTimeout;
    }
});

test('sheet touch dismiss ignores non-sheet dropdowns', () => {
    const dropdown = {
        classList: {
            contains() {
                return false;
            },
        },
        addEventListener() {
            throw new Error('should not attach listeners');
        },
    };
    const ctx = {
        inlinePlanSheetTouchHandlers: null,
        cleanupInlinePlanSheetTouchDismiss() {
            controller.cleanupInlinePlanSheetTouchDismiss.call(this);
        },
    };

    controller.setupInlinePlanSheetTouchDismiss.call(ctx, dropdown);

    assert.equal(ctx.inlinePlanSheetTouchHandlers, null);
});

test('sheet touch dismiss ignores scrolled sheet content and desktop non-sheet dropdowns', () => {
    const listeners = {};
    const dropdown = {
        scrollTop: 24,
        style: {},
        classList: {
            contains(className) {
                return className === 'inline-plan-dropdown-sheet';
            },
        },
        querySelector(selector) {
            return selector === '.inline-plan-sheet-drag-handle'
                ? {
                    closest(findSelector) {
                        return findSelector === '.inline-plan-sheet-drag-handle' ? this : null;
                    },
                }
                : null;
        },
        addEventListener(type, handler) {
            listeners[type] = handler;
        },
        removeEventListener() {},
    };
    const calls = [];
    const ctx = {
        inlinePlanDropdown: dropdown,
        inlinePlanSheetTouchHandlers: null,
        cleanupInlinePlanSheetTouchDismiss() {
            controller.cleanupInlinePlanSheetTouchDismiss.call(this);
        },
        closeInlinePlanDropdown() {
            calls.push('close');
        },
    };

    controller.setupInlinePlanSheetTouchDismiss.call(ctx, dropdown);

    listeners.touchstart({ type: 'touchstart', target: dropdown.querySelector('.inline-plan-sheet-drag-handle'), touches: [{ clientY: 30 }], pointerId: 3 });
    listeners.touchmove({
        type: 'touchmove',
        target: dropdown.querySelector('.inline-plan-sheet-drag-handle'),
        touches: [{ clientY: 100 }],
        pointerId: 3,
        cancelable: true,
        preventDefault() {
            calls.push('prevent');
        },
    });

    assert.equal(dropdown.style.transform || '', '');
    assert.deepEqual(calls, []);

    const desktopDropdown = {
        classList: {
            contains() {
                return false;
            },
        },
        addEventListener() {
            throw new Error('should not install sheet listeners');
        },
    };
    const desktopCtx = {
        inlinePlanSheetTouchHandlers: null,
        cleanupInlinePlanSheetTouchDismiss() {
            controller.cleanupInlinePlanSheetTouchDismiss.call(this);
        },
    };
    controller.setupInlinePlanSheetTouchDismiss.call(desktopCtx, desktopDropdown);
    assert.equal(desktopCtx.inlinePlanSheetTouchHandlers, null);

test('sheet touch dismiss works from touch events when PointerEvent exists', () => {
    const originalPointerEvent = globalThis.PointerEvent;
    globalThis.PointerEvent = function PointerEvent() {};
    const listeners = {};
    const timers = [];
    const originalSetTimeout = globalThis.setTimeout;
    const originalClearTimeout = globalThis.clearTimeout;
    const handle = {
        closest(selector) {
            return selector === '.inline-plan-sheet-drag-handle' ? handle : null;
        },
    };
    const dropdown = {
        scrollTop: 0,
        style: {},
        classList: {
            contains(className) {
                return className === 'inline-plan-dropdown-sheet';
            },
        },
        querySelector(selector) {
            return selector === '.inline-plan-sheet-drag-handle' ? handle : null;
        },
        addEventListener(type, handler) {
            listeners[type] = handler;
        },
        removeEventListener() {},
    };
    const calls = [];
    const ctx = {
        inlinePlanDropdown: dropdown,
        inlinePlanSheetTouchHandlers: null,
        cleanupInlinePlanSheetTouchDismiss() {
            controller.cleanupInlinePlanSheetTouchDismiss.call(this);
        },
        closeInlinePlanDropdown() {
            calls.push('close');
        },
    };

    globalThis.setTimeout = (fn) => {
        timers.push(fn);
        return timers.length;
    };
    globalThis.clearTimeout = () => {};

    try {
        controller.setupInlinePlanSheetTouchDismiss.call(ctx, dropdown);

        listeners.touchstart({ target: handle, touches: [{ clientY: 20 }], pointerId: 1 });
        listeners.touchmove({
            target: handle,
            touches: [{ clientY: 90 }],
            pointerId: 1,
            cancelable: true,
            preventDefault() { calls.push('prevent'); },
        });
        listeners.touchend({ target: handle, changedTouches: [{ clientY: 90 }], pointerId: 1 });

        assert.equal(dropdown.style.transform, 'translateY(100%)');
        assert.equal(timers.length, 1);
        timers[0]();
        assert.deepEqual(calls, ['prevent', 'close']);
    } finally {
        globalThis.PointerEvent = originalPointerEvent;
        globalThis.setTimeout = originalSetTimeout;
        globalThis.clearTimeout = originalClearTimeout;
    }
});

test('sheet touch dismiss works from pointerType touch pointer events', () => {
    const listeners = {};
    const timers = [];
    const originalSetTimeout = globalThis.setTimeout;
    const originalClearTimeout = globalThis.clearTimeout;
    const handle = {
        closest(selector) {
            return selector === '.inline-plan-sheet-drag-handle' ? handle : null;
        },
    };
    const dropdown = {
        scrollTop: 0,
        style: {},
        classList: {
            contains(className) {
                return className === 'inline-plan-dropdown-sheet';
            },
        },
        querySelector(selector) {
            return selector === '.inline-plan-sheet-drag-handle' ? handle : null;
        },
        addEventListener(type, handler) {
            listeners[type] = handler;
        },
        removeEventListener() {},
    };
    const calls = [];
    const ctx = {
        inlinePlanDropdown: dropdown,
        inlinePlanSheetTouchHandlers: null,
        cleanupInlinePlanSheetTouchDismiss() {
            controller.cleanupInlinePlanSheetTouchDismiss.call(this);
        },
        closeInlinePlanDropdown() {
            calls.push('close');
        },
    };

    globalThis.setTimeout = (fn) => {
        timers.push(fn);
        return timers.length;
    };
    globalThis.clearTimeout = () => {};

    try {
        controller.setupInlinePlanSheetTouchDismiss.call(ctx, dropdown);

        listeners.pointerdown({ type: 'pointerdown', pointerType: 'touch', target: handle, clientY: 20, pointerId: 3 });
        listeners.pointermove({
            type: 'pointermove',
            pointerType: 'touch',
            target: handle,
            clientY: 90,
            pointerId: 3,
            cancelable: true,
            preventDefault() { calls.push('prevent'); },
        });
        listeners.pointerup({ type: 'pointerup', pointerType: 'touch', target: handle, clientY: 90, pointerId: 3 });

        assert.equal(dropdown.style.transform, 'translateY(100%)');
        assert.equal(timers.length, 1);
        timers[0]();
        assert.deepEqual(calls, ['prevent', 'close']);
    } finally {
        globalThis.setTimeout = originalSetTimeout;
        globalThis.clearTimeout = originalClearTimeout;
    }
});

test('sheet touch dismiss does not double-close from mixed touch and pointer streams', () => {
    const listeners = {};
    const timers = [];
    const originalSetTimeout = globalThis.setTimeout;
    const originalClearTimeout = globalThis.clearTimeout;
    const handle = {
        closest(selector) {
            return selector === '.inline-plan-sheet-drag-handle' ? handle : null;
        },
    };
    const dropdown = {
        scrollTop: 0,
        style: {},
        classList: {
            contains(className) {
                return className === 'inline-plan-dropdown-sheet';
            },
        },
        querySelector(selector) {
            return selector === '.inline-plan-sheet-drag-handle' ? handle : null;
        },
        addEventListener(type, handler) {
            listeners[type] = handler;
        },
        removeEventListener() {},
    };
    const calls = [];
    const ctx = {
        inlinePlanDropdown: dropdown,
        inlinePlanSheetTouchHandlers: null,
        cleanupInlinePlanSheetTouchDismiss() {
            controller.cleanupInlinePlanSheetTouchDismiss.call(this);
        },
        closeInlinePlanDropdown() {
            calls.push('close');
        },
    };

    globalThis.setTimeout = (fn) => {
        timers.push(fn);
        return timers.length;
    };
    globalThis.clearTimeout = () => {};

    try {
        controller.setupInlinePlanSheetTouchDismiss.call(ctx, dropdown);

        // Touch stream arms first
        listeners.touchstart({ type: 'touchstart', target: handle, touches: [{ clientY: 20 }], pointerId: 1 });
        // Pointer stream also fires but should be ignored because state.armed is true
        listeners.pointerdown({ type: 'pointerdown', pointerType: 'touch', target: handle, clientY: 22, pointerId: 3 });
        // Move via touch
        listeners.touchmove({
            type: 'touchmove',
            target: handle,
            touches: [{ clientY: 100 }],
            pointerId: 1,
            cancelable: true,
            preventDefault() {},
        });
        // Pointer move should be ignored (different activeSource)
        listeners.pointermove({
            type: 'pointermove',
            pointerType: 'touch',
            target: handle,
            clientY: 103,
            pointerId: 3,
            cancelable: true,
            preventDefault() {},
        });
        // End via touch
        listeners.touchend({ type: 'touchend', target: handle, changedTouches: [{ clientY: 100 }], pointerId: 1 });
        // Pointer end should be ignored (different activeSource, state.armed is false)
        listeners.pointerup({ type: 'pointerup', pointerType: 'touch', target: handle, clientY: 103, pointerId: 3 });

        assert.equal(dropdown.style.transform, 'translateY(100%)');
        // Only one close timer, not two
        assert.equal(timers.length, 1);
        timers[0]();
        assert.deepEqual(calls, ['close']);
    } finally {
        globalThis.setTimeout = originalSetTimeout;
        globalThis.clearTimeout = originalClearTimeout;
    }
});

test('sheet touch dismiss does not arm from input, textarea, or button targets', () => {
    const listeners = {};
    const dropdown = {
        scrollTop: 0,
        style: {},
        classList: {
            contains(className) {
                return className === 'inline-plan-dropdown-sheet';
            },
        },
        querySelector() { return null; },
        addEventListener(type, handler) {
            listeners[type] = handler;
        },
        removeEventListener() {},
    };
    const calls = [];
    const ctx = {
        inlinePlanDropdown: dropdown,
        inlinePlanSheetTouchHandlers: null,
        cleanupInlinePlanSheetTouchDismiss() {
            controller.cleanupInlinePlanSheetTouchDismiss.call(this);
        },
        closeInlinePlanDropdown() {
            calls.push('close');
        },
    };

    controller.setupInlinePlanSheetTouchDismiss.call(ctx, dropdown);

    const makeTarget = (tagName) => ({
        tagName,
        closest(selector) {
            if (selector.includes(tagName)) return this;
            if (selector === '.inline-plan-sheet-drag-handle') return null;
            if (selector === '.inline-plan-dropdown-sheet') return this;
            return null;
        },
    });

    for (const tag of ['input', 'textarea', 'button', 'select']) {
        const target = makeTarget(tag);
        listeners.touchstart({ target, touches: [{ clientY: 10 }] });
    }

    assert.equal(dropdown.style.transform || '', '');
    assert.deepEqual(calls, []);
});
});

test('script inline plan wrapper methods delegate to controller helpers', () => {
    const calls = [];
    const original = globalThis.TimeTrackerInlinePlanDropdownController;
    globalThis.TimeTrackerInlinePlanDropdownController = {
        buildPlannedActivityOptions(extraLabels) {
            calls.push(['build', this, extraLabels]);
            return 'build-result';
        },
        groupActivityBoard(entries) {
            calls.push(['group', this, entries]);
            return 'group-result';
        },
        renderInlinePlanDropdownOptions() {
            calls.push(['render', this]);
            return 'render-result';
        },
        positionInlinePlanDropdown(anchorEl) {
            calls.push(['position', this, anchorEl]);
            return 'position-result';
        },
        positionInlinePlanChildPopover(anchorEl) {
            calls.push(['positionChild', this, anchorEl]);
            return 'position-child-result';
        },
        openInlinePlanDropdown(index, anchorEl, endIndex, options) {
            calls.push(['open', this, index, anchorEl, endIndex, options]);
            return 'open-result';
        },
        closeInlinePlanDropdown() {
            calls.push(['close', this]);
            return 'close-result';
        },
        closePlanActivityChildMenu(options) {
            calls.push(['closeChild', this, options]);
            return 'close-child-result';
        },
        applyInlinePlanSelection(label, options) {
            calls.push(['apply', this, label, options]);
            return 'apply-result';
        },
        touchPlannedActivityUsage(activityItem, parentItem) {
            calls.push(['touchUsage', this, activityItem, parentItem]);
            return 'touch-result';
        },
    };

    const ctx = { id: 'tracker' };
    const anchor = { id: 'anchor' };
    const options = { keepOpen: true };
    const activityItem = { id: 'activity-1' };
    const parentItem = { id: 'parent-1' };

    try {
        assert.equal(buildPlannedActivityOptionsWrapper.call(ctx, ['A']), 'build-result');
        assert.equal(groupActivityBoardWrapper.call(ctx, ['A']), 'group-result');
        assert.equal(renderInlinePlanDropdownOptionsWrapper.call(ctx), 'render-result');
        assert.equal(positionInlinePlanDropdownWrapper.call(ctx, anchor), 'position-result');
        assert.equal(positionInlinePlanChildPopoverWrapper.call(ctx, anchor), 'position-child-result');
        assert.equal(openInlinePlanDropdownWrapper.call(ctx, 3, anchor, 5, options), 'open-result');
        assert.equal(closeInlinePlanDropdownWrapper.call(ctx), 'close-result');
        assert.equal(closePlanActivityChildMenuWrapper.call(ctx, options), 'close-child-result');
        assert.equal(applyInlinePlanSelectionWrapper.call(ctx, 'A', options), 'apply-result');
        assert.equal(touchPlannedActivityUsageWrapper.call(ctx, activityItem, parentItem), 'touch-result');
    } finally {
        globalThis.TimeTrackerInlinePlanDropdownController = original;
    }

    assert.deepEqual(calls, [
        ['build', ctx, ['A']],
        ['group', ctx, ['A']],
        ['render', ctx],
        ['position', ctx, anchor],
        ['positionChild', ctx, anchor],
        ['open', ctx, 3, anchor, 5, options],
        ['close', ctx],
        ['closeChild', ctx, options],
        ['apply', ctx, 'A', options],
        ['touchUsage', ctx, activityItem, parentItem],
    ]);
});

test('positionInlinePlanDropdown keeps desktop width independent of anchor width', () => {
    const restoreGlobals = installInlinePlanPositionGlobals();
    const { ctx, dropdown } = createInlinePlanPositionHarness();
    const narrowAnchor = createInlinePlanAnchor({ width: 80 });
    const wideAnchor = createInlinePlanAnchor({ width: 720 });

    try {
        controller.positionInlinePlanDropdown.call(ctx, narrowAnchor);
        const narrowWidth = dropdown.style.width;
        const narrowMinWidth = dropdown.style.minWidth;

        controller.positionInlinePlanDropdown.call(ctx, wideAnchor);

        assert.equal(narrowWidth, '420px');
        assert.equal(narrowMinWidth, '420px');
        assert.equal(dropdown.style.width, '420px');
        assert.equal(dropdown.style.minWidth, '420px');
        assert.equal(dropdown.style.width, narrowWidth);
        assert.notEqual(dropdown.style.width, '112px');
        assert.notEqual(dropdown.style.width, '752px');
    } finally {
        restoreGlobals();
    }
});

test('positionInlinePlanDropdown clamps desktop width when viewport is narrow', () => {
    const restoreGlobals = installInlinePlanPositionGlobals();
    const { ctx, dropdown } = createInlinePlanPositionHarness({
        viewport: { left: 0, top: 0, right: 360, bottom: 800, width: 360, height: 800 },
    });
    const anchor = createInlinePlanAnchor({ left: 40, width: 720 });

    try {
        controller.positionInlinePlanDropdown.call(ctx, anchor);

        assert.equal(dropdown.style.width, '336px');
        assert.equal(dropdown.style.minWidth, '336px');
    } finally {
        restoreGlobals();
    }
});

test('positionInlinePlanDropdown shifts right-edge desktop anchors inside viewport margin', () => {
    const restoreGlobals = installInlinePlanPositionGlobals();
    const { ctx, dropdown, viewport } = createInlinePlanPositionHarness({
        viewport: { left: 0, top: 0, right: 1000, bottom: 800, width: 1000, height: 800 },
    });
    const anchor = createInlinePlanAnchor({ left: 900, width: 80 });

    try {
        controller.positionInlinePlanDropdown.call(ctx, anchor);

        const left = Number.parseInt(dropdown.style.left, 10);
        assert.equal(dropdown.style.width, '420px');
        assert.ok(left <= viewport.right - 420 - 12);
        assert.ok(left + 420 <= viewport.right - 12);
    } finally {
        restoreGlobals();
    }
});

test('positionInlinePlanDropdown centers segment replacement dropdown on anchor center', () => {
    const restoreGlobals = installInlinePlanPositionGlobals();
    const { ctx, dropdown } = createInlinePlanPositionHarness({
        viewport: { left: 0, top: 0, right: 1000, bottom: 800, width: 1000, height: 800 },
    });
    ctx.inlinePlanTarget = { mode: 'plan-segment-replace', anchorAlign: 'center' };
    const anchor = createInlinePlanAnchor({ left: 300, width: 100 });

    try {
        controller.positionInlinePlanDropdown.call(ctx, anchor);

        assert.equal(dropdown.style.width, '420px');
        assert.equal(dropdown.style.left, '140px');
    } finally {
        restoreGlobals();
    }
});

test('positionInlinePlanDropdown keeps non-segment dropdowns left aligned', () => {
    const restoreGlobals = installInlinePlanPositionGlobals();
    const { ctx, dropdown } = createInlinePlanPositionHarness({
        viewport: { left: 0, top: 0, right: 1000, bottom: 800, width: 1000, height: 800 },
    });
    ctx.inlinePlanTarget = { mode: 'planned-slot', anchorAlign: 'center' };
    const anchor = createInlinePlanAnchor({ left: 300, width: 100 });

    try {
        controller.positionInlinePlanDropdown.call(ctx, anchor);

        assert.equal(dropdown.style.left, '300px');
    } finally {
        restoreGlobals();
    }
});

test('positionInlinePlanDropdown uses merged overlay height when the overlay is taller than the anchor', () => {
    const restoreGlobals = installInlinePlanPositionGlobals();
    const { ctx, dropdown } = createInlinePlanPositionHarness({
        viewport: { left: 0, top: 0, right: 1000, bottom: 800, width: 1000, height: 800 },
    });
    const overlay = createInlinePlanAnchor({ left: 120, top: 100, width: 680, height: 132 });
    const anchor = {
        isConnected: true,
        getBoundingClientRect() {
            return {
                left: 120,
                top: 100,
                right: 800,
                bottom: 144,
                width: 680,
                height: 44,
            };
        },
        querySelector(selector) {
            return selector === '.planned-merged-overlay' ? overlay : null;
        },
    };

    try {
        controller.positionInlinePlanDropdown.call(ctx, anchor);

        assert.equal(dropdown.style.left, '120px');
        assert.equal(dropdown.style.top, '238px');
    } finally {
        restoreGlobals();
    }
});

test('positionInlinePlanDropdown uses the full merged planned range bottom for merged slots', () => {
    const rows = new Map([
        [16, createInlinePlanAnchor({ left: 120, top: 100, width: 680, height: 44 })],
        [17, createInlinePlanAnchor({ left: 120, top: 144, width: 680, height: 44 })],
        [18, createInlinePlanAnchor({ left: 120, top: 188, width: 680, height: 44 })],
    ]);
    const restoreGlobals = installInlinePlanPositionGlobals({
        querySelector(selector) {
            const match = selector && selector.match(/^\.time-entry\[data-index="(\d+)"\]$/);
            if (!match) return null;
            return rows.get(Number.parseInt(match[1], 10)) || null;
        },
    });
    const { ctx, dropdown } = createInlinePlanPositionHarness({
        viewport: { left: 0, top: 0, right: 1000, bottom: 800, width: 1000, height: 800 },
    });
    ctx.inlinePlanTarget = {
        startIndex: 16,
        endIndex: 18,
        rangeStart: 16,
        rangeEnd: 18,
        mergeKey: 'planned-16-18',
    };
    const anchor = rows.get(16);

    try {
        controller.positionInlinePlanDropdown.call(ctx, anchor);

        assert.equal(dropdown.style.top, '238px');
        assert.equal(dropdown.style.left, '120px');
    } finally {
        restoreGlobals();
    }
});

test('positionInlinePlanDropdown keeps a non-merged single slot anchored to the clicked row', () => {
    const restoreGlobals = installInlinePlanPositionGlobals();
    const { ctx, dropdown } = createInlinePlanPositionHarness({
        viewport: { left: 0, top: 0, right: 1000, bottom: 800, width: 1000, height: 800 },
    });
    ctx.inlinePlanTarget = { startIndex: 10, endIndex: 10 };
    const anchor = createInlinePlanAnchor({ left: 200, top: 100, width: 120, height: 44 });

    try {
        controller.positionInlinePlanDropdown.call(ctx, anchor);

        assert.equal(dropdown.style.top, '150px');
        assert.equal(dropdown.style.left, '200px');
    } finally {
        restoreGlobals();
    }
});

test('positionInlinePlanDropdown expands a normal planned dropdown to the clicked slot width', () => {
    const restoreGlobals = installInlinePlanPositionGlobals();
    const { ctx, dropdown } = createInlinePlanPositionHarness({
        viewport: { left: 0, top: 0, right: 1400, bottom: 800, width: 1400, height: 800 },
    });
    ctx.inlinePlanTarget = { startIndex: 10, endIndex: 10, anchorMinWidth: 876 };
    const anchor = createInlinePlanAnchor({ left: 200, width: 120 });

    try {
        controller.positionInlinePlanDropdown.call(ctx, anchor);

        assert.equal(dropdown.style.width, '876px');
        assert.equal(dropdown.style.minWidth, '876px');
        assert.equal(dropdown.style.left, '200px');
    } finally {
        restoreGlobals();
    }
});

test('positionInlinePlanDropdown keeps a narrow planned slot dropdown at the default width', () => {
    const restoreGlobals = installInlinePlanPositionGlobals();
    const { ctx, dropdown } = createInlinePlanPositionHarness({
        viewport: { left: 0, top: 0, right: 1000, bottom: 800, width: 1000, height: 800 },
    });
    ctx.inlinePlanTarget = { startIndex: 10, endIndex: 10, anchorMinWidth: 220 };
    const anchor = createInlinePlanAnchor({ left: 200, width: 120 });

    try {
        controller.positionInlinePlanDropdown.call(ctx, anchor);

        assert.equal(dropdown.style.width, '420px');
        assert.equal(dropdown.style.minWidth, '420px');
        assert.equal(dropdown.style.left, '200px');
    } finally {
        restoreGlobals();
    }
});

test('positionInlinePlanDropdown keeps the default width for a narrow segment replacement', () => {
    const restoreGlobals = installInlinePlanPositionGlobals();
    const { ctx, dropdown } = createInlinePlanPositionHarness({
        viewport: { left: 0, top: 0, right: 1000, bottom: 800, width: 1000, height: 800 },
    });
    ctx.inlinePlanTarget = { mode: 'plan-segment-replace', anchorAlign: 'center', anchorMinWidth: 160 };
    const anchor = createInlinePlanAnchor({ left: 300, width: 100 });

    try {
        controller.positionInlinePlanDropdown.call(ctx, anchor);

        assert.equal(dropdown.style.width, '420px');
        assert.equal(dropdown.style.minWidth, '420px');
    } finally {
        restoreGlobals();
    }
});

test('positionInlinePlanDropdown expands to a wide segment replacement width', () => {
    const restoreGlobals = installInlinePlanPositionGlobals();
    const { ctx, dropdown } = createInlinePlanPositionHarness({
        viewport: { left: 0, top: 0, right: 1000, bottom: 800, width: 1000, height: 800 },
    });
    ctx.inlinePlanTarget = { mode: 'plan-segment-replace', anchorAlign: 'center', anchorMinWidth: 640 };
    const anchor = createInlinePlanAnchor({ left: 300, width: 100 });

    try {
        controller.positionInlinePlanDropdown.call(ctx, anchor);

        assert.equal(dropdown.style.width, '640px');
        assert.equal(dropdown.style.minWidth, '640px');
        assert.equal(dropdown.style.left, '30px');
    } finally {
        restoreGlobals();
    }
});

test('positionInlinePlanDropdown clamps a wide segment replacement width to the viewport', () => {
    const restoreGlobals = installInlinePlanPositionGlobals();
    const { ctx, dropdown, viewport } = createInlinePlanPositionHarness({
        viewport: { left: 0, top: 0, right: 760, bottom: 800, width: 760, height: 800 },
    });
    ctx.inlinePlanTarget = { mode: 'plan-segment-replace', anchorAlign: 'center', anchorMinWidth: 900 };
    const anchor = createInlinePlanAnchor({ left: 620, width: 80 });

    try {
        controller.positionInlinePlanDropdown.call(ctx, anchor);

        assert.equal(dropdown.style.width, '736px');
        assert.equal(dropdown.style.minWidth, '736px');
        assert.ok(Number.parseInt(dropdown.style.left, 10) >= viewport.left + 12);
        assert.ok(Number.parseInt(dropdown.style.left, 10) <= viewport.right - 736 - 12);
    } finally {
        restoreGlobals();
    }
});

test('positionInlinePlanDropdown clamps centered segment dropdown at viewport edges', () => {
    const restoreGlobals = installInlinePlanPositionGlobals();
    const { ctx, dropdown, viewport } = createInlinePlanPositionHarness({
        viewport: { left: 0, top: 0, right: 1000, bottom: 800, width: 1000, height: 800 },
    });
    ctx.inlinePlanTarget = { mode: 'plan-segment-replace', anchorAlign: 'center' };

    try {
        controller.positionInlinePlanDropdown.call(ctx, createInlinePlanAnchor({ left: 900, width: 100 }));
        const rightLeft = Number.parseInt(dropdown.style.left, 10);
        assert.ok(rightLeft <= viewport.right - 420 - 12);

        controller.positionInlinePlanDropdown.call(ctx, createInlinePlanAnchor({ left: 0, width: 40 }));
        const leftLeft = Number.parseInt(dropdown.style.left, 10);
        assert.ok(leftLeft >= viewport.left + 12);
    } finally {
        restoreGlobals();
    }
});

test('positionInlinePlanDropdown keeps mobile sheet sizing unchanged', () => {
    const { ctx, dropdown } = createInlinePlanPositionHarness({ sheet: true });

    controller.positionInlinePlanDropdown.call(ctx, createInlinePlanAnchor());

    assert.equal(dropdown.style.width, '100vw');
    assert.equal(dropdown.style.maxWidth, '100vw');
    assert.equal(dropdown.style.left, '0px');
    assert.equal(dropdown.style.bottom, '0px');
    assert.equal(dropdown.style.top, 'auto');
});

test('isSameInlinePlanTarget can read the current range through shared controller state access', () => {
    const originalAccess = globalThis.TimeTrackerControllerStateAccess;
    globalThis.TimeTrackerControllerStateAccess = {
        ...originalAccess,
        getInlinePlanTarget() {
            return {
                startIndex: 2,
                endIndex: 4,
                anchor: { id: 'shared-anchor' },
            };
        }
    };

    try {
        assert.equal(
            controller.isSameInlinePlanTarget.call({ inlinePlanTarget: null }, { startIndex: 2, endIndex: 4 }),
            true
        );
    } finally {
        globalThis.TimeTrackerControllerStateAccess = originalAccess;
    }
});

test('isSameInlinePlanTarget includes virtual rest gap identity', () => {
    const ctx = {
        inlinePlanTarget: {
            startIndex: 1,
            endIndex: 1,
            mode: 'virtual-rest-gap',
            gapStartMinute: 20,
            gapDurationMinutes: 20,
        },
    };

    assert.equal(
        controller.isSameInlinePlanTarget.call(ctx, {
            startIndex: 1,
            endIndex: 1,
        }),
        false
    );
    assert.equal(
        controller.isSameInlinePlanTarget.call(ctx, {
            startIndex: 1,
            endIndex: 1,
            mode: 'virtual-rest-gap',
            gapStartMinute: 40,
            gapDurationMinutes: 20,
        }),
        false
    );
    assert.equal(
        controller.isSameInlinePlanTarget.call(ctx, {
            startIndex: 1,
            endIndex: 1,
            mode: 'virtual-rest-gap',
            gapStartMinute: 20,
            gapDurationMinutes: 20,
        }),
        true
    );
});

test('openInlinePlanDropdown switches from normal row target to virtual rest gap target in the same row', () => {
    const originalDocument = globalThis.document;
    const originalWindow = globalThis.window;
    const originalRequestAnimationFrame = globalThis.requestAnimationFrame;
    const anchor = { isConnected: true };
    const dropdown = {
        className: '',
        innerHTML: '',
        style: {},
        addEventListener() {},
        contains() { return false; },
        querySelector() { return null; },
    };
    let closed = 0;
    const ctx = {
        inlinePlanDropdown: { existing: true },
        inlinePlanTarget: { startIndex: 1, endIndex: 1, anchor },
        timeSlots: [{}, {}],
        suppressInlinePlanOpenUntil: 0,
        getPlannedRangeInfo(index) {
            return { startIndex: index, endIndex: index };
        },
        resolveInlinePlanAnchor(anchorEl) {
            return anchorEl;
        },
        isSameInlinePlanTarget(range, anchorEl) {
            return controller.isSameInlinePlanTarget.call(this, range, anchorEl);
        },
        clearSelection() {
            throw new Error('normal toggle-close should not run for a virtual rest gap switch');
        },
        closeInlinePlanDropdown() {
            closed += 1;
            this.inlinePlanDropdown = null;
        },
        getActivePlanSource() {
            return 'local';
        },
        isInlinePlanMobileInputContext() {
            return false;
        },
        setupInlinePlanSheetTouchDismiss() {},
        handleInlinePlanWheel() {},
        shouldAutofocusInlinePlanInput() {
            return false;
        },
        renderInlinePlanDropdownOptions() {},
        positionInlinePlanDropdown() {},
        scheduleInlinePlanInputVisibilitySync() {},
        applyInlinePlanBackgroundContext() {},
        bindInlinePlanDropdownContext() {},
        closeInlinePriorityMenu() {},
        getPlanActivitiesForIndex() { return []; },
        isEventWithinCurrentInlinePlanRange() { return false; },
        scheduleInlinePlanViewportSync() {},
        isInlinePlanInputFocused() { return false; },
        hasRecentInlinePlanInputIntent() { return false; },
        isNotionUIVisible() { return false; },
    };
    globalThis.document = {
        createElement() {
            return dropdown;
        },
        body: {
            appendChild() {},
            classList: { add() {}, remove() {} },
        },
        addEventListener() {},
        removeEventListener() {},
        querySelector() {
            return null;
        },
    };
    globalThis.window = { addEventListener() {}, removeEventListener() {} };
    globalThis.requestAnimationFrame = () => {};

    try {
        const opened = controller.openInlinePlanDropdown.call(ctx, 1, anchor, 1, {
            mode: 'virtual-rest-gap',
            gapStartMinute: 20,
            gapDurationMinutes: 30,
        });
        assert.equal(opened, true);
    } finally {
        globalThis.document = originalDocument;
        globalThis.window = originalWindow;
        globalThis.requestAnimationFrame = originalRequestAnimationFrame;
    }

    assert.equal(closed, 1);
    assert.equal(ctx.inlinePlanTarget.mode, 'virtual-rest-gap');
    assert.equal(ctx.inlinePlanTarget.gapStartMinute, 20);
    assert.equal(ctx.inlinePlanTarget.gapDurationMinutes, 30);
});

test('openInlinePlanDropdown switches between different virtual rest gaps in the same row', () => {
    const originalDocument = globalThis.document;
    const originalWindow = globalThis.window;
    const originalRequestAnimationFrame = globalThis.requestAnimationFrame;
    const anchor = { isConnected: true };
    const dropdown = {
        className: '',
        innerHTML: '',
        style: {},
        addEventListener() {},
        contains() { return false; },
        querySelector() { return null; },
    };
    const ctx = {
        inlinePlanDropdown: { existing: true },
        timeSlots: [{}, {}],
        inlinePlanTarget: {
            startIndex: 1,
            endIndex: 1,
            anchor,
            mode: 'virtual-rest-gap',
            gapStartMinute: 20,
            gapDurationMinutes: 20,
        },
        getPlannedRangeInfo(index) {
            return { startIndex: index, endIndex: index };
        },
        resolveInlinePlanAnchor(anchorEl) {
            return anchorEl;
        },
        isSameInlinePlanTarget(range, anchorEl) {
            return controller.isSameInlinePlanTarget.call(this, range, anchorEl);
        },
        clearSelection() {
            throw new Error('different virtual gap should switch instead of toggle-close');
        },
        closeInlinePlanDropdown() {
            this.inlinePlanDropdown = null;
        },
        getActivePlanSource() { return 'local'; },
        isInlinePlanMobileInputContext() { return false; },
        setupInlinePlanSheetTouchDismiss() {},
        handleInlinePlanWheel() {},
        shouldAutofocusInlinePlanInput() { return false; },
        renderInlinePlanDropdownOptions() {},
        positionInlinePlanDropdown() {},
        scheduleInlinePlanInputVisibilitySync() {},
        applyInlinePlanBackgroundContext() {},
        bindInlinePlanDropdownContext() {},
        closeInlinePriorityMenu() {},
        getPlanActivitiesForIndex() { return []; },
        isEventWithinCurrentInlinePlanRange() { return false; },
        scheduleInlinePlanViewportSync() {},
        isInlinePlanInputFocused() { return false; },
        hasRecentInlinePlanInputIntent() { return false; },
        isNotionUIVisible() { return false; },
    };
    globalThis.document = {
        createElement() { return dropdown; },
        body: {
            appendChild() {},
            classList: { add() {}, remove() {} },
        },
        addEventListener() {},
        removeEventListener() {},
        querySelector() { return null; },
    };
    globalThis.window = { addEventListener() {}, removeEventListener() {} };
    globalThis.requestAnimationFrame = () => {};

    try {
        controller.openInlinePlanDropdown.call(ctx, 1, anchor, 1, {
            mode: 'virtual-rest-gap',
            gapStartMinute: 50,
            gapDurationMinutes: 10,
        });
    } finally {
        globalThis.document = originalDocument;
        globalThis.window = originalWindow;
        globalThis.requestAnimationFrame = originalRequestAnimationFrame;
    }

    assert.equal(ctx.inlinePlanTarget.mode, 'virtual-rest-gap');
    assert.equal(ctx.inlinePlanTarget.gapStartMinute, 50);
    assert.equal(ctx.inlinePlanTarget.gapDurationMinutes, 10);
});

test('openInlinePlanDropdown keeps exact same virtual rest gap as toggle-close behavior', () => {
    const anchor = { isConnected: true };
    let cleared = false;
    let closed = false;
    const ctx = {
        inlinePlanDropdown: { existing: true },
        inlinePlanTarget: {
            startIndex: 1,
            endIndex: 1,
            anchor,
            mode: 'virtual-rest-gap',
            gapStartMinute: 20,
            gapDurationMinutes: 20,
        },
        getPlannedRangeInfo(index) {
            return { startIndex: index, endIndex: index };
        },
        resolveInlinePlanAnchor(anchorEl) {
            return anchorEl;
        },
        isSameInlinePlanTarget(range, anchorEl) {
            return controller.isSameInlinePlanTarget.call(this, range, anchorEl);
        },
        clearSelection(type) {
            assert.equal(type, 'planned');
            cleared = true;
        },
        closeInlinePlanDropdown() {
            closed = true;
        },
    };

    const opened = controller.openInlinePlanDropdown.call(ctx, 1, anchor, 1, {
        mode: 'virtual-rest-gap',
        gapStartMinute: 20,
        gapDurationMinutes: 20,
    });

    assert.equal(opened, false);
    assert.equal(cleared, true);
    assert.equal(closed, true);
});

test('openInlinePlanDropdown returns false when suppressed or anchor resolution fails', () => {
    const ctx = {
        suppressInlinePlanOpenUntil: Date.now() + 1000,
    };

    assert.equal(controller.openInlinePlanDropdown.call(ctx, 0, null, 0), false);

    ctx.suppressInlinePlanOpenUntil = 0;
    ctx.getPlannedRangeInfo = (index) => ({ startIndex: index, endIndex: index });
    ctx.resolveInlinePlanAnchor = () => null;

    assert.equal(controller.openInlinePlanDropdown.call(ctx, 0, null, 0), false);
});

test('openInlinePlanDropdown ignores stale suppression for plan segment replacement opens', () => {
    const originalDocument = globalThis.document;
    const originalWindow = globalThis.window;
    const originalRequestAnimationFrame = globalThis.requestAnimationFrame;
    const anchor = { isConnected: true };
    const dropdown = {
        className: '',
        innerHTML: '',
        style: {},
        addEventListener() {},
        removeEventListener() {},
        contains() { return false; },
        querySelector() { return null; },
    };
    const ctx = {
        suppressInlinePlanOpenUntil: Date.now() + 1000,
        timeSlots: [{ planActivities: [{ label: 'Focus' }] }],
        getPlannedRangeInfo(index) {
            return { startIndex: index, endIndex: index };
        },
        resolveInlinePlanAnchor(anchorEl) {
            return anchorEl;
        },
        isSameInlinePlanTarget(range, anchorEl) {
            return controller.isSameInlinePlanTarget.call(this, range, anchorEl);
        },
        clearSelection() {},
        closeInlinePlanDropdown() {
            this.inlinePlanDropdown = null;
            this.inlinePlanTarget = null;
        },
        getActivePlanSource() { return 'local'; },
        isInlinePlanMobileInputContext() { return false; },
        setupInlinePlanSheetTouchDismiss() {},
        handleInlinePlanWheel() {},
        shouldAutofocusInlinePlanInput() { return false; },
        renderInlinePlanDropdownOptions() {},
        positionInlinePlanDropdown() {},
        scheduleInlinePlanInputVisibilitySync() {},
        applyInlinePlanBackgroundContext() {},
        closeInlinePriorityMenu() {},
        closeRoutineMenu() {},
        closePlanActivityMenu() {},
        closePlanTitleMenu() {},
        getPlanActivitiesForIndex() { return []; },
        isEventWithinCurrentInlinePlanRange() { return false; },
        scheduleInlinePlanViewportSync() {},
        isInlinePlanInputFocused() { return false; },
        hasRecentInlinePlanInputIntent() { return false; },
        isNotionUIVisible() { return false; },
        markInlinePlanInputIntent() {},
    };
    globalThis.document = {
        createElement() { return dropdown; },
        body: {
            appendChild() {},
            classList: { add() {}, remove() {} },
        },
        addEventListener() {},
        removeEventListener() {},
        querySelector() { return null; },
    };
    globalThis.window = { addEventListener() {}, removeEventListener() {}, visualViewport: null };
    globalThis.requestAnimationFrame = (callback) => callback();

    try {
        const opened = controller.openInlinePlanDropdown.call(ctx, 0, anchor, 0, {
            mode: 'plan-segment-replace',
            segmentIndex: 0,
            segmentId: 'planned-0-0',
        });
        assert.equal(opened, true);
        assert.equal(ctx.inlinePlanTarget.mode, 'plan-segment-replace');
        assert.equal(ctx.inlinePlanTarget.segmentIndex, 0);
    } finally {
        globalThis.document = originalDocument;
        globalThis.window = originalWindow;
        globalThis.requestAnimationFrame = originalRequestAnimationFrame;
    }
});

function createInlinePlanOpenHarness(options = {}) {
    const originalDocument = globalThis.document;
    const originalWindow = globalThis.window;
    const originalRequestAnimationFrame = globalThis.requestAnimationFrame;
    const documentListeners = {};
    const windowListeners = {};
    const dropdownClasses = new Set(options.mobile ? ['inline-plan-dropdown-sheet'] : []);
    const board = createInlineSelectionNode('div');
    board.className = 'activity-chip-board';
    board.classList.toggle = function toggle(className, force) {
        const has = board.classList.contains(className);
        const next = typeof force === 'boolean' ? force : !has;
        if (next && !has) board.classList.add(className);
        if (!next && has) board.classList.remove(className);
        return next;
    };
    const subBoard = createInlineSelectionNode('div');
    subBoard.className = 'activity-chip-board inline-plan-sub-board';
    subBoard.classList.toggle = function toggle(className, force) {
        const has = subBoard.classList.contains(className);
        const next = typeof force === 'boolean' ? force : !has;
        if (next && !has) subBoard.classList.add(className);
        if (!next && has) subBoard.classList.remove(className);
        return next;
    };
    const subSection = createInlineSelectionNode('div');
    subSection.className = 'inline-plan-subsection';
    subSection.style = { removeProperty() {} };
    const input = createInlineSelectionNode('input');
    input.className = 'inline-plan-input';
    const addBtn = createInlineSelectionNode('button');
    addBtn.className = 'inline-plan-add-btn';
    const closeBtn = createInlineSelectionNode('button');
    closeBtn.className = 'inline-plan-close-btn';
    const actions = createInlineSelectionNode('div');
    actions.className = 'activity-chip-board-actions';
    const dropdown = {
        className: options.mobile ? 'inline-plan-dropdown inline-plan-dropdown-sheet' : 'inline-plan-dropdown',
        innerHTML: '',
        style: {},
        parentNode: null,
        classList: {
            add(name) { dropdownClasses.add(name); },
            remove(name) { dropdownClasses.delete(name); },
            contains(name) { return dropdownClasses.has(name); },
            toggle(name, force) {
                const next = typeof force === 'boolean' ? force : !dropdownClasses.has(name);
                if (next) dropdownClasses.add(name); else dropdownClasses.delete(name);
                return next;
            },
        },
        addEventListener() {},
        removeEventListener() {},
        contains(target) {
            return target === dropdown
                || target === input
                || target === board
                || target === subBoard
                || target === subSection;
        },
        querySelector(selector) {
            if (selector === '.inline-plan-input') return input;
            if (selector === '.inline-plan-add-btn') return addBtn;
            if (selector === '.inline-plan-close-btn') return closeBtn;
            if (selector === '.inline-plan-subsection') return subSection;
            if (selector === '.activity-chip-board') return board;
            if (selector === '.inline-plan-sub-board') return subBoard;
            if (selector === '.activity-chip-board-actions') return actions;
            return null;
        },
        querySelectorAll() { return []; },
    };
    const body = {
        children: [],
        classList: { add() {}, remove() {} },
        appendChild(node) {
            node.parentNode = this;
            this.children.push(node);
            return node;
        },
        removeChild(node) {
            this.children = this.children.filter((child) => child !== node);
            node.parentNode = null;
        },
    };
    const anchor = {
        isConnected: true,
        contains(target) { return target === anchor; },
        getBoundingClientRect() {
            return {
                left: options.anchorLeft || 120,
                top: options.anchorTop || 160,
                right: (options.anchorLeft || 120) + (options.anchorWidth || 180),
                bottom: (options.anchorTop || 160) + (options.anchorHeight || 34),
                width: options.anchorWidth || 180,
                height: options.anchorHeight || 34,
            };
        },
    };
    let closeCalls = 0;
    let positionCalls = 0;
    const ctx = {
        timeSlots: [{ planned: '', planActivities: [] }],
        getPlannedRangeInfo(index) { return { startIndex: index, endIndex: index }; },
        resolveInlinePlanAnchor(anchorEl) { return anchorEl || anchor; },
        isSameInlinePlanTarget(range, anchorEl) { return controller.isSameInlinePlanTarget.call(this, range, anchorEl); },
        clearSelection() {},
        closeInlinePlanDropdown() {
            closeCalls += 1;
            this.inlinePlanDropdown = null;
            this.inlinePlanTarget = null;
        },
        getActivePlanSource() { return 'local'; },
        isInlinePlanMobileInputContext() { return Boolean(options.mobile); },
        setupInlinePlanSheetTouchDismiss() {},
        cleanupInlinePlanSheetTouchDismiss() {},
        handleInlinePlanWheel() {},
        shouldAutofocusInlinePlanInput() { return false; },
        renderInlinePlanDropdownOptions() {},
        positionInlinePlanDropdown(targetAnchor) {
            positionCalls += 1;
            controller.positionInlinePlanDropdown.call(this, targetAnchor);
        },
        getInlinePlanMinimumInteractiveHeight() { return 120; },
        scheduleInlinePlanInputVisibilitySync() {},
        applyInlinePlanBackgroundContext() {},
        closeInlinePriorityMenu() {},
        closeRoutineMenu() {},
        closePlanActivityMenu() {},
        closePlanTitleMenu() {},
        getPlanActivitiesForIndex() { return []; },
        isEventWithinCurrentInlinePlanRange() { return false; },
        scheduleInlinePlanViewportSync() {
            controller.scheduleInlinePlanViewportSync.call(this);
        },
        isInlinePlanInputFocused() { return false; },
        hasRecentInlinePlanInputIntent() { return false; },
        isNotionUIVisible() { return false; },
        markInlinePlanInputIntent() {},
    };
    let createdDivCount = 0;
    globalThis.document = {
        activeElement: null,
        createElement(tagName) {
            if (tagName === 'div') {
                createdDivCount += 1;
                if (createdDivCount === 1) return dropdown;
            }
            return createInlineSelectionNode(tagName);
        },
        body,
        addEventListener(type, handler) { documentListeners[type] = handler; },
        removeEventListener() {},
        querySelector() { return null; },
        getElementById() { return null; },
    };
    globalThis.window = {
        addEventListener(type, handler) { windowListeners[type] = handler; },
        removeEventListener() {},
        innerWidth: 1024,
        innerHeight: 768,
        scrollX: 0,
        scrollY: 0,
        requestAnimationFrame(callback) { callback(); return 101; },
        cancelAnimationFrame() {},
        visualViewport: null,
    };
    globalThis.requestAnimationFrame = (callback) => callback();

    const opened = controller.openInlinePlanDropdown.call(ctx, 0, anchor, 0, {});
    assert.equal(opened, true);
    closeCalls = 0;
    positionCalls = 0;

    return {
        ctx,
        anchor,
        dropdown,
        board,
        subBoard,
        subSection,
        documentListeners,
        windowListeners,
        get closeCalls() { return closeCalls; },
        get positionCalls() { return positionCalls; },
        restore() {
            globalThis.document = originalDocument;
            globalThis.window = originalWindow;
            globalThis.requestAnimationFrame = originalRequestAnimationFrame;
        },
    };
}

test('desktop inline dropdown remains open on outside page scroll and repositions without drift', () => {
    const harness = createInlinePlanOpenHarness();
    try {
        assert.equal(harness.dropdown.style.position, 'fixed');
        assert.equal(harness.dropdown.style.visibility, 'visible');
        harness.windowListeners.scroll({ target: globalThis.document });
        assert.equal(harness.closeCalls, 0);
        assert.equal(harness.positionCalls, 1);
        assert.ok(harness.ctx.inlinePlanDropdown);
        assert.equal(harness.dropdown.style.position, 'fixed');
        assert.equal(harness.dropdown.style.visibility, 'visible');
    } finally {
        harness.restore();
    }
});

test('desktop inline dropdown stays open for internal dropdown and child popover scroll', () => {
    const harness = createInlinePlanOpenHarness();
    const childPopover = createInlineSelectionNode('div');
    const popoverScroller = createInlineSelectionNode('div');
    childPopover.appendChild(popoverScroller);
    popoverScroller.parentElement = childPopover;
    harness.ctx.inlinePlanChildPopoverLayer = childPopover;
    try {
        harness.documentListeners.scroll({ target: harness.board });
        harness.documentListeners.scroll({ target: popoverScroller });
        assert.equal(harness.closeCalls, 0);
        assert.equal(harness.positionCalls, 0);
        assert.ok(harness.ctx.inlinePlanDropdown);
    } finally {
        harness.restore();
    }
});

test('mobile bottom sheet ignores background scroll and prevents outside gestures while staying fixed', () => {
    const harness = createInlinePlanOpenHarness({ mobile: true });
    let prevented = false;
    try {
        assert.equal(harness.dropdown.style.position, 'fixed');
        assert.equal(harness.dropdown.style.bottom, '0px');
        harness.windowListeners.scroll({ target: globalThis.document });
        assert.equal(harness.closeCalls, 0);
        assert.equal(harness.positionCalls, 1);
        assert.ok(harness.ctx.inlinePlanDropdown);
        harness.documentListeners.touchmove({
            target: { contains() { return false; } },
            cancelable: true,
            preventDefault() { prevented = true; },
        });
        assert.equal(prevented, true);
        assert.equal(harness.closeCalls, 0);
        assert.equal(harness.dropdown.style.position, 'fixed');
        assert.equal(harness.dropdown.style.bottom, '0px');
    } finally {
        harness.restore();
    }
});

test('openInlinePlanDropdown returns true when same mobile sheet target remains open', () => {
    const anchor = { isConnected: true };
    let corrected = false;
    const ctx = {
        inlinePlanDropdown: {
            classList: {
                contains(className) {
                    return className === 'inline-plan-dropdown-sheet';
                },
            },
        },
        inlinePlanTarget: { startIndex: 1, endIndex: 1, anchor },
        getPlannedRangeInfo(index) {
            return { startIndex: index, endIndex: index };
        },
        resolveInlinePlanAnchor(anchorEl) {
            return anchorEl;
        },
        isSameInlinePlanTarget(range, anchorEl) {
            return controller.isSameInlinePlanTarget.call(this, range, anchorEl);
        },
        isInlinePlanMobileInputContext() {
            return true;
        },
        scheduleInlinePlanSheetTargetViewportCorrection(targetEl) {
            assert.equal(targetEl, anchor);
            corrected = true;
        },
    };

    assert.equal(controller.openInlinePlanDropdown.call(ctx, 1, anchor, 1), true);
    assert.equal(corrected, true);
});

test('openInlinePlanDropdown returns false when same desktop target toggles closed', () => {
    const anchor = { isConnected: true };
    let cleared = false;
    let closed = false;
    const ctx = {
        inlinePlanDropdown: {
            classList: {
                contains() {
                    return false;
                },
            },
        },
        inlinePlanTarget: { startIndex: 1, endIndex: 1, anchor },
        getPlannedRangeInfo(index) {
            return { startIndex: index, endIndex: index };
        },
        resolveInlinePlanAnchor(anchorEl) {
            return anchorEl;
        },
        isSameInlinePlanTarget(range, anchorEl) {
            return controller.isSameInlinePlanTarget.call(this, range, anchorEl);
        },
        isInlinePlanMobileInputContext() {
            return false;
        },
        clearSelection(type) {
            assert.equal(type, 'planned');
            cleared = true;
        },
        closeInlinePlanDropdown() {
            this.inlinePlanDropdown = null;
            this.inlinePlanTarget = null;
            closed = true;
        },
    };

    assert.equal(controller.openInlinePlanDropdown.call(ctx, 1, anchor, 1), false);
    assert.equal(cleared, true);
    assert.equal(closed, true);
    assert.equal(ctx.inlinePlanDropdown, null);
    assert.equal(ctx.inlinePlanTarget, null);
});

test('openInlinePlanDropdown marks mobile empty planned slot as sheet context target', () => {
    const originalDocument = globalThis.document;
    const originalWindow = globalThis.window;
    const originalRequestAnimationFrame = globalThis.requestAnimationFrame;
    const plannedInput = createInlineSelectionNode('input');
    plannedInput.className = 'planned-input';
    const anchor = {
        isConnected: true,
        querySelector(selector) {
            return selector === '.planned-input' ? plannedInput : null;
        },
    };
    const input = { value: '', addEventListener() {}, focus() {}, select() {} };
    const addBtn = { addEventListener() {} };
    const closeBtn = { addEventListener() {} };
    const board = { innerHTML: '', appendChild() {}, querySelector() { return null; }, querySelectorAll() { return []; } };
    const childLayer = { parentNode: { removeChild() {} }, style: {}, querySelector() { return null; } };
    const dropdown = {
        className: '',
        innerHTML: '',
        style: {},
        parentNode: null,
        addEventListener() {},
        contains() { return false; },
        querySelector(selector) {
            if (selector === '.inline-plan-input') return input;
            if (selector === '.inline-plan-add-btn') return addBtn;
            if (selector === '.inline-plan-close-btn') return closeBtn;
            if (selector === '.activity-chip-board') return board;
            return null;
        },
        querySelectorAll() { return []; },
    };
    const ctx = {
        inlinePlanDropdown: null,
        timeSlots: [{}],
        getPlannedRangeInfo(index) {
            return { startIndex: index, endIndex: index };
        },
        resolveInlinePlanAnchor(anchorEl) {
            return anchorEl;
        },
        isSameInlinePlanTarget() {
            return false;
        },
        closeInlinePlanDropdown() {},
        getActivePlanSource() { return 'local'; },
        isInlinePlanMobileInputContext() { return true; },
        setupInlinePlanSheetTouchDismiss() {},
        handleInlinePlanWheel() {},
        shouldAutofocusInlinePlanInput() { return false; },
        renderInlinePlanDropdownOptions() {},
        positionInlinePlanDropdown() {},
        scheduleInlinePlanInputVisibilitySync() {},
        applyInlinePlanBackgroundContext() {},
        bindInlinePlanDropdownContext() {},
        closeInlinePriorityMenu() {},
        getPlanActivitiesForIndex() { return []; },
        isEventWithinCurrentInlinePlanRange() { return false; },
        scheduleInlinePlanViewportSync() {},
        isInlinePlanInputFocused() { return false; },
        hasRecentInlinePlanInputIntent() { return false; },
        isNotionUIVisible() { return false; },
    };

    let createdDivs = 0;
    globalThis.document = {
        createElement(tagName) {
            if (tagName === 'div') {
                createdDivs += 1;
                return createdDivs === 1 ? dropdown : createInlineSelectionNode('div');
            }
            return createInlineSelectionNode(tagName);
        },
        body: {
            appendChild(node) {
                node.parentNode = this;
            },
            classList: { add() {}, remove() {} },
        },
        addEventListener() {},
        removeEventListener() {},
        querySelector() { return null; },
    };
    globalThis.window = {
        addEventListener() {},
        removeEventListener() {},
        visualViewport: null,
    };
    globalThis.requestAnimationFrame = () => {};

    try {
        controller.openInlinePlanDropdown.call(ctx, 0, anchor, 0);
    } finally {
        globalThis.document = originalDocument;
        globalThis.window = originalWindow;
        globalThis.requestAnimationFrame = originalRequestAnimationFrame;
    }

    assert.equal(plannedInput.classList.contains('inline-plan-sheet-context-target'), true);
    assert.equal(plannedInput.classList.contains('inline-plan-slot-context-target'), true);
});

test('openInlinePlanDropdown corrects an existing mobile sheet to the tapped slot target', () => {
    const startAnchor = createInlinePlanAnchor({ top: 80 });
    const tappedSlot = createInlinePlanAnchor({ top: 520 });
    let correctionTarget = null;
    let closed = false;
    const ctx = {
        inlinePlanDropdown: {
            classList: {
                contains(className) {
                    return className === 'inline-plan-dropdown-sheet';
                },
            },
        },
        getPlannedRangeInfo(index) {
            return { startIndex: index, endIndex: 4, mergeKey: 'planned-0-4' };
        },
        resolveInlinePlanAnchor() {
            return startAnchor;
        },
        isSameInlinePlanTarget() {
            return true;
        },
        isInlinePlanMobileInputContext() {
            return true;
        },
        scheduleInlinePlanSheetTargetViewportCorrection(targetEl) {
            correctionTarget = targetEl;
        },
        clearSelection() {},
        closeInlinePlanDropdown() {
            closed = true;
        },
    };

    controller.openInlinePlanDropdown.call(ctx, 0, startAnchor, 4, {
        sheetTargetEl: tappedSlot,
    });

    assert.equal(correctionTarget, tappedSlot);
    assert.equal(closed, false);
});

test('desktop add button keeps inline dropdown open after typing a new activity', () => {
    const originalDocument = globalThis.document;
    const originalWindow = globalThis.window;
    const originalRAF = globalThis.requestAnimationFrame;
    const input = {
        value: 'Focus',
        addEventListener() {},
        focus() {},
        select() {},
    };
    const addBtn = {
        listeners: {},
        addEventListener(type, handler) {
            this.listeners[type] = handler;
        },
    };
    const board = { innerHTML: '', appendChild() {}, querySelector() { return null; }, querySelectorAll() { return []; } };
    const dropdown = {
        className: '',
        style: {},
        parentNode: { removeChild() {} },
        addEventListener() {},
        contains() { return false; },
        querySelector(selector) {
            if (selector === '.inline-plan-input') return input;
            if (selector === '.inline-plan-add-btn') return addBtn;
            if (selector === '.activity-chip-board') return board;
            return null;
        },
        querySelectorAll() { return []; },
    };
    const saves = [];
    const renderCalls = [];
    let closed = false;
    const ctx = {
        inlinePlanDropdown: null,
        timeSlots: [{ planned: '', planActivities: [] }],
        plannedActivities: [],
        inlinePlanChipUndoState: { plannedActivities: [{ id: 'old', label: 'Old' }] },
        normalizeActivityText(value) { return String(value || '').trim(); },
        addPlannedActivityOption(label) {
            this.plannedActivities.push({ id: label.toLowerCase(), label, name: label, normalizedName: label, parentId: null, archived: false, source: 'local' });
            saves.push(label);
        },
        isPlanSlotEmptyForInline() { return true; },
        applyInlinePlanSelection(label, options = {}) {
            this.lastApply = { label, options };
            if (!options.keepOpen) this.closeInlinePlanDropdown();
        },
        renderInlinePlanDropdownOptions() {
            renderCalls.push('render');
        },
        getActivePlanSource() { return 'local'; },
        isInlinePlanMobileInputContext() { return false; },
        setupInlinePlanSheetTouchDismiss() {},
        handleInlinePlanWheel() {},
        shouldAutofocusInlinePlanInput() { return false; },
        positionInlinePlanDropdown() {},
        scheduleInlinePlanInputVisibilitySync() {},
        applyInlinePlanBackgroundContext() {},
        bindInlinePlanDropdownContext() {},
        closeInlinePriorityMenu() {},
        getPlannedRangeInfo() { return { startIndex: 0, endIndex: 0 }; },
        resolveInlinePlanAnchor(anchorEl) { return anchorEl; },
        isSameInlinePlanTarget() { return false; },
        closeInlinePlanDropdown() {
            closed = true;
            this.inlinePlanDropdown = null;
        },
        getPlanActivitiesForIndex() { return []; },
        isEventWithinCurrentInlinePlanRange() { return false; },
        scheduleInlinePlanViewportSync() {},
        isInlinePlanInputFocused() { return false; },
        hasRecentInlinePlanInputIntent() { return false; },
        isNotionUIVisible() { return false; },
        clearSelection() {},
        calculateTotals() {},
        autoSave() {},
        renderTimeEntries() {},
        inlinePlanChildPopoverLayer: null,
    };
    let createdDivs = 0;
    globalThis.document = {
        createElement(tagName) {
            if (tagName === 'div') {
                createdDivs += 1;
                if (createdDivs === 1) return dropdown;
                if (createdDivs === 2) return childLayer;
            }
            return createInlineSelectionNode(tagName);
        },
        body: {
            appendChild(node) {
                node.parentNode = this;
            },
            classList: { add() {}, remove() {} },
        },
        addEventListener() {},
        removeEventListener() {},
        querySelector() { return null; },
    };
    globalThis.window = { addEventListener() {}, removeEventListener() {}, visualViewport: null };
    globalThis.requestAnimationFrame = (cb) => cb();

    try {
        controller.openInlinePlanDropdown.call(ctx, 0, { isConnected: true, getBoundingClientRect() { return { left: 0, top: 0, right: 10, bottom: 10, width: 10, height: 10 }; } }, 0);
        closed = false;
        addBtn.listeners.click({ preventDefault() {}, stopPropagation() {} });

        assert.equal(closed, false);
        assert.equal(ctx.inlinePlanDropdown !== null, true);
        assert.equal(ctx.plannedActivities.some((item) => item.label === 'Focus'), true);
        assert.equal(ctx.inlinePlanChipUndoState, null);
        assert.deepEqual(ctx.lastApply, {
            label: 'Focus',
            options: { keepOpen: true, keepOpenOnMobile: true },
        });
        assert.ok(renderCalls.length >= 1);
    } finally {
        globalThis.document = originalDocument;
        globalThis.window = originalWindow;
        globalThis.requestAnimationFrame = originalRAF;
    }
});

test('mobile add button keeps sheet open after typing a new activity', () => {
    const originalDocument = globalThis.document;
    const originalWindow = globalThis.window;
    const originalRAF = globalThis.requestAnimationFrame;
    const input = {
        value: 'Focus',
        addEventListener() {},
        focus() {},
        select() {},
    };
    const addBtn = {
        listeners: {},
        addEventListener(type, handler) {
            this.listeners[type] = handler;
        },
    };
    const board = { innerHTML: '', appendChild() {}, querySelector() { return null; }, querySelectorAll() { return []; } };
    const dropdown = {
        className: '',
        style: {},
        parentNode: { removeChild() {} },
        addEventListener() {},
        contains() { return false; },
        querySelector(selector) {
            if (selector === '.inline-plan-input') return input;
            if (selector === '.inline-plan-add-btn') return addBtn;
            if (selector === '.activity-chip-board') return board;
            return null;
        },
        querySelectorAll() { return []; },
    };
    const childLayer = { parentNode: { removeChild() {} }, style: {} };
    const backdrop = {
        className: '',
        style: {},
        parentNode: { removeChild() {} },
        addEventListener() {},
        classList: { add() {}, remove() {}, contains() { return false; } },
    };
    let closed = false;
    const ctx = {
        inlinePlanDropdown: null,
        timeSlots: [{ planned: '', planActivities: [] }],
        plannedActivities: [],
        inlinePlanChipUndoState: { plannedActivities: [{ id: 'old', label: 'Old' }] },
        normalizeActivityText(value) { return String(value || '').trim(); },
        addPlannedActivityOption(label) {
            this.plannedActivities.push({ id: label.toLowerCase(), label, name: label, normalizedName: label, parentId: null, archived: false, source: 'local' });
        },
        isPlanSlotEmptyForInline() { return true; },
        applyInlinePlanSelection(label, options = {}) {
            this.lastApply = { label, options };
            if (!options.keepOpen || !options.keepOpenOnMobile) this.closeInlinePlanDropdown();
        },
        renderInlinePlanDropdownOptions() {},
        getActivePlanSource() { return 'local'; },
        isInlinePlanMobileInputContext() { return true; },
        setupInlinePlanSheetTouchDismiss() {},
        handleInlinePlanWheel() {},
        shouldAutofocusInlinePlanInput() { return false; },
        positionInlinePlanDropdown() {},
        scheduleInlinePlanInputVisibilitySync() {},
        applyInlinePlanBackgroundContext() {},
        bindInlinePlanDropdownContext() {},
        closeInlinePriorityMenu() {},
        getPlannedRangeInfo() { return { startIndex: 0, endIndex: 0 }; },
        resolveInlinePlanAnchor(anchorEl) { return anchorEl; },
        isSameInlinePlanTarget() { return false; },
        closeInlinePlanDropdown() {
            closed = true;
            this.inlinePlanDropdown = null;
        },
        getPlanActivitiesForIndex() { return []; },
        isEventWithinCurrentInlinePlanRange() { return false; },
        scheduleInlinePlanViewportSync() {},
        isInlinePlanInputFocused() { return false; },
        hasRecentInlinePlanInputIntent() { return false; },
        isNotionUIVisible() { return false; },
        clearSelection() {},
        calculateTotals() {},
        autoSave() {},
        renderTimeEntries() {},
        inlinePlanChildPopoverLayer: null,
    };
    let createdDivs = 0;
    globalThis.document = {
        createElement(tagName) {
            if (tagName === 'div') {
                createdDivs += 1;
                if (createdDivs === 1) return dropdown;
                if (createdDivs === 2) return backdrop;
            }
            return createInlineSelectionNode(tagName);
        },
        body: {
            appendChild(node) {
                node.parentNode = this;
            },
            classList: { add() {}, remove() {} },
        },
        addEventListener() {},
        removeEventListener() {},
        querySelector() { return null; },
    };
    globalThis.window = { addEventListener() {}, removeEventListener() {}, visualViewport: null };
    globalThis.requestAnimationFrame = (cb) => cb();

    try {
        controller.openInlinePlanDropdown.call(ctx, 0, { isConnected: true, getBoundingClientRect() { return { left: 0, top: 0, right: 10, bottom: 10, width: 10, height: 10 }; } }, 0);
        closed = false;
        addBtn.listeners.click({ preventDefault() {}, stopPropagation() {} });

        assert.equal(closed, false);
        assert.equal(ctx.inlinePlanDropdown !== null, true);
        assert.equal(ctx.plannedActivities.some((item) => item.label === 'Focus'), true);
        assert.equal(ctx.inlinePlanChipUndoState, null);
        assert.deepEqual(ctx.lastApply, {
            label: 'Focus',
            options: { keepOpen: true, keepOpenOnMobile: true },
        });
    } finally {
        globalThis.document = originalDocument;
        globalThis.window = originalWindow;
        globalThis.requestAnimationFrame = originalRAF;
    }
});

test('segment add button keeps inline dropdown open after typing a new activity', () => {
    const originalDocument = globalThis.document;
    const originalWindow = globalThis.window;
    const originalRAF = globalThis.requestAnimationFrame;
    const input = {
        value: 'Segment Focus',
        addEventListener() {},
        focus() {},
        select() {},
    };
    const addBtn = {
        listeners: {},
        addEventListener(type, handler) {
            this.listeners[type] = handler;
        },
    };
    const board = { innerHTML: '', appendChild() {}, querySelector() { return null; }, querySelectorAll() { return []; } };
    const dropdown = {
        className: '',
        style: {},
        parentNode: { removeChild() {} },
        addEventListener() {},
        contains() { return false; },
        querySelector(selector) {
            if (selector === '.inline-plan-input') return input;
            if (selector === '.inline-plan-add-btn') return addBtn;
            if (selector === '.activity-chip-board') return board;
            return null;
        },
        querySelectorAll() { return []; },
    };
    const childLayer = { parentNode: { removeChild() {} }, style: {} };
    const replaceCalls = [];
    const renderTimeEntryArgs = [];
    let closed = false;
    const ctx = {
        inlinePlanDropdown: null,
        timeSlots: [{ planned: '', planActivities: [] }],
        plannedActivities: [],
        normalizeActivityText(value) { return String(value || '').trim(); },
        addPlannedActivityOption(label) {
            this.plannedActivities.push({ id: label.toLowerCase().replace(/\s+/g, '-'), label, name: label, normalizedName: label, parentId: null, archived: false, source: 'local' });
        },
        replacePlanSegmentActivity(baseIndex, segmentIndex, activityItem) {
            replaceCalls.push({ baseIndex, segmentIndex, label: activityItem.label, id: activityItem.id });
            return true;
        },
        renderTimeEntries(keepOpen) {
            renderTimeEntryArgs.push(keepOpen);
        },
        renderInlinePlanDropdownOptions() {},
        calculateTotals() {},
        autoSave() {},
        getActivePlanSource() { return 'local'; },
        isInlinePlanMobileInputContext() { return false; },
        setupInlinePlanSheetTouchDismiss() {},
        handleInlinePlanWheel() {},
        shouldAutofocusInlinePlanInput() { return false; },
        positionInlinePlanDropdown() {},
        scheduleInlinePlanInputVisibilitySync() {},
        applyInlinePlanBackgroundContext() {},
        bindInlinePlanDropdownContext() {},
        closeInlinePriorityMenu() {},
        getPlannedRangeInfo() { return { startIndex: 0, endIndex: 0, baseIndex: 0 }; },
        resolveInlinePlanAnchor(anchorEl) { return anchorEl; },
        isSameInlinePlanTarget() { return false; },
        closeInlinePlanDropdown() {
            closed = true;
            this.inlinePlanDropdown = null;
        },
        getPlanActivitiesForIndex() { return []; },
        isEventWithinCurrentInlinePlanRange() { return false; },
        scheduleInlinePlanViewportSync() {},
        isInlinePlanInputFocused() { return false; },
        hasRecentInlinePlanInputIntent() { return false; },
        isNotionUIVisible() { return false; },
        clearSelection() {},
        inlinePlanChildPopoverLayer: null,
    };
    let createdDivs = 0;
    globalThis.document = {
        createElement(tagName) {
            if (tagName === 'div') {
                createdDivs += 1;
                if (createdDivs === 1) return dropdown;
                if (createdDivs === 2) return childLayer;
            }
            return createInlineSelectionNode(tagName);
        },
        body: {
            appendChild(node) {
                node.parentNode = this;
            },
            classList: { add() {}, remove() {} },
        },
        addEventListener() {},
        removeEventListener() {},
        querySelector() { return null; },
    };
    globalThis.window = { addEventListener() {}, removeEventListener() {}, visualViewport: null };
    globalThis.requestAnimationFrame = (cb) => cb();

    try {
        controller.openInlinePlanDropdown.call(ctx, 0, { isConnected: true, getBoundingClientRect() { return { left: 0, top: 0, right: 10, bottom: 10, width: 10, height: 10 }; } }, 0, {
            mode: 'plan-segment-replace',
            segmentIndex: 1,
            segmentId: 'planned-0-1',
            baseIndex: 0,
        });
        closed = false;
        addBtn.listeners.click({ preventDefault() {}, stopPropagation() {} });

        assert.equal(closed, false);
        assert.equal(ctx.inlinePlanDropdown !== null, true);
        assert.deepEqual(replaceCalls, [{ baseIndex: 0, segmentIndex: 1, label: 'Segment Focus', id: 'segment-focus' }]);
        assert.deepEqual(renderTimeEntryArgs, [true]);
    } finally {
        globalThis.document = originalDocument;
        globalThis.window = originalWindow;
        globalThis.requestAnimationFrame = originalRAF;
    }
});

test('closeInlinePlanDropdown clears selected segment for segment replacement target', () => {
    const originalDocument = globalThis.document;
    const originalWindow = globalThis.window;
    const dropdown = { parentNode: { removeChild() {} }, querySelector() { return null; }, removeEventListener() {} };
    const childLayer = { parentNode: { removeChild() {} } };
    const removedContextClasses = [];
    const timeEntries = {
        classList: { remove(name) { removedContextClasses.push(['root', name]); } },
        querySelectorAll(selector) {
            if (selector === '.inline-plan-context-keep-clear') {
                return [{ classList: { remove(name) { removedContextClasses.push(['row', name]); } } }];
            }
            if (selector === '.inline-plan-sheet-context-target, .inline-plan-segment-context-target, .inline-plan-slot-context-target, .inline-plan-gap-context-target') {
                return [{
                    classList: {
                        remove(...names) {
                            removedContextClasses.push(['target', ...names]);
                        },
                    },
                }];
            }
            return [];
        },
    };
    const ctx = {
        inlinePlanDropdown: dropdown,
        inlinePlanChildPopoverLayer: childLayer,
        inlinePlanTarget: { startIndex: 0, endIndex: 0, mode: 'plan-segment-replace', segmentIndex: 1 },
        selectedPlanSegment: { baseIndex: 0, segmentIndex: 1 },
        closeInlinePriorityMenu() {},
        closeRoutineMenu() {},
        closePlanActivityMenu() {},
        closePlanTitleMenu() {},
        cleanupInlinePlanSheetTouchDismiss() {},
    };
    globalThis.document = {
        removeEventListener() {},
        body: { classList: { remove() {} } },
        getElementById(id) { return id === 'timeEntries' ? timeEntries : null; },
    };
    globalThis.window = { removeEventListener() {}, visualViewport: null };

    try {
        controller.closeInlinePlanDropdown.call(ctx);
    } finally {
        globalThis.document = originalDocument;
        globalThis.window = originalWindow;
    }

    assert.equal(ctx.selectedPlanSegment, null);
    assert.equal(ctx.inlinePlanTarget, null);
    assert.deepEqual(removedContextClasses, [
        ['root', 'inline-plan-context-active'],
        ['row', 'inline-plan-context-keep-clear'],
        [
            'target',
            'inline-plan-sheet-context-target',
            'inline-plan-segment-context-target',
            'inline-plan-slot-context-target',
            'inline-plan-gap-context-target',
        ],
    ]);
});

test('closeInlinePlanDropdown blurs active sheet input before teardown', () => {
    const originalDocument = globalThis.document;
    const activeInput = {
        blurred: false,
        blur() {
            this.blurred = true;
            if (globalThis.document) globalThis.document.activeElement = null;
        },
    };
    const dropdown = {
        contains(target) {
            return target === activeInput;
        },
        querySelector() {
            return null;
        },
        removeEventListener() {},
    };
    const removedBodyClasses = [];
    const ctx = {
        inlinePlanDropdown: dropdown,
        inlinePlanTarget: { startIndex: 0, endIndex: 0 },
        closeInlinePriorityMenu() {},
        closeRoutineMenu() {},
        closePlanActivityMenu() {},
        closePlanTitleMenu() {},
        cleanupInlinePlanSheetTouchDismiss() {},
    };
    globalThis.document = {
        activeElement: activeInput,
        removeEventListener() {},
        body: {
            classList: {
                remove(name) {
                    removedBodyClasses.push(name);
                },
            },
        },
        getElementById() {
            return null;
        },
    };

    try {
        controller.closeInlinePlanDropdown.call(ctx);
    } finally {
        globalThis.document = originalDocument;
    }

    assert.equal(activeInput.blurred, true);
    assert.equal(ctx.inlinePlanDropdown, null);
    assert.deepEqual(removedBodyClasses, ['inline-plan-sheet-open']);
});

function createInlineSelectionNode(tagName) {
    const listeners = {};
    const attributes = {};
    const node = {
        tagName,
        children: [],
        dataset: {},
        className: '',
        textContent: '',
        title: '',
        type: '',
        parentNode: null,
        classList: {
            add(...classes) {
                const tokens = String(node.className || '').split(/\s+/).filter(Boolean);
                classes.forEach((className) => {
                    if (className && !tokens.includes(className)) tokens.push(className);
                });
                node.className = tokens.join(' ');
            },
            remove(...classes) {
                const tokens = String(node.className || '').split(/\s+/).filter(Boolean);
                node.className = tokens.filter((className) => !classes.includes(className)).join(' ');
            },
            contains(className) {
                return String(node.className || '').split(/\s+/).filter(Boolean).includes(className);
            },
        },
        appendChild(child) {
            child.parentNode = this;
            this.children.push(child);
            return child;
        },
        cloneNode(deep = false) {
            const clone = createInlineSelectionNode(tagName);
            clone.className = this.className;
            clone.dataset = { ...this.dataset };
            clone.textContent = this.textContent;
            clone.title = this.title;
            clone.type = this.type;
            clone.ownerDocument = this.ownerDocument;
            Object.keys(attributes).forEach((name) => {
                clone.setAttribute(name, attributes[name]);
            });
            if (deep) {
                this.children.forEach((child) => {
                    clone.appendChild(typeof child.cloneNode === 'function' ? child.cloneNode(true) : child);
                });
            }
            return clone;
        },
        addEventListener(type, handler) {
            listeners[type] = handler;
        },
        dispatchEvent(event) {
            if (!event.target) event.target = this;
            if (listeners[event.type]) listeners[event.type](event);
        },
        setAttribute(name, value) {
            attributes[name] = String(value);
        },
        getAttribute(name) {
            return attributes[name];
        },
        removeAttribute(name) {
            delete attributes[name];
        },
        querySelectorAll(selector) {
            const classNames = String(selector || '')
                .split(',')
                .map((part) => part.trim())
                .filter((part) => part.startsWith('.'))
                .map((part) => part.slice(1));
            const matches = [];
            const walk = (current) => {
                if (!current) return;
                if (classNames.some((className) => current.classList && current.classList.contains(className))) {
                    matches.push(current);
                }
                (current.children || []).forEach(walk);
            };
            (this.children || []).forEach(walk);
            return matches;
        },
    };
    return node;
}

function collectNodeText(node) {
    if (!node) return '';
    const own = String(node.textContent || '');
    const childText = (node.children || []).map(collectNodeText).join('');
    return own + childText;
}

function findNode(root, predicate) {
    if (!root) return null;
    if (predicate(root)) return root;
    for (const child of root.children || []) {
        const found = findNode(child, predicate);
        if (found) return found;
    }
    return null;
}

function createInlineSelectionHarness(options = {}) {
    const board = {
        children: [],
        _innerHTML: '',
        set innerHTML(value) {
            this._innerHTML = value;
            this.children = [];
        },
        get innerHTML() {
            return this._innerHTML;
        },
        appendChild(node) {
            node.parentNode = this;
            this.children.push(node);
            return node;
        },
    };
    const searchInput = { value: '' };
    const dropdown = {
        querySelector(selector) {
            if (selector === '.activity-chip-board') return board;
            if (selector === '.inline-plan-input') return searchInput;
            return null;
        },
    };
    const calls = [];
    const ctx = {
        inlinePlanDropdown: dropdown,
        inlinePlanTarget: options.inlinePlanTarget || { startIndex: 0, endIndex: 0 },
        selectedPlanSegment: options.selectedPlanSegment || null,
        timeSlots: options.timeSlots || [
            {
                planned: 'A',
                planTitle: '',
                planTitleBandOn: false,
                planActivities: [
                    { label: 'A', activityText: 'A', activityId: 'a', seconds: 1200, startMinute: 0, endMinute: 20, durationMinutes: 20 },
                ],
            },
        ],
        mergedFields: new Map(),
        plannedActivities: options.plannedActivities || [
            { id: 'fill', name: 'Fill', label: 'Fill', normalizedName: 'Fill', parentId: null, pinned: true, archived: false },
        ],
        modalPlanActivities: [],
        modalPlanActiveRow: -1,
        modalPlanTitle: '',
        modalPlanTitleBandOn: false,
        normalizeActivityText(value) {
            return String(value || '').trim();
        },
        normalizePlanActivitiesArray(raw) {
            return Array.isArray(raw) ? raw.map((item) => ({ ...item })) : [];
        },
        formatActivitiesSummary(items) {
            return (items || []).map((item) => item && item.label).filter(Boolean).join(', ');
        },
        groupActivityBoard(entries) {
            return controller.groupActivityBoard.call(this, entries);
        },
        renderTimeEntries(keepOpen) {
            calls.push(['render', keepOpen]);
        },
        calculateTotals() {
            calls.push(['totals']);
        },
        autoSave() {
            calls.push(['save']);
        },
        closeInlinePlanDropdown() {
            calls.push(['close']);
            this.inlinePlanTarget = null;
        },
        positionInlinePlanDropdown() {
            calls.push(['position']);
        },
        ...options.ctx,
    };
    return { board, ctx, calls };
}

function renderInlineSelectionChip(harness, label = 'Fill') {
    const originalDocument = globalThis.document;
    globalThis.document = {
        createElement: createInlineSelectionNode,
        querySelector() {
            return null;
        },
    };
    try {
        controller.renderInlinePlanDropdownOptions.call(harness.ctx);
    } finally {
        globalThis.document = originalDocument;
    }
    const chipButton = findNode(harness.board, (node) =>
        String(node.className || '').includes('activity-chip-main')
        && collectNodeText(node).includes(label)
    );
    assert.ok(chipButton, `activity chip not rendered: ${label}`);
    return chipButton;
}

function dispatchInlineSelectionClick(chipButton) {
    const originalDocument = globalThis.document;
    globalThis.document = {
        createElement: createInlineSelectionNode,
        querySelector() {
            return null;
        },
    };
    try {
        chipButton.dispatchEvent({
            type: 'click',
            preventDefault() {},
            stopPropagation() {},
        });
    } finally {
        globalThis.document = originalDocument;
    }
}

test('activity chipboard delete mode renders and toggles independently', () => {
    const originalDocument = globalThis.document;
    const board = createInlineSelectionNode('div');
    board.className = 'activity-chip-board';
    Object.defineProperty(board, 'innerHTML', {
        get() {
            return this._innerHTML || '';
        },
        set(value) {
            this._innerHTML = value;
            this.children = [];
        },
    });
    board.classList.toggle = function toggle(className, force) {
        const has = this.contains(className);
        const next = typeof force === 'boolean' ? force : !has;
        if (next && !has) this.add(className);
        if (!next && has) this.remove(className);
        return next;
    };
    const actions = {
        children: [],
        _innerHTML: '',
        className: 'activity-chip-board-actions',
        set innerHTML(value) {
            this._innerHTML = value;
            this.children = [];
        },
        get innerHTML() {
            return this._innerHTML;
        },
        appendChild(node) {
            this.children.push(node);
            return node;
        },
        querySelector() {
            return null;
        },
    };
    const shell = createInlineSelectionNode('div');
    shell.className = 'activity-chip-board-shell';
    shell.querySelector = function querySelector(selector) {
        if (selector === '.activity-chip-board-actions') return actions;
        if (selector === '.activity-chip-board') return board;
        return null;
    };
    shell.appendChild(actions);
    shell.appendChild(board);
    const searchInput = { value: '' };
    const dropdown = {
        classList: {
            toggle() {},
            contains() { return false; },
        },
        querySelector(selector) {
            if (selector === '.activity-chip-board-shell') return shell;
            if (selector === '.activity-chip-board') return board;
            if (selector === '.inline-plan-input') return searchInput;
            return null;
        },
    };
    const ctx = {
        inlinePlanDropdown: dropdown,
        inlinePlanTarget: { startIndex: 0, endIndex: 0 },
        plannedActivities: [
            { id: 'exercise', name: '운동', label: '운동', normalizedName: '운동', parentId: null, pinned: true, archived: false, source: 'local' },
        ],
        normalizeActivityText(value) {
            return String(value || '').trim();
        },
        groupActivityBoard(entries) {
            return controller.groupActivityBoard.call(this, entries);
        },
        repairPlannedActivityCatalogIdentity() {},
        renderTimeEntries() {},
        calculateTotals() {},
        autoSave() {},
        positionInlinePlanDropdown() {},
        dedupeAndSortPlannedActivities() {},
        savePlannedActivities() {},
        renderPlannedActivityDropdown() {},
        refreshSubActivityOptions() {},
    };
    globalThis.document = {
        createElement: createInlineSelectionNode,
        querySelector() {
            return null;
        },
    };

    try {
        controller.renderInlinePlanDropdownOptions.call(ctx);
        assert.equal(actions.children.length, 1);
        const toggle = actions.children[0];
        assert.equal(toggle.className, 'activity-chip-delete-mode-toggle');
        assert.equal(toggle.getAttribute('aria-pressed'), 'false');
        assert.equal(toggle.textContent, '삭제 모드');

        toggle.dispatchEvent({
            type: 'click',
            preventDefault() {},
            stopPropagation() {},
        });

        assert.equal(ctx.inlinePlanChipDeleteMode, true);
        assert.equal(ctx.inlinePlanChipEditMode, false);
        assert.equal(actions.children.length, 1);
        const nextToggle = actions.children[0];
        assert.equal(nextToggle.getAttribute('aria-pressed'), 'true');
        assert.equal(nextToggle.textContent, '삭제 모드 ON');
        assert.equal(board.classList.contains('activity-chip-board-delete-mode'), true);
        assert.equal(board.classList.contains('activity-chip-board-reorder-enabled'), false);
    } finally {
        globalThis.document = originalDocument;
    }
});

test('delete mode chipboard css keeps delete affordance inside chip bounds', () => {
    const block = interactionsCss.match(/\.activity-chip-delete\s*\{[\s\S]*?\n\}/);
    assert.ok(block);
    assert.match(block[0], /position:\s*relative/);
    assert.match(block[0], /flex:\s*0 0 24px/);
    assert.match(block[0], /width:\s*24px/);
    assert.match(block[0], /height:\s*24px/);
    assert.match(block[0], /margin:\s*0 4px 0 2px;/);
    assert.doesNotMatch(block[0], /top:\s*-\d+px/);
    assert.doesNotMatch(block[0], /right:\s*-\d+px/);
});


test('activity chipboard renders no drag handles and marks chips draggable without edit mode', () => {
    const originalDocument = globalThis.document;
    const board = createInlineSelectionNode('div');
    board.className = 'activity-chip-board';
    Object.defineProperty(board, 'innerHTML', {
        get() { return this._innerHTML || ''; },
        set(value) { this._innerHTML = value; this.children = []; },
    });
    board.classList.toggle = function toggle(className, force) {
        const has = this.contains(className);
        const next = typeof force === 'boolean' ? force : !has;
        if (next && !has) this.add(className);
        if (!next && has) this.remove(className);
        return next;
    };
    const actions = createInlineSelectionNode('div');
    actions.className = 'activity-chip-board-actions';
    Object.defineProperty(actions, 'innerHTML', {
        get() { return this._innerHTML || ''; },
        set(value) { this._innerHTML = value; this.children = []; },
    });
    const shell = createInlineSelectionNode('div');
    shell.querySelector = (selector) => selector === '.activity-chip-board-actions' ? actions : (selector === '.activity-chip-board' ? board : null);
    const searchInput = { value: '' };
    const dropdown = createInlineSelectionNode('div');
    dropdown.querySelector = (selector) => {
        if (selector === '.activity-chip-board-shell') return shell;
        if (selector === '.activity-chip-board') return board;
        if (selector === '.inline-plan-input') return searchInput;
        return null;
    };
    dropdown.classList.toggle = board.classList.toggle;
    const ctx = {
        inlinePlanDropdown: dropdown,
        inlinePlanTarget: { startIndex: 0, endIndex: 0 },
        plannedActivities: [
            { id: 'work', label: 'Work', name: 'Work', normalizedName: 'Work', parentId: null, archived: false, source: 'local' },
            { id: 'study', label: 'Study', name: 'Study', normalizedName: 'Study', parentId: null, archived: false, source: 'local' },
        ],
        normalizeActivityText(value) { return String(value || '').trim(); },
        groupActivityBoard(entries) { return controller.groupActivityBoard.call(this, entries); },
        repairPlannedActivityCatalogIdentity() {},
        positionInlinePlanDropdown() {},
    };
    globalThis.document = { createElement: createInlineSelectionNode, querySelector() { return null; } };
    try {
        controller.renderInlinePlanDropdownOptions.call(ctx);
        const workChip = findNode(board, (node) => node.dataset && node.dataset.activityId === 'work');
        assert.ok(workChip);
        assert.equal(workChip.dataset.draggableActivity, 'true');
        assert.equal(board.classList.contains('activity-chip-board-reorder-enabled'), true);
        assert.equal(ctx.inlinePlanChipEditMode || false, false);
        assert.equal(findNode(board, (node) => node.className === 'activity-chip-drag-handle'), null);
        assert.equal(findNode(actions, (node) => node.className === 'activity-chip-edit-mode-toggle'), null);
        assert.match(interactionsCss, /\.activity-chip-board-reorder-enabled\s*\{[\s\S]*touch-action:\s*pan-y;/);
        assert.match(interactionsCss, /\.activity-chip-board-reorder-enabled \.activity-chip\[data-draggable-activity="true"\]\s*\{[\s\S]*cursor:\s*grab;[\s\S]*touch-action:\s*none;/);
    } finally {
        globalThis.document = originalDocument;
    }
});


test('chipboard omits recent section and edit-mode guidance while usage metadata exists', () => {
    const originalDocument = globalThis.document;
    const board = createInlineSelectionNode('div');
    board.className = 'activity-chip-board';
    Object.defineProperty(board, 'innerHTML', {
        get() { return this._innerHTML || ''; },
        set(value) { this._innerHTML = value; this.children = []; },
    });
    board.classList.toggle = function toggle(className, force) {
        const has = this.contains(className);
        const next = typeof force === 'boolean' ? force : !has;
        if (next && !has) this.add(className);
        if (!next && has) this.remove(className);
        return next;
    };
    const actions = createInlineSelectionNode('div');
    actions.className = 'activity-chip-board-actions';
    Object.defineProperty(actions, 'innerHTML', {
        get() { return this._innerHTML || ''; },
        set(value) { this._innerHTML = value; this.children = []; },
    });
    const shell = createInlineSelectionNode('div');
    shell.querySelector = (selector) => selector === '.activity-chip-board-actions' ? actions : (selector === '.activity-chip-board' ? board : null);
    const searchInput = { value: 'e' };
    const dropdown = createInlineSelectionNode('div');
    dropdown.querySelector = (selector) => {
        if (selector === '.activity-chip-board-shell') return shell;
        if (selector === '.activity-chip-board') return board;
        if (selector === '.inline-plan-input') return searchInput;
        return null;
    };
    dropdown.classList.toggle = board.classList.toggle;
    const entries = [
        { id: 'parent', label: 'Parent', name: 'Parent', normalizedName: 'Parent', parentId: null, archived: false, pinned: false, source: 'local' },
        { id: 'parent-child', label: 'Child', name: 'Child', normalizedName: 'Child', parentId: 'parent', archived: false, pinned: false, source: 'local' },
        { id: 'pinned', label: 'Pinned', name: 'Pinned', normalizedName: 'Pinned', parentId: null, archived: false, pinned: true, source: 'local' },
        { id: 'recent', label: 'Recent', name: 'Recent', normalizedName: 'Recent', parentId: null, archived: false, pinned: false, usageCount: 4, lastUsedAt: '2026-06-01T00:00:00.000Z', source: 'local' },
    ];
    const ctx = {
        inlinePlanDropdown: dropdown,
        inlinePlanTarget: { startIndex: 0, endIndex: 0 },
        inlinePlanChipEditMode: true,
        plannedActivities: entries,
        normalizeActivityText(value) { return String(value || '').trim(); },
        groupActivityBoard(items) { return controller.groupActivityBoard.call(this, items); },
        repairPlannedActivityCatalogIdentity() {},
        positionInlinePlanDropdown() {},
    };
    globalThis.document = { createElement: createInlineSelectionNode, querySelector() { return null; } };
    try {
        controller.renderInlinePlanDropdownOptions.call(ctx);
        assert.equal(findNode(board, (node) => node.className === 'activity-chip-edit-hint'), null);
        assert.equal(findNode(board, (node) => node.className === 'activity-chip-board-note'), null);
        assert.equal(findNode(board, (node) => node.dataset && node.dataset.boardSection === 'recent'), null);
        assert.equal(findNode(board, (node) => node.className === 'activity-chip-drag-handle'), null);
        const parentChip = findNode(board, (node) => node.dataset && node.dataset.boardSection === 'parents' && node.dataset.activityId === 'parent');
        const metadataChip = findNode(board, (node) => node.dataset && node.dataset.boardSection === 'parents' && node.dataset.activityId === 'recent');
        assert.equal(parentChip.dataset.draggableActivity, 'true');
        assert.equal(metadataChip.dataset.draggableActivity, 'true');
    } finally {
        globalThis.document = originalDocument;
    }
});

test('chipboard drag creates preview and applies reorder from chip body without edit mode', () => {
    const originalDocument = globalThis.document;
    const board = createInlineSelectionNode('div');
    board.className = 'activity-chip-board';
    Object.defineProperty(board, 'innerHTML', {
        get() {
            return this._innerHTML || '';
        },
        set(value) {
            this._innerHTML = value;
            this.children = [];
        },
    });
    board.classList.toggle = function toggle(className, force) {
        const has = this.contains(className);
        const next = typeof force === 'boolean' ? force : !has;
        if (next && !has) this.add(className);
        if (!next && has) this.remove(className);
        return next;
    };
    const actions = createInlineSelectionNode('div');
    actions.className = 'activity-chip-board-actions';
    Object.defineProperty(actions, 'innerHTML', {
        get() {
            return this._innerHTML || '';
        },
        set(value) {
            this._innerHTML = value;
            this.children = [];
        },
    });
    const shell = createInlineSelectionNode('div');
    shell.querySelector = (selector) => {
        if (selector === '.activity-chip-board-actions') return actions;
        if (selector === '.activity-chip-board') return board;
        return null;
    };
    const searchInput = { value: '' };
    const body = {
        children: [],
        appendChild(node) {
            this.children.push(node);
            node.parentNode = this;
        },
        removeChild(node) {
            this.children = this.children.filter((child) => child !== node);
            node.parentNode = null;
        },
        querySelector(selector) {
            if (selector !== '.activity-chip-drag-preview') return null;
            return this.children.find((child) => String(child.className || '').split(/\s+/).includes('activity-chip-drag-preview')) || null;
        },
    };
    const documentListeners = {};
    let rafCallback = null;
    let canceledFrame = null;
    const dropdown = createInlineSelectionNode('div');
    dropdown.querySelector = (selector) => {
        if (selector === '.activity-chip-board-shell') return shell;
        if (selector === '.activity-chip-board') return board;
        if (selector === '.inline-plan-input') return searchInput;
        return null;
    };
    dropdown.classList.toggle = function toggle(className, force) {
        const has = this.contains(className);
        const next = typeof force === 'boolean' ? force : !has;
        if (next && !has) this.add(className);
        if (!next && has) this.remove(className);
        return next;
    };
    const ctx = {
        inlinePlanDropdown: dropdown,
        inlinePlanTarget: { startIndex: 0, endIndex: 0 },
        plannedActivities: [
            { id: 'work', label: 'Work', name: 'Work', normalizedName: 'Work', parentId: null, archived: false, source: 'local' },
            { id: 'study', label: 'Study', name: 'Study', normalizedName: 'Study', parentId: null, archived: false, source: 'local' },
            { id: 'review', label: 'Review', name: 'Review', normalizedName: 'Review', parentId: null, archived: false, source: 'local' },
        ],
        normalizeActivityText(value) {
            return String(value || '').trim();
        },
        groupActivityBoard(entries) {
            return controller.groupActivityBoard.call(this, entries);
        },
        repairPlannedActivityCatalogIdentity() {},
        positionInlinePlanDropdown() {},
        applyActivityChipboardDrop(sourceId, intent) {
            this.lastDrop = { sourceId, intent };
            return { changed: true, status: intent.type === 'nest' ? 'nested' : 'reordered' };
        },
        validateActivityChipboardDrop() {
            return { valid: true, status: 'ok' };
        },
    };
    const documentStub = {
        createElement: createInlineSelectionNode,
        body,
        addEventListener(type, handler) {
            documentListeners[type] = handler;
        },
        removeEventListener() {},
        querySelector() {
            return null;
        },
        elementFromPoint() {
            return this._dropTarget || null;
        },
    };
    globalThis.document = documentStub;
    globalThis.window = {
        addEventListener() {},
        removeEventListener() {},
        visualViewport: null,
        requestAnimationFrame(callback) {
            rafCallback = callback;
            return 42;
        },
        cancelAnimationFrame(frame) {
            canceledFrame = frame;
        },
    };

    try {
        controller.renderInlinePlanDropdownOptions.call(ctx);

        const sourceChip = findNode(board, (node) => node.dataset && node.dataset.activityId === 'work');
        const targetChip = findNode(board, (node) => node.dataset && node.dataset.activityId === 'study');
        const autoTargetChip = findNode(board, (node) => node.dataset && node.dataset.activityId === 'review');
        const dragHandle = sourceChip;
        assert.ok(dragHandle);
        assert.equal(findNode(sourceChip, (node) => node.className === 'activity-chip-drag-handle'), null);
        sourceChip.ownerDocument = documentStub;
        targetChip.ownerDocument = documentStub;
        autoTargetChip.ownerDocument = documentStub;
        dragHandle.ownerDocument = documentStub;
        board.ownerDocument = documentStub;
        board.scrollTop = 80;
        board.scrollHeight = 600;
        board.clientHeight = 200;
        board.getBoundingClientRect = () => ({
            left: 0,
            top: 100,
            right: 360,
            bottom: 300,
            width: 360,
            height: 200,
        });
        documentStub._dropTarget = targetChip;
        dragHandle.closest = (selector) => {
            if (selector === '.activity-chip[data-activity-id]') return sourceChip;
            if (selector === '.activity-chip-board') return board;
            return null;
        };
        sourceChip.closest = (selector) => {
            if (selector === '.activity-chip-board') return board;
            if (selector === '.activity-chip[data-activity-id]') return sourceChip;
            return null;
        };
        sourceChip.getBoundingClientRect = () => ({
            left: 80,
            top: 100,
            right: 172,
            bottom: 138,
            width: 92,
            height: 38,
        });
        targetChip.closest = (selector) => {
            if (selector === '.activity-chip[data-activity-id]') return targetChip;
            if (selector === '.activity-chip-board') return board;
            return null;
        };
        targetChip.getBoundingClientRect = () => ({
            left: 200,
            top: 112,
            right: 248,
            bottom: 150,
            width: 48,
            height: 38,
        });
        autoTargetChip.closest = (selector) => {
            if (selector === '.activity-chip[data-activity-id]') return autoTargetChip;
            if (selector === '.activity-chip-board') return board;
            return null;
        };
        autoTargetChip.getBoundingClientRect = () => ({
            left: 196,
            top: 180,
            right: 260,
            bottom: 218,
            width: 64,
            height: 38,
        });

        dragHandle.dispatchEvent({
            type: 'pointerdown',
            button: 0,
            pointerId: 11,
            clientX: 100,
            clientY: 120,
            cancelable: true,
            preventDefault() {},
            stopPropagation() {},
            target: dragHandle,
        });

        assert.equal(ctx.inlinePlanChipDragPreview || null, null);
        assert.equal(body.querySelector('.activity-chip-drag-preview'), null);
        assert.equal(ctx.inlinePlanChipDragState.active, false);
        assert.equal(sourceChip.classList.contains('activity-chip-drag-pending'), true);
        assert.equal(sourceChip.classList.contains('activity-chip-dragging'), false);
        assert.equal(board.classList.contains('activity-chip-board-drag-active'), false);

        documentListeners.pointermove({
            type: 'pointermove',
            pointerId: 11,
            clientX: 102,
            clientY: 122,
            cancelable: true,
            preventDefault() {},
            stopPropagation() {},
            target: board.children[1],
        });

        assert.equal(ctx.inlinePlanChipDragPreview || null, null);
        assert.equal(body.querySelector('.activity-chip-drag-preview'), null);
        assert.equal(ctx.inlinePlanChipDragState.active, false);
        assert.equal(sourceChip.classList.contains('activity-chip-drag-pending'), true);

        documentListeners.pointermove({
            type: 'pointermove',
            pointerId: 11,
            clientX: 220,
            clientY: 160,
            cancelable: true,
            preventDefault() {},
            stopPropagation() {},
            target: board.children[1],
        });

        assert.ok(ctx.inlinePlanChipDragPreview);
        assert.equal(body.querySelector('.activity-chip-drag-preview'), ctx.inlinePlanChipDragPreview);
        assert.equal(ctx.inlinePlanChipDragPreview.className, 'activity-chip-drag-preview');
        assert.equal(ctx.inlinePlanChipDragPreview.style.width, '92px');
        assert.equal(ctx.inlinePlanChipDragPreview.style.height, '38px');
        assert.equal(collectNodeText(ctx.inlinePlanChipDragPreview).includes('Work'), true);
        assert.match(ctx.inlinePlanChipDragPreview.style.transform, /translate3d\(/);
        assert.equal(sourceChip.classList.contains('activity-chip-drag-pending'), false);
        assert.equal(sourceChip.classList.contains('activity-chip-dragging'), true);
        assert.equal(board.classList.contains('activity-chip-board-drag-active'), true);
        assert.equal(targetChip.classList.contains('activity-chip-drop-nest'), true);
        assert.equal(targetChip.dataset.chipDropIntent, 'nest');
        assert.equal(targetChip.dataset.chipDropLabel, '하위로 넣기');
        assert.equal(findNode(targetChip, (node) => node.className === 'activity-chip-drop-label activity-chip-drop-label-nest').textContent, '하위로 넣기');
        assert.match(interactionsCss, /\.activity-chip-drag-preview\s*\{[\s\S]*position:\s*fixed;/);
        assert.match(interactionsCss, /\.activity-chip-drag-preview\s*\{[\s\S]*pointer-events:\s*none;/);
        assert.match(interactionsCss, /\.activity-chip-drag-preview\s*\{[\s\S]*z-index:\s*2147483647;/);
        assert.match(interactionsCss, /\.activity-chip-drop-label\s*\{[\s\S]*pointer-events:\s*none;/);
        assert.match(interactionsCss, /\.activity-chip-drop-label\s*\{[\s\S]*top:\s*3px;/);
        assert.match(interactionsCss, /\.activity-chip-drag-pending\s*\{[\s\S]*border-color:\s*#93c5fd;/);
        assert.match(interactionsCss, /\.activity-chip-dragging\s*\{[\s\S]*opacity:\s*0\.72;/);

        const firstTransform = ctx.inlinePlanChipDragPreview.style.transform;
        documentListeners.pointermove({
            type: 'pointermove',
            pointerId: 11,
            clientX: 230,
            clientY: 160,
            cancelable: true,
            preventDefault() {},
            stopPropagation() {},
            target: board.children[1],
        });

        const preview = ctx.inlinePlanChipDragPreview;
        assert.match(preview.style.transform, /translate3d\(\d+px, \d+px, 0\)/);
        assert.notEqual(preview.style.transform, firstTransform);

        documentListeners.pointermove({
            type: 'pointermove',
            pointerId: 11,
            clientX: 205,
            clientY: 160,
            cancelable: true,
            preventDefault() {},
            stopPropagation() {},
            target: board.children[1],
        });
        assert.equal(targetChip.classList.contains('activity-chip-drop-before'), true);
        assert.equal(targetChip.dataset.chipDropIntent, 'before');
        assert.equal(targetChip.dataset.chipDropLabel, '앞에 배치');

        documentListeners.pointermove({
            type: 'pointermove',
            pointerId: 11,
            clientX: 244,
            clientY: 160,
            cancelable: true,
            preventDefault() {},
            stopPropagation() {},
            target: board.children[1],
        });
        assert.equal(targetChip.classList.contains('activity-chip-drop-after'), true);
        assert.equal(targetChip.dataset.chipDropIntent, 'after');
        assert.equal(targetChip.dataset.chipDropLabel, '뒤에 배치');

        rafCallback = null;
        documentListeners.pointermove({
            type: 'pointermove',
            pointerId: 11,
            clientX: 220,
            clientY: 292,
            cancelable: true,
            preventDefault() {},
            stopPropagation() {},
            target: board,
        });
        assert.equal(typeof rafCallback, 'function');
        const beforeScrollTop = board.scrollTop;
        documentStub._dropTarget = autoTargetChip;
        rafCallback();
        assert.ok(board.scrollTop > beforeScrollTop);
        assert.equal(ctx.inlinePlanChipDragState.intent.targetId, 'review');
        assert.equal(autoTargetChip.classList.contains('activity-chip-drop-nest'), true);
        assert.equal(autoTargetChip.dataset.chipDropIntent, 'nest');

        documentStub._dropTarget = sourceChip;
        documentListeners.pointermove({
            type: 'pointermove',
            pointerId: 11,
            clientX: 120,
            clientY: 160,
            cancelable: true,
            preventDefault() {},
            stopPropagation() {},
            target: sourceChip,
        });
        assert.equal(sourceChip.classList.contains('activity-chip-drop-invalid'), true);
        assert.equal(sourceChip.dataset.chipDropIntent, 'invalid');
        assert.equal(sourceChip.dataset.chipDropLabel, '불가');

        documentListeners.pointercancel({
            type: 'pointercancel',
            pointerId: 11,
            stopPropagation() {},
        });
        assert.equal(canceledFrame, 42);
        assert.equal(ctx.inlinePlanChipDragState, null);
        assert.equal(ctx.inlinePlanChipDragPreview, null);
        assert.equal(body.querySelector('.activity-chip-drag-preview'), null);
        assert.equal(sourceChip.classList.contains('activity-chip-drag-pending'), false);
        assert.equal(sourceChip.classList.contains('activity-chip-dragging'), false);
        assert.equal(sourceChip.classList.contains('activity-chip-drop-invalid'), false);
        assert.equal(targetChip.dataset.chipDropLabel, undefined);
        assert.equal(sourceChip.dataset.chipDropLabel, undefined);

        documentStub._dropTarget = targetChip;
        dragHandle.dispatchEvent({
            type: 'pointerdown',
            button: 0,
            pointerId: 12,
            clientX: 104,
            clientY: 119,
            cancelable: true,
            preventDefault() {},
            stopPropagation() {},
            target: dragHandle,
        });
        assert.equal(body.querySelector('.activity-chip-drag-preview'), null);
        documentListeners.pointermove({
            type: 'pointermove',
            pointerId: 12,
            clientX: 220,
            clientY: 160,
            cancelable: true,
            preventDefault() {},
            stopPropagation() {},
            target: board.children[1],
        });
        assert.ok(body.querySelector('.activity-chip-drag-preview'));
        documentListeners.keydown({
            type: 'keydown',
            key: 'Escape',
            stopPropagation() {},
        });
        assert.equal(ctx.inlinePlanChipDragState, null);
        assert.equal(body.querySelector('.activity-chip-drag-preview'), null);

        dragHandle.dispatchEvent({
            type: 'pointerdown',
            button: 0,
            pointerId: 13,
            clientX: 104,
            clientY: 119,
            cancelable: true,
            preventDefault() {},
            stopPropagation() {},
            target: dragHandle,
        });
        documentListeners.pointermove({
            type: 'pointermove',
            pointerId: 13,
            clientX: 220,
            clientY: 160,
            cancelable: true,
            preventDefault() {},
            stopPropagation() {},
            target: board.children[1],
        });
        documentListeners.pointerup({
            type: 'pointerup',
            pointerId: 13,
            clientX: 220,
            clientY: 160,
            cancelable: true,
            preventDefault() {},
            stopPropagation() {},
            target: board.children[1],
        });

        assert.equal(ctx.inlinePlanChipDragState, null);
        assert.equal(ctx.inlinePlanChipDragPreview, null);
        assert.equal(ctx.plannedActivities.find((item) => item.id === 'work').parentId, 'study');
        assert.equal(body.children.length, 0);
        assert.equal(board.classList.contains('activity-chip-board-drag-active'), false);
        assert.equal(sourceChip.classList.contains('activity-chip-dragging'), false);

        dragHandle.dispatchEvent({
            type: 'pointerdown',
            button: 0,
            pointerId: 14,
            clientX: 104,
            clientY: 119,
            cancelable: true,
            preventDefault() {},
            stopPropagation() {},
            target: dragHandle,
        });
        assert.equal(sourceChip.classList.contains('activity-chip-drag-pending'), true);
        documentListeners.pointerup({
            type: 'pointerup',
            pointerId: 14,
            clientX: 105,
            clientY: 120,
            cancelable: true,
            preventDefault() {},
            stopPropagation() {},
            target: sourceChip,
        });
        assert.equal(ctx.inlinePlanChipDragState, null);
        assert.equal(sourceChip.classList.contains('activity-chip-drag-pending'), false);
        assert.equal(sourceChip.classList.contains('activity-chip-dragging'), false);

        documentStub._dropTarget = targetChip;
        dragHandle.dispatchEvent({
            type: 'pointerdown',
            button: 0,
            pointerId: 15,
            clientX: 104,
            clientY: 119,
            cancelable: true,
            preventDefault() {},
            stopPropagation() {},
            target: dragHandle,
        });
        documentListeners.pointermove({
            type: 'pointermove',
            pointerId: 15,
            clientX: 244,
            clientY: 160,
            cancelable: true,
            preventDefault() {},
            stopPropagation() {},
            target: board.children[1],
        });
        assert.equal(ctx.inlinePlanChipDragState.active, true);
        documentListeners.pointercancel({
            type: 'pointercancel',
            pointerId: 15,
            stopPropagation() {},
        });
        assert.equal(ctx.inlinePlanChipDragState, null);
        assert.equal(sourceChip.classList.contains('activity-chip-drag-pending'), false);
        assert.equal(sourceChip.classList.contains('activity-chip-dragging'), false);
    } finally {
        globalThis.document = originalDocument;
    }
});

test('normal activity chip click still selects when edit mode is off', () => {
    const harness = createInlineSelectionHarness({
        plannedActivities: [
            { id: 'work', label: 'Work', name: 'Work', normalizedName: 'Work', parentId: null, archived: false, source: 'local' },
        ],
    });
    const chipButton = renderInlineSelectionChip(harness, 'Work');

    dispatchInlineSelectionClick(chipButton);

    assert.equal(harness.ctx.timeSlots[0].planned, 'Work');
    assert.equal(harness.ctx.timeSlots[0].planActivities[0].activityId, 'work');
});

test('chip drag cleanup clears stale document-wide artifacts idempotently', () => {
    const sourceChip = createInlineSelectionNode('span');
    sourceChip.className = 'activity-chip activity-chip-drag-pending activity-chip-dragging activity-chip-drop-invalid';
    sourceChip.dataset.chipDropLabel = 'invalid';
    sourceChip.dataset.chipDropIntent = 'invalid';
    const detachedTarget = createInlineSelectionNode('span');
    detachedTarget.className = 'activity-chip activity-chip-drop-after';
    detachedTarget.dataset.chipDropLabel = 'after';
    detachedTarget.dataset.chipDropIntent = 'after';
    const board = createInlineSelectionNode('div');
    board.className = 'activity-chip-board activity-chip-board-drag-active';
    board.appendChild(sourceChip);
    const staleBoard = createInlineSelectionNode('div');
    staleBoard.className = 'activity-chip-board-drag-active';
    const staleLabel = createInlineSelectionNode('span');
    staleLabel.className = 'activity-chip-drop-label';
    staleBoard.appendChild(staleLabel);
    const preview = createInlineSelectionNode('div');
    preview.className = 'activity-chip-drag-preview';
    const extraPreview = createInlineSelectionNode('div');
    extraPreview.className = 'activity-chip-drag-preview';
    const removed = [];
    [preview, extraPreview, staleLabel].forEach((node) => {
        node.parentNode = {
            removeChild(child) {
                removed.push(child);
            },
        };
    });
    const doc = {
        removeEventListener() {},
        querySelectorAll(selector) {
            if (selector === '.activity-chip-board-drag-active') return [board, staleBoard];
            if (selector === '.activity-chip-drag-pending, .activity-chip-dragging, .activity-chip-drop-before, .activity-chip-drop-after, .activity-chip-drop-nest, .activity-chip-drop-invalid') {
                return [sourceChip, detachedTarget];
            }
            if (selector === '.activity-chip-drop-label') return [staleLabel];
            if (selector === '.activity-chip-drag-preview') return [preview, extraPreview];
            return [];
        },
    };
    preview.ownerDocument = doc;
    extraPreview.ownerDocument = doc;
    const ctx = {
        inlinePlanDropdown: board,
        inlinePlanChipDragPreview: preview,
        inlinePlanChipDragState: {
            document: doc,
            window: { removeEventListener() {} },
            moveHandler() {},
            endHandler() {},
            cancelHandler() {},
            keyHandler() {},
            board,
            sourceChip,
            pointerId: 3,
            captureTarget: { releasePointerCapture() {} },
        },
    };

    controller.cleanupInlinePlanChipDragState.call(ctx);
    controller.cleanupInlinePlanChipDragState.call(ctx);

    assert.equal(ctx.inlinePlanChipDragState, null);
    assert.equal(ctx.inlinePlanChipDragPreview, null);
    assert.equal(board.classList.contains('activity-chip-board-drag-active'), false);
    assert.equal(staleBoard.classList.contains('activity-chip-board-drag-active'), false);
    assert.equal(sourceChip.classList.contains('activity-chip-drag-pending'), false);
    assert.equal(sourceChip.classList.contains('activity-chip-dragging'), false);
    assert.equal(sourceChip.classList.contains('activity-chip-drop-invalid'), false);
    assert.equal(detachedTarget.classList.contains('activity-chip-drop-after'), false);
    assert.equal(sourceChip.dataset.chipDropLabel, undefined);
    assert.equal(detachedTarget.dataset.chipDropIntent, undefined);
    assert.deepEqual(
        removed.map((node) => node.className).sort(),
        ['activity-chip-drag-preview', 'activity-chip-drag-preview', 'activity-chip-drop-label'].sort()
    );
});

function createChipboardDropHarness() {
    const saves = [];
    const ctx = {
        plannedActivities: [
            { id: 'a', label: 'A', name: 'A', normalizedName: 'A', parentId: null, archived: false, source: 'local', boardOrder: 0 },
            { id: 'b', label: 'B', name: 'B', normalizedName: 'B', parentId: null, archived: false, source: 'local', boardOrder: 1 },
            { id: 'c', label: 'C', name: 'C', normalizedName: 'C', parentId: null, archived: false, source: 'local', boardOrder: 2 },
        ],
        normalizeActivityText(value) {
            return String(value || '').trim();
        },
        dedupeAndSortPlannedActivities() {
            this.plannedActivities = this.plannedActivities.slice().sort((left, right) => {
                const lp = String(left.parentId || '');
                const rp = String(right.parentId || '');
                if (lp !== rp) return lp.localeCompare(rp);
                const lo = Number.isFinite(left.boardOrder) ? left.boardOrder : Infinity;
                const ro = Number.isFinite(right.boardOrder) ? right.boardOrder : Infinity;
                if (lo !== ro) return lo - ro;
                return String(left.label || '').localeCompare(String(right.label || ''));
            });
        },
        savePlannedActivities() {
            saves.push(this.plannedActivities.map((item) => ({ id: item.id, parentId: item.parentId || null, boardOrder: item.boardOrder })));
        },
        renderPlannedActivityDropdown() {},
        refreshSubActivityOptions() {},
    };
    return { ctx, saves };
}

test('dragging a chip between chips reorders persisted board order', () => {
    const { ctx, saves } = createChipboardDropHarness();

    const result = controller.applyActivityChipboardDrop.call(ctx, 'c', { type: 'reorder', placement: 'before', targetId: 'a' });

    assert.equal(result.status, 'reordered');
    assert.deepEqual(ctx.plannedActivities.filter((item) => !item.parentId).map((item) => item.id), ['c', 'a', 'b']);
    assert.deepEqual(ctx.plannedActivities.map((item) => [item.id, item.boardOrder]), [['c', 0], ['a', 1], ['b', 2]]);
    assert.equal(saves.length, 1);
});

test('dropping a chip where it already is does not save or create undo', () => {
    const { ctx, saves } = createChipboardDropHarness();

    const result = controller.applyActivityChipboardDrop.call(ctx, 'a', { type: 'reorder', placement: 'before', targetId: 'b' });

    assert.equal(result.changed, false);
    assert.equal(result.status, 'no-op');
    assert.equal(saves.length, 0);
    assert.equal(ctx.inlinePlanChipUndoState || null, null);
    assert.deepEqual(ctx.plannedActivities.map((item) => [item.id, item.parentId || null, item.boardOrder]), [
        ['a', null, 0],
        ['b', null, 1],
        ['c', null, 2],
    ]);
});

test('dragging a chip onto another chip creates a parent-child relationship', () => {
    const { ctx } = createChipboardDropHarness();

    const result = controller.applyActivityChipboardDrop.call(ctx, 'b', { type: 'nest', targetId: 'a' });

    assert.equal(result.status, 'nested');
    const child = ctx.plannedActivities.find((item) => item.id === 'b');
    assert.equal(child.parentId, 'a');
    assert.equal(child.boardOrder, 0);
    assert.deepEqual(ctx.plannedActivities.filter((item) => !item.parentId).map((item) => item.id), ['a', 'c']);
});

test('chipboard drop undo restores the previous plannedActivities and disappears after use', () => {
    const originalDocument = globalThis.document;
    const { ctx, saves } = createChipboardDropHarness();
    const board = createInlineSelectionNode('div');
    board.className = 'activity-chip-board';
    Object.defineProperty(board, 'innerHTML', {
        get() {
            return this._innerHTML || '';
        },
        set(value) {
            this._innerHTML = value;
            this.children = [];
        },
    });
    const actions = createInlineSelectionNode('div');
    actions.className = 'activity-chip-board-actions';
    Object.defineProperty(actions, 'innerHTML', {
        get() {
            return this._innerHTML || '';
        },
        set(value) {
            this._innerHTML = value;
            this.children = [];
        },
    });
    const shell = createInlineSelectionNode('div');
    shell.querySelector = (selector) => {
        if (selector === '.activity-chip-board-actions') return actions;
        if (selector === '.activity-chip-board') return board;
        return null;
    };
    const searchInput = { value: '' };
    const dropdown = createInlineSelectionNode('div');
    dropdown.querySelector = (selector) => {
        if (selector === '.activity-chip-board-shell') return shell;
        if (selector === '.activity-chip-board') return board;
        if (selector === '.inline-plan-input') return searchInput;
        return null;
    };
    ctx.inlinePlanDropdown = dropdown;
    ctx.inlinePlanTarget = { startIndex: 0, endIndex: 0 };
    ctx.groupActivityBoard = function groupActivityBoard(entries) {
        return controller.groupActivityBoard.call(this, entries);
    };
    ctx.positionInlinePlanDropdown = function positionInlinePlanDropdown() {};

    globalThis.document = {
        createElement: createInlineSelectionNode,
        querySelector() {
            return null;
        },
    };

    try {
        controller.applyActivityChipboardDrop.call(ctx, 'c', { type: 'reorder', placement: 'before', targetId: 'a' });
        controller.renderInlinePlanDropdownOptions.call(ctx);

        assert.deepEqual(ctx.plannedActivities.filter((item) => !item.parentId).map((item) => item.id), ['c', 'a', 'b']);
        const undo = findNode(board, (node) => node.className === 'activity-chip-undo-toast');
        assert.ok(undo);
        assert.equal(undo.textContent, '이동됨 · 되돌리기');

        undo.dispatchEvent({
            type: 'click',
            preventDefault() {},
            stopPropagation() {},
        });

        assert.deepEqual(ctx.plannedActivities.filter((item) => !item.parentId).map((item) => item.id), ['a', 'b', 'c']);
        assert.equal(saves.length, 2);
        assert.equal(ctx.inlinePlanDropdown, dropdown);
        assert.equal(ctx.inlinePlanChipUndoState, null);
        assert.equal(findNode(board, (node) => node.className === 'activity-chip-undo-toast'), null);
    } finally {
        controller.restoreInlinePlanChipUndoState.call(ctx);
        globalThis.document = originalDocument;
    }
});

test('chipboard undo snapshot is replaced by a subsequent mutation', () => {
    const { ctx } = createChipboardDropHarness();

    controller.applyActivityChipboardDrop.call(ctx, 'c', { type: 'reorder', placement: 'before', targetId: 'a' });
    const firstUndoState = ctx.inlinePlanChipUndoState;
    controller.applyActivityChipboardDrop.call(ctx, 'b', { type: 'nest', targetId: 'a' });

    assert.ok(firstUndoState);
    assert.notEqual(ctx.inlinePlanChipUndoState, firstUndoState);
    assert.equal(ctx.plannedActivities.find((item) => item.id === 'b').parentId, 'a');

    controller.restoreInlinePlanChipUndoState.call(ctx);

    assert.deepEqual(ctx.plannedActivities.filter((item) => !item.parentId).map((item) => item.id), ['c', 'a', 'b']);
    assert.equal(ctx.plannedActivities.find((item) => item.id === 'b').parentId, null);
    assert.equal(ctx.inlinePlanChipUndoState, null);
});

test('invalid chipboard nesting rejects self, circular, and parent-into-descendant drops', () => {
    const { ctx } = createChipboardDropHarness();
    controller.applyActivityChipboardDrop.call(ctx, 'b', { type: 'nest', targetId: 'a' });

    assert.equal(controller.validateActivityChipboardDrop.call(ctx, 'a', { type: 'nest', targetId: 'a' }).status, 'self');
    assert.equal(controller.validateActivityChipboardDrop.call(ctx, 'a', { type: 'nest', targetId: 'b' }).valid, false);
    assert.equal(controller.applyActivityChipboardDrop.call(ctx, 'a', { type: 'nest', targetId: 'b' }).changed, false);
    assert.equal(ctx.plannedActivities.find((item) => item.id === 'a').parentId, null);
});

test('dropdown rerender preserves nested and reordered chipboard state and only child parents show carets', () => {
    const originalDocument = globalThis.document;
    const { ctx } = createChipboardDropHarness();
    controller.applyActivityChipboardDrop.call(ctx, 'c', { type: 'reorder', placement: 'before', targetId: 'a' });
    controller.applyActivityChipboardDrop.call(ctx, 'b', { type: 'nest', targetId: 'a' });

    const board = {
        children: [],
        _innerHTML: '',
        set innerHTML(value) {
            this._innerHTML = value;
            this.children = [];
        },
        get innerHTML() {
            return this._innerHTML;
        },
        appendChild(node) {
            this.children.push(node);
            return node;
        },
    };
    const searchInput = { value: '' };
    ctx.inlinePlanDropdown = {
        querySelector(selector) {
            if (selector === '.activity-chip-board') return board;
            if (selector === '.inline-plan-input') return searchInput;
            return null;
        },
    };
    ctx.inlinePlanTarget = { startIndex: 0, endIndex: 0 };
    ctx.groupActivityBoard = function groupActivityBoard(entries) {
        return controller.groupActivityBoard.call(this, entries);
    };
    ctx.positionInlinePlanDropdown = function positionInlinePlanDropdown() {};

    globalThis.document = { createElement: createInlineSelectionNode };

    try {
        controller.renderInlinePlanDropdownOptions.call(ctx);
        controller.renderInlinePlanDropdownOptions.call(ctx);

        const chipC = findNode(board, (node) => node.dataset && node.dataset.activityId === 'c');
        const chipA = findNode(board, (node) => node.dataset && node.dataset.activityId === 'a');
        assert.ok(chipC);
        assert.ok(chipA);
        assert.equal(chipA.className, 'activity-chip activity-chip-parent activity-chip-split');
        assert.ok(chipA.children.some((node) => node.className === 'activity-chip-caret'));
        assert.equal(chipC.className, 'activity-chip');
        assert.equal(chipC.children.some((node) => node.className === 'activity-chip-caret'), false);
    } finally {
        globalThis.document = originalDocument;
    }
});

test('delete mode chip delete button removes activity catalog entries without touching planned segments', () => {
    const originalDocument = globalThis.document;
    const board = {
        children: [],
        _innerHTML: '',
        set innerHTML(value) {
            this._innerHTML = value;
            this.children = [];
        },
        get innerHTML() {
            return this._innerHTML;
        },
        appendChild(node) {
            this.children.push(node);
            return node;
        },
    };
    const actions = {
        children: [],
        _innerHTML: '',
        set innerHTML(value) {
            this._innerHTML = value;
            this.children = [];
        },
        get innerHTML() {
            return this._innerHTML;
        },
        appendChild(node) {
            this.children.push(node);
            return node;
        },
    };
    const shell = {
        querySelector(selector) {
            if (selector === '.activity-chip-board-actions') return actions;
            return null;
        },
    };
    const searchInput = { value: '' };
    const dropdown = {
        classList: {
            toggle() {},
            contains() { return false; },
        },
        querySelector(selector) {
            if (selector === '.activity-chip-board-shell') return shell;
            if (selector === '.activity-chip-board') return board;
            if (selector === '.inline-plan-input') return searchInput;
            return null;
        },
    };
    const removedSegments = [];
    const saveCalls = [];
    const ctx = {
        inlinePlanDropdown: dropdown,
        inlinePlanTarget: { startIndex: 0, endIndex: 0 },
        inlinePlanChipDeleteMode: true,
        timeSlots: [{ planned: '운동', planActivities: [{ label: '운동', activityId: 'exercise' }] }],
        plannedActivities: [
            { id: 'exercise', name: '운동', label: '운동', normalizedName: '운동', parentId: null, pinned: true, archived: false, source: 'local' },
            { id: 'exercise-child', name: '보조', label: '보조', normalizedName: '보조', parentId: 'exercise', pinned: false, archived: false, source: 'local' },
        ],
        normalizeActivityText(value) {
            return String(value || '').trim();
        },
        groupActivityBoard(entries) {
            return controller.groupActivityBoard.call(this, entries);
        },
        repairPlannedActivityCatalogIdentity() {},
        renderTimeEntries() {},
        calculateTotals() {},
        autoSave() {},
        positionInlinePlanDropdown() {},
        dedupeAndSortPlannedActivities() {},
        savePlannedActivities() {
            saveCalls.push('save');
        },
        renderPlannedActivityDropdown() {},
        refreshSubActivityOptions() {},
        removePlanActivitiesByLabel() {
            removedSegments.push('segment');
            return true;
        },
    };
    globalThis.document = {
        createElement: createInlineSelectionNode,
        querySelector() {
            return null;
        },
    };

    try {
        controller.renderInlinePlanDropdownOptions.call(ctx);
        const chip = board.children.find((node) => String(node.className || '').includes('activity-chip'));
        const deleteBtn = findNode(chip, (node) => node.className === 'activity-chip-delete');
        assert.ok(deleteBtn);

        deleteBtn.dispatchEvent({
            type: 'click',
            preventDefault() {},
            stopPropagation() {},
        });

        assert.equal(ctx.plannedActivities.some((item) => item.id === 'exercise'), false);
        assert.equal(ctx.plannedActivities.some((item) => item.id === 'exercise-child'), false);
        assert.equal(removedSegments.length, 0);
        assert.equal(saveCalls.length > 0, true);
    } finally {
        globalThis.document = originalDocument;
    }
});

test('delete mode chip main click does not insert or select activity', () => {
    const harness = createInlineSelectionHarness({
        inlinePlanTarget: { startIndex: 0, endIndex: 0, mode: 'plan-segment-replace', segmentIndex: 0 },
        plannedActivities: [
            { id: 'fill', name: 'Fill', label: 'Fill', normalizedName: 'Fill', parentId: null, pinned: true, archived: false },
        ],
        ctx: {
            inlinePlanChipDeleteMode: true,
        },
    });
    let replaceCalls = 0;
    harness.ctx.replacePlanSegmentActivity = () => {
        replaceCalls += 1;
        return true;
    };
    const chipButton = renderInlineSelectionChip(harness);

    dispatchInlineSelectionClick(chipButton);

    assert.equal(replaceCalls, 0);
    assert.equal(harness.ctx.timeSlots[0].planActivities[0].label, 'A');
    assert.equal(harness.ctx.inlinePlanTarget.mode, 'plan-segment-replace');
});

test('activity chip selection uses virtual rest inline target before selected segment replacement', () => {
    const harness = createInlineSelectionHarness({
        selectedPlanSegment: { baseIndex: 0, segmentIndex: 0 },
        inlinePlanTarget: {
            startIndex: 0,
            endIndex: 0,
            mode: 'virtual-rest-gap',
            gapStartMinute: 20,
            gapDurationMinutes: 20,
        },
    });
    let replacementCalls = 0;
    harness.ctx.replaceSelectedPlanSegmentActivity = () => {
        replacementCalls += 1;
        return true;
    };
    const chipButton = renderInlineSelectionChip(harness);

    dispatchInlineSelectionClick(chipButton);

    assert.equal(replacementCalls, 0);
    assert.equal(harness.ctx.timeSlots[0].planActivities[0].label, 'A');
    assert.equal(harness.ctx.timeSlots[0].planActivities[1].label, 'Fill');
    assert.equal(harness.ctx.timeSlots[0].planActivities[1].seconds, 1200);
});

test('activity chip selection replaces selected segment only when inline target is inactive', () => {
    const harness = createInlineSelectionHarness({
        inlinePlanTarget: { startIndex: 0, endIndex: 0 },
        selectedPlanSegment: { baseIndex: 0, segmentIndex: 1 },
        timeSlots: [
            {
                planned: 'A, B',
                planTitle: '',
                planTitleBandOn: false,
                planActivities: [
                    { label: 'A', activityText: 'A', activityId: 'a', seconds: 1200, startMinute: 0, endMinute: 20, durationMinutes: 20 },
                    { label: 'B', activityText: 'B', activityId: 'b', seconds: 2400, startMinute: 20, endMinute: 60, durationMinutes: 40 },
                ],
            },
        ],
    });
    let replacementCalls = 0;
    harness.ctx.replaceSelectedPlanSegmentActivity = (activityItem) => {
        replacementCalls += 1;
        const segment = harness.ctx.timeSlots[0].planActivities[1];
        harness.ctx.timeSlots[0].planActivities[1] = {
            ...segment,
            label: activityItem.label,
            activityText: activityItem.label,
            activityId: activityItem.id,
        };
        return true;
    };
    const chipButton = renderInlineSelectionChip(harness);
    harness.ctx.inlinePlanTarget = null;

    dispatchInlineSelectionClick(chipButton);

    assert.equal(replacementCalls, 1);
    assert.deepEqual(harness.ctx.timeSlots[0].planActivities.map((item) => ({
        label: item.label,
        activityText: item.activityText,
        activityId: item.activityId,
        startMinute: item.startMinute,
        endMinute: item.endMinute,
        durationMinutes: item.durationMinutes,
        seconds: item.seconds,
    })), [
        { label: 'A', activityText: 'A', activityId: 'a', startMinute: 0, endMinute: 20, durationMinutes: 20, seconds: 1200 },
        { label: 'Fill', activityText: 'Fill', activityId: 'fill', startMinute: 20, endMinute: 60, durationMinutes: 40, seconds: 2400 },
    ]);
});

test('activity chip selection replaces plan segment inline target only', () => {
    const harness = createInlineSelectionHarness({
        inlinePlanTarget: {
            startIndex: 0,
            endIndex: 0,
            mode: 'plan-segment-replace',
            segmentIndex: 1,
            segmentId: 'planned-0-1',
            anchor: {},
        },
        timeSlots: [
            {
                planned: '샤워, 이동/저녁준비',
                planTitle: '',
                planTitleBandOn: false,
                planActivities: [
                    { label: '샤워', activityText: '샤워', activityId: 'shower', seconds: 1200, startMinute: 0, endMinute: 20, durationMinutes: 20 },
                    { label: '이동/저녁준비', activityText: '이동/저녁준비', activityId: 'prep', seconds: 2400, startMinute: 20, endMinute: 60, durationMinutes: 40 },
                ],
            },
        ],
        plannedActivities: [
            { id: 'study', name: '공부', label: '공부', normalizedName: '공부', parentId: null, pinned: true, archived: false },
        ],
        ctx: {
            replacePlanSegmentActivity(baseIndex, segmentIndex, activityItem, parentItem = null) {
                assert.equal(baseIndex, 0);
                assert.equal(segmentIndex, 1);
                assert.equal(parentItem, null);
                const current = this.timeSlots[baseIndex].planActivities[segmentIndex];
                this.timeSlots[baseIndex].planActivities[segmentIndex] = {
                    ...current,
                    label: activityItem.label,
                    activityText: activityItem.label,
                    activityId: activityItem.id,
                };
                this.timeSlots[baseIndex].planned = this.formatActivitiesSummary(this.timeSlots[baseIndex].planActivities);
                return true;
            },
        },
    });
    const chipButton = renderInlineSelectionChip(harness, '공부');
    harness.calls.length = 0;

    dispatchInlineSelectionClick(chipButton);

    assert.deepEqual(harness.ctx.timeSlots[0].planActivities.map((item) => ({
        label: item.label,
        activityText: item.activityText,
        activityId: item.activityId,
        startMinute: item.startMinute,
        endMinute: item.endMinute,
        durationMinutes: item.durationMinutes,
        seconds: item.seconds,
    })), [
        { label: '샤워', activityText: '샤워', activityId: 'shower', startMinute: 0, endMinute: 20, durationMinutes: 20, seconds: 1200 },
        { label: '공부', activityText: '공부', activityId: 'study', startMinute: 20, endMinute: 60, durationMinutes: 40, seconds: 2400 },
    ]);
    assert.deepEqual(harness.calls, [['render', true], ['totals'], ['save'], ['close']]);
    assert.equal(harness.ctx.inlinePlanTarget, null);
    assert.equal(harness.ctx.selectedPlanSegment, null);
});

test('inline text add applies plan segment target without whole-slot replacement', () => {
    const harness = createInlineSelectionHarness({
        inlinePlanTarget: {
            startIndex: 0,
            endIndex: 0,
            mode: 'plan-segment-replace',
            segmentIndex: 1,
            segmentId: 'planned-0-1',
            anchor: {},
        },
        selectedPlanSegment: { baseIndex: 0, segmentIndex: 1 },
        timeSlots: [
            {
                planned: '샤워, 이동/저녁준비',
                planTitle: '',
                planTitleBandOn: false,
                planActivities: [
                    { label: '샤워', activityText: '샤워', activityId: 'shower', seconds: 1200, startMinute: 0, endMinute: 20, durationMinutes: 20 },
                    { label: '이동/저녁준비', activityText: '이동/저녁준비', activityId: 'prep', seconds: 2400, startMinute: 20, endMinute: 60, durationMinutes: 40 },
                ],
            },
        ],
        plannedActivities: [
            { id: 'reading', name: '독서', label: '독서', normalizedName: '독서', parentId: null, pinned: true, archived: false },
        ],
        ctx: {
            replacePlanSegmentActivity(baseIndex, segmentIndex, activityItem) {
                const current = this.timeSlots[baseIndex].planActivities[segmentIndex];
                this.timeSlots[baseIndex].planActivities[segmentIndex] = {
                    ...current,
                    label: activityItem.label,
                    activityText: activityItem.label,
                    activityId: activityItem.id || null,
                };
                this.timeSlots[baseIndex].planned = this.formatActivitiesSummary(this.timeSlots[baseIndex].planActivities);
                return true;
            },
            closeInlinePlanDropdown() {
                this.selectedPlanSegment = null;
                this.inlinePlanTarget = null;
                harness.calls.push(['close']);
            },
        },
    });

    applyInlinePlanSelectionWrapper.call(harness.ctx, '독서', { keepOpen: true });

    assert.deepEqual(harness.ctx.timeSlots[0].planActivities.map((item) => ({
        label: item.label,
        activityText: item.activityText,
        activityId: item.activityId,
        startMinute: item.startMinute,
        endMinute: item.endMinute,
        durationMinutes: item.durationMinutes,
        seconds: item.seconds,
    })), [
        { label: '샤워', activityText: '샤워', activityId: 'shower', startMinute: 0, endMinute: 20, durationMinutes: 20, seconds: 1200 },
        { label: '독서', activityText: '독서', activityId: 'reading', startMinute: 20, endMinute: 60, durationMinutes: 40, seconds: 2400 },
    ]);
    assert.equal(harness.ctx.selectedPlanSegment, null);
    assert.equal(harness.ctx.inlinePlanTarget, null);
});

test('segment inline target replacement clears stale id when replacement has no id', () => {
    const harness = createInlineSelectionHarness({
        inlinePlanTarget: {
            startIndex: 0,
            endIndex: 0,
            mode: 'plan-segment-replace',
            segmentIndex: 1,
            segmentId: 'planned-0-1',
            anchor: {},
        },
        timeSlots: [
            {
                planned: 'First, Second',
                planTitle: '',
                planTitleBandOn: false,
                planActivities: [
                    { label: 'First', activityText: 'First', activityId: 'first-id', seconds: 1200, startMinute: 0, endMinute: 20, durationMinutes: 20 },
                    { label: 'Second', activityText: 'Second', activityId: 'stale-second-id', seconds: 2400, startMinute: 20, endMinute: 60, durationMinutes: 40 },
                ],
            },
        ],
        plannedActivities: [
            { name: 'No Id Replacement', label: 'No Id Replacement', normalizedName: 'No Id Replacement', parentId: null, pinned: true, archived: false },
        ],
        ctx: {
            replacePlanSegmentActivity(baseIndex, segmentIndex, activityItem) {
                const current = this.timeSlots[baseIndex].planActivities[segmentIndex];
                this.timeSlots[baseIndex].planActivities[segmentIndex] = {
                    ...current,
                    label: activityItem.label,
                    activityText: activityItem.label,
                    activityId: String(activityItem.id || '').trim() || null,
                };
                this.timeSlots[baseIndex].planned = this.formatActivitiesSummary(this.timeSlots[baseIndex].planActivities);
                return true;
            },
        },
    });
    const chipButton = renderInlineSelectionChip(harness, 'No Id Replacement');
    harness.calls.length = 0;

    dispatchInlineSelectionClick(chipButton);

    assert.deepEqual(harness.ctx.timeSlots[0].planActivities.map((item) => ({
        label: item.label,
        activityText: item.activityText,
        activityId: item.activityId,
        startMinute: item.startMinute,
        endMinute: item.endMinute,
        durationMinutes: item.durationMinutes,
        seconds: item.seconds,
    })), [
        { label: 'First', activityText: 'First', activityId: 'first-id', startMinute: 0, endMinute: 20, durationMinutes: 20, seconds: 1200 },
        { label: 'No Id Replacement', activityText: 'No Id Replacement', activityId: null, startMinute: 20, endMinute: 60, durationMinutes: 40, seconds: 2400 },
    ]);
    assert.notEqual(harness.ctx.timeSlots[0].planActivities[1].activityId, 'stale-second-id');
    assert.equal(harness.ctx.inlinePlanTarget, null);
});

test('activity chip selection uses regular inline target before selected segment replacement', () => {
    const harness = createInlineSelectionHarness({
        selectedPlanSegment: { baseIndex: 0, segmentIndex: 0 },
        inlinePlanTarget: { startIndex: 1, endIndex: 1 },
        timeSlots: [
            {
                planned: 'A',
                planTitle: '',
                planTitleBandOn: false,
                planActivities: [
                    { label: 'A', activityText: 'A', activityId: 'a', seconds: 3600 },
                ],
            },
            {
                planned: 'Old',
                planTitle: '',
                planTitleBandOn: false,
                planActivities: [
                    { label: 'Old', activityText: 'Old', activityId: 'old', seconds: 3600 },
                ],
            },
        ],
    });
    let replacementCalls = 0;
    harness.ctx.replaceSelectedPlanSegmentActivity = () => {
        replacementCalls += 1;
        return true;
    };
    const chipButton = renderInlineSelectionChip(harness);

    dispatchInlineSelectionClick(chipButton);

    assert.equal(replacementCalls, 0);
    assert.equal(harness.ctx.timeSlots[0].planActivities[0].label, 'A');
    assert.equal(harness.ctx.timeSlots[1].planned, 'Fill');
    assert.equal(harness.ctx.timeSlots[1].planActivities[0].label, 'Fill');
});

test('mobile activity chip selection closes sheet despite chip keep-open request', () => {
    const harness = createInlineSelectionHarness({
        ctx: {
            isInlinePlanMobileInputContext() {
                return true;
            },
        },
    });
    const chipButton = renderInlineSelectionChip(harness);
    harness.calls.length = 0;

    dispatchInlineSelectionClick(chipButton);

    assert.equal(harness.ctx.timeSlots[0].planned, 'Fill');
    assert.equal(harness.ctx.timeSlots[0].planActivities[0].label, 'Fill');
    assert.deepEqual(harness.calls, [['render', false], ['totals'], ['save'], ['close']]);
    assert.equal(harness.ctx.inlinePlanTarget, null);
});

test('mobile text selection closes sheet unless keep-open is explicit for mobile', () => {
    const mobileHarness = createInlineSelectionHarness({
        ctx: {
            isInlinePlanMobileInputContext() {
                return true;
            },
        },
    });

    applyInlinePlanSelectionWrapper.call(mobileHarness.ctx, 'Typed', { keepOpen: true });

    assert.equal(mobileHarness.ctx.timeSlots[0].planned, 'Typed');
    assert.deepEqual(mobileHarness.calls, [['render', false], ['totals'], ['save'], ['close']]);
    assert.equal(mobileHarness.ctx.inlinePlanTarget, null);

    const explicitHarness = createInlineSelectionHarness({
        ctx: {
            isInlinePlanMobileInputContext() {
                return true;
            },
            shouldAutofocusInlinePlanInput() {
                return false;
            },
        },
    });
    const originalDocument = globalThis.document;
    globalThis.document = {
        querySelector(selector) {
            if (selector === '[data-index="0"] .planned-input') return null;
            if (selector === '[data-index="0"]') return {};
            return null;
        },
    };
    try {
        applyInlinePlanSelectionWrapper.call(explicitHarness.ctx, 'Typed', {
            keepOpen: true,
            keepOpenOnMobile: true,
        });
    } finally {
        globalThis.document = originalDocument;
    }

    assert.equal(explicitHarness.ctx.timeSlots[0].planned, 'Typed');
    assert.deepEqual(explicitHarness.calls, [['render', true], ['totals'], ['save'], ['position']]);
    assert.notEqual(explicitHarness.ctx.inlinePlanTarget, null);
});

test('renderInlinePlanDropdownOptions uses split parent chips and keeps accessible labels', () => {
    const originalDocument = globalThis.document;
    const createNode = (tagName) => {
        const listeners = {};
        const attributes = {};
        const node = {
            tagName,
            children: [],
            dataset: {},
            className: '',
            classList: {
                owner: null,
                add(...classes) {
                    const target = this.owner;
                    if (!target) return;
                    classes.forEach((cls) => {
                        if (!cls) return;
                        const tokens = target.className.split(/\s+/).filter(Boolean);
                        if (!tokens.includes(cls)) {
                            target.className = (target.className ? target.className + ' ' : '') + cls;
                        }
                    });
                },
                remove(...classes) {
                    const target = this.owner;
                    if (!target) return;
                    const tokens = target.className.split(/\s+/).filter(Boolean);
                    target.className = tokens.filter((token) => !classes.includes(token)).join(' ');
                },
                contains(cls) {
                    const target = this.owner;
                    if (!target) return false;
                    return target.className.split(/\s+/).filter(Boolean).includes(cls);
                },
            },
            textContent: '',
            title: '',
            type: '',
            appendChild(node) {
                this.children.push(node);
                return node;
            },
            addEventListener(type, handler) {
                listeners[type] = handler;
            },
            dispatchEvent(event) {
                if (listeners[event.type]) listeners[event.type](event);
            },
            setAttribute(name, value) {
                attributes[name] = String(value);
            },
            getAttribute(name) {
                return attributes[name];
            },
        };
        node.classList.owner = node;
        return node;
    };
    const board = {
        children: [],
        _innerHTML: '',
        set innerHTML(value) {
            this._innerHTML = value;
            this.children = [];
        },
        get innerHTML() {
            return this._innerHTML;
        },
        appendChild(node) {
            this.children.push(node);
            return node;
        },
    };
    const searchInput = { value: '' };
    const dropdown = {
        querySelector(selector) {
            if (selector === '.activity-chip-board') return board;
            if (selector === '.inline-plan-input') return searchInput;
            return null;
        },
    };
    let openedParent = null;
    const ctx = {
        inlinePlanDropdown: dropdown,
        inlinePlanTarget: { startIndex: 0, endIndex: 0 },
        plannedActivities: [
            { id: 'work', name: 'Work', label: 'Work', normalizedName: 'Work', parentId: null, pinned: true, archived: false },
            { id: 'work-focus', name: 'Focus', label: 'Focus', normalizedName: 'Focus', parentId: 'work', pinned: false, archived: false },
        ],
        normalizeActivityText(value) {
            return String(value || '').trim();
        },
        groupActivityBoard(entries) {
            return controller.groupActivityBoard.call(this, entries);
        },
        openPlanActivityChildMenu(parentItem) {
            openedParent = parentItem;
        },
    };

    globalThis.document = { createElement: createNode };

    try {
        controller.renderInlinePlanDropdownOptions.call(ctx);

        const pinnedSection = board.children.find((node) => node.children && node.children[0] && node.children[0].textContent === '고정');
        assert.ok(pinnedSection);
        const row = pinnedSection.children[1];
        const chip = row.children[0];
        assert.equal(chip.className, 'activity-chip activity-chip-parent activity-chip-split');
        const labelButton = chip.children[0];
        const caret = chip.children[1];
        assert.equal(labelButton.getAttribute('aria-label'), 'Work 선택');
        assert.equal(caret.getAttribute('aria-label'), 'Work 세부활동 추가 또는 보기');

        caret.dispatchEvent({
            type: 'click',
            preventDefault() {},
            stopPropagation() {},
        });

        assert.equal(openedParent.id, 'work');
    } finally {
        globalThis.document = originalDocument;
    }
});

test('renderInlinePlanDropdownOptions renders an empty catalog state without throwing', () => {
    const originalDocument = globalThis.document;
    const createNode = (tagName) => {
        const attributes = {};
        return {
            tagName,
            children: [],
            dataset: {},
            className: '',
            textContent: '',
            title: '',
            type: '',
            appendChild(node) {
                this.children.push(node);
                return node;
            },
            addEventListener() {},
            setAttribute(name, value) {
                attributes[name] = String(value);
            },
            getAttribute(name) {
                return attributes[name];
            },
        };
    };
    const board = {
        children: [],
        set innerHTML(value) {
            this._innerHTML = value;
            this.children = [];
        },
        get innerHTML() {
            return this._innerHTML || '';
        },
        appendChild(node) {
            this.children.push(node);
            return node;
        },
    };
    const searchInput = { value: '' };
    const dropdown = {
        querySelector(selector) {
            if (selector === '.activity-chip-board') return board;
            if (selector === '.inline-plan-input') return searchInput;
            return null;
        },
    };
    const ctx = {
        inlinePlanDropdown: dropdown,
        inlinePlanTarget: { startIndex: 0, endIndex: 0 },
        plannedActivities: [],
        normalizeActivityText(value) {
            return String(value || '').trim();
        },
        groupActivityBoard(entries) {
            return controller.groupActivityBoard.call(this, entries);
        },
    };

    globalThis.document = { createElement: createNode };

    try {
        assert.doesNotThrow(() => controller.renderInlinePlanDropdownOptions.call(ctx));
        assert.equal(board.children.length, 1);
        assert.equal(board.children[0].className, 'activity-chip-row');
        assert.equal(board.children[0].children[0].className, 'inline-plan-empty');
        assert.equal(board.children[0].children[0].textContent, '등록된 활동이 없습니다.');
    } finally {
        globalThis.document = originalDocument;
    }
});

test('renderInlinePlanDropdownOptions hides recent when it duplicates the visible top-level list without history', () => {
    const originalDocument = globalThis.document;
    const createNode = (tagName) => {
        return {
            tagName,
            children: [],
            dataset: {},
            className: '',
            textContent: '',
            title: '',
            type: '',
            appendChild(node) {
                this.children.push(node);
                return node;
            },
            addEventListener() {},
            setAttribute() {},
            getAttribute() { return null; },
        };
    };
    const board = {
        children: [],
        _innerHTML: '',
        set innerHTML(value) {
            this._innerHTML = value;
            this.children = [];
        },
        get innerHTML() {
            return this._innerHTML;
        },
        appendChild(node) {
            this.children.push(node);
            return node;
        },
    };
    const searchInput = { value: '' };
    const dropdown = {
        querySelector(selector) {
            if (selector === '.activity-chip-board') return board;
            if (selector === '.inline-plan-input') return searchInput;
            return null;
        },
    };
    const ctx = {
        inlinePlanDropdown: dropdown,
        inlinePlanTarget: { startIndex: 0, endIndex: 0 },
        plannedActivities: [
            { id: 'exercise', name: 'Exercise', label: 'Exercise', normalizedName: 'Exercise', parentId: null, pinned: false, archived: false, usageCount: 0, lastUsedAt: null },
            { id: 'stretch', name: 'Stretch', label: 'Stretch', normalizedName: 'Stretch', parentId: null, pinned: false, archived: false, usageCount: 0, lastUsedAt: null },
            { id: 'exercise-child', name: 'Child', label: 'Child', normalizedName: 'Child', parentId: 'exercise', pinned: false, archived: false },
        ],
        normalizeActivityText(value) {
            return String(value || '').trim();
        },
        groupActivityBoard(entries) {
            return controller.groupActivityBoard.call(this, entries);
        },
    };

    globalThis.document = { createElement: createNode };

    try {
        controller.renderInlinePlanDropdownOptions.call(ctx);
        const headings = [];
        const collect = (node) => {
            if (!node) return;
            if (node.className === 'activity-chip-board-title') headings.push(node.textContent);
            (node.children || []).forEach(collect);
        };
        board.children.forEach(collect);

        assert.equal(headings.includes('최근 사용'), false);
        assert.ok(headings.includes('전체 활동군'));
    } finally {
        globalThis.document = originalDocument;
    }
});


test('openPlanActivityChildMenu renders child chips only and child selection writes the segment model', () => {
    const originalDocument = globalThis.document;
    const createNode = (tagName) => {
        const listeners = {};
        const attributes = {};
        return {
            tagName,
            children: [],
            dataset: {},
            className: '',
            textContent: '',
            title: '',
            type: '',
            hidden: false,
            appendChild(node) { node.parentElement = this; this.children.push(node); return node; },
            addEventListener(type, handler) { listeners[type] = handler; },
            dispatchEvent(event) { if (!event.target) event.target = this; if (listeners[event.type]) listeners[event.type](event); },
            setAttribute(name, value) { attributes[name] = String(value); },
            getAttribute(name) { return attributes[name]; },
        };
    };
    const subSection = createNode('div');
    subSection.className = 'inline-plan-subsection';
    const subBoard = createNode('div');
    subBoard.className = 'activity-chip-board inline-plan-sub-board';
    Object.defineProperty(subBoard, 'innerHTML', { get() { return this._innerHTML || ''; }, set(value) { this._innerHTML = value; this.children = []; } });
    const title = createNode('div');
    title.className = 'inline-plan-subsection-title';
    const actions = createNode('div');
    actions.className = 'inline-plan-child-actions';
    Object.defineProperty(actions, 'innerHTML', { get() { return this._innerHTML || ''; }, set(value) { this._innerHTML = value; this.children = []; } });
    const backBtn = createNode('button');
    backBtn.className = 'inline-plan-sub-back';
    const closeBtn = createNode('button');
    closeBtn.className = 'inline-plan-subsection-close';
    const dropdown = {
        querySelector(selector) {
            if (selector === '.inline-plan-subsection') return subSection;
            if (selector === '.inline-plan-sub-board') return subBoard;
            if (selector === '.inline-plan-child-actions') return actions;
            if (selector === '.inline-plan-subsection-title') return title;
            if (selector === '.inline-plan-sub-back') return backBtn;
            if (selector === '.inline-plan-subsection-close') return closeBtn;
            return null;
        },
    };
    const anchor = { isConnected: true, getBoundingClientRect() { return { left: 0, top: 0, bottom: 0, width: 10, height: 10 }; } };
    const documentStub = { createElement: createNode, querySelector() { return anchor; } };

    const ctx = {
        inlinePlanDropdown: dropdown,
        inlinePlanTarget: { startIndex: 0, endIndex: 0, anchor },
        timeSlots: [{}],
        mergedFields: new Map(),
        plannedActivities: [],
        normalizeActivityText(value) { return String(value || '').trim(); },
        renderTimeEntries() {},
        calculateTotals() {},
        autoSave() {},
        isInlinePlanMobileInputContext() { return false; },
        positionInlinePlanDropdown() {},
        dedupeAndSortPlannedActivities() {},
        savePlannedActivities() {},
        closePlanActivityChildMenu(options = {}) { return controller.closePlanActivityChildMenu.call(this, options); },
    };
    globalThis.document = documentStub;
    try {
        controller.openPlanActivityChildMenu.call(ctx, { id: 'work', name: 'Work', label: 'Work' }, anchor, [
            { id: 'work-focus', name: 'Focus', label: 'Focus', normalizedName: 'Focus', parentId: 'work' },
        ]);
        assert.equal(findNode(subBoard, (node) => String(node.className || '').includes('activity-chip-self')), null);
        assert.equal(actions.children.length, 0);
        const childButton = findNode(subBoard, (node) => node.dataset && node.dataset.activityId === 'work-focus');
        assert.ok(childButton);
        assert.equal(childButton.dataset.boardSection, 'children');
        assert.equal(childButton.dataset.draggableActivity, 'true');
        childButton.dispatchEvent({ type: 'click', preventDefault() {}, stopPropagation() {} });
        assert.deepEqual(ctx.timeSlots[0].planActivities[0], { label: 'Focus', seconds: 3600, titleActivityId: 'work', titleText: 'Work', activityId: 'work-focus', activityText: 'Focus' });
        assert.equal(ctx.timeSlots[0].planTitle, 'Work');
    } finally {
        globalThis.document = originalDocument;
    }
});

test('renderInlinePlanDropdownOptions hides the child-board caret for childless top-level activities', () => {
    const originalDocument = globalThis.document;
    const createNode = (tagName) => {
        const listeners = {};
        const attributes = {};
        return {
            tagName,
            children: [],
            dataset: {},
            className: '',
            textContent: '',
            title: '',
            type: '',
            appendChild(node) {
                this.children.push(node);
                return node;
            },
            addEventListener(type, handler) {
                listeners[type] = handler;
            },
            dispatchEvent(event) {
                if (listeners[event.type]) listeners[event.type](event);
            },
            setAttribute(name, value) {
                attributes[name] = String(value);
            },
            getAttribute(name) {
                return attributes[name];
            },
        };
    };
    const board = {
        children: [],
        _innerHTML: '',
        set innerHTML(value) {
            this._innerHTML = value;
            this.children = [];
        },
        get innerHTML() {
            return this._innerHTML;
        },
        appendChild(node) {
            this.children.push(node);
            return node;
        },
    };
    const searchInput = { value: '' };
    const dropdown = {
        querySelector(selector) {
            if (selector === '.activity-chip-board') return board;
            if (selector === '.inline-plan-input') return searchInput;
            return null;
        },
    };
    const ctx = {
        inlinePlanDropdown: dropdown,
        inlinePlanTarget: { startIndex: 0, endIndex: 0 },
        plannedActivities: [
            { id: 'work', name: 'Work', label: 'Work', normalizedName: 'Work', parentId: null, pinned: true, archived: false },
        ],
        normalizeActivityText(value) {
            return String(value || '').trim();
        },
        groupActivityBoard(entries) {
            return controller.groupActivityBoard.call(this, entries);
        },
        openPlanActivityChildMenu() {},
    };

    globalThis.document = { createElement: createNode };

    try {
        controller.renderInlinePlanDropdownOptions.call(ctx);

        const pinnedSection = board.children.find((node) => node.children && node.children[0] && node.children[0].textContent === '고정');
        assert.ok(pinnedSection);
        const row = pinnedSection.children[1];
        const chip = row.children[0];
        assert.equal(chip.className, 'activity-chip');
        const labelButton = chip.children[0];
        assert.equal(chip.children[1], undefined);
        assert.equal(labelButton.getAttribute('aria-label'), 'Work 선택');
    } finally {
        globalThis.document = originalDocument;
    }
});


test('openPlanActivityChildMenu renders no child composer, add action, or parent self action', () => {
    const originalDocument = globalThis.document;
    const createNode = (tagName) => {
        const listeners = {};
        const attributes = {};
        return {
            tagName,
            children: [],
            dataset: {},
            className: '',
            textContent: '',
            title: '',
            type: '',
            hidden: false,
            appendChild(node) { node.parentElement = this; this.children.push(node); return node; },
            addEventListener(type, handler) { listeners[type] = handler; },
            dispatchEvent(event) { if (!event.target) event.target = this; if (listeners[event.type]) listeners[event.type](event); },
            setAttribute(name, value) { attributes[name] = String(value); },
            getAttribute(name) { return attributes[name]; },
        };
    };
    const subSection = createNode('div');
    subSection.className = 'inline-plan-subsection';
    const subBoard = createNode('div');
    subBoard.className = 'activity-chip-board inline-plan-sub-board';
    Object.defineProperty(subBoard, 'innerHTML', { get() { return this._innerHTML || ''; }, set(value) { this._innerHTML = value; this.children = []; } });
    const title = createNode('div');
    title.className = 'inline-plan-subsection-title';
    const actions = createNode('div');
    actions.className = 'inline-plan-child-actions';
    Object.defineProperty(actions, 'innerHTML', { get() { return this._innerHTML || ''; }, set(value) { this._innerHTML = value; this.children = []; } });
    const backBtn = createNode('button');
    backBtn.className = 'inline-plan-sub-back';
    const closeBtn = createNode('button');
    closeBtn.className = 'inline-plan-subsection-close';
    const dropdown = {
        querySelector(selector) {
            if (selector === '.inline-plan-subsection') return subSection;
            if (selector === '.inline-plan-sub-board') return subBoard;
            if (selector === '.inline-plan-child-actions') return actions;
            if (selector === '.inline-plan-subsection-title') return title;
            if (selector === '.inline-plan-sub-back') return backBtn;
            if (selector === '.inline-plan-subsection-close') return closeBtn;
            return null;
        },
    };
    const anchor = { isConnected: true, getBoundingClientRect() { return { left: 0, top: 0, bottom: 0, width: 10, height: 10 }; } };
    const documentStub = { createElement: createNode, querySelector() { return anchor; } };

    const ctx = {
        inlinePlanDropdown: dropdown,
        inlinePlanTarget: { startIndex: 0, endIndex: 0, anchor },
        plannedActivities: [],
        normalizeActivityText(value) { return String(value || '').trim(); },
        positionInlinePlanDropdown() {},
        closePlanActivityChildMenu(options = {}) { return controller.closePlanActivityChildMenu.call(this, options); },
    };
    globalThis.document = documentStub;
    try {
        controller.openPlanActivityChildMenu.call(ctx, { id: 'work', name: 'Work', label: 'Work' }, anchor, []);
        assert.equal(subSection.hidden, false);
        assert.equal(backBtn.hidden, true);
        assert.equal(actions.children.length, 0);
        assert.equal(findNode(subBoard, (node) => String(node.className || '').includes('activity-chip-self')), null);
        assert.equal(findNode(subBoard, (node) => String(node.className || '').includes('activity-chip-add')), null);
        assert.equal(findNode(subBoard, (node) => String(node.className || '').includes('activity-child-composer')), null);
        assert.ok(findNode(subBoard, (node) => String(node.className || '').includes('inline-plan-empty')));
    } finally {
        globalThis.document = originalDocument;
    }
});

test('openPlanActivityChildMenu closes via the popover close button', () => {
    const originalDocument = globalThis.document;
    const createNode = (tagName) => {
        const listeners = {};
        const attributes = {};
        return {
            tagName,
            children: [],
            dataset: {},
            className: '',
            value: '',
            textContent: '',
            title: '',
            type: '',
            hidden: false,
            appendChild(node) {
                this.children.push(node);
                return node;
            },
            addEventListener(type, handler) {
                listeners[type] = handler;
            },
            dispatchEvent(event) {
                if (listeners[event.type]) listeners[event.type](event);
                if (typeof this.onclick === 'function' && event.type === 'click') {
                    this.onclick(event);
                }
            },
            setAttribute(name, value) {
                attributes[name] = String(value);
            },
            getAttribute(name) {
                return attributes[name];
            },
        };
    };
    const subSection = createNode('div');
    subSection.className = 'inline-plan-subsection';
    subSection.style = {};
    const subBoard = createNode('div');
    subBoard.className = 'activity-chip-board inline-plan-sub-board';
    const title = createNode('div');
    title.className = 'inline-plan-subsection-title';
    const actions = createNode('div');
    actions.className = 'inline-plan-child-actions';
    actions._innerHTML = '';
    Object.defineProperty(actions, 'innerHTML', {
        get() {
            return this._innerHTML;
        },
        set(value) {
            this._innerHTML = value;
            this.children = [];
        },
    });
    const backBtn = createNode('button');
    backBtn.className = 'inline-plan-sub-back';
    const closeBtn = createNode('button');
    closeBtn.className = 'inline-plan-subsection-close';
    closeBtn.textContent = '×';
    const dropdownClasses = new Set();
    const dropdown = {
        classList: {
            add(name) {
                dropdownClasses.add(name);
            },
            remove(name) {
                dropdownClasses.delete(name);
            },
            contains(name) {
                return dropdownClasses.has(name);
            },
        },
        querySelector(selector) {
            if (selector === '.inline-plan-subsection') return subSection;
            if (selector === '.inline-plan-sub-board') return subBoard;
            if (selector === '.inline-plan-child-actions') return actions;
            if (selector === '.inline-plan-subsection-title') return title;
            if (selector === '.inline-plan-sub-back') return backBtn;
            if (selector === '.inline-plan-subsection-close') return closeBtn;
            return null;
        },
    };
    const anchor = { isConnected: true, getBoundingClientRect() { return { left: 0, top: 0, bottom: 0, width: 10, height: 10 }; } };
    const documentStub = {
        createElement: createNode,
        querySelector() {
            return anchor;
        },
    };
    const ctx = {
        inlinePlanDropdown: dropdown,
        inlinePlanTarget: { startIndex: 0, endIndex: 0, anchor },
        timeSlots: [{}],
        mergedFields: new Map(),
        plannedActivities: [],
        modalPlanActivities: [],
        modalPlanActiveRow: -1,
        modalPlanTitle: '',
        modalPlanTitleBandOn: false,
        normalizeActivityText(value) {
            return String(value || '').trim();
        },
        renderTimeEntries() {},
        calculateTotals() {},
        autoSave() {},
        positionInlinePlanDropdown() {},
        dedupeAndSortPlannedActivities() {},
        savePlannedActivities() {},
        openPlanActivityChildMenu(parentItem, anchorEl, children) {
            return controller.openPlanActivityChildMenu.call(this, parentItem, anchorEl, children);
        },
        closePlanActivityChildMenu(options = {}) {
            return controller.closePlanActivityChildMenu.call(this, options);
        },
    };

    globalThis.document = documentStub;

    try {
        controller.openPlanActivityChildMenu.call(ctx, { id: 'work', name: 'Work', label: 'Work' }, anchor, []);

        assert.equal(subSection.hidden, false);
        assert.equal(closeBtn.getAttribute('aria-label'), '세부활동 설정 닫기');

        assert.equal(subSection.style.visibility, 'visible');
        assert.equal(dropdownClasses.has('inline-plan-child-popover-open'), true);

        closeBtn.dispatchEvent({
            type: 'click',
            preventDefault() {},
            stopPropagation() {},
        });

        assert.equal(subSection.hidden, true);
        assert.equal(subSection.style.visibility, 'hidden');
        assert.equal(dropdownClasses.has('inline-plan-child-popover-open'), false);
        assert.equal(ctx.modalPlanSectionOpen, false);
    } finally {
        globalThis.document = originalDocument;
    }
});

test('positionInlinePlanChildPopover anchors the child board under the caret', () => {
    const makeStyleBag = () => ({
        setProperty(name, value) {
            this[name] = String(value);
        },
        removeProperty(name) {
            delete this[name];
        },
    });
    const sectionClasses = new Set();
    const section = {
        hidden: false,
        style: makeStyleBag(),
        classList: {
            add(...classes) {
                classes.forEach((name) => sectionClasses.add(name));
            },
            remove(...classes) {
                classes.forEach((name) => sectionClasses.delete(name));
            },
            contains(name) { return sectionClasses.has(name); },
        },
        offsetHeight: 220,
        scrollHeight: 220,
    };
    const board = {
        style: makeStyleBag(),
    };
    const header = {
        getBoundingClientRect() {
            return { height: 36 };
        },
    };
    const dropdownClasses = new Set(['inline-plan-child-popover-open']);
    const dropdown = {
        style: makeStyleBag(),
        classList: {
            remove(name) {
                dropdownClasses.delete(name);
            },
            contains(name) {
                return name === 'inline-plan-dropdown-sheet' ? false : false;
            },
        },
        getBoundingClientRect() {
            return { left: 100, top: 0, right: 520, bottom: 380, width: 420, height: 380 };
        },
        querySelector(selector) {
            if (selector === '.inline-plan-subsection') return section;
            if (selector === '.inline-plan-sub-board') return board;
            if (selector === '.inline-plan-subsection-head') return header;
            return null;
        },
    };
    const anchor = {
        isConnected: true,
        getBoundingClientRect() {
            return { left: 240, top: 98, right: 276, bottom: 128, width: 36, height: 30 };
        },
    };
    const ctx = {
        inlinePlanDropdown: dropdown,
        modalPlanSectionOpen: true,
        modalPlanSectionOpenParentId: 'work',
        inlinePlanChildPopoverAnchorEl: anchor,
        isInlinePlanMobileInputContext() {
            return false;
        },
        resolveInlinePlanAnchor(anchorEl) {
            return anchorEl;
        },
        getInlinePlanViewportMetrics() {
            return { left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600 };
        },
    };

    controller.positionInlinePlanChildPopover.call(ctx, anchor);

    assert.equal(section.style.position, 'fixed');
    assert.equal(section.style.left, '240px');
    assert.equal(section.style.top, '136px');
    assert.equal(section.style.width, '360px');
    assert.equal(section.style.maxWidth, '360px');
    assert.equal(section.style.visibility, 'visible');
    assert.equal(section.style.zIndex, '80');
    assert.equal(section.style.maxHeight, '420px');
    assert.equal(section.style.overflow, 'hidden');
    assert.equal(section.classList.contains('inline-plan-subsection-anchored'), true);
    assert.equal(section.classList.contains('inline-plan-subsection-flow'), false);
    assert.equal(board.style.overflow, 'auto');
    assert.equal(board.style.maxHeight, '352px');
});

test('positionInlinePlanChildPopover caps tall child board height', () => {
    const makeStyleBag = () => ({
        setProperty(name, value) {
            this[name] = String(value);
        },
        removeProperty(name) {
            delete this[name];
        },
    });
    const sectionClasses = new Set();
    const section = {
        hidden: false,
        style: makeStyleBag(),
        classList: {
            add(...classes) {
                classes.forEach((name) => sectionClasses.add(name));
            },
            remove(...classes) {
                classes.forEach((name) => sectionClasses.delete(name));
            },
            contains(name) { return sectionClasses.has(name); },
        },
        offsetHeight: 800,
        scrollHeight: 800,
    };
    const board = {
        style: makeStyleBag(),
    };
    const header = {
        getBoundingClientRect() {
            return { height: 36 };
        },
    };
    const dropdownClasses = new Set(['inline-plan-child-popover-open']);
    const dropdown = {
        style: makeStyleBag(),
        classList: {
            remove(name) {
                dropdownClasses.delete(name);
            },
            contains() {
                return false;
            },
        },
        getBoundingClientRect() {
            return { left: 0, top: 0, right: 520, bottom: 900, width: 520, height: 900 };
        },
        querySelector(selector) {
            if (selector === '.inline-plan-subsection') return section;
            if (selector === '.inline-plan-sub-board') return board;
            if (selector === '.inline-plan-subsection-head') return header;
            return null;
        },
    };
    const anchor = {
        isConnected: true,
        getBoundingClientRect() {
            return { left: 120, top: 40, right: 156, bottom: 70, width: 36, height: 30 };
        },
    };
    const ctx = {
        inlinePlanDropdown: dropdown,
        modalPlanSectionOpen: true,
        modalPlanSectionOpenParentId: 'work',
        inlinePlanChildPopoverAnchorEl: anchor,
        isInlinePlanMobileInputContext() {
            return false;
        },
    };

    controller.positionInlinePlanChildPopover.call(ctx, anchor);

    assert.equal(section.style.maxHeight, '420px');
    assert.equal(section.style.overflow, 'hidden');
    assert.equal(section.style.zIndex, '80');
    assert.equal(board.style.overflow, 'auto');
    assert.equal(board.style.maxHeight, '352px');
});

test('positionInlinePlanChildPopover re-resolves the active caret after rerender', () => {
    const makeStyleBag = () => ({
        setProperty(name, value) {
            this[name] = String(value);
        },
        removeProperty(name) {
            delete this[name];
        },
    });
    const section = {
        hidden: false,
        style: makeStyleBag(),
        classList: {
            add() {},
            remove() {},
            contains() { return false; },
        },
    };
    const freshCaret = {
        dataset: { activityId: 'work', boardSection: 'parents', chipInstanceKey: 'parents::work' },
        isConnected: true,
        getBoundingClientRect() {
            return { left: 160, top: 98, right: 196, bottom: 128, width: 36, height: 30 };
        },
    };
    const staleAnchor = {
        isConnected: false,
        getBoundingClientRect() {
            return { left: 40, top: 200, right: 76, bottom: 260, width: 36, height: 60 };
        },
    };
    const dropdown = {
        style: makeStyleBag(),
        classList: {
            contains() {
                return false;
            },
        },
        getBoundingClientRect() {
            return { left: 0, top: 0, right: 420, bottom: 380, width: 420, height: 380 };
        },
        querySelector(selector) {
            if (selector === '.inline-plan-subsection') return section;
            return null;
        },
        querySelectorAll(selector) {
            if (selector === '.activity-chip-caret[data-activity-id]') return [freshCaret];
            return [];
        },
    };
    const ctx = {
        inlinePlanDropdown: dropdown,
        modalPlanSectionOpen: true,
        modalPlanSectionOpenParentId: 'work',
        inlinePlanChildPopoverAnchorEl: staleAnchor,
        isInlinePlanMobileInputContext() {
            return false;
        },
    };

    controller.positionInlinePlanChildPopover.call(ctx, staleAnchor);

    assert.equal(section.style.top, '136px');
    assert.equal(ctx.inlinePlanChildPopoverAnchorEl, freshCaret);
});

test('scrollChildPopoverIntoDropdownView scrolls just enough to reveal clipped popover bounds', () => {
    const scrollContainer = {
        scrollTop: 0,
        scrollHeight: 900,
        clientHeight: 300,
        getBoundingClientRect() {
            return { top: 100, bottom: 400, left: 0, right: 400, width: 400, height: 300 };
        },
    };
    const dropdown = {
        scrollTop: 0,
        querySelector(selector) {
            if (selector === '.inline-plan-dropdown-content') return null;
            if (selector === '.activity-chip-board') return scrollContainer;
            return null;
        },
    };
    const popover = {
        getBoundingClientRect() {
            return { top: 260, bottom: 440, left: 0, right: 0, width: 0, height: 180 };
        },
    };

    const didScroll = controller.scrollChildPopoverIntoDropdownView.call({}, dropdown, popover, { margin: 8 });

    assert.equal(didScroll, true);
    assert.equal(scrollContainer.scrollTop, 48);
});

test('scrollChildPopoverIntoDropdownView scrolls upward when the popover top is clipped', () => {
    const scrollContainer = {
        scrollTop: 200,
        scrollHeight: 900,
        clientHeight: 300,
        getBoundingClientRect() {
            return { top: 100, bottom: 400, left: 0, right: 400, width: 400, height: 300 };
        },
    };
    const dropdown = {
        scrollTop: 200,
        querySelector(selector) {
            if (selector === '.activity-chip-board') return scrollContainer;
            return null;
        },
    };
    const popover = {
        getBoundingClientRect() {
            return { top: 88, bottom: 220, left: 0, right: 0, width: 0, height: 132 };
        },
    };

    const didScroll = controller.scrollChildPopoverIntoDropdownView.call({}, dropdown, popover, { margin: 8 });

    assert.equal(didScroll, true);
    assert.equal(scrollContainer.scrollTop, 180);
});

test('scrollChildPopoverIntoDropdownView does not scroll when the popover is already fully visible', () => {
    const scrollContainer = {
        scrollTop: 140,
        scrollHeight: 900,
        clientHeight: 300,
        getBoundingClientRect() {
            return { top: 100, bottom: 400, left: 0, right: 400, width: 400, height: 300 };
        },
    };
    const dropdown = {
        scrollTop: 140,
        querySelector(selector) {
            if (selector === '.activity-chip-board') return scrollContainer;
            return null;
        },
    };
    const popover = {
        getBoundingClientRect() {
            return { top: 140, bottom: 240, left: 0, right: 0, width: 0, height: 100 };
        },
    };

    const didScroll = controller.scrollChildPopoverIntoDropdownView.call({}, dropdown, popover, { margin: 8 });

    assert.equal(didScroll, false);
    assert.equal(scrollContainer.scrollTop, 140);
});

test('scrollChildPopoverIntoDropdownView uses dropdown when board does not clip sibling popover', () => {
    const containsByParent = function containsByParent(node) {
        let current = node;
        while (current) {
            if (current === this) return true;
            current = current.parentElement || null;
        }
        return false;
    };
    const dropdown = {
        scrollTop: 0,
        scrollHeight: 1000,
        clientHeight: 300,
        parentElement: null,
        contains: containsByParent,
        getBoundingClientRect() {
            return { top: 100, bottom: 400, left: 0, right: 420, width: 420, height: 300 };
        },
        querySelector(selector) {
            if (selector === '.activity-chip-board') return board;
            return null;
        },
    };
    const board = {
        scrollTop: 0,
        scrollHeight: 900,
        clientHeight: 200,
        parentElement: dropdown,
        contains: containsByParent,
        getBoundingClientRect() {
            return { top: 120, bottom: 320, left: 10, right: 410, width: 400, height: 200 };
        },
    };
    const row = { parentElement: board };
    const caret = {
        parentElement: row,
        getBoundingClientRect() {
            return { top: 250, bottom: 280, left: 160, right: 196, width: 36, height: 30 };
        },
    };
    const popover = {
        parentElement: dropdown,
        getBoundingClientRect() {
            return { top: 270, bottom: 450, left: 40, right: 400, width: 360, height: 180 };
        },
    };

    const didScroll = controller.scrollChildPopoverIntoDropdownView.call({}, dropdown, popover, {
        margin: 8,
        anchorEl: caret,
    });

    assert.equal(didScroll, true);
    assert.equal(dropdown.scrollTop, 58);
    assert.equal(board.scrollTop, 0);
});

test('scrollChildPopoverIntoDropdownView reveals child composer within dropdown boundary', () => {
    const containsByParent = function containsByParent(node) {
        let current = node;
        while (current) {
            if (current === this) return true;
            current = current.parentElement || null;
        }
        return false;
    };
    const dropdown = {
        scrollTop: 0,
        scrollHeight: 1000,
        clientHeight: 300,
        parentElement: null,
        contains: containsByParent,
        getBoundingClientRect() {
            return { top: 100, bottom: 400, left: 0, right: 420, width: 420, height: 300 };
        },
        querySelector(selector) {
            if (selector === '.activity-chip-board') return board;
            return null;
        },
    };
    const board = {
        scrollTop: 0,
        scrollHeight: 900,
        clientHeight: 200,
        parentElement: dropdown,
        contains: containsByParent,
        getBoundingClientRect() {
            return { top: 120, bottom: 320, left: 10, right: 410, width: 400, height: 200 };
        },
    };
    const row = { parentElement: board };
    const caret = {
        parentElement: row,
        getBoundingClientRect() {
            return { top: 250, bottom: 280, left: 160, right: 196, width: 36, height: 30 };
        },
    };
    const popover = {
        parentElement: dropdown,
        getBoundingClientRect() {
            return {
                top: 240 - dropdown.scrollTop,
                bottom: 460 - dropdown.scrollTop,
                left: 40,
                right: 400,
                width: 360,
                height: 220,
            };
        },
    };
    const composer = {
        getBoundingClientRect() {
            return {
                top: 414 - dropdown.scrollTop,
                bottom: 444 - dropdown.scrollTop,
                left: 52,
                right: 388,
                width: 336,
                height: 30,
            };
        },
    };

    const didScroll = controller.scrollChildPopoverIntoDropdownView.call({}, dropdown, popover, {
        margin: 8,
        anchorEl: caret,
    });
    const composerRect = composer.getBoundingClientRect();
    const dropdownRect = dropdown.getBoundingClientRect();

    assert.equal(didScroll, true);
    assert.equal(board.scrollTop, 0);
    assert.ok(dropdown.scrollTop > 0);
    assert.ok(composerRect.bottom <= dropdownRect.bottom - 8);
    assert.ok(composerRect.top >= dropdownRect.top + 8);
});

test('positionInlinePlanChildPopover flips above and clamps near the bottom of the viewport', () => {
    const originalDocument = globalThis.document;
    const originalRAF = globalThis.requestAnimationFrame;
    const makeStyleBag = () => ({
        setProperty(name, value) {
            this[name] = String(value);
        },
        removeProperty(name) {
            delete this[name];
        },
    });
    const containsByParent = function containsByParent(node) {
        let current = node;
        while (current) {
            if (current === this) return true;
            current = current.parentElement || null;
        }
        return false;
    };
    const makeClassList = (owner) => ({
        add(...classes) {
            classes.forEach((cls) => {
                if (!cls) return;
                const tokens = String(owner.className || '').split(/\s+/).filter(Boolean);
                if (!tokens.includes(cls)) {
                    owner.className = (owner.className ? `${owner.className} ` : '') + cls;
                }
            });
        },
        remove(...classes) {
            const tokens = String(owner.className || '').split(/\s+/).filter(Boolean);
            owner.className = tokens.filter((token) => !classes.includes(token)).join(' ');
        },
        contains(cls) {
            return String(owner.className || '').split(/\s+/).filter(Boolean).includes(cls);
        },
    });

    const runCase = (anchorViewportBottom) => {
        const dropdown = {
            scrollTop: 0,
            scrollHeight: 980,
            clientHeight: 300,
            style: makeStyleBag(),
            contains: containsByParent,
            classList: {
                contains() { return false; },
            },
            getBoundingClientRect() {
                return { top: 100, bottom: 400, left: 0, right: 420, width: 420, height: 300 };
            },
        };
        const section = {
            hidden: false,
            className: '',
            style: makeStyleBag(),
            parentElement: dropdown,
            getBoundingClientRect() {
                const top = Number.parseInt(this.style.top, 10) || 0;
                return { top, bottom: top + 220, left: 0, right: 360, width: 360, height: 220 };
            },
        };
        section.classList = makeClassList(section);
        const scrollContainer = {
            scrollTop: 0,
            scrollHeight: 900,
            clientHeight: 220,
            parentElement: dropdown,
            contains: containsByParent,
            getBoundingClientRect() {
                return { top: 112, bottom: 332, left: 10, right: 410, width: 400, height: 220 };
            },
        };
        const anchor = {
            isConnected: true,
            parentElement: { parentElement: scrollContainer },
            getBoundingClientRect() {
                const bottom = anchorViewportBottom;
                return { top: bottom - 30, bottom, left: 160, right: 196, width: 36, height: 30 };
            },
        };
        dropdown.querySelector = (selector) => {
            if (selector === '.inline-plan-subsection') return section;
            if (selector === '.activity-chip-board') return scrollContainer;
            if (selector === '.inline-plan-sub-board') return { style: makeStyleBag() };
            if (selector === '.inline-plan-subsection-head') return { getBoundingClientRect() { return { height: 40 }; } };
            return null;
        };
        dropdown.querySelectorAll = (selector) => {
            if (selector === '.activity-chip-caret[data-activity-id]') return [anchor];
            return [];
        };
        const ctx = {
            inlinePlanDropdown: dropdown,
            modalPlanSectionOpen: true,
            modalPlanSectionOpenParentId: 'work',
            inlinePlanChildPopoverAnchorEl: anchor,
            inlinePlanChildPopoverAnchorSectionKey: 'parents',
            inlinePlanChildPopoverAnchorInstanceKey: 'parents::work',
            getInlinePlanViewportMetrics() {
                return { left: 0, top: 0, right: 420, bottom: 600, width: 420, height: 600 };
            },
            isInlinePlanMobileInputContext() {
                return false;
            },
        };

        controller.positionInlinePlanChildPopover.call(ctx, anchor);

        const finalSectionRect = section.getBoundingClientRect();
        const finalAnchorRect = anchor.getBoundingClientRect();

        assert.equal(section.style.top, '332px');
        assert.equal(section.style.maxHeight, '420px');
        assert.equal(dropdown.scrollTop, 0);
        assert.equal(scrollContainer.scrollTop, 0);
        assert.ok(finalSectionRect.bottom <= finalAnchorRect.top - 8 + 1);
        assert.ok(finalSectionRect.bottom <= 600 - 8 + 1);
        assert.equal(section.style.position, 'fixed');
        assert.equal(section.classList.contains('inline-plan-subsection-above'), false);
        assert.equal(section.classList.contains('inline-plan-subsection-flow'), false);
        assert.equal(section.classList.contains('inline-plan-subsection-anchored'), true);
    };

    try {
        globalThis.document = {
            createElement() {
                return { style: makeStyleBag() };
            },
        };
        globalThis.requestAnimationFrame = (fn) => fn();

        [590].forEach((anchorViewportBottom) => runCase(anchorViewportBottom));
    } finally {
        globalThis.document = originalDocument;
        globalThis.requestAnimationFrame = originalRAF;
    }
});

test('caret toggles child board open, close, and switch parent', () => {
    const originalDocument = globalThis.document;
    const createNode = (tagName) => {
        const listeners = {};
        const attributes = {};
        const node = {
            tagName,
            children: [],
            dataset: {},
            className: '',
            classList: {
                owner: null,
                add(...classes) {
                    const target = this.owner;
                    if (!target) return;
                    classes.forEach((cls) => {
                        if (!cls) return;
                        const tokens = target.className.split(/\s+/).filter(Boolean);
                        if (!tokens.includes(cls)) {
                            target.className = (target.className ? target.className + ' ' : '') + cls;
                        }
                    });
                },
            },
            textContent: '',
            title: '',
            type: '',
            hidden: false,
            appendChild(node) {
                this.children.push(node);
                return node;
            },
            addEventListener(type, handler) {
                listeners[type] = handler;
            },
            dispatchEvent(event) {
                if (listeners[event.type]) listeners[event.type](event);
            },
            setAttribute(name, value) {
                attributes[name] = String(value);
            },
            getAttribute(name) {
                return attributes[name];
            },
        };
        node.classList.owner = node;
        return node;
    };
    const board = {
        children: [],
        _innerHTML: '',
        set innerHTML(value) {
            this._innerHTML = value;
            this.children = [];
        },
        get innerHTML() {
            return this._innerHTML;
        },
        appendChild(node) {
            this.children.push(node);
            return node;
        },
    };
    const subSection = createNode('div');
    subSection.className = 'inline-plan-subsection';
    subSection.hidden = true;
    const subBoard = createNode('div');
    subBoard.className = 'activity-chip-board inline-plan-sub-board';
    subBoard._innerHTML = '';
    Object.defineProperty(subBoard, 'innerHTML', {
        get() {
            return this._innerHTML;
        },
        set(value) {
            this._innerHTML = value;
            this.children = [];
        },
    });
    const title = createNode('div');
    title.className = 'inline-plan-subsection-title';
    const actions = createNode('div');
    actions.className = 'inline-plan-child-actions';
    actions._innerHTML = '';
    Object.defineProperty(actions, 'innerHTML', {
        get() {
            return this._innerHTML;
        },
        set(value) {
            this._innerHTML = value;
            this.children = [];
        },
    });
    const backBtn = createNode('button');
    backBtn.className = 'inline-plan-sub-back';
    const dropdown = {
        querySelector(selector) {
            if (selector === '.activity-chip-board') return board;
            if (selector === '.inline-plan-subsection') return subSection;
            if (selector === '.inline-plan-sub-board') return subBoard;
            if (selector === '.inline-plan-child-actions') return actions;
            if (selector === '.inline-plan-subsection-title') return title;
            if (selector === '.inline-plan-sub-back') return backBtn;
            return null;
        },
    };
    const anchor = { isConnected: true, getBoundingClientRect() { return { left: 0, top: 0, bottom: 0, width: 10, height: 10 }; } };
    const documentStub = {
        createElement: createNode,
        querySelector() {
            return anchor;
        },
    };
    const ctx = {
        inlinePlanDropdown: dropdown,
        inlinePlanTarget: { startIndex: 0, endIndex: 0, anchor },
        plannedActivities: [
            { id: 'work', name: 'Work', label: 'Work', normalizedName: 'Work', parentId: null, pinned: false, archived: false, usageCount: 0, lastUsedAt: null, source: 'local' },
            { id: 'work-focus', name: 'Focus', label: 'Focus', normalizedName: 'Focus', parentId: 'work', pinned: false, archived: false, usageCount: 0, lastUsedAt: null, source: 'local' },
            { id: 'study', name: 'Study', label: 'Study', normalizedName: 'Study', parentId: null, pinned: false, archived: false, usageCount: 0, lastUsedAt: null, source: 'local' },
            { id: 'study-notes', name: 'Notes', label: 'Notes', normalizedName: 'Notes', parentId: 'study', pinned: false, archived: false, usageCount: 0, lastUsedAt: null, source: 'local' },
        ],
        normalizeActivityText(value) {
            return String(value || '').trim();
        },
        groupActivityBoard(entries) {
            return controller.groupActivityBoard.call(this, entries);
        },
        renderInlinePlanDropdownOptions() {
            return controller.renderInlinePlanDropdownOptions.call(this);
        },
        positionInlinePlanDropdown() {},
        openPlanActivityChildMenu: controller.openPlanActivityChildMenu,
        closePlanActivityChildMenu: controller.closePlanActivityChildMenu,
    };

    globalThis.document = documentStub;

    try {
        controller.renderInlinePlanDropdownOptions.call(ctx);
        let parentSection = board.children[0];
        assert.ok(parentSection);
        let row = parentSection.children[1];
        let workChip = row.children[0];
        let studyChip = row.children[1];
        let workCaret = workChip.children[1];
        let studyCaret = studyChip.children[1];
        assert.equal(workCaret.getAttribute('aria-expanded'), 'false');
        assert.equal(studyCaret.getAttribute('aria-expanded'), 'false');

        workCaret.dispatchEvent({
            type: 'click',
            preventDefault() {},
            stopPropagation() {},
        });

        assert.equal(subSection.hidden, false);
        assert.equal(ctx.modalPlanSectionOpen, true);
        assert.equal(ctx.modalPlanSectionOpenParentId, 'work');

        parentSection = board.children[0];
        row = parentSection.children[1];
        workChip = row.children[0];
        studyChip = row.children[1];
        workCaret = workChip.children[1];
        studyCaret = studyChip.children[1];
        assert.equal(workChip.className.includes('activity-chip-open'), true);
        assert.equal(workCaret.getAttribute('aria-expanded'), 'true');
        assert.equal(studyCaret.getAttribute('aria-expanded'), 'false');

        workCaret.dispatchEvent({
            type: 'click',
            preventDefault() {},
            stopPropagation() {},
        });

        assert.equal(subSection.hidden, true);
        assert.equal(ctx.modalPlanSectionOpen, false);
        assert.equal(ctx.modalPlanSectionOpenParentId, null);

        parentSection = board.children[0];
        row = parentSection.children[1];
        workChip = row.children[0];
        studyChip = row.children[1];
        studyCaret = studyChip.children[1];

        studyCaret.dispatchEvent({
            type: 'click',
            preventDefault() {},
            stopPropagation() {},
        });

        assert.equal(subSection.hidden, false);
        assert.equal(ctx.modalPlanSectionOpen, true);
        assert.equal(ctx.modalPlanSectionOpenParentId, 'study');
        assert.equal(title.textContent, 'Study의 세부활동');
    } finally {
        globalThis.document = originalDocument;
    }
});


test('caret anchor follows the rendered parent instance without recent duplicates', () => {
    const originalDocument = globalThis.document;
    const board = createInlineSelectionNode('div');
    Object.defineProperty(board, 'innerHTML', { get() { return this._innerHTML || ''; }, set(value) { this._innerHTML = value; this.children = []; } });
    const searchInput = { value: '' };
    const dropdown = {
        querySelector(selector) { if (selector === '.activity-chip-board') return board; if (selector === '.inline-plan-input') return searchInput; return null; },
        querySelectorAll(selector) {
            if (selector !== '.activity-chip-caret[data-activity-id]') return [];
            const matches = [];
            const visit = (node) => { if (!node) return; if (String(node.className || '').split(/\s+/).includes('activity-chip-caret') && node.dataset && node.dataset.activityId) matches.push(node); (node.children || []).forEach(visit); };
            board.children.forEach(visit);
            return matches;
        },
    };
    const clicks = [];
    const ctx = {
        inlinePlanDropdown: dropdown,
        inlinePlanTarget: { startIndex: 0, endIndex: 0 },
        plannedActivities: [
            { id: 'reading', name: 'Reading', label: 'Reading', normalizedName: 'Reading', parentId: null, usageCount: 3, lastUsedAt: '2026-05-16T00:00:00.000Z' },
            { id: 'reading-notes', name: 'Notes', label: 'Notes', normalizedName: 'Notes', parentId: 'reading' },
        ],
        normalizeActivityText(value) { return String(value || '').trim(); },
        groupActivityBoard(entries) { return controller.groupActivityBoard.call(this, entries); },
        positionInlinePlanDropdown() {},
        openPlanActivityChildMenu(parentItem, anchorEl, children) { this.modalPlanSectionOpen = true; this.modalPlanSectionOpenParentId = parentItem.id; clicks.push({ parentId: parentItem.id, anchorEl, childCount: children.length }); },
        closePlanActivityChildMenu() { this.modalPlanSectionOpen = false; this.modalPlanSectionOpenParentId = null; this.inlinePlanChildPopoverAnchorEl = null; this.inlinePlanChildPopoverAnchorSectionKey = null; this.inlinePlanChildPopoverAnchorInstanceKey = null; },
    };
    globalThis.document = { createElement: createInlineSelectionNode };
    try {
        controller.renderInlinePlanDropdownOptions.call(ctx);
        const carets = dropdown.querySelectorAll('.activity-chip-caret[data-activity-id]');
        assert.equal(carets.some((node) => node.dataset.boardSection === 'recent'), false);
        const parentsReadingCaret = carets.find((node) => node.dataset.boardSection === 'parents' && node.dataset.activityId === 'reading');
        assert.ok(parentsReadingCaret);
        parentsReadingCaret.dispatchEvent({ type: 'click', preventDefault() {}, stopPropagation() {} });
        assert.equal(ctx.inlinePlanChildPopoverAnchorSectionKey, 'parents');
        assert.equal(ctx.inlinePlanChildPopoverAnchorInstanceKey, 'parents::reading');
        assert.equal(controller.getOpenParentCaretAnchor.call(ctx), parentsReadingCaret);
        assert.equal(clicks.length, 1);
    } finally {
        globalThis.document = originalDocument;
    }
});


test('child chip can detach to top level and still nest under another parent', () => {
    const saveCalls = [];
    const renderCalls = [];
    const ctx = {
        inlinePlanDropdown: {},
        plannedActivities: [
            { id: 'work', label: 'Work', name: 'Work', parentId: null, boardOrder: 0 },
            { id: 'focus', label: 'Focus', name: 'Focus', parentId: 'work', boardOrder: 0 },
            { id: 'study', label: 'Study', name: 'Study', parentId: null, boardOrder: 1 },
        ],
        normalizeActivityText(value) { return String(value || '').trim(); },
        dedupeAndSortPlannedActivities() {},
        savePlannedActivities() { saveCalls.push('save'); },
        renderPlannedActivityDropdown() { renderCalls.push('planned'); },
        refreshSubActivityOptions() { renderCalls.push('sub'); },
        renderInlinePlanDropdownOptions() { renderCalls.push('inline'); },
    };
    let result = controller.applyActivityChipboardDrop.call(ctx, 'focus', { type: 'reorder', placement: 'before', targetId: 'study', parentId: '' });
    assert.equal(result.changed, true);
    assert.equal(ctx.plannedActivities.find((item) => item.id === 'focus').parentId, null);
    assert.equal(saveCalls.length, 1);
    assert.ok(ctx.inlinePlanChipUndoState);
    result = controller.applyActivityChipboardDrop.call(ctx, 'focus', { type: 'nest', targetId: 'study' });
    assert.equal(result.changed, true);
    assert.equal(ctx.plannedActivities.find((item) => item.id === 'focus').parentId, 'study');
    assert.equal(saveCalls.length, 2);
});

test('child chip dragged from popover to main board empty space becomes top-level', () => {
    const mainBoard = createInlineSelectionNode('div');
    mainBoard.className = 'activity-chip-board';
    const childBoard = createInlineSelectionNode('div');
    childBoard.className = 'activity-chip-board inline-plan-sub-board';
    const sourceChip = createInlineSelectionNode('span');
    sourceChip.className = 'activity-chip';
    sourceChip.dataset.activityId = 'focus';
    sourceChip.dataset.boardSection = 'children';
    sourceChip.closest = (selector) => {
        if (selector === '.activity-chip[data-activity-id]') return sourceChip;
        if (selector === '.activity-chip-board') return childBoard;
        return null;
    };
    const emptyMainBoardSpace = createInlineSelectionNode('div');
    emptyMainBoardSpace.closest = (selector) => selector === '.activity-chip-board' ? mainBoard : null;
    const documentStub = {
        elementFromPoint() {
            return emptyMainBoardSpace;
        },
    };
    const saveCalls = [];
    const ctx = {
        plannedActivities: [
            { id: 'work', label: 'Work', name: 'Work', parentId: null, boardOrder: 0 },
            { id: 'focus', label: 'Focus', name: 'Focus', parentId: 'work', boardOrder: 0 },
            { id: 'study', label: 'Study', name: 'Study', parentId: null, boardOrder: 1 },
        ],
        normalizeActivityText(value) { return String(value || '').trim(); },
        dedupeAndSortPlannedActivities() {},
        savePlannedActivities() { saveCalls.push('save'); },
        renderPlannedActivityDropdown() {},
        refreshSubActivityOptions() {},
    };

    const intent = controller.resolveInlinePlanChipDropIntent.call(ctx, { clientX: 40, clientY: 80 }, {
        sourceChip,
        sourceId: 'focus',
        board: childBoard,
        document: documentStub,
    });

    assert.equal(intent.type, 'detach');
    assert.equal(intent.parentId, '');
    const result = controller.applyActivityChipboardDrop.call(ctx, 'focus', intent);
    assert.equal(result.status, 'detached');
    assert.equal(ctx.plannedActivities.find((item) => item.id === 'focus').parentId, null);
    assert.equal(saveCalls.length, 1);
});

test('createChildActivityForParent scopes children to one parent and rejects missing parents', () => {
    const ctx = {
        plannedActivities: [
            { id: 'reading', label: 'Reading', name: 'Reading', normalizedName: 'Reading', parentId: null },
            { id: 'exercise', label: 'Exercise', name: 'Exercise', normalizedName: 'Exercise', parentId: null },
        ],
        normalizeActivityText(value) {
            return String(value || '').trim();
        },
        dedupeAndSortPlannedActivities() {},
        savePlannedActivities() {},
        inlineChildComposerError: '',
        inlineChildComposerHighlightId: null,
        inlineChildComposerHighlightKind: null,
    };

    const first = controller.createChildActivityForParent.call(ctx, ctx.plannedActivities[0], '333');
    assert.equal(first.status, 'created');
    assert.ok(ctx.plannedActivities.some((item) => item.label === '333' && item.parentId === 'reading'));
    assert.equal(ctx.plannedActivities.some((item) => item.label === '333' && item.parentId === 'exercise'), false);

    const second = controller.createChildActivityForParent.call(ctx, ctx.plannedActivities[1], '333');
    assert.equal(second.status, 'created');

    const children333 = ctx.plannedActivities.filter((item) => item.label === '333');
    assert.equal(children333.length, 2);
    assert.ok(children333.some((item) => item.parentId === 'reading'));
    assert.ok(children333.some((item) => item.parentId === 'exercise'));

    const duplicate = controller.createChildActivityForParent.call(ctx, ctx.plannedActivities[0], '333');
    assert.equal(duplicate.status, 'duplicate');
    assert.equal(ctx.plannedActivities.filter((item) => item.label === '333').length, 2);
    assert.equal(ctx.inlineChildComposerHighlightId, duplicate.item.id);
    assert.equal(ctx.inlineChildComposerHighlightKind, 'duplicate');

    const invalid = controller.createChildActivityForParent.call(ctx, { label: 'Missing id' }, '333');
    assert.equal(invalid.status, 'invalid-parent');
    assert.equal(ctx.inlineChildComposerError, '부모 활동을 찾을 수 없습니다.');
    assert.equal(ctx.plannedActivities.filter((item) => item.label === '333').length, 2);
});


test('child popover no longer renders child input or add button', () => {
    const originalDocument = globalThis.document;
    const createNode = (tagName) => {
        const listeners = {};
        const attributes = {};
        return {
            tagName,
            children: [],
            dataset: {},
            className: '',
            textContent: '',
            title: '',
            type: '',
            hidden: false,
            appendChild(node) { node.parentElement = this; this.children.push(node); return node; },
            addEventListener(type, handler) { listeners[type] = handler; },
            dispatchEvent(event) { if (!event.target) event.target = this; if (listeners[event.type]) listeners[event.type](event); },
            setAttribute(name, value) { attributes[name] = String(value); },
            getAttribute(name) { return attributes[name]; },
        };
    };
    const subSection = createNode('div');
    subSection.className = 'inline-plan-subsection';
    const subBoard = createNode('div');
    subBoard.className = 'activity-chip-board inline-plan-sub-board';
    Object.defineProperty(subBoard, 'innerHTML', { get() { return this._innerHTML || ''; }, set(value) { this._innerHTML = value; this.children = []; } });
    const title = createNode('div');
    title.className = 'inline-plan-subsection-title';
    const actions = createNode('div');
    actions.className = 'inline-plan-child-actions';
    Object.defineProperty(actions, 'innerHTML', { get() { return this._innerHTML || ''; }, set(value) { this._innerHTML = value; this.children = []; } });
    const backBtn = createNode('button');
    backBtn.className = 'inline-plan-sub-back';
    const closeBtn = createNode('button');
    closeBtn.className = 'inline-plan-subsection-close';
    const dropdown = {
        querySelector(selector) {
            if (selector === '.inline-plan-subsection') return subSection;
            if (selector === '.inline-plan-sub-board') return subBoard;
            if (selector === '.inline-plan-child-actions') return actions;
            if (selector === '.inline-plan-subsection-title') return title;
            if (selector === '.inline-plan-sub-back') return backBtn;
            if (selector === '.inline-plan-subsection-close') return closeBtn;
            return null;
        },
    };
    const anchor = { isConnected: true, getBoundingClientRect() { return { left: 0, top: 0, bottom: 0, width: 10, height: 10 }; } };
    const documentStub = { createElement: createNode, querySelector() { return anchor; } };

    const ctx = {
        inlinePlanDropdown: dropdown,
        inlinePlanTarget: { startIndex: 0, endIndex: 0, anchor },
        plannedActivities: [],
        normalizeActivityText(value) { return String(value || '').trim(); },
        positionInlinePlanDropdown() {},
        closePlanActivityChildMenu(options = {}) { return controller.closePlanActivityChildMenu.call(this, options); },
    };
    globalThis.document = documentStub;
    try {
        controller.openPlanActivityChildMenu.call(ctx, { id: 'work', name: 'Work', label: 'Work' }, anchor, [{ id: 'work-focus', name: 'Focus', label: 'Focus', parentId: 'work' }]);
        assert.equal(actions.children.length, 0);
        assert.equal(findNode(subBoard, (node) => node.tagName === 'input'), null);
        assert.equal(findNode(subBoard, (node) => String(node.className || '').includes('activity-chip-add')), null);
        assert.equal(findNode(subBoard, (node) => String(node.className || '').includes('activity-child-composer')), null);
    } finally {
        globalThis.document = originalDocument;
    }
});

test('child search results include parent context and selecting them writes the segment model', () => {
    const originalDocument = globalThis.document;
    const createNode = (tagName) => {
        const listeners = {};
        const attributes = {};
        return {
            tagName,
            children: [],
            dataset: {},
            className: '',
            textContent: '',
            title: '',
            type: '',
            appendChild(node) {
                this.children.push(node);
                return node;
            },
            addEventListener(type, handler) {
                listeners[type] = handler;
            },
            dispatchEvent(event) {
                if (listeners[event.type]) listeners[event.type](event);
            },
            setAttribute(name, value) {
                attributes[name] = String(value);
            },
            getAttribute(name) {
                return attributes[name];
            },
        };
    };
    const board = {
        children: [],
        _innerHTML: '',
        set innerHTML(value) {
            this._innerHTML = value;
            this.children = [];
        },
        get innerHTML() {
            return this._innerHTML;
        },
        appendChild(node) {
            this.children.push(node);
            return node;
        },
    };
    const searchInput = { value: '스쿼트' };
    const dropdown = {
        querySelector(selector) {
            if (selector === '.activity-chip-board') return board;
            if (selector === '.inline-plan-input') return searchInput;
            return null;
        },
    };
    const anchor = { isConnected: true, getBoundingClientRect() { return { left: 0, top: 0, bottom: 0, width: 10, height: 10 }; } };
    const documentStub = {
        createElement: createNode,
        querySelector() {
            return anchor;
        },
    };
    const ctx = {
        inlinePlanDropdown: dropdown,
        inlinePlanTarget: { startIndex: 0, endIndex: 0, anchor },
        timeSlots: [{}],
        mergedFields: new Map(),
        plannedActivities: [
            { id: 'exercise', name: '운동', label: '운동', normalizedName: '운동', parentId: null, pinned: false, archived: false, usageCount: 0, lastUsedAt: null, source: 'local' },
            { id: 'squat', name: '스쿼트', label: '스쿼트', normalizedName: '스쿼트', parentId: 'exercise', pinned: false, archived: false, usageCount: 0, lastUsedAt: null, source: 'local' },
        ],
        normalizeActivityText(value) {
            return String(value || '').trim();
        },
        groupActivityBoard(entries) {
            return controller.groupActivityBoard.call(this, entries);
        },
        renderTimeEntries() {},
        calculateTotals() {},
        autoSave() {},
        positionInlinePlanDropdown() {},
        dedupeAndSortPlannedActivities() {},
        savePlannedActivities() {},
    };

    globalThis.document = documentStub;

    try {
        controller.renderInlinePlanDropdownOptions.call(ctx);

        const searchSection = board.children.find((node) => node.children && node.children[0] && node.children[0].textContent === '검색 결과');
        assert.ok(searchSection);
        const searchRow = searchSection.children[1];
        const searchChip = searchRow.children[0];
        const searchButton = searchChip.children[0];
        assert.equal(searchButton.children[0].textContent, '스쿼트 · 운동');

        searchButton.dispatchEvent({
            type: 'click',
            preventDefault() {},
            stopPropagation() {},
        });

        assert.deepEqual(ctx.timeSlots[0].planActivities[0], {
            label: '스쿼트',
            seconds: 3600,
            titleActivityId: 'exercise',
            titleText: '운동',
            activityId: 'squat',
            activityText: '스쿼트',
        });
        assert.equal(ctx.timeSlots[0].planTitle, '운동');
        assert.equal(ctx.timeSlots[0].planned, '스쿼트');
    } finally {
        globalThis.document = originalDocument;
    }
});


test('activity selection updates usage metadata without rendering recent ordering', () => {
    const originalDocument = globalThis.document;
    const board = createInlineSelectionNode('div');
    Object.defineProperty(board, 'innerHTML', { get() { return this._innerHTML || ''; }, set(value) { this._innerHTML = value; this.children = []; } });
    const searchInput = { value: '' };
    const dropdown = { querySelector(selector) { if (selector === '.activity-chip-board') return board; if (selector === '.inline-plan-input') return searchInput; return null; } };
    const saveCalls = [];
    const ctx = {
        inlinePlanDropdown: dropdown,
        inlinePlanTarget: { startIndex: 0, endIndex: 0, anchor: {} },
        timeSlots: [{}],
        mergedFields: new Map(),
        plannedActivities: [
            { id: 'exercise', name: 'Exercise', label: 'Exercise', normalizedName: 'Exercise', parentId: null, pinned: false, archived: false, usageCount: 0, lastUsedAt: null, source: 'local' },
            { id: 'stretch', name: 'Stretch', label: 'Stretch', normalizedName: 'Stretch', parentId: null, pinned: false, archived: false, usageCount: 5, lastUsedAt: '2026-01-01T00:00:00.000Z', source: 'local' },
            { id: 'squat', name: 'Squat', label: 'Squat', normalizedName: 'Squat', parentId: 'exercise', pinned: false, archived: false, usageCount: 0, lastUsedAt: null, source: 'local' },
        ],
        normalizeActivityText(value) { return String(value || '').trim(); },
        groupActivityBoard(entries) { return controller.groupActivityBoard.call(this, entries); },
        renderTimeEntries() {},
        calculateTotals() {},
        autoSave() {},
        positionInlinePlanDropdown() {},
        dedupeAndSortPlannedActivities() {},
        savePlannedActivities() { saveCalls.push('save'); },
        renderInlinePlanDropdownOptions() {},
    };
    ctx.touchPlannedActivityUsage = controller.touchPlannedActivityUsage;
    globalThis.document = { createElement: createInlineSelectionNode, querySelector() { return null; } };
    try {
        controller.renderInlinePlanDropdownOptions.call(ctx);
        assert.equal(findNode(board, (node) => node.dataset && node.dataset.boardSection === 'recent'), null);
        const exerciseChip = findNode(board, (node) => node.dataset && node.dataset.activityId === 'exercise');
        exerciseChip.children[0].dispatchEvent({ type: 'click', preventDefault() {}, stopPropagation() {} });
        assert.equal(ctx.plannedActivities[0].usageCount, 1);
        assert.match(ctx.plannedActivities[0].lastUsedAt, /^\d{4}-\d{2}-\d{2}T/);
        assert.equal(saveCalls.length, 1);
        controller.renderInlinePlanDropdownOptions.call(ctx);
        assert.equal(findNode(board, (node) => node.dataset && node.dataset.boardSection === 'recent'), null);
    } finally {
        globalThis.document = originalDocument;
    }
});
