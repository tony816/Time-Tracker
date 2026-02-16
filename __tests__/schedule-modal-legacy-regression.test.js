const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { buildMethod } = require('./helpers/script-method-builder');

const closeScheduleModal = buildMethod('closeScheduleModal()', '()');
const saveScheduleFromModal = buildMethod('saveScheduleFromModal()', '()');
const attachModalEventListeners = buildMethod('attachModalEventListeners()', '()');

const scriptSource = fs.readFileSync(path.join(__dirname, '..', 'script.js'), 'utf8');

test('legacy schedule modal methods are no-op and safe without modal DOM', () => {
    const ctx = {};

    assert.equal(closeScheduleModal.call(ctx), false);
    assert.equal(saveScheduleFromModal.call(ctx), false);
    assert.equal(attachModalEventListeners.call(ctx), false);
});

test('script does not depend on scheduleModal DOM within legacy no-op methods', () => {
    const start = scriptSource.indexOf('closeScheduleModal()');
    assert.ok(start >= 0, 'closeScheduleModal() should exist');

    const snippet = scriptSource.slice(start, start + 450);
    assert.match(snippet, /Legacy no-op/);
    assert.doesNotMatch(snippet, /getElementById\('scheduleModal'\)/);
});
