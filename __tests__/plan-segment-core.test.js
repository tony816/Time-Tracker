const test = require('node:test');
const assert = require('node:assert/strict');

const core = require('../core/plan-segment-core');

test('plan-segment-core exports helpers and attaches globally', () => {
    assert.equal(typeof core.snapToTenMinutes, 'function');
    assert.equal(typeof core.normalizePlanSegmentRange, 'function');
    assert.equal(typeof core.calculateVirtualRestGaps, 'function');
    assert.equal(globalThis.TimeTrackerPlanSegmentCore.calculateVirtualRestGaps, core.calculateVirtualRestGaps);
});

test('snapToTenMinutes supports round, floor, and ceil', () => {
    assert.equal(core.snapToTenMinutes(14), 10);
    assert.equal(core.snapToTenMinutes(15), 20);
    assert.equal(core.snapToTenMinutes(19, { mode: 'floor' }), 10);
    assert.equal(core.snapToTenMinutes(11, { mode: 'ceil' }), 20);
});

test('normalizePlanSegmentRange snaps, clamps, and enforces minimum duration', () => {
    assert.deepEqual(
        core.normalizePlanSegmentRange({ startMinute: 63, durationMinutes: 4 }, { minMinute: 60, maxMinute: 120 }),
        { kind: 'real', startMinute: 60, durationMinutes: 10, endMinute: 70 }
    );
});

test('calculateVirtualRestGaps returns the gap between real segments', () => {
    const gaps = core.calculateVirtualRestGaps([
        { startMinute: 60, endMinute: 90 },
        { startMinute: 120, endMinute: 180 },
    ], { startMinute: 60, endMinute: 180 });

    assert.equal(gaps.length, 1);
    assert.deepEqual(
        gaps.map(({ kind, virtual, persisted, label, startMinute, endMinute, durationMinutes }) => ({
            kind,
            virtual,
            persisted,
            label,
            startMinute,
            endMinute,
            durationMinutes,
        })),
        [{ kind: 'virtual-rest', virtual: true, persisted: false, label: '휴식', startMinute: 90, endMinute: 120, durationMinutes: 30 }]
    );
});

test('calculateVirtualRestGaps returns leading and trailing gaps in a slot', () => {
    const gaps = core.calculateVirtualRestGaps([
        { startMinute: 80, endMinute: 100 },
    ], { startMinute: 60, endMinute: 120 });

    assert.deepEqual(
        gaps.map(({ startMinute, endMinute, durationMinutes }) => ({ startMinute, endMinute, durationMinutes })),
        [
            { startMinute: 60, endMinute: 80, durationMinutes: 20 },
            { startMinute: 100, endMinute: 120, durationMinutes: 20 },
        ]
    );
});

test('calculateVirtualRestGaps ignores gaps shorter than 10 minutes', () => {
    const gaps = core.calculateVirtualRestGaps([
        { startMinute: 60, endMinute: 86 },
        { startMinute: 94, endMinute: 120 },
    ], { startMinute: 60, endMinute: 120 });

    assert.equal(gaps.length, 0);
});

test('mergeAdjacentGaps merges touching or overlapping gaps', () => {
    const gaps = core.mergeAdjacentGaps([
        { startMinute: 60, endMinute: 80 },
        { startMinute: 80, endMinute: 100 },
        { startMinute: 110, endMinute: 120 },
    ]);

    assert.deepEqual(
        gaps.map(({ startMinute, endMinute, durationMinutes }) => ({ startMinute, endMinute, durationMinutes })),
        [
            { startMinute: 60, endMinute: 100, durationMinutes: 40 },
            { startMinute: 110, endMinute: 120, durationMinutes: 10 },
        ]
    );
});

test('findOverlaps reports overlapping real segments', () => {
    const overlaps = core.findOverlaps([
        { startMinute: 60, endMinute: 100, id: 'a' },
        { startMinute: 90, endMinute: 120, id: 'b' },
        { startMinute: 130, endMinute: 140, id: 'c' },
    ]);

    assert.equal(overlaps.length, 1);
    assert.equal(overlaps[0].left.id, 'a');
    assert.equal(overlaps[0].right.id, 'b');
    assert.equal(overlaps[0].overlapMinutes, 10);
});

test('virtual gaps are stripped before persistence', () => {
    const persisted = core.stripVirtualSegmentsForPersistence([
        { kind: 'real', label: 'Work', startMinute: 60, endMinute: 90 },
        { kind: 'virtual-rest', label: '휴식', virtual: true, startMinute: 90, endMinute: 120 },
    ]);

    assert.deepEqual(persisted, [{ kind: 'real', label: 'Work', startMinute: 60, endMinute: 90 }]);
});
