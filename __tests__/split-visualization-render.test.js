const test = require('node:test');
const assert = require('node:assert/strict');

const controller = require('../controllers/time-entry-render-controller');
const { buildSplitVisualization } = controller;

test('buildSplitVisualization renders running outline classes without throwing', () => {
    const ctx = {
        computeSplitSegments(type, index) {
            assert.equal(type, 'actual');
            assert.equal(index, 3);
            return {
                showTitleBand: false,
                toggleable: true,
                showLabels: true,
                gridSegments: [
                    {
                        label: '작업',
                        span: 2,
                        reservedIndices: [3, 4],
                        active: true,
                        locked: false,
                        failed: false,
                        connectTop: true,
                        connectBottom: false,
                        unitIndex: 4,
                        runningOutline: true,
                        runningEdgeTop: true,
                        runningEdgeRight: false,
                        runningEdgeBottom: true,
                        runningEdgeLeft: true,
                    },
                ],
            };
        },
        escapeHtml(value) {
            return String(value);
        },
        getSplitColor() {
            return '#abcdef';
        },
    };

    const html = buildSplitVisualization.call(ctx, 'actual', 3);

    assert.match(html, /split-visualization-actual/);
    assert.match(html, /split-grid-segment/);
    assert.match(html, /is-running-outline/);
    assert.match(html, /running-edge-top/);
    assert.match(html, /running-edge-bottom/);
    assert.match(html, /running-edge-left/);
});

test('buildSplitVisualization renders virtual rest gaps without plan timer controls', () => {
    const ctx = {
        actualRecordingDisabled: true,
        computeSplitSegments(type, index) {
            assert.equal(type, 'planned');
            assert.equal(index, 5);
            return {
                showTitleBand: false,
                gridSegments: [
                    { label: 'work', span: 4, connectTop: false, connectBottom: false },
                    {
                        label: 'rest',
                        span: 2,
                        connectTop: false,
                        connectBottom: false,
                        kind: 'virtual-rest',
                        virtual: true,
                        durationMinutes: 20,
                    },
                ],
            };
        },
        escapeHtml(value) {
            return String(value);
        },
        escapeAttribute(value) {
            return String(value);
        },
        getSplitColor() {
            return '#abcdef';
        },
        getPlanSegmentBaseIndex() {
            return 5;
        },
        buildPlanSegmentViewModel() {
            return {
                id: 'planned-5-0',
                display: {
                    icon: 'play',
                    timeText: '0m / 40m',
                    tone: 'under',
                },
            };
        },
    };

    const html = buildSplitVisualization.call(ctx, 'planned', 5);

    assert.match(html, /split-grid-segment-virtual-rest/);
    assert.match(html, /data-segment-kind="virtual-rest"/);
    const virtualRestSegment = html.match(/<div class="split-grid-segment[^"]*split-grid-segment-virtual-rest[^>]*>[\s\S]*?<\/div>/)[0];
    assert.doesNotMatch(virtualRestSegment, /plan-segment-timer-button/);
    assert.doesNotMatch(virtualRestSegment, /plan-segment-timer-time/);
    assert.match(html, /class="plan-segment-timer-button"/);
});

test('buildSplitVisualization does not mark a real saved rest activity as virtual rest', () => {
    const ctx = {
        actualRecordingDisabled: true,
        computeSplitSegments() {
            return {
                showTitleBand: false,
                gridSegments: [
                    { label: 'rest', span: 6, connectTop: false, connectBottom: false },
                ],
            };
        },
        escapeHtml(value) {
            return String(value);
        },
        escapeAttribute(value) {
            return String(value);
        },
        getSplitColor() {
            return '#abcdef';
        },
        getPlanSegmentBaseIndex() {
            return 2;
        },
        buildPlanSegmentViewModel() {
            return {
                id: 'planned-2-2',
                display: {
                    icon: 'play',
                    timeText: '0m / 60m',
                    tone: 'under',
                },
            };
        },
    };

    const html = buildSplitVisualization.call(ctx, 'planned', 2);

    assert.doesNotMatch(html, /split-grid-segment-virtual-rest/);
    assert.match(html, /class="plan-segment-timer-button"/);
});

test('buildSplitVisualization renders plan-only timer controls inside planned grid segments', () => {
    const ctx = {
        actualRecordingDisabled: true,
        computeSplitSegments(type, index) {
            assert.equal(type, 'planned');
            assert.equal(index, 5);
            return {
                showTitleBand: false,
                gridSegments: [
                    { label: '집중 작업', span: 6, connectTop: false, connectBottom: false },
                ],
            };
        },
        escapeHtml(value) {
            return String(value);
        },
        escapeAttribute(value) {
            return String(value);
        },
        getSplitColor() {
            return '#abcdef';
        },
        getPlanSegmentBaseIndex() {
            return 5;
        },
        buildPlanSegmentViewModel() {
            return {
                id: 'planned-5-5',
                title: '집중 작업',
                plannedSeconds: 3600,
                timer: {
                    status: 'idle',
                    elapsedSeconds: 0,
                    startedAt: null,
                    lastPausedAt: null,
                },
                display: {
                    icon: '▶',
                    action: 'start',
                    timeText: '0m / 60m',
                    tone: 'under',
                },
            };
        },
    };

    const html = buildSplitVisualization.call(ctx, 'planned', 5);

    assert.match(html, /split-visualization-planned/);
    assert.match(html, /has-plan-segment-timer/);
    assert.match(html, /class="plan-segment-timer-button"/);
    assert.match(html, /집중 작업/);
    assert.match(html, /0m \/ 60m/);
});

test('buildSplitVisualization renders parent title above child activity inside plan segment', () => {
    const ctx = {
        actualRecordingDisabled: true,
        computeSplitSegments(type, index) {
            assert.equal(type, 'planned');
            assert.equal(index, 5);
            return {
                showTitleBand: true,
                titleSegments: [{ label: '운동', span: 6 }],
                gridSegments: [
                    { label: '스쿼트', titleLabel: '운동', span: 6, connectTop: false, connectBottom: false },
                ],
            };
        },
        escapeHtml(value) {
            return String(value);
        },
        escapeAttribute(value) {
            return String(value);
        },
        getSplitColor() {
            return '#abcdef';
        },
        getPlanSegmentBaseIndex() {
            return 5;
        },
        buildPlanSegmentViewModel() {
            return {
                id: 'planned-5-5',
                title: '스쿼트',
                plannedSeconds: 3600,
                timer: {
                    status: 'idle',
                    elapsedSeconds: 0,
                    startedAt: null,
                    lastPausedAt: null,
                },
                display: {
                    icon: '▶',
                    action: 'start',
                    timeText: '0m / 60m',
                    tone: 'under',
                },
            };
        },
    };

    const html = buildSplitVisualization.call(ctx, 'planned', 5);

    assert.match(html, /plan-segment-graphic-title[^>]*>운동<\/span>/);
    assert.match(html, /plan-segment-graphic-label[^>]*>스쿼트<\/span>/);
    assert.match(html, /has-segment-title/);
    assert.doesNotMatch(html, /split-title-band/);
});

test('buildSplitVisualization renders resize handles only for idle real plan segments', () => {
    const idleCtx = {
        actualRecordingDisabled: true,
        computeSplitSegments() {
            return {
                showTitleBand: false,
                gridSegments: [
                    { label: 'Plan', span: 6, segmentIndex: 0, startMinute: 0, durationMinutes: 60, endMinute: 60 },
                ],
            };
        },
        escapeHtml(value) {
            return String(value);
        },
        escapeAttribute(value) {
            return String(value);
        },
        getSplitColor() {
            return '#abcdef';
        },
        getPlanSegmentBaseIndex() {
            return 0;
        },
        buildPlanSegmentViewModel() {
            return {
                id: 'planned-0-0-seg0',
                timer: { status: 'idle', running: false },
                display: { icon: 'play', timeText: '0m / 60m', tone: 'under' },
            };
        },
    };

    const idleHtml = buildSplitVisualization.call(idleCtx, 'planned', 0);
    assert.match(idleHtml, /data-segment-kind="real-plan"/);
    assert.match(idleHtml, /plan-segment-resize-handle-left/);
    assert.match(idleHtml, /plan-segment-resize-handle-right/);

    const runningCtx = {
        ...idleCtx,
        computeSplitSegments() {
            return {
                showTitleBand: false,
                gridSegments: [
                    { label: 'Run', span: 3, segmentIndex: 0, startMinute: 0, durationMinutes: 30, endMinute: 30 },
                    { label: 'Rest', span: 3, kind: 'virtual-rest', virtual: true, startMinute: 30, durationMinutes: 30 },
                ],
            };
        },
        buildPlanSegmentViewModel() {
            return {
                id: 'planned-0-0-seg0',
                timer: { status: 'running', running: true },
                display: { icon: 'pause', timeText: '5m / 30m', tone: 'under' },
            };
        },
    };

    const runningHtml = buildSplitVisualization.call(runningCtx, 'planned', 0);
    assert.match(runningHtml, /is-plan-segment-resize-disabled/);
    const runningPlanSegment = runningHtml.match(/<div class="split-grid-segment[^"]*is-plan-segment-resize-disabled[^>]*>[\s\S]*?<\/div>/)[0];
    assert.doesNotMatch(runningPlanSegment, /plan-segment-resize-handle/);
    const virtualRestSegment = runningHtml.match(/<div class="split-grid-segment[^"]*split-grid-segment-virtual-rest[^>]*>[\s\S]*?<\/div>/)[0];
    assert.doesNotMatch(virtualRestSegment, /data-segment-kind="real-plan"/);
    assert.doesNotMatch(virtualRestSegment, /plan-segment-resize-handle/);
});

test('buildSplitVisualization renders one persistent shared handle at adjacent boundaries', () => {
    const ctx = {
        actualRecordingDisabled: true,
        computeSplitSegments() {
            return {
                showTitleBand: false,
                gridSegments: [
                    { label: 'A', span: 3, segmentIndex: 0, startMinute: 0, durationMinutes: 30, endMinute: 30 },
                    { label: 'B', span: 3, segmentIndex: 1, startMinute: 30, durationMinutes: 30, endMinute: 60 },
                ],
            };
        },
        escapeHtml(value) { return String(value); },
        escapeAttribute(value) { return String(value); },
        getSplitColor() { return '#abcdef'; },
        getPlanSegmentBaseIndex() { return 0; },
        buildPlanSegmentViewModel(baseIndex, segmentId) {
            return {
                id: segmentId,
                timer: { status: 'idle', running: false },
                display: { icon: 'play', timeText: '0m', tone: 'under' },
            };
        },
    };

    const html = buildSplitVisualization.call(ctx, 'planned', 0);
    const firstSegment = html.match(/<div class="split-grid-segment[^"]*"[^>]*data-segment-index="0"[\s\S]*?<\/div>/)[0];
    const secondSegment = html.match(/<div class="split-grid-segment[^"]*"[^>]*data-segment-index="1"[\s\S]*?<\/div>/)[0];

    assert.match(firstSegment, /plan-segment-boundary-resize-handle-shared/);
    assert.match(firstSegment, /plan-segment-resize-handle-right/);
    assert.doesNotMatch(secondSegment, /plan-segment-resize-handle-left/);
    assert.equal((html.match(/plan-segment-boundary-resize-handle-shared/g) || []).length, 1);
});

test('buildSplitVisualization renders one boundary handle between leading rest and a real segment', () => {
    const ctx = {
        actualRecordingDisabled: true,
        computeSplitSegments() {
            return {
                showTitleBand: false,
                gridSegments: [
                    { label: '휴식', span: 2, kind: 'virtual-rest', virtual: true, startMinute: 0, durationMinutes: 20, endMinute: 20 },
                    { label: 'A', span: 4, segmentIndex: 0, startMinute: 20, durationMinutes: 40, endMinute: 60 },
                ],
            };
        },
        escapeHtml(value) { return String(value); },
        escapeAttribute(value) { return String(value); },
        getSplitColor() { return '#abcdef'; },
        getPlanSegmentBaseIndex() { return 0; },
        buildPlanSegmentViewModel(baseIndex, segmentId) {
            return {
                id: segmentId,
                timer: { status: 'idle', running: false },
                display: { icon: 'play', timeText: '0m', tone: 'under' },
            };
        },
    };

    const html = buildSplitVisualization.call(ctx, 'planned', 0);
    const virtualRestSegment = html.match(/<div class="split-grid-segment[^"]*split-grid-segment-virtual-rest[^>]*>[\s\S]*?<\/div>/)[0];
    const realSegment = html.match(/<div class="split-grid-segment[^"]*"[^>]*data-segment-kind="real-plan"[\s\S]*?<\/div>/)[0];

    assert.match(virtualRestSegment, /plan-segment-resize-handle-right/);
    assert.match(virtualRestSegment, /plan-segment-boundary-resize-handle-shared/);
    assert.doesNotMatch(realSegment, /plan-segment-resize-handle-left/);
    assert.equal((html.match(/plan-segment-boundary-resize-handle-shared/g) || []).length, 1);
});
