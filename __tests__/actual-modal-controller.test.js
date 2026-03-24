const test = require('node:test');
const assert = require('node:assert/strict');

const controller = require('../controllers/actual-modal-controller');

test('actual-modal-controller exports and global attach include menu methods', () => {
    assert.ok(controller);
    assert.equal(typeof controller.openActualActivityMenu, 'function');
    assert.equal(typeof controller.positionActualActivityMenu, 'function');
    assert.equal(typeof controller.closeActualActivityMenu, 'function');
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
