/**
 * WorkTree X UI Primitive: Panel / Card
 * 14px radius, 1px line border, surface background, subtle shadow.
 */

export function createPanel({ title = '', extra = null, content = null, className = '' }) {
  const panel = document.createElement('section');
  panel.className = ['panel', className].filter(Boolean).join(' ');

  if (title || extra) {
    const head = document.createElement('div');
    head.className = 'panel-head';

    if (title) {
      const h3 = document.createElement('h3');
      h3.textContent = title;
      head.appendChild(h3);
    }

    if (extra) {
      const extraContainer = document.createElement('div');
      extraContainer.className = 'panel-head-extra';
      if (typeof extra === 'string') {
        extraContainer.innerHTML = extra;
      } else if (extra instanceof Node) {
        extraContainer.appendChild(extra);
      }
      head.appendChild(extraContainer);
    }

    panel.appendChild(head);
  }

  const body = document.createElement('div');
  body.className = 'panel-body';
  if (typeof content === 'string') {
    body.innerHTML = content;
  } else if (content instanceof Node) {
    body.appendChild(content);
  }
  panel.appendChild(body);

  return panel;
}
