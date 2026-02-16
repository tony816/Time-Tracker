const test = require('node:test');
const assert = require('node:assert/strict');

const renderer = require('../ui/time-entry-renderer');

test('time-entry-renderer exports and global attach are available', () => {
    assert.equal(typeof renderer.buildRowRenderModel, 'function');
    assert.equal(typeof renderer.parseMergeRange, 'function');
    assert.ok(globalThis.TimeEntryRenderer);
    assert.equal(typeof globalThis.TimeEntryRenderer.buildRowRenderModel, 'function');
});

test('buildRowRenderModel renders non-merged row with wrapped planned/actual content', () => {
    const row = renderer.buildRowRenderModel({
        slot: { time: '4', planned: 'deep "work"', actual: '' },
        index: 3,
        currentDate: '2026-02-16',
        findMergeKey: () => null,
        createMergedField: () => '<div class="merged"></div>',
        createTimerField: (index) => `<input class="input-field actual-input" data-index="${index}">`,
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
    assert.match(row.innerHtml, /wrapped-actual/);
    assert.match(row.innerHtml, /data-index="3"/);
    assert.match(row.innerHtml, /deep &quot;work&quot;/);
    assert.match(row.innerHtml, /<div class="time-label">04<\/div>/);
    assert.match(row.innerHtml, /timer-btn/);
});

test('buildRowRenderModel uses merged builders and continuation flags for merged ranges', () => {
    const row = renderer.buildRowRenderModel({
        slot: { time: '11', planned: 'plan', actual: 'actual' },
        index: 2,
        currentDate: '2026-02-16',
        findMergeKey: (type) => {
            if (type === 'planned') return 'planned-2-4';
            if (type === 'actual') return 'actual-1-3';
            if (type === 'time') return 'time-2-4';
            return null;
        },
        createMergedField: (mergeKey, type, index) => `[merged:${mergeKey}:${type}:${index}]`,
        createTimerField: () => '[timer-field]',
        wrapWithSplitVisualization: (_type, _index, content) => content,
        createTimerControls: () => '[timer-controls]',
        createMergedTimeField: (mergeKey, index) => `[merged-time:${mergeKey}:${index}]`,
        formatSlotTimeLabel: (rawHour) => String(rawHour),
        escapeAttribute: (value) => String(value),
        getRoutineForPlannedIndex: () => null,
    });

    assert.equal(row.hasPlannedMergeContinuation, true);
    assert.equal(row.hasActualMergeContinuation, true);
    assert.equal(row.plannedMergeKey, 'planned-2-4');
    assert.equal(row.actualMergeKey, 'actual-1-3');

    assert.match(row.innerHtml, /\[merged:planned-2-4:planned:2\]/);
    assert.match(row.innerHtml, /\[merged:actual-1-3:actual:2\]/);
    assert.match(row.innerHtml, /\[merged-time:time-2-4:2\]/);
});
