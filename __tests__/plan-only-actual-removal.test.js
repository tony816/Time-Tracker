const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.join(__dirname, '..');
const htmlSource = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
const scriptSource = fs.readFileSync(path.join(rootDir, 'script.js'), 'utf8');
const serverSource = fs.readFileSync(path.join(rootDir, 'server.js'), 'utf8');
const renderer = require('../ui/time-entry-renderer');

test('index page no longer exposes actual-recording entry points', () => {
    assert.doesNotMatch(htmlSource, /recordingModeLink/);
    assert.doesNotMatch(htmlSource, /class="actual-label"/);
    assert.doesNotMatch(htmlSource, /id="totalActual"/);
    assert.doesNotMatch(htmlSource, /id="executionRate"/);
    assert.doesNotMatch(htmlSource, /id="activityLogModal"/);
    assert.doesNotMatch(htmlSource, /actual-activity-list-renderer\.js/);
    assert.doesNotMatch(htmlSource, /actual-input-controller\.js/);
    assert.doesNotMatch(htmlSource, /actual-modal-controller\.js/);
});

test('app defaults to plan-only without query mode switching', () => {
    assert.match(scriptSource, /this\.actualRecordingDisabled\s*=\s*true;/);
    assert.doesNotMatch(htmlSource, /TIME_TRACKER_DISABLE_ACTUAL_RECORDING/);
    assert.doesNotMatch(scriptSource, /mode'\)\s*===\s*'plan-only/);
});

test('server no longer serves deleted actual-only controllers', () => {
    assert.doesNotMatch(serverSource, /controllers\/actual-input-controller\.js/);
    assert.doesNotMatch(serverSource, /controllers\/actual-modal-controller\.js/);
    assert.doesNotMatch(serverSource, /ui\/actual-activity-list-renderer\.js/);
});

test('legacy actual fields and actual merge keys are ignored by row renderer', () => {
    const row = renderer.buildRowRenderModel({
        slot: { time: '9', planned: 'Plan', actual: 'Legacy actual' },
        index: 1,
        findMergeKey(type) {
            if (type === 'actual') return 'actual-1-3';
            return null;
        },
        createMergedField: () => '[merged]',
        wrapWithSplitVisualization: (type, _index, content) => `<div class="${type}">${content}</div>`,
        createTimerControls: () => '',
        formatSlotTimeLabel: (rawHour) => String(rawHour).padStart(2, '0'),
        escapeAttribute: (value) => String(value),
    });

    assert.equal(row.actualMergeKey, null);
    assert.equal(row.hasActualMergeContinuation, false);
    assert.doesNotMatch(row.innerHtml, /Legacy actual/);
    assert.doesNotMatch(row.innerHtml, /actual-input|split-type-actual|split-visualization-actual/);
});
