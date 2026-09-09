/**
 * WorkTree X Mobile Bottom Navigation Component
 * Height: 74px + safe-area-inset-bottom
 * Boundary: Mobile <= 900px
 */

import { ICONS } from '../../design-system/icons.js';

export function createBottomNav({
  activeView = 'overview',
  onNavigate = null,
  onCreateTask = null,
  onOpenPins = null,
  onOpenMenu = null
} = {}) {
  const nav = document.createElement('nav');
  nav.id = 'mobileBottomNav';
  nav.className = 'mobile-only m-nav';
  nav.setAttribute('aria-label', 'Điều hướng nhanh');

  const slots = [
    { key: 'overview', label: 'Tổng quan', icon: ICONS.kanban },
    { key: 'list', label: 'Công việc', icon: ICONS.list },
    { key: 'create', label: 'Thêm việc', icon: ICONS.plus, isAction: true },
    { key: 'pins', label: 'Ghim', icon: ICONS.pin },
    { key: 'menu', label: 'Menu', icon: ICONS.menu, isAction: true }
  ];

  slots.forEach(slot => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('data-mobile', slot.key);

    if (slot.isAction && slot.key === 'create') {
      btn.className = 'm-create';
      btn.innerHTML = `<span class="m-create-icon">${slot.icon}</span><span>${slot.label}</span>`;
      btn.addEventListener('click', () => {
        if (onCreateTask) onCreateTask();
      });
    } else {
      if (slot.key === activeView) {
        btn.setAttribute('aria-current', 'page');
      }
      btn.innerHTML = `${slot.icon}<span>${slot.label}</span>`;
      btn.addEventListener('click', () => {
        if (slot.key === 'menu') {
          if (onOpenMenu) onOpenMenu();
        } else if (slot.key === 'pins') {
          if (onOpenPins) onOpenPins();
        } else {
          if (onNavigate) onNavigate(slot.key);
        }
      });
    }

    nav.appendChild(btn);
  });

  return nav;
}
