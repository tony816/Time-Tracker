const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const controller = require('../controllers/planned-slot-move-controller');
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

test('clear mode renders a host-level button for non-empty planned slots only', () => {
    const ctx = createContext();
    const html = wrapWithSplitVisualization.call(ctx, 'planned', 0, '<input class="planned-input" />');
    assert.match(html, /planned-slot-clear-target/);
    assert.match(html, /data-planned-slot-clear-target="true"/);
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
    assert.doesNotMatch(html, /split-grid-segment[^>]*planned-slot-clear-btn/);
});

test('clear button sits above segment content in the stacking order', () => {
    const css = fs.readFileSync(path.join(__dirname, '..', 'styles', 'interactions.css'), 'utf8');
    assert.match(css, /\.planned-slot-clear-target\s*\{[\s\S]*z-index:\s*6;/);
    assert.match(css, /\.planned-slot-clear-btn\s*\{[\s\S]*z-index:\s*8;/);
    assert.match(css, /\.split-visualization \.split-grid-segment\s*\{[\s\S]*z-index:\s*var\(--split-segment-layer, 2\);/);
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
