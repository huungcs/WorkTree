const { test, expect } = require('@playwright/test');

for (const width of [360, 1440]) {
  test(`keeps the organization tree and employee filters usable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/?demo=1&node=phong-kinh-doanh--10&view=list');

    const members = page.locator('#scopeMembersBar');
    await expect(members).toBeVisible();
    const chosen = members.locator('.scope-member-chip:not(.is-all)').first();
    await expect(chosen).toHaveAttribute('aria-pressed', 'false');
    await chosen.press('Enter');
    await expect(chosen).toBeFocused();
    await expect(chosen).toHaveAttribute('aria-pressed', 'true');
    await chosen.press('Enter');
    await expect(chosen).toHaveAttribute('aria-pressed', 'false');
    if (width < 901) {
      expect((await chosen.boundingBox()).height).toBeGreaterThanOrEqual(44);
      await page.getByRole('button', { name: /Mở menu & cây tổ chức/ }).first().click();
    }

    const tree = page.locator('#orgTree');
    await expect(tree).toBeVisible();
    const parent = tree.locator('.node-expand').first();
    const wasExpanded = await parent.getAttribute('aria-expanded');
    await parent.press('Enter');
    await expect(parent).toHaveAttribute('aria-expanded', wasExpanded === 'true' ? 'false' : 'true');
    await expect(parent).toBeFocused();
    expect(await tree.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
  });
}
