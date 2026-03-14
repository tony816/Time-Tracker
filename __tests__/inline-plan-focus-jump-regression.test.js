const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const scriptSource = fs.readFileSync(path.join(__dirname, '..', 'script.js'), 'utf8');

test('inline plan focus defers visibility sync instead of immediate reposition', () => {
    assert.match(
        scriptSource,
        /this\.inlinePlanInputFocusHandler = \(\) => \{\s+this\.markInlinePlanInputIntent\(700\);\s+this\.scheduleInlinePlanInputVisibilitySync\(input\);\s+\};/
    );
    assert.match(
        scriptSource,
        /scheduleInlinePlanInputVisibilitySync\(inputEl\) \{[\s\S]*?const delay = this\.isInlinePlanMobileInputContext\(\) \? 140 : 0;/
    );
});

test('ensureInlinePlanInputVisible repositions from the current slot anchor without scrolling the page', () => {
    assert.match(
        scriptSource,
        /ensureInlinePlanInputVisible\(inputEl\) \{[\s\S]*?const currentAnchor = target[\s\S]*?this\.resolveInlinePlanAnchor\(/
    );
    assert.match(
        scriptSource,
        /ensureInlinePlanInputVisible\(inputEl\) \{[\s\S]*?this\.positionInlinePlanDropdown\(currentAnchor\);/
    );
    assert.doesNotMatch(
        scriptSource,
        /ensureInlinePlanInputVisible\(inputEl\) \{[\s\S]*?scrollIntoView\(/
    );
});

test('mobile inline input intent is tracked to prevent focus-triggered scroll close', () => {
    assert.match(
        scriptSource,
        /markInlinePlanInputIntent\(durationMs = 420\) \{[\s\S]*?this\.inlinePlanInputIntentUntil = now \+ windowMs;/
    );
    assert.match(
        scriptSource,
        /hasRecentInlinePlanInputIntent\(\) \{\s+return Boolean\(this\.inlinePlanInputIntentUntil && Date\.now\(\) < this\.inlinePlanInputIntentUntil\);\s+\}/
    );
    assert.match(
        scriptSource,
        /if \(this\.isInlinePlanInputFocused\(\) \|\| this\.hasRecentInlinePlanInputIntent\(\)\) \{\s+this\.scheduleInlinePlanViewportSync\(\);\s+return;\s+\}/
    );
    assert.match(
        scriptSource,
        /input\.addEventListener\('touchstart', markInputIntent, \{ passive: true \}\);/
    );
    assert.match(
        scriptSource,
        /input\.addEventListener\('pointerdown', markInputIntent, \{ passive: true \}\);/
    );
});

test('viewport sync is debounced while mobile inline plan input is focused', () => {
    assert.match(
        scriptSource,
        /scheduleInlinePlanViewportSync\(\) \{[\s\S]*?const inputFocused = Boolean\(/ 
    );
    assert.match(
        scriptSource,
        /if \(!inputFocused\) \{\s+runSync\(\);\s+return;\s+\}/
    );
    assert.match(
        scriptSource,
        /this\.inlinePlanViewportSyncTimer = setTimeout\(\(\) => \{[\s\S]*?runSync\(\);[\s\S]*?\}, 90\);/
    );
    assert.match(
        scriptSource,
        /const target = this\.inlinePlanTarget;[\s\S]*?this\.resolveInlinePlanAnchor\(/
    );
});

test('focused mobile inline input keeps dropdown attached to the slot anchor and shrinks height before flipping above', () => {
    assert.match(
        scriptSource,
        /positionInlinePlanDropdown\(anchorEl\) \{[\s\S]*?const anchor = this\.resolveInlinePlanAnchor\(anchorEl\);/
    );
    assert.match(
        scriptSource,
        /const layoutScrollY = window\.scrollY \|\| docEl\.scrollTop \|\| 0;[\s\S]*?const anchorTop = layoutScrollY \+ rect\.top;[\s\S]*?const anchorBottom = layoutScrollY \+ rect\.bottom;/
    );
    assert.doesNotMatch(
        scriptSource,
        /const anchorTop = viewport\.top \+ rect\.top;/
    );
    assert.match(
        scriptSource,
        /const minimumInteractiveHeight = this\.getInlinePlanMinimumInteractiveHeight\(dropdown\);/
    );
    assert.match(
        scriptSource,
        /const rawSpaceBelow = Math\.max\(0, Math\.floor\(viewport\.bottom - anchorBottom - gap - margin\)\);/
    );
    assert.match(
        scriptSource,
        /rawSpaceBelow < minimumInteractiveHeight[\s\S]*?rawSpaceAbove > rawSpaceBelow/
    );
    assert.match(
        scriptSource,
        /const maxHeight = Math\.max\(1, available > 0 \? Math\.floor\(available\) : fallbackHeight\);/
    );
    assert.doesNotMatch(
        scriptSource,
        /const referenceRect = inputRow \? inputRow\.getBoundingClientRect\(\) : dropdownRect;/
    );
});
