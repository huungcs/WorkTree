/**
 * WorkTree X Feature: Task External Share Modal UI
 * Upgrades naive public share modals with:
 * - Strict view / comment / edit_progress levels (NEVER allowing guest task deletion)
 * - Internal-comment isolation & optional checklist toggling
 * - Expiry & optional PIN lock + 1-click revoke/rotate link management
 */

import { TaskShareService } from '../services/task-share-service.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SHARE_ICON_SVG = '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>';

const PERMISSION_META = {
  view: {
    title: 'Chỉ xem',
    desc: 'Khách xem tiêu đề, mô tả, tiến độ & checklist (tự động ẩn thông tin nội bộ).'
  },
  comment: {
    title: 'Xem & Phản hồi',
    desc: 'Khách nhập tên để bình luận trao đổi, tùy chọn cho phép tick/thêm checklist.'
  },
  edit_progress: {
    title: 'Cập nhật tiến độ (Không Xóa)',
    desc: 'Khách đổi trạng thái, cập nhật % và checklist; cấm hoàn toàn xóa công việc.'
  }
};

function esc(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function injectShareStyles() {
  if (typeof document === 'undefined' || document.getElementById('wtTaskShareStyles')) return;
  const style = document.createElement('style');
  style.id = 'wtTaskShareStyles';
  style.textContent = `
    #taskShareDialog.wt-share-dialog {
      width: min(560px, calc(100vw - 24px));
      max-height: min(88dvh, 760px);
      padding: 0;
      border: 1px solid var(--line);
      border-radius: var(--radius-dialog, 17px);
      background: var(--surface);
      color: var(--text);
      box-shadow: var(--shadow-lg);
      overflow: hidden;
    }
    #taskShareDialog[open] { display: flex; flex-direction: column; }
    #taskShareDialog::backdrop { background: rgba(15, 21, 36, .45); backdrop-filter: blur(2px); }
    #taskShareDialog .wt-share-head {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
      padding: 16px 20px;
      border-bottom: 1px solid var(--line);
    }
    #taskShareDialog .wt-share-head h2 {
      margin: 0;
      font-size: 16px;
      font-weight: 700;
      line-height: 1.35;
    }
    #taskShareDialog .wt-share-sub {
      margin: 3px 0 0;
      font-size: 12px;
      color: var(--muted);
    }
    #taskShareDialog .wt-share-body {
      padding: 16px 20px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    #taskShareDialog .wt-share-radio-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    #taskShareDialog .wt-share-radio {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 10px 12px;
      border-radius: var(--radius-md, 8px);
      border: 1px solid var(--line);
      background: var(--surface-2);
      cursor: pointer;
      transition: border-color .15s ease, background .15s ease;
    }
    #taskShareDialog .wt-share-radio:has(input:checked) {
      border-color: var(--primary);
      background: var(--primary-soft);
    }
    #taskShareDialog .wt-share-radio input {
      margin-top: 3px;
      accent-color: var(--primary);
    }
    #taskShareDialog .wt-share-radio strong {
      display: block;
      font-size: 13px;
    }
    #taskShareDialog .wt-share-radio small {
      display: block;
      font-size: 12px;
      color: var(--muted);
      margin-top: 2px;
    }
    #taskShareDialog .wt-share-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }
    #taskShareDialog .wt-share-field {
      display: flex;
      flex-direction: column;
      gap: 5px;
      font-size: 12px;
      font-weight: 600;
    }
    #taskShareDialog .wt-share-field input,
    #taskShareDialog .wt-share-field select {
      min-height: 36px;
      border: 1px solid var(--line-strong);
      border-radius: var(--radius-md, 8px);
      background: var(--surface);
      color: var(--text);
      padding: 6px 10px;
      font-size: 13px;
      font-weight: 500;
    }
    #taskShareDialog .wt-share-checks {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 10px 12px;
      border-radius: var(--radius-md, 8px);
      background: var(--surface-2);
      border: 1px solid var(--line);
    }
    #taskShareDialog .wt-share-check {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      cursor: pointer;
    }
    #taskShareDialog .wt-share-check input { accent-color: var(--primary); }
    #taskShareDialog .wt-share-alert {
      padding: 10px 12px;
      border-radius: var(--radius-md, 8px);
      font-size: 13px;
      background: var(--amber-soft);
      color: var(--amber);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      flex-wrap: wrap;
    }
    #taskShareDialog .wt-share-err {
      padding: 10px 12px;
      border-radius: var(--radius-md, 8px);
      font-size: 13px;
      background: var(--red-soft);
      color: var(--red);
    }
    #taskShareDialog .wt-share-links {
      display: flex;
      flex-direction: column;
      gap: 8px;
      border-top: 1px solid var(--line);
      padding-top: 14px;
    }
    #taskShareDialog .wt-share-link-card {
      padding: 10px 12px;
      border-radius: var(--radius-md, 8px);
      background: var(--surface-2);
      border: 1px solid var(--line);
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    #taskShareDialog .wt-share-link-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      flex-wrap: wrap;
    }
    #taskShareDialog .wt-share-pill {
      display: inline-flex;
      align-items: center;
      padding: 2px 8px;
      border-radius: var(--radius-pill, 999px);
      font-size: 11px;
      font-weight: 600;
      background: var(--primary-soft);
      color: var(--primary-text);
    }
    #taskShareDialog .wt-share-pill.paused {
      background: var(--amber-soft);
      color: var(--amber);
    }
    #taskShareDialog .wt-share-link-actions {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
    }
    @media (max-width: 900px) {
      #taskShareDialog.wt-share-dialog {
        width: 100vw;
        max-width: 100vw;
        max-height: 92dvh;
        margin: auto 0 0;
        border-radius: var(--radius-dialog, 17px) var(--radius-dialog, 17px) 0 0;
      }
      #taskShareDialog .wt-share-grid { grid-template-columns: 1fr; }
      #taskShareDialog .btn { min-height: 44px; }
      #taskShareDialog .wt-share-body { padding-bottom: max(18px, env(safe-area-inset-bottom, 0px)); }
    }
  `;
  document.head.appendChild(style);
}

function formatExpiry(iso) {
  if (!iso) return 'Không giới hạn';
  const diffMs = new Date(iso).getTime() - Date.now();
  if (diffMs <= 0) return 'Đã hết hạn';
  const hours = Math.round(diffMs / 3600000);
  if (hours < 24) return `Còn ~${hours} giờ`;
  return `Hết hạn ${new Date(iso).toLocaleDateString('vi-VN')}`;
}

export function initTaskShareUI({ getContext, onToast } = {}) {
  if (typeof document === 'undefined') return () => {};
  injectShareStyles();

  const state = {
    dialog: null,
    taskId: null,
    taskTitle: '',
    organizationId: null,
    loading: false,
    error: '',
    canShare: false,
    isAdmin: false,
    allowExternalTaskShare: true,
    links: []
  };

  function toast(msg, kind = 'info') {
    if (typeof onToast === 'function') onToast(msg, kind);
  }

  async function copyUrl(url) {
    if (!url) return false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        toast('Đã sao chép liên kết chia sẻ công việc.', 'success');
        return true;
      }
    } catch {}
    toast(`Link chia sẻ: ${url}`, 'info');
    return false;
  }

  function ensureDialog() {
    let dlg = document.getElementById('taskShareDialog');
    if (!dlg) {
      dlg = document.createElement('dialog');
      dlg.id = 'taskShareDialog';
      dlg.className = 'dialog wt-share-dialog';
      dlg.setAttribute('aria-labelledby', 'taskShareDialogTitle');
      document.body.appendChild(dlg);
    }
    state.dialog = dlg;
    return dlg;
  }

  async function reloadLinks() {
    if (!state.organizationId || !state.taskId) return;
    state.loading = true;
    state.error = '';
    renderDialog();
    try {
      const data = await TaskShareService.listShareLinks(state.organizationId, state.taskId);
      state.links = data.links || [];
      state.canShare = Boolean(data.canShare);
      state.isAdmin = Boolean(data.isAdmin);
      state.allowExternalTaskShare = data.allowExternalTaskShare !== false;
    } catch (err) {
      state.error = err.message || 'Không thể tải danh sách liên kết chia sẻ.';
    } finally {
      state.loading = false;
      renderDialog();
    }
  }

  function renderDialog() {
    const dlg = ensureDialog();
    const policyDisabled = state.allowExternalTaskShare === false;

    dlg.innerHTML = `
      <div class="wt-share-head">
        <div>
          <h2 id="taskShareDialogTitle" tabindex="-1">Chia sẻ công việc: ${esc(state.taskTitle || 'Công việc')}</h2>
          <p class="wt-share-sub">Tạo link công khai chỉ phạm vi đúng công việc này · Không bao giờ cho phép Xóa</p>
        </div>
        <button type="button" class="icon-btn" id="wtShareCloseBtn" aria-label="Đóng cửa sổ chia sẻ">&times;</button>
      </div>
      <div class="wt-share-body">
        ${state.error ? `<div class="wt-share-err" role="alert">${esc(state.error)}</div>` : ''}
        ${policyDisabled ? `
          <div class="wt-share-alert">
            <span>Doanh nghiệp đang tắt chia sẻ công việc ra ngoài.</span>
            ${state.isAdmin ? '<button type="button" class="btn small" id="wtShareEnableOrgBtn">Bật lại</button>' : ''}
          </div>
        ` : ''}

        ${state.canShare && !policyDisabled ? `
          <form id="wtShareCreateForm" style="display:flex;flex-direction:column;gap:12px;">
            <div>
              <div style="font-size:12px;font-weight:700;margin-bottom:6px;">Cho phép người nhận liên kết</div>
              <div class="wt-share-radio-list">
                ${Object.entries(PERMISSION_META).map(([val, meta], idx) => `
                  <label class="wt-share-radio">
                    <input type="radio" name="permission" value="${val}" ${idx === 0 ? 'checked' : ''}>
                    <span>
                      <strong>${esc(meta.title)}</strong>
                      <small>${esc(meta.desc)}</small>
                    </span>
                  </label>
                `).join('')}
              </div>
            </div>

            <div class="wt-share-checks">
              <label class="wt-share-check">
                <input type="checkbox" name="hideInternalComments" checked>
                <span>Ẩn bình luận nội bộ (khách chỉ thấy trao đổi công khai)</span>
              </label>
              <label class="wt-share-check">
                <input type="checkbox" name="allowChecklistToggle" id="wtShareAllowChecklist">
                <span>Cho phép khách tick / thêm mục checklist (khi chọn Phản hồi)</span>
              </label>
            </div>

            <div class="wt-share-grid">
              <label class="wt-share-field">
                <span>Thời hạn liên kết</span>
                <select name="expiresInHours">
                  <option value="24">24 giờ</option>
                  <option value="168" selected>7 ngày (Khuyên dùng)</option>
                  <option value="720">30 ngày</option>
                  <option value="0">Không giới hạn</option>
                </select>
              </label>
              <label class="wt-share-field">
                <span>Mã PIN bảo vệ (tùy chọn)</span>
                <input type="password" name="pin" maxlength="12" autocomplete="new-password" placeholder="VD: 2468 (để trống nếu không)">
              </label>
            </div>

            <div style="display:flex;justify-content:flex-end;gap:8px;">
              <button type="button" class="btn" id="wtShareCancelBtn">Đóng</button>
              <button type="submit" class="btn primary" id="wtShareSubmitBtn">Tạo &amp; Sao chép link</button>
            </div>
          </form>
        ` : (!state.loading && !state.error && !policyDisabled ? '<p class="muted" style="margin:0;">Vai trò hiện tại không có quyền tạo liên kết chia sẻ công việc này.</p>' : '')}

        <div class="wt-share-links">
          <div style="display:flex;align-items:center;justify-content:space-between;">
            <strong style="font-size:13px;">Liên kết đang quản lý (${state.links.length})</strong>
            ${state.loading ? '<span class="muted" style="font-size:12px;">Đang tải...</span>' : ''}
          </div>
          ${state.links.length ? state.links.map(link => `
            <div class="wt-share-link-card">
              <div class="wt-share-link-top">
                <div>
                  <span class="wt-share-pill ${link.status !== 'active' ? 'paused' : ''}">
                    ${link.status === 'active' ? esc(PERMISSION_META[link.permission]?.title || link.permission) : 'Đang tạm khóa'}
                  </span>
                  ${link.hasPin ? '<span class="wt-share-pill" style="margin-left:4px;">Có mã PIN</span>' : ''}
                </div>
                <span class="muted" style="font-size:11px;">${Number(link.viewCount || 0)} lượt xem · ${esc(formatExpiry(link.expiresAt))}</span>
              </div>
              <div class="muted" style="font-size:12px;word-break:break-all;">${esc(link.url || `${link.tokenPrefix}...`)}</div>
              <div class="wt-share-link-actions">
                ${link.url ? `<button type="button" class="btn small" data-share-copy="${esc(link.url)}">Sao chép</button>` : ''}
                <button type="button" class="btn small" data-share-toggle="${esc(link.id)}">${link.status === 'active' ? 'Tạm dừng' : 'Mở lại'}</button>
                <button type="button" class="btn small" data-share-rotate="${esc(link.id)}">Đổi link</button>
                <button type="button" class="btn small danger" data-share-revoke="${esc(link.id)}">Thu hồi</button>
              </div>
            </div>
          `).join('') : (!state.loading ? '<p class="muted" style="margin:0;font-size:12px;">Chưa có liên kết chia sẻ nào cho công việc này.</p>' : '')}
        </div>
      </div>
    `;

    bindDialogEvents();
  }

  function bindDialogEvents() {
    const dlg = state.dialog;
    if (!dlg) return;

    dlg.querySelector('#wtShareCloseBtn')?.addEventListener('click', () => dlg.close());
    dlg.querySelector('#wtShareCancelBtn')?.addEventListener('click', () => dlg.close());

    dlg.querySelector('#wtShareEnableOrgBtn')?.addEventListener('click', async () => {
      try {
        await TaskShareService.setOrgSharePolicy(state.organizationId, true);
        toast('Đã bật lại tính năng chia sẻ công việc ra ngoài.', 'success');
        await reloadLinks();
      } catch (err) {
        state.error = err.message;
        renderDialog();
      }
    });

    const form = dlg.querySelector('#wtShareCreateForm');
    if (form) {
      const checklistCb = form.querySelector('#wtShareAllowChecklist');
      const syncPerm = () => {
        const chosen = form.querySelector('input[name="permission"]:checked')?.value || 'view';
        if (checklistCb) {
          if (chosen === 'edit_progress') {
            checklistCb.checked = true;
            checklistCb.disabled = true;
          } else if (chosen === 'view') {
            checklistCb.checked = false;
            checklistCb.disabled = true;
          } else {
            checklistCb.disabled = false;
          }
        }
      };
      form.querySelectorAll('input[name="permission"]').forEach(r => r.addEventListener('change', syncPerm));
      syncPerm();

      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(form);
        const submitBtn = form.querySelector('#wtShareSubmitBtn');
        if (submitBtn) submitBtn.disabled = true;
        try {
          const res = await TaskShareService.createShareLink(state.organizationId, state.taskId, {
            permission: String(fd.get('permission') || 'view'),
            hideInternalComments: fd.get('hideInternalComments') === 'on',
            allowChecklistToggle: checklistCb ? checklistCb.checked : false,
            expiresInHours: Number(fd.get('expiresInHours') || 168),
            pin: String(fd.get('pin') || '').trim() || null,
            label: `Chia sẻ: ${state.taskTitle || 'Công việc'}`.slice(0, 120)
          });
          if (res.link?.url) {
            await copyUrl(res.link.url);
          }
          await reloadLinks();
        } catch (err) {
          state.error = err.message;
          renderDialog();
        } finally {
          if (submitBtn) submitBtn.disabled = false;
        }
      });
    }

    dlg.querySelectorAll('[data-share-copy]').forEach(btn => {
      btn.addEventListener('click', () => copyUrl(btn.dataset.shareCopy));
    });

    dlg.querySelectorAll('[data-share-toggle]').forEach(btn => {
      btn.addEventListener('click', async () => {
        try {
          await TaskShareService.toggleShareLink(state.organizationId, btn.dataset.shareToggle);
          toast('Đã cập nhật trạng thái liên kết.', 'success');
          await reloadLinks();
        } catch (err) {
          state.error = err.message;
          renderDialog();
        }
      });
    });

    dlg.querySelectorAll('[data-share-rotate]').forEach(btn => {
      btn.addEventListener('click', async () => {
        try {
          const res = await TaskShareService.rotateShareLink(state.organizationId, btn.dataset.shareRotate);
          if (res.link?.url) await copyUrl(res.link.url);
          toast('Đã đổi link mới và vô hiệu hóa link cũ.', 'success');
          await reloadLinks();
        } catch (err) {
          state.error = err.message;
          renderDialog();
        }
      });
    });

    dlg.querySelectorAll('[data-share-revoke]').forEach(btn => {
      btn.addEventListener('click', async () => {
        try {
          await TaskShareService.revokeShareLink(state.organizationId, btn.dataset.shareRevoke);
          toast('Đã thu hồi liên kết chia sẻ.', 'success');
          await reloadLinks();
        } catch (err) {
          state.error = err.message;
          renderDialog();
        }
      });
    });
  }

  async function openTaskShareDialog({ taskId, taskTitle = '' } = {}) {
    const ctx = typeof getContext === 'function' ? getContext() : {};
    const orgId = ctx?.organizationId;
    if (!orgId || !UUID_REGEX.test(String(taskId || ''))) {
      toast('Tính năng chia sẻ ra ngoài khả dụng cho không gian làm việc đám mây.', 'info');
      return;
    }

    state.organizationId = orgId;
    state.taskId = String(taskId);
    state.taskTitle = taskTitle || document.getElementById('drawerTitle')?.textContent?.trim() || 'Công việc';
    state.links = [];
    state.error = '';

    const dlg = ensureDialog();
    renderDialog();
    if (!dlg.open && typeof dlg.showModal === 'function') {
      dlg.showModal();
    }
    dlg.querySelector('#taskShareDialogTitle')?.focus({ preventScroll: true });
    await reloadLinks();
  }

  function attachDrawerShareButton(event) {
    const taskId = String(event?.detail?.taskId || '');
    const ctx = typeof getContext === 'function' ? getContext() : {};
    if (!ctx?.isCloud || !UUID_REGEX.test(taskId)) return;
    if (ctx.role === 'viewer') return;

    const tools = document.querySelector('#drawerContent .drawer-tools');
    if (!tools || tools.querySelector('[data-worktree-share-btn]')) return;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'icon-btn';
    btn.dataset.worktreeShareBtn = taskId;
    btn.title = 'Chia sẻ công việc ra ngoài';
    btn.setAttribute('aria-label', 'Chia sẻ công việc ra ngoài');
    btn.innerHTML = SHARE_ICON_SVG;
    btn.addEventListener('click', () => {
      const title = document.getElementById('drawerTitle')?.textContent?.trim() || '';
      openTaskShareDialog({ taskId, taskTitle: title });
    });

    const firstTool = tools.firstElementChild;
    if (firstTool) tools.insertBefore(btn, firstTool);
    else tools.appendChild(btn);
  }

  document.addEventListener('worktree:task-drawer-rendered', attachDrawerShareButton);

  if (typeof window !== 'undefined') {
    window.openTaskShareDialog = openTaskShareDialog;
  }

  return () => {
    document.removeEventListener('worktree:task-drawer-rendered', attachDrawerShareButton);
  };
}
