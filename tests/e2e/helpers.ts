import { Page } from '@playwright/test';

export const ADMIN = { email: 'admin@loanapp.com', password: 'Admin@1234' };

export const BASE = 'http://localhost:3000';
export const LOAN_BASE = `${BASE}/loan`;

export async function loginAs(page: Page, email: string, password: string) {
  await page.goto('/loan/login');
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.locator('button[type="submit"]').click();
  // Wait until we land somewhere that is NOT /loan/login
  await page.waitForURL(url => !url.pathname.endsWith('/loan/login'), { timeout: 10000 });
  // Wait for sidebar React effect (sets sidebarOpen on desktop) — text spans appear after mount
  await page.locator('nav a span').first().waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
}

export async function loginAsAdmin(page: Page) {
  await loginAs(page, ADMIN.email, ADMIN.password);
}

export async function logout(page: Page) {
  await page.getByText('ออกจากระบบ').click();
  await page.waitForURL('**/loan/login');
}
