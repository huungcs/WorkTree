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

const CHECKIN_TASK_STATUS = {
  'Chưa làm': 'todo',
  'Đang làm': 'doing',
  'Đang thực hiện': 'doing',
  'Chờ duyệt': 'review',
  'Hoàn thành': 'done',
  in_progress: 'doing'
};

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
  const checkinTasks = (tasks || []).map(task => ({
    ...task,
    status: CHECKIN_TASK_STATUS[task.status] || task.status
  }));
  const focusTasks = selectTodayFocusTasks({ tasks: checkinTasks, employeeId, role, today });
  const taskMap = new Map(checkinTasks.map(t => [String(t.id), t]));
  const empMap = new Map((employees || []).map(e => [String(e.id), e]));
  const service = RecurringTasksService;

  const dialog = document.createElement('dialog');
  dialog.id = 'wtDailyCheckinDialog';
  dialog.className = 'dialog wt-chk-dialog';
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

  async function loadInitial({ teamOnly = false } = {}) {
    if (isDemo || !organizationId) {
      state.loading = false;
      render();
      return;
    }
    state.loading = true;
    render();
    try {
      const [mine, team] = await Promise.all([
        userId && !teamOnly ? service.getTodayCheckin(organizationId, userId, today) : Promise.resolve(null),
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

  function renderProgress() {
    const progress = dialog.querySelector('[data-chk-progress]');
    if (progress) {
      const { completed } = computeSelectedTasks();
      const minutes = computeMinutesTotal();
      progress.textContent = `${completed.length}/${focusTasks.length} việc đã chọn${minutes ? ` · ${minutes} phút` : ''}`;
    }
  }

  function renderMineTab() {
    if (state.loading) {
      return `<p class="view-note" style="margin:0">Đang tải danh sách công việc và check-in hôm nay...</p>`;
    }

    const submittedNote = state.existingCheckin
      ? `<div class="wt-chk-submitted wt-rec-pill is-green">${ICONS.checkCircle}<span>Đã gửi lúc ${esc(formatTimeHm(state.existingCheckin.submitted_at))}</span></div>`
      : '';

    return `
      <form id="wtChkForm" class="wt-chk-form">
        ${submittedNote}

        <section class="wt-chk-section" aria-labelledby="wtChkMoodTitle">
          <h3 id="wtChkMoodTitle">Tiến độ hôm nay</h3>
          <div class="wt-chk-moods" role="group" aria-labelledby="wtChkMoodTitle">
            ${CHECKIN_MOODS.map(m => {
              const active = state.mood === m.value;
              return `
                <button type="button" class="wt-chk-mood-btn" data-chk-mood="${m.value}" aria-pressed="${active}">
                  <strong>${m.value === 'green' ? ICONS.checkCircle : ICONS.alertCircle}<span>${esc(m.label)}</span></strong>
                  <small>${esc(m.hint)}</small>
                </button>
              `;
            }).join('')}
          </div>
        </section>

        <section class="wt-chk-section" aria-labelledby="wtChkTasksTitle">
          <div class="wt-rec-section-head">
            <h3 id="wtChkTasksTitle">Việc cần báo cáo</h3>
            ${focusTasks.length ? '<span class="wt-chk-note" data-chk-progress aria-live="polite"></span>' : ''}
          </div>
          ${focusTasks.length ? '<p class="wt-chk-note">Đánh dấu việc đã xong. Có thể nhập thêm số phút đã làm.</p>' : ''}
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
                      <span class="wt-chk-task-copy">
                        <strong class="wt-chk-task-title">${esc(t.title)}</strong>
                        <span class="wt-chk-task-meta">
                          ${isRec ? '<span class="wt-rec-pill is-primary">Định kỳ</span>' : ''}
                          ${t.due || t.due_date ? `<span>Hạn ${esc(formatViDate(String(t.due || t.due_date).slice(0, 10)))}</span>` : ''}
                        </span>
                      </span>
                    </label>
                    <div class="wt-chk-mins-wrap">
                      <input class="wt-chk-mins" type="number" min="0" max="1440" inputmode="numeric" data-chk-mins="${esc(id)}" value="${esc(minsVal)}" placeholder="0" aria-label="Số phút làm cho ${esc(t.title)}">
                      <span class="wt-chk-note">phút</span>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          ` : `<p class="view-note" style="margin:0">Hôm nay chưa có đầu việc riêng nào đang mở. Bạn vẫn có thể viết tóm tắt công việc đã xử lý bên dưới.</p>`}
        </section>

        <div class="field">
          <div class="wt-rec-section-head">
            <label for="wtChkSummary">Kết quả hôm nay</label>
            <button type="button" class="btn small" data-chk-action="autofill-summary">${ICONS.sparkles}<span>Tự điền kết quả</span></button>
          </div>
          <textarea id="wtChkSummary" rows="2" maxlength="4000" placeholder="Ví dụ: Đã chốt 5 đơn hàng, xử lý xong 2 ticket khách doanh nghiệp...">${esc(state.summary)}</textarea>
        </div>

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
            <button type="button" class="btn small" data-chk-action="copy-team-digest" ${list.length ? '' : 'disabled'}>Sao chép tổng hợp</button>
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
            <h3>Chưa có báo cáo hôm nay</h3>
            <p>Báo cáo nhân sự sẽ xuất hiện ở đây sau khi được gửi.</p>
          </div>
        `}
      </div>
    `;
  }

  function render({ keepScroll = true } = {}) {
    const scrollTop = keepScroll ? dialog.querySelector('.dialog-scroll')?.scrollTop || 0 : 0;
    dialog.innerHTML = `
      <div class="dialog-head">
        <div class="wt-chk-heading">
          <span class="wt-chk-heading-icon" aria-hidden="true">${ICONS.checkCircle}</span>
          <div>
            <h2 id="wtChkTitle">Báo cáo hôm nay</h2>
            <p class="wt-chk-note"><time datetime="${esc(today)}">${esc(formatViDate(today))}</time> · ${esc(organizationName)}</p>
          </div>
        </div>
        <button type="button" class="icon-btn" data-chk-action="close" aria-label="Đóng hộp thoại">${ICONS.x}</button>
      </div>

      ${canViewTeam ? `
        <div class="wt-chk-tabs" role="group" aria-label="Chọn nội dung báo cáo">
          <button type="button" class="wt-chk-tab" aria-pressed="${state.activeTab === 'mine'}" data-chk-tab="mine">Báo cáo của tôi</button>
          <button type="button" class="wt-chk-tab" aria-pressed="${state.activeTab === 'team'}" data-chk-tab="team">Đội ngũ <span class="wt-rec-pill">${state.teamCheckins.length}</span></button>
        </div>
      ` : ''}

      <div class="dialog-scroll">
        ${isDemo ? '<p class="wt-chk-note">Bản demo · Báo cáo xem thử</p>' : ''}
        ${state.activeTab === 'team' ? renderTeamTab() : renderMineTab()}
      </div>

      <div class="dialog-foot">
        <button type="button" class="btn" data-chk-action="close">Đóng</button>
        ${state.activeTab === 'mine' ? `
          <button type="button" class="btn primary" data-chk-action="submit" ${state.submitting || state.loading ? 'disabled' : ''}>
            ${ICONS.check}<span>${state.submitting ? 'Đang lưu…' : isDemo ? 'Hoàn tất xem thử' : state.existingCheckin ? 'Cập nhật báo cáo' : 'Gửi báo cáo'}</span>
          </button>
        ` : ''}
      </div>
    `;
    dialog.querySelector('.dialog-scroll').scrollTop = scrollTop;
    renderProgress();

    dialog.querySelectorAll('[data-chk-tab]').forEach(tab => {
      tab.addEventListener('click', () => {
        if (state.submitting || state.activeTab === tab.dataset.chkTab) return;
        syncDraftFromDom();
        state.activeTab = tab.dataset.chkTab;
        render({ keepScroll: false });
        dialog.querySelector('[data-chk-tab][aria-pressed="true"]')?.focus({ preventScroll: true });
      });
    });

    dialog.querySelectorAll('[data-chk-mood]').forEach(btn => {
      btn.addEventListener('click', () => {
        state.mood = btn.dataset.chkMood;
        dialog.querySelectorAll('[data-chk-mood]').forEach(option => {
          option.setAttribute('aria-pressed', String(option === btn));
        });
      });
    });

    dialog.querySelectorAll('[data-chk-task]').forEach(cb => {
      cb.addEventListener('change', () => {
        const id = cb.dataset.chkTask;
        if (cb.checked) state.completedIds.add(id);
        else state.completedIds.delete(id);
        renderProgress();
      });
    });

    dialog.querySelector('#wtChkForm')?.addEventListener('input', event => {
      if (event.target.matches('[data-chk-mins]')) {
        syncDraftFromDom();
        renderProgress();
      }
    });

    dialog.querySelector('#wtChkForm')?.addEventListener('submit', event => {
      event.preventDefault();
      dialog.querySelector('[data-chk-action="submit"]')?.click();
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
          const summary = dialog.querySelector('#wtChkSummary');
          summary.value = state.summary;
          summary.focus();
          return;
        }
        if (action === 'refresh-team') {
          await loadInitial({ teamOnly: true });
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
            await navigator.clipboard.writeText(text);
            onToast('Đã sao chép bản tổng hợp check-in.');
          } catch (_) {
            onToast('Không thể sao chép tự động.', 'error');
          }
          return;
        }
        if (action === 'submit') {
          if (state.submitting || !dialog.querySelector('#wtChkForm')?.reportValidity()) return;
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
