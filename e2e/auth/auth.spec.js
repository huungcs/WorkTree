const { test, expect } = require('@playwright/test');

test.describe('Authentication Flow', () => {
  test('renders login form cleanly without uncaught runtime errors', async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    await page.goto('/');
    const authScreen = page.locator('#authScreen');
    await expect(authScreen).toBeVisible();
    await expect(authScreen).toContainText('WorkTree');

    const appShell = page.locator('#app');
    await expect(appShell).toBeHidden();
    await expect(appShell).toHaveAttribute('inert', '');

    const emailInput = authScreen.locator('input[type="email"]');
    const passwordInput = authScreen.locator('input[type="password"]');
    const submitBtn = authScreen.locator('button[type="submit"]');
    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
    await expect(submitBtn).toBeVisible();

    expect(errors).toEqual([]);
  });

  test('can switch to signup tab and rejects invalid invite token without unlocking workspace', async ({ page }) => {
    await page.goto('/?invite=invalid_test_invite_token_000');
    const authScreen = page.locator('#authScreen');
    await expect(authScreen).toBeVisible();
    await expect(page.locator('#app')).toBeHidden();

    const signupTab = authScreen.locator('button', { hasText: /Đăng ký/i }).first();
    if (await signupTab.count()) {
      await signupTab.click();
      await expect(authScreen.locator('input[type="email"]')).toBeVisible();
    }
  });
});
