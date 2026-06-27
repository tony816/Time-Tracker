const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

globalThis.TimeTrackerActualGridCore = require('../core/actual-grid-core');
globalThis.TimeTrackerPlanSegmentCore = require('../core/plan-segment-core');

const { buildMethod } = require('./helpers/script-method-builder');

const computeSplitSegments = buildMethod('computeSplitSegments(type, index)', '(type, index)');
const getSplitActivities = buildMethod('getSplitActivities(type, baseIndex)', '(type, baseIndex)');
const repoRoot = path.resolve(__dirname, '..');

function createContext(planActivities, overrides = {}) {
    const slot = {
        planned: '',
        planTitle: '',
        planTitleBandOn: false,
        planActivities,
    };
    return {
        timeSlots: [slot],
        actualRecordingDisabled: true,
        mergedFields: new Map(),
        findMergeKey() {
            return null;
        },
        getSplitBaseIndex(type, index) {
            assert.equal(type, 'planned');
            return index;
        },
        getSplitRange(type, index) {
            assert.equal(type, 'planned');
            return { start: index, end: index };
        },
        getBlockLength(type, index) {
            assert.equal(type, 'planned');
            assert.equal(index, 0);
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
        getSplitActivities,
        ...overrides,
    };
}

test('computeSplitSegments renders a virtual rest gap for unfilled planned block time', () => {
    const planActivities = [{ label: 'work', seconds: 40 * 60 }];
    const ctx = createContext(planActivities);

    const result = computeSplitSegments.call(ctx, 'planned', 0);

    assert.equal(ctx.timeSlots[0].planActivities, planActivities);
    assert.deepEqual(ctx.timeSlots[0].planActivities, [{ label: 'work', seconds: 40 * 60 }]);
    assert.ok(result);
    assert.equal(result.gridSegments.length, 2);
    assert.equal(result.gridSegments[0].label, 'work');
    assert.equal(result.gridSegments[0].span, 4);
    assert.equal(result.gridSegments[1].label, '휴식');
    assert.equal(result.gridSegments[1].kind, 'virtual-rest');
    assert.equal(result.gridSegments[1].virtual, true);
    assert.equal(result.gridSegments[1].durationMinutes, 20);
    assert.equal(result.gridSegments[1].span, 2);
});

test('computeSplitSegments does not render a virtual rest gap under ten minutes', () => {
    const ctx = createContext([{ label: 'work', seconds: 55 * 60 }]);

    const result = computeSplitSegments.call(ctx, 'planned', 0);

    assert.ok(result);
    assert.equal(result.gridSegments.length, 1);
    assert.equal(result.gridSegments[0].label, 'work');
    assert.equal(result.gridSegments[0].span, 6);
    assert.equal(result.gridSegments.some(segment => segment.kind === 'virtual-rest'), false);
});

test('computeSplitSegments renders a full-duration virtual rest segment for an empty planned block', () => {
    const ctx = createContext([]);

    const result = computeSplitSegments.call(ctx, 'planned', 0);

    assert.ok(result);
    assert.equal(result.gridSegments.length, 1);
    assert.equal(result.gridSegments[0].label, '휴식');
    assert.equal(result.gridSegments[0].kind, 'virtual-rest');
    assert.equal(result.gridSegments[0].virtual, true);
    assert.equal(result.gridSegments[0].startMinute, 0);
    assert.equal(result.gridSegments[0].durationMinutes, 60);
    // slot.planActivities should remain empty (not infected with virtual rest)
    assert.equal(ctx.timeSlots[0].planActivities.length, 0);
});

test('computeSplitSegments renders leading and trailing virtual rest around a middle real segment', () => {
    const ctx = createContext([
        { label: 'shower', seconds: 20 * 60, startMinute: 20, durationMinutes: 20, endMinute: 40 },
    ]);

    const result = computeSplitSegments.call(ctx, 'planned', 0);

    assert.ok(result);
    assert.equal(result.gridSegments.length, 3);
    assert.equal(result.gridSegments[0].kind, 'virtual-rest');
    assert.equal(result.gridSegments[0].startMinute, 0);
    assert.equal(result.gridSegments[0].durationMinutes, 20);
    assert.equal(result.gridSegments[1].label, 'shower');
    assert.equal(result.gridSegments[1].startMinute, 20);
    assert.equal(result.gridSegments[1].endMinute, 40);
    assert.equal(result.gridSegments[2].kind, 'virtual-rest');
    assert.equal(result.gridSegments[2].startMinute, 40);
    assert.equal(result.gridSegments[2].durationMinutes, 20);
});

test('computeSplitSegments omits virtual rest between adjacent real segments', () => {
    const ctx = createContext([
        { label: 'A', seconds: 30 * 60, startMinute: 0, durationMinutes: 30, endMinute: 30 },
        { label: 'B', seconds: 30 * 60, startMinute: 30, durationMinutes: 30, endMinute: 60 },
    ]);

    const result = computeSplitSegments.call(ctx, 'planned', 0);

    assert.ok(result);
    assert.equal(result.gridSegments.length, 2);
    assert.equal(result.gridSegments[0].label, 'A');
    assert.equal(result.gridSegments[1].label, 'B');
    assert.equal(result.gridSegments.some(segment => segment.kind === 'virtual-rest'), false);
});

test('computeSplitSegments keeps a real saved rest activity distinct from virtual rest', () => {
    const ctx = createContext([{ label: '휴식', seconds: 60 * 60 }]);

    const result = computeSplitSegments.call(ctx, 'planned', 0);

    assert.ok(result);
    assert.equal(result.gridSegments.length, 1);
    assert.equal(result.gridSegments[0].label, '휴식');
    assert.equal(result.gridSegments[0].kind, undefined);
    assert.equal(result.gridSegments[0].virtual, undefined);
});

test('computeSplitSegments preserves parent title metadata on child planned segments', () => {
    const ctx = createContext([
        {
            label: 'english',
            seconds: 40 * 60,
            titleActivityId: 'study',
            titleText: 'study',
            activityId: 'english',
            activityText: 'english',
        },
    ]);

    const result = computeSplitSegments.call(ctx, 'planned', 0);

    assert.ok(result);
    assert.equal(result.gridSegments[0].label, 'english');
    assert.equal(result.gridSegments[0].titleLabel, 'study');
});

test('computeSplitSegments groups adjacent same planned activity for display timing and keeps resize on the later segment', () => {
    const ctx = createContext([
        { label: 'Exercise', seconds: 20 * 60, startMinute: 0, durationMinutes: 20, endMinute: 20 },
        { label: 'Exercise', seconds: 40 * 60, startMinute: 20, durationMinutes: 40, endMinute: 60 },
    ]);

    const result = computeSplitSegments.call(ctx, 'planned', 0);

    assert.ok(result);
    assert.equal(result.gridSegments.length, 1);
    assert.equal(result.gridSegments[0].label, 'Exercise');
    assert.equal(result.gridSegments[0].durationMinutes, 60);
    assert.equal(result.gridSegments[0].startMinute, 0);
    assert.equal(result.gridSegments[0].endMinute, 60);
    assert.equal(result.gridSegments[0].timerSegmentIndex, 0);
    assert.equal(result.gridSegments[0].segmentIndex, 1);
});

test('computeSplitSegments keeps non-adjacent same planned activity timing separate', () => {
    const ctx = createContext([
        { label: 'Exercise', seconds: 20 * 60, startMinute: 0, durationMinutes: 20, endMinute: 20 },
        { label: 'Study', seconds: 20 * 60, startMinute: 20, durationMinutes: 20, endMinute: 40 },
        { label: 'Exercise', seconds: 20 * 60, startMinute: 40, durationMinutes: 20, endMinute: 60 },
    ]);

    const result = computeSplitSegments.call(ctx, 'planned', 0);

    assert.ok(result);
    assert.deepEqual(result.gridSegments.map(segment => ({
        label: segment.label,
        durationMinutes: segment.durationMinutes,
        segmentIndex: segment.segmentIndex,
        timerSegmentIndex: segment.timerSegmentIndex,
    })), [
        { label: 'Exercise', durationMinutes: 20, segmentIndex: 0, timerSegmentIndex: 0 },
        { label: 'Study', durationMinutes: 20, segmentIndex: 1, timerSegmentIndex: 1 },
        { label: 'Exercise', durationMinutes: 20, segmentIndex: 2, timerSegmentIndex: 2 },
    ]);
});

// ===== label visibility hooks for default virtual rest =====

const renderController = require("../controllers/time-entry-render-controller");

function createRenderContext(planActivities, overrides = {}) {
    const base = createContext(planActivities, overrides);
    return Object.assign(base, {
        escapeHtml(text) { return String(text || ""); },
        escapeAttribute(text) { return String(text || "").replace(/"/g, "&quot;"); },
        getSplitColor(type, label) { return label ? "#abcdef" : "rgba(231,236,241,0.28)"; },
        buildPlanSegmentViewModel(baseIndex, segmentId) {
            return { id: segmentId, display: { icon: "▶", timeText: "", tone: "under" } };
        },
        isPlanSegmentRunning() { return false; },
        getPlanSegmentTimerIcon() { return "▶"; },
        getPlanSegmentTimerText() { return ""; },
        getPlanSegmentTimeTone() { return "under"; },
        getPlanSegmentId(index, segmentIndex) { return "planned-" + index + "-seg" + (segmentIndex != null ? segmentIndex : 0); },
        selectedPlanSegment: null,
        computeSplitSegments: computeSplitSegments,
    });
}

function getVirtualRestSegmentHtml(html) {
    const match = html.match(/<div class="split-grid-segment[^"]*split-grid-segment-virtual-rest[^>]*>[\s\S]*?<\/div>/);
    assert.ok(match, "virtual rest segment must render");
    return match[0];
}

test("buildSplitVisualization sets data-empty-slot-default-rest on empty planned block", () => {
    const ctx = createRenderContext([]);
    const html = renderController.buildSplitVisualization.call(ctx, "planned", 0);
    const restHtml = getVirtualRestSegmentHtml(html);
    assert.ok(html.includes('data-empty-slot-default-rest="true"'), "empty slot must carry default rest attribute");
    assert.ok(!restHtml.includes("split-grid-label"), "virtual rest must not render a visual label");
    assert.ok(!restHtml.includes("title="), "virtual rest must not expose a native visual tooltip");
    assert.ok(restHtml.includes("aria-label="), "virtual rest keeps non-visual accessibility text");
    assert.ok(html.includes("split-grid-segment-virtual-rest"), "must include virtual-rest class");
});

test("buildSplitVisualization does NOT set data-empty-slot-default-rest on partial gap", () => {
    const ctx = createRenderContext([
        { label: "Work", seconds: 40 * 60, startMinute: 0, durationMinutes: 40, endMinute: 40 },
    ]);
    const html = renderController.buildSplitVisualization.call(ctx, "planned", 0);
    const restHtml = getVirtualRestSegmentHtml(html);
    assert.ok(!html.includes('data-empty-slot-default-rest="true"'), "partial gap must not carry default rest attribute");
    assert.ok(!restHtml.includes("split-grid-label"), "partial virtual rest gap must not render a visual label");
    assert.ok(restHtml.includes("aria-label="), "partial virtual rest gap keeps non-visual accessibility text");
    assert.ok(html.includes("split-grid-segment-virtual-rest"), "must include virtual-rest class");
});

test("buildSplitVisualization treats explicit saved rest as real plan segment", () => {
    const ctx = createRenderContext([
        { label: "휴식", seconds: 60 * 60, startMinute: 0, durationMinutes: 60, endMinute: 60 },
    ]);
    const html = renderController.buildSplitVisualization.call(ctx, "planned", 0);
    assert.ok(!html.includes("split-grid-segment-virtual-rest"), "explicit rest must not be virtual-rest");
    assert.ok(!html.includes('data-empty-slot-default-rest="true"'), "explicit rest must not carry default rest attribute");
    assert.ok(html.includes('data-segment-kind="real-plan"'), "explicit rest must be real-plan");
    assert.ok(html.includes("휴식"), "label visible for explicit rest");
});

test("full virtual rest block structurally clickable with data attributes", () => {
    const ctx = createRenderContext([]);
    const html = renderController.buildSplitVisualization.call(ctx, "planned", 0);
    assert.ok(html.includes("split-grid-segment-virtual-rest"), "virtual rest div present");
    assert.ok(html.includes('data-empty-slot-default-rest="true"'), "default rest attribute set");
});

test("non-empty virtual rest gap has no visual label and no default rest attribute", () => {
    const ctx = createRenderContext([
        { label: "A", seconds: 30 * 60, startMinute: 0, durationMinutes: 30, endMinute: 30 },
    ]);
    const html = renderController.buildSplitVisualization.call(ctx, "planned", 0);
    const restHtml = getVirtualRestSegmentHtml(html);
    assert.ok(!restHtml.includes("split-grid-label"), "gap label must not be visually rendered");
    assert.ok(!html.includes('data-empty-slot-default-rest="true"'), "gap must not be marked empty-slot default");
    assert.ok(html.includes("split-grid-segment-virtual-rest"), "must have virtual-rest class");
});

test("virtual rest CSS keeps labels hidden across hover focus and targeted states", () => {
    const css = fs.readFileSync(path.join(repoRoot, "styles", "interactions.css"), "utf8");
    assert.match(
        css,
        /\.split-visualization-planned \.split-grid-segment-virtual-rest\[data-segment-kind="virtual-rest"\] \.split-grid-label,[\s\S]*?display:\s*none !important;/
    );
    assert.match(
        css,
        /\.split-visualization-planned \.split-grid-segment-virtual-rest\[data-segment-kind="virtual-rest"\]\.is-rest-slot-targeted\s*\{[\s\S]*?color:\s*transparent;/
    );
    assert.doesNotMatch(
        css,
        /\.split-grid-segment-virtual-rest\[data-empty-slot-default-rest="true"\][\s\S]*?opacity:\s*1;/
    );
});

