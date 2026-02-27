import { test, expect } from '@playwright/test';

test.describe('actual modal locked row auto generation', () => {
    test('creates exactly one locked row when tail units are forced off', async ({ page }) => {
        await page.goto('http://localhost:8000/');

        const entry = page.locator('.time-entry').first();
        await entry.locator('.activity-log-btn').click();

        const modal = page.locator('#activityLogModal');
        await expect(modal).toBeVisible();

        // Pick the first assign spinner and reduce assigned time to force locked tail units.
        const firstAssign = modal.locator('#actualActivitiesList .actual-assign-input').first();
        await expect(firstAssign).toBeVisible();
        await firstAssign.fill('00:20');
        await firstAssign.blur();

        const rows = modal.locator('#actualActivitiesList .sub-activity-row');
        await expect(rows).toHaveCount(2);

        const lockedRow = rows.filter({ has: modal.locator('.actual-assign-input[value="00:40"]') }).first();
        await expect(lockedRow).toBeVisible();
        await expect(lockedRow.locator('.actual-activity-label')).toHaveClass(/empty/);
        await expect(lockedRow.locator('.actual-assign-input')).toHaveValue('00:40');
        await expect(lockedRow.locator('.actual-grid-input')).toHaveValue('00:40');

        // Re-apply the same value to verify idempotency (no extra locked row growth).
        await firstAssign.fill('00:20');
        await firstAssign.blur();
        await expect(rows).toHaveCount(2);
    });
});
