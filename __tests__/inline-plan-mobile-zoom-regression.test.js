const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const interactionsSource = fs.readFileSync(
    path.join(__dirname, '..', 'styles', 'interactions.css'),
    'utf8'
);

test('inline plan input uses at least 16px font-size to avoid iOS auto zoom', () => {
    assert.match(
        interactionsSource,
        /\.inline-plan-input\s*\{[\s\S]*?font-size:\s*16px;/
    );
    assert.match(
        interactionsSource,
        /\.inline-plan-input-row\.inline-plan-input-row-mobile-close \.inline-plan-input\s*\{[\s\S]*?font-size:\s*16px;/
    );
});

test('planned segment resize handle avoids nested thin inner pill layers', () => {
    assert.doesNotMatch(interactionsSource, /--plan-segment-handle-inner-/);
    assert.match(
        interactionsSource,
        /\.plan-segment-boundary-resize-handle-line::after\s*\{[\s\S]*?content:\s*none;[\s\S]*?\}/
    );
    assert.match(
        interactionsSource,
        /\.plan-segment-resize-handle::after,\s*\n\.plan-segment-boundary-resize-handle-line::after\s*\{[\s\S]*?content:\s*none;[\s\S]*?\}/
    );

    const handleBlock = interactionsSource.match(
        /\.plan-segment-boundary-resize-handle-line\s*\{[\s\S]*?\n\}/
    );
    assert.ok(handleBlock);
    assert.match(handleBlock[0], /width:\s*var\(--plan-segment-handle-visual-width\);/);
    assert.match(handleBlock[0], /border:\s*1px solid var\(--plan-segment-handle-stroke\);/);
    assert.doesNotMatch(handleBlock[0], /inset/);
    assert.doesNotMatch(handleBlock[0], /plan-segment-resize-handle::after/);

    const hoverBlock = interactionsSource.match(
        /\.plan-segment-resize-handle:hover \.plan-segment-boundary-resize-handle-line,[\s\S]*?\.split-grid-segment\.is-resizing-plan-segment \.plan-segment-boundary-resize-handle-line\s*\{[\s\S]*?\n\}/
    );
    assert.ok(hoverBlock);
    assert.doesNotMatch(hoverBlock[0], /inset/);
    assert.doesNotMatch(hoverBlock[0], /::after/);
});
