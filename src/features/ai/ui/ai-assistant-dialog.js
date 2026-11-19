/**
 * WorkTree X Feature: In-App AI Assistant Dialog
 * Connects authenticated workspace users to /api/ai (server-side AI provider)
 * with tenant/role/scope enforcement and Preview -> Confirm mutation safety.
 */

import { AiClientService } from '../services/ai-client-service.js';
import { ICONS } from '../../../design-system/icons.js';

const LINE_ICONS = {
  bot: ICONS.bot,
  x: ICONS.x,
  send: ICONS.send,
  check: ICONS.check,
  shield: ICONS.shield,
  alertCircle: ICONS.alertCircle,
  arrowUpRight: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7"/><path d="M8 7h9v9"/></svg>',
  sparkles: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3 2.4 6.1L20.5 11.5l-6.1 2.4L12 20l-2.4-6.1L3.5 11.5l6.1-2.4Z"/><path d="M19 3v3m-1.5-1.5h3"/></svg>',
  trash: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>'
};

const SAFE_WORKTREE_NAV_REGEX = /^worktree:\/\/(?:task|node|view|employee|hub)\/[a-zA-Z0-9_.\-%]+(?:\?[a-zA-Z0-9_=&%.\-,/+:]*)?$/;
const ROLE_LABELS = { owner: "Chủ sở hữu", admin: "Quản trị viên", manager: "Quản lý", member: "Nhân viên", viewer: "Chỉ xem" };
const MAX_SESSION_HISTORY = 24;
const sessionHistoryByOrg = new Map();

export function clearAiSessionHistory(orgId = null) {
  if (!orgId) {
    sessionHistoryByOrg.clear();
    return;
  }
  sessionHistoryByOrg.delete(String(orgId));
}

export function sanitizeWorktreeHref(rawHref) {
  const decodedAmp = String(rawHref || '').replace(/&amp;/g, '&').trim();
  return SAFE_WORKTREE_NAV_REGEX.test(decodedAmp) ? decodedAmp : '';
}

const QUICK_CHIPS = [
  {
    id: 'daily_executive_digest',
    label: 'Bản tin điều hành hôm nay',
    promptPreset: 'daily_executive_digest',
    displayUserText: 'Lập bản tin điều hành đầu ngày: KPI tiến độ, việc quá hạn/bị chặn và Top 3 ưu tiên.'
  },
  {
    id: 'optimize_workload',
    label: 'Cân bằng tải nhân sự',
    promptPreset: 'optimize_workload',
    displayUserText: 'Phân tích tải công việc nhân sự (>100%) và đề xuất điều phối hợp lý.'
  },
  {
    id: 'triage_overdue_and_blocked',
    label: 'Gỡ nghẽn trễ hạn',
    promptPreset: 'triage_overdue_and_blocked',
    displayUserText: 'Rà soát toàn bộ công việc quá hạn hoặc đang bị chặn bởi phụ thuộc.'
  },
  {
    id: 'plan_week',
    label: 'Đề xuất ưu tiên tuần này',
    promptPreset: null,
    displayUserText: 'Xem các công việc tuần này trong phạm vi của tôi và đề xuất thứ tự ưu tiên xử lý tối ưu nhất.'
  }
];

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[c]));
}

/**
 * Escapes HTML first to prevent XSS from untrusted task titles/comments,
 * then applies lightweight formatting (**bold**, `code`, verified worktree:// links, headings).
 */
export function renderSafeRichText(raw) {
  let html = esc(raw);
  html = html.replace(/`([^`\n]+)`/g, '<code>$1</code>');
  html = html.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\[([^\]\n]+)\]\((worktree:\/\/[^)\s\n]+)\)/g, (_, labelHtml, rawHref) => {
    const cleanHref = sanitizeWorktreeHref(rawHref);
    if (!cleanHref) return labelHtml;
    return `<button type="button" class="ai-inline-link" data-ai-nav="${esc(cleanHref)}" title="Mở trực tiếp phần cần xử lý trong WorkTree X">${LINE_ICONS.arrowUpRight}<span>${labelHtml}</span></button>`;
  });
  const formattedLines = html.split('\n').map(line => {
    const headingMatch = line.match(/^#{2,3}\s+(.+)$/);
    if (headingMatch) {
      return `<div class="ai-rich-heading">${headingMatch[1]}</div>`;
    }
    return line;
  });
  return formattedLines
    .join('<br>')
    .replace(/(<div class="ai-rich-heading">.*?<\/div>)<br>/g, '$1');
}

function injectAiStyles() {
  if (document.getElementById('worktreeAiStyles')) return;
  const style = document.createElement('style');
  style.id = 'worktreeAiStyles';
  style.textContent = `
    #aiAssistantDialog.ai-dialog{
      position:fixed;inset:12px 12px 12px auto;margin:0;z-index:70;
      width:min(464px,calc(100vw - 24px));max-width:none;height:auto;max-height:none;
      border:1px solid var(--line-strong);border-radius:var(--radius);
      box-shadow:var(--shadow-lg);font-family:var(--font-sans);
      animation:ai-panel-in .18s ease-out;
    }
    #aiAssistantDialog::backdrop{background:transparent;backdrop-filter:none}
    @keyframes ai-panel-in{from{opacity:0;transform:translateX(12px)}to{opacity:1;transform:none}}
    @media(prefers-reduced-motion:reduce){#aiAssistantDialog.ai-dialog{animation:none}}
    #aiAssistantBtn[aria-expanded=true]{background:var(--primary-soft);color:var(--primary-text)}
    #aiAssistantDialog.ai-dialog[open]{display:flex;flex-direction:column}
    #aiAssistantDialog.ai-dialog>form.ai-composer{height:auto;max-height:none;width:100%;overflow:visible;flex:0 0 auto}
    #aiAssistantDialog .dialog-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:16px 16px 12px;border-bottom:1px solid var(--line);flex-shrink:0}
    .ai-heading{display:flex;align-items:flex-start;gap:12px;min-width:0}
    .ai-heading-mark{display:grid;place-items:center;width:38px;height:38px;flex:0 0 38px;border-radius:8px;background:var(--primary-soft);color:var(--primary-text)}
    .ai-heading-body{min-width:0;overflow-wrap:anywhere}
    .ai-workspace{margin:3px 0 0;color:var(--muted);font-size:var(--text-label)}
    .ai-head-meta{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:6px}
    .ai-pill{display:inline-flex;align-items:center;gap:5px;padding:3px 9px;border-radius:999px;font-size:var(--text-sm);font-weight:600;border:1px solid var(--line);background:var(--surface-2);color:var(--muted)}
    .ai-pill.ok{background:var(--green-soft);color:var(--green)}
    .ai-pill.warn{background:var(--amber-soft);color:var(--amber)}
    .ai-pill .icon{width:13px;height:13px}
    .ai-head-actions{display:flex;align-items:center;gap:2px;flex-shrink:0}
    .ai-head-actions .icon-btn{min-width:36px;min-height:36px}
    #aiAssistantDialog .btn .icon{width:14px;height:14px;flex-shrink:0}
    .ai-chips{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;padding:10px 16px;border-bottom:1px solid var(--line);background:var(--surface-2);flex-shrink:0}
    .ai-chip{display:inline-flex;align-items:center;gap:6px;min-height:32px;padding:6px 8px;border-radius:8px;border:1px solid var(--line-strong);background:var(--surface);color:var(--text);font-size:var(--text-label);font-weight:var(--weight-medium);text-align:start;overflow-wrap:anywhere;cursor:pointer;transition:border-color .15s,background .15s}
    .ai-chip:hover:not(:disabled){border-color:var(--primary);background:var(--primary-soft);color:var(--primary-text)}
    .ai-chip:focus-visible{outline:2px solid var(--focus);outline-offset:1px}
    .ai-chip:disabled{opacity:.55;cursor:not-allowed}
    .ai-chip .icon{width:14px;height:14px;color:var(--primary-text)}
    .ai-messages{flex:1 1 auto;min-height:0;overflow:auto;overscroll-behavior:contain;padding:14px 16px;display:flex;flex-direction:column;gap:14px;background:var(--bg)}
    .ai-empty-card{border:1px solid var(--line);border-radius:10px;background:var(--surface);padding:14px;font-size:var(--text-control);color:var(--muted);line-height:1.6}
    .ai-empty-card strong{color:var(--text)}
    .ai-msg{display:flex;flex-direction:column;gap:6px;max-width:88%}
    .ai-msg.user{align-self:flex-end;align-items:flex-end}
    .ai-msg.assistant{align-self:flex-start;align-items:flex-start}
    .ai-bubble{padding:11px 14px;border-radius:12px;font-size:var(--text-control);line-height:1.6;word-break:break-word;border:1px solid var(--line)}
    .ai-msg.user .ai-bubble{background:var(--primary-soft);color:var(--text);border-color:var(--primary)}
    .ai-msg.assistant .ai-bubble{background:var(--surface);color:var(--text)}
    .ai-bubble code{font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:11.5px;padding:1px 5px;border-radius:5px;background:var(--surface-2);color:var(--text);border:1px solid var(--line)}
    .ai-rich-heading{font-size:var(--text-control);font-weight:700;color:var(--text);margin:10px 0 4px;letter-spacing:-.01em}
    .ai-rich-heading:first-child{margin-top:0}
    .ai-inline-link{display:inline-flex;align-items:center;gap:4px;padding:1px 8px;margin:1px 2px;border-radius:6px;border:1px solid var(--line-strong);background:var(--primary-soft);color:var(--primary-text);font:inherit;font-size:var(--text-label);font-weight:600;line-height:1.45;cursor:pointer;vertical-align:baseline;text-align:left;transition:border-color .15s,background .15s}
    .ai-inline-link:hover{border-color:var(--primary);background:var(--surface-2)}
    .ai-inline-link:focus-visible{outline:2px solid var(--focus);outline-offset:1px}
    .ai-inline-link .icon{width:12px;height:12px;flex-shrink:0}
    .ai-quick-links{display:flex;flex-direction:column;gap:6px;width:100%;padding:9px 11px;border-radius:10px;border:1px solid var(--line);background:var(--surface-2)}
    .ai-quick-links-title{font-size:var(--text-sm);font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.03em}
    .ai-quick-links-grid{display:flex;flex-wrap:wrap;gap:6px}
    .ai-quick-link-chip{display:inline-flex;align-items:center;gap:6px;max-width:100%;min-height:32px;padding:5px 10px;border-radius:8px;border:1px solid var(--line-strong);background:var(--surface);color:var(--text);font:inherit;font-size:var(--text-label);cursor:pointer;text-align:left;transition:border-color .15s,background .15s}
    .ai-quick-link-chip:hover{border-color:var(--primary);background:var(--primary-soft)}
    .ai-quick-link-chip:focus-visible{outline:2px solid var(--focus);outline-offset:1px}
    .ai-quick-link-chip .icon{width:13px;height:13px;flex-shrink:0;color:var(--primary-text)}
    .ai-quick-link-chip[data-tone="danger"]{border-color:var(--red);background:var(--red-soft)}
    .ai-quick-link-chip[data-tone="danger"] .icon,.ai-quick-link-chip[data-tone="danger"] .ai-quick-link-meta{color:var(--red)}
    .ai-quick-link-chip[data-tone="warn"]{border-color:var(--amber);background:var(--amber-soft)}
    .ai-quick-link-chip[data-tone="warn"] .icon,.ai-quick-link-chip[data-tone="warn"] .ai-quick-link-meta{color:var(--amber)}
    .ai-quick-link-chip[data-tone="primary"]{border-color:var(--primary);background:var(--primary-soft)}
    .ai-quick-link-text{display:inline-flex;align-items:baseline;gap:6px;flex-wrap:wrap;min-width:0}
    .ai-quick-link-label{font-weight:600;color:var(--text)}
    .ai-quick-link-meta{font-size:var(--text-sm);color:var(--muted)}
    .ai-tools-row{display:flex;flex-wrap:wrap;gap:5px;font-size:var(--text-sm);color:var(--muted)}
    .ai-tool-tag{display:inline-flex;align-items:center;gap:4px;padding:2px 7px;border-radius:999px;background:var(--surface-2);border:1px solid var(--line)}
    .ai-actions-stack{display:flex;flex-direction:column;gap:8px;width:100%;margin-top:4px}
    .ai-action-card{border:1px solid var(--line-strong);border-radius:10px;background:var(--surface);padding:11px 13px;display:flex;flex-direction:column;gap:8px}
    .ai-action-card.destructive{border-color:var(--red)}
    .ai-action-head{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap}
    .ai-action-head strong{font-size:var(--text-control);color:var(--text)}
    .ai-action-head code{font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:var(--text-sm);padding:2px 6px;border-radius:5px;background:var(--surface-2);color:var(--muted);border:1px solid var(--line)}
    .ai-action-summary{font-size:var(--text-label);color:var(--muted);line-height:1.5}
    .ai-action-btns{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
    .ai-action-status{font-size:11.5px;font-weight:600}
    .ai-action-status.done{color:var(--green)}
    .ai-action-status.err{color:var(--red)}
    .ai-composer{padding:10px 16px 12px;border-top:1px solid var(--line);background:var(--surface);display:flex;flex-direction:column;gap:8px;flex-shrink:0}
    .ai-composer-row{
      display:flex;align-items:flex-end;gap:6px;padding:4px;
      border:1px solid var(--line-strong);border-radius:10px;background:var(--surface-2);
    }
    .ai-composer-row:focus-within{border-color:var(--primary);box-shadow:0 0 0 2px var(--primary-soft)}
    .ai-composer-row .btn.primary{width:36px;min-height:36px;padding:0;flex:0 0 auto}
    .ai-composer textarea{
      flex:1;min-width:0;min-height:44px;max-height:130px;padding:5px 6px;resize:none;
      field-sizing:content;border:0;background:transparent;color:var(--text);
      font:inherit;font-size:var(--text-control);line-height:var(--leading-copy);
    }
    .ai-composer textarea:focus{outline:none}
    @media(forced-colors:active){
      .ai-composer-row:focus-within{outline:1px solid Highlight;outline-offset:1px}
    }
    .ai-error-box{padding:10px 12px;border-radius:10px;background:var(--red-soft);color:var(--red);border:1px solid var(--line);font-size:var(--text-label)}
    @media(max-width:900px){
      #aiAssistantDialog.ai-dialog{inset:var(--m-vtop,0px) 0 auto;width:100%;height:var(--m-vh,100dvh);border-radius:0;border:0;box-shadow:none}
      #aiAssistantDialog .dialog-head{padding:calc(12px + env(safe-area-inset-top,0px)) 12px 12px}
      .ai-heading{gap:8px}.ai-heading-mark{display:none}
      .ai-composer textarea{font-size:var(--text-entry)}
      .ai-composer-row .btn.primary{width:44px;min-height:44px}
      .ai-inline-link{min-height:44px}
      .ai-head-actions .icon-btn{min-width:44px;min-height:44px}
      body.m-keyboard .ai-chips{display:none}
      .ai-messages{padding:14px 16px}
      .ai-composer{padding:10px 16px calc(14px + env(safe-area-inset-bottom,0px))}
      #aiAssistantDialog .btn,.ai-chip,.ai-quick-link-chip{min-height:44px}
      .ai-msg{max-width:95%}
    }
  `;
  document.head.appendChild(style);
}

function foldLocalText(str) {
  return String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

function buildLocalAiAssistantReply({ query, promptPreset, snapshot }) {
  const snap = snapshot || {};
  const scopeLabel = snap.nodeName || snap.organizationName || 'Phạm vi hiện tại';
  const tasks = Array.isArray(snap.tasks) ? snap.tasks : [];
  const activeTasks = tasks.filter(t => t.status !== 'Hoàn thành');
  const late = Array.isArray(snap.lateTasks) ? snap.lateTasks : [];
  const blocked = Array.isArray(snap.blockedTasks) ? snap.blockedTasks : [];
  const overloaded = Array.isArray(snap.overloadPeople) ? snap.overloadPeople : [];
  const spare = Array.isArray(snap.underloadedPeople) ? snap.underloadedPeople : [];
  const quickLinks = [];
  const seenHref = new Set();
  const pushQuickLink = (item) => {
    if (!item?.href || seenHref.has(item.href) || quickLinks.length >= 6) return;
    seenHref.add(item.href);
    quickLinks.push(item);
  };
  const taskLink = (t, suffix = '') => t?.id != null ? `[${t.title}](worktree://task/${t.id}${suffix})` : `\`${t?.title || ''}\``;
  const empLink = (p) => p?.id != null ? `[${p.name}](worktree://employee/${p.id})` : `**${p?.name || ''}**`;

  if (promptPreset === 'daily_executive_digest') {
    const lines = [
      `### Tổng quan nhanh — ${scopeLabel}`,
      `Tổng **${tasks.length}** công việc (**${activeTasks.length}** đang mở, **${late.length}** quá hạn, **${blocked.length}** bị chặn).`
    ];
    if (late.length > 0) {
      lines.push('', '### Phần cần xử lý ngay — Quá hạn');
      late.slice(0, 5).forEach((t, i) => {
        lines.push(`${i + 1}. ${taskLink(t)} — ${t.ownerName || 'Chưa giao'} · Hạn ${t.due || 'N/A'} (${t.progress || 0}%)`);
        pushQuickLink({ label: t.title, meta: `Quá hạn · ${t.ownerName || 'Chưa giao'}`, href: `worktree://task/${t.id}`, tone: 'danger' });
      });
      pushQuickLink({ label: 'Danh sách việc quá hạn', meta: `${late.length} việc`, href: 'worktree://view/late', tone: 'danger' });
    }
    if (blocked.length > 0) {
      lines.push('', '### Phần cần gỡ chặn phụ thuộc');
      blocked.slice(0, 4).forEach((t, i) => {
        lines.push(`${i + 1}. ${taskLink(t, '?focus=dependencies')} — đang chờ **${(t.blockerTitles || []).join(', ') || 'đầu việc trước'}**`);
        pushQuickLink({ label: t.title, meta: 'Gỡ phụ thuộc', href: `worktree://task/${t.id}?focus=dependencies`, tone: 'warn' });
      });
    }
    if (overloaded.length > 0) {
      lines.push('', `### Nhân sự tải cao (>100%)`, `${overloaded.map(p => `${empLink(p)} (${p.load}%)`).join(', ')} · Mở [Bảng Tải công việc](worktree://view/workload) để điều phối.`);
      pushQuickLink({ label: 'Bảng Tải công việc', meta: `${overloaded.length} nhân sự >100%`, href: 'worktree://view/workload', tone: 'warn' });
    }
    return { content: lines.join('\n'), quickLinks };
  }

  if (promptPreset === 'optimize_workload') {
    if (overloaded.length === 0) {
      return {
        content: `### Tải công việc cân bằng — ${scopeLabel}\nKhông phát hiện nhân sự nào vượt quá 100% công suất tuần trong phạm vi này. Bạn có thể kiểm tra chi tiết tại [Bảng Tải công việc](worktree://view/workload).`,
        quickLinks: [{ label: 'Bảng Tải công việc', meta: 'Xem toàn đội ngũ', href: 'worktree://view/workload', tone: 'primary' }]
      };
    }
    const lines = [`### Đề xuất cân bằng tải nhân sự — ${scopeLabel}`];
    overloaded.forEach((p, idx) => {
      const target = spare[idx] || spare[0];
      lines.push(`${idx + 1}. ${empLink(p)} đang ở mức **${p.load}%** (${p.hours}h/${p.capacity}h).${target ? ` Gợi ý san bớt 1 đầu việc sang ${empLink(target)} (${target.load}%).` : ''}`);
      if (p.id != null) pushQuickLink({ label: p.name, meta: `Tải ${p.load}%`, href: `worktree://employee/${p.id}`, tone: 'danger' });
    });
    lines.push('', 'Điều hướng nhanh: [Mở bảng Tải công việc](worktree://view/workload)');
    pushQuickLink({ label: 'Bảng Tải công việc', meta: 'Điều phối ngay', href: 'worktree://view/workload', tone: 'warn' });
    return { content: lines.join('\n'), quickLinks };
  }

  if (promptPreset === 'triage_overdue_and_blocked') {
    const focus = [...late, ...blocked.filter(b => !late.some(l => l.id === b.id))];
    if (focus.length === 0) {
      return {
        content: `### Không có việc quá hạn hoặc bị chặn — ${scopeLabel}\nNhịp xử lý công việc trong phạm vi đang ổn định.`,
        quickLinks: [{ label: 'Xem Bảng Kanban', meta: scopeLabel, href: 'worktree://view/kanban', tone: 'primary' }]
      };
    }
    const lines = [`### Danh sách việc cần gỡ nghẽn (${focus.length})`];
    focus.slice(0, 8).forEach((t, i) => {
      const isBlk = blocked.some(b => b.id === t.id);
      lines.push(`${i + 1}. ${taskLink(t, isBlk ? '?focus=dependencies' : '')} · ${t.priority} · ${t.ownerName || 'Chưa giao'} · Tiến độ ${t.progress || 0}%`);
      pushQuickLink({
        label: t.title,
        meta: isBlk ? 'Gỡ phụ thuộc' : `Quá hạn · ${t.ownerName || 'Chưa giao'}`,
        href: `worktree://task/${t.id}${isBlk ? '?focus=dependencies' : ''}`,
        tone: isBlk ? 'warn' : 'danger'
      });
    });
    if (late.length > 0) pushQuickLink({ label: 'Lọc toàn bộ việc quá hạn', meta: `${late.length} việc`, href: 'worktree://view/late', tone: 'danger' });
    return { content: lines.join('\n'), quickLinks };
  }

  const foldedQ = foldLocalText(query);
  const stopWords = new Set(['tim', 'cac', 'viec', 'task', 'cong', 'cua', 'trong', 'tuan', 'nay', 'hom', 'nhung', 'ai', 'nao', 'la', 'gi', 'xem', 'cho', 'toi', 'va', 'hoac', 'chua', 'xong', 'dang']);
  const tokens = foldedQ.split(/\s+/).filter(w => w.length >= 2 && !stopWords.has(w));
  let candidates = activeTasks;
  if (/qua han|tre han|late/.test(foldedQ)) candidates = late;
  else if (/chan|phu thuoc|block|ket/.test(foldedQ)) candidates = blocked;
  else if (/khan cap|gap|urgent/.test(foldedQ)) candidates = activeTasks.filter(t => t.priority === 'Khẩn cấp' || t.priority === 'Cao');

  if (tokens.length > 0) {
    const scored = candidates.map(t => {
      const hay = foldLocalText(`${t.title} ${t.nodeName || ''} ${t.ownerName || ''} ${(t.tags || []).join(' ')} ${t.status}`);
      const hits = tokens.reduce((acc, tok) => acc + (hay.includes(tok) ? 1 : 0), 0);
      return { t, hits };
    }).filter(x => x.hits > 0).sort((a, b) => b.hits - a.hits);
    if (scored.length > 0) candidates = scored.map(x => x.t);
  }

  const top = candidates.slice(0, 6);
  if (top.length === 0) {
    return {
      content: `Không tìm thấy công việc phù hợp với "**${query}**" trong phạm vi **${scopeLabel}**. Mở [Danh sách cần chú ý](worktree://view/attention) hoặc đăng nhập Cloud Workspace để hỏi sâu hơn.`,
      quickLinks: [{ label: 'Việc cần chú ý', meta: scopeLabel, href: 'worktree://view/attention', tone: 'primary' }]
    };
  }
  top.slice(0, 4).forEach(t => {
    pushQuickLink({
      label: t.title,
      meta: `${t.status} · ${t.ownerName || 'Chưa giao'}`,
      href: `worktree://task/${t.id}`,
      tone: t.priority === 'Khẩn cấp' ? 'danger' : 'primary'
    });
  });
  return {
    content: [
      `### Kết quả trong "${scopeLabel}" (${top.length}/${candidates.length} việc khớp)`,
      ...top.map((t, i) => `${i + 1}. ${taskLink(t)} — **${t.status}** · ${t.priority} · ${t.ownerName || 'Chưa giao'}${t.due ? ` · Hạn ${t.due}` : ''}`),
      '',
      '*Chế độ dữ liệu cục bộ/mẫu. Đăng nhập WorkTree Cloud để sử dụng Claude Opus với đầy đủ công cụ ghi DB có xác nhận.*'
    ].join('\n'),
    quickLinks
  };
}

export async function openAiAssistantDialog({
  organizationId = null,
  organizationName = 'Workspace',
  role = 'member',
  onDataMutated = null,
  onNavigate = null,
  onToast = null,
  initialPrompt = null,
  initialPreset = null,
  localContextProvider = null
} = {}) {
  injectAiStyles();
  const hasLocalEngine = !organizationId && typeof localContextProvider === 'function';
  const sessionKey = String(organizationId || '__local__');

  const existing = document.getElementById('aiAssistantDialog');
  if (existing?.open && existing.dataset.sessionKey === sessionKey && !initialPrompt && !initialPreset) {
    existing.querySelector('#aiAssistantTitle')?.focus({ preventScroll: true });
    return;
  }
  if (existing?.open) existing.close();
  existing?.remove();

  const opener = document.activeElement;
  const trigger = document.getElementById('aiAssistantBtn');
  const mobile = window.matchMedia('(max-width: 900px)');
  const panelListeners = new AbortController();

  const dialog = document.createElement('dialog');
  dialog.id = 'aiAssistantDialog';
  dialog.className = 'dialog ai-dialog';
  dialog.setAttribute('aria-labelledby', 'aiAssistantTitle');
  dialog.dataset.sessionKey = sessionKey;

  const showPanel = () => {
    if (mobile.matches) {
      dialog.setAttribute('aria-modal', 'true');
      dialog.showModal();
    } else {
      dialog.removeAttribute('aria-modal');
      dialog.show();
    }
  };

  const closePanel = ({ restoreFocus = true } = {}) => {
    const hadFocus = dialog.contains(document.activeElement);
    dialog.close();
    if (restoreFocus && hadFocus && opener?.isConnected) opener.focus({ preventScroll: true });
  };

  dialog.addEventListener('close', () => {
    // Changing presentation at the breakpoint closes and immediately reopens the same dialog.
    if (dialog.open) return;
    panelListeners.abort();
    dialog.remove();
    if (!document.getElementById('aiAssistantDialog')) trigger?.setAttribute('aria-expanded', 'false');
  });
  mobile.addEventListener('change', () => {
    if (!dialog.open) return;
    const focused = dialog.contains(document.activeElement) ? document.activeElement : null;
    dialog.close();
    showPanel();
    (focused || dialog.querySelector('#aiAssistantTitle'))?.focus({ preventScroll: true });
  }, { signal: panelListeners.signal });

  const notify = (msg, kind = 'info') => {
    if (typeof onToast === 'function') onToast(msg, kind);
  };

  let statusLoading = true;
  let configured = false;
  let activeModel = 'claude-opus-5';
  let statusError = '';
  let sending = false;
  let draftText = '';
  let history = [...(sessionHistoryByOrg.get(sessionKey) || [])];
  const syncSessionHistory = () => {
    if (!dialog.isConnected || !dialog.open) return;
    if (history.length === 0) {
      sessionHistoryByOrg.delete(sessionKey);
      return;
    }
    sessionHistoryByOrg.set(sessionKey, history.slice(-MAX_SESSION_HISTORY));
  };

  const renderActionCard = (msgId, act) => {
    const state = act.uiState || 'pending'; // pending | running | done | skipped | error
    return `
      <div class="ai-action-card ${act.destructive ? 'destructive' : ''}">
        <div class="ai-action-head">
          <strong>${esc(act.title || act.toolName)}</strong>
          <code>${esc(act.toolName)}</code>
        </div>
        <div class="ai-action-summary">${esc(act.summary || '')}</div>
        ${state === 'done'
          ? `<div class="ai-action-status done">✓ ${esc(act.resultMessage || 'Đã thực hiện thành công.')}</div>`
          : state === 'skipped'
            ? `<div class="ai-action-summary">Đã bỏ qua thao tác này.</div>`
            : `
              ${state === 'error' ? `<div class="ai-action-status err">${esc(act.errorMessage || 'Không thể thực hiện.')}</div>` : ''}
              <div class="ai-action-btns">
                <button type="button" class="btn small primary" data-ai-exec="confirm" data-msg-id="${esc(msgId)}" data-act-id="${esc(act.id)}" ${state === 'running' ? 'disabled' : ''}>
                  ${LINE_ICONS.check}<span>${state === 'running' ? 'Đang thực hiện...' : 'Xác nhận thực hiện'}</span>
                </button>
                <button type="button" class="btn small" data-ai-exec="skip" data-msg-id="${esc(msgId)}" data-act-id="${esc(act.id)}" ${state === 'running' ? 'disabled' : ''}>
                  Bỏ qua
                </button>
              </div>
            `}
      </div>
    `;
  };

  const renderMessages = () => {
    if (!organizationId && !hasLocalEngine) {
      return `
        <div class="ai-empty-card">
          <strong>Chế độ mẫu cục bộ:</strong> Bạn đang xem không gian mẫu offline. Hãy đăng nhập tài khoản WorkTree Cloud (Supabase) để Trợ lý AI truy vấn và tối ưu công việc thực tế theo phân quyền của bạn.
        </div>
      `;
    }

    const statusBanner = organizationId && statusError
      ? `
        <div class="ai-error-box" role="alert">
          <strong>Chưa kết nối được Trợ lý AI.</strong> ${esc(statusError)}
          <div style="margin-top:8px;display:flex;gap:8px;align-items:center;flex-wrap:wrap">
            <button type="button" class="btn small" id="aiRetryStatusBtn">Thử kết nối lại</button>
            <span style="font-size:var(--text-sm)">Nếu đang chạy máy cá nhân, hãy khởi động lại <code>npm start</code> và tải lại trang.</span>
          </div>
        </div>
      `
      : '';

    if (history.length === 0) {
      return statusBanner + `
        <div class="ai-empty-card">
          <strong>Bạn muốn xem gì trong không gian làm việc?</strong><br>
          Chọn một gợi ý hoặc hỏi về tiến độ, việc quá hạn và tải nhân sự. Trợ lý dùng dữ liệu trong phạm vi quyền của bạn.
        </div>
      `;
    }

    return statusBanner + history.map(item => {
      if (item.role === 'user') {
        return `
          <div class="ai-msg user">
            <div class="ai-bubble">${renderSafeRichText(item.content)}</div>
          </div>
        `;
      }
      const fallbackHtml = item.fallbackFrom && item.usedModel && item.fallbackFrom !== item.usedModel
        ? `<div class="ai-tools-row"><span class="ai-tool-tag">Dự phòng từ ${esc(item.fallbackFrom)} → ${esc(item.usedModel)}</span></div>`
        : '';
      const toolsHtml = Array.isArray(item.executedTools) && item.executedTools.length > 0
        ? `<div class="ai-tools-row">${item.executedTools.map(t => `<span class="ai-tool-tag">${esc(t.name)}</span>`).join('')}</div>`
        : '';
      const safeQuickLinks = Array.isArray(item.quickLinks)
        ? item.quickLinks.filter(l => l && sanitizeWorktreeHref(l.href))
        : [];
      const quickLinksHtml = safeQuickLinks.length > 0
        ? `
          <div class="ai-quick-links" role="group" aria-label="Đi thẳng đến phần cần xử lý">
            <div class="ai-quick-links-title">Đi thẳng đến phần cần xử lý</div>
            <div class="ai-quick-links-grid">
              ${safeQuickLinks.map(link => `
                <button type="button" class="ai-quick-link-chip" data-ai-nav="${esc(sanitizeWorktreeHref(link.href))}" data-tone="${esc(link.tone || 'neutral')}">
                  ${LINE_ICONS.arrowUpRight}
                  <span class="ai-quick-link-text">
                    <span class="ai-quick-link-label">${esc(link.label)}</span>
                    ${link.meta ? `<span class="ai-quick-link-meta">${esc(link.meta)}</span>` : ''}
                  </span>
                </button>
              `).join('')}
            </div>
          </div>
        `
        : '';
      const actionsHtml = Array.isArray(item.pendingActions) && item.pendingActions.length > 0
        ? `<div class="ai-actions-stack">${item.pendingActions.map(act => renderActionCard(item.id, act)).join('')}</div>`
        : '';

      return `
        <div class="ai-msg assistant">
          ${fallbackHtml}
          ${toolsHtml}
          ${item.error
            ? `<div class="ai-error-box" role="alert">${esc(item.error)}</div>`
            : `<div class="ai-bubble">${renderSafeRichText(item.content)}</div>`}
          ${quickLinksHtml}
          ${actionsHtml}
        </div>
      `;
    }).join('') + (sending ? `
      <div class="ai-msg assistant">
        <div class="ai-bubble">Đang phân tích dữ liệu…</div>
      </div>
    ` : '');
  };

  const getStatusBadgeHtml = () => {
    if (!organizationId && hasLocalEngine) return `<span class="ai-pill ok">${LINE_ICONS.sparkles}<span>Chế độ cục bộ · Sẵn sàng</span></span>`;
    if (!organizationId) return `<span class="ai-pill warn">Chế độ cục bộ</span>`;
    if (statusLoading) return `<span class="ai-pill">Đang kiểm tra kết nối AI...</span>`;
    if (statusError) return `<span class="ai-pill warn">${esc(statusError)}</span>`;
    if (configured) return `<span class="ai-pill ok">${LINE_ICONS.sparkles}<span>${esc(activeModel)} · Sẵn sàng</span></span>`;
    return `<span class="ai-pill warn">${LINE_ICONS.alertCircle}<span>Trợ lý AI chưa được cấu hình</span></span>`;
  };

  const render = () => {
    if (!dialog.isConnected) return;
    const canType = Boolean((organizationId || hasLocalEngine) && !sending);
    const canSubmit = Boolean((organizationId || hasLocalEngine) && !sending);
    const prevInput = dialog.querySelector('#aiPromptInput');
    if (prevInput) {
      draftText = prevInput.value;
    }
    const previousFocus = document.activeElement;
    const focusId = dialog.contains(previousFocus) ? previousFocus.id : null;
    const wasFocused = Boolean(prevInput && previousFocus === prevInput);
    const selStart = wasFocused ? prevInput.selectionStart : null;
    const selEnd = wasFocused ? prevInput.selectionEnd : null;

    dialog.innerHTML = `
      <div class="dialog-head">
        <div class="ai-heading">
          <span class="ai-heading-mark" aria-hidden="true">${LINE_ICONS.sparkles}</span>
          <div class="ai-heading-body">
            <h2 id="aiAssistantTitle" tabindex="-1">Trợ lý AI</h2>
            <p class="ai-workspace">${esc(organizationName)} · ${esc(ROLE_LABELS[role] || role)}</p>
            <div class="ai-head-meta" id="aiStatusBadgeSlot">${getStatusBadgeHtml()}</div>
          </div>
        </div>
        <div class="ai-head-actions">
          ${history.length > 0 ? `<button type="button" class="icon-btn" id="aiClearBtn" aria-label="Bắt đầu cuộc trò chuyện mới" title="Bắt đầu cuộc trò chuyện mới">${LINE_ICONS.trash}</button>` : ''}
          <button type="button" class="icon-btn" id="aiCloseBtn" aria-label="Đóng Trợ lý AI">${LINE_ICONS.x}</button>
        </div>
      </div>

      <div class="ai-chips" role="group" aria-label="Tác vụ tối ưu nhanh">
        ${QUICK_CHIPS.map(chip => `
          <button type="button" class="ai-chip" data-ai-chip="${esc(chip.id)}" ${!canSubmit ? 'disabled' : ''}>
            ${LINE_ICONS.sparkles}<span>${esc(chip.label)}</span>
          </button>
        `).join('')}
      </div>

      <div class="ai-messages" id="aiMessagesScroll" role="log" aria-live="polite">
        ${renderMessages()}
      </div>

      <form class="ai-composer" id="aiComposerForm">
        <div class="ai-composer-row">
          <textarea id="aiPromptInput" aria-label="Nội dung gửi Trợ lý AI" rows="2" placeholder="${(organizationId || hasLocalEngine) ? 'Hỏi về tiến độ, việc quá hạn, tải nhân sự hoặc nhờ chia checklist...' : 'Đăng nhập tài khoản Cloud để trò chuyện với dữ liệu công việc...'}" ${!canType ? 'disabled' : ''}>${esc(draftText)}</textarea>
          <button type="submit" class="btn primary" id="aiSendBtn" aria-label="${sending ? 'Đang gửi' : 'Gửi tin nhắn'}" title="Gửi tin nhắn" ${!canSubmit || !draftText.trim() ? 'disabled' : ''}>
            ${LINE_ICONS.send}
          </button>
        </div>
      </form>
    `;

    bindEvents();
    if (focusId) {
      const target = document.getElementById(focusId);
      if (target && dialog.contains(target) && !target.disabled) {
        target.focus({ preventScroll: true });
        if (wasFocused && selStart != null && selEnd != null) {
          target.setSelectionRange(selStart, selEnd);
        }
      } else {
        dialog.querySelector('#aiAssistantTitle')?.focus({ preventScroll: true });
      }
    }
    const scroller = dialog.querySelector('#aiMessagesScroll');
    if (scroller) scroller.scrollTop = scroller.scrollHeight;
  };

  const submitPrompt = async ({ text, promptPreset = null }) => {
    const cleanText = String(text || '').trim();
    if ((!cleanText && !promptPreset) || sending || (!organizationId && !hasLocalEngine)) return;

    draftText = '';
    const input = dialog.querySelector('#aiPromptInput');
    if (input) input.value = '';
    history.push({
      id: `u_${Date.now()}`,
      role: 'user',
      content: cleanText
    });
    sending = true;
    render();

    try {
      if (!organizationId && hasLocalEngine) {
        const snapshot = localContextProvider();
        const localReply = buildLocalAiAssistantReply({
          query: cleanText,
          promptPreset,
          snapshot
        });
        history.push({
          id: `a_${Date.now()}`,
          role: 'assistant',
          content: localReply.content,
          quickLinks: localReply.quickLinks || [],
          executedTools: [{ name: 'worktree_local_snapshot' }],
          pendingActions: []
        });
        syncSessionHistory();
      } else {
        const apiMessages = history
          .filter(m => !m.error && (m.role === 'user' || m.role === 'assistant'))
          .map(m => ({ role: m.role, content: m.content }));

        const res = await AiClientService.sendMessage({
          organizationId,
          messages: promptPreset ? apiMessages.slice(0, -1) : apiMessages,
          promptPreset
        });

        if (res.model) {
          activeModel = res.model;
        }

        history.push({
          id: `a_${Date.now()}`,
          role: 'assistant',
          content: res.reply || '',
          usedModel: res.model || '',
          fallbackFrom: res.fallbackFrom || '',
          quickLinks: Array.isArray(res.quickLinks) ? res.quickLinks : [],
          executedTools: res.executedTools || [],
          pendingActions: (res.pendingActions || []).map(a => ({ ...a, uiState: 'pending' }))
        });
        syncSessionHistory();
      }
    } catch (err) {
      history.push({
        id: `e_${Date.now()}`,
        role: 'assistant',
        content: '',
        error: err.message || 'Không thể kết nối Trợ lý AI.'
      });
    } finally {
      sending = false;
      render();
    }
  };

  const bindEvents = () => {
    dialog.querySelector('#aiCloseBtn')?.addEventListener('click', () => closePanel());

    dialog.querySelector('#aiRetryStatusBtn')?.addEventListener('click', () => {
      void checkStatus();
    });

    dialog.querySelector('#aiClearBtn')?.addEventListener('click', () => {
      history = [];
      syncSessionHistory();
      render();
      dialog.querySelector('#aiPromptInput')?.focus();
    });

    dialog.querySelectorAll('[data-ai-nav]').forEach(btn => {
      btn.addEventListener('click', () => {
        const href = sanitizeWorktreeHref(btn.dataset.aiNav);
        if (!href) return;
        const label = btn.querySelector('.ai-quick-link-label')?.textContent?.trim()
          || btn.textContent?.trim()
          || '';
        syncSessionHistory();
        closePanel({ restoreFocus: false });
        if (typeof onNavigate === 'function') {
          void onNavigate(href, label);
        }
      });
    });

    const inputEl = dialog.querySelector('#aiPromptInput');
    const sendButton = dialog.querySelector('#aiSendBtn');
    inputEl?.addEventListener('input', () => {
      draftText = inputEl.value;
      sendButton.disabled = inputEl.disabled || sending || !draftText.trim();
    });
    inputEl?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
        e.preventDefault();
        void submitPrompt({ text: inputEl.value });
      }
    });

    dialog.querySelector('#aiComposerForm')?.addEventListener('submit', (e) => {
      e.preventDefault();
      void submitPrompt({ text: inputEl?.value || draftText });
    });

    dialog.querySelectorAll('[data-ai-chip]').forEach(btn => {
      btn.addEventListener('click', () => {
        const chip = QUICK_CHIPS.find(c => c.id === btn.dataset.aiChip);
        if (!chip) return;
        void submitPrompt({ text: chip.displayUserText, promptPreset: chip.promptPreset });
      });
    });

    dialog.querySelectorAll('[data-ai-exec]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const msgId = btn.dataset.msgId;
        const actId = btn.dataset.actId;
        const mode = btn.dataset.aiExec;
        const msg = history.find(m => m.id === msgId);
        const act = msg?.pendingActions?.find(a => a.id === actId);
        if (!act) return;

        if (mode === 'skip') {
          act.uiState = 'skipped';
          syncSessionHistory();
          render();
          return;
        }

        act.uiState = 'running';
        render();
        try {
          const res = await AiClientService.executeAction({
            organizationId,
            toolName: act.toolName,
            arguments: act.arguments
          });
          act.uiState = 'done';
          act.resultMessage = res.message || 'Đã cập nhật thành công.';
          notify(act.resultMessage, 'info');
          if (typeof onDataMutated === 'function') {
            void onDataMutated();
          }
        } catch (err) {
          act.uiState = 'error';
          act.errorMessage = err.message || 'Không thể thực hiện thao tác.';
          notify(act.errorMessage, 'error');
        } finally {
          syncSessionHistory();
          render();
        }
      });
    });
  };

  dialog.addEventListener('cancel', event => {
    event.preventDefault();
    closePanel();
  });
  dialog.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || event.defaultPrevented || event.isComposing) return;
    event.preventDefault();
    event.stopPropagation();
    closePanel();
  });

  const checkStatus = async () => {
    if (!organizationId) {
      statusLoading = false;
      render();
      return;
    }
    statusLoading = true;
    statusError = '';
    const slot = dialog.querySelector('#aiStatusBadgeSlot');
    if (slot) slot.innerHTML = getStatusBadgeHtml();
    try {
      const status = await AiClientService.getStatus(organizationId);
      configured = Boolean(status.configured);
      activeModel = status.model || activeModel;
      statusError = '';
    } catch (err) {
      statusError = err.message || 'Không kiểm tra được trạng thái AI.';
    } finally {
      statusLoading = false;
      render();
    }
  };

  document.body.appendChild(dialog);
  render();
  showPanel();
  trigger?.setAttribute('aria-expanded', 'true');
  dialog.querySelector('#aiAssistantTitle')?.focus({ preventScroll: true });

  await checkStatus();

  if (dialog.open && dialog.isConnected && (initialPrompt || initialPreset)) {
    void submitPrompt({ text: initialPrompt || '', promptPreset: initialPreset || null });
  }
}
