const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { chromium } = require('@playwright/test');
const { app } = require('../server');

async function withServer(fn) {
    const server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address();
    try {
        await fn(`http://127.0.0.1:${port}/`);
    } finally {
        await new Promise((resolve) => server.close(resolve));
    }
}

async function newMobilePage(browser, url) {
    const context = await browser.newContext({
        viewport: { width: 375, height: 812 },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.tracker && document.querySelector('.time-entry[data-index="8"]'));
    return { page, context, errors };
}

async function newDesktopPage(browser, url) {
    const context = await browser.newContext({
        viewport: { width: 1280, height: 900 },
        deviceScaleFactor: 1,
        isMobile: false,
        hasTouch: false,
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.tracker && document.querySelector('.time-entry[data-index="8"]'));
    return { page, context, errors };
}

async function seedShortSegmentState(page, minutes) {
    await page.evaluate((dur) => {
        const catalog = [
            { id: 'work', label: 'Work', name: 'Work', normalizedName: 'Work', parentId: null, archived: false, source: 'local', boardOrder: 0, displayMode: 'chip' },
            { id: 'study', label: 'Study', name: 'Study', normalizedName: 'Study', parentId: null, archived: false, source: 'local', boardOrder: 1, displayMode: 'chip' },
        ];
        tracker.plannedActivities = catalog.map((item) => ({ ...item }));
        tracker.timeSlots = tracker.createEmptyTimeSlots();
        tracker.mergedFields = new Map();
        tracker.actualRecordingDisabled = true;
        tracker.timeSlots[8].planned = 'Work, Study';
        tracker.timeSlots[8].planActivities = [
            { label: 'Work', activityText: 'Work', activityId: 'work', seconds: dur * 60, startMinute: 0, endMinute: dur, durationMinutes: dur },
            { label: 'Study', activityText: 'Study', activityId: 'study', seconds: 1800, startMinute: dur, endMinute: dur + 30, durationMinutes: 30 },
        ];
        tracker.renderTimeEntries();
        window.scrollTo(0, 0);
    }, minutes);
    await page.waitForSelector('.time-entry[data-index="8"] .split-grid-segment[data-segment-kind="real-plan"]');
}

test('mobile 10-minute planned segment hides timer time text but keeps button', async () => {
    const browser = await chromium.launch({ headless: true });
    try {
        await withServer(async (url) => {
            const { page, context, errors } = await newMobilePage(browser, url);
            try {
                await seedShortSegmentState(page, 10);

                const segments = await page.locator('.time-entry[data-index="8"] .split-grid-segment');
                const firstSegment = segments.nth(0);

                // The 10-minute segment should have is-short-plan-segment class
                const classList = await firstSegment.evaluate((el) => el.className);
                assert.ok(classList.includes('is-short-plan-segment'), '10-min segment should have is-short-plan-segment class');

                // Timer time should be hidden
                const timeDisplay = await firstSegment.locator('.plan-segment-timer-time');
                const timeDisplayCount = await timeDisplay.count();
                assert.ok(timeDisplayCount >= 1, 'timer time element should exist in DOM');
                const timeComputed = await timeDisplay.first().evaluate((el) => window.getComputedStyle(el).display);
                assert.equal(timeComputed, 'none', 'timer time text should have display:none on mobile');

                // Timer button should remain visible
                const button = firstSegment.locator('.plan-segment-timer-button');
                const buttonCount = await button.count();
                assert.ok(buttonCount >= 1, 'timer button should exist in DOM');
                const buttonComputed = await button.first().evaluate((el) => window.getComputedStyle(el).display);
                assert.notEqual(buttonComputed, 'none', 'timer button should remain visible');

                // The 30-minute Study segment should not have is-short-plan-segment
                const secondSegment = segments.nth(1);
                const secondClassList = await secondSegment.evaluate((el) => el.className);
                assert.ok(!secondClassList.includes('is-short-plan-segment'), '30-min segment should NOT have is-short-plan-segment class');

                assert.deepEqual(errors, []);
            } finally {
                await context.close();
            }
        });
    } finally {
        await browser.close();
    }
});

test('mobile 15-minute planned segment keeps timer time text visible', async () => {
    const browser = await chromium.launch({ headless: true });
    try {
        await withServer(async (url) => {
            const { page, context, errors } = await newMobilePage(browser, url);
            try {
                await seedShortSegmentState(page, 15);

                const firstSegment = page.locator('.time-entry[data-index="8"] .split-grid-segment').nth(0);

                const classList = await firstSegment.evaluate((el) => el.className);
                assert.ok(!classList.includes('is-short-plan-segment'), '15-min segment should NOT have is-short-plan-segment class');

                const timeDisplay = await firstSegment.locator('.plan-segment-timer-time');
                const timeComputed = await timeDisplay.first().evaluate((el) => window.getComputedStyle(el).display);
                assert.notEqual(timeComputed, 'none', '15-min segment timer time should remain visible on mobile');

                assert.deepEqual(errors, []);
            } finally {
                await context.close();
            }
        });
    } finally {
        await browser.close();
    }
});

test('desktop 10-minute planned segment keeps timer time text visible', async () => {
    const browser = await chromium.launch({ headless: true });
    try {
        await withServer(async (url) => {
            const { page, context, errors } = await newDesktopPage(browser, url);
            try {
                await seedShortSegmentState(page, 10);

                const firstSegment = page.locator('.time-entry[data-index="8"] .split-grid-segment').nth(0);

                const timeDisplay = await firstSegment.locator('.plan-segment-timer-time');
                const timeComputed = await timeDisplay.first().evaluate((el) => window.getComputedStyle(el).display);
                assert.notEqual(timeComputed, 'none', 'desktop 10-min segment timer time should remain visible');

                assert.deepEqual(errors, []);
            } finally {
                await context.close();
            }
        });
    } finally {
        await browser.close();
    }
});
