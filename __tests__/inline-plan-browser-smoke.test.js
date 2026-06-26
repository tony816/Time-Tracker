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

async function newSmokePage(browser, url, options = {}) {
    const context = await browser.newContext({
        viewport: options.viewport || { width: 1180, height: 820 },
        deviceScaleFactor: 1,
        isMobile: Boolean(options.mobile),
        hasTouch: Boolean(options.mobile),
    });
    const page = await context.newPage();
    const errors = [];
    page.on('console', (msg) => {
        if (msg.type() !== 'error') return;
        const text = msg.text();
        if (/Failed to load resource|cdn\.jsdelivr|googletagmanager|cloudflareinsights|supabase|Notion is not configured/i.test(text)) return;
        errors.push(text);
    });
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.tracker && document.querySelector('.time-entry[data-index="8"]'));
    await seedSmokeState(page);
    return { page, context, errors };
}

async function seedSmokeState(page) {
    await page.evaluate(() => {
        const catalog = [
            { id: 'work', label: 'Work', name: 'Work', normalizedName: 'Work', parentId: null, archived: false, source: 'local', boardOrder: 0, displayMode: 'chip' },
            { id: 'study', label: 'Study', name: 'Study', normalizedName: 'Study', parentId: null, archived: false, source: 'local', boardOrder: 1, displayMode: 'chip' },
            { id: 'review', label: 'Review', name: 'Review', normalizedName: 'Review', parentId: null, archived: false, source: 'local', boardOrder: 2, displayMode: 'chip' },
            { id: 'plan', label: 'Plan', name: 'Plan', normalizedName: 'Plan', parentId: null, archived: false, source: 'local', boardOrder: 3, displayMode: 'chip' },
            { id: 'deep', label: 'Deep', name: 'Deep', normalizedName: 'Deep', parentId: 'work', archived: false, source: 'local', boardOrder: 4, displayMode: 'chip' },
        ];
        tracker.plannedActivities = catalog.map((item) => ({ ...item }));
        tracker.timeSlots = tracker.createEmptyTimeSlots();
        tracker.mergedFields = new Map();
        tracker.actualRecordingDisabled = true;
        tracker.timeSlots[8].planned = 'Work, Study';
        tracker.timeSlots[8].planActivities = [
            { label: 'Work', activityText: 'Work', activityId: 'work', seconds: 1800, startMinute: 0, endMinute: 30, durationMinutes: 30 },
            { label: 'Study', activityText: 'Study', activityId: 'study', seconds: 1800, startMinute: 30, endMinute: 60, durationMinutes: 30 },
        ];
        tracker.renderTimeEntries();
        window.scrollTo(0, 0);
    });
    await page.waitForSelector('.time-entry[data-index="8"] .split-grid-segment[data-segment-kind="real-plan"]');
}

async function openSegmentDropdown(page, segmentIndex = 0) {
    const selector = `.time-entry[data-index="8"] .split-grid-segment[data-segment-kind="real-plan"][data-segment-index="${segmentIndex}"]`;
    await page.locator(selector).click();
    await page.waitForSelector('.inline-plan-dropdown');
    return selector;
}

async function closeDropdown(page) {
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('.inline-plan-dropdown'));
}

async function assertNoAppErrors(errors) {
    assert.deepEqual(errors, []);
}

async function assertDropdownOpen(page) {
    assert.equal(await page.locator('.inline-plan-dropdown').count(), 1);
    assert.equal(await page.locator('.inline-plan-dropdown').isVisible(), true);
}

async function assertNoDragLeaks(page) {
    const leaks = await page.evaluate(() => ({
        pending: document.querySelectorAll('.activity-chip-drag-pending').length,
        dragging: document.querySelectorAll('.activity-chip-dragging').length,
        board: document.querySelectorAll('.activity-chip-board-drag-active').length,
        feedback: document.querySelectorAll('.activity-chip-drop-before, .activity-chip-drop-after, .activity-chip-drop-nest, .activity-chip-drop-invalid, .activity-chip-drop-label').length,
        preview: document.querySelectorAll('.activity-chip-drag-preview').length,
        state: Boolean(tracker.inlinePlanChipDragState),
    }));
    assert.deepEqual(leaks, { pending: 0, dragging: 0, board: 0, feedback: 0, preview: 0, state: false });
}

async function chipCenter(page, label) {
    const locator = page.locator('.activity-chip:visible', { hasText: label }).first();
    const box = await locator.boundingBox();
    assert.ok(box, `missing chip ${label}`);
    return { x: box.x + box.width / 2, y: box.y + box.height / 2, box };
}

async function dragChip(page, sourceLabel, targetLabel, placement = 'center') {
    const source = await chipCenter(page, sourceLabel);
    const target = await chipCenter(page, targetLabel);
    let targetX = target.x;
    if (placement === 'before') targetX = target.box.x + Math.max(4, target.box.width * 0.12);
    if (placement === 'after') targetX = target.box.x + target.box.width - Math.max(4, target.box.width * 0.12);
    await page.mouse.move(source.x, source.y);
    await page.mouse.down();
    await page.mouse.move(source.x + 8, source.y + 8, { steps: 2 });
    await page.mouse.move(targetX, target.y, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(60);
    await assertNoDragLeaks(page);
}

test('browser segment replacement dropdown reopens after close, scroll, render, and mobile retaps', async () => {
    await withServer(async (url) => {
        const browser = await chromium.launch();
        try {
            const { page, context, errors } = await newSmokePage(browser, url);
            try {
                for (let i = 0; i < 5; i += 1) {
                    await openSegmentDropdown(page, 0);
                    await assertDropdownOpen(page);
                    await closeDropdown(page);
                }
                await openSegmentDropdown(page, 1);
                await assertDropdownOpen(page);
                await page.locator('.activity-chip', { hasText: 'Review' }).first().click();
                await page.waitForFunction(() => !document.querySelector('.inline-plan-dropdown'));
                assert.match(await page.locator('.time-entry[data-index="8"]').textContent(), /Review/);
                await openSegmentDropdown(page, 1);
                await page.evaluate(() => window.scrollBy(0, 140));
                await page.waitForTimeout(80);
                await assertDropdownOpen(page);
                await closeDropdown(page);
                await openSegmentDropdown(page, 0);
                await closeDropdown(page);
                await assertNoAppErrors(errors);
            } finally {
                await context.close();
            }

            const mobile = await newSmokePage(browser, url, { mobile: true, viewport: { width: 390, height: 780 } });
            try {
                for (let i = 0; i < 5; i += 1) {
                    await openSegmentDropdown(mobile.page, 0);
                    await assertDropdownOpen(mobile.page);
                    assert.equal(await mobile.page.locator('.inline-plan-dropdown-sheet').count(), 1);
                    await mobile.page.locator('.inline-plan-close-btn').click();
                    await mobile.page.waitForFunction(() => !document.querySelector('.inline-plan-dropdown'));
                }
                await assertNoAppErrors(mobile.errors);
            } finally {
                await mobile.context.close();
            }
        } finally {
            await browser.close();
        }
    });
});

test('browser dropdown and mobile sheet remain open and stable during page scroll', async () => {
    await withServer(async (url) => {
        const browser = await chromium.launch();
        try {
            const { page, context, errors } = await newSmokePage(browser, url);
            try {
                await page.locator('.time-entry[data-index="10"] .planned-input').click();
                await assertDropdownOpen(page);
                const before = await page.locator('.inline-plan-dropdown').boundingBox();
                await page.evaluate(() => window.scrollBy(0, 120));
                await page.waitForTimeout(100);
                await assertDropdownOpen(page);
                const after = await page.locator('.inline-plan-dropdown').boundingBox();
                const position = await page.locator('.inline-plan-dropdown').evaluate((el) => getComputedStyle(el).position);
                assert.equal(position, 'fixed');
                assert.ok(Math.abs(after.x - before.x) < 4);
                await page.locator('.activity-chip-board').first().evaluate((el) => { el.scrollTop = 40; el.dispatchEvent(new Event('scroll', { bubbles: true })); });
                await assertDropdownOpen(page);
                await closeDropdown(page);

                await openSegmentDropdown(page, 0);
                await page.evaluate(() => window.scrollBy(0, -80));
                await page.waitForTimeout(100);
                await assertDropdownOpen(page);
                assert.equal(await page.locator('.inline-plan-dropdown').evaluate((el) => getComputedStyle(el).position), 'fixed');
                await assertNoAppErrors(errors);
            } finally {
                await context.close();
            }

            const mobile = await newSmokePage(browser, url, { mobile: true, viewport: { width: 390, height: 780 } });
            try {
                await openSegmentDropdown(mobile.page, 0);
                const beforeSheet = await mobile.page.locator('.inline-plan-dropdown-sheet').boundingBox();
                await mobile.page.mouse.wheel(0, 320);
                await mobile.page.waitForTimeout(100);
                await assertDropdownOpen(mobile.page);
                const afterSheet = await mobile.page.locator('.inline-plan-dropdown-sheet').boundingBox();
                assert.ok(Math.abs(afterSheet.y - beforeSheet.y) < 3);
                assert.equal(await mobile.page.locator('.inline-plan-dropdown-sheet').evaluate((el) => getComputedStyle(el).position), 'fixed');
                await mobile.page.locator('.activity-chip-board').first().evaluate((el) => { el.scrollTop = 60; el.dispatchEvent(new Event('scroll', { bubbles: true })); });
                await assertDropdownOpen(mobile.page);
                const handle = await mobile.page.locator('.inline-plan-sheet-drag-handle').boundingBox();
                await mobile.page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
                await mobile.page.mouse.down();
                await mobile.page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2 + 100, { steps: 5 });
                await mobile.page.mouse.up();
                await mobile.page.waitForFunction(() => !document.querySelector('.inline-plan-dropdown'));
                await assertNoAppErrors(mobile.errors);
            } finally {
                await mobile.context.close();
            }
        } finally {
            await browser.close();
        }
    });
});


test('browser mobile sheet closes via pointerType touch drag and reopens after close', async () => {
    await withServer(async (url) => {
        const browser = await chromium.launch();
        try {
            const mobile = await newSmokePage(browser, url, { mobile: true, viewport: { width: 390, height: 780 } });
            try {
                // First open
                await openSegmentDropdown(mobile.page, 0);
                await assertDropdownOpen(mobile.page);
                assert.equal(await mobile.page.locator('.inline-plan-dropdown-sheet').count(), 1);

                // Dispatch pointerType="touch" drag via evaluate to simulate real mobile touch
                const handle = await mobile.page.locator('.inline-plan-sheet-drag-handle').boundingBox();
                assert.ok(handle, 'drag handle missing');
                const startX = handle.x + handle.width / 2;
                const startY = handle.y + handle.height / 2;

                await mobile.page.evaluate(({ x, y }) => {
                    const target = document.elementFromPoint(x, y);
                    if (!target) return;
                    target.dispatchEvent(new PointerEvent('pointerdown', {
                        pointerType: 'touch', pointerId: 1, clientX: x, clientY: y, bubbles: true, cancelable: true,
                    }));
                    target.dispatchEvent(new PointerEvent('pointermove', {
                        pointerType: 'touch', pointerId: 1, clientX: x, clientY: y + 120, bubbles: true, cancelable: true,
                    }));
                    target.dispatchEvent(new PointerEvent('pointerup', {
                        pointerType: 'touch', pointerId: 1, clientX: x, clientY: y + 120, bubbles: true, cancelable: true,
                    }));
                }, { x: startX, y: startY });

                await mobile.page.waitForFunction(() => !document.querySelector('.inline-plan-dropdown'));
                await assertNoAppErrors(mobile.errors);

                // Reopen and drag close again
                await openSegmentDropdown(mobile.page, 0);
                await assertDropdownOpen(mobile.page);
                await mobile.page.waitForSelector('.inline-plan-sheet-drag-handle');
                const handle2 = await mobile.page.locator('.inline-plan-sheet-drag-handle').boundingBox();
                const sx = handle2.x + handle2.width / 2;
                const sy = handle2.y + handle2.height / 2;

                await mobile.page.evaluate(({ x, y }) => {
                    const target = document.elementFromPoint(x, y);
                    if (!target) return;
                    target.dispatchEvent(new PointerEvent('pointerdown', {
                        pointerType: 'touch', pointerId: 2, clientX: x, clientY: y, bubbles: true, cancelable: true,
                    }));
                    target.dispatchEvent(new PointerEvent('pointermove', {
                        pointerType: 'touch', pointerId: 2, clientX: x, clientY: y + 120, bubbles: true, cancelable: true,
                    }));
                    target.dispatchEvent(new PointerEvent('pointerup', {
                        pointerType: 'touch', pointerId: 2, clientX: x, clientY: y + 120, bubbles: true, cancelable: true,
                    }));
                }, { x: sx, y: sy });

                await mobile.page.waitForFunction(() => !document.querySelector('.inline-plan-dropdown'));
                await assertNoAppErrors(mobile.errors);
            } finally {
                await mobile.context.close();
            }
        } finally {
            await browser.close();
        }
    });
});

test('browser mobile sheet does not close when drag starts from chipboard', async () => {
    await withServer(async (url) => {
        const browser = await chromium.launch();
        try {
            const mobile = await newSmokePage(browser, url, { mobile: true, viewport: { width: 390, height: 780 } });
            try {
                await openSegmentDropdown(mobile.page, 0);
                await assertDropdownOpen(mobile.page);
                assert.equal(await mobile.page.locator('.inline-plan-dropdown-sheet').count(), 1);

                // Try to drag from a chip inside the chipboard
                const chip = await mobile.page.locator('.activity-chip').first().boundingBox();
                assert.ok(chip, 'chip missing');
                const cx = chip.x + chip.width / 2;
                const cy = chip.y + chip.height / 2;

                await mobile.page.evaluate(({ x, y }) => {
                    const target = document.elementFromPoint(x, y);
                    if (!target) return;
                    target.dispatchEvent(new PointerEvent('pointerdown', {
                        pointerType: 'touch', pointerId: 3, clientX: x, clientY: y, bubbles: true, cancelable: true,
                    }));
                    target.dispatchEvent(new PointerEvent('pointermove', {
                        pointerType: 'touch', pointerId: 3, clientX: x, clientY: y + 120, bubbles: true, cancelable: true,
                    }));
                    target.dispatchEvent(new PointerEvent('pointerup', {
                        pointerType: 'touch', pointerId: 3, clientX: x, clientY: y + 120, bubbles: true, cancelable: true,
                    }));
                }, { x: cx, y: cy });

                await mobile.page.waitForTimeout(300);
                // Sheet should still be open
                assert.equal(await mobile.page.locator('.inline-plan-dropdown-sheet').count(), 1);
                await assertNoAppErrors(mobile.errors);
            } finally {
                await mobile.context.close();
            }
        } finally {
            await browser.close();
        }
    });
});
test('browser mobile plan segment apply preserves target visibility without scroll jump', async () => {
    await withServer(async (url) => {
        const browser = await chromium.launch();
        try {
            const mobile = await newSmokePage(browser, url, { mobile: true, viewport: { width: 390, height: 780 } });
            try {
                await openSegmentDropdown(mobile.page, 0);
                await assertDropdownOpen(mobile.page);
                assert.equal(await mobile.page.locator('.inline-plan-dropdown-sheet').count(), 1);

                // Scroll to a known position to have a predictable baseline
                await mobile.page.evaluate(() => window.scrollTo(0, 200));
                await mobile.page.waitForTimeout(100);
                const preScrollY = await mobile.page.evaluate(() => window.scrollY || window.pageYOffset || 0);

                // Select an activity to apply to the segment
                await mobile.page.locator('.activity-chip', { hasText: 'Review' }).first().click();

                // Wait for sheet to close
                await mobile.page.waitForFunction(() => !document.querySelector('.inline-plan-dropdown'));
                // Give double-RAF time to execute
                await mobile.page.waitForTimeout(350);

                const postScrollY = await mobile.page.evaluate(() => window.scrollY || window.pageYOffset || 0);
                const jump = postScrollY - preScrollY;

                // Assert sheet and backdrop are removed
                assert.equal(await mobile.page.locator('.inline-plan-dropdown').count(), 0);
                assert.equal(await mobile.page.locator('.inline-plan-dropdown-sheet').count(), 0);

                // Assert the target segment row is visible
                const targetInfo = await mobile.page.evaluate(() => {
                    const row = document.querySelector('.time-entry[data-index="8"]');
                    if (!row) return { found: false, top: -1, bottom: -1, vh: -1, scrollY: -1 };
                    const rect = row.getBoundingClientRect();
                    const vh = window.visualViewport ? window.visualViewport.height : window.innerHeight;
                    return {
                        found: true,
                        top: Math.round(rect.top),
                        bottom: Math.round(rect.bottom),
                        vh: Math.round(vh),
                        scrollY: Math.round(window.scrollY || window.pageYOffset || 0),
                    };
                });
                assert.equal(targetInfo.found, true, 'target row [data-index="8"] not found after apply');
                const rowVisible = targetInfo.top >= -20 && targetInfo.bottom <= targetInfo.vh + 20;
                assert.equal(rowVisible, true,
                    'row not visible: top=' + targetInfo.top + ' bottom=' + targetInfo.bottom +
                    ' vh=' + targetInfo.vh + ' scrollY=' + targetInfo.scrollY + ' jump=' + jump);

                // Assert scroll did not jump far from our pre-defined position
                assert.ok(Math.abs(jump) <= 300,
                    'scroll jump too large: ' + jump + ' (pre=' + preScrollY + ' post=' + postScrollY + ')');

                // Assert the segment was replaced with Review
                const segmentPresent = await mobile.page.locator(
                    '.time-entry[data-index="8"] .split-grid-segment[data-segment-index="0"]'
                ).count();
                if (segmentPresent > 0) {
                    const segmentText = await mobile.page.locator(
                        '.time-entry[data-index="8"] .split-grid-segment[data-segment-index="0"]'
                    ).textContent();
                    assert.match(segmentText, /Review/);
                }

                // Assert activeElement is not another planned input
                const activeElIsPlannedInput = await mobile.page.evaluate(() => {
                    const active = document.activeElement;
                    return active && active.classList && active.classList.contains('planned-input');
                });
                assert.equal(activeElIsPlannedInput, false, 'activeElement should not be another planned input');

                await assertNoAppErrors(mobile.errors);
            } finally {
                await mobile.context.close();
            }
        } finally {
            await browser.close();
        }
    });
});

test('browser chipboard supports repeated mixed drag gestures without stale drag state', async () => {
    await withServer(async (url) => {
        const browser = await chromium.launch();
        const { page, context, errors } = await newSmokePage(browser, url);
        try {
            await page.locator('.time-entry[data-index="10"] .planned-input').click();
            await assertDropdownOpen(page);
            await dragChip(page, 'Work', 'Study', 'after');
            await dragChip(page, 'Study', 'Work', 'before');
            await dragChip(page, 'Plan', 'Work', 'center');
            await page.locator('.activity-chip-caret[data-activity-id="Work"], .activity-chip-caret[data-activity-id="work"]').first().click();
            await page.waitForSelector('.inline-plan-sub-board .activity-chip');
            await dragChip(page, 'Deep', 'Review', 'after');
            await dragChip(page, 'Work', 'Work', 'center');
            const work = await chipCenter(page, 'Work');
            await page.mouse.move(work.x, work.y);
            await page.mouse.down();
            await page.mouse.up();
            await page.waitForTimeout(40);
            await assertNoDragLeaks(page);
            await dragChip(page, 'Review', 'Study', 'center');
            await page.evaluate(() => tracker.renderInlinePlanDropdownOptions());
            await page.waitForSelector('.activity-chip');
            await assertNoDragLeaks(page);
            await dragChip(page, 'Deep', 'Work', 'before');
            await dragChip(page, 'Study', 'Deep', 'after');
            await assertNoAppErrors(errors);
        } finally {
            await context.close();
            await browser.close();
        }
    });
});
