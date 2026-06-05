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
    assert.match(interactionsSource, /\.split-visualization-planned \.split-grid-segment-virtual-rest\[data-segment-kind="virtual-rest"\]\s*\{[^}]*overflow:\s*visible;/s);
    assert.match(interactionsSource, /\.split-visualization-planned \.split-grid-segment-virtual-rest:hover,\s*\.split-visualization-planned \.split-grid-segment-virtual-rest:focus-visible\s*\{[^}]*border-bottom-color:\s*rgba\(96,\s*110,\s*128,\s*0\.5\)\s*!important;/s);
    assert.match(interactionsSource, /\.split-grid\s*\{[^}]*position:\s*relative;[^}]*grid-template-columns:\s*repeat\(6,\s*1fr\);/s);
    assert.match(interactionsSource, /\.plan-segment-resize-preview-layer\s*\{[^}]*position:\s*absolute;[^}]*grid-template-columns:\s*repeat\(6,\s*1fr\);[^}]*pointer-events:\s*none;[^}]*overflow:\s*hidden;/s);
    assert.match(interactionsSource, /\.plan-segment-resize-preview-segment\s*\{[^}]*align-self:\s*stretch;[^}]*height:\s*100%;[^}]*max-height:\s*100%;[^}]*border-bottom:\s*3px solid #fff;[^}]*background:\s*var\(--split-segment-color,\s*rgba\(223,\s*228,\s*234,\s*0\.5\)\);/s);
    assert.match(interactionsSource, /\.plan-segment-resize-preview-segment\.plan-segment-resize-preview-rest\s*\{[^}]*align-self:\s*start;[^}]*height:\s*calc\(100% - 3px\);[^}]*max-height:\s*calc\(100% - 3px\);/s);
    assert.match(interactionsSource, /\.split-grid\.is-previewing-plan-resize > \.split-grid-segment\[data-segment-kind="real-plan"\]\s*\{[^}]*opacity:\s*0;/s);
    assert.match(interactionsSource, /\.split-grid\.is-previewing-plan-resize > \.split-grid-segment-virtual-rest\s*\{[^}]*opacity:\s*0;/s);
    assert.match(interactionsSource, /\.plan-segment-resize-handle\s*\{[^}]*top:\s*50%;[^}]*width:\s*30px;[^}]*height:\s*min\(58px,\s*calc\(100% - 8px\)\);[^}]*opacity:\s*1;[^}]*--plan-segment-handle-color:\s*var\(--split-segment-color,\s*rgba\(223,\s*228,\s*234,\s*0\.85\)\);/s);
    assert.match(interactionsSource, /\.plan-segment-resize-handle-right\s*\{[^}]*right:\s*2px;/s);
    assert.match(interactionsSource, /\.plan-segment-resize-handle-right\.plan-segment-boundary-resize-handle-shared\s*\{[^}]*right:\s*-15px;/s);
    assert.match(interactionsSource, /\.plan-segment-boundary-resize-handle-shared\s*\{[^}]*--plan-segment-handle-mixed-color:\s*color-mix\(/s);
    assert.match(interactionsSource, /\.plan-segment-boundary-resize-handle-line,\s*\.plan-segment-resize-handle::after\s*\{[^}]*width:\s*16px;[^}]*border:\s*2px solid rgba\(15,\s*23,\s*42,\s*0\.95\);[^}]*box-shadow:/s);
    assert.match(interactionsSource, /\.plan-segment-boundary-resize-handle-line::after\s*\{[^}]*width:\s*4px;[^}]*background:\s*rgba\(15,\s*23,\s*42,\s*0\.78\);[^}]*border:\s*1px solid rgba\(15,\s*23,\s*42,\s*0\.92\);/s);
    assert.doesNotMatch(interactionsSource, /\.split-visualization-planned \.split-grid-segment\.is-selected-plan-segment\s*\{[^}]*outline:\s*2px solid rgba\(37,\s*99,\s*235,\s*0\.42\);/s);
    assert.match(interactionsSource, /\.split-visualization-planned \.split-grid-segment\[data-segment-kind="real-plan"\]\s*\{[^}]*overflow:\s*visible;[^}]*pointer-events:\s*auto;/s);
    assert.match(interactionsSource, /\.split-visualization-planned \.split-grid-segment\.has-shared-plan-boundary-handle\s*\{[^}]*z-index:\s*13;/s);
    assert.match(foundationSource, /\.plan-segment-graphic\s*\{[^}]*width:\s*100%;[^}]*max-width:\s*100%;[^}]*height:\s*100%;[^}]*min-height:\s*38px;[^}]*min-width:\s*0;[^}]*overflow:\s*hidden;/s);
    assert.doesNotMatch(foundationSource, /\.plan-segment-graphic\s*\{[^}]*grid-template-columns:\s*34px\s+minmax\(0,\s*1fr\);/s);
    assert.match(foundationSource, /\.plan-segment-graphic-main\s*\{[^}]*min-width:\s*0;[^}]*max-width:\s*100%;[^}]*overflow:\s*hidden;/s);
    assert.match(foundationSource, /\.plan-segment-timer-row\s*\{[^}]*display:\s*inline-flex;[^}]*align-items:\s*center;[^}]*justify-content:\s*center;[^}]*gap:\s*4px;[^}]*overflow:\s*hidden;/s);
    assert.match(foundationSource, /\.plan-segment-timer-button\s*\{[^}]*flex:\s*0 0 auto;[^}]*width:\s*22px;[^}]*min-width:\s*22px;[^}]*height:\s*22px;[^}]*border-radius:\s*7px;/s);
    assert.doesNotMatch(foundationSource, /\.plan-segment-timer-spacer/);
    assert.match(foundationSource, /\.plan-segment-timer-time\s*\{[^}]*display:\s*block;[^}]*min-width:\s*0;[^}]*max-width:\s*100%;[^}]*overflow:\s*hidden;[^}]*text-overflow:\s*ellipsis;/s);
    assert.doesNotMatch(foundationSource, /\.split-grid-segment\.has-plan-segment-timer\s*\{[^}]*overflow:\s*hidden;/s);
    assert.match(foundationSource, /\.plan-segment-graphic-title,\s*\.plan-segment-graphic-label\s*\{[^}]*text-align:\s*center;[^}]*text-overflow:\s*ellipsis;[^}]*white-space:\s*nowrap;/s);
    assert.match(interactionsSource, /\.plan-segment-label-text,\s*\.plan-segment-title-text\s*\{[^}]*display:\s*inline-block;[^}]*max-width:\s*100%;[^}]*overflow:\s*hidden;[^}]*text-align:\s*center;[^}]*text-overflow:\s*ellipsis;[^}]*white-space:\s*nowrap;/s);
    assert.match(interactionsSource, /\.plan-segment-title-edit-input\s*\{[^}]*width:\s*auto;[^}]*min-width:\s*3ch;/s);
    assert.match(interactionsSource, /\.plan-segment-title-edit-input\s*\{[^}]*font:\s*inherit;[^}]*font-size:\s*inherit;[^}]*font-weight:\s*inherit;[^}]*line-height:\s*inherit;/s);
    assert.match(interactionsSource, /\.plan-segment-title-edit-input\s*\{[^}]*box-sizing:\s*border-box;[^}]*height:\s*auto;[^}]*min-height:\s*0;[^}]*margin:\s*0;[^}]*padding:\s*0;[^}]*letter-spacing:\s*inherit;/s);
    assert.doesNotMatch(interactionsSource, /\.plan-segment-graphic-label\.is-editing\s*\{[^}]*width:\s*100%;/s);
    assert.doesNotMatch(interactionsSource, /\.plan-segment-title-edit-input\s*\{[^}]*\n\s{2}width:\s*100%;/s);
    assert.doesNotMatch(interactionsSource, /\.plan-segment-title-edit-input\s*\{[^}]*font-size:\s*16px;/s);
    assert.match(interactionsSource, /\.inline-plan-backdrop\s*\{[^}]*z-index:\s*49;/s);
    assert.match(interactionsSource, /body\.inline-plan-sheet-open #timeEntries\.inline-plan-context-active \.time-entry\.inline-plan-context-keep-clear\s*\{[^}]*pointer-events:\s*none;/s);
    assert.match(interactionsSource, /body\.inline-plan-sheet-open \.inline-plan-sheet-context-target\s*\{[^}]*z-index:\s*60;[^}]*pointer-events:\s*auto;/s);
    assert.match(interactionsSource, /body\.inline-plan-sheet-open \.split-cell-wrapper\.split-type-planned\.inline-plan-sheet-context-target \.planned-input\s*\{[^}]*pointer-events:\s*auto;/s);
    assert.match(responsiveSource, /@media \(max-width:\s*768px\), \(hover:\s*none\), \(pointer:\s*coarse\)\s*\{[\s\S]*?\.inline-plan-input,[\s\S]*?\.activity-child-composer-input,[\s\S]*?font-size:\s*16px;/s);
    assert.match(responsiveSource, /@media \(max-width:\s*768px\), \(hover:\s*none\), \(pointer:\s*coarse\)\s*\{[\s\S]*?\.plan-segment-title-edit-input\s*\{[^}]*font-size:\s*inherit;/s);
    assert.match(responsiveSource, /@media \(max-width:\s*768px\), \(hover:\s*none\), \(pointer:\s*coarse\)\s*\{[\s\S]*?\.plan-segment-resize-handle\s*\{[^}]*width:\s*40px;[^}]*touch-action:\s*none;/s);
    assert.match(responsiveSource, /@media \(max-width:\s*768px\), \(hover:\s*none\), \(pointer:\s*coarse\)\s*\{[\s\S]*?\.plan-segment-resize-handle-right\s*\{[^}]*right:\s*-5px;/s);
    assert.match(responsiveSource, /@media \(max-width:\s*768px\), \(hover:\s*none\), \(pointer:\s*coarse\)\s*\{[\s\S]*?\.plan-segment-resize-handle-right\.plan-segment-boundary-resize-handle-shared\s*\{[^}]*right:\s*-20px;/s);
    assert.match(responsiveSource, /@media \(max-width:\s*768px\), \(hover:\s*none\), \(pointer:\s*coarse\)\s*\{[\s\S]*?\.split-grid-segment\[data-segment-kind="real-plan"\]\s*\{[^}]*--plan-segment-mobile-edge-zone:\s*36px;/s);
    assert.match(responsiveSource, /@media \(max-width:\s*768px\), \(hover:\s*none\), \(pointer:\s*coarse\)\s*\{[\s\S]*?\.split-grid-segment\[data-segment-kind="real-plan"\]::after\s*\{[^}]*width:\s*min\(var\(--plan-segment-mobile-edge-zone\),\s*42%\);[^}]*pointer-events:\s*none;/s);
    assert.doesNotMatch(responsiveSource, /\.split-grid-segment\[data-segment-kind="real-plan"\]::before/);
    assert.match(responsiveSource, /\.split-grid-segment\[data-segment-kind="real-plan"\]\.is-resizing-plan-segment\.plan-segment-resize-edge-right::after\s*\{[^}]*opacity:\s*0\.86;/s);
    assert.match(responsiveSource, /@media \(max-width:\s*768px\), \(hover:\s*none\), \(pointer:\s*coarse\)\s*\{[\s\S]*?\.plan-segment-boundary-resize-handle-line,\s*\.plan-segment-resize-handle::after\s*\{[^}]*width:\s*16px;/s);
    assert.doesNotMatch(responsiveSource, /\.plan-segment-boundary-resize-handle-line,\s*\.plan-segment-resize-handle::after\s*\{[^}]*background:\s*rgba\(30,\s*64,\s*175,\s*0\.74\);/s);
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
