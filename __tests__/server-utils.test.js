const test = require('node:test');
const assert = require('node:assert/strict');

const {
    parsePriorityValue,
    extractPriorityRank,
    extractTitleFromPage,
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
