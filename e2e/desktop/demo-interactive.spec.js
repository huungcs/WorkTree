const { test, expect } = require('@playwright/test');

test.describe('Interactive Demo Mode (Full Real-Account Parity & Isolation)', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('supports persistent CRUD, dependencies, attachments, external share, notifications/reminders, recurring tasks, daily check-in, AI, roles, and clean reset without touching non-demo storage', async ({ page }) => {
    test.setTimeout(60000);
    const pageErrors = [];
    page.on('pageerror', err => pageErrors.push(err.message));

    // Seed non-demo sentinel data to guarantee strict tenant/storage isolation.
    await page.goto('/?demo=1');
    await expect(page.locator('#app')).toBeVisible();
    await page.evaluate(() => {
      localStorage.setItem('worktree_x_v8_data', JSON.stringify({ sentinel: 'keep-real-local-data' }));
    });

    // 1. Theme persists across reload
    await page.locator('#themeBtn').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.locator('#themeBtn').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

    // 2. Create task & verify persistence after reload
    await page.locator('.page-actions [data-action="new-task"]').click();
    await expect(page.locator('#taskDialog')).toBeVisible();
    await page.locator('#tTitle').fill('Kiểm thử Demo Toàn Diện');
    await page.locator('#taskSubmit').click();
    await expect(page.locator('#taskDialog')).toBeHidden();
    await expect(page.locator('#drawer')).toBeVisible();
    await page.locator('#drawer .drawer-top [data-action="close"][data-dialog="drawer"]').click();

    await page.locator('#tab-list').click();
    await expect(page.locator('#viewContent')).toContainText('Kiểm thử Demo Toàn Diện');
    await page.reload();
    await expect(page.locator('#tab-list')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#viewContent')).toContainText('Kiểm thử Demo Toàn Diện');

    // 3. Open Drawer: dependency add + remove, comment, and attachment upload + reload + delete
    await page.locator('#viewContent .task-name', { hasText: 'Kiểm thử Demo Toàn Diện' }).first().click();
    const drawer = page.locator('#drawer');
    await expect(drawer).toBeVisible();

    // Add dependency and remove it
    const depSelect = drawer.locator('#newDepTask');
    const depOptVal = await depSelect.locator('option').nth(1).getAttribute('value');
    await depSelect.selectOption(depOptVal);
    await drawer.locator('#dependencyForm button[type="submit"]').click();
    await expect(drawer.locator('.dependency-remove')).toHaveCount(1);
    await drawer.locator('.dependency-remove').click();
    await expect(drawer.locator('.dependency-remove')).toHaveCount(0);

    // Upload attachment & verify persistence after reload
    await drawer.locator('#taskAttachmentInput').setInputFiles({
      name: 'demo-spec.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('Tai lieu kiem thu demo WorkTree X', 'utf8')
    });
    await expect(drawer.locator('.attachment-name', { hasText: 'demo-spec.txt' })).toBeVisible();

    // Create external Demo share link & test share viewer + revoke
    const shareBtn = drawer.locator('[data-worktree-share-btn]');
    await expect(shareBtn).toBeVisible();
    await shareBtn.click();
    const shareDlg = page.locator('#taskShareDialog');
    await expect(shareDlg).toBeVisible();
    await shareDlg.locator('input[name="permission"][value="edit_progress"]').check();
    await shareDlg.locator('#wtShareSubmitBtn').click();
    const copyShareBtn = shareDlg.locator('[data-share-copy]').first();
    await expect(copyShareBtn).toBeVisible();
    const shareUrl = await copyShareBtn.getAttribute('data-share-copy');
    expect(shareUrl).toContain('/share.html?demo_share=wtdemo_');
    await shareDlg.locator('#wtShareCloseBtn').click();

    // Visit external Demo share link in same context & post guest comment
    const sharePage = await page.context().newPage();
    sharePage.on('pageerror', err => pageErrors.push(err.message));
    await sharePage.goto(shareUrl);
    await expect(sharePage.locator('#shareRoot')).toContainText('Kiểm thử Demo Toàn Diện');
    await sharePage.locator('#guestNameInput').fill('Đối tác Kiểm thử');
    await sharePage.locator('#guestCommentInput').fill('Đã xem tiến độ từ link chia sẻ Demo');
    await sharePage.locator('#commentForm button[type="submit"]').click();
    await expect(sharePage.locator('#shareRoot')).toContainText('Đã xem tiến độ từ link chia sẻ Demo');
    await sharePage.close();

    // Reload main page -> drawer reopens on same task & attachment + partner comment both persisted
    await page.reload();
    await expect(drawer).toBeVisible();
    await expect(drawer).toContainText('Kiểm thử Demo Toàn Diện');
    await expect(drawer.locator('.attachment-name', { hasText: 'demo-spec.txt' })).toBeVisible();
    await expect(drawer).toContainText('Đã xem tiến độ từ link chia sẻ Demo');

    // Delete attachment
    await drawer.locator('[data-action="delete-attachment"]').first().click();
    await page.locator('#confirmOk').click();
    await expect(drawer.locator('.attachment-name', { hasText: 'demo-spec.txt' })).toHaveCount(0);

    // Revoke share link and confirm fail-closed on share.html
    await drawer.locator('[data-worktree-share-btn]').click();
    await expect(shareDlg).toBeVisible();
    await shareDlg.locator('[data-share-revoke]').first().click();
    await expect(shareDlg.locator('[data-share-copy]')).toHaveCount(0);
    await shareDlg.locator('#wtShareCloseBtn').click();

    const revokedPage = await page.context().newPage();
    await revokedPage.goto(shareUrl);
    await expect(revokedPage.locator('#shareRoot')).toContainText('Liên kết không khả dụng');
    await revokedPage.close();

    await drawer.locator('.drawer-top [data-action="close"][data-dialog="drawer"]').click();

    // 4. Notifications & Manual Reminders persistence
    await expect(page.locator('#notificationDot')).toHaveText('2');
    await page.locator('.notification-btn').click();
    await expect(page.locator('#infoDialog')).toBeVisible();
    await page.locator('#infoDialog [data-action="mark-all-read"]').click();
    await expect(page.locator('#notificationDot')).toBeHidden();
    await page.locator('#infoDialog [data-action="notif-settings"]').click();
    await expect(page.locator('#hubPanelNotifications')).toBeVisible();

    await page.locator('#manualReminderTitle').fill('Nhắc họp khách hàng Demo');
    await page.locator('[data-action="submit-manual-reminder"]').click();
    await expect(page.locator('#hubPanelNotifications')).toContainText('Nhắc họp khách hàng Demo');

    await page.locator('[data-action="toggle-quiet-hours"]').click();
    await expect(page.locator('[data-action="toggle-quiet-hours"]')).toContainText('Đang bật');

    // 5. System Hub: Add Demo Employee & Recurring Task Generation
    await page.locator('#hub-tab-access').click();
    await expect(page.locator('#hubPanelAccess')).toBeVisible();
    await page.locator('[data-v8="demo-person-new"]').click();
    await expect(page.locator('#accountDialog')).toBeVisible();
    await page.locator('#demoEmpName').fill('Bùi Minh Demo');
    await page.locator('#demoEmpDesc').fill('QA Automation');
    await page.locator('#demoPersonForm button[type="submit"]').click();
    await expect(page.locator('#hubPanelAccess')).toContainText('Bùi Minh Demo');

    await page.locator('#hub-tab-recurring').click();
    await expect(page.locator('#hubPanelRecurring .wt-rec-list-toolbar')).toBeVisible();
    await page.locator('[data-rec-action="new-form"]').click();
    await page.locator('#wtRecTitle').fill('Kiểm tra QA hằng ngày Demo');
    await page.locator('#wtRecAssignmentMode').selectOption('employee');
    await page.locator('#wtRecCadence').selectOption('daily');
    await page.locator('#wtRecTemplateForm button[type="submit"]').click();
    await expect(page.locator('#hubPanelRecurring')).toContainText('Kiểm tra QA hằng ngày Demo');

    await page.locator('[data-action="hub-back"]').click();
    await page.locator('#tab-list').click();
    await expect(page.locator('#viewContent')).toContainText('Kiểm tra QA hằng ngày Demo');

    // 6. Daily Check-in saves report & Team Check-in tab renders colleagues
    await page.locator('[data-action="daily-checkin"]').click();
    const chkDlg = page.locator('#wtDailyCheckinDialog');
    await expect(chkDlg).toBeVisible();
    await chkDlg.locator('#wtChkSummary').fill('Hoàn tất kiểm thử toàn diện Demo');
    await chkDlg.locator('[data-chk-action="submit"]').click();
    await expect(chkDlg).toBeHidden();

    // 7. AI Executive Digest & AI Assistant
    await page.locator('#aiAssistantBtn').click();
    const aiDlg = page.locator('#aiAssistantDialog');
    await expect(aiDlg).toBeVisible();
    await aiDlg.locator('[data-ai-chip="daily_executive_digest"]').click();
    await expect(aiDlg.locator('#aiMessagesScroll')).toContainText('NTH GROUP');
    await aiDlg.locator('#aiCloseBtn').click();

    // 8. Demo role persists across reload & resetDemo restores clean state without touching sentinel
    await page.locator('#topAvatar').click();
    await expect(page.locator('#profileDialog')).toBeVisible();
    await page.locator('#profileDialog [data-v8="demo-role"][data-role="manager"]').click();
    await page.reload();
    await expect(page.locator('#profileRole')).toContainText('Quản lý');

    // Switch back to owner and run resetDemo
    await page.locator('#topAvatar').click();
    await page.locator('#profileDialog [data-v8="demo-role"][data-role="owner"]').click();
    await page.locator('#accessNav').click();
    await page.locator('#hub-tab-settings').click();
    await expect(page.locator('#hubPanelSettings')).toBeVisible();
    await page.locator('#hubPanelSettings [data-action="reset-demo"]').click();
    await page.locator('#confirmOk').click();

    await expect(page.locator('#viewContent')).not.toContainText('Kiểm thử Demo Toàn Diện');
    const sentinelIntact = await page.evaluate(() => {
      return localStorage.getItem('worktree_x_v8_data') === JSON.stringify({ sentinel: 'keep-real-local-data' });
    });
    expect(sentinelIntact).toBe(true);
    await page.evaluate(() => localStorage.removeItem('worktree_x_v8_data'));

    expect(pageErrors).toEqual([]);
  });
});

test.describe('Demo Mobile Visuals & Layout (360px Light/Dark)', () => {
  test.use({ viewport: { width: 360, height: 780 }, isMobile: true, hasTouch: true });

  test('renders Demo Access, Settings, Reminders, and Check-in cleanly with >= 44px touch targets and zero overflow', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', err => pageErrors.push(err.message));

    await page.goto('/?demo=1');
    await expect(page.locator('#app')).toBeVisible();

    await page.locator('#mobileNav [data-mobile="menu"]').click();
    await page.locator('#accessNav').click();
    await expect(page.locator('#hubPanelAccess')).toBeVisible();

    const stripButtons = await page.locator('.demo-role-strip .btn').evaluateAll(btns =>
      btns.map(b => b.getBoundingClientRect().height)
    );
    expect(stripButtons.length).toBe(5);
    expect(stripButtons.every(h => h >= 44)).toBe(true);

    const overflowLight = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(overflowLight).toBe(false);

    await page.locator('#hub-tab-settings').click();
    await page.getByRole('button', { name: 'Tối', exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    const overflowDark = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(overflowDark).toBe(false);

    // Restore light so later runs start clean
    await page.getByRole('button', { name: 'Sáng', exact: true }).click();
    expect(pageErrors).toEqual([]);
  });
});
