# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: 07-customers-users.spec.ts >> Users (Admin only) >> TC-USER-06 role badges are displayed in user list
- Location: tests/e2e/07-customers-users.spec.ts:99:7

# Error details

```
TimeoutError: page.waitForURL: Timeout 10000ms exceeded.
=========================== logs ===========================
waiting for navigation until "load"
============================================================
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e2]:
    - generic [ref=e4]:
      - button "TH" [ref=e5]
      - button "EN" [ref=e6]
    - generic [ref=e7]:
      - generic [ref=e8]:
        - img "My Money Master" [ref=e10]
        - paragraph [ref=e11]: My Money Master
      - generic [ref=e12]:
        - generic [ref=e13]:
          - generic [ref=e14]: อีเมล
          - textbox "email@example.com" [ref=e15]: admin@loanapp.com
        - generic [ref=e16]:
          - generic [ref=e17]: รหัสผ่าน
          - textbox "••••••••" [ref=e18]: Admin@1234
        - button "เข้าสู่ระบบ" [ref=e19]
      - paragraph [ref=e20]:
        - text: ยังไม่มีบัญชี?
        - link "สมัครเข้าใช้งาน" [ref=e21] [cursor=pointer]:
          - /url: /loan/register
  - alert [ref=e22]
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
  9  |   await page.goto('/loan/login');
  10 |   await page.locator('input[type="email"]').fill(email);
  11 |   await page.locator('input[type="password"]').fill(password);
  12 |   await page.locator('button[type="submit"]').click();
  13 |   // Wait until we land somewhere that is NOT /loan/login
> 14 |   await page.waitForURL(url => !url.pathname.endsWith('/loan/login'), { timeout: 10000 });
     |              ^ TimeoutError: page.waitForURL: Timeout 10000ms exceeded.
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