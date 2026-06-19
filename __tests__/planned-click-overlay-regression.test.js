const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('single planned selection overlay does not intercept pointer events', () => {
    const css = fs.readFileSync(path.join(__dirname, '..', 'styles', 'foundation.css'), 'utf8');

    assert.match(
        css,
        /\.selection-overlay\[data-type="planned"\]\[data-fill="outline"\]\s*\{[\s\S]*?pointer-events:\s*none;[\s\S]*?\}/
    );
});

test('planned inputs do not show a browser focus outline after retap clearing', () => {
    const css = fs.readFileSync(path.join(__dirname, '..', 'styles', 'foundation.css'), 'utf8');

    assert.match(
        css,
        /\.input-field\.planned-input:focus,\s*\.input-field\.planned-input:focus-visible\s*\{[\s\S]*?outline:\s*none;[\s\S]*?\}/
    );
});
