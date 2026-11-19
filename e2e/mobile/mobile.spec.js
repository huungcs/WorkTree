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
      await expect(page.locator('#shareRoot')).toContainText(/Liên kết không (khả dụng|tồn tại)/);
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

    test('floating timer dock renders compact circle, drags to edge snap, expands safely and stops on mobile', async ({ page }) => {
      await page.goto('/?demo=1');
      await expect(page.locator('#app')).toBeVisible();

      // Open first task and start timer
      await page.locator('.m-card-title').first().click();
      await expect(page.locator('#drawer')).toBeVisible();
      await page.locator('#drawer .drawer-footer [data-action="timer-toggle"]').click();
      await page.locator('#drawer .drawer-top [data-action="close"][data-dialog="drawer"]').click();
      await expect(page.locator('#drawer')).not.toBeVisible();

      const dock = page.locator('#timerDock');
      const orb = dock.locator('.timer-orb');
      await expect(dock).toBeVisible();
      await expect(orb).toBeVisible();

      // Compact circular geometry near right edge, above mobileNav
      const initialBox = await orb.boundingBox();
      const navBox = await page.locator('#mobileNav').boundingBox();
      expect(initialBox.width).toBeGreaterThanOrEqual(48);
      expect(initialBox.width).toBeLessThanOrEqual(60);
      expect(Math.abs(initialBox.width - initialBox.height)).toBeLessThanOrEqual(2);
      expect(initialBox.x + initialBox.width).toBeGreaterThanOrEqual(vp.width - 18);
      expect(initialBox.y + initialBox.height).toBeLessThanOrEqual(navBox.y - 4);
      await expect(dock).toHaveAttribute('data-edge', 'right');
      await expect(dock).toHaveAttribute('data-expanded', 'false');

      const overflowBefore = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
      expect(overflowBefore).toBe(false);

      // Drag freely toward top-left -> must snap smoothly to left edge without expanding popover
      const cx = initialBox.x + initialBox.width / 2;
      const cy = initialBox.y + initialBox.height / 2;
      await page.mouse.move(cx, cy);
      await page.mouse.down();
      await page.mouse.move(cx - 120, 150, { steps: 8 });
      await page.mouse.move(48, 130, { steps: 6 });
      await page.mouse.up();

      await page.waitForTimeout(320);
      await expect(dock).toHaveAttribute('data-edge', 'left');
      await expect(dock).toHaveAttribute('data-expanded', 'false');
      const snappedBox = await orb.boundingBox();
      expect(snappedBox.x).toBeGreaterThanOrEqual(6);
      expect(snappedBox.x).toBeLessThanOrEqual(18);
      expect(snappedBox.y).toBeGreaterThanOrEqual(68);

      // Reload page: running timer & docked edge position MUST persist and keep counting!
      await page.waitForTimeout(1100);
      await page.reload();
      await expect(page.locator('#app')).toBeVisible();
      await expect(dock).toBeVisible();
      await expect(dock).toHaveAttribute('data-edge', 'left');
      const afterReloadCompact = await dock.locator('[data-timer-compact]').textContent();
      expect(afterReloadCompact).not.toBe('00:00');
      const reloadedBox = await orb.boundingBox();
      expect(reloadedBox.x).toBeGreaterThanOrEqual(6);
      expect(reloadedBox.x).toBeLessThanOrEqual(18);

      // Tap orb -> expands compact quick actions inside viewport bounds (both light & dark)
      await orb.click();
      await expect(dock).toHaveAttribute('data-expanded', 'true');
      const panel = dock.locator('.timer-panel');
      await expect(panel).toBeVisible();
      const panelBox = await panel.boundingBox();
      expect(panelBox.x).toBeGreaterThanOrEqual(8);
      expect(panelBox.x + panelBox.width).toBeLessThanOrEqual(vp.width - 8);
      expect(panelBox.y).toBeGreaterThanOrEqual(68);
      expect(panelBox.y + panelBox.height).toBeLessThanOrEqual(navBox.y);

      const overflowExpanded = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
      expect(overflowExpanded).toBe(false);

      // Verify stop action meets touch target, stops cleanly, and stays stopped after reload
      const stopBtn = panel.locator('.timer-card-stop');
      const stopBox = await stopBtn.boundingBox();
      expect(stopBox.height).toBeGreaterThanOrEqual(44);
      await stopBtn.click();
      await expect(dock).toBeHidden();
      await page.reload();
      await expect(page.locator('#app')).toBeVisible();
      await expect(dock).toBeHidden();
    });
  });
}
