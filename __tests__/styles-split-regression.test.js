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
    assert.match(interactionsSource, /\.split-cell-wrapper \.split-visualization\s*\{[^}]*top:\s*6px;[^}]*bottom:\s*6px;[^}]*left:\s*0;[^}]*right:\s*0;[^}]*padding:\s*0;[^}]*background:\s*transparent;[^}]*box-shadow:\s*none;/s);
    assert.match(interactionsSource, /\.split-cell-wrapper\.split-type-planned\.split-has-data \.input-field\s*\{[^}]*pointer-events:\s*none;/s);
    assert.match(interactionsSource, /\.split-visualization-planned\s*\{[^}]*pointer-events:\s*auto;/s);
    assert.match(interactionsSource, /\.split-title-band\s*\{[^}]*margin-left:\s*6px\s*!important;[^}]*margin-right:\s*6px\s*!important;/s);
    assert.match(interactionsSource, /\.split-grid\s*\{[^}]*margin-left:\s*6px\s*!important;[^}]*margin-right:\s*6px\s*!important;/s);
    assert.match(interactionsSource, /\.split-visualization-planned \.split-grid-segment-virtual-rest\s*\{[^}]*align-self:\s*start;[^}]*pointer-events:\s*auto;[^}]*border-bottom:\s*1px dashed rgba\(126,\s*140,\s*154,\s*0\.42\)\s*!important;[^}]*height:\s*calc\(100% - 3px\);/s);
    assert.match(interactionsSource, /\.split-visualization-planned \.split-grid-segment-virtual-rest:hover,\s*\.split-visualization-planned \.split-grid-segment-virtual-rest:focus-visible\s*\{[^}]*border-bottom-color:\s*rgba\(96,\s*110,\s*128,\s*0\.5\)\s*!important;/s);
    assert.match(interactionsSource, /\.plan-segment-resize-preview-layer\s*\{[^}]*position:\s*absolute;[^}]*pointer-events:\s*none;[^}]*overflow:\s*hidden;/s);
    assert.match(interactionsSource, /\.plan-segment-resize-preview-segment\s*\{[^}]*align-self:\s*stretch;[^}]*height:\s*100%;[^}]*max-height:\s*100%;[^}]*border-bottom:\s*3px solid #fff;[^}]*background:\s*var\(--split-segment-color,\s*rgba\(223,\s*228,\s*234,\s*0\.5\)\);/s);
    assert.match(interactionsSource, /\.plan-segment-resize-preview-segment\.plan-segment-resize-preview-rest\s*\{[^}]*align-self:\s*start;[^}]*height:\s*calc\(100% - 3px\);[^}]*max-height:\s*calc\(100% - 3px\);/s);
    assert.match(interactionsSource, /\.split-grid\.is-previewing-plan-resize > \.split-grid-segment\[data-segment-kind="real-plan"\]\s*\{[^}]*opacity:\s*0;/s);
    assert.match(interactionsSource, /\.split-grid\.is-previewing-plan-resize > \.split-grid-segment-virtual-rest\s*\{[^}]*opacity:\s*0;/s);
    assert.match(interactionsSource, /\.plan-segment-resize-handle\s*\{[^}]*width:\s*18px;[^}]*opacity:\s*1;/s);
    assert.match(interactionsSource, /\.plan-segment-boundary-resize-handle-line,\s*\.plan-segment-resize-handle::after\s*\{[^}]*width:\s*2px;/s);
    assert.doesNotMatch(interactionsSource, /\.split-visualization-planned \.split-grid-segment\.is-selected-plan-segment\s*\{[^}]*outline:\s*2px solid rgba\(37,\s*99,\s*235,\s*0\.42\);/s);
    assert.match(interactionsSource, /\.split-visualization-planned \.split-grid-segment\[data-segment-kind="real-plan"\]\s*\{[^}]*pointer-events:\s*auto;/s);
    assert.match(interactionsSource, /\.plan-segment-label-text,\s*\.plan-segment-title-text\s*\{[^}]*display:\s*inline-flex;[^}]*max-width:\s*100%;/s);
    assert.match(interactionsSource, /\.plan-segment-title-edit-input\s*\{[^}]*width:\s*auto;[^}]*min-width:\s*3ch;/s);
    assert.doesNotMatch(interactionsSource, /\.plan-segment-graphic-label\.is-editing\s*\{[^}]*width:\s*100%;/s);
    assert.doesNotMatch(interactionsSource, /\.plan-segment-title-edit-input\s*\{[^}]*\n\s{2}width:\s*100%;/s);
    assert.doesNotMatch(foundationSource, /actual-label|actual-input|summary-actual/);
    assert.doesNotMatch(modalSource, /activity-log-btn|actual-sub-activities|actual-edit-badge/);
    assert.doesNotMatch(interactionsSource, /activity-log-btn|split-type-actual|split-visualization-actual|actual-field-container|merged-actual|actual-row|actual-time|actual-input|actual-label|summary-actual/);
    assert.doesNotMatch(responsiveSource, /activity-log-btn|split-type-actual|split-visualization-actual|actual-field-container|actual-row|actual-time|actual-input|actual-label|summary-actual/);
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
    assert.match(responsiveSource, /@media \(max-width:\s*768px\), \(hover:\s*none\), \(pointer:\s*coarse\)\s*\{[\s\S]*?\.inline-plan-dropdown\.inline-plan-dropdown-sheet/s);
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
