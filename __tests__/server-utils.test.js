const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

const {
    app,
    parsePriorityValue,
    extractPriorityRank,
    extractTitleFromPage,
    isValidNotionDatabaseId,
    getStaticCacheControl,
    isStaticAssetRequest,
    isBlockedStandaloneHtml,
} = require('../server');

test('parsePriorityValue parses valid values', () => {
    assert.equal(parsePriorityValue('Pr.1'), 1);
    assert.equal(parsePriorityValue('Pr.25'), 25);
    assert.equal(parsePriorityValue(' Pr.3 '), 3);
});

test('parsePriorityValue rejects invalid values', () => {
    assert.equal(parsePriorityValue('P.1'), null);
    assert.equal(parsePriorityValue('Pr.x'), null);
    assert.equal(parsePriorityValue(''), null);
    assert.equal(parsePriorityValue(null), null);
});

test('extractPriorityRank reads select property by name', () => {
    const page = {
        properties: {
            Pr: {
                type: 'select',
                select: { name: 'Pr.7' },
            },
        },
    };
    assert.equal(extractPriorityRank(page), 7);
});

test('extractTitleFromPage composes plain_text title', () => {
    const page = {
        properties: {
            Name: {
                type: 'title',
                title: [
                    { plain_text: 'Daily ' },
                    { plain_text: 'Review' },
                ],
            },
        },
    };
    assert.equal(extractTitleFromPage(page), 'Daily Review');
});

test('isValidNotionDatabaseId accepts 32-hex and hyphenated UUID', () => {
    assert.equal(isValidNotionDatabaseId('0123456789abcdef0123456789ABCDEF'), true);
    assert.equal(isValidNotionDatabaseId('01234567-89ab-cdef-0123-456789abcdef'), true);
});

test('isValidNotionDatabaseId rejects malformed ids', () => {
    assert.equal(isValidNotionDatabaseId(''), false);
    assert.equal(isValidNotionDatabaseId('not-a-db-id'), false);
    assert.equal(isValidNotionDatabaseId('01234567-89ab-cdef-0123-456789abcde'), false);
    assert.equal(isValidNotionDatabaseId('0123456789abcdef0123456789abcdeZ'), false);
});

test('getStaticCacheControl uses no-cache for html and immutable cache for static assets', () => {
    assert.equal(getStaticCacheControl('index.html'), 'no-cache');
    assert.equal(getStaticCacheControl('styles.css'), 'public, max-age=300, immutable');
    assert.equal(getStaticCacheControl('script.js'), 'public, max-age=300, immutable');
});

test('static asset request detection covers JS/CSS and standalone html blocks', () => {
    assert.equal(isStaticAssetRequest('/controllers/field-interaction-controller.js'), true);
    assert.equal(isStaticAssetRequest('/styles/foundation.css'), true);
    assert.equal(isStaticAssetRequest('/dashboard'), false);
    assert.equal(isBlockedStandaloneHtml('/actual-grid-palette-test.html'), true);
    assert.equal(isBlockedStandaloneHtml('/index.html'), false);
});

test('server serves every local index script and stylesheet without html fallback', async () => {
    const server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address();
    const baseUrl = `http://127.0.0.1:${port}`;
    try {
        const indexResponse = await fetch(`${baseUrl}/index.html`);
        assert.equal(indexResponse.status, 200);
        const html = await indexResponse.text();
        const assetPaths = [
            ...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g),
            ...html.matchAll(/<link\b[^>]*\bhref="([^"]+)"/g),
        ]
            .map((match) => match[1])
            .filter((src) => !/^https?:\/\//.test(src))
            .filter((src) => !src.startsWith('//'));
        assert.ok(assetPaths.includes('controllers/field-interaction-controller.js'));
        assert.ok(assetPaths.includes('controllers/inline-plan-dropdown-controller.js'));
        assert.ok(assetPaths.includes('styles/foundation.css'));

        for (const assetPath of assetPaths) {
            const response = await fetch(`${baseUrl}/${assetPath}`);
            assert.equal(response.status, 200, assetPath);
            const contentType = response.headers.get('content-type') || '';
            if (assetPath.endsWith('.js')) {
                assert.match(contentType, /javascript/, assetPath);
            } else if (assetPath.endsWith('.css')) {
                assert.match(contentType, /text\/css/, assetPath);
            }
            const body = await response.text();
            assert.doesNotMatch(body.slice(0, 80), /<!DOCTYPE html>/i, assetPath);
        }

        const missingJs = await fetch(`${baseUrl}/controllers/not-real.js`);
        assert.equal(missingJs.status, 404);
        assert.doesNotMatch(await missingJs.text(), /<!DOCTYPE html>/i);

        const blockedHtml = await fetch(`${baseUrl}/actual-grid-palette-test.html`);
        assert.equal(blockedHtml.status, 404);
    } finally {
        await new Promise((resolve) => server.close(resolve));
    }
});
