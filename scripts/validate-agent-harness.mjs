import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(import.meta.url);
const defaultRepoRoot = path.resolve(path.dirname(scriptPath), '..');
const repoPathPattern = /(?:^|[^A-Za-z0-9_./-])((?:__tests__\/[A-Za-z0-9_.-]+\.test\.js|controllers\/[A-Za-z0-9_.-]+\.js|core\/[A-Za-z0-9_.-]+\.js|ui\/[A-Za-z0-9_.-]+\.js|infra\/[A-Za-z0-9_.-]+\.js|docs\/[A-Za-z0-9_./-]+\.md|scripts\/[A-Za-z0-9_.-]+\.mjs))(?![A-Za-z0-9_./-])/g;

export const requiredFiles = [
    'AGENTS.md',
    'README.md',
    'docs/docs-index.md',
    'docs/agent-harness.md',
    'docs/harness-quality-score.md',
    'scripts/validate-agent-harness.mjs',
    '__tests__/agent-harness-docs.test.js',
    'package.json'
];

function normalizeRepoPath(repoPath) {
    return repoPath.replace(/\\/g, '/');
}

function absolutePath(repoRoot, relativePath) {
    const normalizedPath = normalizeRepoPath(relativePath);
    const resolvedPath = path.resolve(repoRoot, ...normalizedPath.split('/'));
    const normalizedRoot = path.resolve(repoRoot);

    if (resolvedPath !== normalizedRoot && !resolvedPath.startsWith(`${normalizedRoot}${path.sep}`)) {
        throw new Error(`Path escapes repository root: ${relativePath}`);
    }

    return resolvedPath;
}

function readText(repoRoot, relativePath) {
    return fs.readFileSync(absolutePath(repoRoot, relativePath), 'utf8');
}

function createChecker(failures) {
    let checkCount = 0;

    return {
        check(condition, message) {
            checkCount += 1;
            if (!condition) {
                failures.push(message);
            }
        },
        get checkCount() {
            return checkCount;
        }
    };
}

function checkFileExists(repoRoot, relativePath, checker) {
    checker.check(fs.existsSync(absolutePath(repoRoot, relativePath)), `Missing required file: ${relativePath}`);
}

function checkIncludes(repoRoot, relativePath, snippets, checker) {
    const text = readText(repoRoot, relativePath);
    for (const snippet of snippets) {
        checker.check(text.includes(snippet), `${relativePath} must include "${snippet}"`);
    }
}

function checkHeadings(repoRoot, relativePath, headings, checker) {
    const text = readText(repoRoot, relativePath);
    for (const heading of headings) {
        const pattern = new RegExp(`^${heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'm');
        checker.check(pattern.test(text), `${relativePath} must include heading ${heading}`);
    }
}

export function extractRepoLocalPaths(markdownText) {
    const paths = new Set();
    let match;

    repoPathPattern.lastIndex = 0;
    while ((match = repoPathPattern.exec(markdownText)) !== null) {
        paths.add(normalizeRepoPath(match[1]));
    }

    return Array.from(paths).sort();
}

export function findMissingRepoLocalPaths(markdownText, options = {}) {
    const repoRoot = options.repoRoot ?? defaultRepoRoot;
    const sourceDocument = options.sourceDocument ?? 'docs/agent-harness.md';

    return extractRepoLocalPaths(markdownText)
        .filter((repoPath) => !fs.existsSync(absolutePath(repoRoot, repoPath)))
        .map((repoPath) => ({ repoPath, sourceDocument }));
}

function checkAgentHarnessRepoPaths(repoRoot, checker) {
    const sourceDocument = 'docs/agent-harness.md';
    const markdownText = readText(repoRoot, sourceDocument);
    const extractedPaths = extractRepoLocalPaths(markdownText);

    checker.check(extractedPaths.length > 0, `${sourceDocument} must reference repo-local paths`);

    for (const repoPath of extractedPaths) {
        checker.check(
            fs.existsSync(absolutePath(repoRoot, repoPath)),
            `Missing repo-local path referenced by ${sourceDocument}: ${repoPath}`
        );
    }

    return extractedPaths;
}

export function validateAgentHarness(options = {}) {
    const repoRoot = options.repoRoot ?? defaultRepoRoot;
    const failures = [];
    const checker = createChecker(failures);

    for (const file of requiredFiles) {
        checkFileExists(repoRoot, file, checker);
    }

    checkHeadings(repoRoot, 'docs/agent-harness.md', [
        '## Codex Work Loop',
        '## Read Path And Test Path',
        '## Mobile Planned Segment Risk Surface',
        '## Browser Smoke For UI Changes',
        '## Reporting Template'
    ], checker);

    checkHeadings(repoRoot, 'docs/harness-quality-score.md', [
        '## Rating Criteria',
        '## Surface Scores',
        '## Maintenance Rules'
    ], checker);

    for (const file of ['AGENTS.md', 'README.md', 'docs/docs-index.md']) {
        checkIncludes(repoRoot, file, [
            'docs/agent-harness.md',
            'docs/harness-quality-score.md'
        ], checker);
    }

    checkIncludes(repoRoot, 'docs/agent-harness.md', [
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
    ], checker);

    checkIncludes(repoRoot, 'docs/harness-quality-score.md', [
        'Planned editing / selection',
        'Mobile segment resize',
        'Persistence / sync',
        'Actual-lock legacy guard',
        'Timer',
        'Codex-readability'
    ], checker);

    const referencedPaths = checkAgentHarnessRepoPaths(repoRoot, checker);
    const packageJson = JSON.parse(readText(repoRoot, 'package.json'));
    const harnessCommand = packageJson.scripts?.['test:harness'] ?? '';
    checker.check(harnessCommand.includes('scripts/validate-agent-harness.mjs'), 'package.json scripts.test:harness must run scripts/validate-agent-harness.mjs');
    checker.check(harnessCommand.includes('__tests__/agent-harness-docs.test.js'), 'package.json scripts.test:harness must run __tests__/agent-harness-docs.test.js');

    return {
        checkCount: checker.checkCount,
        failures,
        referencedPaths
    };
}

function isCli() {
    return Boolean(process.argv[1]) && path.resolve(process.argv[1]) === scriptPath;
}

if (isCli()) {
    const result = validateAgentHarness();

    if (result.failures.length > 0) {
        console.error('Agent harness validation failed:');
        for (const failure of result.failures) {
            console.error(`- ${failure}`);
        }
        process.exit(1);
    }

    console.log(`Agent harness validation passed (${result.checkCount} checks, ${result.referencedPaths.length} repo paths).`);
}
