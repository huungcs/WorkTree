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

    // Allow CSS grid-template-columns transition (0.2s) to settle reliably even under CI/local load
    await expect.poll(async () => {
      const box = await sidebar.boundingBox();
      return box ? Math.round(box.width) : 0;
    }, { timeout: 2500 }).toBe(76);
    const collapsedMainBox = await main.boundingBox();
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

  test('Kanban allows smooth drag-and-drop across status columns in demo mode without opening drawer', async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    await page.goto('/?demo=1&view=kanban');
    const todoCol = page.locator('.board-column[data-drop-status="Chưa làm"]');
    const doingCol = page.locator('.board-column[data-drop-status="Đang làm"]');
    const doneCol = page.locator('.board-column[data-drop-status="Hoàn thành"]');

    await expect(todoCol).toBeVisible();
    await expect(doingCol).toBeVisible();
    await expect(doneCol).toBeVisible();

    const targetCard = todoCol.locator('.board-card', { hasText: 'Tổng hợp KPI tuần' }).first();
    await expect(targetCard).toBeVisible();
    const titleBtn = targetCard.locator('.task-name');
    const srcBox = await titleBtn.boundingBox();
    const doneBox = await doneCol.boundingBox();

    // Drag right from the card title button into Hoàn thành column
    await page.mouse.move(srcBox.x + srcBox.width / 2, srcBox.y + srcBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(doneBox.x + doneBox.width / 2, doneBox.y + 120, { steps: 10 });
    await expect(page.locator('.board-drag-ghost')).toBeVisible();
    await expect(doneCol).toHaveClass(/drag-over/);
    await expect(doneCol.locator('.board-drop-indicator')).toContainText('Hoàn thành');
    await page.mouse.up();

    await expect(doneCol.locator('.board-card', { hasText: 'Tổng hợp KPI tuần' })).toBeVisible();
    await expect(page.locator('#drawer')).not.toHaveAttribute('open', '');

    // Blocked dependency card warns cleanly on Hoàn thành, yet moves smoothly into Đang làm
    const blockedCard = todoCol.locator('.board-card', { hasText: 'Gọi lại 12 khách' }).first();
    const bBox = await blockedCard.boundingBox();
    const doingBox = await doingCol.boundingBox();

    await page.mouse.move(bBox.x + bBox.width / 2, bBox.y + bBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(doneBox.x + doneBox.width / 2, doneBox.y + 120, { steps: 8 });
    await expect(doneCol).toHaveClass(/drag-blocked/);
    await page.mouse.move(doingBox.x + doingBox.width / 2, doingBox.y + 120, { steps: 8 });
    await expect(doingCol).toHaveClass(/drag-over/);
    await expect(doingCol).not.toHaveClass(/drag-blocked/);
    await page.mouse.up();

    await expect(doingCol.locator('.board-card', { hasText: 'Gọi lại 12 khách' })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('desktop timer dock stays compact, persists continuously across reload, and clears on stop', async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    await page.goto('/?demo=1');
    await page.locator('.focus-title').first().click();
    await expect(page.locator('#drawer')).toBeVisible();
    await page.locator('#drawer .drawer-footer [data-action="timer-toggle"]').click();
    await page.locator('#drawer .drawer-top [data-action="close"][data-dialog="drawer"]').click();

    const dock = page.locator('#timerDock');
    await expect(dock).toBeVisible();
    await expect(dock.locator('.timer-panel')).toBeVisible();
    await expect(dock.locator('.timer-orb')).toBeHidden();

    // Reload page -> timer remains active and keeps advancing until user explicitly stops
    await page.waitForTimeout(1100);
    await page.reload();
    await expect(dock).toBeVisible();
    const timerText = await dock.locator('[data-timer-value]').textContent();
    expect(timerText).not.toBe('00:00:00');

    // Verify Cloud reload lifecycle simulation preserves active timer across clearTenantUI + setCloudWorkspaceData + enterWorkspace
    const cloudReloadOk = await page.evaluate(() => {
      const uid = '00000000-0000-4000-8000-000000000001';
      const orgA = '00000000-0000-4000-8000-00000000000a';
      const orgB = '00000000-0000-4000-8000-00000000000b';
      const taskA = '00000000-0000-4000-8000-000000000111';
      const nodeA = '00000000-0000-4000-8000-000000000211';
      const started = Date.now() - 125000;
      localStorage.setItem(`worktree_x_v8_timer:cloud:${uid}:${orgA}`, JSON.stringify({ taskId: taskA, startedAt: started }));
      localStorage.removeItem(`worktree_x_v8_timer:cloud:${uid}:${orgB}`);

      // Simulate reload sequence where window.__worktree_supabase_user exists BEFORE clearTenantUI & setCloudWorkspaceData
      window.__worktree_supabase_user = { id: uid, role: 'owner', scopes: [], personId: null, organization: { id: orgA, organizationId: orgA }, active: true, version: 1 };
      window.appState = window.appState || {};
      window.appState.activeOrganizationId = orgA;
      window.__active_org_id = orgA;
      window.__worktree_is_cloud_workspace = false;

      // Clear legacy UI must NOT erase cloud timer in storage
      window.clearTenantUI('Org A');
      window.setCloudWorkspaceData({
        nodes: [{ id: nodeA, parent: null, type: 'company', name: 'Org A' }],
        employees: [],
        tasks: [{ id: taskA, node: nodeA, title: 'Cloud Timer Task', status: 'Đang làm', priority: 'Cao', due: '', start: '', estimate: 1, actual: 0, progress: 10, desc: '', tags: [], dependency: '', dependencies: [], checklist: [], autoProgress: false, favorite: false, comments: [], logs: [], createdAt: '', updatedAt: '' }],
        pins: [],
        starredTaskIds: [],
        savedViews: [],
        activities: [],
        orgName: 'Org A'
      });
      const activeAfterOrgA = Boolean(localStorage.getItem(`worktree_x_v8_timer:cloud:${uid}:${orgA}`)) && !document.getElementById('timerDock').hidden;

      // Switch to Org B -> Org A timer must NOT leak into Org B, yet Org A storage remains intact
      window.appState.activeOrganizationId = orgB;
      window.__active_org_id = orgB;
      window.clearTenantUI('Org B');
      window.setCloudWorkspaceData({
        nodes: [{ id: '00000000-0000-4000-8000-000000000212', parent: null, type: 'company', name: 'Org B' }],
        employees: [],
        tasks: [],
        pins: [],
        starredTaskIds: [],
        savedViews: [],
        activities: [],
        orgName: 'Org B'
      });
      const hiddenInOrgB = document.getElementById('timerDock').hidden && Boolean(localStorage.getItem(`worktree_x_v8_timer:cloud:${uid}:${orgA}`));

      // Clean up synthetic cloud simulation keys before page teardown
      localStorage.removeItem(`worktree_x_v8_timer:cloud:${uid}:${orgA}`);
      return activeAfterOrgA && hiddenInOrgB;
    });
    expect(cloudReloadOk).toBe(true);

    // Reload clean back into demo mode and verify desktop explicit stop
    await page.goto('/?demo=1');
    await expect(dock).toBeVisible();
    await dock.locator('.timer-desktop-stop').click();
    await expect(dock).toBeHidden();
    await page.reload();
    await expect(dock).toBeHidden();
    expect(errors).toEqual([]);
  });

  test('renders Tải công việc without workloadStats error and toggles drawer checklist & summary AI cleanly', async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    await page.goto('/?demo=1');
    await page.locator('#tab-workload').click();
    await expect(page.locator('.workload-toolbar')).toBeVisible();
    await expect(page.locator('.person-card').first()).toBeVisible();
    await expect(page.locator('.toast', { hasText: 'workloadStats' })).toHaveCount(0);

    await page.locator('#tab-list').click();
    await page.locator('.task-name').first().click();
    await expect(page.locator('#drawer')).toBeVisible();

    await page.locator('#drawer button[data-action="ai-drawer-checklist"]').click();
    const aiBox = page.locator('#drawerAiResultBox');
    await expect(aiBox).toBeVisible();
    await expect(aiBox.locator('.drawer-ai-badge')).toContainText('Bản demo');
    await expect(aiBox.locator('.drawer-ai-check-item').first()).toBeVisible();

    await page.locator('#drawer button[data-action="ai-drawer-summary"]').click();
    await expect(aiBox).toBeVisible();
    await expect(aiBox.locator('.drawer-ai-title')).toContainText('Tóm tắt công việc');
    await expect(aiBox.locator('.drawer-ai-summary-row')).toHaveCount(3);
    await page.locator('#drawer .drawer-top [data-action="close"][data-dialog="drawer"]').click();

    // Verify Daily Check-in dialog autofill summary works cleanly without errors
    await page.locator('#btnDailyCheckin, [data-action="daily-checkin"]').first().click();
    await expect(page.locator('#wtDailyCheckinDialog')).toBeVisible();
    await page.locator('#wtDailyCheckinDialog [data-chk-action="autofill-summary"]').click();
    const summaryVal = await page.locator('#wtChkSummary').inputValue();
    expect(summaryVal.trim().length).toBeGreaterThan(0);
    await page.locator('#wtDailyCheckinDialog [data-chk-action="close"]').first().click();

    // Verify AI Digest modal & rebalance button click handler do not throw `btn is not defined`
    await page.locator('#tab-overview').click();
    await page.locator('[data-action="ai-digest-modal"]').click();
    await expect(page.locator('#aiDigestDialog')).toBeVisible();
    const firstRebalance = page.locator('#aiDigestDialog [data-action="ai-rebalance-apply"]').first();
    if (await firstRebalance.count()) {
      await firstRebalance.click();
      await expect(page.locator('#confirmDialog')).toBeVisible();
      await page.locator('#confirmCancel').click();
    } else {
      const snap = await page.evaluate(() => {
        const s = window.WorkTree.getSnapshot();
        const t = s.tasks.find(x => x.status !== 'Hoàn thành');
        const target = s.nodes.find(n => n.type === 'person' && String(n.id) !== String(t?.owner));
        if (!t || !target) return false;
        const b = document.createElement('button');
        b.type = 'button';
        b.dataset.action = 'ai-rebalance-apply';
        b.dataset.id = String(t.id);
        b.dataset.target = String(target.id);
        document.getElementById('aiDigestDialog').appendChild(b);
        b.click();
        return true;
      });
      if (snap) {
        await expect(page.locator('#confirmDialog')).toBeVisible();
        await page.locator('#confirmCancel').click();
      }
    }
    await page.locator('#aiDigestClose').click();

    expect(errors).toEqual([]);
  });
});
