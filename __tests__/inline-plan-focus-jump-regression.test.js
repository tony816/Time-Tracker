const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const scriptSource = fs.readFileSync(path.join(__dirname, '..', 'script.js'), 'utf8');

test('inline plan focus defers visibility sync instead of immediate reposition', () => {
    assert.match(
        scriptSource,
        /this\.inlinePlanInputFocusHandler = \(\) => \{\s+this\.scheduleInlinePlanInputVisibilitySync\(input\);\s+\};/
    );
    assert.match(
        scriptSource,
        /scheduleInlinePlanInputVisibilitySync\(inputEl\) \{[\s\S]*?const delay = this\.isInlinePlanMobileInputContext\(\) \? 140 : 0;/
    );
});

test('ensureInlinePlanInputVisible only scrolls when input is outside viewport bounds', () => {
    assert.match(
        scriptSource,
        /const needsScroll = inputTop < \(viewport\.top \+ 12\) \|\| inputBottom > \(viewport\.bottom - 12\);/
    );
    assert.match(
        scriptSource,
        /if \(!needsScroll\) return;/
    );
    assert.match(
        scriptSource,
        /inputRow\.scrollIntoView\(\{ block: 'nearest', inline: 'nearest', behavior: 'instant' \}\);/
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
        /this\.inlinePlanScrollHandler = \(event\) => \{[\s\S]*?this\.scheduleInlinePlanViewportSync\(\);[\s\S]*?\};/
    );
});

test('focused mobile inline input repositions dropdown from the input row instead of the slot anchor', () => {
    assert.match(
        scriptSource,
        /isInlinePlanInputFocused\(\) \{[\s\S]*?document\.activeElement === inlineInput/
    );
    assert.match(
        scriptSource,
        /if \(this\.isInlinePlanInputFocused\(\)\) \{[\s\S]*?const inputRow = dropdown\.querySelector\('\.inline-plan-input-row'\);/
    );
    assert.match(
        scriptSource,
        /const referenceRect = inputRow \? inputRow\.getBoundingClientRect\(\) : dropdownRect;/
    );
});
