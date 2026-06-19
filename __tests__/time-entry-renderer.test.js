const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const renderer = require('../ui/time-entry-renderer');
const cssSource = fs.readFileSync(path.join(__dirname, '..', 'styles', 'foundation.css'), 'utf8');

test('time-entry-renderer exports and global attach are available', () => {
    assert.equal(typeof renderer.buildRowRenderModel, 'function');
    assert.equal(typeof renderer.parseMergeRange, 'function');
    assert.ok(globalThis.TimeEntryRenderer);
    assert.equal(typeof globalThis.TimeEntryRenderer.buildRowRenderModel, 'function');
});

test('buildRowRenderModel renders non-merged row with wrapped planned content only', () => {
    const row = renderer.buildRowRenderModel({
        slot: { time: '4', planned: 'deep "work"' },
        index: 3,
        currentDate: '2026-02-16',
        findMergeKey: () => null,
        createMergedField: () => '<div class="merged"></div>',
        wrapWithSplitVisualization: (type, _index, content) => `<div class="wrapped-${type}">${content}</div>`,
        createTimerControls: () => '<button class="timer-btn">run</button>',
        createMergedTimeField: () => '<div>merged-time</div>',
        formatSlotTimeLabel: (rawHour) => String(rawHour).padStart(2, '0'),
        escapeAttribute: (value) => String(value).replace(/"/g, '&quot;'),
        getRoutineForPlannedIndex: () => ({ id: 'routine-1' }),
    });

    assert.equal(row.hasPlannedMergeContinuation, false);
    assert.equal(row.hasActualMergeContinuation, false);
    assert.equal(row.routineMatch.id, 'routine-1');

    assert.match(row.innerHtml, /wrapped-planned/);
    assert.doesNotMatch(row.innerHtml, /wrapped-actual/);
    assert.doesNotMatch(row.innerHtml, /actual-input/);
    assert.match(row.innerHtml, /data-index="3"/);
    assert.match(row.innerHtml, /deep &quot;work&quot;/);
    assert.match(row.innerHtml, /<div class="time-label time-slot-label">04<\/div>/);
    assert.match(row.innerHtml, /timer-btn/);
    assert.match(row.innerHtml, /time-slot-container merge-capable/);
    assert.match(row.innerHtml, /time-slot-merge-affordance/);
    assert.ok(
        row.innerHtml.indexOf('time-slot-container merge-capable') < row.innerHtml.indexOf('wrapped-planned'),
        'time-slot column should render before planned slot column'
    );
    assert.match(row.innerHtml, /class="input-field planned-input"[\s\S]*data-type="planned"/);
    assert.match(row.innerHtml, /class="time-slot-container merge-capable"[\s\S]*aria-label=/);
});

test('buildRowRenderModel uses planned/time merged builders and ignores actual merges', () => {
    const row = renderer.buildRowRenderModel({
        slot: { time: '11', planned: 'plan', actual: 'legacy actual' },
        index: 2,
        currentDate: '2026-02-16',
        findMergeKey: (type) => {
            if (type === 'planned') return 'planned-2-4';
            if (type === 'actual') return 'actual-1-3';
            if (type === 'time') return 'time-2-4';
            return null;
        },
        createMergedField: (mergeKey, type, index) => `[merged:${mergeKey}:${type}:${index}]`,
        wrapWithSplitVisualization: (_type, _index, content) => content,
        createTimerControls: () => '[timer-controls]',
        createMergedTimeField: (mergeKey, index) => `[merged-time:${mergeKey}:${index}]`,
        formatSlotTimeLabel: (rawHour) => String(rawHour),
        escapeAttribute: (value) => String(value),
        getRoutineForPlannedIndex: () => null,
    });

    assert.equal(row.hasPlannedMergeContinuation, true);
    assert.equal(row.hasActualMergeContinuation, false);
    assert.equal(row.plannedMergeKey, 'planned-2-4');
    assert.equal(row.actualMergeKey, null);

    assert.match(row.innerHtml, /\[merged:planned-2-4:planned:2\]/);
    assert.doesNotMatch(row.innerHtml, /\[merged:actual-1-3:actual:2\]/);
    assert.match(row.innerHtml, /\[merged-time:time-2-4:2\]/);
    assert.ok(
        row.innerHtml.indexOf('[merged-time:time-2-4:2]') < row.innerHtml.indexOf('[merged:planned-2-4:planned:2]'),
        'merged time-slot content should render before merged planned content'
    );
});

test('buildRowRenderModel does not render mobile time-column timer controls', () => {
    const row = renderer.buildRowRenderModel({
        slot: { time: '6', planned: 'Focus', timer: { status: 'idle' } },
        index: 0,
        currentDate: '2026-06-19',
        findMergeKey: () => null,
        createMergedField: () => '<div class="merged"></div>',
        wrapWithSplitVisualization: (_type, _index, content) => content,
        createTimerControls: () => '<button class="timer-btn timer-start-pause">run</button>',
        createMergedTimeField: () => '<div>merged-time</div>',
        formatSlotTimeLabel: (rawHour) => String(rawHour).padStart(2, '0'),
        escapeAttribute: (value) => String(value),
        getRoutineForPlannedIndex: () => null,
        isMobileTimeColumn: true,
    });

    assert.match(row.innerHtml, /<div class="time-label time-slot-label">06<\/div>/);
    assert.doesNotMatch(row.innerHtml, /timer-btn/);
    assert.doesNotMatch(row.innerHtml, /timer-controls-container/);
});

test('mobile time-column CSS contains labels and suppresses obsolete timer box controls', () => {
    const responsiveCss = fs.readFileSync(path.join(__dirname, '..', 'styles', 'responsive.css'), 'utf8');
    const interactionsCss = fs.readFileSync(path.join(__dirname, '..', 'styles', 'interactions.css'), 'utf8');

    assert.match(responsiveCss, /grid-template-columns:\s*40px minmax\(0,\s*1fr\);/);
    assert.match(cssSource, /\.header-row,[\s\S]*\.time-entry\s*\{[\s\S]*grid-template-columns:\s*80px 1fr;/);
    assert.match(cssSource, /\.header-row > div\.time-label\s*\{[\s\S]*border-right:\s*1px solid #2c3e50;[\s\S]*order:\s*1;/);
    assert.match(cssSource, /\.header-row > div\.planned-label\s*\{[\s\S]*border-right:\s*none;[\s\S]*order:\s*2;/);
    assert.doesNotMatch(responsiveCss, /grid-template-columns:\s*minmax\(0,\s*1fr\) 36px;/);
    assert.match(responsiveCss, /\.time-entry \.time-slot-container\s*\{[\s\S]*width:\s*40px;[\s\S]*max-width:\s*40px;[\s\S]*overflow:\s*hidden !important;[\s\S]*box-shadow:\s*none !important;/);
    assert.match(cssSource, /\.time-entry\.merge-capable \.time-slot-container\s*\{[\s\S]*border-left:\s*none;[\s\S]*border-right:\s*2px solid #ddd;/);
    assert.match(responsiveCss, /\.time-entry \.time-slot-container \.time-range-label\s*\{[\s\S]*font-size:\s*9px;[\s\S]*letter-spacing:\s*-0\.7px;[\s\S]*font-variant-numeric:\s*tabular-nums;/);
    assert.match(responsiveCss, /\.time-entry\.merge-capable \.time-slot-merge-affordance,[\s\S]*\.time-entry \.time-slot-container \.timer-controls-container,[\s\S]*\.time-entry \.time-slot-container \.timer-raw-display\s*\{[\s\S]*display:\s*none !important;[\s\S]*pointer-events:\s*none !important;/);
    assert.match(responsiveCss, /\.time-entry\.current-time-slot \.time-slot-container,[\s\S]*\.time-entry\.completed-timer-slot \.time-slot-container\s*\{[\s\S]*background-color:\s*#ecf0f1 !important;[\s\S]*box-shadow:\s*none !important;/);
    assert.match(responsiveCss, /\.time-entry \.time-slot-container\.merged-time-main\s*\{[\s\S]*overflow:\s*visible !important;[\s\S]*isolation:\s*isolate;/);
    assert.match(responsiveCss, /\.time-entry \.time-slot-container\.merged-time-main \.time-label,[\s\S]*\.time-entry \.time-slot-container\.merged-time-main \.time-range-label\s*\{[\s\S]*z-index:\s*3;[\s\S]*visibility:\s*visible !important;[\s\S]*opacity:\s*1 !important;[\s\S]*display:\s*block;/);
    assert.match(responsiveCss, /\.time-entry \.time-slot-container\.merged-time-main::before\s*\{[\s\S]*left:\s*0;[\s\S]*right:\s*0;[\s\S]*height:\s*var\(--merged-block-height, 100%\);[\s\S]*background:\s*#ecf0f1;[\s\S]*box-shadow:\s*inset -2px 0 0 #ddd;[\s\S]*z-index:\s*1;/);
    assert.match(responsiveCss, /\.time-entry\.merge-hover \.time-slot-container\.merged-time-main::before,[\s\S]*\.time-entry\.existing-merged-range \.time-slot-container\.merged-time-main::before\s*\{[\s\S]*box-shadow:\s*[\s\S]*inset -2px 0 0 var\(--merge-outline\),[\s\S]*inset 0 2px 0 var\(--merge-outline\),[\s\S]*inset 0 -2px 0 var\(--merge-outline\);/);
    assert.doesNotMatch(responsiveCss, /\.time-entry \.time-slot-container\.merged-time-main::after/);
    assert.doesNotMatch(responsiveCss, /\.time-entry \.time-slot-container\.merged-time-secondary:not\(\.merged-time-last\)::after/);
    assert.doesNotMatch(interactionsCss, /\.merged-time-secondary:not\(\.merged-time-last\)::after/);
    assert.doesNotMatch(responsiveCss, /\.merged-time-last::after/);
    assert.doesNotMatch(interactionsCss, /\.merged-time-last::after/);
    assert.doesNotMatch(responsiveCss, /\.time-entry \.time-slot-container\.merged-time-main \.time-label,[\s\S]*\.time-entry \.time-slot-container\.merged-time-main \.time-range-label\s*\{[^}]*display:\s*none/);
    assert.doesNotMatch(responsiveCss, /\.time-entry \.time-slot-container\.merged-time-main \.time-label,[\s\S]*\.time-entry \.time-slot-container\.merged-time-main \.time-range-label\s*\{[^}]*visibility:\s*hidden/);
    assert.doesNotMatch(responsiveCss, /\.time-entry \.time-slot-container\.merged-time-main \.time-label,[\s\S]*\.time-entry \.time-slot-container\.merged-time-main \.time-range-label\s*\{[^}]*opacity:\s*0/);
    assert.doesNotMatch(responsiveCss, /\.time-entry\.time-ui-visible \.time-slot-container\s*\{[\s\S]*box-shadow:\s*inset 0 0 0 2px #7fa7cf;/);
    assert.doesNotMatch(responsiveCss, /border-left:\s*2px solid #7ea7d4;/);
    assert.doesNotMatch(responsiveCss, /\.time-entry \.time-slot-container \.plan-segment-timer-button/);
    assert.doesNotMatch(responsiveCss, /\.time-entry \.time-slot-container \.plan-segment-timer-row/);
    assert.doesNotMatch(responsiveCss, /\.time-entry \.time-slot-container \.plan-segment-timer-time/);
    assert.match(interactionsCss, /\.merged-time-main\s*\{[\s\S]*overflow:\s*visible !important;[\s\S]*isolation:\s*isolate;/);
    assert.match(interactionsCss, /\.merged-time-main\s*\{[\s\S]*border-left:\s*none !important;[\s\S]*border-right:\s*none !important;/);
    assert.match(interactionsCss, /\.merged-time-secondary\s*\{[\s\S]*border-left:\s*none !important;[\s\S]*border-right:\s*none !important;/);
    assert.match(interactionsCss, /\.time-range-label\s*\{[\s\S]*white-space:\s*nowrap;[\s\S]*font-size:\s*12px;[\s\S]*line-height:\s*1\.1;/);
    assert.doesNotMatch(interactionsCss, /\.merged-time-main::after/);
    assert.match(interactionsCss, /\.merged-time-main::before\s*\{[\s\S]*background:\s*#ecf0f1;[\s\S]*box-shadow:\s*inset -2px 0 0 #ddd;[\s\S]*z-index:\s*6;/);
    assert.doesNotMatch(interactionsCss, /\.time-entry\.merge-selected-range \.merged-time-main::after/);
});

test('time-slot merge affordance styling remains visible in CSS', () => {
    const responsiveCss = fs.readFileSync(path.join(__dirname, '..', 'styles', 'responsive.css'), 'utf8');
    assert.match(cssSource, /\.time-entry\.merge-capable \.time-slot-container/);
    assert.match(cssSource, /\.time-entry\.merge-hover \.time-slot-merge-affordance/);
    assert.match(cssSource, /\.time-entry\.merge-selected-range \.time-slot-container/);
    assert.match(cssSource, /--merge-overlay-surface/);
    assert.match(cssSource, /--merge-overlay-outline/);
    assert.match(cssSource, /\.time-entry\.merge-selected-range \.time-slot-container\.merged-time-main,[\s\S]*\.time-entry\.existing-merged-range \.time-slot-container\.merged-time-secondary\s*\{[\s\S]*box-shadow:\s*none;/);
    assert.match(cssSource, /\.time-entry\.merge-selected-range \.time-slot-container\.merged-time-main::before,[\s\S]*\.time-entry\.existing-merged-range \.time-slot-container\.merged-time-main::before\s*\{[\s\S]*box-shadow:\s*inset 0 0 0 2px var\(--merge-outline\);/);
    assert.match(cssSource, /\.time-entry\.existing-merged-range \.split-cell-wrapper\.split-type-planned/);
    assert.match(cssSource, /\.has-planned-merge\s*\{[\s\S]*border-bottom-color:\s*#ecf0f1;/);
    assert.match(cssSource, /\.has-planned-merge::after\s*\{[\s\S]*left:\s*80px;[\s\S]*right:\s*0;/);
    assert.match(cssSource, /@media \(max-width:\s*768px\)\s*\{[\s\S]*\.has-planned-merge::after\s*\{[\s\S]*left:\s*60px;[\s\S]*right:\s*0;/);
    assert.match(responsiveCss, /@media \(max-width:\s*640px\)\s*\{[\s\S]*\.has-planned-merge::after\s*\{[\s\S]*left:\s*40px;[\s\S]*right:\s*0;/);
    assert.ok(cssSource.lastIndexOf('@media (max-width: 768px)') > cssSource.indexOf('.has-planned-merge::after {'));
    assert.match(cssSource, /\.has-planned-merge\.merge-selected-range,[\s\S]*\.has-planned-merge\.existing-merged-range\s*\{[\s\S]*border-bottom-color:\s*#ecf0f1;/);
    assert.match(cssSource, /\.has-planned-merge\.merge-selected-range::after,[\s\S]*\.has-planned-merge\.existing-merged-range::after\s*\{[\s\S]*background-color:\s*#ecf0f1;/);
    assert.match(cssSource, /\.selection-overlay\[data-type="planned"\]\[data-merge-visual-state="existing"\]/);
    assert.match(cssSource, /@media \(hover: none\), \(pointer: coarse\)/);
});
