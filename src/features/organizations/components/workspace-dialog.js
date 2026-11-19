/**
 * WorkTree X Feature: Workspace Dialog Component
 * Handles:
 * 1. Zero-Organization Onboarding & New Workspace Creation
 * 2. Multi-Organization Switcher with role badges and active indicators
 * Adheres strictly to WorkTree X Design System tokens and accessibility rules.
 */

import { OrgService, ROLE_LABELS } from '../services/org-service.js';

function foldBlueprintText(str) {
  return String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

export function generateOrgBlueprintFromDescription(description = '') {
  const raw = String(description || '').trim();
  if (!raw) return null;
  const f = foldBlueprintText(raw);
  const departments = [];

  if (/\b(agency|marketing|ads|content|design|truyen thong|sang tao|tiktok|branding)\b/.test(f)) {
    departments.push(
      {
        name: 'Phòng Nội dung (Content)',
        type: 'department',
        description: 'Sản xuất nội dung, kịch bản & lịch đăng đa kênh',
        projects: [{ name: 'Kế hoạch Content Tháng 1', description: 'Trụ cột nội dung & lịch xuất bản' }],
        starterTasks: [{
          title: 'Xây dựng bộ khung nội dung & lịch đăng 14 ngày',
          priority: 'high',
          estimateMinutes: 240,
          tags: ['Content', 'Onboarding'],
          checklist: ['Chốt 3 nhóm thông điệp chính', 'Phân bổ lịch đăng Facebook / TikTok', 'Trình duyệt mẫu bài đầu tiên']
        }]
      },
      {
        name: 'Phòng Quảng cáo (Ads)',
        type: 'department',
        description: 'Triển khai, đo lường Pixel/CAPI và tối ưu chi phí',
        projects: [{ name: 'Chiến dịch Lead & Chuyển đổi', description: 'Theo dõi CPA/ROAS và creative thắng' }],
        starterTasks: [{
          title: 'Kiểm tra Pixel/Tracking & thiết lập chiến dịch thử nghiệm',
          priority: 'high',
          estimateMinutes: 180,
          tags: ['Ads', 'Tracking'],
          checklist: ['Kiểm tra sự kiện chuyển đổi', 'Chuẩn bị 3 nhóm đối tượng test', 'Đặt ngưỡng cảnh báo CPA']
        }]
      },
      {
        name: 'Phòng Thiết kế (Design)',
        type: 'department',
        description: 'Hình ảnh, video ngắn và tài nguyên thương hiệu',
        projects: [{ name: 'Bộ Creative & Template Chuẩn', description: 'Asset thiết kế dùng chung cho các chiến dịch' }],
        starterTasks: [{
          title: 'Chuẩn hóa bộ template thiết kế & kích thước social',
          priority: 'medium',
          estimateMinutes: 240,
          tags: ['Design', 'Brand'],
          checklist: ['Chốt bảng màu & font chuẩn', 'Tạo 5 layout banner quảng cáo', 'Chia sẻ thư mục asset cho Ads & Content']
        }]
      }
    );
  } else if (/\b(phan mem|it|cong nghe|tech|saas|dev|software|lap trinh|product)\b/.test(f)) {
    departments.push(
      {
        name: 'Phòng Sản phẩm & UI/UX',
        type: 'department',
        description: 'Yêu cầu nghiệp vụ, wireframe & trải nghiệm người dùng',
        projects: [{ name: 'Roadmap Phiên bản v1', description: 'Định nghĩa tính năng lõi & trải nghiệm' }],
        starterTasks: [{
          title: 'Chốt phạm vi tính năng MVP & luồng người dùng chính',
          priority: 'high',
          estimateMinutes: 240,
          tags: ['Product', 'UX'],
          checklist: ['Liệt kê luồng người dùng ưu tiên', 'Phác thảo màn hình chính', 'Review cùng Kỹ thuật trước Sprint']
        }]
      },
      {
        name: 'Phòng Kỹ thuật (Engineering)',
        type: 'department',
        description: 'Phát triển Backend, Frontend & kiểm thử tự động',
        projects: [{ name: 'Sprint Khởi tạo Hệ thống', description: 'Kiến trúc nền tảng & CI/CD' }],
        starterTasks: [{
          title: 'Thiết lập repo, phân quyền dữ liệu & pipeline kiểm thử',
          priority: 'high',
          estimateMinutes: 300,
          tags: ['Tech', 'Architecture'],
          checklist: ['Khởi tạo cấu trúc module & env', 'Thiết lập kiểm tra tự động', 'Kiểm thử luồng đăng nhập & phân quyền']
        }]
      }
    );
  } else {
    departments.push(
      {
        name: 'Phòng Kinh doanh',
        type: 'department',
        description: 'Tìm kiếm khách hàng, tư vấn và chốt hợp đồng',
        projects: [{ name: 'Pipeline Khách hàng Mục tiêu', description: 'Theo dõi cơ hội và tỷ lệ chuyển đổi' }],
        starterTasks: [{
          title: 'Thiết lập quy trình chăm sóc khách hàng & mục tiêu tháng',
          priority: 'high',
          estimateMinutes: 180,
          tags: ['Sales', 'KPI'],
          checklist: ['Xác định chỉ tiêu doanh số tuần', 'Phân loại nguồn khách hàng', 'Chốt lịch rà soát pipeline thứ 6']
        }]
      },
      {
        name: 'Phòng Vận hành',
        type: 'department',
        description: 'Điều phối công việc, chất lượng đầu ra và hậu cần',
        projects: [{ name: 'Quy trình Vận hành Chuẩn', description: 'Chuẩn hóa checklist bàn giao nội bộ' }],
        starterTasks: [{
          title: 'Rà soát quy trình bàn giao & phân công phụ trách',
          priority: 'medium',
          estimateMinutes: 120,
          tags: ['Ops', 'Process'],
          checklist: ['Liệt kê đầu việc lặp lại hàng tuần', 'Gắn người chịu trách nhiệm chính', 'Đặt mốc kiểm tra chất lượng']
        }]
      }
    );
  }

  // Detect explicit custom unit names listed after "gồm ..." / "gồm:"
  const listMatch = raw.match(/(?:gồm|bao gồm|gồm các bộ phận|gồm team)\s*:?\s*([^\n.]+)/i);
  if (listMatch && listMatch[1]) {
    const tokens = listMatch[1].split(/,|và|&|\//i).map(s => s.trim()).filter(s => s.length >= 2 && s.length <= 40);
    for (const tok of tokens.slice(0, 5)) {
      const ft = foldBlueprintText(tok);
      if (!departments.some(d => foldBlueprintText(d.name).includes(ft) || ft.includes(foldBlueprintText(d.name.replace(/^phòng\s+/i, ''))))) {
        departments.push({
          name: /^(phòng|team|ban|bộ phận|nhóm)/i.test(tok) ? tok : `Bộ phận ${tok}`,
          type: 'department',
          description: `Khởi tạo theo mô tả doanh nghiệp: "${tok}"`,
          projects: [],
          starterTasks: [{
            title: `Lập kế hoạch vận hành tuần đầu cho ${tok}`,
            priority: 'medium',
            estimateMinutes: 120,
            tags: ['Onboarding'],
            checklist: ['Xác định mục tiêu 30 ngày đầu', 'Phân công nhân sự phụ trách']
          }]
        });
      }
    }
  }

  return {
    summary: `Đề xuất ${departments.length} phòng ban & ${departments.reduce((s, d) => s + (d.starterTasks?.length || 0), 0)} đầu việc khởi đầu kèm checklist`,
    departments: departments.slice(0, 6)
  };
}

export class WorkspaceDialog {
  constructor(options = {}) {
    this.onWorkspaceChanged = options.onWorkspaceChanged || (() => {});
    this.onLogout = options.onLogout || (() => {});
    this.currentDialog = null;
    this.isSubmitting = false;
  }

  /**
   * Mở modal tạo workspace mới (hoặc Onboarding khi 0 orgs)
   */
  openCreateWorkspace({ isZeroOrg = false, defaultName = '' } = {}) {
    this.close();

    const dialog = document.createElement('dialog');
    dialog.className = 'dialog form-dialog small-dialog workspace-modal';
    dialog.id = 'createWorkspaceDialog';
    dialog.setAttribute('aria-labelledby', 'createWsTitle');
    dialog.setAttribute('aria-modal', 'true');

    dialog.innerHTML = `
      <form id="createWsForm" method="dialog">
        <div class="dialog-head">
          <div>
            <p class="overline">WORKTREE X / WORKSPACE</p>
            <h2 id="createWsTitle">${isZeroOrg ? 'Khởi tạo Workspace đầu tiên' : 'Tạo Workspace mới'}</h2>
          </div>
          ${!isZeroOrg ? `
            <button type="button" class="icon-btn" data-action="close-dialog" aria-label="Đóng" data-icon="x">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          ` : `
            <button type="button" class="btn text-btn" id="onboardingLogoutBtn" style="font-size:13px;color:var(--muted);">
              Đăng xuất
            </button>
          `}
        </div>

        <div class="dialog-scroll">
          ${isZeroOrg ? `
            <div class="onboarding-banner" style="margin-bottom:16px;padding:12px 14px;background:var(--primary-soft);border:1px solid var(--primary);border-radius:10px;font-size:13px;line-height:1.5;color:var(--text);">
              <strong>Chào mừng bạn đến với WorkTree X!</strong><br>
              Tài khoản của bạn chưa tham gia tổ chức nào. Hãy tạo một workspace mới cho doanh nghiệp hoặc nhóm của bạn để bắt đầu.
            </div>
          ` : ''}

          <div class="form-error" id="wsFormError" role="alert" style="display:none;margin-bottom:14px;padding:10px 14px;background:var(--red-soft);color:var(--red);border-radius:8px;font-size:13px;border:1px solid rgba(174,58,74,0.2);"></div>

          <div class="form-grid">
            <label class="field full">
              <span>Tên công ty / Doanh nghiệp <span class="required" style="color:var(--red);">*</span></span>
              <input id="wsName" name="name" maxlength="180" required placeholder="Ví dụ: TechCorp Solutions" value="${defaultName}" autocomplete="off">
            </label>

            <label class="field full">
              <span>Đường dẫn workspace (Slug) <span class="required" style="color:var(--red);">*</span></span>
              <input id="wsSlug" name="slug" maxlength="64" required placeholder="techcorp-solutions" autocomplete="off" spellcheck="false">
              <span class="field-hint" style="font-size:11px;color:var(--muted);margin-top:4px;">Chỉ dùng chữ thường không dấu, số và dấu gạch nối (-). Ví dụ: <code>four-group</code></span>
            </label>

            <label class="field full">
              <span>Múi giờ</span>
              <select id="wsTimezone" name="timezone">
                <option value="Asia/Ho_Chi_Minh" selected>Asia/Ho_Chi_Minh (GMT+7 · Việt Nam)</option>
                <option value="Asia/Bangkok">Asia/Bangkok (GMT+7 · Thái Lan)</option>
                <option value="Asia/Singapore">Asia/Singapore (GMT+8 · Singapore)</option>
                <option value="Asia/Tokyo">Asia/Tokyo (GMT+9 · Nhật Bản)</option>
                <option value="UTC">UTC (Giờ chuẩn quốc tế)</option>
              </select>
            </label>

            <div class="field full" style="padding:12px 14px;border-radius:10px;background:var(--surface-2);border:1px solid var(--line);">
              <label for="wsAiDesc" style="display:flex;align-items:center;justify-content:space-between;gap:8px;font-weight:600;margin-bottom:6px;">
                <span>✨ Khởi tạo nhanh cây tổ chức bằng AI (Tùy chọn)</span>
              </label>
              <textarea id="wsAiDesc" rows="2" maxlength="400" placeholder="Ví dụ: Agency marketing 12 người gồm Content, Ads, Design" style="width:100%;padding:8px 10px;border-radius:8px;border:1px solid var(--line-strong);background:var(--surface);color:var(--text);font:inherit;font-size:13px;resize:vertical;"></textarea>
              <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;">
                <button type="button" class="btn small" data-ws-preset="Agency marketing 12 người gồm Content, Ads, Design">Agency Marketing</button>
                <button type="button" class="btn small" data-ws-preset="Công ty phần mềm SaaS gồm Sản phẩm, Kỹ thuật, QA">Công ty Phần mềm</button>
                <button type="button" class="btn small" data-ws-preset="Doanh nghiệp bán lẻ gồm Kinh doanh, CSKH, Kho vận">Kinh doanh &amp; Vận hành</button>
              </div>
              <div id="wsAiPreview" style="margin-top:8px;font-size:12px;color:var(--muted);line-height:1.5;"></div>
            </div>
          </div>
        </div>

        <div class="dialog-foot">
          ${!isZeroOrg ? `
            <button type="button" class="btn" data-action="close-dialog">Hủy</button>
          ` : ''}
          <button type="submit" class="btn primary" id="wsSubmitBtn">
            <span class="btn-text">${isZeroOrg ? 'Khởi tạo và bắt đầu' : 'Tạo Workspace'}</span>
          </button>
        </div>
      </form>
    `;

    document.body.appendChild(dialog);
    this.currentDialog = dialog;

    // Elements
    const form = dialog.querySelector('#createWsForm');
    const nameInput = dialog.querySelector('#wsName');
    const slugInput = dialog.querySelector('#wsSlug');
    const tzSelect = dialog.querySelector('#wsTimezone');
    const aiDescInput = dialog.querySelector('#wsAiDesc');
    const aiPreviewEl = dialog.querySelector('#wsAiPreview');
    const errorEl = dialog.querySelector('#wsFormError');
    const submitBtn = dialog.querySelector('#wsSubmitBtn');
    const logoutBtn = dialog.querySelector('#onboardingLogoutBtn');

    let currentBlueprint = null;
    const updateAiPreview = () => {
      currentBlueprint = generateOrgBlueprintFromDescription(aiDescInput?.value || '');
      if (!aiPreviewEl) return;
      if (!currentBlueprint) {
        aiPreviewEl.innerHTML = '<span>Nhập mô tả 1–2 câu để AI dựng sẵn phòng ban, dự án mẫu &amp; checklist khởi đầu.</span>';
        return;
      }
      aiPreviewEl.innerHTML = `
        <strong style="color:var(--primary-text);display:block;margin-bottom:4px;">${this.escapeHtml(currentBlueprint.summary)}:</strong>
        <ul style="margin:0;padding-left:18px;display:grid;gap:2px;">
          ${currentBlueprint.departments.map(d => `<li><strong>${this.escapeHtml(d.name)}</strong>${d.projects?.length ? ` → ${this.escapeHtml(d.projects.map(p => p.name).join(', '))}` : ''}</li>`).join('')}
        </ul>
      `;
    };
    aiDescInput?.addEventListener('input', updateAiPreview);
    dialog.querySelectorAll('[data-ws-preset]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (aiDescInput) aiDescInput.value = btn.getAttribute('data-ws-preset') || '';
        updateAiPreview();
      });
    });
    updateAiPreview();

    // Auto slugify when name changes
    let slugManualEdited = false;
    slugInput.addEventListener('input', () => {
      slugManualEdited = true;
      slugInput.value = slugInput.value.toLowerCase().replace(/[^a-z0-9-]/g, '');
    });

    nameInput.addEventListener('input', () => {
      if (!slugManualEdited) {
        slugInput.value = OrgService.slugify(nameInput.value);
      }
    });

    // Close buttons
    dialog.querySelectorAll('[data-action="close-dialog"]').forEach(btn => {
      btn.addEventListener('click', () => this.close());
    });

    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        this.close();
        this.onLogout();
      });
    }

    // Submit handler
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (this.isSubmitting) return;

      const name = nameInput.value.trim();
      const slug = slugInput.value.trim().toLowerCase();
      const timezone = tzSelect.value;

      errorEl.style.display = 'none';
      errorEl.textContent = '';

      if (!name) {
        errorEl.textContent = 'Vui lòng nhập tên công ty.';
        errorEl.style.display = 'block';
        nameInput.focus();
        return;
      }

      if (!slug) {
        errorEl.textContent = 'Vui lòng nhập đường dẫn workspace (slug).';
        errorEl.style.display = 'block';
        slugInput.focus();
        return;
      }

      this.isSubmitting = true;
      submitBtn.disabled = true;
      const originalText = submitBtn.querySelector('.btn-text').textContent;
      submitBtn.querySelector('.btn-text').innerHTML = `
        <svg class="icon-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:inline-block;vertical-align:middle;margin-right:6px;"><circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle><path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"></path></svg>
        Đang khởi tạo...
      `;

      try {
        const blueprintToSeed = currentBlueprint;
        const newOrg = await OrgService.createNewOrganization(name, slug, timezone, {
          autoResolveSlugCollision: !slugManualEdited
        });
        this.close();
        await this.onWorkspaceChanged(newOrg.organizationId, newOrg);
        if (blueprintToSeed) {
          await this.applyOrgBlueprint(newOrg.organizationId, blueprintToSeed);
        }
      } catch (err) {
        const msg = err?.message || 'Không thể tạo workspace. Vui lòng thử lại.';
        if (msg.includes('đã được sử dụng')) {
          const base = OrgService.slugify(slug || name).slice(0, 55) || 'workspace';
          const suffix = Math.random().toString(36).slice(2, 6);
          slugInput.value = `${base}-${suffix}`;
          slugManualEdited = true;
          errorEl.textContent = 'Mã định danh (Slug) này đã có công ty khác sử dụng. Hệ thống đã gợi ý mã mới, vui lòng bấm Tạo lại.';
          slugInput.focus();
        } else {
          errorEl.textContent = msg;
        }
        errorEl.style.display = 'block';
        submitBtn.disabled = false;
        submitBtn.querySelector('.btn-text').textContent = originalText;
        this.isSubmitting = false;
      }
    });

    // Esc handler
    dialog.addEventListener('cancel', (e) => {
      if (isZeroOrg) {
        e.preventDefault(); // Cannot close with Esc if user has 0 orgs
      } else {
        this.close();
      }
    });

    dialog.showModal();
    nameInput.focus();
  }

  /**
   * Mở dialog Workspace Switcher cho phép chọn công ty hoặc tạo mới
   */
  openSwitcher({ organizations = [], activeOrganizationId = null, canCreateWorkspace = null } = {}) {
    this.close();

    const dialog = document.createElement('dialog');
    dialog.className = 'dialog form-dialog small-dialog workspace-switcher-dialog';
    dialog.id = 'workspaceSwitcherDialog';
    dialog.setAttribute('aria-labelledby', 'switcherTitle');
    dialog.setAttribute('aria-modal', 'true');

    // Only Owner and Admin can create new workspaces
    const activeOrg = organizations.find(o => o.organizationId === activeOrganizationId);
    const activeRole = activeOrg?.role || window.appState?.activeMembership?.role || (typeof window.currentAccount === 'function' ? window.currentAccount()?.role : null);
    const isOwnerOrAdmin = activeRole === 'owner' || activeRole === 'admin';
    const allowCreate = canCreateWorkspace !== null ? canCreateWorkspace : isOwnerOrAdmin;

    const orgListHtml = organizations.map(org => {
      const isActive = org.organizationId === activeOrganizationId;
      const roleLabel = ROLE_LABELS[org.role] || org.role;
      const initials = (org.name || 'W').slice(0, 2).toUpperCase();

      return `
        <button type="button" class="ws-switcher-item ${isActive ? 'active' : ''}" data-org-id="${org.organizationId}" role="option" aria-selected="${isActive}">
          <div class="ws-switcher-avatar">${initials}</div>
          <div class="ws-switcher-info">
            <strong class="ws-switcher-name">${this.escapeHtml(org.name)}</strong>
            <span class="ws-switcher-slug">${this.escapeHtml(org.slug || '')}</span>
          </div>
          <span class="ws-switcher-role role-badge-${org.role}">${roleLabel}</span>
          ${isActive ? `
            <span class="ws-switcher-check" title="Đang hoạt động">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
            </span>
          ` : ''}
        </button>
      `;
    }).join('');

    dialog.innerHTML = `
      <div class="dialog-head">
        <div>
          <p class="overline">WORKTREE X / KHÔNG GIAN</p>
          <h2 id="switcherTitle">Chuyển đổi Workspace</h2>
        </div>
        <button type="button" class="icon-btn" data-action="close-dialog" aria-label="Đóng" data-icon="x">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>

      <div class="dialog-scroll">
        <div class="ws-switcher-list" role="listbox" aria-label="Danh sách không gian làm việc">
          ${orgListHtml || '<div style="padding:20px;text-align:center;color:var(--muted);">Chưa có workspace nào.</div>'}
        </div>
      </div>

      <div class="dialog-foot" style="justify-content:space-between;">
        ${allowCreate ? `
        <button type="button" class="btn" id="switcherCreateNewBtn" style="gap:6px;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          Tạo workspace mới
        </button>
        ` : '<div></div>'}
        <button type="button" class="btn" data-action="close-dialog">Đóng</button>
      </div>
    `;

    document.body.appendChild(dialog);
    this.currentDialog = dialog;

    // Close handlers
    dialog.querySelectorAll('[data-action="close-dialog"]').forEach(btn => {
      btn.addEventListener('click', () => this.close());
    });

    dialog.addEventListener('cancel', () => this.close());

    // Switch workspace click
    dialog.querySelectorAll('.ws-switcher-item').forEach(btn => {
      btn.addEventListener('click', async () => {
        const orgId = btn.dataset.orgId;
        if (orgId === activeOrganizationId) {
          this.close();
          return;
        }

        // Visual loading feedback
        btn.style.opacity = '0.6';
        this.close();
        await this.onWorkspaceChanged(orgId);
      });
    });

    // Create new workspace from switcher
    const createNewBtn = dialog.querySelector('#switcherCreateNewBtn');
    if (createNewBtn) {
      createNewBtn.addEventListener('click', () => {
        this.openCreateWorkspace({ isZeroOrg: false });
      });
    }

    dialog.showModal();
  }

  async applyOrgBlueprint(organizationId, blueprint) {
    if (!organizationId || !blueprint?.departments?.length) return 0;
    if (typeof window === 'undefined' || !window.TreeService) return 0;
    let rootId = (window.appState?.nodes || []).find(n => !n.parent && !n.parent_id)?.id || null;
    if (!rootId && window.TreeService.loadOrganizationTree) {
      const roots = await window.TreeService.loadOrganizationTree(organizationId);
      rootId = roots?.[0]?.id || null;
    }
    if (!rootId) return 0;

    let createdCount = 0;
    for (let i = 0; i < blueprint.departments.length; i++) {
      const dept = blueprint.departments[i];
      const deptRes = await window.TreeService.createNode({
        organizationId,
        parentId: rootId,
        name: dept.name,
        type: dept.type || 'department',
        description: dept.description || '',
        sortOrder: i + 1
      });
      const deptId = deptRes?.created?.id;
      if (!deptId) continue;
      createdCount++;

      let firstProjectId = null;
      for (let j = 0; j < (dept.projects || []).length; j++) {
        const proj = dept.projects[j];
        const projRes = await window.TreeService.createNode({
          organizationId,
          parentId: deptId,
          name: proj.name,
          type: 'project',
          description: proj.description || '',
          sortOrder: j + 1
        });
        if (!firstProjectId && projRes?.created?.id) firstProjectId = projRes.created.id;
      }

      if (window.TaskService?.createTask) {
        for (const st of (dept.starterTasks || [])) {
          const createdTask = await window.TaskService.createTask({
            organizationId,
            nodeId: firstProjectId || deptId,
            title: st.title,
            description: 'Công việc khởi tạo mẫu từ AI Onboarding Blueprint.',
            priority: st.priority || 'medium',
            estimateMinutes: st.estimateMinutes || 120,
            tags: st.tags || ['Onboarding']
          });
          if (createdTask?.id && window.ChecklistService?.addItem && Array.isArray(st.checklist)) {
            for (const step of st.checklist) {
              await window.ChecklistService.addItem({ taskId: createdTask.id, content: step });
            }
          }
        }
      }
    }

    if (typeof window.loadWorkspaceData === 'function') {
      await window.loadWorkspaceData(organizationId, { quiet: true });
    }
    if (typeof window.toast === 'function') {
      window.toast(`AI đã khởi tạo ${createdCount} phòng ban mẫu và checklist ban đầu.`);
    }
    return createdCount;
  }

  openBlueprintGenerator({ organizationId, organizationName = 'Workspace' } = {}) {
    if (!organizationId) return;
    this.close();

    const dialog = document.createElement('dialog');
    dialog.className = 'dialog form-dialog small-dialog workspace-modal';
    dialog.id = 'aiBlueprintDialog';
    dialog.setAttribute('aria-labelledby', 'aiBpTitle');
    dialog.setAttribute('aria-modal', 'true');

    dialog.innerHTML = `
      <form id="aiBpForm" method="dialog">
        <div class="dialog-head">
          <div>
            <p class="overline">AI ONBOARDING · ${this.escapeHtml(organizationName)}</p>
            <h2 id="aiBpTitle">Khởi tạo cây tổ chức bằng AI</h2>
          </div>
          <button type="button" class="icon-btn" data-action="close-dialog" aria-label="Đóng">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
        <div class="dialog-scroll">
          <div class="form-error" id="aiBpError" role="alert" style="display:none;margin-bottom:12px;padding:10px 12px;background:var(--red-soft);color:var(--red);border-radius:8px;font-size:13px;"></div>
          <label class="field full">
            <span>Mô tả 1–2 câu mô hình doanh nghiệp của bạn</span>
            <textarea id="aiBpDesc" rows="3" maxlength="400" placeholder="Ví dụ: Agency marketing 12 người gồm Content, Ads, Design"></textarea>
          </label>
          <div style="display:flex;flex-wrap:wrap;gap:6px;margin:8px 0 12px;">
            <button type="button" class="btn small" data-bp-preset="Agency marketing 12 người gồm Content, Ads, Design">Agency Marketing</button>
            <button type="button" class="btn small" data-bp-preset="Công ty phần mềm SaaS gồm Sản phẩm, Kỹ thuật, QA">Công ty Phần mềm</button>
            <button type="button" class="btn small" data-bp-preset="Doanh nghiệp bán lẻ gồm Kinh doanh, CSKH, Kho vận">Kinh doanh &amp; Vận hành</button>
          </div>
          <div id="aiBpPreview" style="padding:12px;border-radius:10px;background:var(--surface-2);border:1px solid var(--line);font-size:12.5px;color:var(--muted);"></div>
        </div>
        <div class="dialog-foot">
          <button type="button" class="btn" data-action="close-dialog">Hủy</button>
          <button type="submit" class="btn primary" id="aiBpSubmitBtn">Áp dụng vào Workspace</button>
        </div>
      </form>
    `;

    document.body.appendChild(dialog);
    this.currentDialog = dialog;

    const descEl = dialog.querySelector('#aiBpDesc');
    const previewEl = dialog.querySelector('#aiBpPreview');
    const errorEl = dialog.querySelector('#aiBpError');
    const submitBtn = dialog.querySelector('#aiBpSubmitBtn');
    let blueprint = null;

    const refreshPreview = () => {
      blueprint = generateOrgBlueprintFromDescription(descEl.value);
      submitBtn.disabled = !blueprint;
      previewEl.innerHTML = blueprint
        ? `<strong style="color:var(--primary-text);display:block;margin-bottom:6px;">${this.escapeHtml(blueprint.summary)}:</strong><ul style="margin:0;padding-left:18px;display:grid;gap:4px;">${blueprint.departments.map(d => `<li><strong>${this.escapeHtml(d.name)}</strong>${d.projects?.length ? ` · Dự án: ${this.escapeHtml(d.projects.map(p => p.name).join(', '))}` : ''}</li>`).join('')}</ul>`
        : 'Nhập mô tả doanh nghiệp hoặc chọn một gợi ý mẫu để xem trước khung cây tổ chức.';
    };

    descEl.addEventListener('input', refreshPreview);
    dialog.querySelectorAll('[data-bp-preset]').forEach(b => b.addEventListener('click', () => {
      descEl.value = b.getAttribute('data-bp-preset') || '';
      refreshPreview();
    }));
    dialog.querySelectorAll('[data-action="close-dialog"]').forEach(b => b.addEventListener('click', () => this.close()));
    dialog.addEventListener('cancel', () => this.close());
    dialog.querySelector('#aiBpForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!blueprint || this.isSubmitting) return;
      this.isSubmitting = true;
      submitBtn.disabled = true;
      submitBtn.textContent = 'Đang tạo cây tổ chức...';
      try {
        await this.applyOrgBlueprint(organizationId, blueprint);
        this.close();
      } catch (err) {
        errorEl.textContent = err.message || 'Không thể khởi tạo cây tổ chức.';
        errorEl.style.display = 'block';
        submitBtn.disabled = false;
        submitBtn.textContent = 'Áp dụng vào Workspace';
        this.isSubmitting = false;
      }
    });

    refreshPreview();
    dialog.showModal();
    descEl.focus();
  }

  close() {
    if (this.currentDialog) {
      try {
        this.currentDialog.close();
      } catch (e) {}
      this.currentDialog.remove();
      this.currentDialog = null;
      this.isSubmitting = false;
    }
  }

  escapeHtml(str) {
    return (str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
