const { test, expect } = require('@playwright/test');

const FAKE_UUID = '11111111-1111-4111-8111-111111111111';

test.describe('Multi-Tenant Isolation & Auth Gates', () => {
  test('anonymous requests to protected APIs and tampered capability tokens fail closed', async ({ request }) => {
    const mcpRes = await request.get('/api/mcp?action=list');
    expect(mcpRes.status()).toBe(401);

    const aiRes = await request.get('/api/ai?action=status');
    expect(aiRes.status()).toBe(401);

    const shareMgmtRes = await request.get(`/api/share?action=list&organizationId=${FAKE_UUID}&taskId=${FAKE_UUID}`);
    expect(shareMgmtRes.status()).toBe(401);

    const adminRes = await request.get('/api/platform-admin?action=check');
    expect(adminRes.status()).toBe(401);

    const invalidShare = await request.get('/api/share?token=wtsh_invalid_cross_tenant_probe_000');
    expect(invalidShare.status()).toBe(404);
    expect(await invalidShare.json()).toEqual({ error: 'not_found' });

    const deleteShare = await request.delete('/api/share?token=wtsh_invalid_cross_tenant_probe_000');
    expect(deleteShare.status()).toBe(403);
  });

  test('URL task/view tampering cannot bypass auth gate or leak data on share viewer', async ({ page }) => {
    await page.goto(`/?task=${FAKE_UUID}&org=${FAKE_UUID}`);
    await expect(page.locator('#authScreen')).toBeVisible();
    await expect(page.locator('#app')).toBeHidden();
    await expect(page.locator('#app')).toHaveAttribute('inert', '');

    await page.goto('/s/wtsh_tampered_cross_tenant_token_999');
    await expect(page.locator('#shareRoot')).toContainText('Liên kết không tồn tại hoặc đã bị khóa');
  });
});
