const test = require('node:test');
const assert = require('node:assert/strict');

const {
    parsePriorityValue,
    extractPriorityRank,
    extractTitleFromPage,
    isValidNotionDatabaseId,
    getStaticCacheControl,
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
