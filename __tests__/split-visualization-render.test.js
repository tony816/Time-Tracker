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
                    icon: '⏱',
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
                    icon: '⏱',
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
