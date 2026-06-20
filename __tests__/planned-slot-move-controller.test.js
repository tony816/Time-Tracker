const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const controller = require('../controllers/planned-slot-move-controller');

function createSlot(time, overrides = {}) {
    return {
        time,
        planned: '',
        actual: '',
        planActivities: [],
        planTitle: '',
        planTitleBandOn: false,
        planSegmentTimers: {},
        activityLog: {},
        timer: { running: false, status: 'idle' },
        ...overrides,
    };
}

function createCtx() {
    const ctx = {
        timeSlots: [
            createSlot('4'),
            createSlot('5'),
            createSlot('6'),
            createSlot('7'),
            createSlot('8'),
        ],
        mergedFields: new Map(),
        renderCalls: 0,
        totalCalls: 0,
        saveCalls: 0,
        notifications: [],
        findMergeKey(type, index) {
            for (const key of this.mergedFields.keys()) {
                if (!key.startsWith(`${type}-`)) continue;
                const [, startText, endText] = key.split('-');
                const start = parseInt(startText, 10);
                const end = parseInt(endText, 10);
                if (index >= start && index <= end) return key;
            }
            return null;
        },
        resolvePlannedSlotContext(index) {
            const mergeKey = this.findMergeKey('planned', index);
            if (!mergeKey) {
                return { baseIndex: index, rangeStart: index, rangeEnd: index, mergeKey: null, slotCount: 1, blockMinutes: 60, isMerged: false };
            }
            const [, startText, endText] = mergeKey.split('-');
            const start = parseInt(startText, 10);
            const end = parseInt(endText, 10);
            return { baseIndex: start, rangeStart: start, rangeEnd: end, mergeKey, slotCount: end - start + 1, blockMinutes: (end - start + 1) * 60, isMerged: true };
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
        showNotification(message) {
            this.notifications.push(message);
        },
    };
    return ctx;
}

test('planned slot move controller exports and attaches to global', () => {
    assert.equal(typeof controller.initPlannedSlotMoveModeControls, 'function');
    assert.equal(typeof controller.setPlannedSlotMoveMode, 'function');
    assert.equal(typeof controller.togglePlannedSlotMoveMode, 'function');
    assert.equal(typeof controller.isPlannedSlotMoveMode, 'function');
    assert.equal(typeof controller.attachPlannedSlotMoveListeners, 'function');
    assert.equal(typeof controller.movePlannedSlotBlock, 'function');
    assert.equal(globalThis.TimeTrackerPlannedSlotMoveController.movePlannedSlotBlock, controller.movePlannedSlotBlock);
});

test('getPlannedSlotMoveContext rejects empty slot', () => {
    const ctx = createCtx();
    const moveContext = controller.getPlannedSlotMoveContext.call(ctx, 1);
    assert.equal(moveContext.movable, false);
    assert.equal(moveContext.blockLength, 1);
});

test('single planned slot moves to empty target preserving planned fields', () => {
    const ctx = createCtx();
    ctx.timeSlots[0].planned = 'Write';
    ctx.timeSlots[0].planActivities = [{ id: 'a', name: 'Draft' }];
    ctx.timeSlots[0].planTitle = 'Focus';
    ctx.timeSlots[0].planTitleBandOn = true;
    ctx.timeSlots[0].planSegmentTimers = { 'planned-0-0-seg0': { status: 'idle', elapsedSeconds: 90 } };

    assert.equal(controller.movePlannedSlotBlock.call(ctx, 0, 3), true);
    assert.equal(ctx.timeSlots[0].planned, '');
    assert.equal(ctx.timeSlots[3].planned, 'Write');
    assert.deepEqual(ctx.timeSlots[3].planActivities, [{ id: 'a', name: 'Draft' }]);
    assert.equal(ctx.timeSlots[3].planTitle, 'Focus');
    assert.equal(ctx.timeSlots[3].planTitleBandOn, true);
    assert.equal(ctx.timeSlots[3].planSegmentTimers['planned-3-3-seg0'].elapsedSeconds, 90);
    assert.equal(ctx.renderCalls, 1);
    assert.equal(ctx.totalCalls, 1);
    assert.equal(ctx.saveCalls, 1);
});

test('merged planned block moves as one block and remaps merge keys', () => {
    const ctx = createCtx();
    ctx.timeSlots[0].planned = 'Plan A';
    ctx.timeSlots[0].planActivities = [{ name: 'A' }];
    ctx.timeSlots[0].planMergeSnapshot = { mergeKey: 'planned-0-1', startIndex: 0, endIndex: 1 };
    ctx.timeSlots[1].planned = 'Plan B';
    ctx.mergedFields.set('planned-0-1', 'Merged plan');
    ctx.mergedFields.set('time-0-1', '4-5');
    ctx.mergedFields.set('actual-0-1', 'Legacy actual');

    assert.equal(controller.movePlannedSlotBlock.call(ctx, 0, 3), true);
    assert.equal(ctx.mergedFields.has('planned-0-1'), false);
    assert.equal(ctx.mergedFields.get('planned-3-4'), 'Merged plan');
    assert.equal(ctx.mergedFields.get('time-3-4'), '7-8');
    assert.equal(ctx.mergedFields.get('actual-3-4'), 'Legacy actual');
    assert.equal(ctx.timeSlots[3].planMergeSnapshot.mergeKey, 'planned-3-4');
    assert.equal(ctx.timeSlots[3].planMergeSnapshot.startIndex, 3);
    assert.equal(ctx.timeSlots[3].planMergeSnapshot.endIndex, 4);
});

test('destination collision blocks move', () => {
    const ctx = createCtx();
    ctx.timeSlots[0].planned = 'Source';
    ctx.timeSlots[3].planned = 'Occupied';

    assert.equal(controller.movePlannedSlotBlock.call(ctx, 0, 3), false);
    assert.equal(ctx.timeSlots[0].planned, 'Source');
    assert.equal(ctx.timeSlots[3].planned, 'Occupied');
    assert.equal(ctx.renderCalls, 0);
});

test('overlapping self move is handled safely', () => {
    const ctx = createCtx();
    ctx.timeSlots[1].planned = 'One';
    ctx.timeSlots[2].planned = 'Two';
    ctx.mergedFields.set('planned-1-2', 'Both');

    assert.equal(controller.movePlannedSlotBlock.call(ctx, 1, 2), true);
    assert.equal(ctx.mergedFields.has('planned-1-2'), false);
    assert.equal(ctx.mergedFields.get('planned-2-3'), 'Both');
    assert.equal(ctx.timeSlots[1].planned, '');
    assert.equal(ctx.timeSlots[2].planned, 'One');
    assert.equal(ctx.timeSlots[3].planned, 'Two');
});

test('active plan segment timer blocks move', () => {
    const ctx = createCtx();
    ctx.timeSlots[0].planned = 'Source';
    ctx.timeSlots[0].planSegmentTimers = { 'planned-0-0-seg0': { status: 'paused', running: false } };

    assert.equal(controller.movePlannedSlotBlock.call(ctx, 0, 3), false);
    assert.equal(ctx.timeSlots[0].planned, 'Source');
    assert.equal(ctx.notifications[0], '\uC2E4\uD589 \uC911\uC778 \uD0C0\uC774\uBA38\uAC00 \uC788\uC5B4 \uC774\uB3D9\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.');
});

test('move mode marks planned slot wrapper only on movable base row', () => {
    const originalDocument = global.document;
    const created = [];
    global.document = {
        createElement(tagName) {
            const node = {
                tagName,
                className: '',
                dataset: {},
                attributes: {},
                textContent: '',
                setAttribute(name, value) {
                    this.attributes[name] = value;
                },
                addEventListener() {},
            };
            created.push(node);
            return node;
        },
    };
    try {
        const ctx = createCtx();
        ctx.plannedSlotMoveMode = true;
        ctx.timeSlots[1].planned = 'Block';
        ctx.timeSlots[1].planActivities = [{ name: 'Real segment' }];
        ctx.timeSlots[2].planned = 'Continuation';
        ctx.mergedFields.set('planned-1-2', 'Block');
        const baseChildren = [];
        const continuationChildren = [];
        const createEntry = (children) => {
            const segment = {
                className: 'split-grid-segment',
                dataset: { segmentKind: 'real-plan' },
                attributes: {},
                setAttribute(name, value) {
                    this.attributes[name] = value;
                },
                addEventListener() {},
            };
            segment.classList = {
                add(className) {
                    segment.className = `${segment.className} ${className}`.trim();
                    children.push(segment);
                },
                remove() {},
            };
            const wrapper = {
                className: 'split-cell-wrapper split-type-planned split-has-data',
                dataset: {},
                attributes: {},
                setAttribute(name, value) {
                    this.attributes[name] = value;
                },
                addEventListener() {},
            };
            wrapper.classList = {
                add(className) {
                    wrapper.className = `${wrapper.className} ${className}`.trim();
                    children.push(wrapper);
                },
                remove() {},
            };
            return ({
            querySelectorAll(selector) {
                if (selector !== '.split-grid-segment[data-segment-kind="real-plan"]') return [];
                return [segment];
            },
            querySelector(selector) {
                if (selector.includes('split-cell-wrapper')) {
                    return wrapper;
                }
                return null;
            },
        });
        };

        controller.attachPlannedSlotMoveListeners.call(ctx, createEntry(baseChildren), 1);
        controller.attachPlannedSlotMoveListeners.call(ctx, createEntry(continuationChildren), 2);

        assert.equal(baseChildren.length, 1);
        assert.match(baseChildren[0].className, /split-cell-wrapper/);
        assert.match(baseChildren[0].className, /planned-slot-move-target/);
        assert.equal(baseChildren[0].attributes['aria-label'], '\uACC4\uD68D \uC2AC\uB86F \uC774\uB3D9');
        assert.equal(continuationChildren.length, 0);
        assert.equal(created.length, 0);
    } finally {
        global.document = originalDocument;
    }
});

function createMoveDomHarness() {
    const originalDocument = global.document;
    const documentListeners = {};
    const rows = new Map();
    const body = {
        className: '',
        children: [],
        classList: {
            add(className) { body.className = `${body.className} ${className}`.trim(); },
            remove(className) { body.className = body.className.split(/\s+/).filter(item => item && item !== className).join(' '); },
        },
        appendChild(child) {
            child.parentNode = body;
            body.children.push(child);
            return child;
        },
        removeChild(child) {
            body.children = body.children.filter(item => item !== child);
            child.parentNode = null;
            return child;
        },
    };
    global.document = {
        body,
        documentElement: body,
        addEventListener(type, handler) {
            documentListeners[type] = handler;
        },
        removeEventListener(type, handler) {
            if (documentListeners[type] === handler) delete documentListeners[type];
        },
        querySelectorAll() {
            return [];
        },
        querySelector(selector) {
            const match = String(selector || '').match(/\.time-entry\[data-index="(\d+)"\]/);
            if (!match) return null;
            const index = Number(match[1]);
            if (!rows.has(index)) {
                const row = {
                    className: '',
                    classList: {
                        add(className) { row.className = `${row.className} ${className}`.trim(); },
                        remove(...classNames) {
                            const remove = new Set(classNames);
                            row.className = row.className.split(/\s+/).filter(item => item && !remove.has(item)).join(' ');
                        },
                        contains(className) { return row.className.split(/\s+/).includes(className); },
                    },
                };
                rows.set(index, row);
            }
            return rows.get(index);
        },
        createElement() {
            return {
                className: '',
                dataset: {},
                style: {},
                classList: { add() {}, remove() {} },
                setAttribute() {},
            };
        },
    };

    const createTarget = (rect = { left: 20, top: 30, width: 240, height: 120 }) => {
        const listeners = {};
        const clone = {
            className: 'split-cell-wrapper split-type-planned split-has-data',
            dataset: {},
            style: { setProperty(name, value) { this[name] = value; } },
            attributes: {},
            parentNode: null,
            classList: {
                add(className) { clone.className = `${clone.className} ${className}`.trim(); },
                remove(className) { clone.className = clone.className.split(/\s+/).filter(item => item && item !== className).join(' '); },
            },
            removeAttribute(name) { delete clone.attributes[name]; },
            setAttribute(name, value) { clone.attributes[name] = value; },
            querySelectorAll() { return []; },
        };
        const target = {
            className: 'split-cell-wrapper split-type-planned split-has-data',
            dataset: {},
            style: {},
            attributes: {},
            _listeners: listeners,
            classList: {
                add(className) { target.className = `${target.className} ${className}`.trim(); },
                remove(className) { target.className = target.className.split(/\s+/).filter(item => item && item !== className).join(' '); },
            },
            setAttribute(name, value) { target.attributes[name] = value; },
            addEventListener(type, handler) { listeners[type] = handler; },
            setPointerCapture(pointerId) { target.capturedPointerId = pointerId; },
            releasePointerCapture(pointerId) { target.releasedPointerId = pointerId; },
            getBoundingClientRect() { return rect; },
            cloneNode() { return clone; },
            querySelectorAll() { return []; },
        };
        return target;
    };

    return { originalDocument, documentListeners, body, rows, createTarget };
}

test('whole planned slot wrapper starts move drag and keeps full preview until release', () => {
    const { originalDocument, documentListeners, body, createTarget } = createMoveDomHarness();
    try {
        const ctx = createCtx();
        ctx.plannedSlotMoveMode = true;
        ctx.timeSlots[1].planned = 'Block';
        ctx.getIndexAtClientPosition = () => 3;
        const target = createTarget();
        const entry = {
            querySelectorAll() { return []; },
            querySelector(selector) {
                return selector.includes('split-cell-wrapper') ? target : null;
            },
        };

        controller.attachPlannedSlotMoveListeners.call(ctx, entry, 1);
        target._listeners.pointerdown({
            type: 'pointerdown',
            target,
            button: 0,
            pointerId: 7,
            clientX: 40,
            clientY: 50,
            preventDefault() {},
            stopPropagation() {},
        });
        assert.equal(typeof documentListeners.pointermove, 'function');
        documentListeners.pointermove({
            type: 'pointermove',
            target: body,
            pointerId: 7,
            clientX: 125,
            clientY: 145,
            preventDefault() {},
        });

        assert.equal(body.children.length, 1);
        assert.match(body.children[0].className, /planned-slot-move-drag-preview/);
        assert.equal(body.children[0].style.width, '240px');
        assert.equal(body.children[0].style.minHeight, '120px');
        assert.match(body.children[0].style.transform, /translate3d\(105px, 125px, 0\)/);
        assert.equal(ctx.plannedSlotMoveDrag.dragging, true);
        assert.equal(ctx.plannedSlotMoveDrag.targetStart, 3);

        documentListeners.pointerup({
            type: 'pointerup',
            target: body,
            pointerId: 7,
            preventDefault() {},
            stopPropagation() {},
        });

        assert.equal(body.children.length, 0);
        assert.equal(ctx.timeSlots[3].planned, 'Block');
        assert.equal(ctx.plannedSlotMoveDrag, null);
    } finally {
        global.document = originalDocument;
    }
});

test('touch pointer starts move drag from the slot body without a handle', () => {
    const { originalDocument, documentListeners, body, createTarget } = createMoveDomHarness();
    try {
        const ctx = createCtx();
        ctx.plannedSlotMoveMode = true;
        ctx.timeSlots[1].planned = 'Touch block';
        ctx.getIndexAtClientPosition = () => 3;
        const target = createTarget();
        const entry = {
            querySelectorAll() { return []; },
            querySelector(selector) {
                return selector.includes('split-cell-wrapper') ? target : null;
            },
        };

        controller.attachPlannedSlotMoveListeners.call(ctx, entry, 1);
        target._listeners.pointerdown({
            type: 'pointerdown',
            target,
            button: 0,
            pointerId: 9,
            pointerType: 'touch',
            clientX: 70,
            clientY: 80,
            preventDefault() {},
            stopPropagation() {},
        });
        documentListeners.pointermove({
            type: 'pointermove',
            target: body,
            pointerId: 9,
            pointerType: 'touch',
            clientX: 90,
            clientY: 116,
            preventDefault() {},
        });

        assert.equal(ctx.plannedSlotMoveDrag.dragging, true);
        assert.equal(body.children.length, 1);
        assert.match(body.children[0].className, /planned-slot-move-drag-preview/);
    } finally {
        global.document = originalDocument;
    }
});

test('merged planned slot drag preserves preview height and highlights full target duration', () => {
    const { originalDocument, documentListeners, body, rows, createTarget } = createMoveDomHarness();
    try {
        const ctx = createCtx();
        ctx.plannedSlotMoveMode = true;
        ctx.timeSlots[1].planned = 'Merged A';
        ctx.timeSlots[2].planned = 'Merged B';
        ctx.mergedFields.set('planned-1-2', 'Merged block');
        ctx.getIndexAtClientPosition = () => 3;
        const target = createTarget({ left: 20, top: 30, width: 240, height: 240 });
        const entry = {
            querySelectorAll() { return []; },
            querySelector(selector) {
                return selector.includes('split-cell-wrapper') ? target : null;
            },
        };

        controller.attachPlannedSlotMoveListeners.call(ctx, entry, 1);
        target._listeners.pointerdown({
            type: 'pointerdown',
            target,
            button: 0,
            pointerId: 11,
            clientX: 40,
            clientY: 50,
            preventDefault() {},
            stopPropagation() {},
        });
        documentListeners.pointermove({
            type: 'pointermove',
            target: body,
            pointerId: 11,
            clientX: 120,
            clientY: 180,
            preventDefault() {},
        });

        assert.equal(body.children[0].style.minHeight, '240px');
        assert.equal(ctx.plannedSlotMoveDrag.sourceContext.blockLength, 2);
        assert.equal(ctx.plannedSlotMoveDrag.targetStart, 3);
        assert.equal(rows.get(3).classList.contains('planned-slot-move-drop-valid'), true);
        assert.equal(rows.get(4).classList.contains('planned-slot-move-drop-valid'), true);
    } finally {
        global.document = originalDocument;
    }
});

test('move mode renders no persistent move handle rail grip or tab css', () => {
    const css = fs.readFileSync(path.join(__dirname, '..', 'styles', 'interactions.css'), 'utf8');
    assert.doesNotMatch(css, /\.planned-slot-move-target::before/);
    assert.doesNotMatch(css, /\.planned-slot-move-target::after/);
    assert.doesNotMatch(css, /planned-slot-move-handle|move-rail|move-grip/);
    assert.match(css, /\.planned-slot-move-target\s*\{/);
    assert.match(css, /cursor:\s*grab;/);
});

test('move mode pulse is armed only on first entry', () => {
    const originalDocument = global.document;
    const originalSetTimeout = global.setTimeout;
    const roots = [];
    const createRoot = () => {
        const root = {
            className: '',
            classList: {
                toggle(className, enabled) {
                    const classes = new Set(root.className.split(/\s+/).filter(Boolean));
                    if (enabled) classes.add(className);
                    else classes.delete(className);
                    root.className = Array.from(classes).join(' ');
                },
                contains(className) {
                    return root.className.split(/\s+/).includes(className);
                },
            },
        };
        roots.push(root);
        return root;
    };
    const html = createRoot();
    const body = createRoot();
    const timesheet = createRoot();
    const entries = createRoot();
    global.document = {
        documentElement: html,
        body,
        querySelector(selector) {
            return selector === '.timesheet' ? timesheet : null;
        },
        getElementById(id) {
            return id === 'timeEntries' ? entries : null;
        },
        querySelectorAll() {
            return [];
        },
    };
    global.setTimeout = () => 1;
    try {
        const ctx = createCtx();
        ctx.renderTimeEntries = () => {};
        assert.equal(controller.setPlannedSlotMoveMode.call(ctx, true), true);
        assert.equal(ctx.plannedSlotMovePulseActive, true);
        assert.equal(body.classList.contains('planned-slot-move-pulse'), true);
        controller.setPlannedSlotMoveMode.call(ctx, false);
        assert.equal(ctx.plannedSlotMovePulseActive, false);
        assert.equal(controller.setPlannedSlotMoveMode.call(ctx, true), true);
        assert.equal(ctx.plannedSlotMovePulseActive, false);
        assert.equal(body.classList.contains('planned-slot-move-pulse'), false);
    } finally {
        global.document = originalDocument;
        global.setTimeout = originalSetTimeout;
    }
});
