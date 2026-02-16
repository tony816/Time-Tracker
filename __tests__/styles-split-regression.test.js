const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.join(__dirname, '..');
const entryCssPath = path.join(rootDir, 'styles.css');
const foundationCssPath = path.join(rootDir, 'styles', 'foundation.css');
const modalCssPath = path.join(rootDir, 'styles', 'modal.css');
const interactionsCssPath = path.join(rootDir, 'styles', 'interactions.css');
const responsiveCssPath = path.join(rootDir, 'styles', 'responsive.css');

test('styles.css loads split css files in stable order', () => {
    const source = fs.readFileSync(entryCssPath, 'utf8').trim();
    const lines = source.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);

    assert.deepEqual(lines, [
        "@import url('./styles/foundation.css');",
        "@import url('./styles/modal.css');",
        "@import url('./styles/interactions.css');",
        "@import url('./styles/responsive.css');",
    ]);
});

test('split css files exist and keep section anchors', () => {
    const foundationSource = fs.readFileSync(foundationCssPath, 'utf8');
    const modalSource = fs.readFileSync(modalCssPath, 'utf8');
    const interactionsSource = fs.readFileSync(interactionsCssPath, 'utf8');
    const responsiveSource = fs.readFileSync(responsiveCssPath, 'utf8');

    assert.ok(foundationSource.length > 0);
    assert.match(modalSource, /\/\*\s*모달 스타일\s*\*\//);
    assert.match(interactionsSource, /\/\*\s*타이머 UI 스타일\s*\*\//);
    assert.match(responsiveSource, /\/\*\s*Mobile responsive enhancements\s*\*\//);
    assert.match(responsiveSource, /\/\*\s*--- UX enhancement patch ---\s*\*\//);
});
