const test = require('node:test');
const assert = require('node:assert/strict');

require('../core/plan-segment-core');
require('../core/actual-grid-core');
const { buildMethod } = require('./helpers/script-method-builder');

const getPlanActivitiesWithVirtualGaps = buildMethod(
    'getPlanActivitiesWithVirtualGaps(baseIndex, range = null)',
    '(baseIndex, range = null)'
);
const computeSplitSegments = buildMethod(
    'computeSplitSegments(type, index)',
    '(type, index)'
);
const resizePlanActivitySegment = buildMethod(
    'resizePlanActivitySegment(baseIndex, activityIndex, edge, deltaMinutes)',
    '(baseIndex, activityIndex, edge, deltaMinutes)'
);
const updatePlanSegmentTitle = buildMethod(
    'updatePlanSegmentTitle(baseIndex, activityIndex, nextLabel)',
    '(baseIndex, activityIndex, nextLabel)'
);
const beginPlanSegmentTitleEdit = buildMethod(
    'beginPlanSegmentTitleEdit(labelEl, baseIndex, activityIndex)',
    '(labelEl, baseIndex, activityIndex)'
);
const movePlanActivitySegment = buildMethod(
    'movePlanActivitySegment(baseIndex, activityIndex, targetStartMinute)',
    '(baseIndex, activityIndex, targetStartMinute)'
);
const applyPlanSegmentAction = buildMethod(
    'applyPlanSegmentAction(baseIndex, activityIndex, action)',
    '(baseIndex, activityIndex, action)'
);
const swapPlanRows = buildMethod(
    'swapPlanRows(sourceIndex, targetIndex)',
    '(sourceIndex, targetIndex)'
);

test('plan-only empty slot renders a calculated virtual rest gap', () => {
    const ctx = {
        actualRecordingDisabled: true,
        timeSlots: [{ planned: '', planActivities: [] }],
        mergedFields: new Map(),
        findMergeKey() {
            return null;
        },
        getBlockLength() {
            return 1;
        },
        normalizeActivityText(value) {
            return String(value || '').trim();
        },
        normalizePlanActivitiesArray(value) {
            return Array.isArray(value) ? value : [];
        },
        getPlannedLabelForIndex() {
            return '';
        },
        getSplitBaseIndex(type, index) {
            return index;
        },
        getSplitRange(type, index) {
            return { start: index, end: index };
        },
        getSplitActivities(type, baseIndex) {
            if (type === 'planned') {
                const slot = this.timeSlots[baseIndex];
                const planActivities = this.normalizePlanActivitiesArray(slot.planActivities).map(item => ({ ...item }));
                if (planActivities.length > 0) return planActivities;
                const planLabel = this.getPlannedLabelForIndex(baseIndex);
                return planLabel ? [{ label: planLabel, seconds: 3600, source: 'plan-template' }] : [];
            }
            return [];
        },
        getPlanActivitiesWithVirtualGaps(baseIndex, range) {
            return getPlanActivitiesWithVirtualGaps.call(this, baseIndex, range);
        },
    };

    const result = computeSplitSegments.call(ctx, 'planned', 0);

    assert.ok(result);
    assert.equal(result.gridSegments.length, 1);
    assert.equal(result.gridSegments[0].label, '휴식');
    assert.equal(result.gridSegments[0].virtualRest, true);
    assert.equal(result.gridSegments[0].durationMinutes, 60);
});

test('real saved 휴식 activity is not marked as a virtual rest gap', () => {
    const ctx = {
        timeSlots: [{ planned: '휴식', planActivities: [{ label: '휴식', seconds: 3600 }] }],
        getBlockLength() {
            return 1;
        },
        normalizePlanActivitiesArray(value) {
            return Array.isArray(value) ? value : [];
        },
        getPlannedLabelForIndex() {
            return '휴식';
        },
        getSplitActivities(type, baseIndex) {
            const slot = this.timeSlots[baseIndex];
            return this.normalizePlanActivitiesArray(slot.planActivities).map(item => ({ ...item }));
        },
    };

    const result = getPlanActivitiesWithVirtualGaps.call(ctx, 0);

    assert.deepEqual(result, [{ label: '휴식', seconds: 3600, startMinute: 0, durationMinutes: 60 }]);
    assert.equal(result[0].kind, undefined);
});

test('right resize shrink creates a trailing virtual rest gap', () => {
    const ctx = {
        timeSlots: [{ planned: 'Work', planActivities: [{ label: 'Work', seconds: 3600 }] }],
        getBlockLength() {
            return 1;
        },
        normalizePlanActivitiesArray(value) {
            return require('../core/activity-core').normalizePlanActivitiesArray(value);
        },
        isPlanSegmentTimerRunning() {
            return false;
        },
        renderTimeEntries() {},
        calculateTotals() {},
        autoSave() {},
    };

    const changed = resizePlanActivitySegment.call(ctx, 0, 0, 'right', -30);
    const gaps = getPlanActivitiesWithVirtualGaps.call({
        ...ctx,
        getSplitActivities(type, baseIndex) {
            return this.normalizePlanActivitiesArray(this.timeSlots[baseIndex].planActivities).map(item => ({ ...item }));
        },
        getPlannedLabelForIndex() {
            return 'Work';
        },
    }, 0);

    assert.equal(changed, true);
    assert.equal(ctx.timeSlots[0].planActivities[0].durationMinutes, 30);
    assert.equal(gaps.some((item) => item.kind === 'virtual-rest' && item.durationMinutes === 30), true);
});

test('left resize shrink creates a leading virtual rest gap', () => {
    const ctx = {
        timeSlots: [{ planned: 'Work', planActivities: [{ label: 'Work', seconds: 3600 }] }],
        getBlockLength() {
            return 1;
        },
        normalizePlanActivitiesArray(value) {
            return require('../core/activity-core').normalizePlanActivitiesArray(value);
        },
        isPlanSegmentTimerRunning() {
            return false;
        },
        renderTimeEntries() {},
        calculateTotals() {},
        autoSave() {},
    };

    const changed = resizePlanActivitySegment.call(ctx, 0, 0, 'left', 20);
    const items = getPlanActivitiesWithVirtualGaps.call({
        ...ctx,
        getSplitActivities(type, baseIndex) {
            return this.normalizePlanActivitiesArray(this.timeSlots[baseIndex].planActivities).map(item => ({ ...item }));
        },
        getPlannedLabelForIndex() {
            return 'Work';
        },
    }, 0);

    assert.equal(changed, true);
    assert.equal(ctx.timeSlots[0].planActivities[0].startMinute, 20);
    assert.equal(ctx.timeSlots[0].planActivities[0].durationMinutes, 40);
    assert.equal(items[0].kind, 'virtual-rest');
    assert.equal(items[0].durationMinutes, 20);
});

test('resize expansion is blocked by adjacent real segments and running timers', () => {
    const ctx = {
        timeSlots: [{
            planned: 'A · B',
            planActivities: [
                { label: 'A', seconds: 1800, startMinute: 0, durationMinutes: 30 },
                { label: 'B', seconds: 1800, startMinute: 30, durationMinutes: 30 },
            ],
            planSegmentTimers: { 'planned-0-0-seg0': { running: true } },
        }],
        getBlockLength() {
            return 1;
        },
        normalizePlanActivitiesArray(value) {
            return require('../core/activity-core').normalizePlanActivitiesArray(value);
        },
        isPlanSegmentTimerRunning(baseIndex) {
            return Object.values(this.timeSlots[baseIndex].planSegmentTimers).some((timer) => timer.running);
        },
        renderTimeEntries() {
            assert.fail('running resize should not render');
        },
        calculateTotals() {},
        autoSave() {},
    };

    assert.equal(resizePlanActivitySegment.call(ctx, 0, 0, 'right', 20), false);
    ctx.timeSlots[0].planSegmentTimers['planned-0-0-seg0'].running = false;
    assert.equal(resizePlanActivitySegment.call(ctx, 0, 0, 'right', 20), false);
    assert.equal(ctx.timeSlots[0].planActivities[0].durationMinutes, 30);
});

test('inline title update matches catalog child metadata without renaming catalog entries', () => {
    const catalog = [
        { id: 'work', label: 'Work' },
        { id: 'focus', label: 'Focus', parentId: 'work' },
    ];
    const ctx = {
        plannedActivities: catalog.map((item) => ({ ...item })),
        timeSlots: [{ planned: 'Old', planActivities: [{ label: 'Old', seconds: 1800, startMinute: 0, durationMinutes: 30 }] }],
        normalizeActivityText(value) {
            return String(value || '').trim();
        },
        normalizePlanActivitiesArray(value) {
            return require('../core/activity-core').normalizePlanActivitiesArray(value);
        },
        findPlannedCatalogItemByLabel(label) {
            const normalized = this.normalizeActivityText(label);
            return this.plannedActivities.find((item) => this.normalizeActivityText(item.label) === normalized) || null;
        },
        renderTimeEntries() {},
        calculateTotals() {},
        autoSave() {},
    };

    assert.equal(updatePlanSegmentTitle.call(ctx, 0, 0, 'Focus'), true);
    assert.equal(ctx.timeSlots[0].planActivities[0].label, 'Focus');
    assert.equal(ctx.timeSlots[0].planActivities[0].activityId, 'focus');
    assert.equal(ctx.timeSlots[0].planActivities[0].titleActivityId, 'work');
    assert.equal(ctx.timeSlots[0].planActivities[0].titleText, 'Work');
    assert.deepEqual(ctx.plannedActivities, catalog);
});

test('inline title editor saves on Enter, cancels on Escape, and preserves empty values', () => {
    const originalDocument = globalThis.document;
    const events = {};
    let replacement = null;
    const labelEl = {
        textContent: 'Old',
        parentNode: {},
        replaceWith(node) {
            replacement = node;
        },
    };
    const ctx = {
        updates: [],
        normalizeActivityText(value) {
            return String(value || '').trim();
        },
        updatePlanSegmentTitle(baseIndex, activityIndex, value) {
            this.updates.push({ baseIndex, activityIndex, value });
        },
    };
    globalThis.document = {
        createElement(tag) {
            return {
                tag,
                value: '',
                className: '',
                textContent: '',
                title: '',
                setAttribute() {},
                addEventListener(type, handler) {
                    events[type] = handler;
                },
                replaceWith(node) {
                    replacement = node;
                },
                focus() {},
                select() {},
            };
        },
    };

    try {
        assert.equal(beginPlanSegmentTitleEdit.call(ctx, labelEl, 0, 0), true);
        replacement.value = 'New';
        events.keydown({ key: 'Enter', isComposing: false, preventDefault() {} });
        assert.deepEqual(ctx.updates, [{ baseIndex: 0, activityIndex: 0, value: 'New' }]);

        beginPlanSegmentTitleEdit.call(ctx, labelEl, 0, 0);
        replacement.value = 'Cancelled';
        events.keydown({ key: 'Escape', preventDefault() {} });
        assert.equal(ctx.updates.length, 1);

        beginPlanSegmentTitleEdit.call(ctx, labelEl, 0, 0);
        replacement.value = '   ';
        events.blur();
        assert.equal(ctx.updates.length, 1);
    } finally {
        globalThis.document = originalDocument;
    }
});

test('background move drops a segment into a virtual gap and leaves old space empty', () => {
    const ctx = {
        timeSlots: [{
            planned: 'A · B',
            planActivities: [
                { label: 'A', seconds: 1200, startMinute: 0, durationMinutes: 20 },
                { label: 'B', seconds: 1200, startMinute: 40, durationMinutes: 20 },
            ],
        }],
        getBlockLength() {
            return 1;
        },
        normalizePlanActivitiesArray(value) {
            return require('../core/activity-core').normalizePlanActivitiesArray(value);
        },
        isPlanSegmentTimerRunning() {
            return false;
        },
        renderTimeEntries() {},
        calculateTotals() {},
        autoSave() {},
    };

    assert.equal(movePlanActivitySegment.call(ctx, 0, 0, 20), true);
    assert.equal(ctx.timeSlots[0].planActivities[0].label, 'A');
    assert.equal(ctx.timeSlots[0].planActivities[0].startMinute, 20);
    const items = getPlanActivitiesWithVirtualGaps.call({
        ...ctx,
        getSplitActivities(type, baseIndex) {
            return this.normalizePlanActivitiesArray(this.timeSlots[baseIndex].planActivities).map(item => ({ ...item }));
        },
        getPlannedLabelForIndex() {
            return 'A · B';
        },
    }, 0);
    assert.equal(items.some((item) => item.kind === 'virtual-rest' && item.startMinute === 0 && item.durationMinutes === 20), true);
});

test('background move blocks overlap and running timers', () => {
    const ctx = {
        timeSlots: [{
            planned: 'A · B',
            planActivities: [
                { label: 'A', seconds: 1800, startMinute: 0, durationMinutes: 30 },
                { label: 'B', seconds: 1800, startMinute: 30, durationMinutes: 30 },
            ],
            planSegmentTimers: {},
        }],
        getBlockLength() {
            return 1;
        },
        normalizePlanActivitiesArray(value) {
            return require('../core/activity-core').normalizePlanActivitiesArray(value);
        },
        isPlanSegmentTimerRunning() {
            return false;
        },
        renderTimeEntries() {
            assert.fail('blocked move should not render');
        },
        calculateTotals() {},
        autoSave() {},
    };

    assert.equal(movePlanActivitySegment.call(ctx, 0, 0, 20), false);
    ctx.isPlanSegmentTimerRunning = () => true;
    assert.equal(movePlanActivitySegment.call(ctx, 0, 0, 0), false);
});

function buildActionCtx(planActivities, options = {}) {
    return {
        timeSlots: [{
            planned: planActivities.map((item) => item.label).join(' · '),
            planActivities: planActivities.map((item) => ({ ...item })),
            planSegmentTimers: options.timers || {},
        }],
        getBlockLength() {
            return 1;
        },
        normalizePlanActivitiesArray(value) {
            return require('../core/activity-core').normalizePlanActivitiesArray(value);
        },
        getNormalizedPlanSegmentActivities(baseIndex) {
            const slot = this.timeSlots[baseIndex];
            return this.normalizePlanActivitiesArray(slot.planActivities).map((item) => ({ ...item }));
        },
        isPlanSegmentTimerRunning() {
            return Boolean(options.running);
        },
        renderTimeEntries() {
            this.rendered = true;
        },
        calculateTotals() {},
        autoSave() {},
    };
}

test('toolbar split, merge, delete, and duplicate update real segments only', () => {
    let ctx = buildActionCtx([{ label: 'A', seconds: 2400, startMinute: 0, durationMinutes: 40 }]);
    assert.equal(applyPlanSegmentAction.call(ctx, 0, 0, 'split'), true);
    assert.deepEqual(ctx.timeSlots[0].planActivities.map((item) => item.durationMinutes), [20, 20]);

    ctx = buildActionCtx([
        { label: 'A', seconds: 1200, startMinute: 0, durationMinutes: 20 },
        { label: 'A', seconds: 1200, startMinute: 20, durationMinutes: 20 },
    ]);
    assert.equal(applyPlanSegmentAction.call(ctx, 0, 0, 'merge'), true);
    assert.equal(ctx.timeSlots[0].planActivities.length, 1);
    assert.equal(ctx.timeSlots[0].planActivities[0].durationMinutes, 40);

    ctx = buildActionCtx([{ label: 'A', seconds: 1200, startMinute: 20, durationMinutes: 20 }]);
    assert.equal(applyPlanSegmentAction.call(ctx, 0, 0, 'delete'), true);
    assert.equal(ctx.timeSlots[0].planActivities.length, 0);

    ctx = buildActionCtx([{ label: 'A', seconds: 1200, startMinute: 0, durationMinutes: 20 }]);
    assert.equal(applyPlanSegmentAction.call(ctx, 0, 0, 'duplicate'), true);
    assert.deepEqual(ctx.timeSlots[0].planActivities.map((item) => item.startMinute), [0, 20]);
});

test('toolbar actions protect running segments and incompatible merge', () => {
    let ctx = buildActionCtx([{ label: 'A', seconds: 1200, startMinute: 0, durationMinutes: 20 }], { running: true });
    assert.equal(applyPlanSegmentAction.call(ctx, 0, 0, 'delete'), false);
    assert.equal(ctx.rendered, undefined);

    ctx = buildActionCtx([
        { label: 'A', seconds: 1200, startMinute: 0, durationMinutes: 20 },
        { label: 'B', seconds: 1200, startMinute: 20, durationMinutes: 20 },
    ]);
    assert.equal(applyPlanSegmentAction.call(ctx, 0, 0, 'merge'), false);
});

test('row swap exchanges plan contents and recalculates segment starts', () => {
    const ctx = {
        timeSlots: [
            { planned: 'A', planActivities: [{ label: 'A', seconds: 1200, startMinute: 0, durationMinutes: 20 }], planSegmentTimers: {} },
            { planned: 'B', planActivities: [{ label: 'B', seconds: 1800, startMinute: 60, durationMinutes: 30 }], planSegmentTimers: {} },
        ],
        normalizePlanActivitiesArray(value) {
            return require('../core/activity-core').normalizePlanActivitiesArray(value);
        },
        isPlanSegmentTimerRunning() {
            return false;
        },
        renderTimeEntries() {},
        calculateTotals() {},
        autoSave() {},
    };

    assert.equal(swapPlanRows.call(ctx, 0, 1), true);
    assert.equal(ctx.timeSlots[0].planned, 'B');
    assert.equal(ctx.timeSlots[1].planned, 'A');
    assert.equal(ctx.timeSlots[0].planActivities[0].startMinute, 0);
    assert.equal(ctx.timeSlots[1].planActivities[0].startMinute, 60);
});

test('row swap is blocked when either row has a running plan segment timer', () => {
    const ctx = {
        timeSlots: [
            { planned: 'A', planActivities: [{ label: 'A', seconds: 1200, startMinute: 0, durationMinutes: 20 }], planSegmentTimers: { a: { running: true } } },
            { planned: 'B', planActivities: [{ label: 'B', seconds: 1800, startMinute: 60, durationMinutes: 30 }], planSegmentTimers: {} },
        ],
        normalizePlanActivitiesArray(value) {
            return require('../core/activity-core').normalizePlanActivitiesArray(value);
        },
        isPlanSegmentTimerRunning(index) {
            return Object.values(this.timeSlots[index].planSegmentTimers || {}).some((timer) => timer.running);
        },
        renderTimeEntries() {
            assert.fail('blocked row swap should not render');
        },
        calculateTotals() {},
        autoSave() {},
    };

    assert.equal(swapPlanRows.call(ctx, 0, 1), false);
    assert.equal(ctx.timeSlots[0].planned, 'A');
    assert.equal(ctx.timeSlots[1].planned, 'B');
});
