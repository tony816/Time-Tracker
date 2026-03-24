const test = require('node:test');
const assert = require('node:assert/strict');

const controller = require('../controllers/supabase-sync-controller');
const { buildMethod } = require('./helpers/script-method-builder');

const getSupabaseRedirectToWrapper = buildMethod('getSupabaseRedirectTo()', '()');
const handleSupabaseIdentityChangeWrapper = buildMethod(
    'handleSupabaseIdentityChange(force = false)',
    '(force = false)'
);
const initSupabaseIntegrationWrapper = buildMethod('initSupabaseIntegration()', '()');
const fetchFromSupabaseForDateWrapper = buildMethod(
    'async fetchFromSupabaseForDate(date)',
    'async (date)'
);
const saveToSupabaseWrapper = buildMethod('async saveToSupabase()', 'async ()');
const persistSnapshotForDateWrapper = buildMethod(
    'async persistSnapshotForDate(date, snapshotSlots, snapshotMergedObj)',
    'async (date, snapshotSlots, snapshotMergedObj)'
);

test('supabase-sync-controller exports and global attach are available', () => {
    assert.ok(controller);
    assert.equal(typeof controller.getSupabaseRedirectTo, 'function');
    assert.equal(typeof controller.handleSupabaseIdentityChange, 'function');
    assert.equal(typeof controller.initSupabaseIntegration, 'function');
    assert.equal(typeof controller.fetchFromSupabaseForDate, 'function');
    assert.equal(typeof controller.saveToSupabase, 'function');
    assert.equal(typeof controller.persistSnapshotForDate, 'function');
    assert.equal(
        globalThis.TimeTrackerSupabaseSyncController.saveToSupabase,
        controller.saveToSupabase
    );
});

test('script supabase sync wrapper methods delegate to controller helpers', async () => {
    const calls = [];
    const original = globalThis.TimeTrackerSupabaseSyncController;
    globalThis.TimeTrackerSupabaseSyncController = {
        getSupabaseRedirectTo() {
            calls.push(['redirect', this]);
            return 'redirect-result';
        },
        handleSupabaseIdentityChange(force) {
            calls.push(['identity', this, force]);
            return 'identity-result';
        },
        initSupabaseIntegration() {
            calls.push(['init', this]);
            return 'init-result';
        },
        async fetchFromSupabaseForDate(date) {
            calls.push(['fetch', this, date]);
            return 'fetch-result';
        },
        async saveToSupabase() {
            calls.push(['save', this]);
            return 'save-result';
        },
        async persistSnapshotForDate(date, snapshotSlots, snapshotMergedObj) {
            calls.push(['persist', this, date, snapshotSlots, snapshotMergedObj]);
            return 'persist-result';
        },
    };

    const ctx = { id: 'tracker' };
    const snapshotSlots = [{ time: '04' }];
    const snapshotMerged = { 'planned-0-0': 'Deep Work' };

    try {
        assert.equal(getSupabaseRedirectToWrapper.call(ctx), 'redirect-result');
        assert.equal(handleSupabaseIdentityChangeWrapper.call(ctx, true), 'identity-result');
        assert.equal(initSupabaseIntegrationWrapper.call(ctx), 'init-result');
        assert.equal(await fetchFromSupabaseForDateWrapper.call(ctx, '2026-03-24'), 'fetch-result');
        assert.equal(await saveToSupabaseWrapper.call(ctx), 'save-result');
        assert.equal(
            await persistSnapshotForDateWrapper.call(ctx, '2026-03-24', snapshotSlots, snapshotMerged),
            'persist-result'
        );
    } finally {
        globalThis.TimeTrackerSupabaseSyncController = original;
    }

    assert.deepEqual(calls, [
        ['redirect', ctx],
        ['identity', ctx, true],
        ['init', ctx],
        ['fetch', ctx, '2026-03-24'],
        ['save', ctx],
        ['persist', ctx, '2026-03-24', snapshotSlots, snapshotMerged],
    ]);
});
