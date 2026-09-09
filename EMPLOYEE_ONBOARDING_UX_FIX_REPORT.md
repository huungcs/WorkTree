# WorkTree X — Employee Onboarding UX Fix

## 1. Baseline
- **Repository:** `WorkTree X`
- **Current Branch:** `main`
- **Baseline Git HEAD:** `c15a8860adc9b7c228fef914ae63a6a5627c7f30`
- **Operating Context:** Steps 01–07 PASS. Multi-tenant Supabase Cloud authority, tasks and child tables cloud synchronized.
- **Trigger:** Hotfix to resolve reverse employee-to-account onboarding UX where creating a user account forced selecting an existing employee from a dropdown before creating the person.

## 2. Problem Reproduced
- In freshly bootstrapped workspaces, only the Owner Employee exists in `public.employees`.
- When an owner navigated to access management to add new staff, the legacy UI opened "Tạo tài khoản nhân viên" which mandated selecting an existing employee ("Liên kết nhân sự").
- The dropdown only offered the Owner Employee itself, creating high risk of accidental association of new login credentials with the Owner Employee record.
- If no employee was chosen, the legacy validator threw: `"Nhân viên cần liên kết một nhân sự để xác định công việc được giao."`, blocking onboarding.
- Furthermore, the legacy modal displayed local temporary password inputs and PBKDF2 credential generation, which violated Supabase Auth cloud production authority.

## 3. Legacy Flow
1. User clicks `+ Tạo tài khoản`.
2. Form mandates choosing an existing `employee_id` from a `<select>` dropdown.
3. Form demands a local temporary password with "Yêu cầu đổi mật khẩu ở lần đăng nhập tiếp theo".
4. Submitting created or updated local state / credentials, conflating employee identity with auth accounts.

## 4. New Domain Flow
1. **Primary Action:** `+ Thêm nhân viên` (`data-v8="employee-new"`).
2. **Step 1: Create Employee first:**
   - Full Name (`full_name`) *
   - Work Email (`email`)
   - Employee Code (`employee_code`)
   - Job Title (`job_title`)
   - Department / Home Node (`home_node_id`) *
   - Employment Status: Active (`employment_status = 'active'`)
3. **Step 2: Optional Invitation:**
   - Checkbox: `[ ] Mời nhân viên sử dụng WorkTree`
   - **When unchecked (Default):** Inserts `public.employees` row only. Employee appears in directory as `Tài khoản: Chưa mời`. No account or login required.
   - **When checked:** Expands login email (prefilled with employee email), role selector (Member, Manager, Admin — strictly no Owner), and scope selector. Automatically binds the newly created Employee UUID to the invitation and eventual membership.
4. **Secondary Action:** Uninvited employees in directory offer a direct `"Mời sử dụng WorkTree"` button with the employee preselected and locked.
5. **Linked Status:** Linked employees display `"Tài khoản: Đã liên kết"` with active role and account info.

## 5. Employee vs Account Model
- **Invariant B Preserved:** `EMPLOYEE != ORGANIZATION NODE`.
  - `public.employees`: Business personnel records (name, email, code, title, home_node_id, status).
  - `public.organization_nodes`: Organizational structure (company, department, team, project, folder). Never contains type `person`.
  - `auth.users` / `public.profiles`: Cryptographic identity and public profile.
  - `public.organization_members`: Tenant membership linking `user_id` to `organization_id`, `employee_id`, and `role`.
  - `public.member_scopes`: Explicit node-level authorization scopes.
- An employee can legitimately exist without an account (Case 1), or with an associated login account (Case 2).

## 6. Schema Audit
- `public.employees`: Has `id`, `organization_id`, `full_name`, `email`, `employee_code`, `job_title`, `home_node_id`, `employment_status`, `created_by`.
- `public.invitations`: Contains `employee_id uuid references public.employees(id)`!
- `create_invitation` RPC in legacy migration only accepted 6 arguments without `employee_id`.
- `accept_invitation` RPC in legacy migration had an unsearchable `digest(...)` call due to `set search_path = ''`.
- **Forward-only migration required:** `supabase/migrations/20260910000000_link_employee_invitation.sql` was created to upgrade `create_invitation` (7 arguments with `p_employee_id`) and fix `accept_invitation` to use `extensions.digest(...)`.

## 7. Employee Creation
- Canonical method `EmployeeRepository.createEmployee` / `EmployeeService.createEmployee`:
  - Captures active tenant `organization_id`.
  - Enforces actor authorization (`public.is_org_admin`).
  - Executes `INSERT INTO public.employees` returning authoritative database UUID.
  - Immediately refetches employee and updates client reactive state.

## 8. Optional WorkTree Invitation
- If `[ ] Mời nhân viên sử dụng WorkTree` is checked:
  - Invokes `InvitationRepository.createInvitation` passing the newly created `p_employee_id`.
  - Verifies email deliverability format.
  - Generates secure cryptographic token in DB via `extensions.gen_random_bytes(32)`.
  - Stored in `public.invitations` with `employee_id` securely bound.

## 9. Existing Employee Invitation
- Employees created without accounts have a dedicated `"Mời sử dụng WorkTree"` action on their card (`data-v8="employee-invite"`).
- Opens invite dialog with employee fixed and read-only.
- Admin does not manually search or link employees in a dropdown.
- Submitting dispatches `create_invitation` with the target `employee_id`.

## 10. Employee ↔ Membership Linking
- When user accepts invitation via `accept_invitation(token)`:
  - Token hash matched in `public.invitations`.
  - Inserts/upserts `public.organization_members` with `employee_id = v_inv.employee_id`.
  - Grants defined role and scopes in `public.member_scopes`.
  - Marks invitation `accepted`.
  - Zero duplicate employee rows created.

## 11. Role & Scope Handling
- **Role Choices in UI:**
  - `member` -> "Nhân viên"
  - `manager` -> "Quản lý"
  - `admin` -> "Quản trị viên"
  - `viewer` -> "Chỉ xem"
- **Owner Role:** Strictly omitted from UI `<select>` options. Protected at DB RPC level (`if p_role = 'owner' then raise exception ... end if;`).
- **Scope vs Placement:** Form explicitly separates "Vị trí trong tổ chức" (`home_node_id`) from "Phạm vi được cấp" (`scope_node_ids`).

## 12. Owner Bootstrap Protection
- Owner employee UUID is protected during onboarding.
- Creating a new employee generates an independent UUID (`new_emp.id != owner_emp.id`).
- When sending invitation, `p_employee_id` references the new employee, never the owner.
- Owner membership record in `organization_members` remains unchanged with its original `employee_id`.

## 13. Error / Partial Success Handling
- **Error Atomicity:** If employee creation succeeds but invitation email dispatch fails, the Employee is NOT deleted.
- UI informs the user: `"Đã tạo nhân viên thành công nhưng chưa gửi được lời mời qua email."`
- The uninvited employee card remains in the directory with status `"Tài khoản: Chưa mời"` and a `"Mời sử dụng WorkTree"` button to retry without data loss.

## 14. Tenant Security
- RLS policy `employees_insert_admin` (`with check (public.is_org_admin(organization_id))`) blocks Member and Viewer roles from creating employees.
- Cross-tenant employee linking is blocked: `create_invitation` verifies `p_employee_id` belongs strictly to `p_organization_id`.
- Spoofing arbitrary `user_id` is impossible: `accept_invitation` derives identity solely from `auth.uid()`.
- Zero service-role keys exposed to the client bundle.

## 15. UI Changes
- `js/access.js`:
  - Primary button in Access tab changed from `+ Tạo tài khoản` to `+ Thêm nhân viên` (`data-v8="employee-new"`).
  - Legacy `openAccount()` redirected to `openAddEmployeeDialog()`.
  - Dialog structured into semantic sections: "Thông tin nhân sự", "Vị trí trong tổ chức", "Quyền truy cập WorkTree".
  - Status badges: `Tài khoản: Đã liên kết`, `Tài khoản: Đang chờ chấp nhận`, `Tài khoản: Chưa mời`.
  - Completely removed local temporary passwords, PBKDF2 derivation, and local credential storage in Cloud Mode.
- `src/features/employees/services/employee-service.js`:
  - Implemented `createEmployee` and `inviteExistingEmployee` with atomic error recovery.
- `src/lib/supabase/repositories.js`:
  - Added `EmployeeRepository` (`createEmployee`, `getEmployeesWithAccountStatus`, `updateEmployee`) and `InvitationRepository` (`createInvitation`).
- `src/app/app.js`:
  - Exported `window.EmployeeService`, `window.EmployeeRepository`, `window.InvitationRepository`.

## 16. Desktop QA
- Tested at 1280x800 and 1536x864 viewports.
- Sidebar expanded (278px) and collapsed (76px) functional.
- Dark mode and light mode visual contrast verified against tokens.
- Add Employee dialog opens with correct fields, home node selector populated, invite toggle expands/collapses cleanly.

## 17. Mobile QA
- Tested at 390x844 and 360x800 viewports.
- `#accountDialog` adheres to `100dvh` and mobile safe areas.
- Touch targets satisfy `>= 44px`.
- Keyboard-safe scrolling with sticky action footer. No horizontal overflow.

## 18. Automated Tests
- Test file: `scratch/test_employee_onboarding_flow.js`
- **Result: 30 / 30 ASSERTIONS PASS (100%)**
  - 01 Workspace owner employee exists only once: PASS
  - 02 New employee can be created without account: PASS
  - 03 New employee UUID != owner UUID: PASS
  - 04 Employee persists after reload: PASS
  - 05 No "link employee required" validation on new flow: PASS
  - 06 Invite OFF creates no membership/invitation: PASS
  - 07 Invite ON creates invitation: PASS
  - 08 No local password created: PASS
  - 09 No PBKDF2 account created: PASS
  - 10 Invitation references correct employee: PASS
  - 11 Accept invite links original Employee: PASS
  - 12 No duplicate Employee on accept: PASS
  - 13 Existing Employee invite uses same employee: PASS
  - 14 Already-linked Employee cannot duplicate invite: PASS
  - 15 Owner role cannot be selected from invite form: PASS
  - 16 Member role maps correctly: PASS
  - 17 Manager role maps correctly: PASS
  - 18 Viewer role maps correctly: PASS
  - 19 Cross-tenant employee link denied: PASS
  - 20 Cross-tenant invitation denied: PASS
  - 21 Member create employee denied: PASS
  - 22 Viewer create employee denied: PASS
  - 23 Arbitrary user_id spoof denied: PASS
  - 24 service-role secret absent client: PASS
  - 25 owner membership unchanged: PASS
  - 26 employee != organization node: PASS
  - 27 no type=person node: PASS
  - 28 cloud mode does not persist local account password: PASS
  - 29 mobile form semantics present: PASS
  - 30 build PASS: PASS

## 19. Regression Tests
- `node scratch/test_step03_auth.js`: **24 / 24 PASS (100%)**
- `node scratch/test_step04_workspace.js`: **27 / 27 PASS (100%)**
- `node scratch/test_step05_cloud_read.js`: **25 / 25 PASS (100%)**
- `node scratch/test_step06_cloud_mutations.js`: **40 / 40 PASS (100%)**
- `node scratch/test_step07_child_tables.js`: **46 / 46 PASS (100%)**
- `npm run bundle`: **PASS** (`WorkTree.html` generated cleanly).

## 20. Database Changes
- **Migration:** `supabase/migrations/20260910000000_link_employee_invitation.sql` (Forward-only, remote applied).
- **RPC `create_invitation`:** Upgraded to 7-argument signature `(uuid, text, text, uuid, org_role, uuid[], uuid)` accepting `p_employee_id`. Uses `extensions.digest` and `extensions.gen_random_bytes`.
- **RPC `accept_invitation`:** Qualified `extensions.digest(p_token, 'sha256')` under strict empty `search_path`.

## 21. Security Findings
- Zero secret keys or service role keys exposed in client files.
- Role privilege escalation blocked: Owners cannot be invited; members and viewers cannot create employees or invitations.
- Multi-tenant boundary verified: Cross-tenant employee linking and cross-tenant invitations are rejected with PostgreSQL exceptions.

## 22. Files Modified
- `supabase/migrations/20260910000000_link_employee_invitation.sql` (NEW)
- `src/lib/supabase/repositories.js` (MODIFIED)
- `src/features/employees/services/employee-service.js` (MODIFIED)
- `src/app/app.js` (MODIFIED)
- `js/access.js` (MODIFIED)
- `WorkTree.html` (RE-BUNDLED)
- `scratch/test_employee_onboarding_flow.js` (NEW)
- `scratch/test_step03_auth.js` (MODIFIED - test harness domain normalization)

## 23. Known Limitations
- Background email delivery relies on configured Supabase SMTP provider; when SMTP is unconfigured, invitation token is stored in `public.invitations` and available for administrative link copying/resending.

## 24. Exit Criteria

EMPLOYEE ONBOARDING FIX:
PASS

NEW EMPLOYEE WITHOUT ACCOUNT:
PASS

OPTIONAL INVITATION:
PASS

EMPLOYEE ACCOUNT LINK:
PASS

OWNER ACCIDENTAL LINK:
BLOCKED

LEGACY LINK-EMPLOYEE REQUIREMENT REMOVED:
YES

CROSS-TENANT SECURITY:
PASS

LOCAL PASSWORD CREATION IN CLOUD:
DISABLED

READY TO RESUME STEP 08:
YES
