/**
 * Explicit compatibility boundary between ES modules and the classic runtime.
 *
 * This module does not make globals part of the target architecture. It centralizes
 * the temporary bridge so each binding can be removed with its owning feature.
 */

export function publishLegacyGlobals(bindings, target = globalThis.window) {
  if (!target || !bindings) return;

  for (const [name, value] of Object.entries(bindings)) {
    if (!name || value === undefined) continue;
    target[name] = value;
  }
}

export function getLegacyGlobal(name, target = globalThis.window) {
  if (!target || !name) return undefined;
  return target[name];
}

export function callLegacyGlobal(name, args = [], target = globalThis.window) {
  const callback = getLegacyGlobal(name, target);
  if (typeof callback !== 'function') return undefined;
  return callback(...args);
}
