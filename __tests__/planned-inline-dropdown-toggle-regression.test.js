const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const controller = require('../controllers/inline-plan-dropdown-controller');
const scriptSource = fs.readFileSync(path.join(__dirname, '..', 'script.js'), 'utf8');
const controllerSource = fs.readFileSync(path.join(__dirname, '..', 'controllers', 'inline-plan-dropdown-controller.js'), 'utf8');
const selectionControllerSource = fs.readFileSync(path.join(__dirname, '..', 'controllers', 'selection-overlay-controller.js'), 'utf8');
const fieldInteractionControllerSource = fs.readFileSync(path.join(__dirname, '..', 'controllers', 'field-interaction-controller.js'), 'utf8');

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
    assert.match(fieldInteractionControllerSource, /function attachCellClickListeners\(entryDiv, index\) \{/);
    assert.match(fieldInteractionControllerSource, /plannedField\.addEventListener\('mousedown', \(e\) => \{/);
    assert.match(fieldInteractionControllerSource, /plannedField\.addEventListener\('click', \(e\) => \{/);
    assert.match(fieldInteractionControllerSource, /this\.suppressInlinePlanClickOnce = index;/);
    assert.match(fieldInteractionControllerSource, /if \(this\.inlinePlanDropdown && this\.isSameInlinePlanTarget\(range\)\) \{/);
});

test('same-slot toggle clears planned selection before closing dropdown', () => {
    assert.match(fieldInteractionControllerSource, /function closeSameInlinePlanTarget\(ctx\) \{/);
    assert.match(fieldInteractionControllerSource, /ctx\.clearSelection\('planned'\);/);
    assert.match(fieldInteractionControllerSource, /ctx\.closeInlinePlanDropdown\(\);/);
});

test('merged click capture closes same planned target before bubble reopen', () => {
    assert.match(fieldInteractionControllerSource, /function handleMergedClickCapture\(e\) \{/);
    assert.match(fieldInteractionControllerSource, /const plannedInput = target\.closest && target\.closest\('\.planned-input'\);/);
    assert.match(fieldInteractionControllerSource, /if \(this\.suppressInlinePlanClickOnce === plannedIndex\) \{/);
    assert.match(fieldInteractionControllerSource, /if \(this\.inlinePlanDropdown && this\.isSameInlinePlanTarget\(plannedRange\)\) \{/);
    assert.match(fieldInteractionControllerSource, /closeSameInlinePlanTarget\(this\);\s+return;/);
});

test('merged click capture closes dropdown when clicking planned column inside current range', () => {
    assert.match(fieldInteractionControllerSource, /const currentRow = target\.closest && target\.closest\('\.time-entry\[data-index\]'\);/);
    assert.match(fieldInteractionControllerSource, /const inPlannedColumn = e\.clientX >= plannedRect\.left/);
    assert.match(fieldInteractionControllerSource, /if \(inPlannedColumn\) \{\s+e\.preventDefault\(\);\s+e\.stopPropagation\(\);\s+closeSameInlinePlanTarget\(this\);\s+return;\s+\}/);
});

test('inline add auto-apply on empty slots keeps the dropdown open', () => {
    assert.match(controllerSource, /if \(canAutoApply\) \{\s+const applyOptions = \{ \.\.\.options, keepOpen: true, keepOpenOnMobile: true \};\s+this\.applyInlinePlanSelection\(val, applyOptions\);\s+\}/);
});

test('planned selection overlay click closes same-range inline dropdown on mouseup', () => {
    assert.match(selectionControllerSource, /if \(type === 'planned' && this\.inlinePlanDropdown && Number\.isInteger\(overlayDrag\.startIndex\)\) \{/);
    assert.match(selectionControllerSource, /const clickedRange = this\.getPlannedRangeInfo\(overlayDrag\.startIndex\);/);
    assert.match(selectionControllerSource, /if \(this\.isSameInlinePlanTarget\(clickedRange\)\) \{\s+this\.closeInlinePlanDropdown\(\);\s+\}/);
});

test('planned field listeners no longer own merge initiation while dropdown viewport prep remains shared', () => {
    assert.doesNotMatch(fieldInteractionControllerSource, /const suppressReopen = this\.suppressInlinePlanClickOnce === index;/);
    assert.doesNotMatch(fieldInteractionControllerSource, /plannedMouseMoved/);
    assert.doesNotMatch(fieldInteractionControllerSource, /plannedField\.addEventListener\('touchstart'/);
    assert.match(fieldInteractionControllerSource, /function attachTimeSlotMergeEntryListeners\(entryDiv, index\) \{/);
    assert.match(fieldInteractionControllerSource, /this\.selectFieldRange\('planned', range\.start, range\.end\);/);
    assert.match(fieldInteractionControllerSource, /ctx\.preparePlannedSlotReplacementViewport\(viewportTargetEl \|\| sheetTargetEl \|\| plannedField\)/);
    assert.match(fieldInteractionControllerSource, /scheduleAfterAnimationFrame\(open\);/);
});

test('external page scroll keeps inline plan dropdown open while internal scroll and visual viewport sync are isolated', () => {
    assert.match(controllerSource, /function isInlinePlanInternalScrollTarget\(ctx, target\) \{[\s\S]*?nodeContains\(dropdown, target\)[\s\S]*?nodeContains\(childPopover, target\)[\s\S]*?return false;/);
    assert.match(controllerSource, /this\.inlinePlanPageScrollCloseHandler = \(event\) => \{[\s\S]*?if \(event && isInlinePlanInternalScrollTarget\(this, event\.target\)\) return;[\s\S]*?this\.scheduleInlinePlanViewportSync\(\);[\s\S]*?\};/);
    assert.match(controllerSource, /window\.addEventListener\('scroll', this\.inlinePlanPageScrollCloseHandler, true\);/);
    assert.match(controllerSource, /document\.addEventListener\('scroll', this\.inlinePlanPageScrollCloseHandler, true\);/);
    assert.match(controllerSource, /this\.inlinePlanGestureCloseHandler = \(event\) => \{[\s\S]*?event\.preventDefault\(\);[\s\S]*?this\.scheduleInlinePlanViewportSync\(\);[\s\S]*?\};/);
    assert.match(controllerSource, /positionMode:\s*'fixed'/);
    assert.match(controllerSource, /panel\.style\.position = positionMode;/);
    assert.match(controllerSource, /document\.addEventListener\('touchmove', this\.inlinePlanGestureCloseHandler, true\);/);
    assert.match(controllerSource, /window\.addEventListener\('wheel', this\.inlinePlanGestureCloseHandler, true\);/);
    assert.match(controllerSource, /window\.visualViewport\.addEventListener\('scroll', this\.inlinePlanScrollHandler\);/);
    assert.doesNotMatch(controllerSource, /window\.addEventListener\('scroll', this\.inlinePlanScrollHandler, true\);/);
    assert.match(controllerSource, /window\.removeEventListener\('scroll', this\.inlinePlanPageScrollCloseHandler, true\);/);
    assert.match(controllerSource, /document\.removeEventListener\('scroll', this\.inlinePlanPageScrollCloseHandler, true\);/);
    assert.match(controllerSource, /document\.removeEventListener\('touchmove', this\.inlinePlanGestureCloseHandler, true\);/);
    assert.match(controllerSource, /window\.removeEventListener\('wheel', this\.inlinePlanGestureCloseHandler, true\);/);
});
