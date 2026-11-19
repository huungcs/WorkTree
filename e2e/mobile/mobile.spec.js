const { test, expect } = require('@playwright/test');

for (const vp of [{ width: 390, height: 844 }, { width: 360, height: 780 }]) {
  test.describe(`Mobile Experience (${vp.width}px)`, () => {
    test.use({ viewport: vp });

    test('auth and public share pages render without horizontal overflow and preserve >= 44px touch targets', async ({ page }) => {
      await page.goto('/');
      await expect(page.locator('#authScreen')).toBeVisible();
      const authOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
      expect(authOverflow).toBe(false);

      await page.goto('/s/wtsh_mobile_probe_12345');
      await expect(page.locator('#shareRoot')).toContainText('Liên kết không tồn tại');
      const shareOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
      expect(shareOverflow).toBe(false);

      const themeBtnBox = await page.locator('#themeBtn').boundingBox();
      expect(themeBtnBox.height).toBeGreaterThanOrEqual(44);
    });

    test('renders bottom nav and opens off-canvas sidebar drawer cleanly on mobile', async ({ page }) => {
      await page.goto('/chat-preview.html');
      const bottomNav = page.locator('.chat-preview-mobile-nav');
      const sidebar = page.locator('#sidebar');

      await expect(bottomNav).toBeVisible();
      const chatOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
      expect(chatOverflow).toBe(false);

      await page.locator('.chat-preview-mobile-nav [data-preview-sidebar]').click();
      await expect(sidebar).toHaveClass(/mobile-open/);

      await page.locator('.sidebar-scrim').click({ force: true });
      await expect(sidebar).not.toHaveClass(/mobile-open/);
    });
  });
}
