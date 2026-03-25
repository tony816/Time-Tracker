const test = require('node:test');
const assert = require('node:assert/strict');

const controller = require('../controllers/actual-modal-controller');
const { buildMethod } = require('./helpers/script-method-builder');

const attachActualModalEventHandlersWrapper = buildMethod('attachActualModalEventHandlers()', '()');
const handleActualModalListClickWrapper = buildMethod('handleActualModalListClick(event)', '(event)');
const handleActualModalListChangeWrapper = buildMethod('handleActualModalListChange(event)', '(event)');
const handleActualModalListFocusInWrapper = buildMethod('handleActualModalListFocusIn(event)', '(event)');
const openActivityLogModalWrapper = buildMethod('openActivityLogModal(index)', '(index)');
const closeActivityLogModalWrapper = buildMethod('closeActivityLogModal(options = {})', '(options = {})');
const saveActivityLogFromModalWrapper = buildMethod('saveActivityLogFromModal()', '()');
const attachActivityModalEventListenersWrapper = buildMethod('attachActivityModalEventListeners()', '()');

test('actual-modal-controller exports and global attach include menu methods', () => {
    assert.ok(controller);
    assert.equal(typeof controller.attachActualModalEventHandlers, 'function');
    assert.equal(typeof controller.handleActualModalListClick, 'function');
    assert.equal(typeof controller.handleActualModalListChange, 'function');
    assert.equal(typeof controller.handleActualModalListFocusIn, 'function');
    assert.equal(typeof controller.openActivityLogModal, 'function');
    assert.equal(typeof controller.closeActivityLogModal, 'function');
    assert.equal(typeof controller.saveActivityLogFromModal, 'function');
    assert.equal(typeof controller.attachActivityModalEventListeners, 'function');
    assert.equal(typeof controller.openActualActivityMenu, 'function');
    assert.equal(typeof controller.positionActualActivityMenu, 'function');
    assert.equal(typeof controller.closeActualActivityMenu, 'function');
    assert.equal(
        globalThis.TimeTrackerActualModalController.attachActualModalEventHandlers,
        controller.attachActualModalEventHandlers
    );
    assert.equal(
        globalThis.TimeTrackerActualModalController.handleActualModalListClick,
        controller.handleActualModalListClick
    );
    assert.equal(
        globalThis.TimeTrackerActualModalController.handleActualModalListChange,
        controller.handleActualModalListChange
    );
    assert.equal(
        globalThis.TimeTrackerActualModalController.handleActualModalListFocusIn,
        controller.handleActualModalListFocusIn
    );
    assert.equal(
        globalThis.TimeTrackerActualModalController.openActivityLogModal,
        controller.openActivityLogModal
    );
    assert.equal(
        globalThis.TimeTrackerActualModalController.closeActivityLogModal,
        controller.closeActivityLogModal
    );
    assert.equal(
        globalThis.TimeTrackerActualModalController.saveActivityLogFromModal,
        controller.saveActivityLogFromModal
    );
    assert.equal(
        globalThis.TimeTrackerActualModalController.attachActivityModalEventListeners,
        controller.attachActivityModalEventListeners
    );
    assert.equal(
        globalThis.TimeTrackerActualModalController.openActualActivityMenu,
        controller.openActualActivityMenu
    );
    assert.equal(
        globalThis.TimeTrackerActualModalController.positionActualActivityMenu,
        controller.positionActualActivityMenu
    );
    assert.equal(
        globalThis.TimeTrackerActualModalController.closeActualActivityMenu,
        controller.closeActualActivityMenu
    );
});

test('closeActualActivityMenu tears down handlers and resets anchor state', () => {
    const removed = [];
    const originalDocument = global.document;
    const anchorCalls = [];
    const removedNodes = [];

    global.document = {
        removeEventListener(type, handler, capture) {
            removed.push({ type, handler, capture });
        },
    };

    const context = {
        actualActivityMenuOutsideHandler: () => {},
        actualActivityMenuEscHandler: () => {},
        actualActivityMenuContext: {
            anchorEl: {
                setAttribute(name, value) {
                    anchorCalls.push({ name, value });
                },
            },
        },
        actualActivityMenu: {
            parentNode: {
                removeChild(node) {
                    removedNodes.push(node);
                },
            },
        },
    };

    try {
        controller.closeActualActivityMenu.call(context);
    } finally {
        global.document = originalDocument;
    }

    assert.deepEqual(
        removed.map((entry) => [entry.type, entry.capture]),
        [['mousedown', true], ['keydown', undefined]]
    );
    assert.deepEqual(anchorCalls, [{ name: 'aria-expanded', value: 'false' }]);
    assert.equal(removedNodes.length, 1);
    assert.equal(context.actualActivityMenuOutsideHandler, null);
    assert.equal(context.actualActivityMenuEscHandler, null);
    assert.equal(context.actualActivityMenu, null);
    assert.equal(context.actualActivityMenuContext, null);
});

test('script actual modal event wrapper methods delegate to controller helpers', () => {
    const calls = [];
    const original = globalThis.TimeTrackerActualModalController;
    globalThis.TimeTrackerActualModalController = {
        attachActualModalEventHandlers() {
            calls.push(['attach', this]);
            return 'attach-result';
        },
        handleActualModalListClick(event) {
            calls.push(['click', this, event]);
            return 'click-result';
        },
        handleActualModalListChange(event) {
            calls.push(['change', this, event]);
            return 'change-result';
        },
        handleActualModalListFocusIn(event) {
            calls.push(['focusin', this, event]);
            return 'focus-result';
        },
        openActivityLogModal(index) {
            calls.push(['open', this, index]);
            return 'open-result';
        },
        closeActivityLogModal(options) {
            calls.push(['close', this, options]);
            return 'close-result';
        },
        saveActivityLogFromModal() {
            calls.push(['save', this]);
            return 'save-result';
        },
        attachActivityModalEventListeners() {
            calls.push(['attach-shell', this]);
            return 'attach-shell-result';
        },
    };

    const ctx = { id: 'tracker' };
    const clickEvent = { type: 'click' };
    const changeEvent = { type: 'change' };
    const focusEvent = { type: 'focusin' };
    const closeOptions = { force: true };

    try {
        assert.equal(attachActualModalEventHandlersWrapper.call(ctx), 'attach-result');
        assert.equal(handleActualModalListClickWrapper.call(ctx, clickEvent), 'click-result');
        assert.equal(handleActualModalListChangeWrapper.call(ctx, changeEvent), 'change-result');
        assert.equal(handleActualModalListFocusInWrapper.call(ctx, focusEvent), 'focus-result');
        assert.equal(openActivityLogModalWrapper.call(ctx, 3), 'open-result');
        assert.equal(closeActivityLogModalWrapper.call(ctx, closeOptions), 'close-result');
        assert.equal(saveActivityLogFromModalWrapper.call(ctx), 'save-result');
        assert.equal(attachActivityModalEventListenersWrapper.call(ctx), 'attach-shell-result');
    } finally {
        globalThis.TimeTrackerActualModalController = original;
    }

    assert.deepEqual(calls, [
        ['attach', ctx],
        ['click', ctx, clickEvent],
        ['change', ctx, changeEvent],
        ['focusin', ctx, focusEvent],
        ['open', ctx, 3],
        ['close', ctx, closeOptions],
        ['save', ctx],
        ['attach-shell', ctx],
    ]);
});

function createClassList(classNames = []) {
    const names = new Set(classNames);
    return {
        contains(name) {
            return names.has(name);
        },
    };
}

function createRow(index, classNames = []) {
    return {
        dataset: { index: String(index) },
        classList: createClassList(classNames),
    };
}

function createTarget({ selectors = [], row = null, dataset = {}, classNames = [], disabled = false, readOnly = false, value = '' } = {}) {
    return {
        dataset,
        disabled,
        readOnly,
        value,
        classList: createClassList(classNames),
        closest(selector) {
            if (selector === '.sub-activity-row') return row;
            return selectors.includes(selector) ? this : null;
        },
    };
}

test('attachActualModalEventHandlers wires add/click/change/focusin listeners', () => {
    const added = [];
    const list = {
        addEventListener(type, handler) {
            added.push({ type, handler });
        },
    };
    const addBtn = {
        addEventListener(type, handler) {
            added.push({ type: `add:${type}`, handler });
        },
    };
    const ctx = {
        getActualModalElements() {
            return { list, addBtn };
        },
        addActualActivityRow() {},
        handleActualModalListClick() {},
        handleActualModalListChange() {},
        handleActualModalListFocusIn() {},
    };

    controller.attachActualModalEventHandlers.call(ctx);

    assert.deepEqual(
        added.map((entry) => entry.type),
        ['add:click', 'click', 'change', 'focusin']
    );
});

test('handleActualModalListClick routes grid time buttons through active row update', () => {
    const calls = [];
    const row = createRow(2);
    const target = createTarget({
        selectors: ['.actual-time-btn'],
        row,
        dataset: { index: '2', direction: 'up', kind: 'grid' },
    });
    const ctx = {
        getActualModalElements() {
            return {
                list: {
                    contains(node) {
                        return node === row;
                    },
                },
            };
        },
        setActualActiveRow(index) {
            calls.push(['active', index]);
        },
        adjustActualGridDuration(index, direction) {
            calls.push(['grid', index, direction]);
        },
        adjustActualActivityDuration() {
            calls.push(['assign']);
        },
        moveActualActivityRow() {
            calls.push(['move']);
        },
        removeActualActivityRow() {
            calls.push(['remove']);
        },
        openActualActivityMenu() {
            calls.push(['menu']);
        },
    };

    controller.handleActualModalListClick.call(ctx, { target });

    assert.deepEqual(calls, [['active', 2], ['grid', 2, 1]]);
});

test('handleActualModalListClick ignores locked rows for reorder and removal', () => {
    const calls = [];
    const lockedRow = createRow(1, ['actual-row-locked']);
    const moveTarget = createTarget({
        selectors: ['.actual-move-btn'],
        row: lockedRow,
        dataset: { direction: 'up' },
    });
    const removeTarget = createTarget({
        selectors: ['.actual-remove-btn'],
        row: lockedRow,
    });
    const ctx = {
        getActualModalElements() {
            return {
                list: {
                    contains(node) {
                        return node === lockedRow;
                    },
                },
            };
        },
        moveActualActivityRow() {
            calls.push('move');
        },
        removeActualActivityRow() {
            calls.push('remove');
        },
    };

    controller.handleActualModalListClick.call(ctx, { target: moveTarget });
    controller.handleActualModalListClick.call(ctx, { target: removeTarget });

    assert.deepEqual(calls, []);
});

test('handleActualModalListChange routes assign input through parse and apply', () => {
    const calls = [];
    const row = createRow(3);
    const target = createTarget({
        row,
        classNames: ['actual-assign-input'],
        dataset: { index: '3' },
        value: '01:20',
    });
    const ctx = {
        parseActualDurationInput(value) {
            calls.push(['parse', value]);
            return 4800;
        },
        setActualActiveRow(index) {
            calls.push(['active', index]);
        },
        applyActualDurationChange(index, seconds) {
            calls.push(['apply', index, seconds]);
        },
        applyActualGridDurationChange() {
            calls.push(['grid']);
        },
        updateActualSpinnerDisplays() {
            calls.push(['spinner']);
        },
    };

    controller.handleActualModalListChange.call(ctx, { target });

    assert.deepEqual(calls, [['parse', '01:20'], ['active', 3], ['apply', 3, 4800]]);
});

test('handleActualModalListFocusIn activates row only when contained in the list', () => {
    const calls = [];
    const row = createRow(4);
    const target = createTarget({ row });
    const ctx = {
        getActualModalElements() {
            return {
                list: {
                    contains(node) {
                        return node === row;
                    },
                },
            };
        },
        setActualActiveRow(index) {
            calls.push(index);
        },
    };

    controller.handleActualModalListFocusIn.call(ctx, { target });

    assert.deepEqual(calls, [4]);
});
