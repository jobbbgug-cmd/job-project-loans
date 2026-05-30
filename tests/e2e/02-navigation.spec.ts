/**
 * TC-NAV-01 → TC-NAV-12
 * Navigation, sidebar, RBAC menu visibility
 */
import { test, expect, Page } from '@playwright/test';
import { loginAsAdmin, loginAs, ADMIN } from './helpers';

async function openSidebar(page: Page) {
  // Sidebar text labels only render when sidebarOpen=true (React state).
  // On desktop the useEffect fires after mount; give it a moment then force-expand if needed.
  const textSpan = page.locator('nav a span').first();
  const visible = await textSpan.isVisible({ timeout: 2000 }).catch(() => false);
  if (!visible) {
    // Collapsed — click hamburger to expand
    await page.locator('header button').first().click();
    await page.waitForTimeout(500);
  }
}

test.describe('Navigation & RBAC', () => {

  // TC-NAV-01: Admin sees all nav items
  test('TC-NAV-01 admin sees all nav items', async ({ page }) => {
    await loginAsAdmin(page);
    await openSidebar(page);
    const sidebar = page.locator('aside nav');
    for (const label of ['แดชบอร์ด', 'สินเชื่อ', 'การชำระ', 'ติดตาม', 'ลูกค้า', 'ผู้ใช้งาน', 'แยกข้อมูล']) {
      await expect(sidebar.getByText(label)).toBeVisible({ timeout: 5000 });
    }
  });

  // TC-NAV-02: All admin links navigate correctly
  test('TC-NAV-02 admin nav links navigate to correct pages', async ({ page }) => {
    await loginAsAdmin(page);
    const links: [string, RegExp][] = [
      ['แดชบอร์ด', /\/loan\/dashboard/],
      ['สินเชื่อ',  /\/loan\/loans/],
      ['การชำระ',  /\/loan\/payments/],
      ['ติดตาม',   /\/loan\/tracking/],
      ['ลูกค้า',   /\/loan\/customers/],
      ['ผู้ใช้งาน', /\/loan\/users/],
    ];
    for (const [label, urlPattern] of links) {
      await openSidebar(page);
      await page.locator('aside nav').getByText(label).click();
      await expect(page).toHaveURL(urlPattern, { timeout: 8000 });
    }
  });

  // TC-NAV-03: Active nav item is highlighted
  test('TC-NAV-03 active nav item has yellow highlight', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/loan/loans');
    await openSidebar(page);
    const activeLink = page.locator('aside nav a').filter({ hasText: 'สินเชื่อ' });
    await expect(activeLink).toHaveClass(/bg-yellow-600/, { timeout: 5000 });
  });

  // TC-NAV-04: Back navigation works
  test('TC-NAV-04 back arrow on detail page returns to list', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/loan/loans');
    const firstLoan = page.locator('table tbody tr').first().locator('a').last();
    if (await firstLoan.isVisible()) {
      await firstLoan.click();
      await expect(page).toHaveURL(/\/loan\/loans\/\d+/);
      await page.locator('a[href="/loan/loans"]').first().click();
      await expect(page).toHaveURL(/\/loan\/loans$/);
    }
  });

  // TC-NAV-05: Invalid URL shows 404 or redirects gracefully
  test('TC-NAV-05 invalid URL does not crash app', async ({ page }) => {
    await loginAsAdmin(page);
    const res = await page.goto('/loan/this-page-does-not-exist-xyz');
    // Should either be 404 or redirect — not 500
    expect(res?.status()).not.toBe(500);
  });

  // TC-NAV-06: Direct URL to non-existent loan returns error gracefully
  test('TC-NAV-06 non-existent loan ID shows not-found message', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/loan/loans/999999');
    await expect(page.getByText(/ไม่พบ|not found/i)).toBeVisible({ timeout: 6000 });
  });

  // TC-NAV-07: Mobile sidebar opens and closes
  test('TC-NAV-07 mobile hamburger toggles sidebar', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await loginAsAdmin(page);
    const hamburger = page.locator('header button').first();
    // Sidebar starts closed on mobile
    await hamburger.click();
    await expect(page.getByText('แดชบอร์ด')).toBeVisible({ timeout: 3000 });
    // Clicking backdrop closes it
    await page.locator('.fixed.inset-0').click({ force: true });
    await expect(page.getByText('แดชบอร์ด')).not.toBeVisible({ timeout: 3000 });
  });

  // TC-NAV-08: Unauthenticated access to admin pages blocked
  test('TC-NAV-08 unauthenticated access to users page redirects to login', async ({ page }) => {
    await page.goto('/loan/users');
    await expect(page).toHaveURL(/\/loan\/login/, { timeout: 5000 });
  });

  // TC-NAV-09: Unauthenticated access to tracking page redirects to login
  test('TC-NAV-09 unauthenticated access to tracking redirects to login', async ({ page }) => {
    await page.goto('/loan/tracking');
    await expect(page).toHaveURL(/\/loan\/login/, { timeout: 5000 });
  });
});
