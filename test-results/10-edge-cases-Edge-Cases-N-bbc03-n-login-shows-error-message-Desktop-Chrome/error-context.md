# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: 10-edge-cases.spec.ts >> Edge Cases & Negative Tests >> TC-EDGE-06 network error on login shows error message
- Location: tests/e2e/10-edge-cases.spec.ts:64:7

# Error details

```
Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:3000/loan/login
Call log:
  - navigating to "http://localhost:3000/loan/login", waiting until "load"

```

# Test source

```ts
  1   | /**
  2   |  * TC-EDGE-01 → TC-EDGE-10
  3   |  * Negative & edge cases
  4   |  */
  5   | import { test, expect } from '@playwright/test';
  6   | import { loginAsAdmin } from './helpers';
  7   | 
  8   | test.describe('Edge Cases & Negative Tests', () => {
  9   | 
  10  |   // TC-EDGE-01: Rapid clicking approve does not double-submit
  11  |   test('TC-EDGE-01 rapid double-click on form submit does not duplicate submission', async ({ page }) => {
  12  |     await loginAsAdmin(page);
  13  |     await page.goto('/loan/payments/new');
  14  |     await page.waitForLoadState('networkidle');
  15  |     const btn = page.locator('button[type="submit"]');
  16  |     // Click twice rapidly — button should be disabled after first click
  17  |     await btn.click();
  18  |     await btn.click({ force: true });
  19  |     // Should still be on same page (empty form, blocked by validation)
  20  |     await page.waitForTimeout(500);
  21  |     await expect(page).toHaveURL(/\/loan\/payments\/new/);
  22  |   });
  23  | 
  24  |   // TC-EDGE-02: Very large loan ID in URL
  25  |   test('TC-EDGE-02 very large loan ID returns not-found gracefully', async ({ page }) => {
  26  |     await loginAsAdmin(page);
  27  |     await page.goto('/loan/loans/9999999999');
  28  |     await expect(page.getByText(/ไม่พบ|not found/i)).toBeVisible({ timeout: 6000 });
  29  |     await expect(page.locator('body')).toBeVisible();
  30  |   });
  31  | 
  32  |   // TC-EDGE-03: Non-numeric loan ID in URL
  33  |   test('TC-EDGE-03 non-numeric loan ID handled gracefully', async ({ page }) => {
  34  |     await loginAsAdmin(page);
  35  |     await page.goto('/loan/loans/abc-xyz');
  36  |     // Should show not-found or redirect — not crash
  37  |     await page.waitForLoadState('networkidle');
  38  |     await expect(page.locator('body')).toBeVisible();
  39  |     const text = await page.locator('body').textContent();
  40  |     expect(text).not.toContain('Internal Server Error');
  41  |   });
  42  | 
  43  |   // TC-EDGE-04: API returns 500 — page shows error not crash
  44  |   test('TC-EDGE-04 simulated API error on payments page shows error gracefully', async ({ page }) => {
  45  |     await loginAsAdmin(page);
  46  |     await page.route('/api/loan/payments*', route => route.fulfill({ status: 500, body: '{"error":"server error"}' }));
  47  |     await page.goto('/loan/payments');
  48  |     await page.waitForLoadState('networkidle');
  49  |     // Page must not be blank — some fallback should render
  50  |     const text = await page.locator('body').textContent();
  51  |     expect(text?.length).toBeGreaterThan(10);
  52  |   });
  53  | 
  54  |   // TC-EDGE-05: API returns empty array — empty state shown
  55  |   test('TC-EDGE-05 empty API response shows empty-state message', async ({ page }) => {
  56  |     await loginAsAdmin(page);
  57  |     await page.route('/api/loan/tracking*', route => route.fulfill({ status: 200, body: '[]', contentType: 'application/json' }));
  58  |     await page.goto('/loan/tracking');
  59  |     await page.waitForLoadState('networkidle');
  60  |     await expect(page.getByText('ไม่มีรายการในช่วงนี้')).toBeVisible({ timeout: 5000 });
  61  |   });
  62  | 
  63  |   // TC-EDGE-06: Network timeout on login — error shown
  64  |   test('TC-EDGE-06 network error on login shows error message', async ({ page }) => {
  65  |     await page.route('/api/loan/auth/login', route => route.abort('failed'));
> 66  |     await page.goto('/loan/login');
      |                ^ Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:3000/loan/login
  67  |     await page.locator('input[type="email"]').fill('admin@loanapp.com');
  68  |     await page.locator('input[type="password"]').fill('Admin@1234');
  69  |     await page.locator('button[type="submit"]').click();
  70  |     // Should stay on login — not navigate away
  71  |     await page.waitForTimeout(2000);
  72  |     await expect(page).toHaveURL(/\/loan\/login/);
  73  |   });
  74  | 
  75  |   // TC-EDGE-07: Malformed JSON response handled
  76  |   test('TC-EDGE-07 malformed API response does not crash the app', async ({ page }) => {
  77  |     await loginAsAdmin(page);
  78  |     await page.route('/api/loan/loans', route => route.fulfill({ status: 200, body: 'not-json' }));
  79  |     await page.goto('/loan/loans');
  80  |     await page.waitForLoadState('networkidle');
  81  |     // Should not show "Application error"
  82  |     const text = await page.locator('body').textContent();
  83  |     expect(text).not.toContain('Application error');
  84  |   });
  85  | 
  86  |   // TC-EDGE-08: Concurrent navigation does not cause duplicate fetches or crashes
  87  |   test('TC-EDGE-08 rapidly switching pages does not crash', async ({ page }) => {
  88  |     await loginAsAdmin(page);
  89  |     for (const path of ['/loan/loans', '/loan/payments', '/loan/tracking', '/loan/dashboard']) {
  90  |       await page.goto(path);
  91  |     }
  92  |     await page.waitForLoadState('networkidle');
  93  |     await expect(page.locator('body')).toBeVisible();
  94  |   });
  95  | 
  96  |   // TC-EDGE-09: Session expiry mid-session shows login redirect
  97  |   test('TC-EDGE-09 clearing auth cookie redirects to login', async ({ page }) => {
  98  |     await loginAsAdmin(page);
  99  |     // Delete auth cookie to simulate expiry
  100 |     await page.context().clearCookies();
  101 |     await page.goto('/loan/dashboard');
  102 |     await expect(page).toHaveURL(/\/loan\/login/, { timeout: 6000 });
  103 |   });
  104 | 
  105 |   // TC-EDGE-10: Back button after logout does not expose protected content
  106 |   test('TC-EDGE-10 back-button after logout shows login not protected page', async ({ page }) => {
  107 |     await loginAsAdmin(page);
  108 |     await page.goto('/loan/loans');
  109 |     // Logout
  110 |     const logoutBtn = page.getByText('ออกจากระบบ');
  111 |     if (!await logoutBtn.isVisible()) {
  112 |       await page.locator('header button').first().click();
  113 |     }
  114 |     await logoutBtn.click();
  115 |     await expect(page).toHaveURL(/\/loan\/login/, { timeout: 6000 });
  116 |     // Go back
  117 |     await page.goBack();
  118 |     // Should redirect to login again
  119 |     await page.waitForTimeout(1000);
  120 |     const url = page.url();
  121 |     // Either still on login or was redirected back to login
  122 |     const isProtected = url.includes('/loan/loans') && !url.includes('/loan/login');
  123 |     if (isProtected) {
  124 |       // Verify it redirects when trying to access API
  125 |       const resp = await page.goto('/loan/loans');
  126 |       await expect(page).toHaveURL(/\/loan\/login/, { timeout: 5000 });
  127 |     }
  128 |   });
  129 | });
  130 | 
```