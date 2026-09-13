/**
 * WorkTree X — Platform Super-Admin Center UI Component
 * Strictly adheres to WorkTree X Design System tokens, typography, and responsive contract.
 */

import { PlatformAdminService } from '../services/platform-admin-service.js';

let adminDialogEl = null;
let activeTab = 'overview';
let cachedOrgs = [];
let cachedMetrics = null;
let isLoading = false;
let searchQuery = '';
let filterStatus = '';
let filterPlan = '';

function esc(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatDate(isoStr) {
  if (!isoStr) return '—';
  try {
    const d = new Date(isoStr);
    return d.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  } catch (_) {
    return isoStr;
  }
}

export function createPlatformAdminDialog() {
  if (document.getElementById('platformAdminDialog')) {
    return document.getElementById('platformAdminDialog');
  }

  const dialog = document.createElement('dialog');
  dialog.id = 'platformAdminDialog';
  dialog.className = 'dialog platform-admin-dialog';
  dialog.setAttribute('aria-labelledby', 'platformAdminTitle');
  dialog.style.cssText = `
    width: 95vw;
    max-width: 1060px;
    height: 88vh;
    max-height: 820px;
    padding: 0;
    border: 1px solid var(--line);
    border-radius: var(--radius, 14px);
    background: var(--surface);
    color: var(--text);
    box-shadow: 0 20px 48px rgba(0,0,0,0.22);
    overflow: hidden;
    display: flex;
    flex-direction: column;
  `;

  dialog.innerHTML = `
    <div class="platform-admin-head" style="padding:18px 24px;border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:space-between;background:var(--surface-2);">
      <div style="display:flex;align-items:center;gap:12px;">
        <div style="width:38px;height:38px;border-radius:10px;background:#c1f0d6;color:#1c594b;display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:bold;">
          👑
        </div>
        <div>
          <div style="display:flex;align-items:center;gap:8px;">
            <h2 id="platformAdminTitle" style="margin:0;font-size:18px;font-weight:700;letter-spacing:-0.3px;color:var(--text);">Platform Super-Admin Center</h2>
            <span style="background:var(--primary-soft);color:var(--primary-text);font-size:11px;font-weight:700;padding:2px 8px;border-radius:6px;text-transform:uppercase;">Toàn quyền hệ thống</span>
          </div>
          <p style="margin:2px 0 0 0;font-size:12px;color:var(--muted);">Quản trị vận hành SaaS, danh sách doanh nghiệp (Tenants) & gói cước thuê bao</p>
        </div>
      </div>
      <button type="button" class="icon-btn" id="closePlatformAdminBtn" aria-label="Đóng" style="background:none;border:none;cursor:pointer;color:var(--muted);width:36px;height:36px;border-radius:8px;display:flex;align-items:center;justify-content:center;">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
      </button>
    </div>

    <!-- Navigation Tabs -->
    <div class="platform-admin-tabs" style="padding:0 24px;border-bottom:1px solid var(--line);display:flex;gap:24px;background:var(--surface);">
      <button type="button" class="tab-btn" data-tab="overview" style="padding:14px 4px;font-size:13px;font-weight:600;color:var(--primary);border:none;background:none;cursor:pointer;border-bottom:2px solid var(--primary);display:inline-flex;align-items:center;gap:6px;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>
        Tổng quan & KPI
      </button>
      <button type="button" class="tab-btn" data-tab="tenants" style="padding:14px 4px;font-size:13px;font-weight:600;color:var(--muted);border:none;background:none;cursor:pointer;border-bottom:2px solid transparent;display:inline-flex;align-items:center;gap:6px;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M8 10h.01"/><path d="M16 10h.01"/><path d="M8 14h.01"/><path d="M16 14h.01"/></svg>
        Danh bạ Doanh nghiệp (<span id="tabTenantCount">0</span>)
      </button>
    </div>

    <!-- Main Content Region -->
    <div id="platformAdminContent" style="flex:1;overflow-y:auto;padding:24px;background:var(--bg);">
      <div style="text-align:center;padding:48px;color:var(--muted);">Đang tải dữ liệu điều hành...</div>
    </div>
  `;

  document.body.appendChild(dialog);
  adminDialogEl = dialog;

  // Event Listeners
  dialog.querySelector('#closePlatformAdminBtn').addEventListener('click', () => {
    dialog.close();
  });

  dialog.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      switchTab(tab);
    });
  });

  return dialog;
}

function switchTab(tab) {
  activeTab = tab;
  if (!adminDialogEl) return;

  adminDialogEl.querySelectorAll('.tab-btn').forEach(btn => {
    if (btn.dataset.tab === tab) {
      btn.style.color = 'var(--primary)';
      btn.style.borderBottom = '2px solid var(--primary)';
    } else {
      btn.style.color = 'var(--muted)';
      btn.style.borderBottom = '2px solid transparent';
    }
  });

  renderActiveTab();
}

async function loadData() {
  isLoading = true;
  renderActiveTab();

  try {
    const [metrics, orgs] = await Promise.all([
      PlatformAdminService.getOverview(),
      PlatformAdminService.getOrganizations()
    ]);
    cachedMetrics = metrics;
    cachedOrgs = orgs;

    const countEl = adminDialogEl?.querySelector('#tabTenantCount');
    if (countEl) countEl.textContent = orgs.length;
  } catch (err) {
    console.error('[PlatformAdmin] Lỗi nạp dữ liệu:', err);
  } finally {
    isLoading = false;
    renderActiveTab();
  }
}

function renderActiveTab() {
  const content = adminDialogEl?.querySelector('#platformAdminContent');
  if (!content) return;

  if (isLoading && !cachedMetrics && !cachedOrgs.length) {
    content.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:300px;gap:12px;color:var(--muted);">
        <div style="width:36px;height:36px;border:3px solid var(--line);border-top-color:var(--primary);border-radius:50%;animation:spin 0.8s linear infinite;"></div>
        <p style="margin:0;font-size:14px;font-weight:500;">Đang kết nối cơ sở dữ liệu Platform Admin...</p>
      </div>
      <style>@keyframes spin{to{transform:rotate(360deg)}}</style>
    `;
    return;
  }

  if (activeTab === 'overview') {
    renderOverviewTab(content);
  } else if (activeTab === 'tenants') {
    renderTenantsTab(content);
  }
}

function renderOverviewTab(container) {
  const m = cachedMetrics || {
    totalOrganizations: 0,
    activeOrganizations: 0,
    suspendedOrganizations: 0,
    totalUsers: 0,
    totalTasks: 0,
    plansBreakdown: { free: 0, starter: 0, business: 0, enterprise: 0 }
  };

  container.innerHTML = `
    <!-- Top Executive KPIs -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(220px, 1fr));gap:16px;margin-bottom:24px;">
      <!-- KPI Card 1 -->
      <div style="background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:20px;box-shadow:0 1px 3px rgba(0,0,0,0.04);">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
          <span style="font-size:12px;font-weight:600;color:var(--muted);text-transform:uppercase;">Doanh nghiệp (Tenants)</span>
          <span style="font-size:18px;">🏢</span>
        </div>
        <div style="font-size:28px;font-weight:800;color:var(--text);letter-spacing:-0.5px;">${m.totalOrganizations}</div>
        <div style="margin-top:8px;font-size:12px;display:flex;gap:8px;">
          <span style="color:var(--green);font-weight:600;">● ${m.activeOrganizations} Hoạt động</span>
          ${m.suspendedOrganizations > 0 ? `<span style="color:var(--red);font-weight:600;">● ${m.suspendedOrganizations} Đã khóa</span>` : ''}
        </div>
      </div>

      <!-- KPI Card 2 -->
      <div style="background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:20px;box-shadow:0 1px 3px rgba(0,0,0,0.04);">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
          <span style="font-size:12px;font-weight:600;color:var(--muted);text-transform:uppercase;">Người dùng hệ thống</span>
          <span style="font-size:18px;">👥</span>
        </div>
        <div style="font-size:28px;font-weight:800;color:var(--text);letter-spacing:-0.5px;">${m.totalUsers}</div>
        <div style="margin-top:8px;font-size:12px;color:var(--muted);">Tài khoản trên auth.users & profiles</div>
      </div>

      <!-- KPI Card 3 -->
      <div style="background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:20px;box-shadow:0 1px 3px rgba(0,0,0,0.04);">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
          <span style="font-size:12px;font-weight:600;color:var(--muted);text-transform:uppercase;">Tổng công việc (Tasks)</span>
          <span style="font-size:18px;">📋</span>
        </div>
        <div style="font-size:28px;font-weight:800;color:var(--primary);letter-spacing:-0.5px;">${m.totalTasks}</div>
        <div style="margin-top:8px;font-size:12px;color:var(--muted);">Đang vận hành trên toàn nền tảng</div>
      </div>

      <!-- KPI Card 4 -->
      <div style="background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:20px;box-shadow:0 1px 3px rgba(0,0,0,0.04);">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
          <span style="font-size:12px;font-weight:600;color:var(--muted);text-transform:uppercase;">Gói trả phí (Paid Tiers)</span>
          <span style="font-size:18px;">💎</span>
        </div>
        <div style="font-size:28px;font-weight:800;color:var(--green);letter-spacing:-0.5px;">
          ${(m.plansBreakdown.starter || 0) + (m.plansBreakdown.business || 0) + (m.plansBreakdown.enterprise || 0)}
        </div>
        <div style="margin-top:8px;font-size:12px;color:var(--muted);">Starter / Business / Enterprise</div>
      </div>
    </div>

    <!-- Subscription Plans Breakdown Section -->
    <div style="background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:24px;margin-bottom:24px;">
      <h3 style="margin:0 0 16px 0;font-size:15px;font-weight:700;color:var(--text);display:flex;align-items:center;gap:8px;">
        <span>💳 Phân bổ Gói thuê bao (SaaS Subscription Distribution)</span>
      </h3>
      <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));gap:16px;">
        <div style="padding:16px;border-radius:10px;background:var(--surface-2);border:1px solid var(--line);">
          <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
            <span style="font-size:13px;font-weight:600;color:var(--text);">Free Tier</span>
            <span style="font-size:13px;font-weight:700;color:var(--muted);">${m.plansBreakdown.free || 0}</span>
          </div>
          <p style="margin:0;font-size:11px;color:var(--muted);">Tối đa 5 thành viên</p>
        </div>
        <div style="padding:16px;border-radius:10px;background:var(--blue-soft, #eaf2fc);border:1px solid rgba(53,108,165,0.2);">
          <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
            <span style="font-size:13px;font-weight:600;color:var(--blue, #356ca5);">Starter Plan</span>
            <span style="font-size:13px;font-weight:700;color:var(--blue, #356ca5);">${m.plansBreakdown.starter || 0}</span>
          </div>
          <p style="margin:0;font-size:11px;color:var(--muted);">Tối đa 20 thành viên</p>
        </div>
        <div style="padding:16px;border-radius:10px;background:var(--purple-soft, #f2eaf9);border:1px solid rgba(134,93,178,0.2);">
          <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
            <span style="font-size:13px;font-weight:600;color:var(--purple, #865db2);">Business Plan</span>
            <span style="font-size:13px;font-weight:700;color:var(--purple, #865db2);">${m.plansBreakdown.business || 0}</span>
          </div>
          <p style="margin:0;font-size:11px;color:var(--muted);">Tối đa 100 thành viên</p>
        </div>
        <div style="padding:16px;border-radius:10px;background:var(--green-soft, #e8f5ef);border:1px solid rgba(16,115,83,0.2);">
          <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
            <span style="font-size:13px;font-weight:600;color:var(--green, #107353);">Enterprise</span>
            <span style="font-size:13px;font-weight:700;color:var(--green, #107353);">${m.plansBreakdown.enterprise || 0}</span>
          </div>
          <p style="margin:0;font-size:11px;color:var(--muted);">Không giới hạn Seats</p>
        </div>
      </div>
    </div>

    <!-- Quick Action / Security Note -->
    <div style="background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:20px;display:flex;align-items:center;justify-content:space-between;gap:16px;">
      <div>
        <h4 style="margin:0 0 4px 0;font-size:14px;font-weight:600;color:var(--text);">Quản lý danh sách doanh nghiệp</h4>
        <p style="margin:0;font-size:12px;color:var(--muted);">Khóa/mở khóa doanh nghiệp, điều chỉnh gói cước hoặc phân bổ dung lượng lưu trữ.</p>
      </div>
      <button type="button" class="btn primary" id="goToTenantsBtn" style="padding:8px 16px;font-size:13px;font-weight:600;white-space:nowrap;border-radius:8px;background:var(--primary);color:#fff;border:none;cursor:pointer;">
        Xem danh sách doanh nghiệp ➔
      </button>
    </div>
  `;

  container.querySelector('#goToTenantsBtn')?.addEventListener('click', () => {
    switchTab('tenants');
  });
}

function renderTenantsTab(container) {
  let filtered = cachedOrgs.filter(org => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchName = org.name.toLowerCase().includes(q);
      const matchSlug = org.slug.toLowerCase().includes(q);
      const matchOwner = org.ownerName.toLowerCase().includes(q);
      if (!matchName && !matchSlug && !matchOwner) return false;
    }
    if (filterStatus && org.status !== filterStatus) return false;
    if (filterPlan && org.subscription.plan !== filterPlan) return false;
    return true;
  });

  container.innerHTML = `
    <!-- Filter & Search Toolbar -->
    <div style="display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px;margin-bottom:16px;">
      <div style="display:flex;align-items:center;gap:10px;flex:1;min-width:260px;">
        <input type="text" id="tenantSearchInput" placeholder="Tìm theo tên công ty, slug, người quản trị..." value="${esc(searchQuery)}" style="flex:1;max-width:360px;height:38px;padding:0 12px;border:1px solid var(--line);border-radius:8px;background:var(--surface);color:var(--text);font-size:13px;">
        <select id="tenantStatusSelect" style="height:38px;padding:0 10px;border:1px solid var(--line);border-radius:8px;background:var(--surface);color:var(--text);font-size:13px;">
          <option value="">Tất cả trạng thái</option>
          <option value="active" ${filterStatus === 'active' ? 'selected' : ''}>🟢 Đang hoạt động</option>
          <option value="suspended" ${filterStatus === 'suspended' ? 'selected' : ''}>🔴 Đã tạm khóa</option>
        </select>
        <select id="tenantPlanSelect" style="height:38px;padding:0 10px;border:1px solid var(--line);border-radius:8px;background:var(--surface);color:var(--text);font-size:13px;">
          <option value="">Tất cả gói</option>
          <option value="free" ${filterPlan === 'free' ? 'selected' : ''}>Free</option>
          <option value="starter" ${filterPlan === 'starter' ? 'selected' : ''}>Starter</option>
          <option value="business" ${filterPlan === 'business' ? 'selected' : ''}>Business</option>
          <option value="enterprise" ${filterPlan === 'enterprise' ? 'selected' : ''}>Enterprise</option>
        </select>
      </div>
      <button type="button" id="refreshTenantsBtn" class="btn" style="height:38px;padding:0 14px;border:1px solid var(--line);border-radius:8px;background:var(--surface);color:var(--text);cursor:pointer;display:inline-flex;align-items:center;gap:6px;font-size:13px;font-weight:500;">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
        Làm mới
      </button>
    </div>

    <!-- Tenants Table -->
    <div style="background:var(--surface);border:1px solid var(--line);border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.04);">
      <div style="overflow-x:auto;">
        <table style="width:100%;border-collapse:collapse;text-align:left;font-size:13px;">
          <thead>
            <tr style="background:var(--surface-2);border-bottom:1px solid var(--line);color:var(--muted);font-weight:600;font-size:11px;text-transform:uppercase;">
              <th style="padding:12px 16px;">Tổ chức / Doanh nghiệp</th>
              <th style="padding:12px 16px;">Chủ sở hữu</th>
              <th style="padding:12px 16px;">Gói dịch vụ</th>
              <th style="padding:12px 16px;">Thành viên (Seats)</th>
              <th style="padding:12px 16px;">Trạng thái</th>
              <th style="padding:12px 16px;">Ngày tạo</th>
              <th style="padding:12px 16px;text-align:right;">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            ${filtered.length === 0 ? `
              <tr>
                <td colspan="7" style="padding:48px;text-align:center;color:var(--muted);">
                  Không tìm thấy doanh nghiệp nào phù hợp với bộ lọc.
                </td>
              </tr>
            ` : filtered.map(org => {
              const plan = org.subscription.plan;
              const planBadgeBg = plan === 'enterprise' ? 'var(--green-soft)'
                : plan === 'business' ? 'var(--purple-soft)'
                : plan === 'starter' ? 'var(--blue-soft)'
                : 'var(--surface-3)';
              const planBadgeColor = plan === 'enterprise' ? 'var(--green)'
                : plan === 'business' ? 'var(--purple)'
                : plan === 'starter' ? 'var(--blue)'
                : 'var(--muted)';

              const statusColor = org.status === 'active' ? 'var(--green)' : 'var(--red)';
              const statusBg = org.status === 'active' ? 'var(--green-soft)' : 'var(--red-soft)';
              const statusText = org.status === 'active' ? 'Đang hoạt động' : 'Đã tạm khóa';

              return `
                <tr style="border-bottom:1px solid var(--line);">
                  <td style="padding:14px 16px;">
                    <div style="font-weight:600;color:var(--text);">${esc(org.name)}</div>
                    <div style="font-size:11px;color:var(--muted);font-family:monospace;">${esc(org.slug)}</div>
                  </td>
                  <td style="padding:14px 16px;color:var(--text);">
                    ${esc(org.ownerName)}
                  </td>
                  <td style="padding:14px 16px;">
                    <span style="background:${planBadgeBg};color:${planBadgeColor};font-size:11px;font-weight:700;padding:2px 8px;border-radius:4px;text-transform:uppercase;">
                      ${esc(plan)}
                    </span>
                  </td>
                  <td style="padding:14px 16px;color:var(--text);font-weight:500;">
                    ${org.activeMembersCount} / ${org.subscription.seatLimit}
                  </td>
                  <td style="padding:14px 16px;">
                    <span style="background:${statusBg};color:${statusColor};font-size:11px;font-weight:600;padding:2px 8px;border-radius:4px;display:inline-flex;align-items:center;gap:4px;">
                      <span style="font-size:8px;">●</span> ${statusText}
                    </span>
                  </td>
                  <td style="padding:14px 16px;color:var(--muted);font-size:12px;">
                    ${formatDate(org.createdAt)}
                  </td>
                  <td style="padding:14px 16px;text-align:right;">
                    <div style="display:inline-flex;gap:6px;">
                      <button type="button" class="btn edit-plan-btn" data-id="${org.id}" style="padding:4px 10px;font-size:12px;border:1px solid var(--line);border-radius:6px;background:var(--surface);color:var(--text);cursor:pointer;" title="Chỉnh sửa gói cước và seats">
                        Đổi gói
                      </button>
                      ${org.status === 'active' ? `
                        <button type="button" class="btn toggle-status-btn danger" data-id="${org.id}" data-action="suspend" style="padding:4px 10px;font-size:12px;border:1px solid rgba(174,58,74,0.3);border-radius:6px;background:var(--red-soft);color:var(--red);cursor:pointer;" title="Tạm khóa tổ chức này">
                          Khóa
                        </button>
                      ` : `
                        <button type="button" class="btn toggle-status-btn success" data-id="${org.id}" data-action="activate" style="padding:4px 10px;font-size:12px;border:1px solid rgba(16,115,83,0.3);border-radius:6px;background:var(--green-soft);color:var(--green);cursor:pointer;" title="Mở khóa tổ chức này">
                          Mở khóa
                        </button>
                      `}
                    </div>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  // Attach search & filter events
  const searchInput = container.querySelector('#tenantSearchInput');
  searchInput?.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    renderTenantsTab(container);
  });

  const statusSelect = container.querySelector('#tenantStatusSelect');
  statusSelect?.addEventListener('change', (e) => {
    filterStatus = e.target.value;
    renderTenantsTab(container);
  });

  const planSelect = container.querySelector('#tenantPlanSelect');
  planSelect?.addEventListener('change', (e) => {
    filterPlan = e.target.value;
    renderTenantsTab(container);
  });

  container.querySelector('#refreshTenantsBtn')?.addEventListener('click', () => {
    loadData();
  });

  // Attach row action events
  container.querySelectorAll('.toggle-status-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const orgId = btn.dataset.id;
      const action = btn.dataset.action;
      const newStatus = action === 'suspend' ? 'suspended' : 'active';
      const promptText = action === 'suspend'
        ? 'Bạn có chắc chắn muốn TẠM KHÓA doanh nghiệp này? Các thành viên sẽ không thể đăng nhập hoặc tạo mới công việc.'
        : 'Mở khóa doanh nghiệp này và cho phép hoạt động trở lại?';

      if (!confirm(promptText)) return;

      try {
        btn.disabled = true;
        await PlatformAdminService.updateOrgStatus(orgId, newStatus);
        const match = cachedOrgs.find(o => o.id === orgId);
        if (match) match.status = newStatus;
        renderTenantsTab(container);
      } catch (err) {
        alert('Lỗi cập nhật trạng thái: ' + err.message);
      } finally {
        btn.disabled = false;
      }
    });
  });

  container.querySelectorAll('.edit-plan-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const orgId = btn.dataset.id;
      const org = cachedOrgs.find(o => o.id === orgId);
      if (org) openEditPlanModal(org);
    });
  });
}

function openEditPlanModal(org) {
  const existing = document.getElementById('editPlanDialog');
  if (existing) existing.remove();

  const modal = document.createElement('dialog');
  modal.id = 'editPlanDialog';
  modal.className = 'dialog';
  modal.style.cssText = `
    width: 90vw;
    max-width: 440px;
    padding: 24px;
    border: 1px solid var(--line);
    border-radius: 12px;
    background: var(--surface);
    color: var(--text);
    box-shadow: 0 12px 36px rgba(0,0,0,0.25);
  `;

  modal.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
      <h3 style="margin:0;font-size:16px;font-weight:700;color:var(--text);">Điều chỉnh Gói cước & Seats</h3>
      <button type="button" id="closeEditPlanBtn" style="background:none;border:none;cursor:pointer;color:var(--muted);font-size:18px;">✕</button>
    </div>
    <p style="margin:0 0 16px 0;font-size:13px;color:var(--muted);">Doanh nghiệp: <strong style="color:var(--text);">${esc(org.name)}</strong></p>

    <form id="editPlanForm" style="display:flex;flex-direction:column;gap:14px;">
      <label style="display:flex;flex-direction:column;gap:6px;font-size:12px;font-weight:600;color:var(--text);">
        Gói dịch vụ (Subscription Tier):
        <select id="planTierSelect" style="height:38px;padding:0 10px;border:1px solid var(--line);border-radius:8px;background:var(--surface-2);color:var(--text);font-size:13px;">
          <option value="free" ${org.subscription.plan === 'free' ? 'selected' : ''}>Free (Miễn phí)</option>
          <option value="starter" ${org.subscription.plan === 'starter' ? 'selected' : ''}>Starter Plan</option>
          <option value="business" ${org.subscription.plan === 'business' ? 'selected' : ''}>Business Plan</option>
          <option value="enterprise" ${org.subscription.plan === 'enterprise' ? 'selected' : ''}>Enterprise (Không giới hạn)</option>
        </select>
      </label>

      <label style="display:flex;flex-direction:column;gap:6px;font-size:12px;font-weight:600;color:var(--text);">
        Số lượng Seats tối đa:
        <input type="number" id="seatLimitInput" min="1" max="10000" value="${org.subscription.seatLimit}" style="height:38px;padding:0 10px;border:1px solid var(--line);border-radius:8px;background:var(--surface-2);color:var(--text);font-size:13px;">
      </label>

      <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:12px;">
        <button type="button" id="cancelEditPlanBtn" class="btn" style="padding:8px 14px;border:1px solid var(--line);border-radius:8px;background:var(--surface);cursor:pointer;color:var(--text);font-size:13px;">Hủy</button>
        <button type="submit" class="btn primary" style="padding:8px 16px;border:none;border-radius:8px;background:var(--primary);color:#fff;cursor:pointer;font-size:13px;font-weight:600;">Lưu thay đổi</button>
      </div>
    </form>
  `;

  document.body.appendChild(modal);
  modal.showModal();

  modal.querySelector('#closeEditPlanBtn').addEventListener('click', () => modal.close());
  modal.querySelector('#cancelEditPlanBtn').addEventListener('click', () => modal.close());

  modal.querySelector('#editPlanForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const newPlan = modal.querySelector('#planTierSelect').value;
    const newSeatLimit = parseInt(modal.querySelector('#seatLimitInput').value, 10);

    const submitBtn = modal.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Đang lưu...';

    try {
      await PlatformAdminService.updateSubscription(org.id, {
        plan: newPlan,
        seatLimit: newSeatLimit
      });

      org.subscription.plan = newPlan;
      org.subscription.seatLimit = newSeatLimit;

      modal.close();
      const content = adminDialogEl?.querySelector('#platformAdminContent');
      if (content) renderTenantsTab(content);
    } catch (err) {
      alert('Lỗi cập nhật gói cước: ' + err.message);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Lưu thay đổi';
    }
  });
}

/**
 * Mở hộp thoại Platform Super-Admin
 */
export async function openPlatformAdminDialog() {
  const dialog = createPlatformAdminDialog();
  dialog.showModal();
  await loadData();
}
