const test = require('node:test');
const assert = require('node:assert/strict');

const activityCore = require('../core/activity-core');
const controller = require('../controllers/inline-plan-dropdown-controller');

function createNode(tagName) {
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
        appendChild(child) {
            child.parent = this;
            this.children.push(child);
            return child;
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
    node.classList = {
        add(...classes) {
            const tokens = new Set(String(node.className || '').split(/\s+/).filter(Boolean));
            classes.forEach((cls) => tokens.add(cls));
            node.className = Array.from(tokens).join(' ');
        },
        remove(...classes) {
            const remove = new Set(classes);
            node.className = String(node.className || '').split(/\s+/).filter((cls) => !remove.has(cls)).join(' ');
        },
        contains(cls) {
            return String(node.className || '').split(/\s+/).includes(cls);
        },
    };
    return node;
}

function flatten(node, result = []) {
    if (!node) return result;
    result.push(node);
    (node.children || []).forEach((child) => flatten(child, result));
    return result;
}

function buildContext(searchValue = '') {
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
    const searchInput = { value: searchValue };
    const dropdown = {
        querySelector(selector) {
            if (selector === '.activity-chip-board') return board;
            if (selector === '.inline-plan-input') return searchInput;
            return null;
        },
    };
    const ctx = {
        inlinePlanDropdown: dropdown,
        inlinePlanTarget: {
            startIndex: 0,
            endIndex: 0,
            virtualGap: { id: 'virtual-rest-0-30', startMinute: 0, durationMinutes: 30 },
        },
        timeSlots: [{ planned: '', planActivities: [] }],
        mergedFields: new Map(),
        plannedActivities: [
            { id: 'work', name: 'Work', label: 'Work', normalizedName: 'Work', parentId: null, pinned: false, archived: false, usageCount: 0, lastUsedAt: null, source: 'local' },
            { id: 'focus', name: 'Focus', label: 'Focus', normalizedName: 'Focus', parentId: 'work', pinned: false, archived: false, usageCount: 0, lastUsedAt: null, source: 'local' },
        ],
        normalizeActivityText(value) {
            return String(value || '').trim();
        },
        normalizePlanActivitiesArray(value) {
            return activityCore.normalizePlanActivitiesArray(value, {
                normalizeActivityText: (raw) => String(raw || '').trim(),
                normalizeDurationStep: (seconds) => Math.max(0, Math.floor(seconds)),
            });
        },
        groupActivityBoard(entries) {
            return controller.groupActivityBoard.call(this, entries);
        },
        renderTimeEntries() {},
        calculateTotals() {},
        autoSave() {},
        closeInlinePlanDropdown() {
            this.closed = true;
        },
        dedupeAndSortPlannedActivities() {},
        savePlannedActivities() {},
        renderInlinePlanDropdownOptions() {},
    };
    return { ctx, board };
}

test('selecting a parent chip fills the clicked virtual gap duration only', () => {
    const originalDocument = globalThis.document;
    globalThis.document = { createElement: createNode, querySelector() { return null; } };
    const { ctx, board } = buildContext('');

    try {
        controller.renderInlinePlanDropdownOptions.call(ctx);
        const workButton = flatten(board).find((node) => node.className === 'activity-chip-label' && node.textContent === 'Work');
        assert.ok(workButton);
        workButton.parent.dispatchEvent({
            type: 'click',
            preventDefault() {},
            stopPropagation() {},
        });

        assert.equal(ctx.timeSlots[0].planActivities.length, 1);
        assert.deepEqual(ctx.timeSlots[0].planActivities[0], {
            label: 'Work',
            seconds: 1800,
            titleActivityId: null,
            titleText: null,
            activityId: 'work',
            activityText: 'Work',
            startMinute: 0,
            durationMinutes: 30,
        });
        assert.equal(ctx.timeSlots[0].planActivities.some((item) => item.kind === 'virtual-rest'), false);
    } finally {
        globalThis.document = originalDocument;
    }
});

test('selecting a child search result fills the gap with parent/title split metadata', () => {
    const originalDocument = globalThis.document;
    globalThis.document = { createElement: createNode, querySelector() { return null; } };
    const { ctx, board } = buildContext('Focus');

    try {
        controller.renderInlinePlanDropdownOptions.call(ctx);
        const focusLabel = flatten(board).find((node) => node.className === 'activity-chip-label' && node.textContent === 'Focus · Work');
        assert.ok(focusLabel);
        focusLabel.parent.dispatchEvent({
            type: 'click',
            preventDefault() {},
            stopPropagation() {},
        });

        assert.deepEqual(ctx.timeSlots[0].planActivities[0], {
            label: 'Focus',
            seconds: 1800,
            titleActivityId: 'work',
            titleText: 'Work',
            activityId: 'focus',
            activityText: 'Focus',
            startMinute: 0,
            durationMinutes: 30,
        });
        assert.equal(ctx.timeSlots[0].planTitle, 'Work');
    } finally {
        globalThis.document = originalDocument;
    }
});
