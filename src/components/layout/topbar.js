/**
 * WorkTree X Topbar Layout Component
 * Desktop height: 70px
 */

import { ICONS } from '../../design-system/icons.js';

export function createTopbar({
  onSearch = null,
  onToggleTheme = null,
  onOpenNotifications = null,
  user = null
} = {}) {
  const topbar = document.createElement('header');
  topbar.className = 'topbar';

  topbar.innerHTML = `
    <div class="topbar-search">
      ${ICONS.search}
      <input type="search" id="topbarSearchInput" placeholder="Tìm công việc, dự án... (Ctrl+K)" aria-label="Tìm kiếm">
    </div>
    <div class="topbar-actions">
      <button type="button" class="icon-btn" id="themeToggleBtn" aria-label="Đổi giao diện sáng/tối">
        ${ICONS.moon}
      </button>
      <button type="button" class="icon-btn" id="notificationBtn" aria-label="Thông báo">
        ${ICONS.bell}
      </button>
      <div class="user-profile" id="userProfileBtn">
        <span class="user-avatar">${user?.name ? user.name[0].toUpperCase() : 'U'}</span>
      </div>
    </div>
  `.trim();

  if (onSearch) {
    topbar.querySelector('#topbarSearchInput')?.addEventListener('input', (e) => onSearch(e.target.value));
  }
  if (onToggleTheme) {
    topbar.querySelector('#themeToggleBtn')?.addEventListener('click', onToggleTheme);
  }
  if (onOpenNotifications) {
    topbar.querySelector('#notificationBtn')?.addEventListener('click', onOpenNotifications);
  }

  return topbar;
}
