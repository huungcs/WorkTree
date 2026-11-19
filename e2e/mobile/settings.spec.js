const { test, expect } = require('@playwright/test');

async function openSettingsFixture(page) {
  await page.goto('/?demo=1');
  await expect(page.locator('#app')).toBeVisible();
  await page.waitForFunction(() => typeof window.openRecurringTasksHub === 'function');
  // Use the sample workspace with an owner fixture to render all five settings tabs.
  await page.evaluate(() => {
    demoAccount = null;
    window.__worktree_supabase_user = { id: 'layout-qa', name: 'Kiểm tra giao diện', role: 'owner' };
    for (const id of ['hub-tab-mcp', 'hub-tab-settings']) document.getElementById(id).hidden = false;
  });
}

async function expectNoOverflow(panel) {
  expect(await panel.evaluate(el => Math.max(
    el.scrollWidth - el.clientWidth,
    document.documentElement.scrollWidth - document.documentElement.clientWidth
  ))).toBeLessThanOrEqual(1);
}

for (const width of [360, 390, 440]) {
  test.describe(`Cài đặt mobile ${width}px`, () => {
    test.use({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true });

    test('fits sidebar shortcuts on one row and scrolls the active settings tab into view', async ({ page }) => {
      await openSettingsFixture(page);
      await page.locator('#mobileNav [data-mobile="menu"]').click();
      const shortcuts = page.locator('.m-side-tools');
      await shortcuts.scrollIntoViewIfNeeded();
      const buttons = await shortcuts.locator('button').evaluateAll(items => items.map(item => {
        const { top, height, right } = item.getBoundingClientRect();
        const label = item.lastElementChild;
        return { top, height, right, wraps: label.getClientRects().length > 1 || getComputedStyle(label).whiteSpace !== 'nowrap' };
      }));
      expect(buttons).toHaveLength(4);
      expect(new Set(buttons.map(button => button.top)).size).toBe(1);
      expect(buttons.every(button => button.height >= 44 && button.right <= width && !button.wraps)).toBe(true);

      await page.locator('#accessNav').click();
      const heading = await page.locator('#hubPageTitle').boundingBox();
      const back = page.getByRole('button', { name: 'Quay lại công việc' });
      const backBox = await back.boundingBox();
      expect(Math.abs(heading.y + heading.height / 2 - backBox.y - backBox.height / 2)).toBeLessThanOrEqual(1);
      expect(backBox.height).toBeGreaterThanOrEqual(44);

      const tabs = page.locator('#systemHubTabs');
      expect(await tabs.evaluate(el => el.scrollWidth - el.clientWidth)).toBeGreaterThan(0);
      const tabTops = await tabs.getByRole('tab').evaluateAll(items => items.map(item => item.getBoundingClientRect().top));
      expect(new Set(tabTops).size).toBe(1);

      const access = tabs.getByRole('tab', { name: 'Tài khoản & Phân quyền' });
      const notifications = tabs.getByRole('tab', { name: 'Thông báo & Nhắc việc' });
      await access.focus();
      await access.press('End');
      await expect(notifications).toHaveAttribute('aria-selected', 'true');
      await expect(notifications).toBeFocused();
      expect(await tabs.evaluate(el => el.scrollLeft)).toBeGreaterThan(0);
      await expectNoOverflow(page.locator('#hubPanelNotifications'));
      await back.click();
      await expect(page.locator('#systemHubContent')).toBeHidden();
    });
  });
}

test('uses mobile role cards and fits every settings panel in dark mode', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await openSettingsFixture(page);
  await page.evaluate(() => window.openSystemHub('access', 'matrix'));
  const access = page.locator('#hubPanelAccess');
  await expect(access.locator('.access-matrix')).toBeHidden();
  const roles = access.locator('.mobile-role-matrix summary');
  await roles.first().click();
  await expect(roles.first().locator('..')).toHaveAttribute('open', '');
  await roles.last().click();
  await expect(roles.first().locator('..')).not.toHaveAttribute('open', '');
  await expectNoOverflow(access);

  await page.evaluate(() => window.openSystemHub('settings'));
  await page.getByRole('button', { name: 'Tối', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expectNoOverflow(page.locator('#hubPanelSettings'));

  for (const [tab, panel, ready] of [
    ['recurring', 'hubPanelRecurring', '.wt-rec-list-toolbar'],
    ['mcp', 'hubPanelMcp', '.mcp-guide'],
    ['notifications', 'hubPanelNotifications', '#manualReminderTime']
  ]) {
    await page.evaluate(key => window.openSystemHub(key), tab);
    const container = page.locator('#' + panel);
    await expect(container.locator(ready)).toBeVisible();
    await expectNoOverflow(container);
  }
  const preset = page.getByRole('button', { name: '+30p' });
  await preset.click();
  await expect(page.locator('#manualReminderPreview')).toContainText(/(?:29|30) phút/);
});

test('preserves the desktop settings navigation and permission table', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await openSettingsFixture(page);
  await page.evaluate(() => window.openSystemHub('access', 'matrix'));
  await expect(page.locator('.access-matrix')).toBeVisible();
  await expect(page.locator('.mobile-role-matrix')).toBeHidden();
  await expect(page.locator('#systemHubTabs .hub-desktop-label').first()).toBeVisible();
  await expect(page.locator('#systemHubTabs .hub-mobile-label').first()).toBeHidden();
  await expect(page.getByRole('button', { name: 'Quay lại công việc' })).toContainText('Quay lại công việc');
});
