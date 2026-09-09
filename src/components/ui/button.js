/**
 * WorkTree X UI Primitive: Button
 * Strict adherence to 8px radius, 36px min-height, semantic variants.
 */

export function createButton({
  label = '',
  variant = 'default', // default | primary | soft | danger | text | icon
  icon = null,
  id = '',
  className = '',
  type = 'button',
  disabled = false,
  onClick = null,
  ariaLabel = ''
}) {
  const btn = document.createElement('button');
  btn.type = type;
  if (id) btn.id = id;
  if (disabled) btn.disabled = true;
  if (ariaLabel) btn.setAttribute('aria-label', ariaLabel);

  const baseClass = 'btn';
  const variantClass = `btn-${variant}`;
  btn.className = [baseClass, variantClass, className].filter(Boolean).join(' ');

  if (icon && !label) {
    btn.innerHTML = icon;
  } else if (icon && label) {
    btn.innerHTML = `${icon}<span>${label}</span>`;
  } else {
    btn.textContent = label;
  }

  if (onClick) {
    btn.addEventListener('click', onClick);
  }

  return btn;
}
