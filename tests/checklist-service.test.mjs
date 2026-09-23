import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const serviceUrl = new URL('../src/features/checklists/services/checklist-service.js', import.meta.url);
let source = await readFile(serviceUrl, 'utf8');
source = source.replace(
  /import \{ ChecklistRepository, TaskRepository \} from '[^']+';/,
  `export const updateCalls = [];
   const ChecklistRepository = {
     async updateChecklistItem(itemId, updates) {
       updateCalls.push({ itemId, updates });
       return { id: itemId, content: updates.content };
     }
   };
   const TaskRepository = { async getTaskById() { return null; } };`
).replace(
  /import \{ appState \} from '[^']+';/,
  `const appState = { activeOrganizationId: 'org-a' };`
);
const moduleUrl = `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const { ChecklistService, updateCalls } = await import(moduleUrl);

test('updateItem trims and persists checklist content', async () => {
  const result = await ChecklistService.updateItem({
    itemId: 'item-1',
    content: '  Nội dung đã sửa  '
  });

  assert.equal(result.content, 'Nội dung đã sửa');
  assert.deepEqual(updateCalls.at(-1), {
    itemId: 'item-1',
    updates: { content: 'Nội dung đã sửa' }
  });
});

test('updateItem rejects blank, oversized, and missing item values', async () => {
  await assert.rejects(
    () => ChecklistService.updateItem({ content: 'Nội dung' }),
    /Thiếu itemId/
  );
  await assert.rejects(
    () => ChecklistService.updateItem({ itemId: 'item-1', content: '   ' }),
    /không được để trống/
  );
  await assert.rejects(
    () => ChecklistService.updateItem({ itemId: 'item-1', content: 'x'.repeat(401) }),
    /tối đa 400 ký tự/
  );
});
