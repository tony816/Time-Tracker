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
