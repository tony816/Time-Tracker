const test = require('node:test');
const assert = require('node:assert/strict');

require('../controllers/controller-state-access');
const controller = require('../controllers/inline-plan-dropdown-controller');
const { buildMethod } = require('./helpers/script-method-builder');

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
    'openInlinePlanDropdown(index, anchorEl, endIndex = null)',
    '(index, anchorEl, endIndex = null)'
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

test('inline-plan-dropdown-controller exports and global attach are available', () => {
    assert.ok(controller);
    assert.equal(typeof controller.buildPlannedActivityOptions, 'function');
    assert.equal(typeof controller.groupActivityBoard, 'function');
        assert.equal(typeof controller.renderInlinePlanDropdownOptions, 'function');
        assert.equal(typeof controller.positionInlinePlanDropdown, 'function');
        assert.equal(typeof controller.positionInlinePlanChildPopover, 'function');
        assert.equal(typeof controller.openInlinePlanDropdown, 'function');
        assert.equal(typeof controller.closeInlinePlanDropdown, 'function');
        assert.equal(typeof controller.closePlanActivityChildMenu, 'function');
        assert.equal(typeof controller.applyInlinePlanSelection, 'function');
        assert.equal(
            globalThis.TimeTrackerInlinePlanDropdownController.openInlinePlanDropdown,
            controller.openInlinePlanDropdown
        );
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
        openInlinePlanDropdown(index, anchorEl, endIndex) {
            calls.push(['open', this, index, anchorEl, endIndex]);
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
        assert.equal(openInlinePlanDropdownWrapper.call(ctx, 3, anchor, 5), 'open-result');
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
        ['open', ctx, 3, anchor, 5],
        ['close', ctx],
        ['closeChild', ctx, options],
        ['apply', ctx, 'A', options],
        ['touchUsage', ctx, activityItem, parentItem],
    ]);
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

test('openPlanActivityChildMenu renders parent self selection and child selection into the segment model', () => {
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
    const subSection = createNode('div');
    subSection.className = 'inline-plan-subsection';
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
    const closeBtn = createNode('button');
    closeBtn.className = 'inline-plan-subsection-close';
    closeBtn.textContent = '×';
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
        isInlinePlanMobileInputContext() {
            return false;
        },
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
        controller.openPlanActivityChildMenu.call(ctx, { id: 'work', name: 'Work', label: 'Work' }, anchor, [
            { id: 'work-focus', name: 'Focus', label: 'Focus', normalizedName: 'Focus', parentId: 'work' },
        ]);

        const selfRow = subBoard.children.find((node) => Array.isArray(node.children) && node.children[0] && String(node.children[0].className).includes('activity-chip-self'));
        const selfButton = selfRow.children[0];
        assert.ok(selfButton.className.includes('activity-chip-self'));
        selfButton.dispatchEvent({
            type: 'click',
            preventDefault() {},
            stopPropagation() {},
        });
        assert.deepEqual(ctx.timeSlots[0].planActivities[0], {
            label: 'Work',
            seconds: 3600,
            titleActivityId: null,
            titleText: null,
            activityId: 'work',
            activityText: 'Work',
        });
        assert.equal(ctx.timeSlots[0].planTitle, '');
        assert.equal(ctx.timeSlots[0].planned, 'Work');

        controller.openPlanActivityChildMenu.call(ctx, { id: 'work', name: 'Work', label: 'Work' }, anchor, [
            { id: 'work-focus', name: 'Focus', label: 'Focus', normalizedName: 'Focus', parentId: 'work' },
        ]);
        const childRow = subBoard.children.find((node) => Array.isArray(node.children) && node.children[1] && String(node.children[1].className).includes('activity-chip'));
        const childButton = childRow.children[1];
        childButton.dispatchEvent({
            type: 'click',
            preventDefault() {},
            stopPropagation() {},
        });
        assert.deepEqual(ctx.timeSlots[0].planActivities[0], {
            label: 'Focus',
            seconds: 3600,
            titleActivityId: 'work',
            titleText: 'Work',
            activityId: 'work-focus',
            activityText: 'Focus',
        });
        assert.equal(ctx.timeSlots[0].planTitle, 'Work');
    } finally {
        globalThis.document = originalDocument;
    }
});

test('renderInlinePlanDropdownOptions keeps the child-board affordance for childless top-level activities', () => {
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
    let openedParent = null;
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

test('openPlanActivityChildMenu renders an empty child board with parent self selection and add action', () => {
    const originalDocument = globalThis.document;
    const originalPrompt = globalThis.prompt;
    let promptCalled = false;
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
            },
            setAttribute(name, value) {
                attributes[name] = String(value);
            },
            getAttribute(name) {
                return attributes[name];
            },
            focus() {},
            select() {},
            setSelectionRange() {},
        };
    };
    const subSection = createNode('div');
    subSection.className = 'inline-plan-subsection';
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
    globalThis.prompt = () => {
        promptCalled = true;
        return '';
    };

    try {
        controller.openPlanActivityChildMenu.call(ctx, { id: 'work', name: 'Work', label: 'Work' }, anchor, []);

        assert.equal(subSection.hidden, false);
        assert.equal(title.textContent, 'Work의 세부활동');
        assert.equal(backBtn.hidden, true);
        assert.equal(backBtn.getAttribute('aria-hidden'), 'true');
        const bodyRow = subBoard.children.find((node) => Array.isArray(node.children) && node.children[0] && String(node.children[0].className).includes('activity-chip-self'));
        assert.ok(bodyRow.children[0].className.includes('activity-chip-self'));
        assert.ok(bodyRow.children[1].className.includes('inline-plan-empty'));

        assert.equal(promptCalled, false);
        const composer = actions.children.find((node) => node.className === 'activity-child-composer');
        assert.ok(composer);
        const composerInput = composer.children[0];
        const composerSubmit = composer.children[1];
        const composerCancel = composer.children[2];
        assert.ok(String(composerInput.getAttribute('placeholder') || '').includes('세부활동'));
        assert.equal(composerSubmit.textContent, '추가');
        assert.equal(composerCancel.textContent, '취소');
        assert.equal(ctx.inlineChildComposerOpenParentId, 'work');
    } finally {
        globalThis.document = originalDocument;
        globalThis.prompt = originalPrompt;
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

    assert.equal(section.style.position, 'absolute');
    assert.equal(section.style.left, '52px');
    assert.equal(section.style.top, '136px');
    assert.equal(section.style.width, '360px');
    assert.equal(section.style.maxWidth, '360px');
    assert.equal(section.style.visibility, 'visible');
    assert.equal(section.style.zIndex, '80');
    assert.equal(section.style.maxHeight, '280px');
    assert.equal(section.style.overflow, 'hidden');
    assert.equal(section.classList.contains('inline-plan-subsection-anchored'), true);
    assert.equal(section.classList.contains('inline-plan-subsection-flow'), false);
    assert.equal(board.style.overflow, 'auto');
    assert.equal(board.style.maxHeight, '212px');
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

test('positionInlinePlanChildPopover keeps the popover below the caret and auto-scrolls into view without flipping', () => {
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
    const section = {
        hidden: false,
        className: '',
        style: makeStyleBag(),
        classList: {
            owner: null,
            add(...classes) {
                const target = this.owner;
                if (!target) return;
                classes.forEach((cls) => {
                    if (!cls) return;
                    const tokens = String(target.className || '').split(/\s+/).filter(Boolean);
                    if (!tokens.includes(cls)) {
                        target.className = (target.className ? `${target.className} ` : '') + cls;
                    }
                });
            },
            remove(...classes) {
                const target = this.owner;
                if (!target) return;
                const tokens = String(target.className || '').split(/\s+/).filter(Boolean);
                target.className = tokens.filter((token) => !classes.includes(token)).join(' ');
            },
            contains(cls) {
                const target = this.owner;
                if (!target) return false;
                return String(target.className || '').split(/\s+/).filter(Boolean).includes(cls);
            },
        },
        getBoundingClientRect() {
            return { top: 260, bottom: 440, left: 0, right: 0, width: 0, height: 180 };
        },
    };
    section.classList.owner = section;
    const containsByParent = function containsByParent(node) {
        let current = node;
        while (current) {
            if (current === this) return true;
            current = current.parentElement || null;
        }
        return false;
    };
    const scrollContainer = {
        scrollTop: 0,
        scrollHeight: 900,
        clientHeight: 300,
        contains: containsByParent,
        getBoundingClientRect() {
            const top = 100 - (this.scrollTop / 10);
            const bottom = top + 300;
            return { top, bottom, left: 0, right: 420, width: 420, height: 300 };
        },
    };
    const anchor = {
        isConnected: true,
        getBoundingClientRect() {
            return { top: 250, bottom: 280, left: 160, right: 196, width: 36, height: 30 };
        },
    };
    const row = { parentElement: scrollContainer };
    anchor.parentElement = row;
    const dropdown = {
        scrollTop: 0,
        scrollHeight: 900,
        clientHeight: 300,
        style: makeStyleBag(),
        contains: containsByParent,
        classList: {
            contains() { return false; },
        },
        getBoundingClientRect() {
            const top = 100 - (this.scrollTop / 10);
            return { top, bottom: top + 300, left: 0, right: 420, width: 420, height: 300 };
        },
        querySelector(selector) {
            if (selector === '.inline-plan-subsection') return section;
            if (selector === '.activity-chip-board') return scrollContainer;
            if (selector === '.inline-plan-sub-board') return { style: makeStyleBag() };
            if (selector === '.inline-plan-subsection-head') return { getBoundingClientRect() { return { height: 40 }; } };
            return null;
        },
        querySelectorAll(selector) {
            if (selector === '.activity-chip-caret[data-activity-id]') return [anchor];
            return [];
        },
    };
    scrollContainer.parentElement = dropdown;
    section.parentElement = dropdown;
    const ctx = {
        inlinePlanDropdown: dropdown,
        modalPlanSectionOpen: true,
        modalPlanSectionOpenParentId: 'work',
        inlinePlanChildPopoverAnchorEl: anchor,
        inlinePlanChildPopoverAnchorSectionKey: 'parents',
        inlinePlanChildPopoverAnchorInstanceKey: 'parents::work',
        isInlinePlanMobileInputContext() {
            return false;
        },
    };

    globalThis.document = {
        createElement() {
            return { style: makeStyleBag() };
        },
    };
    globalThis.requestAnimationFrame = (fn) => fn();

    try {
        controller.positionInlinePlanChildPopover.call(ctx, anchor);

        assert.ok(Number.parseInt(section.style.top, 10) > 0);
        assert.ok(dropdown.scrollTop > 0);
        assert.equal(scrollContainer.scrollTop, 0);
        assert.equal(section.style.position, 'absolute');
        assert.equal(section.classList.contains('inline-plan-subsection-above'), false);
        assert.equal(section.classList.contains('inline-plan-subsection-flow'), false);
        assert.equal(section.classList.contains('inline-plan-subsection-anchored'), true);
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
            { id: 'study', name: 'Study', label: 'Study', normalizedName: 'Study', parentId: null, pinned: false, archived: false, usageCount: 0, lastUsedAt: null, source: 'local' },
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

test('caret anchor follows the exact rendered parent instance across sections', () => {
    const originalDocument = globalThis.document;
    const createNode = (tagName) => {
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
            classList: {
                owner: null,
                add(...classes) {
                    const target = this.owner;
                    if (!target) return;
                    classes.forEach((cls) => {
                        if (!cls) return;
                        const tokens = target.className.split(/\s+/).filter(Boolean);
                        if (!tokens.includes(cls)) {
                            target.className = (target.className ? `${target.className} ` : '') + cls;
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
        querySelectorAll(selector) {
            if (selector !== '.activity-chip-caret[data-activity-id]') return [];
            const matches = [];
            const visit = (node) => {
                if (!node) return;
                const className = String(node.className || '');
                const hasCaretClass = className.split(/\s+/).includes('activity-chip-caret');
                if (hasCaretClass && node.dataset && String(node.dataset.activityId || '').trim()) {
                    matches.push(node);
                }
                Array.from(node.children || []).forEach(visit);
            };
            board.children.forEach(visit);
            return matches;
        },
    };
    const recentCaretClicks = [];
    const ctx = {
        inlinePlanDropdown: dropdown,
        inlinePlanTarget: { startIndex: 0, endIndex: 0 },
        plannedActivities: [
            {
                id: 'reading',
                name: 'Reading',
                label: 'Reading',
                normalizedName: 'Reading',
                parentId: null,
                usageCount: 3,
                lastUsedAt: '2026-05-16T00:00:00.000Z',
            },
            {
                id: 'exercise',
                name: 'Exercise',
                label: 'Exercise',
                normalizedName: 'Exercise',
                parentId: null,
            },
        ],
        modalPlanSectionOpen: false,
        modalPlanSectionOpenParentId: null,
        inlinePlanChildPopoverAnchorEl: null,
        inlinePlanChildPopoverAnchorSectionKey: null,
        inlinePlanChildPopoverAnchorInstanceKey: null,
        normalizeActivityText(value) {
            return String(value || '').trim();
        },
        groupActivityBoard(entries) {
            return controller.groupActivityBoard.call(this, entries);
        },
        positionInlinePlanDropdown() {},
        openPlanActivityChildMenu(parentItem, anchorEl, children) {
            this.modalPlanSectionOpen = true;
            this.modalPlanSectionOpenParentId = String(parentItem && parentItem.id ? parentItem.id : '').trim();
            recentCaretClicks.push({ parentId: parentItem.id, anchorEl, childCount: children.length });
        },
        closePlanActivityChildMenu() {
            this.modalPlanSectionOpen = false;
            this.modalPlanSectionOpenParentId = null;
            this.inlinePlanChildPopoverAnchorEl = null;
            this.inlinePlanChildPopoverAnchorSectionKey = null;
            this.inlinePlanChildPopoverAnchorInstanceKey = null;
        },
    };

    globalThis.document = { createElement: createNode };

    try {
        controller.renderInlinePlanDropdownOptions.call(ctx);

        const carets = controller.getOpenParentCaretAnchor
            ? dropdown.querySelectorAll('.activity-chip-caret[data-activity-id]')
            : [];
        const recentReadingCaret = carets.find((node) => String(node.dataset.boardSection || '').trim() === 'recent' && String(node.dataset.activityId || '').trim() === 'reading');
        const parentsReadingCaret = carets.find((node) => String(node.dataset.boardSection || '').trim() === 'parents' && String(node.dataset.activityId || '').trim() === 'reading');

        assert.ok(recentReadingCaret);
        assert.ok(parentsReadingCaret);

        recentReadingCaret.dispatchEvent({
            type: 'click',
            preventDefault() {},
            stopPropagation() {},
        });

        assert.equal(ctx.modalPlanSectionOpen, true);
        assert.equal(ctx.modalPlanSectionOpenParentId, 'reading');
        assert.equal(ctx.inlinePlanChildPopoverAnchorSectionKey, 'recent');
        assert.equal(ctx.inlinePlanChildPopoverAnchorInstanceKey, 'recent::reading');
        assert.equal(controller.getOpenParentCaretAnchor.call(ctx), recentReadingCaret);

        parentsReadingCaret.dispatchEvent({
            type: 'click',
            preventDefault() {},
            stopPropagation() {},
        });

        assert.equal(ctx.modalPlanSectionOpen, true);
        assert.equal(ctx.modalPlanSectionOpenParentId, 'reading');
        assert.equal(ctx.inlinePlanChildPopoverAnchorSectionKey, 'parents');
        assert.equal(ctx.inlinePlanChildPopoverAnchorInstanceKey, 'parents::reading');
        assert.equal(controller.getOpenParentCaretAnchor.call(ctx), parentsReadingCaret);
        assert.equal(recentCaretClicks.length, 2);

        parentsReadingCaret.dispatchEvent({
            type: 'click',
            preventDefault() {},
            stopPropagation() {},
        });

        assert.equal(ctx.modalPlanSectionOpen, false);
        assert.equal(ctx.modalPlanSectionOpenParentId, null);
        assert.equal(ctx.inlinePlanChildPopoverAnchorSectionKey, null);
        assert.equal(ctx.inlinePlanChildPopoverAnchorInstanceKey, null);
    } finally {
        globalThis.document = originalDocument;
    }
});

test('inline child composer creates children, blocks duplicates, and allows same child name under another parent', () => {
    const originalDocument = globalThis.document;
    const originalRAF = globalThis.requestAnimationFrame;
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
            },
            setAttribute(name, value) {
                attributes[name] = String(value);
            },
            getAttribute(name) {
                return attributes[name];
            },
            focus() {},
            select() {},
            setSelectionRange() {},
        };
    };
    const subSection = createNode('div');
    subSection.className = 'inline-plan-subsection';
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
    const saveCalls = [];
    const ctx = {
        inlinePlanDropdown: dropdown,
        inlinePlanTarget: { startIndex: 0, endIndex: 0, anchor },
        timeSlots: [{}],
        mergedFields: new Map(),
        plannedActivities: [
            { id: 'exercise', name: '운동', label: '운동', normalizedName: '운동', parentId: null, colorKey: null, defaultDurationMinutes: null, displayMode: 'chip', pinned: false, archived: false, usageCount: 0, lastUsedAt: null, source: 'local' },
            { id: 'study', name: '공부', label: '공부', normalizedName: '공부', parentId: null, colorKey: null, defaultDurationMinutes: null, displayMode: 'chip', pinned: false, archived: false, usageCount: 0, lastUsedAt: null, source: 'local' },
        ],
        normalizeActivityText(value) {
            return String(value || '').trim();
        },
        renderTimeEntries() {},
        calculateTotals() {},
        autoSave() {},
        positionInlinePlanDropdown() {},
        dedupeAndSortPlannedActivities() {},
        savePlannedActivities() {
            saveCalls.push('save');
        },
        renderInlinePlanDropdownOptions() {},
        openPlanActivityChildMenu(parentItem, anchorEl, children) {
            return controller.openPlanActivityChildMenu.call(this, parentItem, anchorEl, children);
        },
        closePlanActivityChildMenu(options = {}) {
            return controller.closePlanActivityChildMenu.call(this, options);
        },
    };

    globalThis.document = documentStub;
    globalThis.requestAnimationFrame = (fn) => fn();

    try {
        controller.openPlanActivityChildMenu.call(ctx, ctx.plannedActivities[0], anchor, []);
        let composer = actions.children.find((node) => node.className === 'activity-child-composer');
        let input = composer.children[0];
        let submit = composer.children[1];
        input.value = '스쿼트';
        input.dispatchEvent({
            type: 'keydown',
            key: 'Enter',
            isComposing: false,
            preventDefault() {},
            stopPropagation() {},
        });

        let exerciseChildren = ctx.plannedActivities.filter((item) => item.parentId === 'exercise');
        assert.equal(exerciseChildren.length, 1);
        assert.equal(exerciseChildren[0].parentId, 'exercise');
        assert.equal(exerciseChildren[0].label, '스쿼트');
        assert.equal(exerciseChildren[0].source, 'local');
        assert.equal(exerciseChildren[0].usageCount, 0);
        assert.equal(saveCalls.length, 1);
        composer = actions.children.find((node) => node.className === 'activity-child-composer');
        input = composer.children[0];
        submit = composer.children[1];
        assert.equal(input.value, '');
        assert.equal(ctx.inlineChildComposerOpenParentId, 'exercise');
        const findNodeWithClass = (node, className) => {
            if (!node) return null;
            if (node.className && String(node.className).includes(className)) {
                return node;
            }
            for (const child of Array.from(node.children || [])) {
                const found = findNodeWithClass(child, className);
                if (found) return found;
            }
            return null;
        };
        const createdChip = findNodeWithClass(subBoard, 'activity-chip-new-highlight');
        assert.ok(createdChip);

        input.value = '걷기';
        submit.dispatchEvent({
            type: 'click',
            preventDefault() {},
            stopPropagation() {},
        });

        exerciseChildren = ctx.plannedActivities.filter((item) => item.parentId === 'exercise');
        assert.equal(exerciseChildren.length, 2);
        assert.equal(saveCalls.length, 2);
        composer = actions.children.find((node) => node.className === 'activity-child-composer');
        input = composer.children[0];
        assert.equal(input.value, '');

        input.value = '스쿼트';
        input.dispatchEvent({
            type: 'keydown',
            key: 'Enter',
            isComposing: false,
            preventDefault() {},
            stopPropagation() {},
        });

        exerciseChildren = ctx.plannedActivities.filter((item) => item.parentId === 'exercise');
        assert.equal(exerciseChildren.length, 2);
        assert.equal(saveCalls.length, 2);
        assert.ok(String(subBoard.children.map((node) => node.textContent).join(' ')).includes('이미 있는 세부활동입니다.'));
        const duplicateChip = findNodeWithClass(subBoard, 'activity-chip-duplicate-highlight');
        assert.ok(duplicateChip);

        controller.openPlanActivityChildMenu.call(ctx, ctx.plannedActivities[1], anchor, []);
        composer = actions.children.find((node) => node.className === 'activity-child-composer');
        input = composer.children[0];
        submit = composer.children[1];
        input.value = '스쿼트';
        submit.dispatchEvent({
            type: 'click',
            preventDefault() {},
            stopPropagation() {},
        });

        const studyChildren = ctx.plannedActivities.filter((item) => item.parentId === 'study');
        assert.equal(studyChildren.length, 1);
        assert.equal(studyChildren[0].parentId, 'study');
        assert.equal(studyChildren[0].label, '스쿼트');
        assert.equal(saveCalls.length, 3);
    } finally {
        globalThis.document = originalDocument;
        globalThis.requestAnimationFrame = originalRAF;
    }
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

test('inline child composer can be cancelled with button or Escape', () => {
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
            },
            setAttribute(name, value) {
                attributes[name] = String(value);
            },
            getAttribute(name) {
                return attributes[name];
            },
            focus() {},
            select() {},
            setSelectionRange() {},
        };
    };
    const subSection = createNode('div');
    subSection.className = 'inline-plan-subsection';
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
        timeSlots: [{}],
        mergedFields: new Map(),
        plannedActivities: [
            { id: 'exercise', name: '운동', label: '운동', normalizedName: '운동', parentId: null, colorKey: null, defaultDurationMinutes: null, displayMode: 'chip', pinned: false, archived: false, usageCount: 0, lastUsedAt: null, source: 'local' },
        ],
        normalizeActivityText(value) {
            return String(value || '').trim();
        },
        renderTimeEntries() {},
        calculateTotals() {},
        autoSave() {},
        positionInlinePlanDropdown() {},
        dedupeAndSortPlannedActivities() {},
        savePlannedActivities() {},
        renderInlinePlanDropdownOptions() {},
        openPlanActivityChildMenu(parentItem, anchorEl, children) {
            return controller.openPlanActivityChildMenu.call(this, parentItem, anchorEl, children);
        },
        closePlanActivityChildMenu(options = {}) {
            return controller.closePlanActivityChildMenu.call(this, options);
        },
    };

    globalThis.document = documentStub;

    try {
        controller.openPlanActivityChildMenu.call(ctx, ctx.plannedActivities[0], anchor, []);

        let composer = actions.children.find((node) => node.className === 'activity-child-composer');
        assert.ok(composer);
        const input = composer.children[0];
        const cancelBtn = composer.children[2];
        input.value = '취소';
        cancelBtn.dispatchEvent({
            type: 'click',
            preventDefault() {},
            stopPropagation() {},
        });

        assert.equal(subSection.hidden, false);
        assert.equal(ctx.inlineChildComposerOpenParentId, 'exercise');
        assert.equal(ctx.plannedActivities.filter((item) => item.parentId === 'exercise').length, 0);
        assert.ok(actions.children.some((node) => node.className === 'activity-child-composer'));

        composer = actions.children.find((node) => node.className === 'activity-child-composer');
        const escapeInput = composer.children[0];
        escapeInput.value = '스쿼트';
        escapeInput.dispatchEvent({
            type: 'keydown',
            key: 'Escape',
            isComposing: false,
            preventDefault() {},
            stopPropagation() {},
        });

        assert.equal(subSection.hidden, false);
        assert.equal(ctx.inlineChildComposerOpenParentId, 'exercise');
        assert.ok(actions.children.some((node) => node.className === 'activity-child-composer'));
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

test('activity selection updates usage metadata and recent ordering', () => {
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
    const anchor = { isConnected: true, getBoundingClientRect() { return { left: 0, top: 0, bottom: 0, width: 10, height: 10 }; } };
    const documentStub = {
        createElement: createNode,
        querySelector() {
            return anchor;
        },
    };
    const saveCalls = [];
    const renderCalls = [];
    const ctx = {
        inlinePlanDropdown: dropdown,
        inlinePlanTarget: { startIndex: 0, endIndex: 0, anchor },
        timeSlots: [{}],
        mergedFields: new Map(),
        plannedActivities: [
            { id: 'exercise', name: '운동', label: '운동', normalizedName: '운동', parentId: null, pinned: false, archived: false, usageCount: 0, lastUsedAt: null, source: 'local' },
            { id: 'stretch', name: '스트레칭', label: '스트레칭', normalizedName: '스트레칭', parentId: null, pinned: false, archived: false, usageCount: 0, lastUsedAt: null, source: 'local' },
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
        savePlannedActivities() {
            saveCalls.push('save');
        },
        renderInlinePlanDropdownOptions() {
            renderCalls.push('render');
        },
    };
    ctx.touchPlannedActivityUsage = controller.touchPlannedActivityUsage;

    globalThis.document = documentStub;

    try {
        controller.renderInlinePlanDropdownOptions.call(ctx);
        parentSection = board.children[0];
        assert.ok(parentSection);
        const parentButton = parentSection.children[1].children[0].children[0];
        parentButton.dispatchEvent({
            type: 'click',
            preventDefault() {},
            stopPropagation() {},
        });

        assert.equal(ctx.plannedActivities[0].usageCount, 1);
        assert.equal(ctx.plannedActivities[1].usageCount, 0);
        assert.match(ctx.plannedActivities[0].lastUsedAt, /^\d{4}-\d{2}-\d{2}T/);
        assert.equal(saveCalls.length, 1);
        assert.ok(renderCalls.length >= 1);

        controller.renderInlinePlanDropdownOptions.call(ctx);
        const recentSection = board.children.find((node) => node.children && node.children[0] && node.children[0].textContent === '최근 사용');
        assert.ok(recentSection);
        const recentRow = recentSection.children[1];
        const firstRecentChip = recentRow.children[0];
        assert.equal(firstRecentChip.children[0].children[0].textContent, '운동');

        searchInput.value = '스쿼트';
        controller.renderInlinePlanDropdownOptions.call(ctx);
        const searchSection = board.children.find((node) => node.children && node.children[0] && node.children[0].textContent === '검색 결과');
        assert.ok(searchSection);
        const searchButton = searchSection.children[1].children[0].children[0];
        searchButton.dispatchEvent({
            type: 'click',
            preventDefault() {},
            stopPropagation() {},
        });

        assert.equal(ctx.plannedActivities[2].usageCount, 1);
        assert.equal(ctx.plannedActivities[0].usageCount, 1);
        assert.match(ctx.plannedActivities[2].lastUsedAt, /^\d{4}-\d{2}-\d{2}T/);
        assert.equal(saveCalls.length, 2);
    } finally {
        globalThis.document = originalDocument;
    }
});
