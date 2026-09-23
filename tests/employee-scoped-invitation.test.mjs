import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const serviceUrl = new URL('../src/features/employees/services/employee-service.js', import.meta.url);
const source = await readFile(serviceUrl, 'utf8');
const instrumented = source.replace(
  /import \{ EmployeeRepository, InvitationRepository, OrganizationRepository \} from '[^']+';/,
  `export const invitationCalls = [];
   const EmployeeRepository = {};
   const OrganizationRepository = {};
   const InvitationRepository = {
     async createInvitation(payload) {
       invitationCalls.push(payload);
       return 'test-token';
     }
   };`
);
const moduleUrl = `data:text/javascript;base64,${Buffer.from(instrumented).toString('base64')}`;
const { EmployeeService, invitationCalls } = await import(moduleUrl);

test('scoped invitation accepts only member/viewer and normalizes its payload', async () => {
  await assert.rejects(
    () => EmployeeService.inviteScopedMember({
      organizationId: 'org-a', email: 'lead@example.com', fullName: 'Lead',
      homeNodeId: 'node-a', role: 'manager'
    }),
    /chỉ có thể mời vai trò Nhân viên hoặc Chỉ xem/
  );

  const token = await EmployeeService.inviteScopedMember({
    organizationId: 'org-a',
    email: '  PERSON@EXAMPLE.COM ',
    fullName: '  Nguyễn Văn A ',
    homeNodeId: 'node-a',
    role: 'viewer',
    scopeNodeIds: []
  });

  assert.equal(token, 'test-token');
  assert.deepEqual(invitationCalls.at(-1), {
    organizationId: 'org-a',
    email: 'person@example.com',
    fullName: 'Nguyễn Văn A',
    homeNodeId: 'node-a',
    role: 'viewer',
    scopeNodeIds: ['node-a'],
    employeeId: null
  });
});

test('scoped invitation rejects incomplete identity and placement', async () => {
  await assert.rejects(
    () => EmployeeService.inviteScopedMember({ organizationId: 'org-a', email: 'bad', fullName: 'A', homeNodeId: 'node-a' }),
    /Định dạng email/
  );
  await assert.rejects(
    () => EmployeeService.inviteScopedMember({ organizationId: 'org-a', email: 'a@example.com', fullName: ' ', homeNodeId: 'node-a' }),
    /Họ và tên/
  );
  await assert.rejects(
    () => EmployeeService.inviteScopedMember({ organizationId: 'org-a', email: 'a@example.com', fullName: 'A' }),
    /Phòng ban hoặc dự án/
  );
});
