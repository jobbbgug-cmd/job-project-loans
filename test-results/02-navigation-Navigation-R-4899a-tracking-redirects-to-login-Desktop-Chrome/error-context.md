# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: 02-navigation.spec.ts >> Navigation & RBAC >> TC-NAV-09 unauthenticated access to tracking redirects to login
- Location: tests/e2e/02-navigation.spec.ts:107:7

# Error details

```
Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:3000/loan/tracking
Call log:
  - navigating to "http://localhost:3000/loan/tracking", waiting until "load"

```

# Test source

```ts
  8   | async function openSidebar(page: Page) {
  9   |   // Sidebar text labels only render when sidebarOpen=true (React state).
  10  |   // On desktop the useEffect fires after mount; give it a moment then force-expand if needed.
  11  |   const textSpan = page.locator('nav a span').first();
  12  |   const visible = await textSpan.isVisible({ timeout: 2000 }).catch(() => false);
  13  |   if (!visible) {
  14  |     // Collapsed — click hamburger to expand
  15  |     await page.locator('header button').first().click();
  16  |     await page.waitForTimeout(500);
  17  |   }
  18  | }
  19  | 
  20  | test.describe('Navigation & RBAC', () => {
  21  | 
  22  |   // TC-NAV-01: Admin sees all nav items
  23  |   test('TC-NAV-01 admin sees all nav items', async ({ page }) => {
  24  |     await loginAsAdmin(page);
  25  |     await openSidebar(page);
  26  |     const sidebar = page.locator('aside nav');
  27  |     for (const label of ['แดชบอร์ด', 'สินเชื่อ', 'การชำระ', 'ติดตาม', 'ลูกค้า', 'ผู้ใช้งาน', 'แยกข้อมูล']) {
  28  |       await expect(sidebar.getByText(label)).toBeVisible({ timeout: 5000 });
  29  |     }
  30  |   });
  31  | 
  32  |   // TC-NAV-02: All admin links navigate correctly
  33  |   test('TC-NAV-02 admin nav links navigate to correct pages', async ({ page }) => {
  34  |     await loginAsAdmin(page);
  35  |     const links: [string, RegExp][] = [
  36  |       ['แดชบอร์ด', /\/loan\/dashboard/],
  37  |       ['สินเชื่อ',  /\/loan\/loans/],
  38  |       ['การชำระ',  /\/loan\/payments/],
  39  |       ['ติดตาม',   /\/loan\/tracking/],
  40  |       ['ลูกค้า',   /\/loan\/customers/],
  41  |       ['ผู้ใช้งาน', /\/loan\/users/],
  42  |     ];
  43  |     for (const [label, urlPattern] of links) {
  44  |       await openSidebar(page);
  45  |       await page.locator('aside nav').getByText(label).click();
  46  |       await expect(page).toHaveURL(urlPattern, { timeout: 8000 });
  47  |     }
  48  |   });
  49  | 
  50  |   // TC-NAV-03: Active nav item is highlighted
  51  |   test('TC-NAV-03 active nav item has yellow highlight', async ({ page }) => {
  52  |     await loginAsAdmin(page);
  53  |     await page.goto('/loan/loans');
  54  |     await openSidebar(page);
  55  |     const activeLink = page.locator('aside nav a').filter({ hasText: 'สินเชื่อ' });
  56  |     await expect(activeLink).toHaveClass(/bg-yellow-600/, { timeout: 5000 });
  57  |   });
  58  | 
  59  |   // TC-NAV-04: Back navigation works
  60  |   test('TC-NAV-04 back arrow on detail page returns to list', async ({ page }) => {
  61  |     await loginAsAdmin(page);
  62  |     await page.goto('/loan/loans');
  63  |     const firstLoan = page.locator('table tbody tr').first().locator('a').last();
  64  |     if (await firstLoan.isVisible()) {
  65  |       await firstLoan.click();
  66  |       await expect(page).toHaveURL(/\/loan\/loans\/\d+/);
  67  |       await page.locator('a[href="/loan/loans"]').first().click();
  68  |       await expect(page).toHaveURL(/\/loan\/loans$/);
  69  |     }
  70  |   });
  71  | 
  72  |   // TC-NAV-05: Invalid URL shows 404 or redirects gracefully
  73  |   test('TC-NAV-05 invalid URL does not crash app', async ({ page }) => {
  74  |     await loginAsAdmin(page);
  75  |     const res = await page.goto('/loan/this-page-does-not-exist-xyz');
  76  |     // Should either be 404 or redirect — not 500
  77  |     expect(res?.status()).not.toBe(500);
  78  |   });
  79  | 
  80  |   // TC-NAV-06: Direct URL to non-existent loan returns error gracefully
  81  |   test('TC-NAV-06 non-existent loan ID shows not-found message', async ({ page }) => {
  82  |     await loginAsAdmin(page);
  83  |     await page.goto('/loan/loans/999999');
  84  |     await expect(page.getByText(/ไม่พบ|not found/i)).toBeVisible({ timeout: 6000 });
  85  |   });
  86  | 
  87  |   // TC-NAV-07: Mobile sidebar opens and closes
  88  |   test('TC-NAV-07 mobile hamburger toggles sidebar', async ({ page }) => {
  89  |     await page.setViewportSize({ width: 375, height: 812 });
  90  |     await loginAsAdmin(page);
  91  |     const hamburger = page.locator('header button').first();
  92  |     // Sidebar starts closed on mobile
  93  |     await hamburger.click();
  94  |     await expect(page.getByText('แดชบอร์ด')).toBeVisible({ timeout: 3000 });
  95  |     // Clicking backdrop closes it
  96  |     await page.locator('.fixed.inset-0').click({ force: true });
  97  |     await expect(page.getByText('แดชบอร์ด')).not.toBeVisible({ timeout: 3000 });
  98  |   });
  99  | 
  100 |   // TC-NAV-08: Unauthenticated access to admin pages blocked
  101 |   test('TC-NAV-08 unauthenticated access to users page redirects to login', async ({ page }) => {
  102 |     await page.goto('/loan/users');
  103 |     await expect(page).toHaveURL(/\/loan\/login/, { timeout: 5000 });
  104 |   });
  105 | 
  106 |   // TC-NAV-09: Unauthenticated access to tracking page redirects to login
  107 |   test('TC-NAV-09 unauthenticated access to tracking redirects to login', async ({ page }) => {
> 108 |     await page.goto('/loan/tracking');
      |                ^ Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:3000/loan/tracking
  109 |     await expect(page).toHaveURL(/\/loan\/login/, { timeout: 5000 });
  110 |   });
  111 | });
  112 | 
```