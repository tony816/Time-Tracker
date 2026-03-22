const test = require('node:test');
const assert = require('node:assert/strict');

const { buildMethod } = require('./helpers/script-method-builder');

const buildSplitVisualization = buildMethod('buildSplitVisualization(type, index)', '(type, index)');

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
