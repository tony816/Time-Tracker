const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { buildMethod } = require('./helpers/script-method-builder');

const interactionsCss = fs.readFileSync(path.join(__dirname, '..', 'styles', 'interactions.css'), 'utf8');
const foundationCss = fs.readFileSync(path.join(__dirname, '..', 'styles', 'foundation.css'), 'utf8');

const getSplitColorBasePalette = buildMethod(
    'getSplitColorBasePalette()',
    '()'
);

const resolvePlannedSegmentColor = buildMethod(
    'resolvePlannedSegmentColor(segmentColorKey)',
    '(segmentColorKey)'
);

const getSplitColor = buildMethod(
    "getSplitColor(type, label, isExtra = false, reservedIndices = null, role = 'grid', segmentColorKey = null)",
    '(type, label, isExtra, reservedIndices, role, segmentColorKey)'
);

function createSplitColorContext(overrides = {}) {
    return {
        splitColorRegistry: null,
        splitColorUsed: null,
        splitColorSeed: null,
        getSplitColorBasePalette() {
            return getSplitColorBasePalette();
        },
        resolvePlannedSegmentColor(colorKey) {
            return resolvePlannedSegmentColor.call(this, colorKey);
        },
        getSplitColorKey() {
            return 'grid:test';
        },
        getNextSplitColor() {
            if (!this.splitColorUsed) {
                this.splitColorUsed = new Set();
            }
            if (!Number.isInteger(this.splitColorSeed)) {
                this.splitColorSeed = 0;
            }
            const palette = this.getSplitColorBasePalette();
            const color = palette[this.splitColorSeed % palette.length];
            this.splitColorSeed += 1;
            return color;
        },
        ...overrides,
    };
}

test('getSplitColorBasePalette returns the 6 design colors', () => {
    const palette = getSplitColorBasePalette();
    assert.deepEqual(palette, [
        '#FCAD9A',
        '#FBE1B4',
        '#E1EADB',
        '#DFE6F0',
        '#F3F2F7',
        '#EAEFF2',
    ]);
});

test('resolvePlannedSegmentColor maps named keys to palette colors', () => {
    const ctx = createSplitColorContext();
    const resolve = (key) => resolvePlannedSegmentColor.call(ctx, key);

    assert.equal(resolve('soft-coral'), '#FCAD9A');
    assert.equal(resolve('sand-beige'), '#FBE1B4');
    assert.equal(resolve('sage-green'), '#E1EADB');
    assert.equal(resolve('dusty-blue'), '#DFE6F0');
    assert.equal(resolve('lavender-gray'), '#F3F2F7');
    assert.equal(resolve('blue-gray'), '#EAEFF2');
});

test('resolvePlannedSegmentColor falls back to #FFFFFF for invalid keys', () => {
    const ctx = createSplitColorContext();
    const resolve = (key) => resolvePlannedSegmentColor.call(ctx, key);

    assert.equal(resolve('unknown'), '#FFFFFF');
    assert.equal(resolve(null), '#FFFFFF');
    assert.equal(resolve(''), '#FFFFFF');
    assert.equal(resolve(undefined), '#FFFFFF');
});

test('getSplitColor planned type resolves to pure white by default', () => {
    const ctx = createSplitColorContext();
    const color = (label) => getSplitColor.call(ctx, 'planned', label);

    assert.equal(color('메일/메신저 확인'), '#FFFFFF');
    assert.equal(color('산책'), '#FFFFFF');
    assert.equal(color('스트레칭'), '#FFFFFF');
    assert.equal(color('아침 물 한 컵 마시기'), '#FFFFFF');
    assert.equal(color('장보기'), '#FFFFFF');
    assert.equal(color(''), '#FFFFFF');
});

test('getSplitColor different planned labels share the same default color (white)', () => {
    const ctx = createSplitColorContext();
    const labels = ['메일/메신저 확인', '산책', '스트레칭', '아침 물 한 컵 마시기', '장보기'];
    const colors = labels.map((label) => getSplitColor.call(ctx, 'planned', label));
    const uniqueColors = new Set(colors);

    assert.equal(uniqueColors.size, 1);
    assert.equal(colors[0], '#FFFFFF');
});

test('getSplitColor planned type resolves explicit colorKey to palette color', () => {
    const ctx = createSplitColorContext();
    const color = (key) => getSplitColor.call(ctx, 'planned', 'dummy', false, null, 'grid', key);

    assert.equal(color('soft-coral'), '#FCAD9A');
    assert.equal(color('sand-beige'), '#FBE1B4');
    assert.equal(color('sage-green'), '#E1EADB');
    assert.equal(color('dusty-blue'), '#DFE6F0');
    assert.equal(color('lavender-gray'), '#F3F2F7');
    assert.equal(color('blue-gray'), '#EAEFF2');
});

test('getSplitColor planned explicit colorKey is independent of label', () => {
    const ctx = createSplitColorContext();

    const colorA = getSplitColor.call(ctx, 'planned', '산책', false, null, 'grid', 'soft-coral');
    const colorB = getSplitColor.call(ctx, 'planned', '메일 확인', false, null, 'grid', 'soft-coral');
    const colorC = getSplitColor.call(ctx, 'planned', '장보기', false, null, 'grid', 'dusty-blue');

    assert.equal(colorA, '#FCAD9A');
    assert.equal(colorB, '#FCAD9A');
    assert.equal(colorC, '#DFE6F0');
});

test('getSplitColor planned invalid colorKey falls back to #FFFFFF', () => {
    const ctx = createSplitColorContext();
    const color = (key) => getSplitColor.call(ctx, 'planned', 'dummy', false, null, 'grid', key);

    assert.equal(color('invalid-color'), '#FFFFFF');
    assert.equal(color(null), '#FFFFFF');
    assert.equal(color(''), '#FFFFFF');
    assert.equal(color(undefined), '#FFFFFF');
});

test('getSplitColor planned no segmentColorKey defaults to #FFFFFF (no auto-coloring)', () => {
    const ctx = createSplitColorContext();
    const color = (label) => getSplitColor.call(ctx, 'planned', label);

    assert.equal(color('운동'), '#FFFFFF');
    assert.equal(color('집중 작업'), '#FFFFFF');
    assert.equal(color('휴식'), '#FFFFFF');
});

test('getSplitColor catalog colorKey label does not auto-color planned segments', () => {
    const ctx = createSplitColorContext();

    const colorA = getSplitColor.call(ctx, 'planned', 'blue-activity');
    const colorB = getSplitColor.call(ctx, 'planned', 'red-activity');

    assert.equal(colorA, '#FFFFFF');
    assert.equal(colorB, '#FFFFFF');
});

test('getSplitColor planned segments ignore label-based registry', () => {
    const ctx = createSplitColorContext();
    ctx.getSplitColorKey = (type, label) => `grid:${label}`;

    const color1 = getSplitColor.call(ctx, 'planned', '운동');
    const color2 = getSplitColor.call(ctx, 'planned', '독서');
    const color3 = getSplitColor.call(ctx, 'planned', '운동');

    assert.equal(color1, '#FFFFFF');
    assert.equal(color2, '#FFFFFF');
    assert.equal(color3, '#FFFFFF');
});

test('getSplitColor actual segments keep existing auto-color behavior', () => {
    const ctx = createSplitColorContext();
    ctx.getSplitColorKey = (type, label) => `grid:${label}`;

    const color1 = getSplitColor.call(ctx, 'actual', 'Focus');
    const color2 = getSplitColor.call(ctx, 'actual', 'Focus');
    const color3 = getSplitColor.call(ctx, 'actual', 'Another');

    assert.equal(color1, color2);
    assert.equal(color1, '#FCAD9A');
    assert.equal(color3, '#FBE1B4');
});

test('getSplitColor actual segments with no colorKey return fallback', () => {
    const ctx = createSplitColorContext();
    ctx.getSplitColorKey = () => '';

    const color = getSplitColor.call(ctx, 'actual', '');

    assert.equal(color, 'rgba(224, 236, 255, 0.45)');
});

test('buildSplitVisualization passes segment.colorKey to getSplitColor', () => {
    const controller = require('../controllers/time-entry-render-controller');
    const { buildSplitVisualization } = controller;
    const { buildMethod } = require('./helpers/script-method-builder');
    const computeSplitSegments = buildMethod(
        'computeSplitSegments(type, index)',
        '(type, index)'
    );

    const capturedCalls = [];
    const ctx = {
        actualRecordingDisabled: true,
        computeSplitSegments(type, index) {
            return {
                showTitleBand: false,
                gridSegments: [
                    {
                        label: 'Test',
                        span: 6,
                        segmentIndex: 0,
                        startMinute: 0,
                        durationMinutes: 60,
                        endMinute: 60,
                        colorKey: 'soft-coral',
                    },
                ],
            };
        },
        escapeHtml(value) { return String(value); },
        escapeAttribute(value) { return String(value); },
        getSplitColor(type, label, isExtra, reservedIndices, role, segmentColorKey) {
            capturedCalls.push({ type, label, role, segmentColorKey });
            if (segmentColorKey === 'soft-coral') return '#FCAD9A';
            return '#FFFFFF';
        },
        getPlanSegmentBaseIndex() { return 0; },
        buildPlanSegmentViewModel() {
            return {
                id: 'planned-0-0-seg0',
                timer: { status: 'idle', running: false },
                display: { icon: 'play', timeText: '0m / 60m', tone: 'under' },
            };
        },
    };

    buildSplitVisualization.call(ctx, 'planned', 0);

    const gridCall = capturedCalls.find((c) => c.role === 'grid');
    assert.ok(gridCall);
    assert.equal(gridCall.type, 'planned');
    assert.equal(gridCall.segmentColorKey, 'soft-coral');
});


test('CSS: planned real segment ::after is neutralized (no z-index artifact)', () => {
    const afterBlock = interactionsCss.match(
        /\.split-visualization-planned \.split-grid-segment\[data-segment-kind=\"real-plan\"]::after\s*\{[\s\S]*?\n}/
    );
    assert.ok(afterBlock, 'real-plan ::after rule must exist');
    assert.match(afterBlock[0], /display:\s*none/);
    assert.doesNotMatch(afterBlock[0], /z-index:\s*-1/);
    assert.doesNotMatch(afterBlock[0], /box-shadow/);
});

test('CSS: planned real segment border and shadow stay neutral without touching rest or actual styles', () => {
    const realPlanBlock = interactionsCss.match(
        /\.split-visualization-planned \.split-grid-segment\[data-segment-kind="real-plan"]\s*\{[\s\S]*?\n}/
    );
    assert.ok(realPlanBlock, 'real-plan base rule must exist');
    assert.match(realPlanBlock[0], /border:\s*1px solid var\(--plan-segment-default-border,\s*#E5E7EB\)/);
    assert.match(realPlanBlock[0], /border-color:\s*#000/);
    assert.match(realPlanBlock[0], /border-bottom-color:\s*#000/);
    assert.match(realPlanBlock[0], /0 1px 2px rgba\(15,\s*23,\s*42,\s*0\.09\)/);
    assert.match(realPlanBlock[0], /0 7px 16px rgba\(15,\s*23,\s*42,\s*0\.085\)/);
    assert.match(realPlanBlock[0], /inset 0 1px 0 rgba\(255,\s*255,\s*255,\s*1\)/);
    assert.match(realPlanBlock[0], /border-radius:\s*7px/);
    assert.doesNotMatch(realPlanBlock[0], /background(?:-color)?:/);
    assert.doesNotMatch(realPlanBlock[0], /transform:/);
    assert.doesNotMatch(realPlanBlock[0], /data-segment-kind="virtual-rest"/);
    assert.doesNotMatch(realPlanBlock[0], /actual/);

    const selectedBlock = interactionsCss.match(
        /\.split-visualization-planned \.split-grid-segment\[data-segment-kind="real-plan"]\.is-selected-plan-segment\s*\{[\s\S]*?\n}/
    );
    assert.ok(selectedBlock, 'real-plan selected rule must exist');
    assert.match(selectedBlock[0], /border-color:\s*#000/);
    assert.match(selectedBlock[0], /border-bottom-color:\s*#000/);

    const genericLastChildBlock = interactionsCss.match(
        /\.split-grid > \.split-grid-segment:last-child\s*\{[\s\S]*?\n}/
    );
    assert.ok(genericLastChildBlock, 'generic last-child bottom border rule must exist');
    assert.match(genericLastChildBlock[0], /border-bottom-color:\s*transparent/);

    const realPlanLastChildBlock = interactionsCss.match(
        /\.split-visualization-planned \.split-grid > \.split-grid-segment\[data-segment-kind="real-plan"]\:last-child\s*\{[\s\S]*?\n}/
    );
    assert.ok(realPlanLastChildBlock, 'real-plan last-child bottom border override must exist');
    assert.match(realPlanLastChildBlock[0], /border-bottom-color:\s*#000/);
    assert.ok(
        interactionsCss.indexOf(realPlanLastChildBlock[0]) > interactionsCss.indexOf(genericLastChildBlock[0]),
        'real-plan last-child override must come after the generic transparent bottom border rule'
    );

    const virtualRestBlock = interactionsCss.match(
        /\.split-visualization-planned \.split-grid-segment-virtual-rest\s*\{[\s\S]*?\n}/
    );
    assert.ok(virtualRestBlock, 'virtual-rest base rule must exist');
    assert.match(virtualRestBlock[0], /border:\s*1px dashed rgba\(15,\s*23,\s*42,\s*0\.14\)/);
    assert.match(virtualRestBlock[0], /background:\s*rgba\(30,\s*41,\s*59,\s*0\.035\)/);
    assert.doesNotMatch(virtualRestBlock[0], /#000/);
    assert.doesNotMatch(virtualRestBlock[0], /0 1px 2px rgba\(15,\s*23,\s*42,\s*0\.09\)/);
    assert.doesNotMatch(virtualRestBlock[0], /0 7px 16px rgba\(15,\s*23,\s*42,\s*0\.085\)/);
    assert.doesNotMatch(virtualRestBlock[0], /linear-gradient/);
});


test('CSS: planned real segment keeps rounded corners regardless of connect-top/connect-bottom', () => {
    // connect-top override — must restore top corner rounding
    const connectTopBlock = interactionsCss.match(
        /\.split-visualization-planned \.split-grid-segment\[data-segment-kind=\"real-plan\"\]\.connect-top\s*\{[\s\S]*?\n}/
    );
    assert.ok(connectTopBlock, 'real-plan.connect-top override must exist');
    assert.match(connectTopBlock[0], /border-top-left-radius:\s*7px/);
    assert.match(connectTopBlock[0], /border-top-right-radius:\s*7px/);
    assert.doesNotMatch(connectTopBlock[0], /border-top-left-radius:\s*0/);

    // connect-bottom override — must restore bottom corner rounding
    const connectBottomBlock = interactionsCss.match(
        /\.split-visualization-planned \.split-grid-segment\[data-segment-kind=\"real-plan\"\]\.connect-bottom\s*\{[\s\S]*?\n}/
    );
    assert.ok(connectBottomBlock, 'real-plan.connect-bottom override must exist');
    assert.match(connectBottomBlock[0], /border-bottom-left-radius:\s*7px/);
    assert.match(connectBottomBlock[0], /border-bottom-right-radius:\s*7px/);
    assert.doesNotMatch(connectBottomBlock[0], /border-bottom-left-radius:\s*0/);

    // combined connect-top.connect-bottom — must force full rounding
    const connectBothBlock = interactionsCss.match(
        /\.split-visualization-planned \.split-grid-segment\[data-segment-kind=\"real-plan\"\]\.connect-top\.connect-bottom\s*\{[\s\S]*?\n}/
    );
    assert.ok(connectBothBlock, 'real-plan.connect-top.connect-bottom override must exist');
    assert.match(connectBothBlock[0], /border-radius:\s*7px/);
});
test('CSS: is-selected-plan-segment does NOT apply blue border or glow', () => {
    const selectedBlock = interactionsCss.match(
        /\.split-visualization-planned \.split-grid-segment\[data-segment-kind="real-plan"]\.is-selected-plan-segment\s*\{[\s\S]*?\n}/
    );
    assert.ok(selectedBlock, 'is-selected-plan-segment rule must exist');
    assert.doesNotMatch(selectedBlock[0], /rgba\(59,\s*130,\s*246/);
    assert.doesNotMatch(selectedBlock[0], /0\.42\)/);
    assert.doesNotMatch(selectedBlock[0], /inset 0 0 0 1px/);

    const selectedAfterBlock = interactionsCss.match(
        /\.split-visualization-planned \.split-grid-segment\[data-segment-kind="real-plan"]\.is-selected-plan-segment::after\s*\{[\s\S]*?\n}/
    );
    if (selectedAfterBlock) {
        assert.doesNotMatch(selectedAfterBlock[0], /rgba\(59,\s*130,\s*246/);
    }
});

test('CSS: drop target rules do NOT use blue glow', () => {
    const dropTargetBlock = interactionsCss.match(
        /\.split-grid\.is-plan-segment-reorder-drop-target[\s\S]*?\n}/
    );
    assert.ok(dropTargetBlock);

    assert.doesNotMatch(dropTargetBlock[0], /rgba\(59,\s*130,\s*246/);

    const allDropTargetCss = interactionsCss.match(
        /\.planned-input\.is-plan-segment-reorder-drop-target[\s\S]*?\n}/
    );
    assert.ok(allDropTargetCss);
    assert.doesNotMatch(allDropTargetCss[0], /rgba\(59,\s*130,\s*246/);
});

test('CSS: drop target overlay does NOT use blue outer glow', () => {
    const overlayBlock = interactionsCss.match(
        /\.plan-segment-reorder-drop-target-overlay\s*\{[\s\S]*?\n}/
    );
    assert.ok(overlayBlock);
    assert.doesNotMatch(overlayBlock[0], /rgba\(59,\s*130,\s*246/);
    assert.match(overlayBlock[0], /rgba\(14,\s*165,\s*153/);
});

test('CSS: insert marker does NOT use blue glow', () => {
    const markerBlock = interactionsCss.match(
        /\.plan-segment-reorder-insert-marker\s*\{[\s\S]*?\n}/
    );
    assert.ok(markerBlock);
    assert.doesNotMatch(markerBlock[0], /rgba\(59,\s*130,\s*246/);
    assert.match(markerBlock[0], /rgba\(14,\s*165,\s*153/);
});

test('CSS: foundation planned segment tokens use pure white and soft shadow values', () => {
    assert.match(foundationCss, /--plan-segment-default-bg:\s*#FFFFFF/);
    assert.match(foundationCss, /--plan-segment-default-border:\s*#E5E7EB/);
    assert.match(foundationCss, /--plan-segment-default-shadow:/);
    assert.match(foundationCss, /0 1px 2px rgba\(15,\s*23,\s*42/);
    assert.match(foundationCss, /0 6px 14px rgba\(15,\s*23,\s*42/);
    assert.match(foundationCss, /inset 0 1px 0 rgba\(255,\s*255,\s*255/);
    assert.match(foundationCss, /0 12px 24px rgba\(15,\s*23,\s*42/);
});
