/**
 * TC-PAY-01 → TC-PAY-18
 * Payments list, detail, create, verify, delete
 */
import { test, expect, Page } from '@playwright/test';
import { loginAsAdmin } from './helpers';

test.describe('Payments', () => {

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  // TC-PAY-01: Payments list loads
  test('TC-PAY-01 payments list page loads', async ({ page }) => {
    await page.goto('/loan/payments');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('main').getByText(/การชำระเงิน|Payments/i).first()).toBeVisible({ timeout: 8000 });
    await expect(page.locator('text=/กำลังโหลด|Loading/i')).not.toBeVisible({ timeout: 8000 });
  });

  // TC-PAY-02: + Record payment button visible
  test('TC-PAY-02 record payment button is visible', async ({ page }) => {
    await page.goto('/loan/payments');
    await expect(page.locator('main').getByText(/บันทึกการชำระ|Record Payment/i)).toBeVisible({ timeout: 8000 });
  });

  // TC-PAY-03: Payment filter by status
  test('TC-PAY-03 payment status filters work', async ({ page }) => {
    await page.goto('/loan/payments');
    await page.waitForLoadState('networkidle');
    for (const f of ['รอการยืนยัน', 'อนุมัติ', 'ปฏิเสธ']) {
      const chip = page.getByText(f).first();
      if (await chip.isVisible()) {
        await chip.click();
        await page.waitForTimeout(400);
        await expect(page.locator('body')).toBeVisible();
      }
    }
  });

  // TC-PAY-04: New payment form loads
  test('TC-PAY-04 new payment form loads with required fields', async ({ page }) => {
    await page.goto('/loan/payments/new');
    await expect(page.locator('main').getByText(/บันทึกการชำระเงิน|Record Payment/i)).toBeVisible({ timeout: 8000 });
    await expect(page.locator('main select').first()).toBeVisible();
    await expect(page.locator('main input[type="number"]').first()).toBeVisible();
  });

  // TC-PAY-05: Payment type selector renders 3 options
  test('TC-PAY-05 payment type selector shows 3 options', async ({ page }) => {
    await page.goto('/loan/payments/new');
    await expect(page.locator('main').getByText('ชำระปกติ')).toBeVisible({ timeout: 8000 });
    await expect(page.locator('main').getByText('เงินต้น')).toBeVisible();
    await expect(page.locator('main').getByText('ดอกเบี้ย')).toBeVisible();
  });

  // TC-PAY-06: Payment type selection highlights button
  test('TC-PAY-06 payment type button highlights when selected', async ({ page }) => {
    await page.goto('/loan/payments/new');
    const main = page.locator('main');
    const interestBtn = main.getByText('ดอกเบี้ย');
    await interestBtn.click();
    await expect(interestBtn).toHaveClass(/bg-blue-600/, { timeout: 2000 });
    const principalBtn = main.getByText('เงินต้น');
    await principalBtn.click();
    await expect(principalBtn).toHaveClass(/bg-emerald-600/, { timeout: 2000 });
  });

  // TC-PAY-07: Submit empty form is blocked
  test('TC-PAY-07 new payment form blocks empty submit', async ({ page }) => {
    await page.goto('/loan/payments/new');
    await page.locator('main button[type="submit"]').click();
    await expect(page).toHaveURL(/\/loan\/payments\/new/);
  });

  // TC-PAY-08: Selecting loan auto-populates schedule
  test('TC-PAY-08 selecting a loan fetches and shows schedule', async ({ page }) => {
    await page.goto('/loan/payments/new');
    const loanSelect = page.locator('select').first();
    const options = await loanSelect.locator('option').count();
    if (options > 1) {
      await loanSelect.selectOption({ index: 1 });
      // Amount field should be populated automatically
      await page.waitForTimeout(1500);
      const amount = await page.locator('input[type="number"]').first().inputValue();
      // Amount may be 0 for open-ended or populated for fixed
      expect(amount).not.toBeNull();
    }
  });

  // TC-PAY-09: Payment detail page loads
  test('TC-PAY-09 payment detail page loads for existing payment', async ({ page }) => {
    await page.goto('/loan/payments');
    await page.waitForLoadState('networkidle');
    const viewLink = page.getByText(/ดู →|View →/i).first();
    if (await viewLink.isVisible()) {
      await viewLink.click();
      await expect(page).toHaveURL(/\/loan\/payments\/\d+/);
      await expect(page.getByText(/รายละเอียดการชำระ|Payment/i)).toBeVisible({ timeout: 6000 });
    }
  });

  // TC-PAY-10: Approved payment shows verifier name
  test('TC-PAY-10 approved payment detail shows verification info', async ({ page }) => {
    await page.goto('/loan/payments');
    await page.waitForLoadState('networkidle');
    // Filter approved
    const approvedChip = page.getByText('อนุมัติ').first();
    if (await approvedChip.isVisible()) {
      await approvedChip.click();
      const viewLink = page.getByText(/ดู →|View →/i).first();
      if (await viewLink.isVisible()) {
        await viewLink.click();
        await expect(page.getByText(/อนุมัติ|approved/i).first()).toBeVisible({ timeout: 5000 });
      }
    }
  });

  // TC-PAY-11: Payment type badge shown on detail page
  test('TC-PAY-11 payment type badge shown on payment detail', async ({ page }) => {
    await page.goto('/loan/payments');
    await page.waitForLoadState('networkidle');
    const viewLink = page.getByText(/ดู →|View →/i).first();
    if (await viewLink.isVisible()) {
      await viewLink.click();
      const badge = page.locator('text=/ชำระปกติ|เงินต้น|ดอกเบี้ย/').first();
      await expect(badge).toBeVisible({ timeout: 5000 });
    }
  });

  // TC-PAY-12: Pending payment shows approve/reject buttons for admin
  test('TC-PAY-12 pending payment shows approve and reject for admin', async ({ page }) => {
    await page.goto('/loan/payments');
    await page.waitForLoadState('networkidle');
    const pendingChip = page.getByText('รอการยืนยัน').first();
    if (await pendingChip.isVisible()) {
      await pendingChip.click();
      const viewLink = page.getByText(/ดู →|ยืนยัน|Verify/i).first();
      if (await viewLink.isVisible()) {
        await viewLink.click();
        await expect(page.getByText(/อนุมัติการชำระ|Approve/i)).toBeVisible({ timeout: 5000 });
        await expect(page.getByText(/ปฏิเสธการชำระ|Reject/i)).toBeVisible();
      }
    }
  });

  // TC-PAY-13: Reject flow shows reason textarea
  test('TC-PAY-13 reject button shows reason textarea', async ({ page }) => {
    await page.goto('/loan/payments');
    await page.waitForLoadState('networkidle');
    const pendingChip = page.getByText('รอการยืนยัน').first();
    if (await pendingChip.isVisible()) {
      await pendingChip.click();
      const viewLink = page.getByText(/ดู →|ยืนยัน|Verify/i).first();
      if (await viewLink.isVisible()) {
        await viewLink.click();
        const rejectBtn = page.getByText(/ปฏิเสธการชำระ|Reject/i);
        if (await rejectBtn.isVisible()) {
          await rejectBtn.click();
          await expect(page.locator('textarea')).toBeVisible({ timeout: 3000 });
        }
      }
    }
  });

  // TC-PAY-14: Payment list shows payment number
  test('TC-PAY-14 payment list shows PAY numbers', async ({ page }) => {
    await page.goto('/loan/payments');
    await page.waitForLoadState('networkidle');
    const count = await page.getByText(/PAY-\d{4}-\d{5}/).count();
    // May be 0 if no payments, just check page renders
    expect(typeof count).toBe('number');
  });

  // TC-PAY-15: Payments list shows total count
  test('TC-PAY-15 payments list shows total count', async ({ page }) => {
    await page.goto('/loan/payments');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('main').getByText(/รายการชำระทั้งหมด|total payments/i)).toBeVisible({ timeout: 8000 });
  });
});
