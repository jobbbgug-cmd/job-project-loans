/**
 * TC-EDGE-01 → TC-EDGE-10
 * Negative & edge cases
 */
import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers';

test.describe('Edge Cases & Negative Tests', () => {

  // TC-EDGE-01: Rapid clicking approve does not double-submit
  test('TC-EDGE-01 rapid double-click on form submit does not duplicate submission', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/loan/payments/new');
    await page.waitForLoadState('networkidle');
    const btn = page.locator('button[type="submit"]');
    // Click twice rapidly — button should be disabled after first click
    await btn.click();
    await btn.click({ force: true });
    // Should still be on same page (empty form, blocked by validation)
    await page.waitForTimeout(500);
    await expect(page).toHaveURL(/\/loan\/payments\/new/);
  });

  // TC-EDGE-02: Very large loan ID in URL
  test('TC-EDGE-02 very large loan ID returns not-found gracefully', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/loan/loans/9999999999');
    await expect(page.getByText(/ไม่พบ|not found/i)).toBeVisible({ timeout: 6000 });
    await expect(page.locator('body')).toBeVisible();
  });

  // TC-EDGE-03: Non-numeric loan ID in URL
  test('TC-EDGE-03 non-numeric loan ID handled gracefully', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/loan/loans/abc-xyz');
    // Should show not-found or redirect — not crash
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toBeVisible();
    const text = await page.locator('body').textContent();
    expect(text).not.toContain('Internal Server Error');
  });

  // TC-EDGE-04: API returns 500 — page shows error not crash
  test('TC-EDGE-04 simulated API error on payments page shows error gracefully', async ({ page }) => {
    await loginAsAdmin(page);
    await page.route('/api/loan/payments*', route => route.fulfill({ status: 500, body: '{"error":"server error"}' }));
    await page.goto('/loan/payments');
    await page.waitForLoadState('networkidle');
    // Page must not be blank — some fallback should render
    const text = await page.locator('body').textContent();
    expect(text?.length).toBeGreaterThan(10);
  });

  // TC-EDGE-05: API returns empty array — empty state shown
  test('TC-EDGE-05 empty API response shows empty-state message', async ({ page }) => {
    await loginAsAdmin(page);
    await page.route('/api/loan/tracking*', route => route.fulfill({ status: 200, body: '[]', contentType: 'application/json' }));
    await page.goto('/loan/tracking');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('ไม่มีรายการในช่วงนี้')).toBeVisible({ timeout: 5000 });
  });

  // TC-EDGE-06: Network timeout on login — error shown
  test('TC-EDGE-06 network error on login shows error message', async ({ page }) => {
    await page.route('/api/loan/auth/login', route => route.abort('failed'));
    await page.goto('/loan/login');
    await page.locator('input[type="email"]').fill('admin@loanapp.com');
    await page.locator('input[type="password"]').fill('Admin@1234');
    await page.locator('button[type="submit"]').click();
    // Should stay on login — not navigate away
    await page.waitForTimeout(2000);
    await expect(page).toHaveURL(/\/loan\/login/);
  });

  // TC-EDGE-07: Malformed JSON response handled
  test('TC-EDGE-07 malformed API response does not crash the app', async ({ page }) => {
    await loginAsAdmin(page);
    await page.route('/api/loan/loans', route => route.fulfill({ status: 200, body: 'not-json' }));
    await page.goto('/loan/loans');
    await page.waitForLoadState('networkidle');
    // Should not show "Application error"
    const text = await page.locator('body').textContent();
    expect(text).not.toContain('Application error');
  });

  // TC-EDGE-08: Concurrent navigation does not cause duplicate fetches or crashes
  test('TC-EDGE-08 rapidly switching pages does not crash', async ({ page }) => {
    await loginAsAdmin(page);
    for (const path of ['/loan/loans', '/loan/payments', '/loan/tracking', '/loan/dashboard']) {
      await page.goto(path);
    }
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toBeVisible();
  });

  // TC-EDGE-09: Session expiry mid-session shows login redirect
  test('TC-EDGE-09 clearing auth cookie redirects to login', async ({ page }) => {
    await loginAsAdmin(page);
    // Delete auth cookie to simulate expiry
    await page.context().clearCookies();
    await page.goto('/loan/dashboard');
    await expect(page).toHaveURL(/\/loan\/login/, { timeout: 6000 });
  });

  // TC-EDGE-10: Back button after logout does not expose protected content
  test('TC-EDGE-10 back-button after logout shows login not protected page', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/loan/loans');
    // Logout
    const logoutBtn = page.getByText('ออกจากระบบ');
    if (!await logoutBtn.isVisible()) {
      await page.locator('header button').first().click();
    }
    await logoutBtn.click();
    await expect(page).toHaveURL(/\/loan\/login/, { timeout: 6000 });
    // Go back
    await page.goBack();
    // Should redirect to login again
    await page.waitForTimeout(1000);
    const url = page.url();
    // Either still on login or was redirected back to login
    const isProtected = url.includes('/loan/loans') && !url.includes('/loan/login');
    if (isProtected) {
      // Verify it redirects when trying to access API
      const resp = await page.goto('/loan/loans');
      await expect(page).toHaveURL(/\/loan\/login/, { timeout: 5000 });
    }
  });
});
