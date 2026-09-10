const { strict: assert } = require('node:assert');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { test } = require('node:test');

async function loadStateModule() {
  const source = readFileSync(join(__dirname, '..', 'src', 'app', 'state.js'), 'utf8');
  const moduleUrl = `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
  return import(moduleUrl);
}

test('normalizes repository star ID arrays to a Set for UI mutations', async () => {
  const { normalizeStarredTaskIds } = await loadStateModule();
  const starredTaskIds = normalizeStarredTaskIds(['task-a', 'task-b', 'task-a']);

  assert.equal(starredTaskIds instanceof Set, true);
  assert.equal(starredTaskIds.size, 2);
  assert.equal(starredTaskIds.has('task-a'), true);
  assert.equal(starredTaskIds.has('task-b'), true);
});

test('keeps an existing Set instance intact', async () => {
  const { normalizeStarredTaskIds } = await loadStateModule();
  const existing = new Set(['task-a']);
  const normalized = normalizeStarredTaskIds(existing);

  assert.equal(normalized, existing);
  assert.equal(normalized.has('task-a'), true);
});
