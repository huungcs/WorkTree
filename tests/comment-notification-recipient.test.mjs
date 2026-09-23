import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveCommentZaloRecipients } from '../src/features/comments/services/comment-service.js';

const employees = [
  { id: 'employee-mkt-assignee', home_node_id: 'department-mkt', zalo_chat_id: 'zalo-mkt-assignee' },
  { id: 'employee-mkt-manager', home_node_id: 'department-mkt', zalo_chat_id: 'zalo-mkt-manager' },
  { id: 'employee-cskh', home_node_id: 'department-cskh', zalo_chat_id: 'zalo-cskh' }
];

test('comment Zalo notification targets only the task primary assignee', () => {
  const recipients = resolveCommentZaloRecipients({
    assigneeId: 'employee-mkt-assignee',
    currentEmployeeId: 'employee-mkt-manager',
    employees
  });

  assert.deepEqual(recipients, ['zalo-mkt-assignee']);
  assert.equal(recipients.includes('zalo-cskh'), false);
});

test('assignee commenting on their own task does not notify other departments', () => {
  const recipients = resolveCommentZaloRecipients({
    assigneeId: 'employee-mkt-assignee',
    currentEmployeeId: 'employee-mkt-assignee',
    employees
  });

  assert.deepEqual(recipients, []);
});

test('comment Zalo notification is skipped when the assignee has no linked account', () => {
  const recipients = resolveCommentZaloRecipients({
    assigneeId: 'employee-without-zalo',
    currentEmployeeId: 'employee-mkt-manager',
    employees: [...employees, { id: 'employee-without-zalo', home_node_id: 'department-mkt' }]
  });

  assert.deepEqual(recipients, []);
});
