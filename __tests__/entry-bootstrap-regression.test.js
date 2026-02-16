const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const scriptSource = fs.readFileSync(path.join(__dirname, '..', 'script.js'), 'utf8');
const mainSource = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');
const htmlSource = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

test('script.js exposes TimeTracker but no longer bootstraps on DOMContentLoaded', () => {
    assert.match(scriptSource, /window\.TimeTracker\s*=\s*TimeTracker\s*;/);
    assert.doesNotMatch(scriptSource, /DOMContentLoaded/);
    assert.doesNotMatch(scriptSource, /window\.tracker\s*=\s*new\s+TimeTracker/);
});

test('main.js is responsible for app bootstrap and animation keyframes injection', () => {
    assert.match(mainSource, /document\.getElementById\('tt-animation-keyframes'\)/);
    assert.match(mainSource, /document\.addEventListener\('DOMContentLoaded',\s*initTracker,\s*\{\s*once:\s*true\s*\}\)/);
    assert.match(mainSource, /window\.tracker\s*=\s*new\s+window\.TimeTracker\(\)/);
});

test('index.html loads main.js after script.js', () => {
    const actualGridCoreIdx = htmlSource.indexOf('<script src="core/actual-grid-core.js"></script>');
    const activityCoreIdx = htmlSource.indexOf('<script src="core/activity-core.js"></script>');
    const dateCoreIdx = htmlSource.indexOf('<script src="core/date-core.js"></script>');
    const durationCoreIdx = htmlSource.indexOf('<script src="core/duration-core.js"></script>');
    const inputFormatCoreIdx = htmlSource.indexOf('<script src="core/input-format-core.js"></script>');
    const textCoreIdx = htmlSource.indexOf('<script src="core/text-core.js"></script>');
    const timeCoreIdx = htmlSource.indexOf('<script src="core/time-core.js"></script>');
    const scriptIdx = htmlSource.indexOf('<script src="script.js"></script>');
    const mainIdx = htmlSource.indexOf('<script src="main.js"></script>');

    assert.ok(timeCoreIdx >= 0, 'core/time-core.js include should exist');
    assert.ok(durationCoreIdx >= 0, 'core/duration-core.js include should exist');
    assert.ok(inputFormatCoreIdx >= 0, 'core/input-format-core.js include should exist');
    assert.ok(dateCoreIdx >= 0, 'core/date-core.js include should exist');
    assert.ok(textCoreIdx >= 0, 'core/text-core.js include should exist');
    assert.ok(activityCoreIdx >= 0, 'core/activity-core.js include should exist');
    assert.ok(actualGridCoreIdx >= 0, 'core/actual-grid-core.js include should exist');
    assert.ok(scriptIdx >= 0, 'script.js include should exist');
    assert.ok(mainIdx >= 0, 'main.js include should exist');
    assert.ok(timeCoreIdx < durationCoreIdx, 'duration-core.js should load after time-core.js');
    assert.ok(durationCoreIdx < inputFormatCoreIdx, 'input-format-core.js should load after duration-core.js');
    assert.ok(inputFormatCoreIdx < dateCoreIdx, 'date-core.js should load after input-format-core.js');
    assert.ok(dateCoreIdx < textCoreIdx, 'text-core.js should load after date-core.js');
    assert.ok(textCoreIdx < activityCoreIdx, 'activity-core.js should load after text-core.js');
    assert.ok(activityCoreIdx < actualGridCoreIdx, 'actual-grid-core.js should load after activity-core.js');
    assert.ok(actualGridCoreIdx < scriptIdx, 'actual-grid-core.js should load before script.js');
    assert.ok(scriptIdx < mainIdx, 'main.js should load after script.js');
});
