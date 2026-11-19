const { test, expect } = require('@playwright/test');

const share = { organizationName: 'WorkTree Demo', permission: 'edit_progress', allowChecklistToggle: true };
const task = { title: 'Kiểm tra công việc chia sẻ', status: 'in_progress', priority: 'high', progress: 30, checklistTotal: 1 };

test('keeps guest drafts through checklist updates and failed submissions', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const comments = [];
  let isDone = false;
  let failComment = true;
  let failRefresh = false;
  await page.route('**/api/share?*', async route => {
    if (route.request().method() === 'GET') {
      if (failRefresh) {
        failRefresh = false;
        return route.fulfill({ status: 503, json: { ok: false } });
      }
      return route.fulfill({ json: {
        ok: true, share, task: { ...task, checklistDone: Number(isDone) }, comments,
        checklist: [{ id: 'first', content: 'Xác nhận kết quả', isDone }]
      } });
    }
    const action = route.request().postDataJSON();
    if (action.guestAction === 'toggle_checklist') {
      isDone = action.isDone;
      failRefresh = true;
    } else if (failComment) {
      failComment = false;
      return route.fulfill({ status: 400, json: { ok: false, error: 'Vui lòng gửi lại phản hồi.' } });
    } else {
      comments.push({ body: action.body, authorName: action.guestName });
    }
    return route.fulfill({ json: { ok: true } });
  });

  await page.goto('/s/preview-only');
  const comment = page.getByLabel('Phản hồi');
  const progress = page.getByLabel('Tiến độ (%)');
  await page.getByLabel('Tên của bạn hoặc công ty').fill('Khách mẫu');
  await comment.fill('Bản nháp đang soạn');
  await progress.fill('65');
  await page.getByRole('checkbox', { name: 'Xác nhận kết quả' }).check();
  await expect(page.locator('#checklistFeedback')).toContainText('Thao tác đã được lưu');
  await page.getByRole('button', { name: 'Tải lại dữ liệu' }).click();
  await expect(page.locator('#checklistFeedback')).toContainText('Đã cập nhật checklist');
  await expect(comment).toHaveValue('Bản nháp đang soạn');
  await expect(progress).toHaveValue('65');

  const send = page.getByRole('button', { name: 'Gửi phản hồi' });
  await send.click();
  await expect(page.locator('#commentFeedback')).toContainText('Vui lòng gửi lại phản hồi');
  await expect(comment).toHaveValue('Bản nháp đang soạn');
  await send.click();
  await expect(page.locator('#commentFeedback')).toContainText('Đã gửi phản hồi');
  await expect(page.locator('.comment-list')).toContainText('Bản nháp đang soạn');
  await expect(comment).toHaveValue('');
  await expect(progress).toHaveValue('65');
  await expect(send).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
});

test('supports letter-based PINs and a compact read-only view on a narrow screen', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  let attempts = 0;
  await page.route('**/api/share?*', async route => {
    const readOnlyShare = { ...share, permission: 'view' };
    if (route.request().method() === 'GET') {
      return route.fulfill({ json: { ok: true, requiresPin: true, share: readOnlyShare } });
    }
    expect(route.request().postDataJSON().pin).toBe('Ab12');
    if (++attempts === 1) return route.fulfill({ status: 503, json: { ok: false } });
    return route.fulfill({ json: {
      ok: true, share: readOnlyShare, task,
      checklist: [{ id: 'first', content: 'Xác nhận kết quả', isDone: true }]
    } });
  });
  await page.goto('/s/preview-only');
  const pin = page.getByLabel('Mã PIN');
  await pin.fill('Ab12');
  await pin.press('Enter');
  await expect(page.locator('#pinFeedback')).toContainText('Không thể kết nối');
  await expect(pin).toHaveValue('Ab12');
  await pin.press('Enter');
  await expect(page.getByRole('heading', { name: task.title })).toBeFocused();
  await expect(page.getByRole('img', { name: 'Đã xong' })).toBeVisible();
  await expect(page.locator('main form')).toHaveCount(0);
  await page.getByRole('button', { name: 'Bật giao diện tối' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(360);
});

test('focuses workspace landmarks and chat headings without drawing a full-width line', async ({ page }) => {
  await page.goto('/?demo=1&nav=mine');
  const main = page.locator('#mainContent');
  await main.focus();
  await expect(main).toBeFocused();
  await expect(main).toHaveCSS('outline-style', 'none');
  const taskTab = main.getByRole('tab', { name: /Danh sách/ });
  await taskTab.focus();
  await expect(taskTab).toHaveCSS('outline-style', 'solid');

  await page.goto('/?demo=1');
  const settings = page.locator('#accessNav');
  await settings.focus();
  await settings.press('Enter');
  const hub = page.locator('#systemHubContent');
  await expect(hub).toBeFocused();
  await expect(hub).toHaveCSS('outline-style', 'none');
  const recurring = page.getByRole('tab', { name: 'Việc định kỳ' });
  await recurring.focus();
  await recurring.press('Enter');
  await expect(recurring).toHaveAttribute('aria-selected', 'true');
  await expect(recurring).toBeFocused();
  await expect(recurring).toHaveCSS('outline-style', 'solid');

  await page.goto('/chat-preview.html');
  await page.locator('[data-chat-conversation]').first().press('Enter');
  const title = page.locator('.chat-thread-identity h2');
  await expect(title).toBeFocused();
  await expect(title).toHaveCSS('outline-style', 'none');
  const messages = page.locator('#messagesContent');
  await messages.focus();
  await expect(messages).toHaveCSS('outline-style', 'none');
});
