/**
 * WorkTree X UI Primitive: Badge / Tag
 * Semantic tones: green, amber, red, blue, purple, neutral
 */

export function createBadge({ label, tone = 'neutral', icon = null }) {
  const badge = document.createElement('span');
  badge.className = `badge badge-${tone}`;
  if (icon) {
    badge.innerHTML = `${icon}<span>${label}</span>`;
  } else {
    badge.textContent = label;
  }
  return badge;
}
