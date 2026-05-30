/**
 * TC-DASH-01 → TC-DASH-08
 * Dashboard page
 */
import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers';

test.describe('Dashboard', () => {

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/loan/dashboard');
    await page.waitForLoadState('networkidle');
  });

  // TC-DASH-01: Dashboard loads without error
  test('TC-DASH-01 dashboard page loads successfully', async ({ page }) => {
    // Page title heading inside <main>, not the sidebar label
    await expect(page.locator('main').getByText(/แดชบอร์ด|Dashboard/i)).toBeVisible({ timeout: 8000 });
    await expect(page.locator('text=/กำลังโหลด|Loading/i')).not.toBeVisible({ timeout: 8000 });
  });

  // TC-DASH-02: Summary stat cards are visible
  test('TC-DASH-02 summary stat cards display', async ({ page }) => {
    await expect(page.getByText(/สินเชื่อทั้งหมด|Total Loans/i)).toBeVisible();
    await expect(page.getByText(/เงินต้นรวม|Total Principal/i)).toBeVisible();
    await expect(page.getByText(/ยอดเก็บได้รวม|Total Collected/i)).toBeVisible();
    await expect(page.getByText(/ยอดคงค้าง|Outstanding/i)).toBeVisible();
  });

  // TC-DASH-03: Pending payments section visible
  test('TC-DASH-03 pending payments section is visible', async ({ page }) => {
    await expect(page.getByText(/รอการยืนยัน|Pending Payments/i)).toBeVisible();
  });

  // TC-DASH-04: Monthly chart section renders
  test('TC-DASH-04 monthly chart section renders', async ({ page }) => {
    await expect(page.getByText(/ยอดเก็บรายเดือน|Monthly Collections/i)).toBeVisible();
  });

  // TC-DASH-05: No console errors on load
  test('TC-DASH-05 no critical console errors on dashboard', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await page.reload();
    await page.waitForLoadState('networkidle');
    const criticalErrors = errors.filter(e => !e.includes('favicon') && !e.includes('404'));
    expect(criticalErrors).toHaveLength(0);
  });

  // TC-DASH-06: Stat numbers are numeric values (not NaN/undefined)
  test('TC-DASH-06 stat card numbers are valid', async ({ page }) => {
    const cards = page.locator('.text-2xl, .text-3xl').filter({ hasText: /฿|\d/ });
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      const text = await cards.nth(i).textContent();
      expect(text).not.toContain('NaN');
      expect(text).not.toContain('undefined');
    }
  });

  // TC-DASH-07: Overdue installments section present
  test('TC-DASH-07 overdue installments section is present', async ({ page }) => {
    await expect(page.getByText(/งวดค้างชำระ|Overdue/i)).toBeVisible();
  });

  // TC-DASH-08: Loan status distribution section present
  test('TC-DASH-08 loan status distribution section is present', async ({ page }) => {
    await expect(page.getByText(/การกระจายสถานะ|Status Distribution/i)).toBeVisible();
  });
});
