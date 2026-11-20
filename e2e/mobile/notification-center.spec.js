const { test, expect } = require('@playwright/test');

for (const width of [390, 1440]) {
  test(`keeps notification actions usable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/?demo=1');
    await page.locator('.notification-btn').click();
    const dialog = page.getByRole('dialog', { name: 'Trung tâm thông báo' });
    await expect(dialog).toBeVisible();
    await page.evaluate(() => {
      window.__notifCache.reminders = [3, 1, 2].map(hours => ({
        title: `Nhắc việc sau ${hours} giờ có nội dung dài để kiểm tra hiển thị trên màn hình nhỏ`,
        scheduled_for: new Date(Date.now() + hours * 3600000).toISOString(),
        status: 'pending'
      }));
      window.renderNotificationCenter('unread');
    });
    const reminders = dialog.locator('.notif-reminder-row');
    await expect(reminders).toHaveCount(2);
    await expect(reminders.first()).toContainText('Nhắc việc sau 1 giờ');
    await expect(dialog.locator('.notif-tab-btn[data-tab="unread"]')).toHaveAttribute('aria-pressed', 'true');
    const all = dialog.getByRole('button', { name: /^Tất cả/ });
    await all.press('Enter');
    await expect(all).toBeFocused();
    await expect(all).toHaveAttribute('aria-pressed', 'true');
    const unread = dialog.locator('.notification-item.is-unread').first();
    const mark = unread.getByRole('button', { name: 'Đánh dấu đã đọc' });
    if (width < 600) expect((await mark.boundingBox()).height).toBeGreaterThanOrEqual(44);
    const before = await dialog.locator('.notification-item.is-unread').count();
    await mark.click();
    await expect(dialog.locator('.notification-item.is-unread')).toHaveCount(before - 1);
    expect(await dialog.locator('.dialog-scroll').evaluate(el => el.scrollWidth)).toBeLessThanOrEqual(
      await dialog.locator('.dialog-scroll').evaluate(el => el.clientWidth)
    );
  });
}
