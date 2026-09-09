/**
 * WorkTree X Feature: Workspace Dialog Component
 * Handles:
 * 1. Zero-Organization Onboarding & New Workspace Creation
 * 2. Multi-Organization Switcher with role badges and active indicators
 * Adheres strictly to WorkTree X Design System tokens and accessibility rules.
 */

import { OrgService, ROLE_LABELS } from '../services/org-service.js';

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
    const errorEl = dialog.querySelector('#wsFormError');
    const submitBtn = dialog.querySelector('#wsSubmitBtn');
    const logoutBtn = dialog.querySelector('#onboardingLogoutBtn');

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
        const newOrg = await OrgService.createNewOrganization(name, slug, timezone);
        this.close();
        await this.onWorkspaceChanged(newOrg.organizationId, newOrg);
      } catch (err) {
        errorEl.textContent = err.message || 'Không thể tạo workspace. Vui lòng thử lại.';
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
  openSwitcher({ organizations = [], activeOrganizationId = null } = {}) {
    this.close();

    const dialog = document.createElement('dialog');
    dialog.className = 'dialog form-dialog small-dialog workspace-switcher-dialog';
    dialog.id = 'workspaceSwitcherDialog';
    dialog.setAttribute('aria-labelledby', 'switcherTitle');
    dialog.setAttribute('aria-modal', 'true');

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
        <button type="button" class="btn" id="switcherCreateNewBtn" style="gap:6px;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          Tạo workspace mới
        </button>
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
