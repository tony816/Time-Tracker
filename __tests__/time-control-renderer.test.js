const test = require('node:test');
const assert = require('node:assert/strict');

const renderer = require('../ui/time-control-renderer');
const { buildMethod } = require('./helpers/script-method-builder');

const createDurationSpinnerWrapper = buildMethod('createDurationSpinner({ kind, index, seconds })', '({ kind, index, seconds })');
const updateSpinnerDisplayWrapper = buildMethod('updateSpinnerDisplay(spinner, seconds)', '(spinner, seconds)');

function createFakeElement(tagName) {
    const element = {
        tagName: String(tagName || '').toUpperCase(),
        children: [],
        dataset: {},
        attributes: {},
        textContent: '',
        value: '',
        disabled: false,
        type: '',
        _classes: new Set(),
        appendChild(child) {
            this.children.push(child);
            return child;
        },
        setAttribute(name, value) {
            this.attributes[String(name)] = String(value);
        },
        querySelector(selector) {
            if (selector === '.spinner-display') {
                return this.children.find((child) => child.classList && child.classList.contains('spinner-display')) || null;
            }
            return null;
        },
    };

    Object.defineProperty(element, 'className', {
        get() {
            return Array.from(this._classes).join(' ');
        },
        set(value) {
            this._classes = new Set(String(value || '').split(/\s+/).filter(Boolean));
        },
    });

    element.classList = {
        add(...tokens) {
            tokens.forEach((token) => token && element._classes.add(String(token)));
        },
        contains(token) {
            return element._classes.has(String(token));
        },
    };

    return element;
}

function createFakeDocument() {
    return {
        createElement(tagName) {
            return createFakeElement(tagName);
        },
    };
}

test('time-control-renderer exports and global attach are available', () => {
    assert.equal(typeof renderer.createDurationSpinner, 'function');
    assert.equal(typeof renderer.updateSpinnerDisplay, 'function');
    assert.ok(globalThis.TimeTrackerTimeControlRenderer);
    assert.equal(globalThis.TimeTrackerTimeControlRenderer.createDurationSpinner, renderer.createDurationSpinner);
});

test('script time-control wrapper methods delegate to renderer helpers', () => {
    const original = globalThis.TimeTrackerTimeControlRenderer;
    const originalDocument = global.document;
    const calls = [];
    globalThis.TimeTrackerTimeControlRenderer = {
        createDurationSpinner(options) {
            calls.push(['spinner', this, options]);
            return 'spinner';
        },
        updateSpinnerDisplay(options) {
            calls.push(['update', this, options]);
            return 'updated';
        },
    };
    global.document = createFakeDocument();

    const ctx = {
        formatSpinnerValue(kind, seconds) {
            return `${kind}:${seconds}`;
        },
        formatSecondsForInput(seconds) {
            return `t:${seconds}`;
        },
        normalizeDurationStep(seconds) {
            return seconds;
        },
        updateSpinnerState(node) {
            return node;
        },
    };
    const spinner = { id: 'spinner' };

    try {
        assert.equal(createDurationSpinnerWrapper.call(ctx, { kind: 'plan', index: 1, seconds: 600 }), 'spinner');
        assert.equal(updateSpinnerDisplayWrapper.call(ctx, spinner, 900), 'updated');
    } finally {
        globalThis.TimeTrackerTimeControlRenderer = original;
        global.document = originalDocument;
    }

    assert.equal(calls[0][0], 'spinner');
    assert.equal(calls[1][0], 'update');
});

test('createDurationSpinner builds plan spinner DOM', () => {
    const spinner = renderer.createDurationSpinner({
        document: createFakeDocument(),
        kind: 'plan',
        index: 3,
        seconds: 1200,
        formatSpinnerValue(kind, seconds) {
            return `${kind}:${seconds}`;
        },
    });

    assert.equal(spinner.className, 'time-spinner');
    assert.equal(spinner.dataset.kind, 'plan');
    assert.equal(spinner.dataset.index, '3');
    assert.equal(spinner.dataset.seconds, '1200');
    assert.equal(spinner.children[0].className, 'spinner-display');
    assert.equal(spinner.children[0].textContent, 'plan:1200');
});

test('updateSpinnerDisplay rewrites display text and re-runs spinner state', () => {
    const spinner = renderer.createDurationSpinner({
        document: createFakeDocument(),
        kind: 'plan',
        index: 0,
        seconds: 600,
        formatSpinnerValue(kind, seconds) {
            return `${kind}:${seconds}`;
        },
    });
    const calls = [];

    renderer.updateSpinnerDisplay({
        spinner,
        seconds: 1801,
        normalizeDurationStep(value) {
            return Math.floor(value / 60) * 60;
        },
        formatSpinnerValue(kind, seconds) {
            return `${kind}:${seconds}`;
        },
        updateSpinnerState(node) {
            calls.push(node.dataset.seconds);
        },
    });

    assert.equal(spinner.dataset.seconds, '1800');
    assert.equal(spinner.children[0].textContent, 'plan:1800');
    assert.deepEqual(calls, ['1800']);
});
