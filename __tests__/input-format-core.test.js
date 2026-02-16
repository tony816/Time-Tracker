const test = require('node:test');
const assert = require('node:assert/strict');

const inputFormatCore = require('../core/input-format-core');

test('input-format-core exports are available and attached to global', () => {
    assert.equal(typeof inputFormatCore.formatSecondsForInput, 'function');
    assert.equal(typeof inputFormatCore.formatMinutesForInput, 'function');
    assert.equal(typeof inputFormatCore.formatSpinnerValue, 'function');

    assert.ok(globalThis.TimeTrackerInputFormatCore);
    assert.equal(typeof globalThis.TimeTrackerInputFormatCore.formatSpinnerValue, 'function');
});

test('input-format-core formatSecondsForInput keeps HH:MM(:SS) behavior', () => {
    assert.equal(inputFormatCore.formatSecondsForInput(0), '00:00');
    assert.equal(inputFormatCore.formatSecondsForInput(60), '00:01');
    assert.equal(inputFormatCore.formatSecondsForInput(3660), '01:01');
    assert.equal(inputFormatCore.formatSecondsForInput(3661), '01:01:01');
    assert.equal(inputFormatCore.formatSecondsForInput(NaN), '00:00');
});

test('input-format-core formatMinutesForInput rounds minute values', () => {
    assert.equal(inputFormatCore.formatMinutesForInput(0), '0');
    assert.equal(inputFormatCore.formatMinutesForInput(30), '1');
    assert.equal(inputFormatCore.formatMinutesForInput(149), '2');
    assert.equal(inputFormatCore.formatMinutesForInput(151), '3');
    assert.equal(inputFormatCore.formatMinutesForInput(NaN), '0');
});

test('input-format-core formatSpinnerValue routes by kind', () => {
    assert.equal(inputFormatCore.formatSpinnerValue('actual', 151), '3');
    assert.equal(inputFormatCore.formatSpinnerValue('plan', 3661), '01:01:01');
});
