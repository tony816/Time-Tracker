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
    assert.match(row.innerHtml, /<div class="time-label">04<\/div>/);
    assert.match(row.innerHtml, /timer-btn/);
    assert.match(row.innerHtml, /time-slot-container merge-capable/);
    assert.match(row.innerHtml, /time-slot-merge-affordance/);
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
});

test('time-slot merge affordance styling remains visible in CSS', () => {
    assert.match(cssSource, /\.time-entry\.merge-capable \.time-slot-container/);
    assert.match(cssSource, /\.time-entry\.merge-hover \.time-slot-merge-affordance/);
    assert.match(cssSource, /\.time-entry\.merge-selected-range \.time-slot-container/);
    assert.match(cssSource, /--merge-overlay-surface/);
    assert.match(cssSource, /--merge-overlay-outline/);
    assert.match(cssSource, /\.time-entry\.existing-merged-range \.split-cell-wrapper\.split-type-planned/);
    assert.match(cssSource, /\.selection-overlay\[data-type="planned"\]\[data-merge-visual-state="existing"\]/);
    assert.match(cssSource, /@media \(hover: none\), \(pointer: coarse\)/);
});
