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
    assert.match(interactionsSource, /\.split-cell-wrapper \.split-visualization\s*\{[^}]*top:\s*6px;[^}]*bottom:\s*6px;[^}]*left:\s*0;[^}]*right:\s*0;[^}]*padding:\s*0;[^}]*background:\s*transparent;[^}]*box-shadow:\s*none;/s);
    assert.match(interactionsSource, /\.split-title-band\s*\{[^}]*margin-left:\s*6px\s*!important;[^}]*margin-right:\s*6px\s*!important;/s);
    assert.match(interactionsSource, /\.split-grid\s*\{[^}]*margin-left:\s*6px\s*!important;[^}]*margin-right:\s*6px\s*!important;/s);
    assert.match(interactionsSource, /\.split-visualization-actual\s*\{[^}]*box-shadow:\s*none;[^}]*background:\s*transparent;/s);
    assert.match(interactionsSource, /\.split-cell-wrapper\.split-type-actual\.split-has-data \.activity-log-btn/);
    assert.match(interactionsSource, /\.split-cell-wrapper\.split-type-actual\.split-has-data \.actual-field-container\s*\{[^}]*pointer-events:\s*none;/s);
    assert.match(interactionsSource, /\.actual-field-container\.merged-actual-main\s*\{[^}]*background-color:\s*transparent\s*!important;/s);
    assert.match(interactionsSource, /\.activity-log-btn\s*\{[^}]*bottom:\s*2px;[^}]*min-width:\s*44px;[^}]*height:\s*18px;[^}]*padding:\s*0 10px;[^}]*font-size:\s*9px;/s);
    assert.match(interactionsSource, /pointer-events:\s*none;/);
    assert.match(interactionsSource, /\.timer-controls-container\s*\{[^}]*flex-direction:\s*column;/s);
    assert.match(interactionsSource, /\.timer-controls-container\s*\{[^}]*width:\s*100%;/s);
    assert.match(interactionsSource, /\.timer-controls-container\s*\{[^}]*max-width:\s*44px;/s);
    assert.match(interactionsSource, /\.timer-controls-container\s*\{[^}]*box-sizing:\s*border-box;/s);
    assert.match(interactionsSource, /\.timer-controls-container\s*\{[^}]*padding:\s*0;/s);
    assert.match(interactionsSource, /\.timer-controls-container\s*\{[^}]*background:\s*transparent;/s);
    assert.match(interactionsSource, /\.timer-controls-container\s*\{[^}]*border:\s*none;/s);
    assert.match(interactionsSource, /\.timer-controls-container\s*\{[^}]*box-shadow:\s*none;/s);
    assert.match(interactionsSource, /\.timer-controls-container\s*\{[^}]*transition:\s*none;/s);
    assert.doesNotMatch(interactionsSource, /\.timer-controls-container\.timer-running\s*\{[^}]*background:/s);
    assert.doesNotMatch(interactionsSource, /\.timer-controls-container\.timer-running\s*\{[^}]*border:/s);
    assert.match(interactionsSource, /\.timer-controls\s*\{[^}]*flex-direction:\s*column;/s);
    assert.match(interactionsSource, /\.timer-controls\s*\{[^}]*width:\s*100%;/s);
    assert.match(interactionsSource, /\.timer-btn\s*\{[^}]*width:\s*100%;/s);
    assert.match(interactionsSource, /\.timer-btn\s*\{[^}]*height:\s*16px;/s);
    assert.match(interactionsSource, /\.timer-btn\s*\{[^}]*font-size:\s*8px;/s);
    assert.match(interactionsSource, /\.timer-btn\s*\{[^}]*border-radius:\s*4px;/s);
    assert.match(interactionsSource, /\.timer-display\s*\{[^}]*width:\s*100%;/s);
    assert.match(interactionsSource, /\.timer-display\s*\{[^}]*min-width:\s*0;/s);
    assert.match(interactionsSource, /\.timer-display\s*\{[^}]*font-size:\s*7px;/s);
    assert.match(responsiveSource, /\.timer-controls-container\s*\{[^}]*flex-direction:\s*column;/s);
    assert.match(responsiveSource, /\.timer-controls-container\s*\{[^}]*background:\s*transparent;/s);
    assert.match(responsiveSource, /\.timer-controls-container\s*\{[^}]*border:\s*none;/s);
    assert.match(responsiveSource, /\.timer-controls\s*\{[^}]*flex-direction:\s*column;/s);
    assert.match(responsiveSource, /\.timer-btn\s*\{[^}]*width:\s*100%;/s);
    assert.match(responsiveSource, /\.timer-btn\s*\{[^}]*height:\s*16px;/s);
    assert.match(responsiveSource, /\.timer-display\s*\{[^}]*min-width:\s*0;/s);
    assert.match(responsiveSource, /\.timer-display\s*\{[^}]*font-size:\s*7px;/s);
    assert.match(responsiveSource, /Mobile responsive enhancements/);
    assert.match(responsiveSource, /--- UX enhancement patch ---/);
    assert.match(responsiveSource, /\.activity-log-btn\s*\{[^}]*min-width:\s*42px;[^}]*height:\s*18px;[^}]*padding:\s*0 8px;[^}]*font-size:\s*9px;[^}]*left:\s*50%;[^}]*bottom:\s*2px;/s);
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
