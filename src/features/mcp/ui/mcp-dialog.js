/**
 * WorkTree X Feature: MCP Connection Manager Dialog
 * Provides zero-auth capability URL creation, copy, key rotation, toggle, revoke,
 * and direct setup guides for ChatGPT, Claude, Claude Code, and Gemini CLI.
 * Adheres strictly to WorkTree X Design System CSS tokens & accessibility rules.
 */

import { McpClientService } from '../services/mcp-client-service.js';
import { ICONS } from '../../../design-system/icons.js';

const LINE_ICONS = {
  bot: ICONS.bot,
  x: ICONS.x,
  plus: ICONS.plus,
  check: ICONS.check,
  copy: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
  refresh: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/></svg>',
  trash: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>',
  link: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>',
  shield: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>'
};

const ROLE_LABELS = {
  owner: 'Chủ sở hữu',
  admin: 'Quản trị viên',
  manager: 'Quản lý',
  member: 'Nhân viên',
  viewer: 'Chỉ xem'
};

const MCP_PLAYBOOK_PROMPTS = [
  {
    id: 'daily_executive_digest',
    title: 'Bản tin điều hành đầu ngày',
    desc: 'Tổng hợp KPI tiến độ, việc quá hạn, đến hạn hôm nay & Top 3 ưu tiên.',
    text: 'Hãy chạy kịch bản daily_executive_digest trên WorkTree X: tổng hợp KPI hoàn thành, danh sách công việc quá hạn hoặc đến hạn hôm nay, việc đang bị chặn và đề xuất Top 3 ưu tiên cần xử lý ngay.'
  },
  {
    id: 'optimize_workload',
    title: 'Cân bằng tải nhân sự',
    desc: 'Phát hiện người vượt ngưỡng 100% và đề xuất điều phối lại công việc.',
    text: 'Hãy chạy kịch bản optimize_workload trên WorkTree X: phân tích tải công việc theo nhân sự (workload_by_employee), chỉ ra ai đang vượt tải >100% và đề xuất chuyển việc sang người còn dư công suất (hỏi mình xác nhận trước khi cập nhật).'
  },
  {
    id: 'triage_overdue_and_blocked',
    title: 'Gỡ nghẽn quá hạn & phụ thuộc',
    desc: 'Kiểm tra chuỗi phụ thuộc (task_dependencies) và đề xuất thứ tự gỡ kẹt.',
    text: 'Hãy chạy kịch bản triage_overdue_and_blocked trên WorkTree X: rà soát việc quá hạn và các việc đang bị chặn bởi phụ thuộc, chỉ rõ công việc tiền đề nào cần chốt trước để thông luồng.'
  },
  {
    id: 'breakdown_task_checklist',
    title: 'Chia nhỏ việc thành Checklist',
    desc: 'Đọc chi tiết công việc và thêm hàng loạt bước checklist trong 1 lượt.',
    text: 'Hãy kiểm tra danh sách công việc đang mở của dự án hiện tại, chọn 1 đầu việc quan trọng chưa có checklist và dùng kịch bản breakdown_task_checklist để chia nhỏ thành 5–7 bước cụ thể (hỏi mình duyệt danh sách trước khi thêm hàng loạt).'
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

function formatMcpUiError(errOrMessage, fallback = 'Không thể kết nối máy chủ MCP. Vui lòng thử lại.') {
  const errObj = errOrMessage && typeof errOrMessage === 'object' ? errOrMessage : null;
  const msg = String(errObj ? errObj.message : (errOrMessage || '')).trim();
  if (
    errObj?.code === 'missing_backend_config' ||
    errObj?.status === 503 ||
    /Missing backend service configuration/i.test(msg)
  ) {
    return 'Máy chủ hiện tại chưa cấu hình khóa backend Supabase. Trên Vercel, vào Project Settings → Environment Variables để thêm biến kết nối server rồi Redeploy.';
  }
  return msg || fallback;
}

function formatDateTime(iso) {
  if (!iso) return 'Chưa sử dụng';
  try {
    return new Intl.DateTimeFormat('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Ho_Chi_Minh'
    }).format(new Date(iso));
  } catch {
    return String(iso).slice(0, 16);
  }
}

function formatLogTime(iso) {
  if (!iso) return '';
  try {
    return new Intl.DateTimeFormat('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZone: 'Asia/Ho_Chi_Minh'
    }).format(new Date(iso));
  } catch {
    return String(iso).slice(11, 19);
  }
}

async function copyToClipboard(text) {
  if (!text) return false;
  try {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (_) {}
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

function injectMcpStyles() {
  if (document.getElementById('worktreeMcpStyles')) return;
  const style = document.createElement('style');
  style.id = 'worktreeMcpStyles';
  style.textContent = `
    .mcp-hub-container{display:flex;flex-direction:column;gap:20px;font-family:var(--font-sans);color:var(--text);min-width:0}
    .mcp-dialog{width:min(780px,calc(100vw - 24px));max-height:calc(100dvh - 32px);padding:0;border:1px solid var(--line);border-radius:var(--radius);background:var(--surface);color:var(--text);box-shadow:var(--shadow-lg);overflow:hidden;font-family:var(--font-sans)}
    .mcp-dialog[open]{display:flex;flex-direction:column}
    .mcp-dialog .dialog-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:20px 24px 16px;border-bottom:1px solid var(--line);flex-shrink:0}
    .mcp-dialog .dialog-scroll{flex:1 1 auto;min-height:0;overflow-y:auto;padding:20px 24px;display:flex;flex-direction:column;gap:20px}
    .mcp-banner{display:flex;align-items:flex-start;gap:12px;padding:14px 16px;border-radius:12px;background:var(--primary-soft);border:1px solid var(--line);color:var(--text);font-size:var(--text-control);line-height:1.55}
    .mcp-banner-icon{display:grid;place-items:center;width:36px;height:36px;border-radius:10px;background:var(--surface);color:var(--primary-text);flex-shrink:0;border:1px solid var(--line)}
    .mcp-banner-icon .icon{width:18px;height:18px}
    .mcp-card{border:1px solid var(--line);border-radius:12px;background:var(--surface-2);padding:16px;display:flex;flex-direction:column;gap:12px}
    .mcp-card-title{margin:0;font-size:var(--text-control);font-weight:var(--weight-strong);color:var(--text);display:flex;align-items:center;gap:8px}
    .mcp-card-title .icon{width:16px;height:16px;color:var(--primary-text)}
    .mcp-form-row{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
    .mcp-field{min-width:0;display:flex;flex-direction:column;gap:6px;font-size:var(--text-label);font-weight:var(--weight-medium);color:var(--text)}
    .mcp-field input,.mcp-field select{width:100%;box-sizing:border-box;min-height:44px;padding:8px 11px;border:1px solid var(--line-strong);border-radius:8px;background:var(--surface);color:var(--text);font-size:var(--text-control);font-family:inherit}
    .mcp-banner-content{min-width:0;flex:1}
    .mcp-banner-content h3{margin:0 0 3px;font-size:var(--text-control)}
    .mcp-banner-content p{margin:0;color:var(--muted);overflow-wrap:anywhere}
    .mcp-banner>.btn{align-self:center}
    .mcp-mode-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
    .mcp-mode-option{position:relative;display:flex;flex-direction:column;gap:4px;padding:11px 12px 11px 38px;border:1px solid var(--line-strong);border-radius:10px;background:var(--surface);cursor:pointer;text-align:left;transition:border-color .15s,background .15s}
    .mcp-mode-option input{position:absolute;inset-inline-start:12px;top:13px;width:16px;height:16px;margin:0;accent-color:var(--primary)}
    .mcp-mode-option input:focus-visible{outline:none}
    .mcp-mode-option:has(:focus-visible){outline:2px solid var(--focus);outline-offset:2px}
    .mcp-mode-option:has(:disabled){opacity:.55;cursor:not-allowed}
    .mcp-mode-option.is-selected{border-color:var(--primary);background:var(--primary-soft)}
    .mcp-mode-option strong{font-size:var(--text-control);color:var(--text)}
    .mcp-mode-option small{font-size:11px;color:var(--muted);line-height:1.45}
    .mcp-form-actions{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}
    .mcp-role-pill{display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:var(--radius-badge,5px);font-size:11px;font-weight:var(--weight-medium);background:var(--surface);border:1px solid var(--line);color:var(--muted)}
    .mcp-role-pill .icon{width:13px;height:13px;color:var(--primary-text)}
    .mcp-list{display:flex;flex-direction:column;gap:12px}
    .mcp-item{border:1px solid var(--line);border-radius:12px;background:var(--surface);padding:14px 16px;display:flex;flex-direction:column;gap:10px}
    .mcp-item-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;flex-wrap:wrap}
    .mcp-item-title{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
    .mcp-item-title strong{font-size:var(--text-control);font-weight:var(--weight-strong);color:var(--text)}
    .mcp-badge{display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:var(--radius-badge,5px);font-size:10.5px;font-weight:600}
    .mcp-badge.active{background:var(--green-soft);color:var(--green)}
    .mcp-badge.disabled{background:var(--amber-soft);color:var(--amber)}
    .mcp-badge.mode{background:var(--primary-soft);color:var(--primary-text)}
    .mcp-url-box{display:flex;align-items:center;gap:8px;background:var(--surface-2);border:1px solid var(--line-strong);border-radius:9px;padding:5px 6px 5px 10px}
    .mcp-url-box input{flex:1;min-width:0;width:100%;border:0;background:transparent;color:var(--text);font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:11.5px;outline:none;padding:4px 0}
    .mcp-item-meta{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;font-size:11px;color:var(--muted)}
    .mcp-item-actions{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
    .mcp-guide{border:1px solid var(--line);border-radius:12px;background:var(--surface);overflow:hidden}
    .mcp-guide-tabs{display:flex;gap:4px;padding:8px 12px 0;background:var(--surface-2);border-bottom:1px solid var(--line);overflow-x:auto}
    .mcp-guide-tab{padding:8px 12px;border:0;background:transparent;color:var(--muted);font-size:var(--text-label);font-weight:var(--weight-medium);border-bottom:2px solid transparent;cursor:pointer;white-space:nowrap}
    .mcp-guide-tab[aria-selected="true"]{color:var(--primary-text);border-bottom-color:var(--primary);font-weight:var(--weight-strong)}
    .mcp-guide-body{padding:14px 16px;font-size:var(--text-label);color:var(--subtle);line-height:1.65}
    .mcp-guide-body ol{margin:0;padding-left:18px;display:flex;flex-direction:column;gap:6px}
    .mcp-guide-code{margin:8px 0 0;padding:10px 12px;border-radius:8px;background:var(--surface-2);border:1px solid var(--line);font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:11px;color:var(--text);overflow-x:auto;white-space:pre-wrap;word-break:break-all}
    .mcp-error{padding:10px 12px;border-radius:8px;background:var(--red-soft);color:var(--red);font-size:var(--text-label);border:1px solid var(--line)}
    .mcp-empty{padding:20px;text-align:center;font-size:var(--text-label);color:var(--muted);border:1px dashed var(--line-strong);border-radius:10px}
    .mcp-guide-note{margin-top:10px;padding:10px 12px;border-radius:8px;background:var(--surface-2);border:1px solid var(--line);font-size:11.5px;color:var(--text);line-height:1.55}
    .mcp-prompt-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
    .mcp-prompt-card{border:1px solid var(--line);border-radius:10px;background:var(--surface);padding:12px;display:flex;flex-direction:column;justify-content:space-between;gap:10px}
    .mcp-prompt-card strong{font-size:var(--text-control);color:var(--text);display:block;margin-bottom:3px}
    .mcp-prompt-card small{font-size:11.5px;color:var(--muted);line-height:1.45;display:block}
    .mcp-prompt-foot{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap}
    .mcp-section-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px;flex-wrap:wrap}
    .mcp-logs-list{display:flex;flex-direction:column;gap:8px}
    .mcp-log-row{border:1px solid var(--line);border-radius:10px;background:var(--surface);padding:10px 12px;display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;font-size:var(--text-label)}
    .mcp-log-main{display:flex;align-items:center;gap:8px;flex-wrap:wrap;min-width:0}
    .mcp-log-meta{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:11px;color:var(--muted)}
    .mcp-badge.status-success{background:var(--green-soft);color:var(--green)}
    .mcp-badge.status-denied{background:var(--amber-soft);color:var(--amber)}
    .mcp-badge.status-error{background:var(--red-soft);color:var(--red)}
    @media(max-width:900px){
      .mcp-dialog{width:100vw;max-width:100vw;height:100dvh;max-height:100dvh;border-radius:0;border:0}
      .mcp-dialog .dialog-head{padding:calc(12px + env(safe-area-inset-top,0px)) 16px 12px}
      .mcp-field :is(input,select),.mcp-url-box input{font-size:var(--text-entry)}
      .mcp-banner{flex-wrap:wrap}
      .mcp-banner-content{flex-basis:calc(100% - 48px)}
      .mcp-dialog .dialog-scroll{padding:16px 16px calc(24px + env(safe-area-inset-bottom,0px))}
      .mcp-form-row,.mcp-mode-grid,.mcp-prompt-grid{grid-template-columns:1fr}
      .mcp-dialog .btn,.mcp-hub-container .btn,.mcp-guide-tab{min-height:44px}
      .mcp-url-box{flex-direction:column;align-items:stretch;padding:8px}
      .mcp-url-box .btn{width:100%;justify-content:center}
    }
  `;
  document.head.appendChild(style);
}

export async function openMcpDialog({
  container = null,
  organizationId,
  organizationName = 'Workspace',
  role = 'member',
  nodes = [],
  onToast = null
} = {}) {
  injectMcpStyles();

  const targetContainer = container || (typeof document !== 'undefined' ? document.getElementById('mcpHubContent') : null);
  const inlineMode = Boolean(targetContainer);

  if (!organizationId && !inlineMode) {
    if (typeof onToast === 'function') onToast('Cần mở một không gian làm việc đám mây để tạo link MCP.', 'error');
    return;
  }

  let hostEl;
  if (inlineMode) {
    hostEl = targetContainer;
    hostEl.className = 'hub-panel-body mcp-hub-container';
  } else {
    const existing = document.getElementById('mcpDialog');
    if (existing) existing.remove();
    hostEl = document.createElement('dialog');
    hostEl.id = 'mcpDialog';
    hostEl.className = 'dialog mcp-dialog';
    hostEl.setAttribute('aria-labelledby', 'mcpDialogTitle');
    hostEl.setAttribute('aria-modal', 'true');
  }

  const notify = (msg, kind = 'info') => {
    if (typeof onToast === 'function') onToast(msg, kind);
  };

  let servers = [];
  let logs = [];
  let loading = true;
  let logsLoading = false;
  let logsMigrationRequired = false;
  let loadError = '';
  let formError = '';
  let activeGuideTab = 'chatgpt';
  let selectedMode = role === 'viewer' ? 'read_only' : 'full';
  let pendingRevokeId = null;
  let creating = false;
  let busyId = null;

  const branchOptions = (nodes || [])
    .filter(n => n && n.type !== 'person')
    .map(n => `<option value="${esc(n.id)}">${esc(n.name)} (${esc(n.type)})</option>`)
    .join('');

  const renderGuideContent = () => {
    const latestUrl = servers.find(s => s.status === 'active' && s.url)?.url || `${window.location.origin}/mcp/wtmcp_...`;
    if (activeGuideTab === 'chatgpt') {
      return `
        <ol>
          <li>Vào <strong>chatgpt.com/plugins</strong> (hoặc mục <strong>Connectors / MCP</strong>) → bấm <strong>+ Add custom MCP server</strong>.</li>
          <li>Đặt tên: <strong>WorkTree X</strong> (hoặc tên doanh nghiệp của bạn).</li>
          <li>Ở ô <strong>Server URL</strong>, dán link MCP vừa sao chép ở trên.</li>
          <li>Mục <strong>Authentication</strong>: chọn <strong>No authentication</strong> → xác nhận hiểu rủi ro → bấm <strong>Create</strong>.</li>
          <li>Trong đoạn chat mới, gõ <code>@WorkTree X</code> và dùng thử mẫu câu lệnh bên dưới.</li>
        </ol>
      `;
    }
    if (activeGuideTab === 'claude') {
      return `
        <ol>
          <li>Mở <strong>claude.ai/customize/connectors</strong> (dùng trực tiếp gói <strong>Claude Pro</strong> sẵn có, không tốn phí API riêng) → bấm <strong>+ Add custom connector</strong>.</li>
          <li>Nhập tên <strong>WorkTree X</strong> và dán link MCP vào ô <strong>URL</strong>.</li>
          <li>Mục <strong>Authentication</strong>: chọn <strong>No sign in</strong> (không cần nhập OAuth Client ID/Secret) → bấm <strong>Add</strong>.</li>
          <li>Trong đoạn chat, bấm <strong>+ → Connectors</strong> và bật <strong>WorkTree X</strong> (có thể chọn prompt mẫu tích hợp sẵn trong WorkTree X).</li>
          <li><strong>Chạy tự động 24/7 (tắt máy vẫn chạy):</strong> Vào mục <strong>Scheduled Tasks</strong> trên Claude.ai, đặt lịch mỗi sáng 08:00 gọi connector <strong>WorkTree X</strong> với kịch bản <code>daily_executive_digest</code> để nhận bản tin quá hạn &amp; tải công việc.</li>
        </ol>
        <div class="mcp-guide-note">
          <strong>Lưu ý tên miền:</strong> Trang web <code>claude.ai</code> yêu cầu link MCP là địa chỉ <strong>HTTPS công khai</strong> (bản đã deploy lên Vercel/domain). Khi đang chạy thử trên <code>localhost</code>, hãy chuyển sang tab <strong>Claude Code / Gemini CLI</strong> để kết nối trực tiếp từ máy bạn.
        </div>
      `;
    }
    const cliCmd = `claude mcp add --transport http worktree-x "${latestUrl}"`;
    const geminiJson = JSON.stringify({
      mcpServers: {
        worktreex: {
          httpUrl: latestUrl,
          timeout: 120000
        }
      }
    }, null, 2);
    return `
      <ol>
        <li><strong>Claude Code CLI (dùng gói Claude Pro, chạy được cả localhost &amp; HTTPS):</strong> chạy lệnh sau trong terminal:<pre class="mcp-guide-code">${esc(cliCmd)}</pre>
          <div style="margin-top:6px"><button type="button" class="btn small" data-mcp-action="copy-cli">${LINE_ICONS.copy}<span>Sao chép lệnh CLI</span></button></div>
        </li>
        <li><strong>Gemini CLI:</strong> thêm vào file <code>~/.gemini/settings.json</code>:<pre class="mcp-guide-code">${esc(geminiJson)}</pre></li>
      </ol>
    `;
  };

  const renderServerCard = (srv) => {
    const isActive = srv.status === 'active';
    const isBusy = busyId === srv.id;
    const isConfirmRevoke = pendingRevokeId === srv.id;
    const displayUrl = srv.url || `${window.location.origin}/mcp/${srv.keyPrefix}...`;
    const modeLabel = srv.accessMode === 'read_only' ? 'Chỉ đọc & Báo cáo' : 'Điều hành (Đọc & Ghi)';

    return `
      <article class="mcp-item" data-mcp-id="${esc(srv.id)}">
        <div class="mcp-item-head">
          <div class="mcp-item-title">
            <strong>${esc(srv.name)}</strong>
            <span class="mcp-badge ${isActive ? 'active' : 'disabled'}">${isActive ? 'Đang hoạt động' : 'Đang tạm dừng'}</span>
            <span class="mcp-badge mode">${esc(modeLabel)}</span>
          </div>
          <div class="mcp-item-actions">
            <button type="button" class="btn small" data-mcp-action="rotate" data-id="${esc(srv.id)}" ${isBusy ? 'disabled' : ''} title="Tạo link mới, vô hiệu hóa link cũ ngay lập tức">
              ${LINE_ICONS.refresh}<span>Xoay key</span>
            </button>
            <button type="button" class="btn small" data-mcp-action="toggle" data-id="${esc(srv.id)}" data-next="${isActive ? 'disabled' : 'active'}" ${isBusy ? 'disabled' : ''}>
              <span>${isActive ? 'Tạm dừng' : 'Kích hoạt'}</span>
            </button>
            ${isConfirmRevoke ? `
              <button type="button" class="btn small danger" data-mcp-action="revoke-confirm" data-id="${esc(srv.id)}" ${isBusy ? 'disabled' : ''}>
                ${LINE_ICONS.trash}<span>Xác nhận thu hồi</span>
              </button>
              <button type="button" class="btn small text-btn" data-mcp-action="revoke-cancel" ${isBusy ? 'disabled' : ''}>Hủy</button>
            ` : `
              <button type="button" class="btn small danger" data-mcp-action="revoke-ask" data-id="${esc(srv.id)}" ${isBusy ? 'disabled' : ''}>
                ${LINE_ICONS.trash}<span>Thu hồi</span>
              </button>
            `}
          </div>
        </div>
        <div class="mcp-url-box">
          <input type="text" readonly value="${esc(displayUrl)}" aria-label="Link MCP cho ${esc(srv.name)}" data-mcp-url-input="${esc(srv.id)}">
          <button type="button" class="btn small primary" data-mcp-action="copy" data-id="${esc(srv.id)}" ${!srv.url ? 'disabled' : ''}>
            ${LINE_ICONS.copy}<span>Sao chép link</span>
          </button>
        </div>
        <div class="mcp-item-meta">
          <span>Mã: <code>${esc(srv.keyPrefix)}…</code> · Giới hạn: ${esc(srv.rateLimitPerMin)} lệnh/phút</span>
          <span>Dùng gần nhất: ${esc(formatDateTime(srv.lastUsedAt))}${srv.lastClient ? ` (${esc(srv.lastClient)})` : ''}</span>
        </div>
      </article>
    `;
  };

  const render = () => {
    const canWriteMode = role !== 'viewer';
    const listHtml = !organizationId
      ? '<div class="mcp-empty">Bạn đang xem không gian mẫu cục bộ. Đăng nhập tài khoản Cloud (Supabase) ở một tổ chức thực tế để khởi tạo và đồng bộ link MCP trực tiếp với ChatGPT / Claude.</div>'
      : loading
        ? '<div class="mcp-empty">Đang tải danh sách kết nối MCP...</div>'
        : loadError
          ? `<div class="mcp-error">${esc(loadError)} <button type="button" class="btn small" id="mcpRetryBtn" style="margin-left:8px">Thử lại</button></div>`
          : servers.length === 0
            ? '<div class="mcp-empty">Chưa có link kết nối MCP nào. Tạo link đầu tiên ở phía trên để dán vào ChatGPT hoặc Claude.</div>'
            : `<div class="mcp-list">${servers.map(renderServerCard).join('')}</div>`;

    const createCardHtml = !organizationId ? '' : `
      <form class="mcp-card" id="mcpCreateForm">
        <h3 class="mcp-card-title">${LINE_ICONS.link}<span>Tạo link kết nối AI mới</span></h3>
        ${formError ? `<div class="mcp-error" role="alert">${esc(formError)}</div>` : ''}
        <div class="mcp-form-row">
          <label class="mcp-field">
            <span>Tên kết nối</span>
            <input id="mcpNameInput" maxlength="120" required placeholder="Ví dụ: ChatGPT Điều hành công việc" value="ChatGPT — ${esc(organizationName)}">
          </label>
          <label class="mcp-field">
            <span>Giới hạn phạm vi đơn vị (tùy chọn)</span>
            <select id="mcpScopeSelect">
              <option value="">Toàn bộ phạm vi quyền hiện tại của bạn</option>
              ${branchOptions}
            </select>
          </label>
        </div>
        <div class="mcp-mode-grid" role="radiogroup" aria-label="Chế độ quyền MCP">
          <label class="mcp-mode-option ${selectedMode === 'full' ? 'is-selected' : ''}">
            <input type="radio" name="mcpAccessMode" value="full" ${selectedMode === 'full' ? 'checked' : ''} ${!canWriteMode ? 'disabled' : ''}>
            <strong>Điều hành (Đọc &amp; Ghi theo vai trò)</strong>
            <small>AI xem báo cáo, tạo việc, đổi trạng thái, cập nhật checklist, bình luận và chấm giờ theo đúng vai trò của bạn.</small>
          </label>
          <label class="mcp-mode-option ${selectedMode === 'read_only' ? 'is-selected' : ''}">
            <input type="radio" name="mcpAccessMode" value="read_only" ${selectedMode === 'read_only' ? 'checked' : ''}>
            <strong>Chỉ đọc &amp; Báo cáo (An toàn)</strong>
            <small>AI chỉ được đọc công việc, tiến độ KPI và tải nhân sự; mọi công cụ chỉnh sửa dữ liệu đều bị khóa.</small>
          </label>
        </div>
        <div class="mcp-form-actions">
          <span class="mcp-role-pill">${LINE_ICONS.shield}<span>Vai trò thực thi: ${esc(ROLE_LABELS[role] || role)}</span></span>
          <button type="submit" class="btn primary" id="mcpCreateSubmitBtn" ${creating ? 'disabled' : ''}>
            ${LINE_ICONS.plus}<span>${creating ? 'Đang khởi tạo...' : 'Tạo link MCP'}</span>
          </button>
        </div>
      </form>
    `;

    const bodyHtml = `
      <div class="mcp-banner">
        <span class="mcp-banner-icon" aria-hidden="true">${LINE_ICONS.bot}</span>
        <div class="mcp-banner-content">
          <h3>Kết nối AI với ${esc(organizationName)}</h3>
          <p>AI hoạt động trong phạm vi quyền của bạn. Giữ riêng link kết nối và tạo lại link nếu bị lộ.</p>
        </div>
        ${typeof window !== 'undefined' && typeof window.openAiAssistantDialog === 'function' ? `<button type="button" class="btn" data-mcp-action="open-ai-assistant">${LINE_ICONS.bot}<span>Mở Trợ lý AI</span></button>` : ''}
      </div>

      ${createCardHtml}

      <section aria-label="Danh sách link MCP">
        <h3 class="mcp-card-title" style="margin-bottom:10px">${LINE_ICONS.bot}<span>Link MCP đang quản lý (${servers.length})</span></h3>
        ${listHtml}
      </section>

      <section class="mcp-guide" aria-label="Hướng dẫn kết nối nhanh">
        <div class="mcp-guide-tabs" role="tablist">
          <button type="button" class="mcp-guide-tab" role="tab" data-guide-tab="chatgpt" aria-selected="${activeGuideTab === 'chatgpt'}">ChatGPT (Web)</button>
          <button type="button" class="mcp-guide-tab" role="tab" data-guide-tab="claude" aria-selected="${activeGuideTab === 'claude'}">Claude.ai (Gói Pro)</button>
          <button type="button" class="mcp-guide-tab" role="tab" data-guide-tab="cli" aria-selected="${activeGuideTab === 'cli'}">Claude Code / Gemini CLI</button>
        </div>
        <div class="mcp-guide-body">
          ${renderGuideContent()}
        </div>
      </section>

      <section aria-label="Mẫu câu lệnh AI điều hành">
        <div class="mcp-section-head">
          <h3 class="mcp-card-title" style="margin:0">${LINE_ICONS.bot}<span>Mẫu câu lệnh</span></h3>
        </div>
        <div class="mcp-prompt-grid">
          ${MCP_PLAYBOOK_PROMPTS.map(p => `
            <article class="mcp-prompt-card">
              <div>
                <strong>${esc(p.title)}</strong>
                <small>${esc(p.desc)}</small>
              </div>
              <div class="mcp-prompt-foot">

                <button type="button" class="btn small" data-mcp-action="copy-prompt" data-prompt-id="${esc(p.id)}">
                  ${LINE_ICONS.copy}<span>Sao chép lệnh</span>
                </button>
              </div>
            </article>
          `).join('')}
        </div>
      </section>

      ${!organizationId ? '' : `
      <section aria-label="Nhật ký hoạt động AI gần đây">
        <div class="mcp-section-head">
          <h3 class="mcp-card-title" style="margin:0">${LINE_ICONS.shield}<span>Nhật ký hoạt động AI gần đây (${logs.length})</span></h3>
          <button type="button" class="btn small" data-mcp-action="refresh-logs" ${logsLoading ? 'disabled' : ''}>
            ${LINE_ICONS.refresh}<span>${logsLoading ? 'Đang tải...' : 'Làm mới'}</span>
          </button>
        </div>
        ${logsLoading && logs.length === 0
          ? '<div class="mcp-empty">Đang tải nhật ký hoạt động AI...</div>'
          : logsMigrationRequired
            ? '<div class="mcp-empty">Cơ sở dữ liệu chưa áp dụng bảng <code>mcp_call_logs</code>. Hãy chạy migration MCP mới nhất để lưu lịch sử gọi tool AI.</div>'
            : logs.length === 0
              ? '<div class="mcp-empty">Chưa có lượt gọi AI nào được ghi nhận cho không gian làm việc này.</div>'
              : `<div class="mcp-logs-list">${logs.map(log => {
                const statusClass = log.status === 'success' ? 'status-success' : (log.status === 'denied' ? 'status-denied' : 'status-error');
                const statusLabel = log.status === 'success' ? 'Thành công' : (log.status === 'denied' ? 'Từ chối quyền' : 'Lỗi');
                const actionLabel = log.toolName || log.method || 'mcp';
                return `
                  <div class="mcp-log-row">
                    <div class="mcp-log-main">
                      <span class="mcp-badge ${statusClass}">${esc(statusLabel)}</span>
                      <code>${esc(actionLabel)}</code>
                      ${log.mcpName ? `<span class="mcp-badge mode">${esc(log.mcpName)}</span>` : ''}
                    </div>
                    <div class="mcp-log-meta">
                      ${log.clientInfo ? `<span>${esc(log.clientInfo)}</span>` : ''}
                      ${log.durationMs != null ? `<span>${esc(log.durationMs)} ms</span>` : ''}
                      <span>${esc(formatLogTime(log.createdAt))}</span>
                    </div>
                  </div>
                `;
              }).join('')}</div>`}
      </section>
      `}
    `;

    if (inlineMode) {
      hostEl.innerHTML = bodyHtml;
    } else {
      hostEl.innerHTML = `
        <div class="dialog-head">
          <div>
            <p class="overline">WORKTREE X / MODEL CONTEXT PROTOCOL</p>
            <h2 id="mcpDialogTitle">Kết nối AI (MCP Server)</h2>
            <p class="dialog-sub">Dán link MCP vào ChatGPT hoặc Claude để điều hành công việc trực tiếp mà không cần cấu hình xác thực OAuth.</p>
          </div>
          <button type="button" class="icon-btn" id="mcpCloseBtn" aria-label="Đóng cửa sổ kết nối AI">
            ${LINE_ICONS.x}
          </button>
        </div>
        <div class="dialog-scroll">
          ${bodyHtml}
        </div>
      `;
    }

    bindEvents();
  };

  const refreshLogsOnly = async () => {
    if (!organizationId) return;
    logsLoading = true;
    render();
    try {
      const res = await McpClientService.listMcpLogs(organizationId, { limit: 12 });
      logs = res.logs || [];
      logsMigrationRequired = Boolean(res.migrationRequired);
    } catch (_) {
      // Non-fatal so main MCP link controls stay usable
    } finally {
      logsLoading = false;
      render();
    }
  };

  const refreshList = async () => {
    if (!organizationId) {
      loading = false;
      loadError = '';
      render();
      return;
    }
    loading = true;
    logsLoading = true;
    loadError = '';
    render();
    try {
      const [srvResult, logResult] = await Promise.allSettled([
        McpClientService.listMcpServers(organizationId),
        McpClientService.listMcpLogs(organizationId, { limit: 12 })
      ]);
      if (srvResult.status === 'fulfilled') {
        servers = srvResult.value;
      } else {
        loadError = formatMcpUiError(srvResult.reason, 'Không thể tải danh sách kết nối MCP.');
      }
      if (logResult.status === 'fulfilled') {
        logs = logResult.value.logs || [];
        logsMigrationRequired = Boolean(logResult.value.migrationRequired);
      }
    } catch (err) {
      loadError = formatMcpUiError(err, 'Không thể tải danh sách kết nối MCP.');
    } finally {
      loading = false;
      logsLoading = false;
      render();
    }
  };

  const bindEvents = () => {
    hostEl.querySelector('#mcpCloseBtn')?.addEventListener('click', () => {
      if (!inlineMode) {
        hostEl.close();
        hostEl.remove();
      }
    });

    hostEl.querySelector('#mcpRetryBtn')?.addEventListener('click', () => {
      void refreshList();
    });

    hostEl.querySelectorAll('input[name="mcpAccessMode"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        selectedMode = e.target.value === 'read_only' ? 'read_only' : 'full';
        hostEl.querySelectorAll('.mcp-mode-option').forEach(opt => {
          const input = opt.querySelector('input');
          opt.classList.toggle('is-selected', input && input.checked);
        });
      });
    });

    hostEl.querySelectorAll('[data-guide-tab]').forEach(tabBtn => {
      tabBtn.addEventListener('click', () => {
        activeGuideTab = tabBtn.dataset.guideTab;
        render();
      });
    });

    hostEl.querySelector('#mcpCreateForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (creating) return;
      const name = hostEl.querySelector('#mcpNameInput')?.value.trim() || '';
      const scopeVal = hostEl.querySelector('#mcpScopeSelect')?.value || '';
      formError = '';
      if (!name) {
        formError = 'Vui lòng nhập tên kết nối MCP.';
        render();
        return;
      }
      creating = true;
      render();
      try {
        const created = await McpClientService.createMcpServer({
          organizationId,
          name,
          accessMode: selectedMode,
          scopeNodeIds: scopeVal ? [scopeVal] : []
        });
        servers = [created, ...servers];
        if (created?.url && await copyToClipboard(created.url)) {
          notify('Đã tạo link MCP và sao chép vào khay nhớ tạm!');
        } else {
          notify('Đã tạo link MCP thành công!');
        }
      } catch (err) {
        formError = formatMcpUiError(err, 'Không thể tạo kết nối MCP.');
      } finally {
        creating = false;
        render();
      }
    });

    hostEl.querySelectorAll('[data-mcp-url-input]').forEach(inp => {
      inp.addEventListener('focus', () => inp.select());
    });

    hostEl.querySelectorAll('[data-mcp-action]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const action = btn.dataset.mcpAction;
        const id = btn.dataset.id;
        const target = servers.find(s => s.id === id);

        if (action === 'copy' && target?.url) {
          const ok = await copyToClipboard(target.url);
          notify(ok ? 'Đã sao chép link MCP! Dán trực tiếp vào ChatGPT hoặc Claude (No sign in).' : 'Không thể tự sao chép, vui lòng chọn và bấm Ctrl+C.', ok ? 'info' : 'error');
          return;
        }

        if (action === 'copy-cli') {
          const latestUrl = servers.find(s => s.status === 'active' && s.url)?.url || `${window.location.origin}/mcp/wtmcp_...`;
          const cliCmd = `claude mcp add --transport http worktree-x "${latestUrl}"`;
          const ok = await copyToClipboard(cliCmd);
          notify(ok ? 'Đã sao chép lệnh Claude Code CLI!' : 'Không thể tự sao chép, vui lòng copy thủ công.', ok ? 'info' : 'error');
          return;
        }

        if (action === 'copy-prompt') {
          const promptId = btn.dataset.promptId;
          const promptObj = MCP_PLAYBOOK_PROMPTS.find(p => p.id === promptId);
          if (promptObj) {
            const ok = await copyToClipboard(promptObj.text);
            notify(ok ? `Đã sao chép mẫu câu lệnh "${promptObj.title}"! Dán vào Claude hoặc ChatGPT để chạy.` : 'Không thể tự sao chép.', ok ? 'info' : 'error');
          }
          return;
        }

        if (action === 'refresh-logs') {
          await refreshLogsOnly();
          return;
        }

        if (action === 'open-ai-assistant') {
          if (typeof window !== 'undefined' && typeof window.openAiAssistantDialog === 'function') {
            if (!inlineMode) {
              hostEl.close();
              hostEl.remove();
            }
            await window.openAiAssistantDialog();
          }
          return;
        }

        if (action === 'revoke-ask') {
          pendingRevokeId = id;
          render();
          return;
        }

        if (action === 'revoke-cancel') {
          pendingRevokeId = null;
          render();
          return;
        }

        if (action === 'rotate' && id) {
          busyId = id;
          render();
          try {
            const updated = await McpClientService.rotateMcpKey({ organizationId, mcpId: id });
            servers = servers.map(s => s.id === id ? updated : s);
            if (updated?.url && await copyToClipboard(updated.url)) {
              notify('Đã xoay key mới (link cũ đã bị vô hiệu hóa) và sao chép link mới!');
            } else {
              notify('Đã xoay key mới thành công. Link cũ đã ngừng hoạt động.');
            }
          } catch (err) {
            notify(err.message || 'Không thể xoay key.', 'error');
          } finally {
            busyId = null;
            render();
          }
          return;
        }

        if (action === 'toggle' && id) {
          const nextStatus = btn.dataset.next === 'disabled' ? 'disabled' : 'active';
          busyId = id;
          render();
          try {
            const updated = await McpClientService.toggleMcpServer({ organizationId, mcpId: id, status: nextStatus });
            servers = servers.map(s => s.id === id ? updated : s);
            notify(nextStatus === 'active' ? 'Đã kích hoạt lại kết nối MCP.' : 'Đã tạm dừng kết nối MCP.');
          } catch (err) {
            notify(err.message || 'Không thể cập nhật trạng thái.', 'error');
          } finally {
            busyId = null;
            render();
          }
          return;
        }

        if (action === 'revoke-confirm' && id) {
          busyId = id;
          render();
          try {
            await McpClientService.deleteMcpServer({ organizationId, mcpId: id });
            servers = servers.filter(s => s.id !== id);
            pendingRevokeId = null;
            notify('Đã thu hồi vĩnh viễn link MCP.');
          } catch (err) {
            notify(err.message || 'Không thể thu hồi kết nối.', 'error');
          } finally {
            busyId = null;
            render();
          }
        }
      });
    });
  };

  if (!inlineMode) {
    hostEl.addEventListener('cancel', (e) => {
      e.preventDefault();
      hostEl.close();
      hostEl.remove();
    });
    hostEl.addEventListener('click', (e) => {
      if (e.target === hostEl) {
        hostEl.close();
        hostEl.remove();
      }
    });

    document.body.appendChild(hostEl);
    render();
    hostEl.showModal();
  }
  await refreshList();
}
