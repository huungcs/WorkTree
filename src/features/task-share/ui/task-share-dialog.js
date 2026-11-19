/**
 * WorkTree X Feature: Task External Share Modal UI
 * Upgrades naive public share modals with:
 * - Strict view / comment / edit_progress levels (NEVER allowing guest task deletion)
 * - Internal-comment isolation & optional checklist toggling
 * - Expiry & optional PIN lock + 1-click revoke/rotate link management
 */

import { TaskShareService } from '../services/task-share-service.js';
import { ICONS } from '../../../design-system/icons.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SHARE_ICON_SVG = '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>';

const PERMISSION_META = {
  view: {
    title: 'Chỉ xem',
    desc: 'Xem tiêu đề, mô tả, tiến độ và checklist.'
  },
  comment: {
    title: 'Xem và phản hồi',
    desc: 'Bình luận bằng tên khách và dùng checklist nếu được cấp quyền.'
  },
  edit_progress: {
    title: 'Cập nhật tiến độ',
    desc: 'Đổi trạng thái, cập nhật phần trăm hoàn thành và checklist.'
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
      width: 580px;
    }
    #taskShareDialog[open] { display: flex; flex-direction: column; }
    #taskShareDialog::backdrop { backdrop-filter: none; }
    #taskShareDialog .wt-share-head {
      align-items: flex-start;
      padding-block: 16px;
    }
    #taskShareDialog .wt-share-title-group { min-width: 0; }
    #taskShareDialog .wt-share-task-title {
      display: -webkit-box;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 2;
      overflow: hidden;
      overflow-wrap: anywhere;
      margin: 5px 0 0;
      font-size: var(--text-control);
      color: var(--muted);
    }
    #taskShareDialog .wt-share-body {
      flex: 1 1 auto;
      min-height: 0;
      max-height: none;
      overscroll-behavior: contain;
    }
    #taskShareDialog .wt-share-body,
    #taskShareDialog #wtShareCreateForm { display: grid; align-content: start; gap: 14px; }
    #taskShareDialog #wtShareCreateForm { max-height: none; }
    #taskShareDialog .wt-share-permissions { min-width: 0; padding: 0; border: 0; margin: 0; }
    #taskShareDialog .wt-share-section-title {
      margin: 0 0 6px;
      padding: 0;
      font-size: var(--text-control);
      font-weight: var(--weight-semibold);
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
    #taskShareDialog .wt-share-radio:has(input:focus-visible) { outline: 2px solid var(--focus); outline-offset: 2px; }
    #taskShareDialog .wt-share-radio input {
      flex: none;
      margin-top: 3px;
      accent-color: var(--primary);
    }
    #taskShareDialog .wt-share-radio strong {
      display: block;
      font-size: var(--text-control);
    }
    #taskShareDialog .wt-share-radio small {
      display: block;
      font-size: var(--text-label);
      color: var(--muted);
      margin-top: 2px;
      line-height: var(--leading-copy);
    }
    #taskShareDialog .wt-share-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
    }
    #taskShareDialog .wt-share-field {
      grid-column: auto;
      min-width: 0;
    }
    #taskShareDialog .wt-share-field input,
    #taskShareDialog .wt-share-field select {
      min-height: 36px;
      background: var(--surface);
      color: var(--text);
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
      font-size: var(--text-label);
      min-height: 28px;
      line-height: var(--leading-copy);
      cursor: pointer;
    }
    #taskShareDialog .wt-share-check input { accent-color: var(--primary); flex: none; }
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
    #taskShareDialog .wt-share-links h3,
    #taskShareDialog .wt-share-empty { margin: 0; }
    #taskShareDialog .wt-share-empty,
    #taskShareDialog .wt-share-link-meta,
    #taskShareDialog .wt-share-link-url { font-size: var(--text-label); color: var(--muted); }
    #taskShareDialog .wt-share-link-url { overflow-wrap: anywhere; }
    #taskShareDialog .wt-share-badges { display: flex; flex-wrap: wrap; gap: 4px; }
    #taskShareDialog .wt-share-footer .btn.primary { min-width: 0; white-space: normal; }
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
      border-radius: var(--radius-badge,5px);
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
        width: 100%;
        max-height: var(--m-vh, 100dvh);
        height: var(--m-vh, 100dvh);
      }
      #taskShareDialog .wt-share-grid { grid-template-columns: 1fr; }
      #taskShareDialog .btn { min-height: 44px; }
      #taskShareDialog .wt-share-check { min-height: 44px; }
      #taskShareDialog .wt-share-head { padding-top: max(12px, env(safe-area-inset-top, 0px)); }
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
  let listRequest = 0;

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
    const request = ++listRequest;
    state.loading = true;
    state.error = '';
    renderDialog();
    try {
      const data = await TaskShareService.listShareLinks(state.organizationId, state.taskId);
      if (request !== listRequest) return;
      state.links = data.links || [];
      state.canShare = Boolean(data.canShare);
      state.isAdmin = Boolean(data.isAdmin);
      state.allowExternalTaskShare = data.allowExternalTaskShare !== false;
    } catch (err) {
      if (request === listRequest) state.error = err.message || 'Không thể tải danh sách liên kết chia sẻ.';
    } finally {
      if (request === listRequest) {
        state.loading = false;
        renderDialog();
      }
    }
  }

  function renderDialog() {
    const dlg = ensureDialog();
    const policyDisabled = state.allowExternalTaskShare === false;
    const canCreate = state.canShare && !policyDisabled;
    const scrollTop = dlg.querySelector('.wt-share-body')?.scrollTop || 0;
    const focusedId = dlg.contains(document.activeElement) ? document.activeElement.id : '';

    dlg.innerHTML = `
      <div class="dialog-head wt-share-head">
        <div class="wt-share-title-group">
          <h2 id="taskShareDialogTitle" tabindex="-1">Chia sẻ công việc</h2>
          <p class="wt-share-task-title">${esc(state.taskTitle || 'Công việc')}</p>
        </div>
        <button type="button" class="icon-btn" id="wtShareCloseBtn" aria-label="Đóng cửa sổ chia sẻ">${ICONS.x}</button>
      </div>
      <div class="dialog-scroll wt-share-body">
        <div class="wt-share-err" role="alert" ${state.error ? '' : 'hidden'}>${esc(state.error)}</div>
        ${policyDisabled ? `
          <div class="wt-share-alert">
            <span>Doanh nghiệp đang tắt chia sẻ công việc ra ngoài.</span>
            ${state.isAdmin ? '<button type="button" class="btn small" id="wtShareEnableOrgBtn">Bật lại</button>' : ''}
          </div>
        ` : ''}

        ${canCreate ? `
          <form id="wtShareCreateForm">
            <fieldset class="wt-share-permissions">
              <legend class="wt-share-section-title">Quyền của người nhận</legend>
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
            </fieldset>

            <div class="wt-share-checks">
              <label class="wt-share-check">
                <input type="checkbox" name="hideInternalComments" checked>
                <span>Ẩn bình luận nội bộ</span>
              </label>
              <label class="wt-share-check">
                <input type="checkbox" name="allowChecklistToggle" id="wtShareAllowChecklist">
                <span>Cho phép khách đánh dấu và thêm mục checklist</span>
              </label>
            </div>

            <div class="wt-share-grid">
              <label class="field wt-share-field">
                <span>Thời hạn liên kết</span>
                <select name="expiresInHours">
                  <option value="24">24 giờ</option>
                  <option value="168" selected>7 ngày (Khuyên dùng)</option>
                  <option value="720">30 ngày</option>
                  <option value="0">Không giới hạn</option>
                </select>
              </label>
              <label class="field wt-share-field">
                <span>Mã PIN bảo vệ (tùy chọn)</span>
                <input type="password" name="pin" maxlength="12" autocomplete="new-password" placeholder="Nhập mã PIN">
              </label>
            </div>

          </form>
        ` : (!state.loading && !state.error && !policyDisabled ? '<p class="muted" style="margin:0;">Vai trò hiện tại không có quyền tạo liên kết chia sẻ công việc này.</p>' : '')}

        <section class="wt-share-links" aria-labelledby="wtShareLinksTitle" aria-busy="${state.loading}">
          <h3 class="wt-share-section-title" id="wtShareLinksTitle">Liên kết đã tạo${state.loading ? '' : ` (${state.links.length})`}</h3>
          ${state.loading ? '<p class="wt-share-empty" role="status">Đang tải liên kết…</p>' : ''}
          ${state.links.length ? state.links.map(link => `
            <div class="wt-share-link-card">
              <div class="wt-share-link-top">
                <div class="wt-share-badges">
                  <span class="wt-share-pill">${esc(PERMISSION_META[link.permission]?.title || link.permission)}</span>
                  ${link.status !== 'active' ? `<span class="wt-share-pill paused">${link.status === 'revoked' ? 'Đã thu hồi' : 'Tạm dừng'}</span>` : ''}
                  ${link.hasPin ? '<span class="wt-share-pill">Có mã PIN</span>' : ''}
                </div>
                <span class="wt-share-link-meta">${Number(link.viewCount || 0)} lượt xem · ${esc(formatExpiry(link.expiresAt))}</span>
              </div>
              <div class="wt-share-link-url">${esc(link.url || `${link.tokenPrefix}…`)}</div>
              ${link.status !== 'revoked' ? `<div class="wt-share-link-actions">
                ${link.url && link.status === 'active' ? `<button type="button" class="btn small" data-share-copy="${esc(link.url)}">Sao chép</button>` : ''}
                <button type="button" class="btn small" data-share-toggle="${esc(link.id)}">${link.status === 'active' ? 'Tạm dừng' : 'Mở lại'}</button>
                <button type="button" class="btn small" data-share-rotate="${esc(link.id)}">Đổi liên kết</button>
                <button type="button" class="btn small danger" data-share-revoke="${esc(link.id)}">Thu hồi</button>
              </div>` : ''}
            </div>
          `).join('') : (!state.loading && !state.error ? '<p class="wt-share-empty">Chưa có liên kết chia sẻ.</p>' : '')}
        </section>
      </div>
      <div class="dialog-foot wt-share-footer">
        <button type="button" class="btn" id="wtShareCancelBtn">Đóng</button>
        ${canCreate ? '<button type="submit" form="wtShareCreateForm" class="btn primary" id="wtShareSubmitBtn">Tạo và sao chép</button>' : ''}
      </div>
    `;

    dlg.querySelector('.wt-share-body').scrollTop = scrollTop;
    bindDialogEvents();
    if (focusedId) {
      (document.getElementById(focusedId) || dlg.querySelector('#taskShareDialogTitle')).focus({ preventScroll: true });
    }
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
      let commentChecklist = false;
      checklistCb.addEventListener('change', () => { commentChecklist = checklistCb.checked; });
      const syncPerm = () => {
        const chosen = form.querySelector('input[name="permission"]:checked')?.value || 'view';
        checklistCb.checked = chosen === 'edit_progress' || (chosen === 'comment' && commentChecklist);
        checklistCb.disabled = chosen !== 'comment';
      };
      form.querySelectorAll('input[name="permission"]').forEach(r => r.addEventListener('change', syncPerm));
      syncPerm();

      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(form);
        const submitBtn = dlg.querySelector('#wtShareSubmitBtn');
        if (submitBtn.disabled) return;
        const request = listRequest;
        submitBtn.disabled = true;
        submitBtn.textContent = 'Đang tạo liên kết…';
        try {
          const res = await TaskShareService.createShareLink(state.organizationId, state.taskId, {
            permission: String(fd.get('permission') || 'view'),
            hideInternalComments: fd.get('hideInternalComments') === 'on',
            allowChecklistToggle: checklistCb ? checklistCb.checked : false,
            expiresInHours: Number(fd.get('expiresInHours') || 168),
            pin: String(fd.get('pin') || '').trim() || null,
            label: `Chia sẻ: ${state.taskTitle || 'Công việc'}`.slice(0, 120)
          });
          if (request !== listRequest || !dlg.open) return;
          if (res.link?.url) await copyUrl(res.link.url);
          if (request === listRequest && dlg.open) await reloadLinks();
        } catch (err) {
          if (!form.isConnected || !dlg.open) return;
          const error = dlg.querySelector('.wt-share-err');
          error.textContent = err.message || 'Không thể tạo liên kết. Vui lòng thử lại.';
          error.hidden = false;
          error.scrollIntoView({ block: 'nearest' });
        } finally {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Tạo và sao chép';
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
    state.canShare = false;
    state.isAdmin = false;
    state.allowExternalTaskShare = true;

    const dlg = ensureDialog();
    if (dlg.open) dlg.querySelector('.wt-share-body').scrollTop = 0;
    const loading = reloadLinks();
    if (!dlg.open && typeof dlg.showModal === 'function') {
      dlg.showModal();
    }
    dlg.querySelector('#taskShareDialogTitle')?.focus({ preventScroll: true });
    await loading;
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
