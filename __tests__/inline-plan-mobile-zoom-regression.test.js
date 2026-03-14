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
