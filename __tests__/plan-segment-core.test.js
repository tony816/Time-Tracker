const test = require('node:test');
const assert = require('node:assert/strict');

const planSegmentCore = require('../core/plan-segment-core');

test('plan-segment-core exports pure helpers', () => {
    assert.equal(typeof planSegmentCore.snapToTenMinutes, 'function');
    assert.equal(typeof planSegmentCore.normalizePlanSegmentRange, 'function');
    assert.equal(typeof planSegmentCore.calculateVirtualRestGaps, 'function');
    assert.equal(typeof planSegmentCore.mergeAdjacentGaps, 'function');
    assert.equal(typeof planSegmentCore.findOverlaps, 'function');
    assert.equal(typeof planSegmentCore.createSegmentId, 'function');
    assert.equal(typeof planSegmentCore.resizePlanSegmentInList, 'function');
    assert.equal(globalThis.TimeTrackerPlanSegmentCore, planSegmentCore);
});

test('snapToTenMinutes rounds to nearest 10-minute increment and clamps invalid values', () => {
    assert.equal(planSegmentCore.snapToTenMinutes(604), 600);
    assert.equal(planSegmentCore.snapToTenMinutes(605), 610);
    assert.equal(planSegmentCore.snapToTenMinutes(609), 610);
    assert.equal(planSegmentCore.snapToTenMinutes(Number.NaN), 0);
    assert.equal(planSegmentCore.snapToTenMinutes('not-a-number', { min: 120, max: 180 }), 120);
    assert.equal(planSegmentCore.snapToTenMinutes(-12), 0);
    assert.equal(planSegmentCore.snapToTenMinutes(2000), 1440);
});

test('calculateVirtualRestGaps returns sorted leading, between, and trailing gaps', () => {
    const segments = [
        { id: 'b', label: 'B', startMinute: 660, durationMinutes: 30 },
        { id: 'a', label: 'A', startMinute: 610, durationMinutes: 20 },
    ];

    const result = planSegmentCore.calculateVirtualRestGaps(segments, {
        startMinute: 600,
        endMinute: 720,
    });

    assert.deepEqual(result, [
        {
            id: 'virtual-rest-600-10',
            kind: 'virtual-rest',
            label: '휴식',
            startMinute: 600,
            durationMinutes: 10,
            virtual: true,
        },
        {
            id: 'virtual-rest-630-30',
            kind: 'virtual-rest',
            label: '휴식',
            startMinute: 630,
            durationMinutes: 30,
            virtual: true,
        },
        {
            id: 'virtual-rest-690-30',
            kind: 'virtual-rest',
            label: '휴식',
            startMinute: 690,
            durationMinutes: 30,
            virtual: true,
        },
    ]);
});

test('calculateVirtualRestGaps ignores gaps shorter than 10 minutes', () => {
    const result = planSegmentCore.calculateVirtualRestGaps([
        { label: 'A', startMinute: 600, durationMinutes: 25 },
        { label: 'B', startMinute: 634, durationMinutes: 26 },
    ], {
        startMinute: 600,
        endMinute: 660,
    });

    assert.deepEqual(result, []);
});

test('calculateVirtualRestGaps returns one virtual rest gap for an empty range', () => {
    const result = planSegmentCore.calculateVirtualRestGaps([], {
        startMinute: 600,
        endMinute: 660,
    });

    assert.deepEqual(result, [
        {
            id: 'virtual-rest-600-60',
            kind: 'virtual-rest',
            label: '휴식',
            startMinute: 600,
            durationMinutes: 60,
            virtual: true,
        },
    ]);
});

test('mergeAdjacentGaps merges adjacent gaps and keeps non-adjacent gaps separate', () => {
    const gaps = [
        { startMinute: 600, durationMinutes: 10 },
        { startMinute: 610, durationMinutes: 20 },
        { startMinute: 650, durationMinutes: 10 },
    ];

    assert.deepEqual(planSegmentCore.mergeAdjacentGaps(gaps), [
        {
            id: 'virtual-rest-600-30',
            kind: 'virtual-rest',
            label: '휴식',
            startMinute: 600,
            durationMinutes: 30,
            virtual: true,
        },
        {
            id: 'virtual-rest-650-10',
            kind: 'virtual-rest',
            label: '휴식',
            startMinute: 650,
            durationMinutes: 10,
            virtual: true,
        },
    ]);
});

test('mergeAdjacentGaps does not emit gaps shorter than 10 minutes', () => {
    assert.deepEqual(planSegmentCore.mergeAdjacentGaps([
        { startMinute: 600, durationMinutes: 9 },
        { startMinute: 620, durationMinutes: 10 },
    ]), [
        {
            id: 'virtual-rest-620-10',
            kind: 'virtual-rest',
            label: '휴식',
            startMinute: 620,
            durationMinutes: 10,
            virtual: true,
        },
    ]);
});

test('findOverlaps detects overlapping real segments but not touching segments', () => {
    const first = { label: 'A', startMinute: 600, durationMinutes: 30 };
    const second = { label: 'B', startMinute: 620, durationMinutes: 20 };
    const touching = { label: 'C', startMinute: 640, durationMinutes: 20 };

    const overlaps = planSegmentCore.findOverlaps([first, second, touching]);

    assert.equal(overlaps.length, 1);
    assert.equal(overlaps[0].previousIndex, 0);
    assert.equal(overlaps[0].currentIndex, 1);
    assert.equal(overlaps[0].startMinute, 620);
    assert.equal(overlaps[0].endMinute, 630);
    assert.deepEqual(overlaps[0].segments, [first, second]);
});

test('findOverlaps ignores virtual rest gaps', () => {
    const overlaps = planSegmentCore.findOverlaps([
        { label: 'A', startMinute: 600, durationMinutes: 30 },
        { kind: 'virtual-rest', virtual: true, label: '휴식', startMinute: 610, durationMinutes: 40 },
        { label: 'B', startMinute: 630, durationMinutes: 30 },
    ]);

    assert.deepEqual(overlaps, []);
});

test('virtual rest gaps are not included in simulated persisted planActivities and inputs are not mutated', () => {
    const segments = [
        { label: 'A', startMinute: 600, durationMinutes: 20, seconds: 1200 },
        { label: 'B', startMinute: 640, durationMinutes: 20, seconds: 1200 },
    ];
    const snapshot = JSON.stringify(segments);

    const gaps = planSegmentCore.calculateVirtualRestGaps(segments, {
        startMinute: 600,
        endMinute: 680,
    });
    const simulatedPersistedPlanActivities = [...segments, ...gaps]
        .filter((item) => !item.virtual && item.kind !== 'virtual-rest')
        .map((item) => ({ label: item.label, seconds: item.seconds }));

    assert.deepEqual(simulatedPersistedPlanActivities, [
        { label: 'A', seconds: 1200 },
        { label: 'B', seconds: 1200 },
    ]);
    assert.equal(JSON.stringify(segments), snapshot);
    assert.deepEqual(gaps, [
        {
            id: 'virtual-rest-620-20',
            kind: 'virtual-rest',
            label: '휴식',
            startMinute: 620,
            durationMinutes: 20,
            virtual: true,
        },
        {
            id: 'virtual-rest-660-20',
            kind: 'virtual-rest',
            label: '휴식',
            startMinute: 660,
            durationMinutes: 20,
            virtual: true,
        },
    ]);
});

test('resizePlanSegmentInList shrinks right edge and leaves a calculable trailing gap', () => {
    const result = planSegmentCore.resizePlanSegmentInList([
        { label: 'A', seconds: 60 * 60 },
    ], 0, 'right', 40, { startMinute: 0, endMinute: 60 });

    assert.equal(result[0].seconds, 40 * 60);
    assert.deepEqual(planSegmentCore.calculateVirtualRestGaps(result, { startMinute: 0, endMinute: 60 }), [
        {
            id: 'virtual-rest-40-20',
            kind: 'virtual-rest',
            label: '휴식',
            startMinute: 40,
            durationMinutes: 20,
            virtual: true,
        },
    ]);
});

test('resizePlanSegmentInList expands right edge only into the adjacent gap', () => {
    const segments = [
        { label: 'A', startMinute: 0, durationMinutes: 30, seconds: 30 * 60 },
        { label: 'B', startMinute: 50, durationMinutes: 10, seconds: 10 * 60 },
    ];

    const allowed = planSegmentCore.resizePlanSegmentInList(segments, 0, 'right', 50, { startMinute: 0, endMinute: 60 });
    const blocked = planSegmentCore.resizePlanSegmentInList(segments, 0, 'right', 60, { startMinute: 0, endMinute: 60 });

    assert.equal(allowed[0].endMinute, 50);
    assert.equal(allowed[0].seconds, 50 * 60);
    assert.equal(blocked[0].endMinute, 50);
    assert.equal(blocked[0].seconds, 50 * 60);
});

test('resizePlanSegmentInList shrinks left edge and leaves a calculable leading gap', () => {
    const result = planSegmentCore.resizePlanSegmentInList([
        { label: 'A', startMinute: 20, durationMinutes: 40, seconds: 40 * 60 },
    ], 0, 'left', 40, { startMinute: 0, endMinute: 60 });

    assert.equal(result[0].startMinute, 40);
    assert.equal(result[0].seconds, 20 * 60);
    assert.deepEqual(planSegmentCore.calculateVirtualRestGaps(result, { startMinute: 20, endMinute: 60 }), [
        {
            id: 'virtual-rest-20-20',
            kind: 'virtual-rest',
            label: '휴식',
            startMinute: 20,
            durationMinutes: 20,
            virtual: true,
        },
    ]);
});

test('resizePlanSegmentInList expands left edge only into the adjacent gap', () => {
    const segments = [
        { label: 'A', startMinute: 0, durationMinutes: 20, seconds: 20 * 60 },
        { label: 'B', startMinute: 40, durationMinutes: 20, seconds: 20 * 60 },
    ];

    const allowed = planSegmentCore.resizePlanSegmentInList(segments, 1, 'left', 20, { startMinute: 0, endMinute: 60 });
    const blocked = planSegmentCore.resizePlanSegmentInList(segments, 1, 'left', 10, { startMinute: 0, endMinute: 60 });

    assert.equal(allowed[1].startMinute, 20);
    assert.equal(allowed[1].seconds, 40 * 60);
    assert.equal(blocked[1].startMinute, 20);
    assert.equal(blocked[1].seconds, 40 * 60);
});

test('resizePlanSegmentInList enforces minimum duration and strips virtual metadata', () => {
    const result = planSegmentCore.resizePlanSegmentInList([
        { label: 'A', startMinute: 0, durationMinutes: 30, seconds: 30 * 60 },
        { kind: 'virtual-rest', virtual: true, label: '?댁떇', startMinute: 30, durationMinutes: 30 },
    ], 0, 'right', 5, { startMinute: 0, endMinute: 60 });

    assert.equal(result.length, 1);
    assert.equal(result[0].durationMinutes, 10);
    assert.equal(result[0].seconds, 10 * 60);
    assert.equal(result.some((item) => item.kind === 'virtual-rest' || item.virtual), false);
});
