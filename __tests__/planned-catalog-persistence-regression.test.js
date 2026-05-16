const test = require('node:test');
const assert = require('node:assert/strict');

const { buildMethod } = require('./helpers/script-method-builder');

const normalizeActivityCatalogEntry = buildMethod(
    'normalizeActivityCatalogEntry(raw)',
    '(raw)'
);
const normalizeLocalPlannedCatalogEntries = buildMethod(
    'normalizeLocalPlannedCatalogEntries(entries)',
    '(entries)'
);
const repairPlannedActivityCatalogIdentity = buildMethod(
    'repairPlannedActivityCatalogIdentity(options = {})',
    '(options = {})'
);
const getLocalPlannedEntries = buildMethod(
    'getLocalPlannedEntries()',
    '()'
);
const extractPlannedActivityCatalogEntries = buildMethod(
    'extractPlannedActivityCatalogEntries(payload)',
    '(payload)'
);
const readPlannedActivityCatalogCache = buildMethod(
    'readPlannedActivityCatalogCache()',
    '()'
);
const writePlannedActivityCatalogCache = buildMethod(
    'writePlannedActivityCatalogCache(entries)',
    '(entries)'
);
const persistPlannedActivitiesLocally = buildMethod(
    'persistPlannedActivitiesLocally()',
    '()'
);
const loadPlannedActivities = buildMethod(
    'loadPlannedActivities()',
    '()'
);
const savePlannedActivities = buildMethod(
    'savePlannedActivities(options = {})',
    '(options = {})'
);
const dedupeAndSortPlannedActivities = buildMethod(
    'dedupeAndSortPlannedActivities()',
    '()'
);

function createLocalStorageStub() {
    const store = new Map();
    return {
        store,
        getItem(key) {
            return store.has(key) ? store.get(key) : null;
        },
        setItem(key, value) {
            store.set(key, String(value));
        },
        removeItem(key) {
            store.delete(key);
        },
        clear() {
            store.clear();
        },
    };
}

function createCanonicalActivity(id, name, parentId = null, overrides = {}) {
    return {
        id,
        name,
        label: name,
        title: name,
        normalizedName: name,
        parentId,
        colorKey: overrides.colorKey ?? null,
        defaultDurationMinutes: overrides.defaultDurationMinutes ?? null,
        displayMode: overrides.displayMode ?? 'chip',
        pinned: Boolean(overrides.pinned),
        archived: Boolean(overrides.archived),
        usageCount: Number.isFinite(overrides.usageCount) ? overrides.usageCount : 0,
        lastUsedAt: typeof overrides.lastUsedAt === 'string' ? overrides.lastUsedAt : null,
        source: overrides.source || 'local',
    };
}

test('save/load planned activities preserves canonical metadata and parent-child relationships', () => {
    const cacheKey = 'timeTracker.plannedActivityCatalog.v1';
    const localStorage = createLocalStorageStub();
    const parent = createCanonicalActivity('activity-parent', '운동', null, {
        colorKey: 'blue',
        defaultDurationMinutes: 30,
        displayMode: 'chip',
        pinned: true,
        archived: false,
        usageCount: 4,
        lastUsedAt: '2026-05-15T01:00:00.000Z',
    });
    const child = createCanonicalActivity('activity-child', '스쿼트', parent.id, {
        colorKey: 'blue',
        defaultDurationMinutes: 30,
        displayMode: 'chip',
        pinned: false,
        archived: false,
        usageCount: 2,
        lastUsedAt: '2026-05-15T02:00:00.000Z',
    });

    const ctx = {
        plannedActivities: [parent, child],
        normalizeActivityText(value) {
            return String(value || '').trim();
        },
        normalizePriorityRankValue(value) {
            if (value === '' || value == null) return null;
            const parsed = Number(value);
            if (!Number.isFinite(parsed)) return null;
            return Math.max(1, Math.floor(parsed));
        },
        normalizeDurationStep(seconds) {
            if (!Number.isFinite(seconds)) return null;
            return Math.max(0, Math.floor(seconds));
        },
        normalizeActivityCatalogEntry,
        normalizeLocalPlannedCatalogEntries,
        getLocalPlannedEntries,
        extractPlannedActivityCatalogEntries,
        readPlannedActivityCatalogCache,
        writePlannedActivityCatalogCache,
        persistPlannedActivitiesLocally,
        loadPlannedActivities,
        savePlannedActivities,
        dedupeAndSortPlannedActivities,
        scheduleSupabasePlannedSave() {},
        getPlannedActivityCatalogCacheKey() {
            return cacheKey;
        },
    };

    globalThis.localStorage = localStorage;

    try {
        const savedEntries = savePlannedActivities.call(ctx);
        const cached = JSON.parse(localStorage.getItem(cacheKey));

        assert.equal(Array.isArray(savedEntries), true);
        assert.equal(cached.version, 1);
        assert.equal(Array.isArray(cached.items), true);
        assert.equal(cached.items.length, 2);
        assert.ok(cached.items.every((item) => item && typeof item === 'object' && !('label' in item && Object.keys(item).length === 1)));
        assert.ok(cached.items.every((item) => [
            'id',
            'name',
            'label',
            'title',
            'normalizedName',
            'parentId',
            'colorKey',
            'defaultDurationMinutes',
            'displayMode',
            'pinned',
            'archived',
            'usageCount',
            'lastUsedAt',
            'source',
        ].every((key) => key in item)));

        ctx.plannedActivities = [];
        loadPlannedActivities.call(ctx);

        assert.equal(ctx.plannedActivities.length, 2);
        const loadedParent = ctx.plannedActivities.find((item) => item.id === parent.id);
        const loadedChild = ctx.plannedActivities.find((item) => item.id === child.id);

        assert.ok(loadedParent);
        assert.ok(loadedChild);
        assert.equal(loadedChild.parentId, parent.id);
        assert.equal(loadedParent.usageCount, 4);
        assert.equal(loadedChild.usageCount, 2);
        assert.equal(loadedParent.lastUsedAt, '2026-05-15T01:00:00.000Z');
        assert.equal(loadedChild.lastUsedAt, '2026-05-15T02:00:00.000Z');
        assert.equal(loadedParent.displayMode, 'chip');
        assert.equal(loadedChild.displayMode, 'chip');
        assert.equal(loadedParent.pinned, true);
        assert.equal(loadedChild.archived, false);
        assert.equal(loadedParent.source, 'local');
        assert.equal(loadedChild.colorKey, 'blue');
        assert.equal(loadedChild.defaultDurationMinutes, 30);
    } finally {
        delete globalThis.localStorage;
    }
});

test('legacy cache entries migrate into canonical planned activities', () => {
    const cacheKey = 'timeTracker.plannedActivityCatalog.v1';
    const localStorage = createLocalStorageStub();
    localStorage.setItem(cacheKey, JSON.stringify(['운동', { label: '공부' }]));

    const ctx = {
        plannedActivities: [],
        normalizeActivityText(value) {
            return String(value || '').trim();
        },
        normalizePriorityRankValue(value) {
            if (value === '' || value == null) return null;
            const parsed = Number(value);
            if (!Number.isFinite(parsed)) return null;
            return Math.max(1, Math.floor(parsed));
        },
        normalizeDurationStep(seconds) {
            if (!Number.isFinite(seconds)) return null;
            return Math.max(0, Math.floor(seconds));
        },
        normalizeActivityCatalogEntry,
        normalizeLocalPlannedCatalogEntries,
        getLocalPlannedEntries,
        extractPlannedActivityCatalogEntries,
        readPlannedActivityCatalogCache,
        writePlannedActivityCatalogCache,
        persistPlannedActivitiesLocally,
        loadPlannedActivities,
        savePlannedActivities,
        dedupeAndSortPlannedActivities,
        scheduleSupabasePlannedSave() {},
        getPlannedActivityCatalogCacheKey() {
            return cacheKey;
        },
    };

    globalThis.localStorage = localStorage;

    try {
        loadPlannedActivities.call(ctx);

        const names = ctx.plannedActivities.map((item) => item.label).sort();
        assert.deepEqual(names, ['공부', '운동']);
        assert.ok(ctx.plannedActivities.every((item) => item && typeof item === 'object'));
        assert.ok(ctx.plannedActivities.every((item) => [
            'id',
            'name',
            'label',
            'title',
            'normalizedName',
            'parentId',
            'displayMode',
            'pinned',
            'archived',
            'usageCount',
            'lastUsedAt',
            'source',
        ].every((key) => key in item)));
        assert.ok(ctx.plannedActivities.every((item) => item.parentId === null));
        assert.ok(ctx.plannedActivities.every((item) => item.displayMode === 'chip'));
        assert.ok(ctx.plannedActivities.every((item) => item.pinned === false));
        assert.ok(ctx.plannedActivities.every((item) => item.archived === false));
        assert.ok(ctx.plannedActivities.every((item) => item.usageCount === 0));
        assert.ok(ctx.plannedActivities.every((item) => item.lastUsedAt === null));
        assert.ok(ctx.plannedActivities.every((item) => item.source === 'local'));
    } finally {
        delete globalThis.localStorage;
    }
});

test('loadPlannedActivities repairs duplicate top-level parent ids before using the catalog', () => {
    const cacheKey = 'timeTracker.plannedActivityCatalog.v1';
    const localStorage = createLocalStorageStub();
    localStorage.setItem(cacheKey, JSON.stringify({
        version: 1,
        items: [
            createCanonicalActivity('activity_item', '운동', null),
            createCanonicalActivity('activity_item', '독서', null),
            createCanonicalActivity('child-walk', '걷기', 'activity_item'),
        ],
    }));

    const saves = [];
    const ctx = {
        plannedActivities: [],
        normalizeActivityText(value) {
            return String(value || '').trim();
        },
        normalizePriorityRankValue(value) {
            if (value === '' || value == null) return null;
            const parsed = Number(value);
            if (!Number.isFinite(parsed)) return null;
            return Math.max(1, Math.floor(parsed));
        },
        normalizeDurationStep(seconds) {
            if (!Number.isFinite(seconds)) return null;
            return Math.max(0, Math.floor(seconds));
        },
        normalizeActivityCatalogEntry,
        normalizeLocalPlannedCatalogEntries,
        repairPlannedActivityCatalogIdentity,
        getLocalPlannedEntries,
        extractPlannedActivityCatalogEntries,
        readPlannedActivityCatalogCache,
        writePlannedActivityCatalogCache,
        persistPlannedActivitiesLocally,
        loadPlannedActivities,
        savePlannedActivities(options = {}) {
            saves.push('save');
            return savePlannedActivities.call(this, options);
        },
        dedupeAndSortPlannedActivities() {},
        scheduleSupabasePlannedSave() {},
        getPlannedActivityCatalogCacheKey() {
            return cacheKey;
        },
    };

    globalThis.localStorage = localStorage;

    try {
        loadPlannedActivities.call(ctx);

        const topLevel = ctx.plannedActivities.filter((item) => item && !item.parentId);
        assert.equal(topLevel.length, 2);
        assert.equal(new Set(topLevel.map((item) => item.id)).size, 2);

        const exercise = topLevel.find((item) => item.label === '운동');
        const reading = topLevel.find((item) => item.label === '독서');
        const walking = ctx.plannedActivities.filter((item) => item.label === '걷기');

        assert.ok(exercise);
        assert.ok(reading);
        assert.equal(walking.length, 1);
        assert.equal(walking[0].parentId, exercise.id);
        assert.notEqual(exercise.id, reading.id);
        assert.equal(saves.length >= 1, true);

        const cached = JSON.parse(localStorage.getItem(cacheKey));
        const cachedTopLevel = (cached.items || []).filter((item) => item && !item.parentId);
        assert.equal(new Set(cachedTopLevel.map((item) => item.id)).size, 2);
    } finally {
        delete globalThis.localStorage;
    }
});
