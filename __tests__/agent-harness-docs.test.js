const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '..');

function readText(relativePath) {
    return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

test('agent harness maps required work surfaces to tests', () => {
    const harness = readText('docs/agent-harness.md');
    const requiredSnippets = [
        '## Codex Work Loop',
        '## Read Path And Test Path',
        'Planned editing / selection',
        'Mobile planned segment resize',
        'Actual-grid lock / legacy guard',
        'Persistence / sync',
        'Timer',
        'npm run test:actual-lock',
        'npm run test:harness'
    ];

    for (const snippet of requiredSnippets) {
        assert.ok(harness.includes(snippet), `missing harness snippet: ${snippet}`);
    }
});

test('mobile planned segment smoke criteria are explicit', () => {
    const harness = readText('docs/agent-harness.md');
    const requiredSnippets = [
        'mobile bottom sheet',
        'mobile segment resize',
        'Tap target visibility',
        'Dropdown/sheet anchoring',
        'Resize repeatability',
        'Post-resize suppression',
        'Desktop viewport',
        'Mobile viewport'
    ];

    for (const snippet of requiredSnippets) {
        assert.ok(harness.includes(snippet), `missing mobile smoke snippet: ${snippet}`);
    }
});

test('harness quality score grades the minimum required surfaces', () => {
    const scorecard = readText('docs/harness-quality-score.md');
    const requiredSurfaces = [
        'Planned editing / selection',
        'Mobile segment resize',
        'Persistence / sync',
        'Actual-lock legacy guard',
        'Timer'
    ];

    assert.ok(scorecard.includes('Codex-readability'), 'scorecard must define Codex-readability criteria');

    for (const surface of requiredSurfaces) {
        const rowPattern = new RegExp(`\\| ${surface.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\| [ABCD] \\|`);
        assert.ok(rowPattern.test(scorecard), `missing scored surface row: ${surface}`);
    }
});

test('entry documents link to the harness docs', () => {
    for (const relativePath of ['AGENTS.md', 'README.md', 'docs/docs-index.md']) {
        const text = readText(relativePath);
        assert.ok(text.includes('docs/agent-harness.md'), `${relativePath} must link docs/agent-harness.md`);
        assert.ok(text.includes('docs/harness-quality-score.md'), `${relativePath} must link docs/harness-quality-score.md`);
    }
});

test('package exposes harness validation command', () => {
    const packageJson = JSON.parse(readText('package.json'));
    const command = packageJson.scripts?.['test:harness'] ?? '';

    assert.ok(command.includes('scripts/validate-agent-harness.mjs'));
    assert.ok(command.includes('__tests__/agent-harness-docs.test.js'));
});
