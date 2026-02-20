const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { buildMethod } = require('./helpers/script-method-builder');

const selectFieldRange = buildMethod('selectFieldRange(type, startIndex, endIndex)', '(type, startIndex, endIndex)');
const scriptSource = fs.readFileSync(path.join(__dirname, '..', 'script.js'), 'utf8');

test('selectFieldRange expands to merged planned slot boundaries', () => {
    const ctx = {
        timeSlots: new Array(12).fill({}),
        selectedPlannedFields: new Set(),
        selectedActualFields: new Set(),
        getPlannedRangeInfo(index) {
            if (index >= 2 && index <= 4) return { startIndex: 2, endIndex: 4, mergeKey: 'planned-2-4' };
            if (index >= 7 && index <= 8) return { startIndex: 7, endIndex: 8, mergeKey: 'planned-7-8' };
            return { startIndex: index, endIndex: index, mergeKey: null };
        },
        clearSelection(type) {
            if (type === 'planned') this.selectedPlannedFields.clear();
            if (type === 'actual') this.selectedActualFields.clear();
        },
        updateSelectionOverlayCalls: [],
        updateSelectionOverlay(type) {
            this.updateSelectionOverlayCalls.push(type);
        },
        showMergeButtonCalls: [],
        showMergeButton(type) {
            this.showMergeButtonCalls.push(type);
        },
        showScheduleButtonForSelectionCalls: [],
        showScheduleButtonForSelection(type) {
            this.showScheduleButtonForSelectionCalls.push(type);
        },
    };

    selectFieldRange.call(ctx, 'planned', 3, 7);

    assert.deepEqual(Array.from(ctx.selectedPlannedFields), [2, 3, 4, 5, 6, 7, 8]);
    assert.deepEqual(ctx.updateSelectionOverlayCalls, ['planned']);
    assert.deepEqual(ctx.showMergeButtonCalls, ['planned']);
    assert.deepEqual(ctx.showScheduleButtonForSelectionCalls, ['planned']);
});

test('merged planned drag start no longer depends on hold delay', () => {
    const anchor = scriptSource.slice(
        scriptSource.indexOf('if (!this.isSelectingPlanned && this.pendingMergedMouseSelection)'),
        scriptSource.indexOf('if (!this.isSelectingPlanned || this.currentColumnType !== \'planned\')')
    );

    assert.match(anchor, /if \(movedPx >= 4\)/);
    assert.doesNotMatch(anchor, /elapsedMs\s*>=\s*220/);
});

