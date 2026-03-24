const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const controller = require('../controllers/inline-plan-dropdown-controller');
const scriptSource = fs.readFileSync(path.join(__dirname, '..', 'script.js'), 'utf8');
const controllerSource = fs.readFileSync(path.join(__dirname, '..', 'controllers', 'inline-plan-dropdown-controller.js'), 'utf8');

const { isSameInlinePlanTarget } = controller;

test('isSameInlinePlanTarget matches same single-slot range without requiring anchor', () => {
    const ctx = {
        inlinePlanTarget: {
            startIndex: 3,
            endIndex: 3,
            anchor: { id: 'first' },
        },
    };

    assert.equal(isSameInlinePlanTarget.call(ctx, { startIndex: 3, endIndex: 3 }), true);
});

test('isSameInlinePlanTarget matches same range and anchor for toggle close', () => {
    const anchor = { id: 'same-anchor' };
    const ctx = {
        inlinePlanTarget: {
            startIndex: 5,
            endIndex: 7,
            anchor,
        },
    };

    assert.equal(isSameInlinePlanTarget.call(ctx, { startIndex: 5, endIndex: 7 }, anchor), true);
});

test('isSameInlinePlanTarget rejects different range', () => {
    const ctx = {
        inlinePlanTarget: {
            startIndex: 5,
            endIndex: 7,
            anchor: { id: 'first' },
        },
    };

    assert.equal(isSameInlinePlanTarget.call(ctx, { startIndex: 5, endIndex: 8 }), false);
});

test('isSameInlinePlanTarget ignores anchor changes when range is the same', () => {
    const ctx = {
        inlinePlanTarget: {
            startIndex: 5,
            endIndex: 7,
            anchor: { id: 'first' },
        },
    };

    assert.equal(
        isSameInlinePlanTarget.call(ctx, { startIndex: 5, endIndex: 7 }, { id: 'second' }),
        true
    );
});

test('inline plan outside close runs on click phase so same-slot toggle can close first', () => {
    assert.match(controllerSource, /document\.addEventListener\('click', this\.inlinePlanOutsideHandler, true\)/);
    assert.doesNotMatch(controllerSource, /document\.addEventListener\('mousedown', this\.inlinePlanOutsideHandler, true\)/);
});

test('attachCellClickListeners binds direct planned-input click handler for same-slot toggle', () => {
    assert.match(scriptSource, /plannedField\.addEventListener\('mousedown', \(e\) => \{/);
    assert.match(scriptSource, /plannedField\.addEventListener\('click', \(e\) => \{/);
    assert.match(scriptSource, /this\.suppressInlinePlanClickOnce = index;/);
    assert.match(scriptSource, /if \(this\.inlinePlanDropdown && this\.isSameInlinePlanTarget\(range\)\) \{/);
});

test('same-slot toggle clears planned selection before closing dropdown', () => {
    assert.match(scriptSource, /this\.clearSelection\('planned'\);\s+this\.closeInlinePlanDropdown\(\);\s+return;/);
});

test('merged click capture closes same planned target before bubble reopen', () => {
    assert.match(scriptSource, /const plannedInput = target\.closest && target\.closest\('\.planned-input'\);/);
    assert.match(scriptSource, /if \(this\.suppressInlinePlanClickOnce === plannedIndex\) \{/);
    assert.match(scriptSource, /if \(this\.inlinePlanDropdown && this\.isSameInlinePlanTarget\(plannedRange\)\) \{/);
    assert.match(scriptSource, /this\.closeInlinePlanDropdown\(\);\s+return;/);
});

test('merged click capture closes dropdown when clicking planned column inside current range', () => {
    assert.match(scriptSource, /const currentRow = target\.closest && target\.closest\('\.time-entry\[data-index\]'\);/);
    assert.match(scriptSource, /const inPlannedColumn = e\.clientX >= plannedRect\.left/);
    assert.match(scriptSource, /if \(inPlannedColumn\) \{\s+e\.preventDefault\(\);\s+e\.stopPropagation\(\);\s+(?:this\.clearSelection\('planned'\);\s+)?this\.closeInlinePlanDropdown\(\);\s+return;\s+\}/);
});

test('inline add auto-apply on empty slots forces dropdown close', () => {
    assert.match(controllerSource, /if \(canAutoApply\) \{\s+const applyOptions = \{ \.\.\.options, keepOpen: false \};\s+this\.applyInlinePlanSelection\(val, applyOptions\);\s+\}/);
});

test('planned selection overlay click closes same-range inline dropdown on mouseup', () => {
    assert.match(scriptSource, /if \(type === 'planned' && this\.inlinePlanDropdown && Number\.isInteger\(overlayDrag\.startIndex\)\) \{/);
    assert.match(scriptSource, /const clickedRange = this\.getPlannedRangeInfo\(overlayDrag\.startIndex\);/);
    assert.match(scriptSource, /if \(this\.isSameInlinePlanTarget\(clickedRange\)\) \{\s+this\.closeInlinePlanDropdown\(\);\s+\}/);
});

test('planned mouseup path suppresses reopen when same-slot toggle close is armed', () => {
    assert.match(scriptSource, /const suppressReopen = this\.suppressInlinePlanClickOnce === index;/);
    assert.match(scriptSource, /if \(!plannedMouseMoved\) \{\s+if \(suppressReopen\) \{\s+this\.clearSelection\('planned'\);\s+\} else \{/);
    assert.match(scriptSource, /if \(!e\.ctrlKey && !e\.metaKey\) \{\s+const anchor = plannedField\.closest\('\.split-cell-wrapper\.split-type-planned'\) \|\| plannedField;\s+this\.openInlinePlanDropdown\(base\.start, anchor\);\s+\}/);
});

test('external page scroll closes inline plan dropdown while visual viewport scroll only repositions it', () => {
    assert.match(controllerSource, /this\.inlinePlanPageScrollCloseHandler = \(event\) => \{[\s\S]*?this\.closeInlinePlanDropdown\(\);\s+\};/);
    assert.match(controllerSource, /if \(event\.target === this\.inlinePlanDropdown \|\| this\.inlinePlanDropdown\.contains\(event\.target\)\) \{\s+return;\s+\}/);
    assert.match(controllerSource, /if \(this\.isInlinePlanInputFocused\(\) \|\| this\.hasRecentInlinePlanInputIntent\(\)\) \{\s+this\.scheduleInlinePlanViewportSync\(\);\s+return;\s+\}/);
    assert.match(controllerSource, /window\.addEventListener\('scroll', this\.inlinePlanPageScrollCloseHandler, true\);/);
    assert.match(controllerSource, /document\.addEventListener\('scroll', this\.inlinePlanPageScrollCloseHandler, true\);/);
    assert.match(controllerSource, /this\.inlinePlanGestureCloseHandler = \(event\) => \{[\s\S]*?this\.closeInlinePlanDropdown\(\);\s+\};/);
    assert.match(controllerSource, /document\.addEventListener\('touchmove', this\.inlinePlanGestureCloseHandler, true\);/);
    assert.match(controllerSource, /window\.addEventListener\('wheel', this\.inlinePlanGestureCloseHandler, true\);/);
    assert.match(controllerSource, /window\.visualViewport\.addEventListener\('scroll', this\.inlinePlanScrollHandler\);/);
    assert.doesNotMatch(controllerSource, /window\.addEventListener\('scroll', this\.inlinePlanScrollHandler, true\);/);
    assert.match(controllerSource, /window\.removeEventListener\('scroll', this\.inlinePlanPageScrollCloseHandler, true\);/);
    assert.match(controllerSource, /document\.removeEventListener\('scroll', this\.inlinePlanPageScrollCloseHandler, true\);/);
    assert.match(controllerSource, /document\.removeEventListener\('touchmove', this\.inlinePlanGestureCloseHandler, true\);/);
    assert.match(controllerSource, /window\.removeEventListener\('wheel', this\.inlinePlanGestureCloseHandler, true\);/);
});
