const test = require('node:test');
const assert = require('node:assert/strict');

const gridMetricsCore = require('../core/grid-metrics-core');

test('grid-metrics-core exports are available and attached to global', () => {
    assert.equal(typeof gridMetricsCore.getActualGridSecondsMap, 'function');
    assert.equal(typeof gridMetricsCore.getActualGridSecondsForLabel, 'function');
    assert.equal(typeof gridMetricsCore.getActualGridUnitCounts, 'function');
    assert.equal(typeof gridMetricsCore.getActualAssignedSecondsMap, 'function');

    assert.ok(globalThis.TimeTrackerGridMetricsCore);
    assert.equal(typeof globalThis.TimeTrackerGridMetricsCore.getActualGridUnitCounts, 'function');
});

test('getActualGridSecondsMap aggregates seconds by active unit labels', () => {
    const map = gridMetricsCore.getActualGridSecondsMap(
        [' 집중 ', '', '휴식', '집중'],
        [true, true, true, false],
        {
            stepSeconds: 300,
            normalizeActivityText: (value) => String(value || '').trim(),
        }
    );

    assert.equal(map.get('집중'), 300);
    assert.equal(map.get('휴식'), 300);
    assert.equal(map.has(''), false);
});

test('getActualGridSecondsForLabel resolves map from input or resolver', () => {
    const direct = new Map([['집중', 1200]]);
    assert.equal(
        gridMetricsCore.getActualGridSecondsForLabel(' 집중 ', {
            gridMap: direct,
            normalizeActivityText: (value) => String(value || '').trim(),
        }),
        1200
    );

    assert.equal(
        gridMetricsCore.getActualGridSecondsForLabel('휴식', {
            resolveGridMap: () => new Map([['휴식', 600]]),
            normalizeActivityText: (value) => String(value || '').trim(),
        }),
        600
    );
});

test('getActualGridUnitCounts and getActualAssignedSecondsMap keep label aggregates', () => {
    const counts = gridMetricsCore.getActualGridUnitCounts(
        ['A', 'A', 'B', ''],
        [true, false, true, true],
        {
            normalizeActivityText: (value) => String(value || '').trim(),
        }
    );
    assert.equal(counts.get('A'), 1);
    assert.equal(counts.get('B'), 1);
    assert.equal(counts.has(''), false);

    const assigned = gridMetricsCore.getActualAssignedSecondsMap(
        [
            { label: 'A', seconds: 125.7 },
            { label: ' B ', seconds: 300 },
            { label: 'A', seconds: 240 },
        ],
        {
            normalizeActivityText: (value) => String(value || '').trim(),
        }
    );
    assert.equal(assigned.get('A'), 240);
    assert.equal(assigned.get('B'), 300);
});
