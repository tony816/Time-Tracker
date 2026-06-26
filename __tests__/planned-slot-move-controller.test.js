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
    assert.equal(typeof controller.initPlannedSlotClearModeControls, 'function');
    assert.equal(typeof controller.initPlannedSlotShiftModeControls, 'function');
    assert.equal(typeof controller.setPlannedSlotMoveMode, 'function');
    assert.equal(typeof controller.setPlannedSlotClearMode, 'function');
    assert.equal(typeof controller.setPlannedSlotShiftMode, 'function');
    assert.equal(typeof controller.togglePlannedSlotMoveMode, 'function');
    assert.equal(typeof controller.togglePlannedSlotClearMode, 'function');
    assert.equal(typeof controller.togglePlannedSlotShiftMode, 'function');
    assert.equal(typeof controller.isPlannedSlotMoveMode, 'function');
    assert.equal(typeof controller.isPlannedSlotClearMode, 'function');
    assert.equal(typeof controller.isPlannedSlotShiftMode, 'function');
    assert.equal(typeof controller.attachPlannedSlotMoveListeners, 'function');
    assert.equal(typeof controller.attachPlannedSlotClearListeners, 'function');
    assert.equal(typeof controller.attachPlannedSlotShiftListeners, 'function');
    assert.equal(typeof controller.movePlannedSlotBlock, 'function');
    assert.equal(typeof controller.clearPlannedSlotContents, 'function');
    assert.equal(typeof controller.shiftPlannedSlotsDownFrom, 'function');
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

function createLargeCtx(slotCount = 20) {
    const ctx = createCtx();
    ctx.timeSlots = Array.from({ length: slotCount }, (_, index) => createSlot(String(index)));
    return ctx;
}

test('shift mode is mutually exclusive with move and clear modes', () => {
    const originalDocument = global.document;
    const root = { classList: { toggle() {} } };
    global.document = {
        documentElement: root,
        body: root,
        querySelector() { return root; },
        getElementById() { return root; },
        querySelectorAll() { return []; },
    };
    try {
        const ctx = createCtx();
        ctx.renderTimeEntries = () => {};
        ctx.clearPlannedSegmentReorderState = () => {};
        ctx.plannedSlotMovePulseShown = true;
        controller.setPlannedSlotMoveMode.call(ctx, true);
        assert.equal(ctx.plannedSlotMoveMode, true);
        controller.setPlannedSlotShiftMode.call(ctx, true);
        assert.equal(ctx.plannedSlotShiftMode, true);
        assert.equal(ctx.plannedSlotMoveMode, false);
        controller.setPlannedSlotClearMode.call(ctx, true);
        assert.equal(ctx.plannedSlotClearMode, true);
        assert.equal(ctx.plannedSlotShiftMode, false);
    } finally {
        global.document = originalDocument;
    }
});

test('shifting from first affected row pushes consecutive planned slots down one hour', () => {
    const ctx = createLargeCtx(20);
    [12, 13, 14, 15, 16].forEach((index) => {
        ctx.timeSlots[index].planned = `Plan ${index}`;
    });

    assert.equal(controller.shiftPlannedSlotsDownFrom.call(ctx, 12), true);
    assert.equal(ctx.timeSlots[12].planned, '');
    [13, 14, 15, 16, 17].forEach((index, offset) => {
        assert.equal(ctx.timeSlots[index].planned, `Plan ${12 + offset}`);
    });
    assert.equal(ctx.renderCalls, 1);
    assert.equal(ctx.totalCalls, 1);
    assert.equal(ctx.saveCalls, 1);
});

test('shifting from a later pivot leaves earlier planned blocks unchanged', () => {
    const ctx = createLargeCtx(20);
    [12, 13, 14, 15, 16].forEach((index) => {
        ctx.timeSlots[index].planned = `Plan ${index}`;
    });

    assert.equal(controller.shiftPlannedSlotsDownFrom.call(ctx, 14), true);
    assert.equal(ctx.timeSlots[12].planned, 'Plan 12');
    assert.equal(ctx.timeSlots[13].planned, 'Plan 13');
    assert.equal(ctx.timeSlots[14].planned, '');
    assert.equal(ctx.timeSlots[15].planned, 'Plan 14');
    assert.equal(ctx.timeSlots[16].planned, 'Plan 15');
    assert.equal(ctx.timeSlots[17].planned, 'Plan 16');
});

test('empty pivot row shifts later planned blocks', () => {
    const ctx = createLargeCtx(8);
    ctx.timeSlots[4].planned = 'Later';

    assert.equal(controller.shiftPlannedSlotsDownFrom.call(ctx, 2), true);
    assert.equal(ctx.timeSlots[4].planned, '');
    assert.equal(ctx.timeSlots[5].planned, 'Later');
});

test('merged planned block shifts as one block and remaps merge metadata', () => {
    const ctx = createLargeCtx(8);
    ctx.timeSlots[1].planned = 'A';
    ctx.timeSlots[1].planMergeSnapshot = { mergeKey: 'planned-1-2', startIndex: 1, endIndex: 2, rangeStart: 1, rangeEnd: 2 };
    ctx.timeSlots[2].planned = 'B';
    ctx.mergedFields.set('planned-1-2', 'Merged AB');
    ctx.mergedFields.set('time-1-2', '1-2');
    ctx.mergedFields.set('actual-1-2', 'Actual AB');

    assert.equal(controller.shiftPlannedSlotsDownFrom.call(ctx, 1), true);
    assert.equal(ctx.mergedFields.has('planned-1-2'), false);
    assert.equal(ctx.mergedFields.get('planned-2-3'), 'Merged AB');
    assert.equal(ctx.mergedFields.get('time-2-3'), '2-3');
    assert.equal(ctx.mergedFields.get('actual-2-3'), 'Actual AB');
    assert.equal(ctx.timeSlots[2].planMergeSnapshot.mergeKey, 'planned-2-3');
    assert.equal(ctx.timeSlots[2].planMergeSnapshot.startIndex, 2);
    assert.equal(ctx.timeSlots[2].planMergeSnapshot.endIndex, 3);
    assert.equal(ctx.timeSlots[2].planMergeSnapshot.rangeStart, 2);
    assert.equal(ctx.timeSlots[2].planMergeSnapshot.rangeEnd, 3);
});

test('plan segment timers are preserved and remapped during shift', () => {
    const ctx = createLargeCtx(6);
    ctx.timeSlots[2].planned = 'Timed';
    ctx.timeSlots[2].planSegmentTimers = { 'planned-2-2-seg0': { status: 'idle', elapsedSeconds: 44 } };

    assert.equal(controller.shiftPlannedSlotsDownFrom.call(ctx, 2), true);
    assert.deepEqual(ctx.timeSlots[2].planSegmentTimers, {});
    assert.equal(ctx.timeSlots[3].planSegmentTimers['planned-3-3-seg0'].elapsedSeconds, 44);
});

test('shift rejects overflow without mutating planned data', () => {
    const ctx = createLargeCtx(5);
    ctx.timeSlots[4].planned = 'End';

    assert.equal(controller.shiftPlannedSlotsDownFrom.call(ctx, 4), false);
    assert.equal(ctx.timeSlots[4].planned, 'End');
    assert.equal(ctx.renderCalls, 0);
});

test('shift rejects active planned segment timers without mutating planned data', () => {
    const ctx = createLargeCtx(6);
    ctx.timeSlots[2].planned = 'Running';
    ctx.timeSlots[2].planSegmentTimers = { 'planned-2-2-seg0': { status: 'active', running: false } };

    assert.equal(controller.shiftPlannedSlotsDownFrom.call(ctx, 2), false);
    assert.equal(ctx.timeSlots[2].planned, 'Running');
    assert.equal(ctx.renderCalls, 0);
});

test('shift preserves actual activityLog contents', () => {
    const ctx = createLargeCtx(6);
    ctx.timeSlots[2].planned = 'Planned';
    ctx.timeSlots[2].activityLog = { title: 'Actual stays', details: 'Done' };
    const originalActivityLog = ctx.timeSlots[2].activityLog;

    assert.equal(controller.shiftPlannedSlotsDownFrom.call(ctx, 2), true);
    assert.equal(ctx.timeSlots[2].activityLog, originalActivityLog);
    assert.deepEqual(ctx.timeSlots[2].activityLog, { title: 'Actual stays', details: 'Done' });
    assert.deepEqual(ctx.timeSlots[3].activityLog, {});
});

test('empty shift range is a no-op with light notification', () => {
    const ctx = createLargeCtx(5);

    assert.equal(controller.shiftPlannedSlotsDownFrom.call(ctx, 1), false);
    assert.equal(ctx.renderCalls, 0);
    assert.equal(ctx.notifications[0], '밀 계획이 없습니다.');
});

function createFakeShiftButton({ buttonIndex = '0', hostIndex = '0' } = {}) {
    const listeners = new Map();
    const host = {
        dataset: { index: hostIndex, plannedSlotHost: 'true', plannedSlotShiftTarget: 'true' },
        className: 'split-cell-wrapper split-type-planned planned-slot-shift-target',
    };
    const button = {
        dataset: { index: buttonIndex },
        listeners,
        closest(selector) {
            if (selector === '.planned-slot-shift-btn') return button;
            if (selector === '.split-grid-segment') return null;
            if (selector === '[class*="plan-segment"]') return null;
            if (selector === '[data-planned-slot-shift-target="true"]') return host;
            return null;
        },
        addEventListener(type, listener) {
            if (!listeners.has(type)) listeners.set(type, []);
            listeners.get(type).push(listener);
        },
        dispatch(type) {
            const event = {
                type,
                defaultPrevented: false,
                propagationStopped: false,
                immediateStopped: false,
                preventDefault() { this.defaultPrevented = true; },
                stopPropagation() { this.propagationStopped = true; },
                stopImmediatePropagation() {
                    this.immediateStopped = true;
                    this.propagationStopped = true;
                },
            };
            for (const listener of listeners.get(type) || []) {
                listener(event);
                if (event.immediateStopped) break;
            }
            return event;
        },
    };
    const entryDiv = {
        querySelector(selector) { return selector === '.planned-slot-shift-btn' ? button : null; },
        querySelectorAll() { return [button]; },
    };
    return { button, entryDiv, host };
}

test('shift button belongs to the planned slot host and not to any segment node', () => {
    const { button, host } = createFakeShiftButton();
    assert.equal(button.closest('.split-grid-segment'), null);
    assert.equal(button.closest('[class*="plan-segment"]'), null);
    assert.equal(button.closest('[data-planned-slot-shift-target="true"]'), host);
});

test('clicking rendered shift button shifts and stops slot interaction events', () => {
    const ctx = createLargeCtx(5);
    ctx.plannedSlotShiftMode = true;
    ctx.timeSlots[1].planned = 'Shift me';
    const { button, entryDiv } = createFakeShiftButton({ buttonIndex: '1', hostIndex: '1' });

    controller.attachPlannedSlotShiftListeners.call(ctx, entryDiv, 1);
    controller.attachPlannedSlotShiftListeners.call(ctx, entryDiv, 1);

    assert.equal(button.dataset.shiftListenerAttached, 'true');
    assert.equal((button.listeners.get('click') || []).length, 1);
    const downEvent = button.dispatch('pointerdown');
    assert.equal(downEvent.defaultPrevented, true);
    assert.equal(downEvent.immediateStopped, true);

    const clickEvent = button.dispatch('click');
    assert.equal(clickEvent.defaultPrevented, true);
    assert.equal(clickEvent.immediateStopped, true);
    assert.equal(ctx.timeSlots[1].planned, '');
    assert.equal(ctx.timeSlots[2].planned, 'Shift me');
    assert.equal(ctx.renderCalls, 1);
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

test('move mode dragging from segment surface creates full-slot preview without segment insertion UI', () => {
    const { originalDocument, documentListeners, body, rows, createTarget } = createMoveDomHarness();
    try {
        const ctx = createCtx();
        ctx.plannedSlotMoveMode = true;
        ctx.timeSlots[1].planned = 'Block';
        ctx.timeSlots[1].planActivities = [{ label: 'Focus', startMinute: 0, endMinute: 60 }];
        ctx.getIndexAtClientPosition = () => 3;
        const target = createTarget({ left: 20, top: 30, width: 260, height: 140 });
        const segment = { className: 'split-grid-segment', dataset: { segmentKind: 'real-plan' } };
        const entry = {
            querySelectorAll() { return []; },
            querySelector(selector) {
                return selector.includes('split-cell-wrapper') ? target : null;
            },
        };

        controller.attachPlannedSlotMoveListeners.call(ctx, entry, 1);
        target._listeners.pointerdown({
            type: 'pointerdown',
            target: segment,
            button: 0,
            pointerId: 17,
            clientX: 80,
            clientY: 75,
            preventDefault() {},
            stopPropagation() {},
        });
        documentListeners.pointermove({
            type: 'pointermove',
            target: segment,
            pointerId: 17,
            clientX: 130,
            clientY: 155,
            preventDefault() {},
        });

        const preview = body.children[0];
        assert.ok(preview);
        assert.match(preview.className, /planned-slot-move-drag-preview/);
        assert.match(preview.className, /planned-slot-move-preview/);
        assert.doesNotMatch(preview.className, /plan-segment-reorder-drag-ghost/);
        assert.equal(preview.style.width, '260px');
        assert.equal(preview.style.height, '140px');
        assert.equal(preview.style.minHeight, '140px');
        assert.equal(rows.get(3).classList.contains('planned-slot-move-drop-valid'), true);
        assert.equal(body.querySelectorAll ? body.querySelectorAll('.plan-segment-reorder-insert-marker').length : 0, 0);
    } finally {
        global.document = originalDocument;
    }
});

test('dragging from nested segment in move mode clones planned slot root and uses card rect', () => {
    const { originalDocument, documentListeners, body, createTarget } = createMoveDomHarness();
    try {
        const ctx = createCtx();
        ctx.plannedSlotMoveMode = true;
        ctx.timeSlots[1].planned = 'Block';
        ctx.getIndexAtClientPosition = () => 3;
        const target = createTarget({ left: 10, top: 20, width: 280, height: 180 });
        const segment = {
            className: 'split-grid-segment',
            dataset: { segmentKind: 'real-plan' },
            getBoundingClientRect() { return { left: 40, top: 55, width: 92, height: 34 }; },
            cloneNode() {
                return { className: 'segment-only-clone', dataset: {}, style: {}, classList: { add() {}, remove() {} }, querySelectorAll() { return []; }, setAttribute() {}, removeAttribute() {} };
            },
            closest(selector) {
                return selector === '.planned-slot-move-target' ? target : null;
            },
        };
        const entry = {
            querySelectorAll() { return []; },
            querySelector(selector) {
                return selector.includes('split-cell-wrapper') ? target : null;
            },
        };

        controller.attachPlannedSlotMoveListeners.call(ctx, entry, 1);
        target._listeners.pointerdown({
            type: 'pointerdown',
            target: segment,
            button: 0,
            pointerId: 21,
            clientX: 70,
            clientY: 80,
            preventDefault() {},
            stopPropagation() {},
        });
        documentListeners.pointermove({
            type: 'pointermove',
            target: segment,
            pointerId: 21,
            clientX: 120,
            clientY: 130,
            preventDefault() {},
        });

        const preview = body.children[0];
        assert.ok(preview);
        assert.doesNotMatch(preview.className, /segment-only-clone/);
        assert.match(preview.className, /split-cell-wrapper/);
        assert.match(preview.className, /planned-slot-move-preview/);
        assert.match(preview.className, /planned-slot-move-drag-preview/);
        assert.doesNotMatch(preview.className, /plan-segment-reorder-drag-ghost/);
        assert.equal(preview.style.width, '280px');
        assert.equal(preview.style.height, '180px');
        assert.equal(preview.style.minHeight, '180px');
        assert.match(preview.style.transform, /translate3d\(60px, 70px, 0\)/);
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
        assert.equal(body.children[0].style.height, '240px');
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
    assert.match(css, /\.planned-slot-move-mode \.planned-slot-move-target \.split-grid-segment[\s\S]*pointer-events:\s*none !important/);
    assert.match(css, /\.planned-slot-move-mode \.planned-slot-move-target \.plan-segment-graphic \*[\s\S]*pointer-events:\s*none !important/);
    assert.match(css, /\.planned-slot-move-preview\s*\{[\s\S]*background:/);
    assert.match(css, /\.planned-slot-move-preview\s*\{[\s\S]*border:/);
    assert.match(css, /\.planned-slot-move-preview\s*\{[\s\S]*box-shadow:/);
    assert.match(css, /\.planned-slot-move-preview\s*\{[\s\S]*border-radius:/);
    assert.doesNotMatch(css, /\.planned-slot-move-preview[\s\S]*plan-segment-reorder-drag-ghost/);
});

test('move mode suppresses native selection callout and drag only while active', () => {
    const { originalDocument, createTarget } = createMoveDomHarness();
    try {
        const ctx = createCtx();
        ctx.plannedSlotMoveMode = true;
        ctx.timeSlots[1].planned = 'Block';
        const target = createTarget();
        const entry = {
            querySelectorAll() { return []; },
            querySelector(selector) {
                return selector.includes('split-cell-wrapper') ? target : null;
            },
        };
        const createGestureEvent = () => ({
            defaultPrevented: false,
            propagationStopped: false,
            preventDefault() { this.defaultPrevented = true; },
            stopPropagation() { this.propagationStopped = true; },
        });

        controller.attachPlannedSlotMoveListeners.call(ctx, entry, 1);

        const selectEvent = createGestureEvent();
        target._listeners.selectstart(selectEvent);
        const calloutEvent = createGestureEvent();
        target._listeners.contextmenu(calloutEvent);
        const dragEvent = createGestureEvent();
        target._listeners.dragstart(dragEvent);

        assert.equal(selectEvent.defaultPrevented, true);
        assert.equal(calloutEvent.defaultPrevented, true);
        assert.equal(dragEvent.defaultPrevented, true);

        ctx.plannedSlotMoveMode = false;
        const inactiveSelectEvent = createGestureEvent();
        target._listeners.selectstart(inactiveSelectEvent);
        assert.equal(inactiveSelectEvent.defaultPrevented, false);
    } finally {
        global.document = originalDocument;
    }
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
