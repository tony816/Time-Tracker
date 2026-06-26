const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { pathToFileURL } = require('node:url');

const repoRoot = path.resolve(__dirname, '..');
const validatorUrl = pathToFileURL(path.join(repoRoot, 'scripts', 'validate-agent-harness.mjs')).href;

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

test('harness validator extracts repo paths without command tokens', async () => {
    const { extractRepoLocalPaths } = await import(validatorUrl);
    const markdown = [
        '`node --test __tests__/agent-harness-docs.test.js`',
        '`npm run test:harness`',
        '`controllers/timer-controller.js`',
        '`core/actual-grid-core.js`',
        '`ui/time-control-renderer.js`',
        '`infra/storage-adapter.js`',
        '`docs/agent-harness.md`',
        '`scripts/validate-agent-harness.mjs`',
        '`package.json`'
    ].join('\n');

    assert.deepEqual(extractRepoLocalPaths(markdown), [
        '__tests__/agent-harness-docs.test.js',
        'controllers/timer-controller.js',
        'core/actual-grid-core.js',
        'docs/agent-harness.md',
        'infra/storage-adapter.js',
        'scripts/validate-agent-harness.mjs',
        'ui/time-control-renderer.js'
    ]);
});

test('harness validator reports missing repo paths with source document', async () => {
    const { findMissingRepoLocalPaths } = await import(validatorUrl);
    const missing = findMissingRepoLocalPaths(
        [
            '`core/time-core.js`',
            '`controllers/not-a-real-controller.js`',
            '`docs/not-a-real-guide.md`'
        ].join('\n'),
        { repoRoot, sourceDocument: 'docs/agent-harness.md' }
    );

    assert.deepEqual(missing, [
        { repoPath: 'controllers/not-a-real-controller.js', sourceDocument: 'docs/agent-harness.md' },
        { repoPath: 'docs/not-a-real-guide.md', sourceDocument: 'docs/agent-harness.md' }
    ]);
});

test('harness validator checks all repo paths referenced by agent harness', async () => {
    const { validateAgentHarness } = await import(validatorUrl);
    const result = validateAgentHarness({ repoRoot });

    assert.equal(
        result.failures.filter((failure) => failure.includes('Missing repo-local path referenced by docs/agent-harness.md')).length,
        0
    );
    assert.ok(result.referencedPaths.includes('__tests__/agent-harness-docs.test.js'));
    assert.ok(result.referencedPaths.includes('scripts/validate-agent-harness.mjs'));
});
