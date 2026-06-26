const test = require('node:test');
const assert = require('node:assert/strict');

const durationCore = require('../core/duration-core');

test('duration-core exports are available and attached to global', () => {
    assert.equal(typeof durationCore.formatTime, 'function');
    assert.equal(typeof durationCore.formatDurationSummary, 'function');
    assert.equal(typeof durationCore.normalizeDurationStep, 'function');
    assert.equal(typeof durationCore.normalizeActualDurationStep, 'function');

    assert.ok(globalThis.TimeTrackerDurationCore);
    assert.equal(typeof globalThis.TimeTrackerDurationCore.formatDurationSummary, 'function');
});

test('duration-core formatTime keeps HH:MM:SS display', () => {
    assert.equal(durationCore.formatTime(0), '00:00:00');
    assert.equal(durationCore.formatTime(59), '00:00:59');
    assert.equal(durationCore.formatTime(3661), '01:01:01');
});

test('duration-core formatDurationSummary returns readable korean labels', () => {
    assert.equal(durationCore.formatDurationSummary(0), '0시간');
    assert.equal(durationCore.formatDurationSummary(59), '59초');
    assert.equal(durationCore.formatDurationSummary(60), '1분');
    assert.equal(durationCore.formatDurationSummary(3600), '1시간');
    assert.equal(durationCore.formatDurationSummary(3661), '1시간 1분 1초');
});

test('duration-core normalizeDurationStep keeps integer seconds', () => {
    assert.equal(durationCore.normalizeDurationStep(12.8), 12);
    assert.equal(durationCore.normalizeDurationStep(-3), 0);
    assert.equal(durationCore.normalizeDurationStep(NaN), null);
});

test('duration-core normalizeActualDurationStep rounds by step', () => {
    assert.equal(durationCore.normalizeActualDurationStep(601, 600), 600);
    assert.equal(durationCore.normalizeActualDurationStep(901, 600), 1200);
    assert.equal(durationCore.normalizeActualDurationStep(449, 300), 300);
    assert.equal(durationCore.normalizeActualDurationStep(451, 300), 600);
    assert.equal(durationCore.normalizeActualDurationStep(450, 300), 600);
    assert.equal(durationCore.normalizeActualDurationStep(451, 0), 600);
    assert.equal(durationCore.normalizeActualDurationStep(NaN, 300), 0);
});
