const test = require('node:test');
const assert = require('node:assert/strict');

const renderer = require('../ui/actual-activity-list-renderer');

function createFakeElement(tagName) {
    const element = {
        tagName: String(tagName || '').toUpperCase(),
        children: [],
        dataset: {},
        attributes: {},
        textContent: '',
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
        getAttribute(name) {
            return Object.prototype.hasOwnProperty.call(this.attributes, String(name))
                ? this.attributes[String(name)]
                : null;
        },
    };

    Object.defineProperty(element, 'className', {
        get() {
            return Array.from(this._classes).join(' ');
        },
        set(value) {
            this._classes = new Set(String(value || '').split(/\s+/).filter(Boolean));
        },
        configurable: true,
        enumerable: true,
    });

    element.classList = {
        add(...tokens) {
            tokens.forEach((token) => {
                if (token) element._classes.add(String(token));
            });
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

test('actual-activity-list-renderer exports and global attach are available', () => {
    assert.equal(typeof renderer.buildActualActivityRowState, 'function');
    assert.equal(typeof renderer.buildActualActivityRowStates, 'function');
    assert.equal(typeof renderer.createActualActivityRowElement, 'function');
    assert.equal(typeof renderer.createActualActivitiesEmptyState, 'function');

    assert.ok(globalThis.TimeTrackerActualActivityListRenderer);
    assert.equal(typeof globalThis.TimeTrackerActualActivityListRenderer.buildActualActivityRowState, 'function');
});

test('buildActualActivityRowState marks extra row state and keeps grid editable', () => {
    const state = renderer.buildActualActivityRowState({
        item: { label: ' Extra ', seconds: 1800, recordedSeconds: 1200, source: 'extra' },
        index: 1,
        totalCount: 3,
        activeIndex: 1,
        hasPlanUnits: true,
        gridSecondsMap: new Map([['Plan', 2400]]),
        planLabelSet: new Set(['Plan']),
        normalizeActivityText(value) {
            return String(value || '').trim();
        },
    });

    assert.deepEqual(state.classNames, ['sub-activity-row', 'actual-row', 'active', 'actual-row-extra']);
    assert.equal(state.normalizedLabel, 'Extra');
    assert.equal(state.gridSeconds, 1200);
    assert.equal(state.gridDisabled, false);
    assert.equal(state.assignDisabled, false);
    assert.equal(state.moveUpDisabled, false);
    assert.equal(state.moveDownDisabled, false);
    assert.equal(state.removeDisabled, false);
});

test('buildActualActivityRowState disables controls for locked rows', () => {
    const state = renderer.buildActualActivityRowState({
        item: { label: 'A', seconds: 600, recordedSeconds: 600, source: 'locked' },
        index: 0,
        totalCount: 1,
        activeIndex: -1,
        hasPlanUnits: true,
        gridSecondsMap: new Map([['A', 600]]),
        planLabelSet: new Set(['A']),
        normalizeActivityText(value) {
            return String(value || '').trim();
        },
    });

    assert.deepEqual(state.classNames, ['sub-activity-row', 'actual-row', 'actual-row-locked']);
    assert.equal(state.gridDisabled, true);
    assert.equal(state.assignDisabled, true);
    assert.equal(state.moveUpDisabled, true);
    assert.equal(state.moveDownDisabled, true);
    assert.equal(state.removeDisabled, true);
});

test('createActualActivityRowElement builds row DOM with callbacks and disabled buttons', () => {
    const fakeDocument = createFakeDocument();
    const calls = [];
    const state = renderer.buildActualActivityRowState({
        item: { label: ' Extra ', seconds: 1800, recordedSeconds: 1200, source: 'extra' },
        index: 1,
        totalCount: 3,
        activeIndex: 1,
        hasPlanUnits: true,
        gridSecondsMap: new Map(),
        planLabelSet: new Set(['Plan']),
        normalizeActivityText(value) {
            return String(value || '').trim();
        },
    });

    const row = renderer.createActualActivityRowElement({
        document: fakeDocument,
        rowState: state,
        createActualTimeControl(options) {
            calls.push({ ...options });
            const control = createFakeElement('div');
            control.className = `actual-time-control actual-time-${options.kind}`;
            return control;
        },
    });

    assert.equal(row.classList.contains('actual-row-extra'), true);
    assert.equal(row.dataset.index, '1');
    assert.equal(row.children[0].tagName, 'BUTTON');
    assert.equal(row.children[0].textContent, 'Extra');
    assert.equal(row.children[0].getAttribute('aria-expanded'), 'false');
    assert.equal(row.children[1].classList.contains('actual-time-extra'), true);
    assert.equal(row.children[3].children[0].disabled, false);
    assert.equal(row.children[3].children[1].disabled, false);
    assert.equal(row.children[3].children[2].disabled, false);

    assert.deepEqual(calls, [
        {
            kind: 'grid',
            index: 1,
            seconds: 1200,
            label: 'Extra',
            disabled: false,
        },
        {
            kind: 'assign',
            index: 1,
            seconds: 1800,
            label: 'Extra',
            disabled: false,
        },
    ]);
});

test('createActualActivitiesEmptyState renders the empty placeholder', () => {
    const empty = renderer.createActualActivitiesEmptyState({
        document: createFakeDocument(),
    });

    assert.equal(empty.className, 'sub-activities-empty');
    assert.equal(empty.textContent, '세부 활동을 추가해보세요');
});
