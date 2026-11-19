import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import {
  buildAutoSummaryText,
  countMatchingEmployees,
  createRecurringTasksService,
  formatAssignmentLabel,
  formatCadenceLabel,
  isTemplateDueOnDate,
  parseChecklistInput,
  parseTagsInput,
  resetEnsureTodayCache,
  selectTodayFocusTasks,
  validateCheckinInput,
  validateTemplateInput
} from '../src/features/recurring-tasks/index.js';

const ROOT = join(import.meta.dirname, '..');

test('validateTemplateInput handles job_title, org_role, employee modes and normalizes inputs', () => {
  const jobRule = validateTemplateInput({
    organizationId: 'org-1',
    title: '  Đối soát đơn hàng cuối ca  ',
    assignmentMode: 'job_title',
    targetJobTitle: '  Nhân viên Kinh doanh ',
    cadence: 'weekdays',
    estimateMinutes: 45,
    tags: 'sales, hang-ngay, sales',
    checklistItems: 'Kiểm tra đơn\nChốt doanh thu\n\nGửi báo cáo'
  });

  assert.equal(jobRule.organization_id, 'org-1');
  assert.equal(jobRule.title, 'Đối soát đơn hàng cuối ca');
  assert.equal(jobRule.assignment_mode, 'job_title');
  assert.equal(jobRule.target_job_title, 'Nhân viên Kinh doanh');
  assert.equal(jobRule.target_org_role, null);
  assert.equal(jobRule.target_employee_id, null);
  assert.deepEqual(jobRule.tags, ['sales', 'hang-ngay']);
  assert.deepEqual(jobRule.checklist_items, ['Kiểm tra đơn', 'Chốt doanh thu', 'Gửi báo cáo']);

  const roleRule = validateTemplateInput({
    organizationId: 'org-1',
    title: 'Duyệt tiến độ phòng ban',
    assignmentMode: 'org_role',
    targetOrgRole: 'manager',
    cadence: 'weekly',
    daysOfWeek: [5, 1]
  });
  assert.equal(roleRule.target_org_role, 'manager');
  assert.deepEqual(roleRule.days_of_week, [1, 5]);

  const empRule = validateTemplateInput({
    organizationId: 'org-1',
    title: 'Báo cáo quỹ tiền mặt',
    assignmentMode: 'employee',
    targetEmployeeId: 'emp-99',
    cadence: 'monthly',
    dayOfMonth: 31
  });
  assert.equal(empRule.target_employee_id, 'emp-99');
  assert.equal(empRule.day_of_month, 31);

  assert.throws(() => validateTemplateInput({ organizationId: 'org-1', title: 'Test', assignmentMode: 'job_title' }));
  assert.throws(() => validateTemplateInput({ organizationId: 'org-1', title: 'Test', assignmentMode: 'org_role', targetOrgRole: 'invalid' }));
  assert.throws(() => validateTemplateInput({ organizationId: 'org-1', title: 'Test', assignmentMode: 'job_title', targetJobTitle: 'QA', cadence: 'weekly', daysOfWeek: [] }));
  assert.throws(() => validateTemplateInput({ organizationId: 'org-1', title: 'Test', assignmentMode: 'job_title', targetJobTitle: 'QA', cadence: 'monthly', dayOfMonth: 32 }));
});

test('isTemplateDueOnDate matches daily, weekdays, weekly, and clamps monthly day 31 in short months', () => {
  // 2026-11-19 is Thursday (ISODOW = 4)
  assert.equal(isTemplateDueOnDate({ cadence: 'daily' }, '2026-11-21'), true);
  assert.equal(isTemplateDueOnDate({ cadence: 'weekdays' }, '2026-11-19'), true);
  assert.equal(isTemplateDueOnDate({ cadence: 'weekdays' }, '2026-11-21'), false); // Saturday
  assert.equal(isTemplateDueOnDate({ cadence: 'weekdays' }, '2026-11-22'), false); // Sunday

  assert.equal(isTemplateDueOnDate({ cadence: 'weekly', days_of_week: [1, 4] }, '2026-11-19'), true);
  assert.equal(isTemplateDueOnDate({ cadence: 'weekly', days_of_week: [1, 5] }, '2026-11-19'), false);

  // Feb non-leap year 2026 has 28 days -> day_of_month=31 clamps to Feb 28
  assert.equal(isTemplateDueOnDate({ cadence: 'monthly', day_of_month: 31 }, '2026-02-28'), true);
  assert.equal(isTemplateDueOnDate({ cadence: 'monthly', day_of_month: 31 }, '2026-02-27'), false);
  // Nov has 30 days -> day_of_month=31 clamps to Nov 30
  assert.equal(isTemplateDueOnDate({ cadence: 'monthly', day_of_month: 31 }, '2026-11-30'), true);
});

test('formatting and employee match counts behave cleanly across job_title, org_role, and employee', () => {
  const employees = [
    { id: 'e1', full_name: 'Nguyễn An', job_title: 'Kinh doanh', employment_status: 'active' },
    { id: 'e2', full_name: 'Trần Bình', job_title: '  kinh doanh ', employment_status: 'active' },
    { id: 'e3', full_name: 'Lê Chi', job_title: 'Kế toán', employment_status: 'suspended' }
  ];

  assert.equal(countMatchingEmployees({ assignment_mode: 'job_title', target_job_title: 'Kinh doanh' }, { employees }), 2);
  assert.equal(countMatchingEmployees({ assignment_mode: 'job_title', target_job_title: 'Kế toán' }, { employees }), 0);
  assert.equal(countMatchingEmployees({ assignment_mode: 'employee', target_employee_id: 'e1' }, { employees }), 1);
  // When members/roles aren't attached to employee rows, org_role returns null rather than misleading 0
  assert.equal(countMatchingEmployees({ assignment_mode: 'org_role', target_org_role: 'member' }, { employees }), null);

  assert.equal(formatCadenceLabel({ cadence: 'weekly', days_of_week: [1, 3, 5] }), 'Hằng tuần (T2, T4, T6)');
  assert.equal(formatAssignmentLabel({ assignment_mode: 'employee', target_employee_id: 'e1' }, { employees }), 'Nhân sự: Nguyễn An');
});

test('validateCheckinInput, buildAutoSummaryText, and selectTodayFocusTasks work end-to-end', () => {
  const today = '2026-11-19';
  const focus = selectTodayFocusTasks({
    employeeId: 'e1',
    role: 'member',
    today,
    tasks: [
      { id: 't1', owner: 'e1', title: 'Việc định kỳ hôm nay', status: 'todo', due: today, tags: ['recurring'] },
      { id: 't2', owner: 'e2', title: 'Việc người khác', status: 'todo', due: today, tags: [] },
      { id: 't3', owner: 'e1', title: 'Đang làm', status: 'doing', due: '2026-11-25', tags: [] },
      { id: 't4', owner: 'e1', title: 'Xong tuần trước', status: 'done', due: '2026-11-10', updatedAt: '2026-11-10T08:00:00Z' }
    ]
  });

  assert.deepEqual(focus.map(t => t.id), ['t1', 't3']);

  const summary = buildAutoSummaryText({
    completedTasks: [{ title: 'Việc định kỳ hôm nay' }],
    inProgressTasks: [{ title: 'Đang làm' }],
    minutesLogged: 75
  });
  assert.match(summary, /Hoàn thành \(1\): Việc định kỳ hôm nay/);
  assert.match(summary, /1g 15p/);

  const valid = validateCheckinInput({
    organizationId: 'org-1',
    checkinDate: '2026-11-19',
    mood: 'amber',
    completedTaskIds: ['t1', 't1'],
    minutesLogged: 9999
  });
  assert.equal(valid.mood, 'amber');
  assert.deepEqual(valid.completed_task_ids, ['t1']);
  assert.equal(valid.minutes_logged, 1440);
});

test('createRecurringTasksService awaits async getClient(), respects role cache on ensureTodayGenerated, and syncs check-in', async () => {
  resetEnsureTodayCache();
  const rpcCalls = [];
  const updatedTasks = [];
  const loggedTimes = [];
  const upsertedCheckins = [];

  const mockSupabase = {
    async rpc(fnName, params) {
      rpcCalls.push({ fnName, params });
      return { data: { created: 2, skipped: 1 }, error: null };
    },
    from(table) {
      if (table === 'daily_checkins') {
        return {
          upsert(payload) {
            upsertedCheckins.push(payload);
            return {
              select() {
                return {
                  async single() {
                    return { data: payload, error: null };
                  }
                };
              }
            };
          }
        };
      }
      throw new Error(`Unexpected table ${table}`);
    }
  };

  const service = createRecurringTasksService({
    getClient: async () => mockSupabase,
    taskRepo: {
      async updateTask(id, updates) {
        updatedTasks.push({ id, updates });
      }
    },
    timeRepo: {
      async logTime(entry) {
        loggedTimes.push(entry);
      }
    }
  });

  const memberAttempt = await service.ensureTodayGenerated('org-1', 'member');
  assert.equal(rpcCalls.length, 0);
  assert.equal(memberAttempt.cached, true);

  const adminFirst = await service.ensureTodayGenerated('org-1', 'admin');
  const adminSecond = await service.ensureTodayGenerated('org-1', 'admin');
  assert.equal(rpcCalls.length, 1);
  assert.equal(adminFirst.created, 2);
  assert.equal(adminSecond.cached, true);

  const res = await service.submitDailyCheckin({
    organizationId: 'org-1',
    userId: 'usr-1',
    employeeId: 'e1',
    checkinDate: '2026-11-19',
    mood: 'green',
    completedTaskIds: ['t1'],
    inProgressTaskIds: ['t2'],
    perTaskMinutes: { t1: 40, t2: 0 },
    existingTaskMap: new Map([
      ['t1', { id: 't1', status: 'todo', title: 'Task 1' }],
      ['t2', { id: 't2', status: 'todo', title: 'Task 2' }]
    ]),
    summary: 'Đã xử lý xong'
  });

  assert.equal(res.updatedTasksCount, 2);
  assert.equal(res.loggedMinutes, 40);
  assert.equal(updatedTasks.length, 2);
  assert.deepEqual(updatedTasks[0], { id: 't1', updates: { status: 'done', progress: 100 } });
  assert.deepEqual(updatedTasks[1], { id: 't2', updates: { status: 'doing', progress: 25 } });
  assert.equal(loggedTimes.length, 1);
  assert.equal(loggedTimes[0].minutes, 40);
  assert.equal(upsertedCheckins.length, 1);
});

test('SQL migration and recurring feature comply with AGENTS.md security & design-token contracts', () => {
  const sql = readFileSync(
    join(ROOT, 'supabase/migrations/20261119140000_add_recurring_tasks_and_daily_checkins.sql'),
    'utf8'
  );

  for (const table of ['recurring_task_templates', 'recurring_task_runs', 'daily_checkins']) {
    assert.match(sql, new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY`, 'i'));
  }
  assert.match(sql, /SECURITY DEFINER[\s\S]*SET search_path = ''/);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.generate_recurring_tasks_for_org\(uuid, date\) FROM PUBLIC, anon/);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.generate_all_due_recurring_tasks\(\) FROM authenticated/);
  assert.match(sql, /worktree-generate-daily-recurring-tasks/);

  const featureDir = join(ROOT, 'src/features/recurring-tasks');
  const walk = dir => {
    let out = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      out = out.concat(entry.isDirectory() ? walk(full) : [full]);
    }
    return out;
  };
  for (const file of walk(featureDir)) {
    const content = readFileSync(file, 'utf8');
    assert.equal(/#[0-9a-f]{3,8}\b/i.test(content), false, `Found hardcoded hex color in ${file}`);
    assert.equal(/\balert\s*\(/i.test(content), false, `Found alert() in ${file}`);
  }

  assert.deepEqual(parseChecklistInput(' A \n\n B '), ['A', 'B']);
  assert.deepEqual(parseTagsInput('one, two, ONE'), ['one', 'two']);
});
