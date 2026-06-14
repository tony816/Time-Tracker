const test = require('node:test');
const assert = require('node:assert/strict');

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
    assert.equal(ctx.notifications[0], '실행 중인 타이머가 있어 이동할 수 없습니다.');
});

test('move mode attaches planned-slot move handle only to movable base row', () => {
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
        const createEntry = (children) => ({
            querySelector(selector) {
                if (selector.includes('split-cell-wrapper')) {
                    return {
                        appendChild(child) {
                            children.push(child);
                        },
                    };
                }
                return null;
            },
        });

        controller.attachPlannedSlotMoveListeners.call(ctx, createEntry(baseChildren), 1);
        controller.attachPlannedSlotMoveListeners.call(ctx, createEntry(continuationChildren), 2);

        assert.equal(baseChildren.length, 1);
        assert.equal(baseChildren[0].className, 'planned-slot-move-handle');
        assert.equal(baseChildren[0].attributes['aria-label'], '계획 슬롯 이동');
        assert.equal(continuationChildren.length, 0);
        assert.equal(created.length, 1);
    } finally {
        global.document = originalDocument;
    }
});
