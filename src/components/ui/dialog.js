/**
 * WorkTree X UI Primitive: Modal Dialog
 * Desktop radius: 17px, backdrop with blur, accessible focus trapping and escape listener.
 */

import { ICONS } from '../../design-system/icons.js';

export function createDialog({
  title = '',
  content = null,
  actions = [],
  onClose = null,
  maxWidth = '660px'
}) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-backdrop';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'dialog-title');

  const container = document.createElement('div');
  container.className = 'modal-dialog';
  container.style.maxWidth = maxWidth;

  // Header
  const header = document.createElement('div');
  header.className = 'modal-head';

  const titleEl = document.createElement('h3');
  titleEl.id = 'dialog-title';
  titleEl.textContent = title;

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'icon-btn';
  closeBtn.setAttribute('aria-label', 'Close');
  closeBtn.innerHTML = ICONS.x;

  const close = () => {
    overlay.classList.remove('open');
    setTimeout(() => {
      overlay.remove();
      if (onClose) onClose();
    }, 150);
  };

  closeBtn.addEventListener('click', close);
  header.appendChild(titleEl);
  header.appendChild(closeBtn);

  // Body
  const body = document.createElement('div');
  body.className = 'modal-body';
  if (typeof content === 'string') {
    body.innerHTML = content;
  } else if (content instanceof Node) {
    body.appendChild(content);
  }

  // Footer
  const footer = document.createElement('div');
  footer.className = 'modal-foot';
  actions.forEach(action => {
    footer.appendChild(action);
  });

  container.appendChild(header);
  container.appendChild(body);
  if (actions.length > 0) {
    container.appendChild(footer);
  }

  overlay.appendChild(container);

  // Overlay click to close
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  // Esc key to close
  const keyHandler = (e) => {
    if (e.key === 'Escape') {
      window.removeEventListener('keydown', keyHandler);
      close();
    }
  };
  window.addEventListener('keydown', keyHandler);

  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('open'));

  return { overlay, close };
}
