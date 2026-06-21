const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const controller = require('../controllers/planned-slot-move-controller');
const fieldInteractionController = require('../controllers/field-interaction-controller');
globalThis.TimeEntryRenderController = require('../controllers/time-entry-render-controller');
const { buildMethod } = require('./helpers/script-method-builder');

const wrapWithSplitVisualization = buildMethod(
    'wrapWithSplitVisualization(type, index, content)',
    '(type, index, content)'
);
const buildSplitVisualization = buildMethod(
    'buildSplitVisualization(type, index)',
    '(type, index)'
);
const PLANNED_SLOT_HOST_SELECTOR = '.split-cell-wrapper.split-type-planned.planned-slot-clear-target';

function createContext(overrides = {}) {
    const slot = {
        time: '09',
        planned: 'Morning focus',
        planActivities: [{ label: 'Focus', seconds: 3600, startMinute: 0, endMinute: 60, durationMinutes: 60 }],
        planTitle: '',
        planTitleBandOn: false,
        planSegmentTimers: {},
        planMergeSnapshot: null,
        ...overrides.slot,
    };
    return {
        timeSlots: [slot],
        mergedFields: new Map(overrides.mergedFields || []),
        plannedSlotClearMode: overrides.plannedSlotClearMode !== undefined ? overrides.plannedSlotClearMode : true,
        plannedSlotMoveMode: Boolean(overrides.plannedSlotMoveMode),
        renderCalls: 0,
        totalCalls: 0,
        saveCalls: 0,
        notifications: [],
        closeInlinePlanDropdown() {},
        clearAllSelections() {},
        hideHoverScheduleButton() {},
        cancelPlanSegmentResize() {},
        renderTimeEntries() { this.renderCalls += 1; },
        calculateTotals() { this.totalCalls += 1; },
        autoSave() { this.saveCalls += 1; },
        showNotification(message) { this.notifications.push(message); },
        normalizeActivityText(value) { return String(value || '').trim(); },
        resolvePlannedSlotContext(index) {
            const mergeKey = this.findMergeKey ? this.findMergeKey('planned', index) : null;
            return {
                clickedIndex: index,
                baseIndex: 0,
                rangeStart: 0,
                rangeEnd: 0,
                mergeKey,
                isMerged: false,
                slotCount: 1,
                blockMinutes: 60,
            };
        },
        findMergeKey(type, index) {
            for (const key of this.mergedFields.keys()) {
                if (!key.startsWith(`${type}-`)) continue;
                const [, startStr, endStr] = key.split('-');
                const start = parseInt(startStr, 10);
                const end = parseInt(endStr, 10);
                if (index >= start && index <= end) return key;
            }
            return null;
        },
        computeSplitSegments(type, index) {
            assert.equal(type, 'planned');
            assert.equal(index, 0);
            return overrides.splitSegments || {
                gridSegments: [
                    { label: 'Focus', span: 4, segmentIndex: 0, startMinute: 0, durationMinutes: 40, endMinute: 40 },
                    { label: 'rest', span: 2, kind: 'virtual-rest', virtual: true, startMinute: 40, durationMinutes: 20, endMinute: 60 },
                ],
                titleSegments: [],
                showTitleBand: false,
            };
        },
        escapeHtml(value) { return String(value); },
        escapeAttribute(value) { return String(value); },
        getSplitColor() { return '#d9e2ec'; },
        buildSplitVisualization(type, index) {
            return buildSplitVisualization.call(this, type, index);
        },
        createPlannedSlotClearButtonHtml(index) {
            return controller.createPlannedSlotClearButtonHtml.call(this, index);
        },
        shouldRenderPlannedSlotClearButton(index) {
            return controller.shouldRenderPlannedSlotClearButton.call(this, index);
        },
    };
}

test('planned slot clear activation button lives inside the sheet title cell', () => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
    assert.match(
        html,
        /<div class="planned-label">[\s\S]*id="plannedSlotMoveModeBtn"[\s\S]*id="plannedSlotClearModeBtn"[\s\S]*<\/div>/
    );
});

test('planned slot clear activation button remains pointer-clickable in the title cell', () => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
    const css = fs.readFileSync(path.join(__dirname, '..', 'styles', 'interactions.css'), 'utf8');
    const controllerSource = fs.readFileSync(path.join(__dirname, '..', 'controllers', 'planned-slot-move-controller.js'), 'utf8');
    assert.match(html, /id="plannedSlotClearModeBtn"[^>]*style="[^"]*pointer-events:\s*auto;?[^"]*"/);
    assert.match(css, /\.planned-slot-clear-mode-btn\s*\{[\s\S]*pointer-events:\s*auto;/);
    assert.match(controllerSource, /plannedSlotClearModeButton\.style\.pointerEvents\s*=\s*'auto'/);
});

test('clear mode renders a host-level button for non-empty planned slots only', () => {
    const ctx = createContext();
    const html = wrapWithSplitVisualization.call(ctx, 'planned', 0, '<input class="planned-input" />');
    assert.match(html, /planned-slot-clear-target/);
    assert.match(html, /data-planned-slot-clear-target="true"/);
    assert.match(html, /class="planned-slot-clear-overlay"/);
    assert.match(html, /class="planned-slot-clear-btn"/);
    const segmentHtml = html.match(/<div class="split-grid-segment[^"]*"[\s\S]*?<\/div>/);
    assert.ok(segmentHtml);
    assert.doesNotMatch(segmentHtml[0], /planned-slot-clear-btn/);
});

test('clear mode hides the button for empty planned slots', () => {
    const ctx = createContext({
        slot: {
            planned: '',
            planActivities: [],
            planTitle: '',
            planTitleBandOn: false,
            planSegmentTimers: {},
            planMergeSnapshot: null,
        },
    });
    assert.equal(controller.shouldRenderPlannedSlotClearButton.call(ctx, 0), false);
    const html = wrapWithSplitVisualization.call(ctx, 'planned', 0, '<input class="planned-input" />');
    assert.doesNotMatch(html, /planned-slot-clear-btn/);
});

test('clear mode button stays on the planned slot host even with split and virtual-rest content', () => {
    const ctx = createContext({
        splitSegments: {
            gridSegments: [
                { label: 'Work', span: 3, segmentIndex: 0, startMinute: 0, durationMinutes: 30, endMinute: 30 },
                { label: 'rest', span: 3, kind: 'virtual-rest', virtual: true, startMinute: 30, durationMinutes: 30, endMinute: 60 },
            ],
            titleSegments: [],
            showTitleBand: false,
        },
    });
    const html = wrapWithSplitVisualization.call(ctx, 'planned', 0, '<input class="planned-input" />');
    assert.match(html, /planned-slot-clear-btn/);
    assert.match(html, /planned-slot-clear-target/);
    assert.match(html, /planned-slot-clear-overlay/);
    assert.doesNotMatch(html, /split-grid-segment[^>]*planned-slot-clear-btn/);
});

test('clear button sits above segment content in the stacking order', () => {
    const css = fs.readFileSync(path.join(__dirname, '..', 'styles', 'interactions.css'), 'utf8');
    assert.match(css, /\.planned-slot-clear-target\s*\{[\s\S]*position:\s*relative;[\s\S]*z-index:\s*6;/);
    assert.match(css, /\.planned-slot-clear-overlay\s*\{[\s\S]*position:\s*absolute;[\s\S]*inset:\s*0;[\s\S]*pointer-events:\s*none;[\s\S]*z-index:\s*9;/);
    assert.match(css, /\.planned-slot-clear-btn\s*\{[\s\S]*position:\s*absolute;[\s\S]*top:\s*4px;[\s\S]*right:\s*4px;[\s\S]*z-index:\s*10;/);
    assert.match(css, /\.split-visualization \.split-grid-segment\s*\{[\s\S]*z-index:\s*var\(--split-segment-layer, 2\);/);
    assert.match(css, /\.split-cell-wrapper \.split-visualization\s*\{[\s\S]*top:\s*6px;[\s\S]*z-index:\s*2;/);
});

test('clearing a planned slot removes all planned content while preserving unrelated merge metadata', () => {
    const ctx = createContext({
        slot: {
            planned: 'Morning focus',
            planActivities: [{ label: 'Focus', seconds: 3600 }],
            planTitle: 'Focus',
            planTitleBandOn: true,
            planSegmentTimers: { 'planned-0-0-seg0': { status: 'idle', elapsedSeconds: 120 } },
            planMergeSnapshot: { mergeKey: 'planned-0-0', startIndex: 0, endIndex: 0 },
        },
        mergedFields: [
            ['planned-0-0', 'Morning focus'],
            ['time-0-0', '09-10'],
            ['actual-0-0', 'Actual summary'],
        ],
    });

    assert.equal(controller.clearPlannedSlotContents.call(ctx, 0), true);
    assert.equal(ctx.timeSlots[0].planned, '');
    assert.deepEqual(ctx.timeSlots[0].planActivities, []);
    assert.equal(ctx.timeSlots[0].planTitle, '');
    assert.equal(ctx.timeSlots[0].planTitleBandOn, false);
    assert.deepEqual(ctx.timeSlots[0].planSegmentTimers, {});
    assert.equal(ctx.timeSlots[0].planMergeSnapshot, undefined);
    assert.equal(ctx.mergedFields.has('planned-0-0'), false);
    assert.equal(ctx.mergedFields.get('time-0-0'), '09-10');
    assert.equal(ctx.mergedFields.get('actual-0-0'), 'Actual summary');
    assert.equal(ctx.renderCalls, 1);
    assert.equal(ctx.totalCalls, 1);
    assert.equal(ctx.saveCalls, 1);
});

test('clearing an empty slot is a no-op and leaves the clear button hidden', () => {
    const ctx = createContext({
        slot: {
            planned: '',
            planActivities: [],
            planTitle: '',
            planTitleBandOn: false,
            planSegmentTimers: {},
            planMergeSnapshot: null,
        },
    });
    assert.equal(controller.clearPlannedSlotContents.call(ctx, 0), false);
    assert.equal(ctx.renderCalls, 0);
    assert.equal(controller.shouldRenderPlannedSlotClearButton.call(ctx, 0), false);
});

function createFakeClearButton({ buttonIndex = '0', hostIndex = '0' } = {}) {
    const listeners = new Map();
    const host = {
        dataset: { index: hostIndex, plannedSlotClearTarget: 'true' },
        className: 'split-cell-wrapper split-type-planned planned-slot-clear-target',
    };
    const overlay = {
        className: 'planned-slot-clear-overlay',
        parentNode: host,
        closest(selector) {
            if (selector === PLANNED_SLOT_HOST_SELECTOR) return host;
            return null;
        },
    };
    const button = {
        dataset: { index: buttonIndex },
        listeners,
        closest(selector) {
            if (selector === '.planned-slot-clear-btn') return button;
            if (selector === '.planned-slot-clear-overlay') return overlay;
            if (selector === '.split-grid-segment') return null;
            if (selector === '[class*="plan-segment"]') return null;
            if (selector === PLANNED_SLOT_HOST_SELECTOR) return host;
            if (selector === '[data-planned-slot-clear-target="true"]') return host;
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
        querySelectorAll() { return [button]; },
        querySelector(selector) { return selector === '.planned-slot-clear-btn' ? button : null; },
    };
    return { button, entryDiv, host, overlay };
}

test('clear button belongs to the planned slot host and not to any segment node', () => {
    const { button, host } = createFakeClearButton();
    assert.equal(button.closest('.split-grid-segment'), null);
    assert.equal(button.closest('[class*="plan-segment"]'), null);
    assert.equal(button.closest(PLANNED_SLOT_HOST_SELECTOR), host);
    assert.equal(button.closest('[data-planned-slot-clear-target="true"]'), host);
});

test('clicking the rendered planned slot clear button clears and persists host slot state', () => {
    const ctx = createContext();
    const { button, entryDiv } = createFakeClearButton();

    controller.attachPlannedSlotClearListeners.call(ctx, entryDiv, 0);

    assert.equal(button.dataset.clearListenerAttached, 'true');
    assert.equal(button.dataset.timeSlotMergeIgnore, 'true');
    assert.equal((button.listeners.get('mousedown') || []).length, 1);
    assert.equal((button.listeners.get('click') || []).length, 1);

    const downEvent = button.dispatch('mousedown');
    assert.equal(downEvent.immediateStopped, true);
    assert.equal(ctx.timeSlots[0].planned, 'Morning focus');

    const clickEvent = button.dispatch('click');
    assert.equal(clickEvent.defaultPrevented, true);
    assert.equal(clickEvent.immediateStopped, true);
    assert.equal(ctx.timeSlots[0].planned, '');
    assert.deepEqual(ctx.timeSlots[0].planActivities, []);
    assert.equal(ctx.timeSlots[0].planTitle, '');
    assert.equal(ctx.timeSlots[0].planTitleBandOn, false);
    assert.deepEqual(ctx.timeSlots[0].planSegmentTimers, {});
    assert.equal(ctx.timeSlots[0].planMergeSnapshot, undefined);
    assert.equal(ctx.mergedFields.has('planned-0-0'), false);
    assert.equal(ctx.renderCalls, 1);
    assert.equal(ctx.totalCalls, 1);
    assert.equal(ctx.saveCalls, 1);
});

test('clear button click is not swallowed by merged planned click capture while dropdown is open', () => {
    const plannedCell = {
        getBoundingClientRect() { return { left: 0, right: 100 }; },
    };
    const currentRow = {
        getAttribute(name) { return name === 'data-index' ? '0' : ''; },
        querySelector(selector) { return selector === '.planned-input' ? plannedCell : null; },
        getBoundingClientRect() { return { top: 0, bottom: 100 }; },
    };
    const button = {
        closest(selector) {
            if (selector === '.planned-slot-clear-btn') return button;
            if (selector === '.planned-input') return null;
            if (selector === '.time-entry[data-index]') return currentRow;
            return null;
        },
    };
    const event = {
        type: 'click',
        target: button,
        clientX: 10,
        clientY: 10,
        defaultPrevented: false,
        propagationStopped: false,
        preventDefault() { this.defaultPrevented = true; },
        stopPropagation() { this.propagationStopped = true; },
    };
    const ctx = {
        inlinePlanDropdown: {},
        inlinePlanTarget: { startIndex: 0, endIndex: 0 },
        clearSelection() { throw new Error('clear button clicks should bypass inline dropdown capture'); },
        closeInlinePlanDropdown() { throw new Error('clear button clicks should bypass inline dropdown capture'); },
    };

    fieldInteractionController.handleMergedClickCapture.call(ctx, event);

    assert.equal(event.defaultPrevented, false);
    assert.equal(event.propagationStopped, false);
});
