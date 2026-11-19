/**
 * WorkTree X Feature: 1-Click Daily Check-in & Team Summary Dialog
 * Allows employees to mark today's recurring/assigned tasks done, optionally log
 * minutes, flag blockers, and submit their daily report in one click, while
 * giving Managers/Admins a live scoped overview of team check-ins.
 */

import { ICONS } from '../../../design-system/icons.js';
import {
  CHECKIN_MOODS,
  RecurringTasksService,
  buildAutoSummaryText,
  getLocalDateString
} from '../services/recurring-tasks-service.js';
import { injectRecurringStyles } from './recurring-tasks-hub.js';

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[c]));
}

function formatViDate(dateStr) {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr || '';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

function formatTimeHm(iso) {
  if (!iso) return '';
  try {
    return new Intl.DateTimeFormat('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Ho_Chi_Minh'
    }).format(new Date(iso));
  } catch {
    return String(iso).slice(11, 16);
  }
}

export function selectTodayFocusTasks({ tasks = [], employeeId = null, role = 'member', today = getLocalDateString() } = {}) {
  const active = (tasks || []).filter(t => !t.archived && !t.archived_at);
  const isMine = t => {
    if (!employeeId) return ['owner', 'admin'].includes(role);
    const ownerId = t.owner ?? t.primary_assignee_id;
    const collabs = Array.isArray(t.collaborators) ? t.collaborators : [];
    return String(ownerId) === String(employeeId) || collabs.some(id => String(id) === String(employeeId));
  };

  const candidates = active.filter(isMine);
  const scored = candidates.map(t => {
    const tags = Array.isArray(t.tags) ? t.tags : [];
    const due = String(t.due || t.due_date || '').slice(0, 10);
    const completedToday = t.status === 'done' && String(t.completedAt || t.completed_at || t.updatedAt || t.updated_at || '').slice(0, 10) === today;
    const isRecurring = tags.includes('recurring') || tags.includes('hang-ngay');
    let score = 0;
    if (isRecurring && due === today) score += 100;
    else if (due === today) score += 80;
    else if (due && due < today && t.status !== 'done') score += 70;
    if (t.status === 'doing') score += 50;
    else if (t.status === 'todo') score += 30;
    else if (completedToday) score += 25;
    else if (t.status === 'done') score -= 40;
    return { task: t, score, completedToday, isRecurring, due };
  });

  return scored
    .filter(item => item.task.status !== 'done' || item.completedToday || item.due === today)
    .sort((a, b) => b.score - a.score)
    .slice(0, 14)
    .map(item => item.task);
}

export async function openDailyCheckinDialog({
  organizationId,
  organizationName = 'WorkTree X',
  userId = null,
  employeeId = null,
  role = 'member',
  employees = [],
  tasks = [],
  isDemo = false,
  initialTab = 'mine',
  onMutated = async () => {},
  onToast = () => {}
} = {}) {
  if (typeof document === 'undefined') return;
  injectRecurringStyles();

  const existingDlg = document.getElementById('wtDailyCheckinDialog');
  if (existingDlg) {
    try { existingDlg.close(); } catch (_) {}
    existingDlg.remove();
  }

  const today = getLocalDateString();
  const canViewTeam = !isDemo && ['owner', 'admin', 'manager'].includes(role);
  const focusTasks = selectTodayFocusTasks({ tasks, employeeId, role, today });
  const taskMap = new Map((tasks || []).map(t => [String(t.id), t]));
  const empMap = new Map((employees || []).map(e => [String(e.id), e]));
  const service = RecurringTasksService;

  const dialog = document.createElement('dialog');
  dialog.id = 'wtDailyCheckinDialog';
  dialog.className = 'wt-chk-dialog';
  dialog.setAttribute('aria-labelledby', 'wtChkTitle');

  const state = {
    activeTab: canViewTeam && initialTab === 'team' ? 'team' : 'mine',
    loading: !isDemo && Boolean(organizationId),
    submitting: false,
    existingCheckin: null,
    teamCheckins: [],
    mood: 'green',
    completedIds: new Set(focusTasks.filter(t => t.status === 'done').map(t => String(t.id))),
    minutesByTask: {},
    summary: '',
    blockers: '',
    tomorrowPlan: ''
  };

  function closeModal() {
    try { dialog.close(); } catch (_) {}
    dialog.remove();
  }

  async function loadInitial() {
    if (isDemo || !organizationId) {
      state.loading = false;
      render();
      return;
    }
    state.loading = true;
    render();
    try {
      const [mine, team] = await Promise.all([
        userId ? service.getTodayCheckin(organizationId, userId, today) : Promise.resolve(null),
        canViewTeam ? service.listTeamCheckins(organizationId, today) : Promise.resolve([])
      ]);
      if (mine) {
        state.existingCheckin = mine;
        state.mood = mine.mood || 'green';
        const merged = new Set(state.completedIds);
        for (const id of mine.completed_task_ids || []) merged.add(String(id));
        state.completedIds = merged;
        state.summary = mine.summary || '';
        state.blockers = mine.blockers || '';
        state.tomorrowPlan = mine.tomorrow_plan || '';
      }
      state.teamCheckins = team || [];
    } catch (err) {
      onToast(err?.message || 'Không thể tải trạng thái báo cáo hôm nay.', 'error');
    } finally {
      state.loading = false;
      render();
    }
  }

  function syncDraftFromDom() {
    const form = dialog.querySelector('#wtChkForm');
    if (!form) return;
    state.summary = form.querySelector('#wtChkSummary')?.value ?? state.summary;
    state.blockers = form.querySelector('#wtChkBlockers')?.value ?? state.blockers;
    state.tomorrowPlan = form.querySelector('#wtChkTomorrow')?.value ?? state.tomorrowPlan;
    form.querySelectorAll('[data-chk-mins]').forEach(input => {
      const id = input.dataset.chkMins;
      const val = Math.max(0, Math.round(Number(input.value) || 0));
      if (val > 0) state.minutesByTask[id] = val;
      else delete state.minutesByTask[id];
    });
  }

  function computeSelectedTasks() {
    const completed = [];
    const inProgress = [];
    for (const t of focusTasks) {
      const id = String(t.id);
      if (state.completedIds.has(id)) completed.push(t);
      else if (t.status === 'doing') inProgress.push(t);
    }
    return { completed, inProgress };
  }

  function computeMinutesTotal() {
    return Object.values(state.minutesByTask).reduce((sum, v) => sum + (Number(v) || 0), 0);
  }

  function renderMineTab() {
    if (state.loading) {
      return `<p class="view-note" style="margin:0">Đang tải danh sách công việc và check-in hôm nay...</p>`;
    }

    const totalNewMinutes = computeMinutesTotal();
    const submittedNote = state.existingCheckin
      ? `<div class="wt-rec-pill is-green" style="align-self:flex-start">${ICONS.checkCircle}<span>Đã gửi báo cáo hôm nay lúc ${esc(formatTimeHm(state.existingCheckin.submitted_at))} · Chỉnh sửa &amp; bấm lưu nếu muốn cập nhật</span></div>`
      : '';

    return `
      <form id="wtChkForm" style="display:flex;flex-direction:column;gap:16px">
        ${submittedNote}

        <div class="field">
          <span>Trạng thái tiến độ hôm nay</span>
          <div class="wt-chk-moods" role="radiogroup" aria-label="Trạng thái công việc hôm nay">
            ${CHECKIN_MOODS.map(m => {
              const active = state.mood === m.value;
              return `
                <button type="button" class="wt-chk-mood-btn ${active ? 'is-active' : ''}" data-chk-mood="${m.value}" data-mood="${m.value}" role="radio" aria-checked="${active}">
                  <strong>${m.value === 'green' ? ICONS.checkCircle : ICONS.alertCircle}<span>${esc(m.label)}</span></strong>
                  <small>${esc(m.hint)}</small>
                </button>
              `;
            }).join('')}
          </div>
        </div>

        <div class="field">
          <div class="wt-rec-section-head">
            <span>Việc của tôi hôm nay (${focusTasks.length}) — tick chọn việc đã xong &amp; nhập phút làm nếu cần</span>
            ${totalNewMinutes > 0 ? `<span class="wt-rec-pill is-primary">${ICONS.clock} +${totalNewMinutes} phút sẽ ghi nhận</span>` : ''}
          </div>
          ${focusTasks.length ? `
            <div class="wt-chk-task-list">
              ${focusTasks.map(t => {
                const id = String(t.id);
                const checked = state.completedIds.has(id);
                const minsVal = state.minutesByTask[id] || '';
                const tags = Array.isArray(t.tags) ? t.tags : [];
                const isRec = tags.includes('recurring') || tags.includes('hang-ngay');
                return `
                  <div class="wt-chk-task-row">
                    <label class="wt-chk-task-main">
                      <input type="checkbox" data-chk-task="${esc(id)}" ${checked ? 'checked' : ''}>
                      <div style="min-width:0">
                        <div class="wt-chk-task-title">${esc(t.title)}</div>
                        <div class="wt-chk-task-meta">
                          ${isRec ? '<span class="wt-rec-pill is-primary">Định kỳ</span>' : ''}
                          ${t.due ? `<span>Hạn ${esc(formatViDate(String(t.due).slice(0, 10)))}</span>` : ''}
                          ${t.status === 'doing' ? '<span>Đang thực hiện</span>' : t.status === 'done' ? '<span>Đã xong</span>' : '<span>Cần làm</span>'}
                        </div>
                      </div>
                    </label>
                    <div class="wt-chk-mins-wrap">
                      <input class="wt-chk-mins" type="number" min="0" max="1440" step="5" data-chk-mins="${esc(id)}" value="${esc(minsVal)}" placeholder="0" aria-label="Số phút làm cho ${esc(t.title)}">
                      <span style="font-size:.75rem;color:var(--muted)">phút</span>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          ` : `<p class="view-note" style="margin:0">Hôm nay chưa có đầu việc riêng nào đang mở. Bạn vẫn có thể viết tóm tắt công việc đã xử lý bên dưới.</p>`}
        </div>

        <label class="field">
          <div class="wt-rec-section-head">
            <span>Tóm tắt kết quả hôm nay</span>
            <button type="button" class="btn small" data-chk-action="autofill-summary">${ICONS.sparkles}<span>Tự điền từ việc đã tick</span></button>
          </div>
          <textarea id="wtChkSummary" rows="2" maxlength="4000" placeholder="Ví dụ: Đã chốt 5 đơn hàng, xử lý xong 2 ticket khách doanh nghiệp...">${esc(state.summary)}</textarea>
        </label>

        <div class="wt-rec-form-grid">
          <label class="field">
            Vướng mắc / Cần hỗ trợ
            <textarea id="wtChkBlockers" rows="2" maxlength="2000" placeholder="Để trống nếu mọi việc thông suốt...">${esc(state.blockers)}</textarea>
          </label>
          <label class="field">
            Trọng tâm ngày mai
            <textarea id="wtChkTomorrow" rows="2" maxlength="2000" placeholder="1–2 đầu việc ưu tiên đầu giờ mai...">${esc(state.tomorrowPlan)}</textarea>
          </label>
        </div>
      </form>
    `;
  }

  function renderTeamTab() {
    if (state.loading) {
      return `<p class="view-note" style="margin:0">Đang tải tổng hợp check-in đội ngũ...</p>`;
    }

    const list = state.teamCheckins || [];
    const moodCounts = { green: 0, amber: 0, red: 0 };
    let totalMins = 0;
    for (const row of list) {
      if (moodCounts[row.mood] !== undefined) moodCounts[row.mood] += 1;
      totalMins += Number(row.minutes_logged) || 0;
    }

    return `
      <div style="display:flex;flex-direction:column;gap:14px">
        <div class="wt-rec-section-head">
          <div class="wt-rec-meta">
            <span class="wt-rec-pill is-primary">${ICONS.users} ${list.length} người đã check-in</span>
            <span class="wt-rec-pill is-green">Suôn sẻ: ${moodCounts.green}</span>
            <span class="wt-rec-pill is-amber">Lưu ý: ${moodCounts.amber}</span>
            <span class="wt-rec-pill is-red">Đang vướng: ${moodCounts.red}</span>
            ${totalMins > 0 ? `<span class="wt-rec-pill">${ICONS.clock} ${Math.round(totalMins / 60 * 10) / 10} giờ ghi nhận</span>` : ''}
          </div>
          <div class="wt-rec-actions">
            <button type="button" class="btn small" data-chk-action="copy-team-digest">Sao chép tổng hợp</button>
            <button type="button" class="btn small" data-chk-action="refresh-team">Làm mới</button>
          </div>
        </div>

        ${list.length ? list.map(row => {
          const emp = row.employee_id ? empMap.get(String(row.employee_id)) : null;
          const displayName = emp?.full_name || emp?.name || (row.user_id === userId ? 'Bạn' : 'Thành viên');
          const jobTitle = emp?.job_title ? ` · ${emp.job_title}` : '';
          const moodCls = row.mood === 'red' ? 'is-red' : row.mood === 'amber' ? 'is-amber' : 'is-green';
          const moodObj = CHECKIN_MOODS.find(m => m.value === row.mood);
          const doneCount = Array.isArray(row.completed_task_ids) ? row.completed_task_ids.length : 0;
          return `
            <article class="wt-chk-team-card">
              <div class="wt-chk-team-head">
                <div>
                  <strong>${esc(displayName)}</strong><span style="color:var(--muted);font-size:.8125rem">${esc(jobTitle)}</span>
                </div>
                <div class="wt-rec-meta">
                  <span class="wt-rec-pill ${moodCls}">${esc(moodObj?.label || row.mood)}</span>
                  <span class="wt-rec-pill">Xong ${doneCount} việc</span>
                  ${Number(row.minutes_logged) > 0 ? `<span class="wt-rec-pill">${Number(row.minutes_logged)}p</span>` : ''}
                  <span style="font-size:.75rem;color:var(--muted)">${esc(formatTimeHm(row.submitted_at))}</span>
                </div>
              </div>
              ${row.summary ? `<p style="margin:0;font-size:.875rem;line-height:1.45">${esc(row.summary)}</p>` : ''}
              ${row.blockers ? `<p style="margin:0;font-size:.8125rem;color:var(--red)"><strong>Cần hỗ trợ:</strong> ${esc(row.blockers)}</p>` : ''}
              ${row.tomorrow_plan ? `<p style="margin:0;font-size:.8125rem;color:var(--muted)"><strong>Ngày mai:</strong> ${esc(row.tomorrow_plan)}</p>` : ''}
            </article>
          `;
        }).join('') : `
          <div class="empty-state">
            <h3>Chưa có ai gửi Check-in hôm nay</h3>
            <p>Khi nhân sự bấm “Báo cáo hôm nay”, toàn bộ tiến độ, giờ làm và điểm vướng sẽ gom gọn về đây để bạn nắm trong 10 giây.</p>
          </div>
        `}
      </div>
    `;
  }

  function render() {
    dialog.innerHTML = `
      <div class="dialog-head">
        <div>
          <p class="overline" style="margin:0 0 4px">DAILY CHECK-IN · ${esc(organizationName)}</p>
          <h2 id="wtChkTitle" style="margin:0">Báo cáo hôm nay (${esc(formatViDate(today))})</h2>
        </div>
        <button type="button" class="icon-btn" data-chk-action="close" aria-label="Đóng hộp thoại">${ICONS.x}</button>
      </div>

      ${canViewTeam ? `
        <div class="wt-chk-tabs" role="tablist">
          <button type="button" class="wt-chk-tab" role="tab" aria-selected="${state.activeTab === 'mine'}" data-chk-tab="mine">Báo cáo của tôi</button>
          <button type="button" class="wt-chk-tab" role="tab" aria-selected="${state.activeTab === 'team'}" data-chk-tab="team">Tổng hợp đội ngũ (${state.teamCheckins.length})</button>
        </div>
      ` : ''}

      <div class="dialog-scroll">
        ${isDemo ? `<p class="view-note" style="margin:0">Chế độ Demo: Giao diện xem thử Báo cáo hôm nay (đăng nhập tài khoản Đám mây để lưu vào Supabase).</p>` : ''}
        ${state.activeTab === 'team' ? renderTeamTab() : renderMineTab()}
      </div>

      <div class="dialog-foot">
        <button type="button" class="btn" data-chk-action="close">Đóng</button>
        ${state.activeTab === 'mine' ? `
          <button type="button" class="btn primary" data-chk-action="submit" ${state.submitting || state.loading ? 'disabled' : ''}>
            ${ICONS.check}<span>${state.submitting ? 'Đang đồng bộ...' : 'Hoàn tất báo cáo hôm nay'}</span>
          </button>
        ` : ''}
      </div>
    `;

    dialog.querySelectorAll('[data-chk-tab]').forEach(tab => {
      tab.addEventListener('click', () => {
        syncDraftFromDom();
        state.activeTab = tab.dataset.chkTab;
        render();
      });
    });

    dialog.querySelectorAll('[data-chk-mood]').forEach(btn => {
      btn.addEventListener('click', () => {
        syncDraftFromDom();
        state.mood = btn.dataset.chkMood;
        render();
      });
    });

    dialog.querySelectorAll('[data-chk-task]').forEach(cb => {
      cb.addEventListener('change', () => {
        syncDraftFromDom();
        const id = cb.dataset.chkTask;
        if (cb.checked) state.completedIds.add(id);
        else state.completedIds.delete(id);
        render();
      });
    });

    dialog.querySelectorAll('[data-chk-action]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const action = btn.dataset.chkAction;
        if (action === 'close') {
          closeModal();
          return;
        }
        if (action === 'autofill-summary') {
          syncDraftFromDom();
          const { completed, inProgress } = computeSelectedTasks();
          state.summary = buildAutoSummaryText({
            completedTasks: completed,
            inProgressTasks: inProgress,
            minutesLogged: computeMinutesTotal()
          }) || 'Đã rà soát danh sách công việc trong ngày.';
          render();
          return;
        }
        if (action === 'refresh-team') {
          await loadInitial();
          return;
        }
        if (action === 'copy-team-digest') {
          const lines = state.teamCheckins.map(row => {
            const emp = row.employee_id ? empMap.get(String(row.employee_id)) : null;
            const name = emp?.full_name || emp?.name || 'Thành viên';
            const moodLabel = CHECKIN_MOODS.find(m => m.value === row.mood)?.label || row.mood;
            const doneCount = Array.isArray(row.completed_task_ids) ? row.completed_task_ids.length : 0;
            return `- ${name} [${moodLabel} · xong ${doneCount} việc]: ${row.summary || 'Không có ghi chú'}${row.blockers ? ` | Vướng: ${row.blockers}` : ''}`;
          });
          const text = `TỔNG HỢP CHECK-IN ${formatViDate(today)} (${organizationName})\n` + (lines.join('\n') || 'Chưa có báo cáo.');
          try {
            await navigator.clipboard?.writeText(text);
            onToast('Đã sao chép bản tổng hợp check-in.');
          } catch (_) {
            onToast('Không thể sao chép tự động.', 'error');
          }
          return;
        }
        if (action === 'submit') {
          syncDraftFromDom();
          if (isDemo) {
            onToast('Đã xem thử Check-in Demo.');
            closeModal();
            return;
          }
          if (!organizationId || !userId) {
            onToast('Cần đăng nhập không gian làm việc đám mây để lưu báo cáo.', 'error');
            return;
          }
          state.submitting = true;
          render();
          try {
            const { completed, inProgress } = computeSelectedTasks();
            const totalMins = computeMinutesTotal();
            const finalSummary = state.summary.trim() || buildAutoSummaryText({
              completedTasks: completed,
              inProgressTasks: inProgress,
              minutesLogged: totalMins
            });
            const result = await service.submitDailyCheckin({
              organizationId,
              userId,
              employeeId,
              checkinDate: today,
              mood: state.mood,
              completedTaskIds: completed.map(t => String(t.id)),
              inProgressTaskIds: inProgress.map(t => String(t.id)),
              minutesLogged: totalMins,
              perTaskMinutes: state.minutesByTask,
              existingTaskMap: taskMap,
              summary: finalSummary,
              blockers: state.blockers,
              tomorrowPlan: state.tomorrowPlan
            });
            await onMutated();
            if (result.warnings.length) {
              onToast(`Đã lưu báo cáo nhưng có lưu ý: ${result.warnings[0]}`, 'error');
            } else {
              onToast(`Đã gửi Báo cáo hôm nay${result.updatedTasksCount ? ` và đồng bộ ${result.updatedTasksCount} đầu việc` : ''}!`);
            }
            closeModal();
          } catch (err) {
            onToast(err?.message || 'Không thể gửi báo cáo hôm nay.', 'error');
            state.submitting = false;
            render();
          }
        }
      });
    });
  }

  dialog.addEventListener('cancel', (e) => {
    e.preventDefault();
    closeModal();
  });
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) closeModal();
  });

  document.body.appendChild(dialog);
  render();
  dialog.showModal();
  await loadInitial();
}
