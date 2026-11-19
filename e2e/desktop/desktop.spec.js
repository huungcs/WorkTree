const { test, expect } = require('@playwright/test');

test.describe('Desktop Layout (>= 901px)', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('renders 278px sidebar expanded, collapses to 76px rail, supports light/dark & hides mobile bottom nav', async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    await page.goto('/chat-preview.html');
    const sidebar = page.locator('#sidebar');
    const mobileNav = page.locator('.chat-preview-mobile-nav');
    const main = page.locator('#messagesContent');

    await expect(sidebar).toBeVisible();
    await expect(mobileNav).toBeHidden();

    const expandedBox = await sidebar.boundingBox();
    const expandedMainBox = await main.boundingBox();
    expect(Math.round(expandedBox.width)).toBe(278);

    const hasOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(hasOverflow).toBe(false);

    await page.locator('[data-preview-sidebar]').first().click();
    await expect(page.locator('#app')).toHaveClass(/sidebar-collapsed/);

    // Allow transition (0.2s) to settle
    await page.waitForTimeout(260);
    const collapsedBox = await sidebar.boundingBox();
    const collapsedMainBox = await main.boundingBox();
    expect(Math.round(collapsedBox.width)).toBe(76);
    expect(collapsedMainBox.width).toBeGreaterThan(expandedMainBox.width);

    // Light / Dark theme toggle
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await page.locator('[data-preview-theme]').first().click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.locator('[data-preview-theme]').first().click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

    // Interactive message & XSS literal escaping
    await page.locator('[data-chat-conversation]').first().click();
    const draft = page.locator('[data-chat-draft]');
    await expect(draft).toBeVisible();
    const xssSample = 'Test <img src=x onerror=alert(1)>';
    await draft.fill(xssSample);
    await draft.press('Enter');
    await expect(page.locator('[data-chat-scroll]')).toContainText(xssSample);

    expect(errors).toEqual([]);
  });
});
