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

function needsSupport(report) {
  return report.mood === 'red' || Boolean(report.blockers?.trim());
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

const DEMO_CHECKINS_KEY = 'worktree_x_v8_demo_checkins';

function readDemoCheckinsMap() {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(DEMO_CHECKINS_KEY) : null;
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (_) {
    return {};
  }
}

function writeDemoCheckinsMap(map) {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(DEMO_CHECKINS_KEY, JSON.stringify(map));
  } catch (_) {}
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
  const canViewTeam = ['owner', 'admin', 'manager'].includes(role);
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
    mineError: false,
    teamError: false,
    submitting: false,
    existingCheckin: null,
    teamCheckins: [],
    teamNeedsSupport: false,
    mood: 'green',
    completedIds: new Set(focusTasks.filter(t => t.status === 'done').map(t => String(t.id))),
    minutesByTask: {},
    summary: '',
    blockers: '',
    tomorrowPlan: '',
    aiDrafting: false
  };
  let aiDraftAbort = null;
  let aiDraftSeq = 0;

  function closeModal() {
    try { aiDraftAbort?.abort(); } catch (_) {}
    aiDraftAbort = null;
    aiDraftSeq += 1;
    try { dialog.close(); } catch (_) {}
    dialog.remove();
  }

  async function loadInitial({ teamOnly = false } = {}) {
    if (isDemo) {
      const map = readDemoCheckinsMap();
      const dayList = Array.isArray(map[today]) ? map[today] : null;
      let seededList = dayList;
      if (!seededList) {
        const sampleRows = [];
        const candidates = (employees || []).filter(e => String(e.id) !== String(employeeId || '')).slice(0, 3);
        const moods = ['green', 'green', 'amber'];
        candidates.forEach((emp, idx) => {
          sampleRows.push({
            id: `demo_chk_${today}_${emp.id}`,
            user_id: `demo-user-${emp.id}`,
            employee_id: String(emp.id),
            checkin_date: today,
            mood: moods[idx % moods.length],
            completed_task_ids: [],
            in_progress_task_ids: [],
            minutes_logged: 45 + idx * 15,
            summary: idx === 2
              ? 'Đã hoàn tất khung content tuần, đang chờ duyệt brief creative mới.'
              : 'Đã xử lý các đầu việc ưu tiên theo kế hoạch hôm nay.',
            blockers: idx === 2 ? 'Cần bổ sung ngân sách test nhóm quảng cáo mới.' : '',
            tomorrow_plan: 'Tiếp tục rà soát các đầu việc đến hạn sáng mai.',
            created_at: new Date().toISOString()
          });
        });
        seededList = sampleRows;
        map[today] = seededList;
        writeDemoCheckinsMap(map);
      }
      const myKey = String(employeeId || userId || 'demo-user');
      const mine = !teamOnly ? seededList.find(r => String(r.employee_id || r.user_id || '') === myKey) : null;
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
      state.teamCheckins = canViewTeam ? seededList : [];
      state.loading = false;
      render();
      return;
    }
    if (!organizationId) {
      state.loading = false;
      render();
      return;
    }
    state.loading = true;
    render();
    try {
      const [mine, team] = await Promise.allSettled([
        userId && !teamOnly ? service.getTodayCheckin(organizationId, userId, today) : Promise.resolve(null),
        canViewTeam ? service.listTeamCheckins(organizationId, today) : Promise.resolve([])
      ]);
      if (!teamOnly) state.mineError = mine.status === 'rejected';
      if (mine.status === 'fulfilled' && mine.value) {
        const report = mine.value;
        state.existingCheckin = report;
        state.mood = report.mood || 'green';
        const merged = new Set(state.completedIds);
        for (const id of report.completed_task_ids || []) merged.add(String(id));
        state.completedIds = merged;
        state.summary = report.summary || '';
        state.blockers = report.blockers || '';
        state.tomorrowPlan = report.tomorrow_plan || '';
      }
      state.teamError = team.status === 'rejected';
      if (team.status === 'fulfilled') state.teamCheckins = team.value || [];
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
    if (state.mineError) {
      return '<div class="empty-state"><p role="alert">Chưa tải được báo cáo của bạn.</p><button type="button" class="btn" data-chk-action="retry-mine">Thử lại</button></div>';
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
    if (state.teamError) {
      return '<div class="empty-state"><p role="alert">Chưa tải được báo cáo đội ngũ.</p><button type="button" class="btn" data-chk-action="refresh-team">Thử lại</button></div>';
    }

    const list = state.teamCheckins || [];
    const supportCount = list.filter(needsSupport).length;
    const totalMinutes = list.reduce((sum, row) => sum + (Number(row.minutes_logged) || 0), 0);
    const displayList = state.teamNeedsSupport
      ? list.filter(needsSupport)
      : [...list].sort((a, b) => Number(needsSupport(b)) - Number(needsSupport(a)));

    return `
      <section class="wt-chk-team" aria-labelledby="wtChkTeamTitle">
        <div class="wt-rec-section-head">
          <h4 id="wtChkTeamTitle">Tổng hợp đội ngũ</h4>
          <div class="wt-rec-actions">
            <button type="button" class="btn small" data-chk-action="copy-team-digest" ${list.length ? '' : 'disabled'}>Sao chép tổng hợp</button>
            <button type="button" class="btn small" data-chk-action="refresh-team">Làm mới</button>
          </div>
        </div>
        <dl class="wt-chk-team-metrics">
          <div><dt>Đã báo cáo</dt><dd>${list.length}</dd></div>
          <div><dt>Cần hỗ trợ</dt><dd class="${supportCount > 0 ? 'has-support' : ''}">${supportCount}</dd></div>
          <div><dt>Phút ghi nhận</dt><dd>${totalMinutes.toLocaleString('vi-VN')}</dd></div>
        </dl>
        ${list.length ? `
          <div class="wt-rec-actions"><button type="button" class="btn small" data-chk-action="filter-team-support" aria-pressed="${state.teamNeedsSupport}">${ICONS.filter}<span>Chỉ xem việc cần hỗ trợ</span></button></div>
        ` : ''}
        ${displayList.length ? displayList.map(row => {
          const emp = row.employee_id ? empMap.get(String(row.employee_id)) : null;
          const displayName = emp?.full_name || emp?.name || (row.user_id === userId ? 'Bạn' : 'Thành viên');
          const jobTitle = emp?.job_title || '';
          const moodCls = row.mood === 'red' ? 'is-red' : row.mood === 'amber' ? 'is-amber' : 'is-green';
          const moodObj = CHECKIN_MOODS.find(m => m.value === row.mood);
          const doneCount = Array.isArray(row.completed_task_ids) ? row.completed_task_ids.length : 0;
          return `
            <article class="wt-chk-team-card ${needsSupport(row) ? 'needs-support' : ''}">
              <div class="wt-chk-team-head">
                <div>
                  <h5>${esc(displayName)}</h5>${jobTitle ? `<p class="wt-chk-note">${esc(jobTitle)}</p>` : ''}
                </div>
                <div class="wt-rec-meta">
                  <span class="wt-rec-pill ${moodCls}">${esc(moodObj?.label || row.mood)}</span>
                  <span class="wt-rec-pill">Xong ${doneCount} việc</span>
                  ${Number(row.minutes_logged) > 0 ? `<span class="wt-rec-pill">${Number(row.minutes_logged)} phút</span>` : ''}
                  <span class="wt-chk-note">${esc(formatTimeHm(row.submitted_at))}</span>
                </div>
              </div>
              ${row.blockers ? `<p class="wt-chk-report-blocker"><strong>Cần hỗ trợ</strong><br>${esc(row.blockers)}</p>` : ''}
              ${row.summary ? `<p class="wt-chk-report-copy">${esc(row.summary)}</p>` : ''}
              ${row.tomorrow_plan ? `<p class="wt-chk-report-copy"><strong>Ngày mai</strong><br>${esc(row.tomorrow_plan)}</p>` : ''}
            </article>
          `;
        }).join('') : `
          <div class="empty-state">
            <h3>${list.length ? 'Chưa có báo cáo nào cần hỗ trợ' : 'Chưa có báo cáo hôm nay'}</h3>
            <p>${list.length ? 'Bỏ bộ lọc để xem tất cả báo cáo.' : 'Báo cáo nhân sự sẽ xuất hiện ở đây sau khi được gửi.'}</p>
          </div>
        `}
      </section>
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
          <button type="button" class="btn primary" data-chk-action="submit" ${state.submitting || state.loading || state.mineError ? 'disabled' : ''}>
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
          if (state.aiDrafting) return;
          syncDraftFromDom();
          const { completed, inProgress } = computeSelectedTasks();
          const totalMins = computeMinutesTotal();
          const canCloudAiDraft = !isDemo
            && Boolean(organizationId)
            && typeof window !== 'undefined'
            && typeof window.AiClientService?.inlineAssist === 'function';

          const applyLocalSummary = () => {
            state.summary = buildAutoSummaryText({
              completedTasks: completed,
              inProgressTasks: inProgress,
              minutesLogged: totalMins
            }) || 'Đã rà soát danh sách công việc trong ngày.';
            const summaryEl = dialog.querySelector('#wtChkSummary');
            if (summaryEl) {
              summaryEl.value = state.summary;
              summaryEl.focus();
            }
          };

          if (!canCloudAiDraft) {
            applyLocalSummary();
            return;
          }

          try { aiDraftAbort?.abort(); } catch (_) {}
          aiDraftAbort = typeof AbortController === 'function' ? new AbortController() : null;
          const seq = ++aiDraftSeq;
          state.aiDrafting = true;
          btn.disabled = true;
          btn.innerHTML = `${ICONS.sparkles}<span>AI đang soạn…</span>`;

          try {
            const res = await window.AiClientService.inlineAssist({
              organizationId,
              mode: 'checkin_draft',
              payload: {
                mood: state.mood,
                completedTaskIds: completed.map(t => String(t.id)),
                inProgressTaskIds: inProgress.map(t => String(t.id)),
                minutesLogged: totalMins,
                currentSummary: state.summary,
                currentBlockers: state.blockers,
                currentTomorrowPlan: state.tomorrowPlan
              },
              signal: aiDraftAbort?.signal || null
            });
            if (seq !== aiDraftSeq || !dialog.isConnected) return;
            const d = res?.data || {};
            if (d.summary) state.summary = d.summary;
            if (!state.blockers.trim() && d.blockers) state.blockers = d.blockers;
            if (!state.tomorrowPlan.trim() && d.tomorrowPlan) state.tomorrowPlan = d.tomorrowPlan;

            const summaryEl = dialog.querySelector('#wtChkSummary');
            const blockersEl = dialog.querySelector('#wtChkBlockers');
            const tomorrowEl = dialog.querySelector('#wtChkTomorrow');
            if (summaryEl) summaryEl.value = state.summary;
            if (blockersEl && d.blockers) blockersEl.value = state.blockers;
            if (tomorrowEl && d.tomorrowPlan) tomorrowEl.value = state.tomorrowPlan;
            summaryEl?.focus();
            onToast('AI đã soạn nháp báo cáo hôm nay.');
          } catch (err) {
            if (err?.name === 'AbortError' || seq !== aiDraftSeq || !dialog.isConnected) return;
            applyLocalSummary();
            onToast('AI tạm bận — đã tự điền nhanh từ danh sách việc.');
          } finally {
            if (seq === aiDraftSeq) {
              state.aiDrafting = false;
              if (btn.isConnected) {
                btn.disabled = false;
                btn.innerHTML = `${ICONS.sparkles}<span>Tự điền kết quả</span>`;
              }
            }
          }
          return;
        }
        if (action === 'refresh-team') {
          await loadInitial({ teamOnly: true });
          return;
        }
        if (action === 'retry-mine') {
          await loadInitial();
          return;
        }
        if (action === 'filter-team-support') {
          state.teamNeedsSupport = !state.teamNeedsSupport;
          render();
          dialog.querySelector('[data-chk-action="filter-team-support"]')?.focus({ preventScroll: true });
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
              const myKey = String(employeeId || userId || 'demo-user');
              const map = readDemoCheckinsMap();
              const dayList = Array.isArray(map[today]) ? [...map[today]] : [];
              const row = {
                id: state.existingCheckin?.id || `demo_chk_${today}_${myKey}`,
                user_id: String(userId || `demo-user-${myKey}`),
                employee_id: employeeId ? String(employeeId) : null,
                checkin_date: today,
                mood: state.mood,
                completed_task_ids: completed.map(t => String(t.id)),
                in_progress_task_ids: inProgress.map(t => String(t.id)),
                minutes_logged: totalMins,
                summary: finalSummary,
                blockers: state.blockers.trim(),
                tomorrow_plan: state.tomorrowPlan.trim(),
                created_at: new Date().toISOString()
              };
              const idx = dayList.findIndex(r => String(r.employee_id || r.user_id || '') === myKey);
              if (idx !== -1) dayList[idx] = row;
              else dayList.unshift(row);
              map[today] = dayList;
              writeDemoCheckinsMap(map);
              const res = await onMutated({
                demoCheckin: {
                  completedTaskIds: row.completed_task_ids,
                  inProgressTaskIds: row.in_progress_task_ids,
                  perTaskMinutes: state.minutesByTask
                }
              });
              const updatedCount = Number(res?.updated || 0);
              onToast(`Đã gửi Báo cáo hôm nay${updatedCount ? ` và đồng bộ ${updatedCount} đầu việc` : ''}!`);
              closeModal();
            } catch (err) {
              onToast(err?.message || 'Không thể lưu báo cáo hôm nay.', 'error');
              state.submitting = false;
              render();
            }
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
