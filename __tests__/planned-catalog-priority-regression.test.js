const test = require('node:test');
const assert = require('node:assert/strict');

const { buildMethod } = require('./helpers/script-method-builder');

const normalizePriorityRankValue = buildMethod(
    'normalizePriorityRankValue(value)',
    '(value)'
);
const normalizeLocalPlannedCatalogEntries = buildMethod(
    'normalizeLocalPlannedCatalogEntries(entries)',
    '(entries)'
);
const dedupeAndSortPlannedActivities = buildMethod(
    'dedupeAndSortPlannedActivities()',
    '()'
);
const findPlannedActivityIndex = buildMethod(
    'findPlannedActivityIndex(label)',
    '(label)'
);
const updatePlannedActivityPriority = buildMethod(
    'updatePlannedActivityPriority(label, value)',
    '(label, value)'
);

test('normalizeLocalPlannedCatalogEntries supports legacy strings and ranked objects', () => {
    const ctx = {
        normalizeActivityText(value) {
            return String(value || '').trim();
        },
        normalizePriorityRankValue,
    };

    const result = normalizeLocalPlannedCatalogEntries.call(ctx, [
        ' Task A ',
        { label: 'Task B', priorityRank: '2' },
        { title: 'Task C', priorityRank: 0 },
        null,
    ]);

    assert.deepEqual(result, [
        { label: 'Task A', priorityRank: null },
        { label: 'Task B', priorityRank: 2 },
        { label: 'Task C', priorityRank: 1 },
    ]);
});

test('updatePlannedActivityPriority applies local rank and re-sorts ascending', () => {
    const calls = [];
    const ctx = {
        plannedActivities: [
            { label: 'Task A', source: 'local', priorityRank: null, recommendedSeconds: null },
            { label: 'Task B', source: 'local', priorityRank: 3, recommendedSeconds: null },
            { label: 'Task C', source: 'notion', priorityRank: 1, recommendedSeconds: 600 },
        ],
        normalizeActivityText(value) {
            return String(value || '').trim();
        },
        normalizePriorityRankValue,
        findPlannedActivityIndex,
        dedupeAndSortPlannedActivities,
        savePlannedActivities() {
            calls.push('save');
        },
        renderPlannedActivityDropdown() {
            calls.push('render');
        },
        refreshSubActivityOptions() {
            calls.push('refresh');
        },
    };

    const changed = updatePlannedActivityPriority.call(ctx, 'Task A', '2');

    assert.equal(changed, true);
    assert.deepEqual(ctx.plannedActivities, [
        { label: 'Task C', source: 'notion', priorityRank: 1, recommendedSeconds: 600 },
        { label: 'Task A', source: 'local', priorityRank: 2, recommendedSeconds: null },
        { label: 'Task B', source: 'local', priorityRank: 3, recommendedSeconds: null },
    ]);
    assert.deepEqual(calls, ['save', 'render', 'refresh']);
});
