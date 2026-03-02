import { test, expect } from '@playwright/test';

const LONG_PRESS_TIMEOUT = 420;

async function longPressByMouse(page, locator) {
  const segment = locator.first();
  const box = await segment.boundingBox();
  if (!box) return;
  const x = box.x + (box.width / 2);
  const y = box.y + (box.height / 2);
  await segment.scrollIntoViewIfNeeded();
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.waitForTimeout(LONG_PRESS_TIMEOUT);
  await page.mouse.up();
}

async function longPressByTouch(page, locator) {
  const segment = locator.first();
  const box = await segment.boundingBox();
  if (!box) return;
  const x = box.x + (box.width / 2);
  const y = box.y + (box.height / 2);
  await segment.scrollIntoViewIfNeeded();

  const handle = await segment.elementHandle();
  if (!handle) return;

  await handle.dispatchEvent('touchstart', {
    touches: [{ identifier: 1, clientX: x, clientY: y, pageX: x, pageY: y }],
  });
  await page.waitForTimeout(LONG_PRESS_TIMEOUT);
  await handle.dispatchEvent('touchend', {
    touches: [],
    changedTouches: [{ identifier: 1, clientX: x, clientY: y, pageX: x, pageY: y }],
  });
}

async function openActivityModalForFirstRow(page) {
  const entry = page.locator('.time-entry').first();
  const floatingBtn = page.locator('.activity-log-btn.activity-log-btn-floating').first();
  if (await floatingBtn.count()) {
    await floatingBtn.click({ force: true });
  } else {
    await entry.locator('.activity-log-btn').click({ force: true });
  }
  const modal = page.locator('#activityLogModal');
  await expect(modal).toBeVisible();
  return modal;
}

async function waitLockedCount(page, expected) {
  const modal = await openActivityModalForFirstRow(page);
  await expect(await modal.locator('.sub-activity-row.actual-row-locked').count()).toBeGreaterThanOrEqual(expected);
  await page.locator('#closeActivityModal').click();
}

async function seedActualGridForLongPress(page) {
  await page.evaluate(() => {
    const tracker = window.tracker;
    if (!tracker || !Array.isArray(tracker.timeSlots) || !tracker.timeSlots[0]) {
      throw new Error('tracker not ready');
    }

    const firstSlot = tracker.timeSlots[0];
    firstSlot.planned = 'A';
    firstSlot.planTitle = 'A';
    firstSlot.planTitleBandOn = false;
    firstSlot.planActivities = [{ label: 'A', seconds: 7200 }];

    if (tracker.mergedFields && typeof tracker.mergedFields.set === 'function') {
      tracker.mergedFields.set('actual-0-1', '');
    }

    tracker.renderTimeEntries(true);
    tracker.calculateTotals();
    tracker.autoSave();
  });
}

async function seedActualGridWithTwoActivities(page) {
  await page.evaluate(() => {
    const tracker = window.tracker;
    if (!tracker || !Array.isArray(tracker.timeSlots) || !tracker.timeSlots[0]) {
      throw new Error('tracker not ready');
    }

    const firstSlot = tracker.timeSlots[0];
    firstSlot.planned = 'A';
    firstSlot.planTitle = 'A';
    firstSlot.planTitleBandOn = false;
    firstSlot.planActivities = [
      { label: 'A', seconds: 1800 },
      { label: 'B', seconds: 1800 },
    ];

    if (tracker.mergedFields && typeof tracker.mergedFields.delete === 'function') {
      tracker.mergedFields.delete('actual-0-1');
    }

    tracker.renderTimeEntries(true);
    tracker.calculateTotals();
    tracker.autoSave();
  });
}

test.describe('actual grid long-press lock', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:8000/');
    await page.evaluate(() => {
      try {
        localStorage.clear();
      } catch (_) {}
    });
    await page.reload();
  });

  test('adds manual locked units by long-press and keeps row readonly in modal', async ({ page }) => {
    await seedActualGridForLongPress(page);
    const entry = page.locator('.time-entry').first();
    const grid = entry.locator('.split-visualization-actual .split-grid');
    await expect(grid).toBeVisible();

    const firstSegment = grid.locator('.split-grid-segment').nth(0);
    const secondSegment = grid.locator('.split-grid-segment').nth(2);
    const thirdSegment = grid.locator('.split-grid-segment').nth(4);
    await expect(firstSegment).not.toHaveClass(/is-locked/);
    await expect(secondSegment).not.toHaveClass(/is-locked/);

    await longPressByMouse(page, firstSegment);
    await expect(firstSegment).toHaveClass(/is-locked/);

    await longPressByMouse(page, secondSegment);
    await expect(secondSegment).toHaveClass(/is-locked/);

    const modal = await openActivityModalForFirstRow(page);
    const lockedRows = modal.locator('.sub-activity-row.actual-row-locked');
    const lockedCountAfterTwo = await lockedRows.count();
    await expect(lockedCountAfterTwo).toBeGreaterThanOrEqual(2);

    const firstLockedRow = lockedRows.nth(0);
    await expect(firstLockedRow.locator('.actual-grid-input')).toBeDisabled();
    await expect(firstLockedRow.locator('.actual-assign-input')).toBeDisabled();
    await expect(firstLockedRow.locator('.actual-move-btn').nth(0)).toBeDisabled();
    await expect(firstLockedRow.locator('.actual-move-btn').nth(1)).toBeDisabled();
    await expect(firstLockedRow.locator('.actual-remove-btn')).toBeDisabled();
    await page.locator('#closeActivityModal').click();

    await longPressByMouse(page, thirdSegment);
    await expect(thirdSegment).toHaveClass(/is-locked/);

    await waitLockedCount(page, 3);
  });

  test('supports touch long-press and ignores long-press cancellation on move', async ({ page }) => {
    await seedActualGridForLongPress(page);
    const entry = page.locator('.time-entry').first();
    const segment = entry.locator('.split-visualization-actual .split-grid .split-grid-segment').nth(3);
    const moveTarget = entry.locator('.split-visualization-actual .split-grid .split-grid-segment').nth(6);

    await longPressByTouch(page, segment);
    await expect(segment).toHaveClass(/is-locked/);

    await expect(moveTarget).not.toHaveClass(/is-locked/);
    await moveTarget.scrollIntoViewIfNeeded();
    const moveTargetBox = await moveTarget.boundingBox();
    if (!moveTargetBox) return;

    const x = moveTargetBox.x + (moveTargetBox.width / 2);
    const y = moveTargetBox.y + (moveTargetBox.height / 2);
    const handle = await moveTarget.elementHandle();
    if (!handle) return;

    await handle.dispatchEvent('touchstart', {
      touches: [{ identifier: 2, clientX: x, clientY: y, pageX: x, pageY: y }],
    });
    await page.waitForTimeout(50);
    await handle.dispatchEvent('touchmove', {
      touches: [{ identifier: 2, clientX: x + 30, clientY: y + 30, pageX: x + 30, pageY: y + 30 }],
    });
    await page.waitForTimeout(20);
    await handle.dispatchEvent('touchend', {
      touches: [],
      changedTouches: [{ identifier: 2, clientX: x + 30, clientY: y + 30, pageX: x + 30, pageY: y + 30 }],
    });
    await expect(moveTarget).not.toHaveClass(/is-locked/);
  });

  test('context menu does not open after long press', async ({ page }) => {
    await seedActualGridForLongPress(page);
    const entry = page.locator('.time-entry').first();
    const segment = entry.locator('.split-visualization-actual .split-grid .split-grid-segment').nth(1);

    await longPressByMouse(page, segment);
    await page.waitForTimeout(LONG_PRESS_TIMEOUT + 80);
    await expect(page.locator('#activityLogModal')).not.toBeVisible();
  });

  test('manual lock stays on activity 1 when clicking activity 2 grid and keeps row order', async ({ page }) => {
    await seedActualGridWithTwoActivities(page);
    const entry = page.locator('.time-entry').first();
    const grid = entry.locator('.split-visualization-actual .split-grid');
    await expect(grid).toBeVisible();

    const activity1Unit = grid.locator('.split-grid-segment[data-unit-index="0"]');
    const activity2Unit = grid.locator('.split-grid-segment[data-unit-index="3"]');

    await longPressByMouse(page, activity1Unit);
    await expect(activity1Unit).toHaveClass(/is-locked/);

    await activity2Unit.click();
    await expect(activity1Unit).toHaveClass(/is-locked/);

    const modal = await openActivityModalForFirstRow(page);
    const rows = modal.locator('.sub-activity-row');
    const rowInfo = await rows.evaluateAll((nodes) => {
      return nodes.map((row) => ({
        locked: row.classList.contains('actual-row-locked'),
        label: (row.querySelector('.actual-activity-label')?.textContent || '').trim(),
      }));
    });
    const aIndex = rowInfo.findIndex((row) => row.label === 'A');
    const bIndex = rowInfo.findIndex((row) => row.label === 'B');
    const lockedIndex = rowInfo.findIndex((row) => row.locked);
    expect(aIndex).toBeGreaterThanOrEqual(0);
    expect(bIndex).toBeGreaterThanOrEqual(0);
    expect(lockedIndex).toBeGreaterThanOrEqual(0);
    expect(aIndex).toBeLessThan(lockedIndex);
    expect(lockedIndex).toBeLessThan(bIndex);
    await page.locator('#closeActivityModal').click();
  });
});
