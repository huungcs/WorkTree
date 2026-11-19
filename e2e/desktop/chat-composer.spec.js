const { test, expect } = require('@playwright/test');

test('shows a sent group photo inline and keeps documents as attachment buttons', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/chat-preview.html');
  await page.locator('[data-chat-conversation]').first().click();
  await page.locator('[data-chat-attachment-file]').setInputFiles([
    {
      name: 'anh-nhom.png',
      mimeType: 'image/png',
      buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+dK6sAAAAASUVORK5CYII=', 'base64')
    },
    { name: 'ghi-chu.txt', mimeType: 'text/plain', buffer: Buffer.from('Ghi chú nhóm') }
  ]);
  await expect(page.getByText('Đã đính kèm · Bấm Gửi để gửi tin nhắn')).toBeVisible();
  await page.getByRole('button', { name: 'Gửi tin nhắn' }).click();
  const photo = page.getByRole('button', { name: 'Mở ảnh anh-nhom.png' });
  await expect(photo.locator('img')).toBeVisible();
  expect(await photo.locator('img').evaluate(image => image.naturalWidth)).toBeGreaterThan(0);
  await expect(page.getByRole('button', { name: /ghi-chu.txt/ })).toBeVisible();
  await expect(page.getByText('Đã đính kèm · Bấm Gửi để gửi tin nhắn')).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
});

test('selects a mention using Vietnamese search and only highlights selected members', async ({ page }) => {
  await page.goto('/chat-preview.html');
  await page.locator('[data-chat-conversation]').first().click();
  const draft = page.getByRole('textbox', { name: 'Nội dung tin nhắn' });
  await draft.fill('😊 @khanh linh');
  const member = page.getByRole('option', { name: /Khánh Linh/ });
  await expect(member).toBeVisible();
  await draft.press('Enter');
  await expect(draft).toHaveValue('😊 @Đỗ Khánh Linh ');
  await draft.press('End');
  await draft.pressSequentially('va @Ten tu go');
  await page.getByRole('button', { name: 'Gửi tin nhắn' }).click();
  const message = page.locator('.chat-message').filter({ hasText: 'va @Ten tu go' });
  await expect(message.locator('.chat-mention')).toHaveText(['@Đỗ Khánh Linh']);
  await expect(draft).toHaveValue('');
});

test('mentions a group member by touch on a narrow screen', async ({ browser }) => {
  const page = await browser.newPage({ viewport: { width: 360, height: 780 }, isMobile: true, hasTouch: true });
  try {
    await page.goto('/chat-preview.html');
    await page.locator('[data-chat-conversation]').first().tap();
    const draft = page.getByRole('textbox', { name: 'Nội dung tin nhắn' });
    await draft.fill('@khanh');
    const member = page.getByRole('option', { name: /Khánh Linh/ });
    await expect(member).toBeInViewport();
    await member.tap();
    await expect(draft).toHaveValue('@Đỗ Khánh Linh ');
    await page.getByRole('button', { name: 'Gửi tin nhắn' }).tap();
    await expect(page.locator('.chat-mention')).toHaveText('@Đỗ Khánh Linh');
  } finally {
    await page.close();
  }
});

test('aligns the composer with the desktop conversation and preserves the draft', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto('/chat-preview.html');
  await page.locator('[data-chat-conversation]').first().click();
  const composer = page.locator('[data-chat-compose]');
  const draft = page.getByRole('textbox', { name: 'Nội dung tin nhắn' });
  const send = page.getByRole('button', { name: 'Gửi tin nhắn' });
  const attach = page.getByRole('button', { name: 'Đính kèm ảnh hoặc tệp' });
  const toggle = page.getByRole('button', { name: 'Tóm tắt AI' });
  const initial = await composer.boundingBox();
  expect(initial.height).toBeLessThanOrEqual(52);
  expect((await send.boundingBox()).y).toBe((await attach.boundingBox()).y);
  await draft.fill('Một dòng\nHai dòng\nBa dòng');
  expect((await composer.boundingBox()).height).toBeGreaterThan(initial.height);
  await toggle.click();
  const summary = page.locator('#chatAiSummary');
  await expect(summary).toBeVisible();
  const conversation = await page.locator('.chat-conversation-pane').boundingBox();
  const panel = await summary.boundingBox();
  expect(Math.abs(panel.x - conversation.x - conversation.width)).toBeLessThan(2);
  expect(Math.abs(panel.y + panel.height - conversation.y - conversation.height)).toBeLessThan(2);
  expect((await composer.boundingBox()).width).toBeLessThan(initial.width);
  await page.getByRole('button', { name: 'Đóng tóm tắt AI' }).click();
  await expect(draft).toHaveValue('Một dòng\nHai dòng\nBa dòng');
  expect((await composer.boundingBox()).width).toBe(initial.width);
});

test('dismisses the mobile AI sheet by swiping, with the composer draft intact', async ({ browser }) => {
  const page = await browser.newPage({ viewport: { width: 360, height: 780 }, isMobile: true, hasTouch: true });
  try {
    await page.goto('/chat-preview.html');
    await page.locator('[data-chat-conversation]').first().tap();
    const draft = page.locator('[data-chat-draft]');
    const toggle = page.getByRole('button', { name: 'Tóm tắt AI' });
    await draft.fill('Tin nhắn đang soạn');
    await toggle.tap();
    const sheet = page.getByRole('dialog', { name: 'Tóm tắt AI' });
    await expect(sheet).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Tóm tắt AI' })).toBeFocused();
    await expect(page.locator('.chat-conversation-pane')).toHaveAttribute('inert', '');
    const handle = page.locator('[data-chat-ai-handle]');
    await expect(handle).toBeInViewport();
    const box = await handle.boundingBox();
    const x = Math.round(box.x + box.width / 2);
    const y = Math.round(box.y + box.height / 2);
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y + 66 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect(sheet).toBeHidden();
    await expect(toggle).toBeFocused();
    await expect(draft).toHaveValue('Tin nhắn đang soạn');
    const send = await page.getByRole('button', { name: 'Gửi tin nhắn' }).boundingBox();
    expect(send.height).toBeGreaterThanOrEqual(44);
    expect(send.y + send.height).toBeLessThanOrEqual(780);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(360);
  } finally {
    await page.close();
  }
});
