# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: 04-loans.spec.ts >> Loans >> TC-LOAN-11 loans list shows total count
- Location: tests/e2e/04-loans.spec.ts:116:7

# Error details

```
Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:3000/loan/login
Call log:
  - navigating to "http://localhost:3000/loan/login", waiting until "load"

```

# Test source

```ts
  1  | import { Page } from '@playwright/test';
  2  | 
  3  | export const ADMIN = { email: 'admin@loanapp.com', password: 'Admin@1234' };
  4  | 
  5  | export const BASE = 'http://localhost:3000';
  6  | export const LOAN_BASE = `${BASE}/loan`;
  7  | 
  8  | export async function loginAs(page: Page, email: string, password: string) {
> 9  |   await page.goto('/loan/login');
     |              ^ Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:3000/loan/login
  10 |   await page.locator('input[type="email"]').fill(email);
  11 |   await page.locator('input[type="password"]').fill(password);
  12 |   await page.locator('button[type="submit"]').click();
  13 |   // Wait until we land somewhere that is NOT /loan/login
  14 |   await page.waitForURL(url => !url.pathname.endsWith('/loan/login'), { timeout: 10000 });
  15 |   // Wait for sidebar React effect (sets sidebarOpen on desktop) — text spans appear after mount
  16 |   await page.locator('nav a span').first().waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
  17 | }
  18 | 
  19 | export async function loginAsAdmin(page: Page) {
  20 |   await loginAs(page, ADMIN.email, ADMIN.password);
  21 | }
  22 | 
  23 | export async function logout(page: Page) {
  24 |   await page.getByText('ออกจากระบบ').click();
  25 |   await page.waitForURL('**/loan/login');
  26 | }
  27 | 
```