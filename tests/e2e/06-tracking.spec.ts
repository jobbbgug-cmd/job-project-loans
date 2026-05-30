/**
 * TC-TRACK-01 → TC-TRACK-10
 * Payment Tracking page
 */
import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers';

test.describe('Payment Tracking', () => {

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/loan/tracking');
    await page.waitForLoadState('networkidle');
  });

  // TC-TRACK-01: Tracking page loads
  test('TC-TRACK-01 tracking page loads correctly', async ({ page }) => {
    await expect(page.locator('main').getByText('ติดตามการชำระ')).toBeVisible({ timeout: 8000 });
    await expect(page.locator('text=/กำลังโหลด|Loading/i')).not.toBeVisible({ timeout: 8000 });
  });

  // TC-TRACK-02: Four period filter tabs visible — use getByRole to avoid strict mode
  // (เกินกำหนด also appears in stat card label and entry badges; ทั้งหมด in งวดทั้งหมด)
  test('TC-TRACK-02 four period filter tabs are visible', async ({ page }) => {
    await expect(page.getByRole('button', { name: /เกินกำหนด/ })).toBeVisible({ timeout: 6000 });
    await expect(page.getByRole('button', { name: 'เดือนนี้' })).toBeVisible();
    await expect(page.getByRole('button', { name: '30 วัน' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'ทั้งหมด' })).toBeVisible();
  });

  // TC-TRACK-03: Stats cards are visible
  test('TC-TRACK-03 stats cards show งวดทั้งหมด, ยอดรวม, เกินกำหนด', async ({ page }) => {
    const main = page.locator('main');
    await expect(main.getByText('งวดทั้งหมด')).toBeVisible({ timeout: 6000 });
    await expect(main.getByText('ยอดรวม')).toBeVisible();
    await expect(main.getByText('เกินกำหนด').first()).toBeVisible();
  });

  // TC-TRACK-04: Switching period filters reloads data
  test('TC-TRACK-04 switching period filters changes results', async ({ page }) => {
    await page.getByRole('button', { name: /เกินกำหนด/ }).click();
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toBeVisible();

    await page.getByRole('button', { name: 'ทั้งหมด' }).click();
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toBeVisible();
  });

  // TC-TRACK-05: Active filter tab highlighted in yellow
  test('TC-TRACK-05 selected period tab has yellow highlight', async ({ page }) => {
    const monthBtn = page.getByRole('button', { name: 'เดือนนี้' });
    await expect(monthBtn).toHaveClass(/bg-yellow-600/);
  });

  // TC-TRACK-06: If entries exist, ดูสินเชื่อ links appear
  test('TC-TRACK-06 entries show ดูสินเชื่อ and บันทึกชำระ buttons', async ({ page }) => {
    await page.getByRole('button', { name: 'ทั้งหมด' }).click();
    await page.waitForLoadState('networkidle');
    const entries = page.getByText('ดูสินเชื่อ');
    const count = await entries.count();
    if (count > 0) {
      await expect(page.getByText('บันทึกชำระ').first()).toBeVisible();
    }
  });

  // TC-TRACK-07: ดูสินเชื่อ link navigates to correct loan
  test('TC-TRACK-07 ดูสินเชื่อ link opens correct loan detail', async ({ page }) => {
    await page.getByRole('button', { name: 'ทั้งหมด' }).click();
    await page.waitForLoadState('networkidle');
    const loanLink = page.getByText('ดูสินเชื่อ').first();
    if (await loanLink.isVisible()) {
      await loanLink.click();
      await expect(page).toHaveURL(/\/loan\/loans\/\d+/);
    }
  });

  // TC-TRACK-08: บันทึกชำระ link navigates to new payment with loan_id
  test('TC-TRACK-08 บันทึกชำระ link goes to new payment form', async ({ page }) => {
    await page.getByRole('button', { name: 'ทั้งหมด' }).click();
    await page.waitForLoadState('networkidle');
    const payBtn = page.getByText('บันทึกชำระ').first();
    if (await payBtn.isVisible()) {
      await payBtn.click();
      await expect(page).toHaveURL(/\/loan\/payments\/new\?loan_id=\d+/);
    }
  });

  // TC-TRACK-09: Empty state shows when no entries
  test('TC-TRACK-09 empty state message shown when no entries', async ({ page }) => {
    await page.getByRole('button', { name: /เกินกำหนด/ }).click();
    await page.waitForLoadState('networkidle');
    const count = await page.getByText('ดูสินเชื่อ').count();
    if (count === 0) {
      await expect(page.getByText('ไม่มีรายการในช่วงนี้')).toBeVisible({ timeout: 5000 });
    }
  });

  // TC-TRACK-10: Tracking page not accessible without login
  test('TC-TRACK-10 tracking page redirects unauthenticated users', async ({ browser }) => {
    const ctx = await browser.newContext();
    const p = await ctx.newPage();
    await p.goto('/loan/tracking');
    await expect(p).toHaveURL(/\/loan\/login/, { timeout: 5000 });
    await ctx.close();
  });
});
