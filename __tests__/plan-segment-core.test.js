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
    assert.equal(typeof planSegmentCore.buildMergedPlanSegmentPayload, 'function');
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

test('buildMergedPlanSegmentPayload rebases multi-segment slot plus empty slot and leaves rest virtual', () => {
    const slots = [
        {
            planActivities: [
                { label: 'Deep Work', seconds: 1200, startMinute: 0, endMinute: 20, durationMinutes: 20 },
                { label: 'Review', seconds: 1200, startMinute: 40, endMinute: 60, durationMinutes: 20 },
            ],
            planSegmentTimers: {},
        },
        { planActivities: [], planSegmentTimers: {} },
    ];

    const payload = planSegmentCore.buildMergedPlanSegmentPayload(slots, {
        rangeStart: 0,
        rangeEnd: 1,
    });

    assert.equal(payload.blocked, false);
    assert.deepEqual(payload.activities.map((item) => ({
        label: item.label,
        startMinute: item.startMinute,
        endMinute: item.endMinute,
        durationMinutes: item.durationMinutes,
        seconds: item.seconds,
    })), [
        { label: 'Deep Work', startMinute: 0, endMinute: 20, durationMinutes: 20, seconds: 1200 },
        { label: 'Review', startMinute: 40, endMinute: 60, durationMinutes: 20, seconds: 1200 },
    ]);
    assert.deepEqual(planSegmentCore.calculateVirtualRestGaps(payload.activities, {
        startMinute: 0,
        endMinute: 120,
    }).map((gap) => ({ startMinute: gap.startMinute, durationMinutes: gap.durationMinutes })), [
        { startMinute: 20, durationMinutes: 20 },
        { startMinute: 60, durationMinutes: 60 },
    ]);
});

test('buildMergedPlanSegmentPayload concatenates segmented slots by chronological order and preserves metadata', () => {
    const slots = [
        {
            planActivities: [
                {
                    label: 'Plan',
                    activityId: 'plan-a',
                    activityText: 'Plan',
                    titleActivityId: 'title-a',
                    titleText: 'Morning',
                    seconds: 1800,
                    startMinute: 30,
                    endMinute: 60,
                    durationMinutes: 30,
                },
            ],
            planSegmentTimers: {},
        },
        {
            planActivities: [
                {
                    label: 'Plan',
                    activityId: 'plan-b',
                    activityText: 'Plan B',
                    titleActivityId: 'title-b',
                    titleText: 'Next',
                    seconds: 1200,
                    startMinute: 0,
                    endMinute: 20,
                    durationMinutes: 20,
                },
            ],
            planSegmentTimers: {},
        },
    ];

    const payload = planSegmentCore.buildMergedPlanSegmentPayload(slots, {
        rangeStart: 0,
        rangeEnd: 1,
    });

    assert.equal(payload.blocked, false);
    assert.deepEqual(payload.activities.map((item) => ({
        label: item.label,
        activityId: item.activityId,
        activityText: item.activityText,
        titleActivityId: item.titleActivityId,
        titleText: item.titleText,
        startMinute: item.startMinute,
        endMinute: item.endMinute,
    })), [
        {
            label: 'Plan',
            activityId: 'plan-a',
            activityText: 'Plan',
            titleActivityId: 'title-a',
            titleText: 'Morning',
            startMinute: 30,
            endMinute: 60,
        },
        {
            label: 'Plan',
            activityId: 'plan-b',
            activityText: 'Plan B',
            titleActivityId: 'title-b',
            titleText: 'Next',
            startMinute: 60,
            endMinute: 80,
        },
    ]);
});

test('buildMergedPlanSegmentPayload remaps paused and running plan segment timers', () => {
    const slots = [
        {
            planActivities: [
                { label: 'A', seconds: 1800, startMinute: 0, endMinute: 30, durationMinutes: 30 },
            ],
            planSegmentTimers: {
                'planned-0-0-seg0': { status: 'paused', running: false, elapsedSeconds: 300, method: 'plan-segment' },
            },
        },
        {
            planActivities: [
                { label: 'B', seconds: 1800, startMinute: 0, endMinute: 30, durationMinutes: 30 },
            ],
            planSegmentTimers: {
                'planned-1-1-seg0': { status: 'running', running: true, startedAt: 123, method: 'plan-segment' },
            },
        },
    ];

    const payload = planSegmentCore.buildMergedPlanSegmentPayload(slots, {
        rangeStart: 0,
        rangeEnd: 1,
    });

    assert.equal(payload.blocked, false);
    assert.equal(payload.timers['planned-0-1-seg0'].status, 'paused');
    assert.equal(payload.timers['planned-0-1-seg0'].elapsedSeconds, 300);
    assert.equal(payload.timers['planned-0-1-seg1'].status, 'running');
    assert.equal(payload.timers['planned-0-1-seg1'].running, true);
    assert.equal(payload.timers['planned-0-1-seg1'].startedAt, 123);
});

test('buildMergedPlanSegmentPayload blocks when an active segment timer cannot be matched', () => {
    const payload = planSegmentCore.buildMergedPlanSegmentPayload([
        {
            planActivities: [
                { label: 'A', seconds: 1800, startMinute: 0, endMinute: 30, durationMinutes: 30 },
            ],
            planSegmentTimers: {
                'planned-0-0-seg99': { status: 'running', running: true, method: 'plan-segment' },
            },
        },
        { planActivities: [], planSegmentTimers: {} },
    ], {
        rangeStart: 0,
        rangeEnd: 1,
    });

    assert.equal(payload.blocked, true);
    assert.equal(payload.reason, 'unmatched-active-segment-timer');
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

test('resizePlanSegmentInList moves adjacent right boundary to the right', () => {
    const result = planSegmentCore.resizePlanSegmentInList([
        { label: '샤워', startMinute: 0, endMinute: 40, durationMinutes: 40, seconds: 2400 },
        { label: '이동/저녁준비', startMinute: 40, endMinute: 60, durationMinutes: 20, seconds: 1200 },
    ], 0, 'right', 50, { startMinute: 0, endMinute: 60 });

    assert.deepEqual(result.map((item) => ({
        label: item.label,
        startMinute: item.startMinute,
        endMinute: item.endMinute,
        durationMinutes: item.durationMinutes,
        seconds: item.seconds,
    })), [
        { label: '샤워', startMinute: 0, endMinute: 50, durationMinutes: 50, seconds: 3000 },
        { label: '이동/저녁준비', startMinute: 50, endMinute: 60, durationMinutes: 10, seconds: 600 },
    ]);
    assert.deepEqual(planSegmentCore.calculateVirtualRestGaps(result, { startMinute: 0, endMinute: 60 }), []);
});

test('resizePlanSegmentInList moves adjacent right boundary to the left', () => {
    const result = planSegmentCore.resizePlanSegmentInList([
        { label: '샤워', startMinute: 0, endMinute: 40, durationMinutes: 40, seconds: 2400 },
        { label: '이동/저녁준비', startMinute: 40, endMinute: 60, durationMinutes: 20, seconds: 1200 },
    ], 0, 'right', 30, { startMinute: 0, endMinute: 60 });

    assert.deepEqual(result.map((item) => ({
        label: item.label,
        startMinute: item.startMinute,
        endMinute: item.endMinute,
        durationMinutes: item.durationMinutes,
        seconds: item.seconds,
    })), [
        { label: '샤워', startMinute: 0, endMinute: 30, durationMinutes: 30, seconds: 1800 },
        { label: '이동/저녁준비', startMinute: 30, endMinute: 60, durationMinutes: 30, seconds: 1800 },
    ]);
});

test('resizePlanSegmentInList moves adjacent left boundary to the left', () => {
    const result = planSegmentCore.resizePlanSegmentInList([
        { label: '샤워', startMinute: 0, endMinute: 40, durationMinutes: 40, seconds: 2400 },
        { label: '이동/저녁준비', startMinute: 40, endMinute: 60, durationMinutes: 20, seconds: 1200 },
    ], 1, 'left', 30, { startMinute: 0, endMinute: 60 });

    assert.deepEqual(result.map((item) => ({
        label: item.label,
        startMinute: item.startMinute,
        endMinute: item.endMinute,
        durationMinutes: item.durationMinutes,
        seconds: item.seconds,
    })), [
        { label: '샤워', startMinute: 0, endMinute: 30, durationMinutes: 30, seconds: 1800 },
        { label: '이동/저녁준비', startMinute: 30, endMinute: 60, durationMinutes: 30, seconds: 1800 },
    ]);
});

test('resizePlanSegmentInList moves adjacent left boundary to the right', () => {
    const result = planSegmentCore.resizePlanSegmentInList([
        { label: '샤워', startMinute: 0, endMinute: 40, durationMinutes: 40, seconds: 2400 },
        { label: '이동/저녁준비', startMinute: 40, endMinute: 60, durationMinutes: 20, seconds: 1200 },
    ], 1, 'left', 50, { startMinute: 0, endMinute: 60 });

    assert.deepEqual(result.map((item) => ({
        label: item.label,
        startMinute: item.startMinute,
        endMinute: item.endMinute,
        durationMinutes: item.durationMinutes,
        seconds: item.seconds,
    })), [
        { label: '샤워', startMinute: 0, endMinute: 50, durationMinutes: 50, seconds: 3000 },
        { label: '이동/저녁준비', startMinute: 50, endMinute: 60, durationMinutes: 10, seconds: 600 },
    ]);
});

test('resizePlanSegmentInList clamps adjacent boundary to ten minute minimums', () => {
    const segments = [
        { label: 'A', startMinute: 0, endMinute: 40, durationMinutes: 40, seconds: 2400 },
        { label: 'B', startMinute: 40, endMinute: 60, durationMinutes: 20, seconds: 1200 },
    ];

    const rightClamp = planSegmentCore.resizePlanSegmentInList(segments, 0, 'right', 55, { startMinute: 0, endMinute: 60 });
    const leftClamp = planSegmentCore.resizePlanSegmentInList(segments, 0, 'right', 5, { startMinute: 0, endMinute: 60 });

    assert.equal(rightClamp[0].endMinute, 50);
    assert.equal(rightClamp[1].startMinute, 50);
    assert.equal(rightClamp[1].durationMinutes, 10);
    assert.equal(leftClamp[0].endMinute, 10);
    assert.equal(leftClamp[0].durationMinutes, 10);
    assert.equal(leftClamp[1].startMinute, 10);
});

test('resizePlanSegmentInList preserves adjacent boundary metadata', () => {
    const result = planSegmentCore.resizePlanSegmentInList([
        {
            label: '복습',
            activityText: '복습',
            activityId: 'child-review',
            titleText: '공부',
            titleActivityId: 'parent-study',
            timer: { status: 'paused', elapsed: 120 },
            startMinute: 0,
            endMinute: 30,
            durationMinutes: 30,
            seconds: 1800,
        },
        {
            label: '정리',
            activityText: '정리',
            activityId: 'child-cleanup',
            titleText: '공부',
            titleActivityId: 'parent-study',
            timer: { status: 'idle', elapsed: 0 },
            startMinute: 30,
            endMinute: 60,
            durationMinutes: 30,
            seconds: 1800,
        },
    ], 0, 'right', 40, { startMinute: 0, endMinute: 60 });

    assert.deepEqual(result[0], {
        label: '복습',
        activityText: '복습',
        activityId: 'child-review',
        titleText: '공부',
        titleActivityId: 'parent-study',
        timer: { status: 'paused', elapsed: 120 },
        startMinute: 0,
        endMinute: 40,
        durationMinutes: 40,
        seconds: 2400,
    });
    assert.deepEqual(result[1], {
        label: '정리',
        activityText: '정리',
        activityId: 'child-cleanup',
        titleText: '공부',
        titleActivityId: 'parent-study',
        timer: { status: 'idle', elapsed: 0 },
        startMinute: 40,
        endMinute: 60,
        durationMinutes: 20,
        seconds: 1200,
    });
});

test('resizePlanSegmentInList keeps non-adjacent resize behavior', () => {
    const segments = [
        { label: 'A', startMinute: 0, endMinute: 30, durationMinutes: 30, seconds: 1800 },
        { label: 'B', startMinute: 40, endMinute: 60, durationMinutes: 20, seconds: 1200 },
    ];

    const allowed = planSegmentCore.resizePlanSegmentInList(segments, 0, 'right', 40, { startMinute: 0, endMinute: 60 });
    const blocked = planSegmentCore.resizePlanSegmentInList(segments, 0, 'right', 50, { startMinute: 0, endMinute: 60 });

    assert.equal(allowed[0].endMinute, 40);
    assert.equal(allowed[1].startMinute, 40);
    assert.deepEqual(planSegmentCore.calculateVirtualRestGaps(allowed, { startMinute: 0, endMinute: 60 }), []);
    assert.equal(blocked[0].endMinute, 40);
    assert.equal(blocked[1].startMinute, 40);
});

test('resizePlanSegmentInList accepts string minute fields without creating false gaps', () => {
    const result = planSegmentCore.resizePlanSegmentInList([
        { label: 'A', startMinute: '0', endMinute: '60', durationMinutes: '60', seconds: 3600 },
        { label: 'B', startMinute: '60', endMinute: '120', durationMinutes: '60', seconds: 3600 },
    ], 0, 'right', '70', { startMinute: '0', endMinute: '120' });

    assert.deepEqual(result.map(item => ({
        label: item.label,
        startMinute: item.startMinute,
        endMinute: item.endMinute,
        durationMinutes: item.durationMinutes,
    })), [
        { label: 'A', startMinute: 0, endMinute: 70, durationMinutes: 70 },
        { label: 'B', startMinute: 70, endMinute: 120, durationMinutes: 50 },
    ]);
    assert.deepEqual(planSegmentCore.calculateVirtualRestGaps(result, { startMinute: '0', endMinute: '120' }), []);
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
