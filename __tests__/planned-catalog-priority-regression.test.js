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
        normalizeActivityCatalogEntry(raw) {
            return {
                id: raw.id || `id-${raw.name}`,
                name: raw.name || '',
                label: raw.name || '',
                title: raw.name || '',
                normalizedName: raw.name || '',
                parentId: null,
                colorKey: null,
                defaultDurationMinutes: null,
                displayMode: 'chip',
                pinned: false,
                archived: false,
                usageCount: 0,
                lastUsedAt: null,
                source: 'local',
            };
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
        { id: 'id-Task A', name: 'Task A', label: 'Task A', title: 'Task A', normalizedName: 'Task A', parentId: null, colorKey: null, defaultDurationMinutes: null, displayMode: 'chip', pinned: false, archived: false, usageCount: 0, lastUsedAt: null, source: 'local' },
        { id: 'id-Task B', name: 'Task B', label: 'Task B', title: 'Task B', normalizedName: 'Task B', parentId: null, colorKey: null, defaultDurationMinutes: null, displayMode: 'chip', pinned: false, archived: false, usageCount: 0, lastUsedAt: null, source: 'local' },
        { id: 'id-Task C', name: 'Task C', label: 'Task C', title: 'Task C', normalizedName: 'Task C', parentId: null, colorKey: null, defaultDurationMinutes: null, displayMode: 'chip', pinned: false, archived: false, usageCount: 0, lastUsedAt: null, source: 'local' },
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

test('updatePlannedActivityPriority clears rank and keeps unranked items after ranked ones', () => {
    const calls = [];
    const ctx = {
        plannedActivities: [
            { label: 'Task A', source: 'local', priorityRank: 2, recommendedSeconds: null },
            { label: 'Task B', source: 'local', priorityRank: null, recommendedSeconds: null },
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

    const changed = updatePlannedActivityPriority.call(ctx, 'Task A', null);

    assert.equal(changed, true);
    assert.deepEqual(ctx.plannedActivities, [
        { label: 'Task C', source: 'notion', priorityRank: 1, recommendedSeconds: 600 },
        { label: 'Task A', source: 'local', priorityRank: null, recommendedSeconds: null },
        { label: 'Task B', source: 'local', priorityRank: null, recommendedSeconds: null },
    ]);
    assert.deepEqual(calls, ['save', 'render', 'refresh']);
});

test('updatePlannedActivityPriority ignores notion items', () => {
    const calls = [];
    const ctx = {
        plannedActivities: [
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

    const changed = updatePlannedActivityPriority.call(ctx, 'Task C', 2);

    assert.equal(changed, false);
    assert.deepEqual(ctx.plannedActivities, [
        { label: 'Task C', source: 'notion', priorityRank: 1, recommendedSeconds: 600 },
    ]);
    assert.deepEqual(calls, []);
});
