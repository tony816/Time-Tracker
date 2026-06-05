import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];
let checkCount = 0;

function absolutePath(relativePath) {
    return path.join(repoRoot, relativePath);
}

function readText(relativePath) {
    return fs.readFileSync(absolutePath(relativePath), 'utf8');
}

function check(condition, message) {
    checkCount += 1;
    if (!condition) {
        failures.push(message);
    }
}

function checkFileExists(relativePath) {
    check(fs.existsSync(absolutePath(relativePath)), `Missing required file: ${relativePath}`);
}

function checkIncludes(relativePath, snippets) {
    const text = readText(relativePath);
    for (const snippet of snippets) {
        check(text.includes(snippet), `${relativePath} must include "${snippet}"`);
    }
}

function checkHeadings(relativePath, headings) {
    const text = readText(relativePath);
    for (const heading of headings) {
        const pattern = new RegExp(`^${heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'm');
        check(pattern.test(text), `${relativePath} must include heading ${heading}`);
    }
}

const requiredFiles = [
    'AGENTS.md',
    'README.md',
    'docs/docs-index.md',
    'docs/agent-harness.md',
    'docs/harness-quality-score.md',
    'scripts/validate-agent-harness.mjs',
    '__tests__/agent-harness-docs.test.js',
    'package.json'
];

for (const file of requiredFiles) {
    checkFileExists(file);
}

checkHeadings('docs/agent-harness.md', [
    '## Codex Work Loop',
    '## Read Path And Test Path',
    '## Mobile Planned Segment Risk Surface',
    '## Browser Smoke For UI Changes',
    '## Reporting Template'
]);

checkHeadings('docs/harness-quality-score.md', [
    '## Rating Criteria',
    '## Surface Scores',
    '## Maintenance Rules'
]);

for (const file of ['AGENTS.md', 'README.md', 'docs/docs-index.md']) {
    checkIncludes(file, [
        'docs/agent-harness.md',
        'docs/harness-quality-score.md'
    ]);
}

checkIncludes('docs/agent-harness.md', [
    'Planned editing / selection',
    'Mobile planned segment resize',
    'Actual-grid lock / legacy guard',
    'Persistence / sync',
    'Timer',
    'Tap target visibility',
    'Dropdown/sheet anchoring',
    'Resize repeatability',
    'Post-resize suppression',
    'Desktop viewport',
    'Mobile viewport'
]);

checkIncludes('docs/harness-quality-score.md', [
    'Planned editing / selection',
    'Mobile segment resize',
    'Persistence / sync',
    'Actual-lock legacy guard',
    'Timer',
    'Codex-readability'
]);

const packageJson = JSON.parse(readText('package.json'));
const harnessCommand = packageJson.scripts?.['test:harness'] ?? '';
check(harnessCommand.includes('scripts/validate-agent-harness.mjs'), 'package.json scripts.test:harness must run scripts/validate-agent-harness.mjs');
check(harnessCommand.includes('__tests__/agent-harness-docs.test.js'), 'package.json scripts.test:harness must run __tests__/agent-harness-docs.test.js');

if (failures.length > 0) {
    console.error('Agent harness validation failed:');
    for (const failure of failures) {
        console.error(`- ${failure}`);
    }
    process.exit(1);
}

console.log(`Agent harness validation passed (${checkCount} checks).`);
