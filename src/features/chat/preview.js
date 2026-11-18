import { mountChatFeature, createMockChatAdapter } from './index.js';
import { ICONS } from '../../design-system/icons.js';

for (const node of document.querySelectorAll('[data-preview-icon]')) node.innerHTML = ICONS[node.dataset.previewIcon] || '';
const app = document.getElementById('app');
const sidebar = document.getElementById('sidebar');
const scrim = document.querySelector('.sidebar-scrim');
function syncSidebar() {
  const mobile = matchMedia('(max-width:900px)').matches;
  sidebar.inert = mobile && !sidebar.classList.contains('mobile-open');
}
function closeSidebar() { sidebar.classList.remove('mobile-open'); scrim.hidden = true; syncSidebar(); }
function toggleDesktopSidebar() {
  const collapsed = !app.classList.contains('sidebar-collapsed');
  app.classList.toggle('sidebar-collapsed', collapsed);
  app.classList.toggle('collapsed', collapsed);
  if (collapsed) document.body.dataset.sidebarCollapsed = 'true'; else delete document.body.dataset.sidebarCollapsed;
}
document.addEventListener('click', event => {
  if (event.target.closest('[data-preview-theme]')) {
    const dark = document.documentElement.dataset.theme !== 'dark';
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    for (const node of document.querySelectorAll('[data-preview-theme] [data-preview-icon]')) node.innerHTML = ICONS[dark ? 'sun' : 'moon'];
  }
  if (event.target.closest('[data-preview-sidebar]')) {
    if (matchMedia('(max-width:900px)').matches) { const open = !sidebar.classList.contains('mobile-open'); sidebar.classList.toggle('mobile-open', open); scrim.hidden = !open; syncSidebar(); }
    else toggleDesktopSidebar();
  }
});
document.addEventListener('keydown', event => { if (event.key === 'Escape') closeSidebar(); if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'b' && !event.target.matches('input,textarea')) { event.preventDefault(); toggleDesktopSidebar(); } });
window.addEventListener('resize', syncSidebar);
syncSidebar();
mountChatFeature({
  host: document.getElementById('messagesContent'),
  getContext: () => ({ organizationId: 'preview-worktree', userId: 'preview-tuan-anh', displayName: 'Trần Tuấn Anh' }),
  createAdapter: createMockChatAdapter,
  standalone: true,
  onCloseSidebar: closeSidebar
});
