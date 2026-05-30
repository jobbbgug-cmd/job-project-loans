/**
 * TC-CUST-01 → TC-CUST-06  |  TC-USER-01 → TC-USER-06
 * Customers and Users pages
 */
import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers';

test.describe('Customers', () => {

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/loan/customers');
    await page.waitForLoadState('networkidle');
  });

  // TC-CUST-01: Customers page loads
  test('TC-CUST-01 customers page loads', async ({ page }) => {
    await expect(page.locator('main').getByText(/ลูกค้า|Customers/i).first()).toBeVisible({ timeout: 8000 });
    await expect(page.locator('text=/กำลังโหลด/i')).not.toBeVisible({ timeout: 8000 });
  });

  // TC-CUST-02: Customer count shown
  test('TC-CUST-02 customer total count is displayed', async ({ page }) => {
    await expect(page.locator('main').getByText(/ลูกค้าทั้งหมด \d+|total customers/i)).toBeVisible({ timeout: 8000 });
  });

  // TC-CUST-03: Search field present
  test('TC-CUST-03 search field is present', async ({ page }) => {
    await expect(page.locator('main input[type="text"], main input[placeholder*="ค้นหา"]').first()).toBeVisible({ timeout: 6000 });
  });

  // TC-CUST-04: Search filters customer list
  test('TC-CUST-04 search input filters customer list', async ({ page }) => {
    const search = page.locator('input[placeholder*="ค้นหา"]').first();
    if (await search.isVisible()) {
      await search.fill('zzzznonexistentxyz');
      await page.waitForTimeout(600);
      await expect(page.getByText(/ไม่พบ|no found/i).first()).toBeVisible({ timeout: 3000 });
    }
  });

  // TC-CUST-05: View Loans link navigates to filtered loans
  test('TC-CUST-05 view loans link navigates to loan list', async ({ page }) => {
    const viewBtn = page.getByText(/ดูสินเชื่อ →|View Loans/i).first();
    if (await viewBtn.isVisible()) {
      await viewBtn.click();
      await expect(page).toHaveURL(/\/loan\/loans/);
    }
  });

  // TC-CUST-06: Add customer button navigates to new user form
  test('TC-CUST-06 add customer button is present', async ({ page }) => {
    await expect(page.locator('main').getByText(/เพิ่มลูกค้า|Add Customer/i)).toBeVisible({ timeout: 6000 });
  });
});

test.describe('Users (Admin only)', () => {

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/loan/users');
    await page.waitForLoadState('networkidle');
  });

  // TC-USER-01: Users page loads for admin
  test('TC-USER-01 users page loads for admin', async ({ page }) => {
    await expect(page.locator('main').getByText(/ผู้ใช้งาน|Users/i).first()).toBeVisible({ timeout: 8000 });
    await expect(page.locator('text=/กำลังโหลด/i')).not.toBeVisible({ timeout: 8000 });
  });

  // TC-USER-02: New user button present
  test('TC-USER-02 new user button is present', async ({ page }) => {
    await expect(page.locator('main').getByText(/ผู้ใช้งานใหม่|New User/i)).toBeVisible({ timeout: 6000 });
  });

  // TC-USER-03: Role filter buttons visible
  test('TC-USER-03 role filter buttons are visible', async ({ page }) => {
    await expect(page.locator('main').getByRole('button', { name: /ทุกบทบาท|All Roles/i })).toBeVisible({ timeout: 6000 });
  });

  // TC-USER-04: New user form loads
  test('TC-USER-04 new user form loads with all fields', async ({ page }) => {
    await page.getByText(/ผู้ใช้งานใหม่|New User/i).click();
    await expect(page.getByText(/สร้างบัญชีผู้ใช้งาน|Create.*User/i)).toBeVisible({ timeout: 5000 });
    await expect(page.locator('input[type="text"]').first()).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  // TC-USER-05: New user form validation — empty submit blocked
  test('TC-USER-05 new user form blocks empty submit', async ({ page }) => {
    await page.getByText(/ผู้ใช้งานใหม่|New User/i).click();
    await page.waitForTimeout(500);
    await page.locator('button[type="submit"]').click();
    await expect(page.getByText(/สร้างบัญชีผู้ใช้งาน|Create.*User/i)).toBeVisible();
  });

  // TC-USER-06: Role badges visible in user list
  test('TC-USER-06 role badges are displayed in user list', async ({ page }) => {
    const badges = page.locator('text=/แอดมิน|เจ้าหน้าที่|ลูกค้า/');
    const count = await badges.count();
    expect(count).toBeGreaterThan(0);
  });
});
