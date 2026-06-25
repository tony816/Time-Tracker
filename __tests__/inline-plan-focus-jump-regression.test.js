const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const controllerSource = fs.readFileSync(
    path.join(__dirname, '..', 'controllers', 'inline-plan-dropdown-controller.js'),
    'utf8'
);

test('inline plan focus defers visibility sync instead of immediate reposition', () => {
    assert.match(
        controllerSource,
        /this\.inlinePlanInputFocusHandler = \(\) => \{\s+this\.markInlinePlanInputIntent\(700\);\s+this\.scheduleInlinePlanInputVisibilitySync\(input\);\s+\};/
    );
    assert.match(
        controllerSource,
        /scheduleInlinePlanInputVisibilitySync\(inputEl\) \{[\s\S]*?const delay = this\.isInlinePlanMobileInputContext\(\) \? 140 : 0;/
    );
});

test('ensureInlinePlanInputVisible repositions from the current slot anchor without scrolling the page', () => {
    assert.match(
        controllerSource,
        /ensureInlinePlanInputVisible\(inputEl\) \{[\s\S]*?const currentAnchor = target[\s\S]*?this\.resolveInlinePlanAnchor\(/
    );
    assert.match(
        controllerSource,
        /ensureInlinePlanInputVisible\(inputEl\) \{[\s\S]*?this\.positionInlinePlanDropdown\(currentAnchor\);/
    );
    assert.doesNotMatch(
        controllerSource,
        /ensureInlinePlanInputVisible\(inputEl\) \{[\s\S]*?scrollIntoView\(/
    );
});

test('mobile inline input intent is tracked to prevent focus-triggered scroll close', () => {
    assert.match(
        controllerSource,
        /markInlinePlanInputIntent\(durationMs = 420\) \{[\s\S]*?this\.inlinePlanInputIntentUntil = now \+ windowMs;/
    );
    assert.match(
        controllerSource,
        /hasRecentInlinePlanInputIntent\(\) \{\s+return Boolean\(this\.inlinePlanInputIntentUntil && Date\.now\(\) < this\.inlinePlanInputIntentUntil\);\s+\}/
    );
    assert.match(
        controllerSource,
        /this\.inlinePlanPageScrollCloseHandler = \(event\) => \{[\s\S]*?if \(this\.isInlinePlanMobileInputContext\(\)\) return;[\s\S]*?this\.closeInlinePlanDropdown\(\);[\s\S]*?\};/
    );
    assert.match(
        controllerSource,
        /input\.addEventListener\('touchstart', markInputIntent, \{ passive: true \}\);/
    );
    assert.match(
        controllerSource,
        /input\.addEventListener\('pointerdown', markInputIntent, \{ passive: true \}\);/
    );
});

test('viewport sync is debounced while mobile inline plan input is focused', () => {
    assert.match(
        controllerSource,
        /scheduleInlinePlanViewportSync\(\) \{[\s\S]*?const inputFocused = Boolean\(/
    );
    assert.match(
        controllerSource,
        /if \(!inputFocused\) \{\s+runSync\(\);\s+return;\s+\}/
    );
    assert.match(
        controllerSource,
        /this\.inlinePlanViewportSyncTimer = setTimeout\(\(\) => \{[\s\S]*?runSync\(\);[\s\S]*?\}, 90\);/
    );
    assert.match(
        controllerSource,
        /const target = this\.inlinePlanTarget;[\s\S]*?this\.resolveInlinePlanAnchor\(/
    );
});

test('focused mobile inline input keeps dropdown attached to the slot anchor and shrinks height before flipping above', () => {
    assert.match(
        controllerSource,
        /positionInlinePlanDropdown\(anchorEl\) \{[\s\S]*?const anchor = this\.resolveInlinePlanAnchor\(anchorEl\);/
    );
    assert.match(
        controllerSource,
        /function layoutInlinePlanAnchoredPanel\(panel, anchorRect, options = \{\}\) \{[\s\S]*?const positionMode = options\.positionMode === 'fixed' \? 'fixed' : 'absolute';[\s\S]*?const layoutScrollY = \(root && Number\(root\.scrollY\)\) \|\| Number\(docEl\.scrollTop\) \|\| 0;[\s\S]*?const anchorTop = positionMode === 'fixed' \? rectTop : layoutScrollY \+ rectTop;[\s\S]*?const anchorBottom = positionMode === 'fixed' \? rectBottom : layoutScrollY \+ rectBottom;/
    );
    assert.doesNotMatch(
        controllerSource,
        /const anchorTop = viewport\.top \+ rect\.top;/
    );
    assert.match(
        controllerSource,
        /positionInlinePlanChildPopover\(anchorEl = null\) \{[\s\S]*?positionMode: 'fixed'/
    );
    assert.match(
        controllerSource,
        /positionInlinePlanDropdown\(anchorEl\) \{[\s\S]*?positionMode: 'absolute'/
    );
    assert.match(
        controllerSource,
        /minHeight: this\.getInlinePlanMinimumInteractiveHeight\(dropdown\),/
    );
    assert.match(
        controllerSource,
        /const belowTop = Math\.max\(anchorBottom, avoidBottom\) \+ gap;[\s\S]*?const spaceBelow = Math\.max\(0, Math\.floor\(layoutViewport\.bottom - belowTop - margin\)\);/
    );
    assert.match(
        controllerSource,
        /const aboveBottom = Math\.min\(anchorTop, avoidTop\) - gap;[\s\S]*?const spaceAbove = Math\.max\(0, Math\.floor\(aboveBottom - layoutViewport\.top - margin\)\);[\s\S]*?spaceBelow < requiredHeight[\s\S]*?spaceAbove > spaceBelow/
    );
    assert.match(
        controllerSource,
        /const maxHeight = Math\.max\(1, Math\.floor\(available\)\);/
    );
    assert.doesNotMatch(
        controllerSource,
        /const referenceRect = inputRow \? inputRow\.getBoundingClientRect\(\) : dropdownRect;/
    );
});
