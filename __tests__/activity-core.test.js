const test = require('node:test');
const assert = require('node:assert/strict');

const activityCore = require('../core/activity-core');

test('activity-core exports are available and attached to global', () => {
    assert.equal(typeof activityCore.formatActivitiesSummary, 'function');
    assert.equal(typeof activityCore.normalizeActivitiesArray, 'function');
    assert.equal(typeof activityCore.normalizePlanActivitiesArray, 'function');
    assert.equal(typeof activityCore.normalizeActivityCatalogEntry, 'function');

    assert.ok(globalThis.TimeTrackerActivityCore);
    assert.equal(typeof globalThis.TimeTrackerActivityCore.normalizeActivitiesArray, 'function');
});

test('activity-core normalizeActivitiesArray keeps source/order/recorded fields', () => {
    const normalized = activityCore.normalizeActivitiesArray([
        { label: '  집중  ', seconds: 125.9, source: 'grid', recordedSeconds: 63.4, order: 2.8 },
        { title: '휴식', seconds: 0 },
        { label: '', seconds: 0 },
        null,
    ], {
        normalizeActivityText: (value) => String(value || '').trim(),
        normalizeDurationStep: (seconds) => Math.max(0, Math.floor(seconds)),
    });

    assert.deepEqual(normalized, [
        { label: '집중', seconds: 125, source: 'grid', recordedSeconds: 63, order: 2 },
        { label: '휴식', seconds: 0, source: null },
    ]);
});

test('activity-core normalizeActivitiesArray preserves locked metadata fields', () => {
    const normalized = activityCore.normalizeActivitiesArray([
        {
            label: '',
            seconds: 1200.9,
            source: 'locked',
            isAutoLocked: false,
            lockUnits: [3.7, 1, 'x', NaN],
            lockStart: 1.9,
            lockEnd: 3.2,
        },
    ], {
        normalizeActivityText: (value) => String(value || '').trim(),
        normalizeDurationStep: (seconds) => Math.max(0, Math.floor(seconds)),
    });

    assert.deepEqual(normalized, [
        {
            label: '',
            seconds: 1200,
            source: 'locked',
            isAutoLocked: false,
            lockUnits: [3, 1],
            lockStart: 1,
            lockEnd: 3,
        },
    ]);
});

test('activity-core normalizePlanActivitiesArray keeps label/seconds and activity metadata', () => {
    const normalized = activityCore.normalizePlanActivitiesArray([
        {
            label: ' 운동 ',
            seconds: 600.9,
            source: 'ignored',
            recordedSeconds: 300,
            titleActivityId: ' parent-1 ',
            titleText: ' 운동 ',
            activityId: ' child-1 ',
            activityText: ' 스쿼트 ',
        },
        { title: '독서', seconds: 0 },
        { label: '', seconds: 0 },
    ], {
        normalizeActivityText: (value) => String(value || '').trim(),
        normalizeDurationStep: (seconds) => Math.max(0, Math.floor(seconds)),
    });

    assert.deepEqual(normalized, [
        {
            label: '운동',
            seconds: 600,
            titleActivityId: 'parent-1',
            titleText: '운동',
            activityId: 'child-1',
            activityText: '스쿼트',
        },
        { label: '독서', seconds: 0 },
    ]);
});

test('activity-core normalizeActivityCatalogEntry fills canonical catalog fields', () => {
    const entry = activityCore.normalizeActivityCatalogEntry({
        id: 'a1',
        label: ' 운동 ',
        parentId: 'p1',
        colorKey: 'blue',
        defaultDurationMinutes: 30.9,
        displayMode: 'chip',
        pinned: 1,
        archived: 0,
        usageCount: 4.7,
        lastUsedAt: '2026-05-09T00:00:00Z',
        source: 'local',
    }, {
        normalizeActivityText: (value) => String(value || '').trim(),
        normalizeDurationStep: (seconds) => Math.max(0, Math.floor(seconds)),
    });

    assert.deepEqual(entry, {
        id: 'a1',
        name: '운동',
        label: '운동',
        title: '운동',
        normalizedName: '운동',
        parentId: 'p1',
        colorKey: 'blue',
        defaultDurationMinutes: 30,
        displayMode: 'chip',
        pinned: true,
        archived: false,
        usageCount: 4,
        lastUsedAt: '2026-05-09T00:00:00Z',
        source: 'local',
    });
});

test('activity-core formatActivitiesSummary renders list and total', () => {
    const summary = activityCore.formatActivitiesSummary([
        { label: ' 집중 ', seconds: 3600 },
        { label: '휴식', seconds: 1800 },
    ], {
        normalizeActivityText: (value) => String(value || '').trim(),
        normalizeDurationStep: (seconds) => Math.max(0, Math.floor(seconds)),
        formatDurationSummary: (seconds) => {
            const h = Math.floor(seconds / 3600);
            const m = Math.floor((seconds % 3600) / 60);
            if (h > 0 && m > 0) return `${h}시간 ${m}분`;
            if (h > 0) return `${h}시간`;
            return `${m}분`;
        },
    });
    assert.equal(summary, '집중 1시간 · 휴식 30분 (총 1시간 30분)');

    const noTotal = activityCore.formatActivitiesSummary(
        [{ label: '집중', seconds: 3600 }],
        {
            hideTotal: true,
            normalizeActivityText: (value) => String(value || '').trim(),
            normalizeDurationStep: (seconds) => Math.max(0, Math.floor(seconds)),
            formatDurationSummary: (seconds) => `${Math.floor(seconds / 60)}분`,
        }
    );
    assert.equal(noTotal, '집중 60분');
});
