const test = require('node:test');
const assert = require('node:assert/strict');

const textCore = require('../core/text-core');

test('text-core exports are available and attached to global', () => {
    assert.equal(typeof textCore.escapeHtml, 'function');
    assert.equal(typeof textCore.escapeAttribute, 'function');
    assert.equal(typeof textCore.normalizeActivityText, 'function');
    assert.equal(typeof textCore.normalizeMergeKey, 'function');

    assert.ok(globalThis.TimeTrackerTextCore);
    assert.equal(typeof globalThis.TimeTrackerTextCore.normalizeActivityText, 'function');
});

test('text-core escapeHtml and escapeAttribute sanitize critical characters', () => {
    const payload = `&<>"'`;
    assert.equal(textCore.escapeHtml(payload), '&amp;&lt;&gt;&quot;&#39;');
    assert.equal(textCore.escapeAttribute(payload), '&amp;&lt;&gt;&quot;&#39;');
    assert.equal(textCore.escapeHtml(null), '');
});

test('text-core normalizeActivityText removes line breaks/tabs and collapses spaces', () => {
    assert.equal(textCore.normalizeActivityText('  집중\t\n학습   2시간  '), '집중학습 2시간');
    assert.equal(textCore.normalizeActivityText(''), '');
});

test('text-core normalizeMergeKey validates type/range/slotCount', () => {
    assert.equal(textCore.normalizeMergeKey(' planned-0-2 ', null, 24), 'planned-0-2');
    assert.equal(textCore.normalizeMergeKey('time-3-5', 'time', 24), 'time-3-5');
    assert.equal(textCore.normalizeMergeKey('time-3-5', 'actual', 24), null);
    assert.equal(textCore.normalizeMergeKey('time-3-2', null, 24), null);
    assert.equal(textCore.normalizeMergeKey('time-3-99', null, 24), null);
    assert.equal(textCore.normalizeMergeKey('time-3-99', null, null), 'time-3-99');
    assert.equal(textCore.normalizeMergeKey('time--3-5', null, 24), null);
    assert.equal(textCore.normalizeMergeKey('time-3-5<script>', null, 24), null);
});
