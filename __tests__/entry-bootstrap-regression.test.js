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
    const scriptIdx = htmlSource.indexOf('<script src="script.js"></script>');
    const mainIdx = htmlSource.indexOf('<script src="main.js"></script>');

    assert.ok(scriptIdx >= 0, 'script.js include should exist');
    assert.ok(mainIdx >= 0, 'main.js include should exist');
    assert.ok(scriptIdx < mainIdx, 'main.js should load after script.js');
});
