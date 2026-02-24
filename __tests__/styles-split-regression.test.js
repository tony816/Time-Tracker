const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.join(__dirname, '..');
const entryCssPath = path.join(rootDir, 'styles.css');
const indexPath = path.join(rootDir, 'index.html');
const foundationCssPath = path.join(rootDir, 'styles', 'foundation.css');
const modalCssPath = path.join(rootDir, 'styles', 'modal.css');
const interactionsCssPath = path.join(rootDir, 'styles', 'interactions.css');
const responsiveCssPath = path.join(rootDir, 'styles', 'responsive.css');

test('styles.css loads split css files in stable order', () => {
    const source = fs.readFileSync(entryCssPath, 'utf8').trim();
    const lines = source.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);

    assert.deepEqual(lines, [
        "@import url('./styles/foundation.css');",
        "@import url('./styles/modal.css');",
        "@import url('./styles/interactions.css');",
        "@import url('./styles/responsive.css');",
    ]);
});

test('split css files exist and keep section anchors', () => {
    const foundationSource = fs.readFileSync(foundationCssPath, 'utf8');
    const modalSource = fs.readFileSync(modalCssPath, 'utf8');
    const interactionsSource = fs.readFileSync(interactionsCssPath, 'utf8');
    const responsiveSource = fs.readFileSync(responsiveCssPath, 'utf8');

    assert.ok(foundationSource.length > 0);
    assert.match(modalSource, /\.modal-overlay/);
    assert.match(interactionsSource, /\.split-visualization-actual \.split-grid-segment\.is-off/);
    assert.match(interactionsSource, /\.split-visualization-actual \.split-grid-segment\.is-locked/);
    assert.match(interactionsSource, /cursor:\s*not-allowed;/);
    assert.match(interactionsSource, /\.split-visualization-actual \.split-grid-segment\.is-locked \.split-grid-label/);
    assert.match(interactionsSource, /display:\s*none\s*!important;/);
    assert.match(interactionsSource, /border-bottom-width:\s*3px\s*!important;/);
    assert.match(interactionsSource, /border-bottom-color:\s*#fff\s*!important;/);
    assert.match(interactionsSource, /background-clip:\s*padding-box\s*!important;/);
    assert.match(interactionsSource, /\.split-visualization-actual \.split-grid-segment\s*\{[^}]*overflow:\s*hidden;/s);
    assert.match(interactionsSource, /\.split-cell-wrapper\.split-type-actual\.split-has-data \.activity-log-btn/);
    assert.match(interactionsSource, /pointer-events:\s*none;/);
    assert.match(responsiveSource, /Mobile responsive enhancements/);
    assert.match(responsiveSource, /--- UX enhancement patch ---/);
});

test('index.html links split css files directly in order', () => {
    const htmlSource = fs.readFileSync(indexPath, 'utf8');
    const foundationIdx = htmlSource.indexOf('<link rel="stylesheet" href="styles/foundation.css" />');
    const modalIdx = htmlSource.indexOf('<link rel="stylesheet" href="styles/modal.css" />');
    const interactionsIdx = htmlSource.indexOf('<link rel="stylesheet" href="styles/interactions.css" />');
    const responsiveIdx = htmlSource.indexOf('<link rel="stylesheet" href="styles/responsive.css" />');

    assert.ok(foundationIdx >= 0, 'foundation.css link should exist');
    assert.ok(modalIdx >= 0, 'modal.css link should exist');
    assert.ok(interactionsIdx >= 0, 'interactions.css link should exist');
    assert.ok(responsiveIdx >= 0, 'responsive.css link should exist');
    assert.ok(foundationIdx < modalIdx, 'foundation.css should load before modal.css');
    assert.ok(modalIdx < interactionsIdx, 'modal.css should load before interactions.css');
    assert.ok(interactionsIdx < responsiveIdx, 'interactions.css should load before responsive.css');
});
