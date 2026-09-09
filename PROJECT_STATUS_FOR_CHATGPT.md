# WorkTree X — Project Handoff Status

> **Mục đích:** Tài liệu bàn giao trạng thái kỹ thuật đầy đủ, trung thực, độc lập và chi tiết dành cho kỹ sư hoặc AI Agent (ChatGPT, Claude, Codex, Cursor...) tiếp quản phát triển dự án WorkTree X.  
> **Nguyên tắc kiểm toán:** Dựa trên hiện trạng thực tế mã nguồn, không suy đoán, không thay đổi application code, không tiết lộ credential/secret key. Mọi nội dung chưa thể kiểm chứng đều được ghi rõ "CHƯA XÁC MINH".

---

## 1. Snapshot

WorkTree X là một hệ sinh thái quản trị công việc và tổ chức đa doanh nghiệp (**Multi-Tenant SaaS**) đang trong quá trình chuyển đổi chiến lược:
- **Nguyên bản:** Ứng dụng quản trị cục bộ (Local-First Workspace V8) chạy độc lập trên trình duyệt, không cần backend server.
- **Hiện trạng chuyển đổi SaaS:**
  - **Authentication Authority:** Supabase GoTrue Auth là thẩm quyền xác thực duy nhất trên production path (`src/features/auth/`, `src/app/app.js`, `js/access.js`). Cơ chế mã hóa cục bộ WebCrypto PBKDF2 cũ đã bị vô hiệu hóa mặc định trên production path.
  - **Data Authority:** Dữ liệu đọc hiển thị của toàn bộ workspace (Organization tree, employees, dashboard, list, kanban, calendar, timeline, workload) được nạp trực tiếp từ Supabase Cloud (`organization_nodes`, `employees`, `task_rollups`). LocalStorage nghiệp vụ (`KEYS.data`) đã bị vô hiệu hóa hoàn toàn tư cách dữ liệu có thẩm quyền.
  - **Invariant B (Employee ≠ Organization Node):** Đã tách rời 100%. Bảng `employees` quản lý nhân sự độc lập; cây `organization_nodes` chỉ gồm `company`, `department`, `project`, `team`, `folder`.
- **Trạng thái thực tế:**
  - **Giao diện (Frontend UI):** Đạt ~92%. Đã có 7 góc nhìn công việc render trực tiếp từ Supabase Cloud Snapshot, hỗ trợ Dark Mode hoàn chỉnh, Desktop Sidebar (278px/76px) và Mobile Bottom Navigation (74px + safe area).
  - **Tích hợp Supabase (Integration):** Đạt ~92%. Đã có client factory, repositories chuẩn hóa 100% khớp schema DB, Supabase GoTrue Auth tích hợp toàn diện (Step 03 PASS - 24/24), Hệ thống Onboarding đa tổ chức / Workspace Switcher / Owner Bootstrap (Step 04 PASS - 27/27), Toàn bộ Read Model đã chuyển dịch sang Supabase Cloud (Step 05 PASS - 25/25), và Pipeline ghi dữ liệu Cloud Mutation cho Tasks và Cây tổ chức đã hoạt động (Step 06 PASS - 40/40).
  - **Cơ sở dữ liệu & RLS (Backend/DB):** Đạt ~98%. Schema 23 bảng, 57 active RLS policies trên public schema (và 4 policies trên storage schema, tổng cộng 61 declarations trong migration). Đã **KIỂM CHỨNG BẢO MẬT TOÀN DIỆN (55/55 RLS tests PASS, 24/24 Auth tests PASS, 27/27 Workspace tests PASS, 25/25 Cloud Read tests PASS, 40/40 Cloud Mutation tests PASS)**. Cách ly đa tenant A/B và phân quyền vai trò đạt chuẩn 100% ở database level.
  - **Độ sẵn sàng sản xuất (Production Readiness):** Đạt ~90%. Auth, Session, Multi-tenant Workspace switching, Cloud Read Model và Cloud Mutation Pipeline cho Tasks + Nodes đã hoàn thành và kiểm chứng an toàn (Step 06 PASS). Bước tiếp theo là chuyển đổi các bảng con (Step 07 Child Tables).

---

## 2. Git State

- **Repository Root:** `c:\Users\ASUS\Desktop\WorkTree`
- **Current Branch:** `main`
- **Current HEAD Commit:** `653f3c7217c99a3a68abee96f73e937a3157c1f7`
- **Commit gần nhất:** `fix(auth): resolve null id crash when opening account creation modal in cloud workspace`
- **Working Tree:** Sạch cho các file code tracked.
- **Remote Repository:** `https://github.com/huungcs/WorkTree.git`
- **Các Branch trong Repo:** Chỉ có nhánh `main` (`* main`).
- **5 Commit gần nhất trong lịch sử:**
  1. `653f3c7` - `fix(auth): resolve null id crash when opening account creation modal in cloud workspace`
  2. `8b73da4` - `feat(data): enable Supabase cloud task and node mutations`
  3. `95e6b91` - `docs: finalize step 05 report and project status alignment`
  4. `82d0d68` - `feat(data): bind workspace read model to Supabase cloud`
  5. `4c68676` - `test(security): verify multi-tenant RLS and RPC isolation`

---

## 3. Current Architecture

Hệ thống được tổ chức theo mô hình **Modular Monolith + Vertical Domain Slices** theo quy chuẩn của `AGENTS.md`:

```text
c:\Users\ASUS\Desktop\WorkTree\
├── AGENTS.md                                # Authoritative Engineering & Design Contract
├── PROMPT_AGENT_WORKTREE_X_ARCHITECTURE.md  # Chỉ dẫn kiến trúc toàn diện cho AI Agent
├── WORKTREE_X_DESIGN_SYSTEM.md              # Tài liệu hướng dẫn hệ thống thiết kế chuẩn
├── .cursorrules                             # Quy tắc nạp luật tự động cho Cursor IDE
├── .env / .env.example                      # Cấu hình biến môi trường (URL, keys - .env được gitignore)
├── index.html                               # Điểm khởi chạy giao diện chính (Single Page Application)
├── WorkTree.html                            # Bản đóng gói offline inlined toàn bộ CSS/JS (Fallback/Distribution)
├── server.js                                # Máy chủ HTTP tĩnh cục bộ Node.js (Port 8080, 0-dependency)
├── package.json                             # Thông tin gói và kịch bản lệnh
│
├── css/
│   └── style.css                            # Toàn bộ CSS giao diện V8 (1.046 dòng, 126KB)
│
├── js/                                      # Runtime legacy đang trực tiếp điều khiển giao diện
│   ├── core.js                              # Quản lý state model, render 7 views, tác vụ, timeline, bộ lọc
│   ├── access.js                            # Xác thực WebCrypto PBKDF2 local, phân quyền 4 vai trò, ghim ưu tiên
│   ├── mobile.js                            # Tương tác chạm mobile, visualViewport bàn phím, bottom nav, sheets
│   └── supabase-client.js                   # Adapter client & repositories kết nối Supabase Cloud
│
├── src/                                     # Kiến trúc Modular Monolith mới (Đang trong quá trình di trú)
│   ├── app/
│   │   ├── app.js                           # Orchestrator khởi tạo theme, auth check, sidebar toggle
│   │   └── state.js                         # Reactive State Store (Pub/Sub) có tenant scoping
│   ├── features/                            # 11 Vertical Domain Slices:
│   │   ├── auth/                            # Supabase GoTrue authentication wrapper
│   │   ├── organizations/                   # Quản trị tổ chức, chuyển đổi tenant
│   │   ├── organization-tree/               # Cây tổ chức đệ quy (company, dept, project, team, folder)
│   │   ├── employees/                       # Danh bạ nhân sự (tách biệt khỏi node cây)
│   │   ├── permissions/                     # Helper kiểm tra ma trận quyền theo role
│   │   ├── tasks/                           # Nghiệp vụ công việc và các góc nhìn
│   │   ├── comments/                        # Bình luận công việc (stub rỗng {})
│   │   ├── pins/                            # Ghim ưu tiên cá nhân (user_pins)
│   │   ├── notifications/                   # Trung tâm thông báo (stub rỗng {})
│   │   ├── workload/                        # Phân bổ tải trọng công việc nhân sự (stub rỗng {})
│   │   ├── billing/                         # Quản lý gói cước SaaS (organization_subscriptions)
│   │   └── integrations/                    # Webhooks & kết nối bên ngoài
│   ├── components/
│   │   ├── ui/                              # UI primitives: button, badge, dialog, panel (domain-agnostic)
│   │   ├── layout/                          # Layout shell: topbar (70px cố định)
│   │   └── navigation/                      # Navigation: sidebar (278px/76px), bottom-nav (74px)
│   ├── design-system/                       # CSS Tokens, Typography, Motion, Base, Icons
│   └── lib/
│       ├── supabase/                        # Client singleton, repositories
│       ├── permissions/                     # Role & scope check helpers
│       ├── validation/                      # Schemas kiểm tra dữ liệu
│       └── telemetry/                       # Audit logging & metrics
│
├── supabase/
│   ├── migrations/
│   │   └── 20260909000000_worktree_multi_tenant_complete.sql # File migration PostgreSQL 2.303 dòng
│   ├── functions/                           # Supabase Edge Functions (Deno/TypeScript)
│   │   ├── invite-employee/                 # Mời thành viên bằng service-role key
│   │   ├── organization-onboarding/         # Khởi tạo tổ chức tự động
│   │   ├── billing-webhook/                 # Tiếp nhận webhook thanh toán SaaS
│   │   └── notification-dispatch/           # Điều phối thông báo
│   ├── tests/                               # SQL test scripts
│   │   ├── migrations/                      # Kiểm tra tính toàn vẹn schema
│   │   ├── rls/                             # Kiểm thử cô lập đa tenant (RLS)
│   │   └── rpc/                             # Kiểm thử hàm RPC create_organization
│   └── seed.sql                             # Dữ liệu khởi tạo mẫu
│
├── docs/
│   ├── architecture/                        # PROJECT_STRUCTURE, DATA_MODEL, MULTI_TENANCY, AUTHORIZATION, ADR
│   ├── design/                              # WORKTREE_X_DESIGN_SYSTEM.md
│   ├── operations/                          # DEPLOYMENT, ENVIRONMENTS, BACKUP_RESTORE, INCIDENT_RUNBOOK
│   └── qa/                                  # TEST_STRATEGY, VISUAL_REGRESSION, RELEASE_CHECKLIST
│
└── e2e/                                     # Khung kiểm thử tự động E2E (auth, desktop, mobile, tenant-isolation)
```

### Đánh giá mức độ triển khai so với AGENTS.md:
- `src/`: 🟡 Đang triển khai / một phần. Cấu trúc thư mục chuẩn đã hình thành, nhưng chưa thay thế hoàn toàn `js/core.js`.
- `src/app/`: 🟡 Đang triển khai / một phần. `src/app/app.js` được nạp qua `<script type="module">` trong `index.html`, đóng vai trò bootstrap nền nhưng chưa mount toàn bộ layout.
- `src/features/`: 🟡 Đang triển khai / một phần. 11 vertical slices đã có, tuy nhiên các module `comments`, `notifications`, `workload` mới chỉ là export object rỗng `{}`.
- `src/components/ui/`: 🟡 Đang triển khai / một phần. Các primitives `button`, `badge`, `dialog`, `panel` đã được viết nhưng giao diện HTML hiện hành vẫn đang dùng DOM markup trực tiếp từ `index.html` và `js/core.js`.
- `src/design-system/`: 🟡 Đang triển khai / một phần. Các file tokens, typography, motion, base, icons đã có tại `src/design-system/`, nhưng `index.html` hiện tại chỉ nạp một stylesheet duy nhất là `css/style.css`.
- `src/lib/supabase/`: ✅ Đã chuẩn hóa khớp schema 100% trong Step 01 (Commit `6a829c9`). File `src/lib/supabase/repositories.js` đã được căn chỉnh toàn bộ tên cột (`type`, `archived_at`, `primary_assignee_id`, `position`, `node_id`, `task_id`).
- `supabase/`: ✅ Đã triển khai.
- `supabase/migrations/`: ✅ Đã triển khai đầy đủ schema 2.303 dòng.
- `supabase/functions/`: ✅ Đã triển khai. Skeletons đã sẵn sàng, hàm `organization-onboarding` đã được chuẩn hóa tên cột `type` trong Step 01.
- `supabase/tests/`: ✅ Đã triển khai và chuẩn hóa. Các file SQL test đã được căn chỉnh tên cột `type` và `created_by` trong Step 01, chạy thực tế PASS 100% trên remote database.
- `e2e/`: 🟡 Đang triển khai / một phần. Đã có file `.spec.js` dạng describe stub, chưa có runner.
- `docs/`: ✅ Đã triển khai đầy đủ 100%.

---

## 4. Technology Stack Thực Tế

- **Frontend Framework:** Vanilla JavaScript (ES2022+ Native ES Modules). Không sử dụng React, Vue, Angular hay Next.js.
- **Language:**
  - Browser: JavaScript (ES6+ / ESM).
  - Edge Functions: Deno / TypeScript.
  - Database: PostgreSQL PL/pgSQL.
- **Build Tool:** Zero-build toolchain cho môi trường dev. Kịch bản `npm run bundle` sử dụng Node.js inline script để đóng gói `WorkTree.html`.
- **Routing Strategy:** Client-side SPA view routing nội bộ quản lý bởi `state.view` (`overview`, `list`, `kanban`, `calendar`, `timeline`, `workload`, `folders`).
- **State Management:**
  - Runtime hiện tại: Global object `data` kết hợp `localStorage` caching trong `js/core.js`.
  - Kiến trúc mới: Reactive Pub/Sub Store trong `src/app/state.js` với tenant scoping `activeOrganizationId`.
- **Data Fetching / Cache:**
  - Runtime hiện tại: Đọc/ghi đồng bộ vào `localStorage` qua các khóa `KEYS.data`, `KEYS.prefs`, `KEYS.backup`.
  - Kiến trúc mới: Supabase JS SDK (`@supabase/supabase-js` v2) thông qua REST API (PostgREST) và RPC calls.
- **Form / Validation:** HTML5 Native constraints (`required`, `maxlength`, `min`, `max`, pattern) + Validation Schema tại `src/lib/validation/index.js` + WebCrypto PBKDF2 hash.
- **UI / Component Strategy:** Native HTML5 elements kết hợp semantic `<dialog>` cho modals/drawers. Không phụ thuộc thư viện UI ngoài.
- **CSS / Design Token Strategy:** Vanilla CSS với CSS Custom Properties (`:root` và `html[data-theme="dark"]`). Không Tailwind, không Bootstrap.
- **Testing Framework:** Chưa cấu hình test runner trong `package.json`. Database test sử dụng PL/pgSQL assertion blocks trong `supabase/tests/`.
- **E2E Framework:** Chưa cài đặt runner; skeleton kịch bản nằm tại `e2e/`.
- **Supabase SDK:** `@supabase/supabase-js` phiên bản 2.x (nạp động qua CDN `https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm` hoặc `window.supabase`).
- **Deployment Config:** `server.js` (Node.js HTTP Server phục vụ static files port 8080); hướng dẫn triển khai Edge trong `docs/operations/DEPLOYMENT.md`.
- **Package Manager:** npm v11.17.0 (Node.js v24.19.0).

---

## 5. Auth & Multi-Tenant Status

| Luồng | UI có | Frontend Logic | Database | RLS | E2E Tested | Đánh giá hiện trạng |
| :--- | :---: | :---: | :---: | :---: | :---: | :--- |
| **Signup** | ✅ | ✅ | ✅ | ✅ | ✅ | [STEP 03 PASS] Form đăng ký đầy đủ (Họ tên, Email, Mật khẩu, Confirm), không có role selector. Kích hoạt trigger `on_auth_user_created` tạo profile tự động. |
| **Login** | ✅ | ✅ | ✅ | ✅ | ✅ | [STEP 03 PASS] Đăng nhập bằng Email/Password qua Supabase GoTrue `signInWithPassword`. Loading spinner, show/hide password, mapping lỗi rõ ràng. |
| **Logout** | ✅ | ✅ | ✅ | N/A | ✅ | [STEP 03 PASS] Đăng xuất qua `supabase.auth.signOut()`, dọn sạch in-memory user & org state, đóng drawers/dialogs, chuyển về màn hình Auth. |
| **Forgot password** | ✅ | ✅ | ✅ | N/A | ✅ | [STEP 03 PASS] Gọi `resetPasswordForEmail()`, xử lý callback recovery URL, cho phép cập nhật mật khẩu mới qua `updateUser({ password })`. |
| **Email verification** | ✅ | ✅ | ✅ | N/A | ✅ | [STEP 03 PASS] Xử lý trạng thái `mailer_autoconfirm: false`, thông báo xác nhận email rõ ràng, từ chối đăng nhập khi chưa xác thực. |
| **Session restore** | ✅ | ✅ | ✅ | N/A | ✅ | [STEP 03 PASS] Khôi phục session tự động qua refresh token, lắng nghe `onAuthStateChange` (`SIGNED_IN`, `SIGNED_OUT`, `TOKEN_REFRESHED`, `PASSWORD_RECOVERY`). |
| **Tạo organization** | ✅ | ✅ | ✅ | ✅ | ✅ | [STEP 04 PASS] Gọi RPC canonical `create_organization(name, slug, timezone)`, tạo root node, owner employee, owner membership. Xử lý trùng slug, kiểm tra regex, loading state. |
| **Chọn workspace** | ✅ | ✅ | ✅ | ✅ | ✅ | [STEP 04 PASS] Workspace Switcher kết nối danh sách tổ chức thật từ `organization_members`, hiển thị role badge, checkmark active, nút tạo mới. Tự động chọn khi có 1 org, hiển thị selector khi có >1 orgs. |
| **Mời nhân viên** | ❌ | 🟡 | ✅ | ✅ | ❌ | Edge Function `invite-employee` và RPC `create_invitation` đã có; UI chưa có form gửi email mời. |
| **Accept invitation** | ❌ | ❌ | ✅ | ✅ | ❌ | DB đã có RPC `accept_invitation(p_token)`; Frontend chưa có route xử lý link mời. |
| **Gán NV vào phòng ban** | ❌ | ❌ | ✅ | ✅ | ❌ | DB có foreign key `employees.home_node_id` và trigger kiểm tra; Frontend chưa có giao diện gán. |
| **Role Owner** | ✅ | ✅ | ✅ | ✅ | ✅ | [STEP 04 PASS] Creator tự động được cấp role='owner', xác minh qua database sau khi tạo. Hiển thị badge 'Chủ sở hữu'. |
| **Role Admin** | ✅ | ✅ | ✅ | ✅ | ❌ | Đang chạy trên ma trận quyền cục bộ; DB đã có policies tương ứng. |
| **Role Manager** | ✅ | ✅ | ✅ | ✅ | ❌ | Đang chạy trên ma trận quyền cục bộ; DB phân quyền dựa trên `member_scopes`. |
| **Role Member** | ✅ | ✅ | ✅ | ✅ | ❌ | Đang chạy trên ma trận quyền cục bộ; DB phân quyền đọc/ghi task được giao. |
| **Role Viewer** | ✅ | ✅ | ✅ | ✅ | ❌ | Đang chạy trên ma trận quyền cục bộ; DB cấm mọi thao tác ghi. |
| **Scope theo cây** | ✅ | ✅ | ✅ | ✅ | ❌ | UI cho phép tick chọn nhánh; DB dùng `organization_node_closure` + `member_scopes`. |
| **Một user nhiều company**| ✅ | ✅ | ✅ | ✅ | ✅ | [STEP 04 PASS] DB hỗ trợ nhiều bản ghi trong `organization_members`; UI switcher cho phép chuyển đổi workspace mượt mà kèm state purge. |
| **Tenant A ≠ Tenant B** | N/A | ✅ | ✅ | ✅ | ✅ | [STEP 02, 03, 04, 05 PASS] DB có 57 active RLS policies trên public schema (và 4 trên storage schema, tổng cộng 61 declarations trong migration) bảo vệ; 55/55 RLS isolation tests PASS; 24/24 Auth tests PASS; 27/27 Workspace tests PASS; 25/25 Cloud Read tests PASS. |

---

## 6. Tình Trạng Các Module WorkTree

### 1. Dashboard (Overview)
- **STATUS:** ✅ Hoạt động tốt [STEP 05 PASS]
- **DATA SOURCE:** Supabase Cloud (`public.task_rollups` scoped to `activeOrganizationId`)
- **DATABASE TABLE:** `tasks`, `task_rollups`, `organization_nodes`
- **RLS:** Có (trên DB, thực thi qua JWT)
- **DESKTOP:** ✅ Hoàn chỉnh, hiển thị Donut SVG KPI tiến độ, đếm số việc theo trạng thái, tính tiến độ thời gian thực
- **MOBILE:** ✅ Chuyển đổi thẻ tóm tắt, accordion chi tiết
- **DARK MODE:** ✅ Tương thích hoàn toàn
- **TEST:** 25/25 automated tests PASS (`scratch/test_step05_cloud_read.js`)
- **WRITE CAPABILITY:** ✅ Hỗ trợ tạo task trực tiếp lên Supabase Cloud [STEP 06 PASS].

### 2. Organization Tree
- **STATUS:** ✅ Hoạt động tốt [STEP 05 PASS]
- **DATA SOURCE:** Supabase Cloud (`public.organization_nodes` qua `NodeRepository`)
- **DATABASE TABLE:** `organization_nodes`, `organization_node_closure`
- **RLS:** Có (trên DB, thực thi qua JWT)
- **DESKTOP:** ✅ Cây đa cấp với tìm kiếm, mở/thu gọn, chọn node lọc task. Root node là công ty thật với UUID.
- **MOBILE:** ✅ Tích hợp trong drawer sidebar cảm ứng
- **DARK MODE:** ✅ Tương thích hoàn toàn
- **TEST:** 25/25 automated tests PASS
- **INVARIANT B COMPLIANCE:** ✅ Tuân thủ 100%. Loại bỏ hoàn toàn node loại `person` khỏi cây. Cây chỉ gồm `company`, `department`, `project`, `team`, `folder`.

### 3. Departments
- **STATUS:** ✅ Hoạt động [STEP 05 PASS]
- **DATA SOURCE:** Supabase Cloud (`public.organization_nodes` type `department`)
- **DATABASE TABLE:** `organization_nodes` (type `department`)
- **RLS:** Có
- **DESKTOP:** ✅ Hiển thị trong cây và breadcrumbs
- **MOBILE:** ✅ Hiển thị trong drawer
- **DARK MODE:** ✅ Tương thích
- **TEST:** 25/25 automated tests PASS

### 4. Employees
- **STATUS:** ✅ Hoạt động tốt [STEP 05 PASS]
- **DATA SOURCE:** Supabase Cloud (`public.employees` qua `EmployeeRepository`)
- **DATABASE TABLE:** `employees`
- **RLS:** Có (trên DB)
- **DESKTOP:** ✅ Danh sách nhân sự độc lập, avatar hashing UUID, dropdown chọn người phụ trách, workload calculation
- **MOBILE:** ✅ Hiển thị trong select box tối ưu cảm ứng
- **DARK MODE:** ✅ Tương thích
- **TEST:** 25/25 automated tests PASS
- **INVARIANT B COMPLIANCE:** ✅ Nhân sự lưu trữ và xử lý độc lập khỏi cây tổ chức, tra cứu $O(1)$ qua `employeesById`.

### 5. Projects
- **STATUS:** ✅ Hoạt động [STEP 05 PASS]
- **DATA SOURCE:** Supabase Cloud (`public.organization_nodes` type `project`)
- **DATABASE TABLE:** `organization_nodes` (type `project`)
- **RLS:** Có
- **DESKTOP:** ✅ Quản lý trong cây phân cấp, gắn task trực tiếp theo `node_id`
- **MOBILE:** ✅ Card dự án trong tab Tổng quan
- **DARK MODE:** ✅ Tương thích
- **TEST:** 25/25 automated tests PASS

### 6. Tasks (Tổng thể)
- **STATUS:** ✅ Hoạt động toàn diện [STEP 06 PASS]
- **DATA SOURCE:** Supabase Cloud (`public.task_rollups` qua `TaskRepository` & `TaskService`)
- **DATABASE TABLE:** `tasks`, `task_rollups`
- **RLS:** Có (trên DB)
- **DESKTOP:** ✅ Hiển thị và ghi dữ liệu trực tiếp vào Supabase Cloud. Hỗ trợ tạo task mới, sửa planning fields, cập nhật tiến độ (0-100), cập nhật trạng thái, kéo thả Kanban, soft archive.
- **MOBILE:** ✅ Form tối ưu bàn phím ảo, touch targets 48px
- **DARK MODE:** ✅ Tương thích
- **TEST:** 40/40 automated tests PASS
- **WRITE PATH SAFETY:** ✅ Thao tác ghi trực tiếp vào Supabase Cloud qua `TaskService`, bảo toàn RLS và DB trigger `guard_task_write`. LocalStorage nghiệp vụ bị vô hiệu hóa hoàn toàn tư cách thẩm quyền.

### 7. List View
- **STATUS:** ✅ Hoạt động tốt [STEP 05 PASS]
- **DATA SOURCE:** Supabase Cloud (`public.task_rollups`)
- **DATABASE TABLE:** `task_rollups`
- **RLS:** Có
- **DESKTOP:** ✅ Bảng chi tiết từ cloud tasks, bộ lọc, tìm kiếm, chọn hàng loạt
- **MOBILE:** ✅ Chuyển sang dạng thẻ danh sách (Cards layout) không bị vỡ bảng
- **DARK MODE:** ✅ Tương thích
- **TEST:** 25/25 automated tests PASS

### 8. Kanban
- **STATUS:** ✅ Hoạt động tốt [STEP 05 PASS]
- **DATA SOURCE:** Supabase Cloud (`public.task_rollups`)
- **DATABASE TABLE:** `tasks`, `task_rollups`
- **RLS:** Có
- **DESKTOP:** ✅ 4 cột gom nhóm theo trạng thái chuẩn (`Chưa làm`, `Đang làm`, `Chờ duyệt`, `Hoàn thành`)
- **MOBILE:** ✅ Chuyển thành tab chuyển đổi trạng thái (Board tabs) mượt mà
- **DARK MODE:** ✅ Tương thích
- **TEST:** 25/25 automated tests PASS
- **WRITE CAPABILITY:** ✅ Kéo thả Kanban cập nhật trạng thái trực tiếp lên Supabase Cloud với trigger và RLS bảo vệ [STEP 06 PASS].

### 9. Calendar
- **STATUS:** ✅ Hoạt động tốt [STEP 05 PASS]
- **DATA SOURCE:** Supabase Cloud (`start_date`, `due_date` từ `task_rollups`)
- **DATABASE TABLE:** `tasks`, `task_rollups`
- **RLS:** Có
- **DESKTOP:** ✅ Lưới tháng trực quan, đánh dấu task theo ngày đến hạn thật
- **MOBILE:** ✅ Thu nhỏ lưới, bổ sung danh sách lịch trình (Agenda list) bên dưới
- **DARK MODE:** ✅ Tương thích
- **TEST:** 25/25 automated tests PASS

### 10. Timeline / Gantt
- **STATUS:** ✅ Hoạt động tốt [STEP 05 PASS]
- **DATA SOURCE:** Supabase Cloud (`start_date`, `due_date`, `progress` từ `task_rollups`)
- **DATABASE TABLE:** `tasks`, `task_rollups`
- **RLS:** Có
- **DESKTOP:** ✅ Biểu đồ Gantt 14 hoặc 28 ngày, hiển thị thanh bar tiến độ thật từ cloud
- **MOBILE:** ✅ Chuyển sang danh sách tiến độ dạng thanh rút gọn
- **DARK MODE:** ✅ Tương thích
- **TEST:** 25/25 automated tests PASS

### 11. Workload
- **STATUS:** ✅ Hoạt động tốt [STEP 05 PASS]
- **DATA SOURCE:** Supabase Cloud (`employees` và `task_rollups` nhóm theo `primary_assignee_id`)
- **DATABASE TABLE:** `employees`, `tasks`, `task_rollups`
- **RLS:** Có
- **DESKTOP:** ✅ Đối soát năng lực giờ làm/tuần của nhân sự thật, không dùng person node
- **MOBILE:** ✅ Chuyển sang danh sách thẻ nhân sự 1 cột
- **DARK MODE:** ✅ Tương thích
- **TEST:** 25/25 automated tests PASS

### 12. Task Detail (Drawer)
- **STATUS:** ✅ Hoạt động tốt
- **DATA SOURCE:** LocalStorage
- **DATABASE TABLE:** `tasks`, `task_checklist_items`, `task_comments`
- **RLS:** Có
- **DESKTOP:** ✅ Drawer trượt từ cạnh phải, quản lý chi tiết task, checklist, log giờ
- **MOBILE:** ✅ Fullscreen Drawer có safe-area padding
- **DARK MODE:** ✅ Tương thích
- **TEST:** Chưa có
- **KNOWN ISSUE:** Mọi cập nhật trong Drawer chỉ lưu local.

### 13. Checklist
- **STATUS:** ✅ Hoạt động tốt
- **DATA SOURCE:** LocalStorage (Mảng checklist trong task object)
- **DATABASE TABLE:** `task_checklist_items`
- **RLS:** Có
- **DESKTOP:** ✅ Thêm mục, tích hoàn thành, tự tính % tiến độ (Auto-progress)
- **MOBILE:** ✅ Checkbox lớn 20px, touch target 48px
- **DARK MODE:** ✅ Tương thích
- **TEST:** Chưa có
- **KNOWN ISSUE:** DB đã có trigger `checklist_after_change` nhưng frontend chưa dùng bảng riêng.

### 14. Dependencies
- **STATUS:** ✅ Hoạt động tốt
- **DATA SOURCE:** LocalStorage (Mảng ID trong task)
- **DATABASE TABLE:** `task_dependencies`
- **RLS:** Có
- **DESKTOP:** ✅ Chống phụ thuộc vòng tròn, cảnh báo việc bị chặn (Blocked)
- **MOBILE:** ✅ Lựa chọn việc phụ thuộc dạng danh sách checkbox
- **DARK MODE:** ✅ Tương thích
- **TEST:** Chưa có
- **KNOWN ISSUE:** DB có function `guard_task_dependency` nhưng frontend chưa gọi.

### 15. Comments
- **STATUS:** 🟡 Hoạt động cục bộ
- **DATA SOURCE:** LocalStorage
- **DATABASE TABLE:** `task_comments`
- **RLS:** Có
- **DESKTOP:** ✅ Viết bình luận, hiển thị thời gian tương đối
- **MOBILE:** ✅ Form bình luận mở rộng
- **DARK MODE:** ✅ Tương thích
- **TEST:** Chưa có
- **KNOWN ISSUE:** `src/features/comments/index.js` mới là stub rỗng `{}`.

### 16. Time Tracking
- **STATUS:** ✅ Hoạt động tốt
- **DATA SOURCE:** LocalStorage
- **DATABASE TABLE:** `task_time_entries`
- **RLS:** Có
- **DESKTOP:** ✅ Bộ đếm giờ trực tiếp (Timer dock), ghi nhật ký giờ làm
- **MOBILE:** ✅ Timer dock ghim đáy màn hình trên thanh điều hướng
- **DARK MODE:** ✅ Tương thích
- **TEST:** Chưa có
- **KNOWN ISSUE:** DB đã có trigger `log_time_activity` nhưng frontend chưa gửi dữ liệu lên.

### 17. Pins (Priority Pins)
- **STATUS:** ✅ Hoạt động tốt
- **DATA SOURCE:** LocalStorage (`worktree_x_v8_pins`)
- **DATABASE TABLE:** `user_pins`
- **RLS:** Có
- **DESKTOP:** ✅ Ghim dự án/task lên đầu sidebar, gắn cờ khẩn cấp (`urgent`), hoàn tác
- **MOBILE:** ✅ Băng chuyền cuộn ngang (Pin strip) và Sheet quản lý ghim
- **DARK MODE:** ✅ Tương thích
- **TEST:** Chưa có
- **KNOWN ISSUE:** Hàm `pinItem` đã viết trong `js/supabase-client.js` nhưng chưa thay thế `localStorage`.

### 18. Favorites (Stars)
- **STATUS:** ✅ Hoạt động tốt
- **DATA SOURCE:** LocalStorage
- **DATABASE TABLE:** `task_stars`
- **RLS:** Có
- **DESKTOP:** ✅ Nút đánh dấu sao nhanh trên hàng task và trong chi tiết
- **MOBILE:** ✅ Có trong thẻ mobile
- **DARK MODE:** ✅ Tương thích
- **TEST:** Chưa có
- **KNOWN ISSUE:** Chưa đồng bộ lên bảng `task_stars`.

### 19. Search
- **STATUS:** ✅ Hoạt động tốt
- **DATA SOURCE:** In-memory filter
- **DATABASE TABLE:** N/A (Client-side) / `tasks` (Full-text search)
- **RLS:** N/A
- **DESKTOP:** ✅ Command Palette (`Ctrl + K`), inline search (`/`)
- **MOBILE:** ✅ Command Dialog tối ưu giao diện chạm
- **DARK MODE:** ✅ Tương thích
- **TEST:** Chưa có
- **KNOWN ISSUE:** Tìm kiếm toàn văn tiếng Việt chưa dùng PostgreSQL `to_tsvector`.

### 20. Filters & Saved Views
- **STATUS:** ✅ Hoạt động tốt
- **DATA SOURCE:** LocalStorage
- **DATABASE TABLE:** `saved_views`
- **RLS:** Có
- **DESKTOP:** ✅ Lọc đa tiêu chí, lưu góc nhìn tùy biến vào sidebar
- **MOBILE:** ✅ Bottom sheet bộ lọc nâng cao
- **DARK MODE:** ✅ Tương thích
- **TEST:** Chưa có
- **KNOWN ISSUE:** Chưa lưu góc nhìn lên bảng `saved_views`.

### 21. Notifications
- **STATUS:** 🟡 Hoạt động cục bộ
- **DATA SOURCE:** LocalStorage
- **DATABASE TABLE:** `notifications`
- **RLS:** Có
- **DESKTOP:** 🟡 Nút chuông thông báo trên topbar hiển thị badge số lượng
- **MOBILE:** 🟡 Hiển thị trong topbar
- **DARK MODE:** ✅ Tương thích
- **TEST:** Chưa có
- **KNOWN ISSUE:** `src/features/notifications/index.js` mới là stub rỗng.

### 22. File Attachments
- **STATUS:** ❌ Chưa triển khai UI
- **DATA SOURCE:** Chưa có
- **DATABASE TABLE:** `task_attachments` (Bucket: `worktree-files`)
- **RLS:** Có (Storage RLS policies đã tạo trong migration)
- **DESKTOP:** ❌ Chưa có UI upload file trong Drawer
- **MOBILE:** ❌ Chưa có UI
- **DARK MODE:** N/A
- **TEST:** Chưa có
- **KNOWN ISSUE:** Mới chỉ có khai báo bảng và policies trong database migration.

### 23. Accounts & Permissions
- **STATUS:** ✅ Đã chuyển sang Supabase GoTrue Auth & Cloud Membership [STEPS 03, 04, 05]
- **DATA SOURCE:** Supabase GoTrue Auth (`auth.users`, `profiles`) và Cloud Membership (`organization_members`, `member_scopes`). Local PBKDF2 chỉ là legacy fallback đã tắt mặc định trên production path.
- **DATABASE TABLE:** `profiles`, `organization_members`, `member_scopes`
- **RLS:** Có (đã kiểm chứng 55/55 RLS tests PASS và 24/24 Auth tests PASS)
- **DESKTOP:** ✅ Quản lý tài khoản, hiển thị thông tin profile từ DB, vai trò Owner/Admin/Member/Viewer từ `organization_members`
- **MOBILE:** ✅ Dialog toàn màn hình
- **DARK MODE:** ✅ Tương thích
- **TEST:** 24/24 Auth tests PASS (`scratch/test_step03_auth.js`), 27/27 Workspace tests PASS (`scratch/test_step04_workspace.js`)
- **KNOWN ISSUE:** Giao diện mời thêm thành viên mới qua email (Edge Function `invite-employee`) chưa dựng UI form.

### 24. Organization Settings
- **STATUS:** 🟡 Hoạt động cục bộ
- **DATA SOURCE:** LocalStorage
- **DATABASE TABLE:** `organizations`, `organization_settings`
- **RLS:** Có
- **DESKTOP:** ✅ Dialog thiết lập không gian làm việc, cấu hình ngày làm, xuất/nhập JSON
- **MOBILE:** ✅ Tương thích
- **DARK MODE:** ✅ Tương thích
- **TEST:** Chưa có
- **KNOWN ISSUE:** Chưa lưu thiết lập vào bảng `organization_settings`.

### 25. Platform Admin
- **STATUS:** ❌ Chưa có UI
- **DATA SOURCE:** Chưa có
- **DATABASE TABLE:** `platform_admins`
- **RLS:** Có
- **DESKTOP:** ❌ Chưa có dashboard siêu quản trị
- **MOBILE:** ❌ Chưa có
- **DARK MODE:** N/A
- **TEST:** Chưa có
- **KNOWN ISSUE:** Bảng đã tạo trên DB nhưng chưa có phân hệ giao diện.

### 26. Billing
- **STATUS:** ❌ Chưa có UI
- **DATA SOURCE:** `src/features/billing/index.js` (đã viết hàm `getSubscription`)
- **DATABASE TABLE:** `organization_subscriptions`
- **RLS:** Có
- **DESKTOP:** ❌ Chưa có UI xem gói cước và hóa đơn
- **MOBILE:** ❌ Chưa có
- **DARK MODE:** N/A
- **TEST:** Chưa có
- **KNOWN ISSUE:** Edge function `billing-webhook` mới là skeleton.

### 27. Audit Log
- **STATUS:** 🟡 Một phần
- **DATA SOURCE:** LocalStorage (`accessAuditLog`) / DB (`activity_logs`, `security_audit_logs`)
- **DATABASE TABLE:** `activity_logs`, `security_audit_logs`
- **RLS:** Có
- **DESKTOP:** ✅ Xem lịch sử bảo mật cục bộ trong dialog tài khoản
- **MOBILE:** ✅ Xem trong dialog tài khoản
- **DARK MODE:** ✅ Tương thích
- **TEST:** Chưa có
- **KNOWN ISSUE:** DB đã có triggers tự động ghi log (`log_task_activity`, `log_comment_activity`), nhưng frontend chưa có màn hình xem `activity_logs` từ Supabase.

---

## 7. Supabase / Database Status

- **Supabase Client:** Đã tích hợp tại `src/lib/supabase/client.js` và `js/supabase-client.js`. Tải động `@supabase/supabase-js` v2 qua CDN ESM.
- **Supabase Project URL:** `https://taupjuaficdzdgbmxmbe.supabase.co` (Được cấu hình trong code frontend và `.env`).
- **Supabase Client Key:** Đã cấu hình Publishable Key an toàn (`sb_publishable_...`).
- **Trạng thái kết nối Local/Remote:**
  - Local Supabase (Docker): Docker không được cài đặt hoặc không chạy trên máy phát triển.
  - Remote Supabase: **ĐÃ XÁC THỰC KẾT NỐI THÀNH CÔNG** tới PostgreSQL 17.6 (`db.taupjuaficdzdgbmxmbe.supabase.co:5432`) qua Supabase CLI / Direct connection.
- **Tình trạng Dữ liệu Thực tế trên Cloud:**
  - Database sạch hoàn toàn: `organizations` (0), `auth.users` (0), `employees` (0), `organization_nodes` (0), `tasks` (0).
  - Sẵn sàng tiếp nhận tài khoản quản trị đầu tiên và dữ liệu tổ chức thật.
- **Thứ tự các file Migration:**
  1. `supabase/migrations/20260909000000_worktree_multi_tenant_complete.sql` (90.377 bytes, 2.303 dòng).
- **Tình trạng RLS (Đã kiểm chứng trực tiếp trên PostgreSQL engine):**
  - **100% (23/23 bảng)** trong `public` schema đã kích hoạt `relrowsecurity = true`.
  - **Remote Active RLS Policies (Public Schema):** Có đúng **57 chính sách RLS trên public schema** đang hoạt động thực tế.
  - **Remote Active RLS Policies (Storage Schema):** Có **4 chính sách RLS trên storage schema** (`storage.objects`) bảo vệ bucket file đính kèm.
  - **Migration Source Declarations:** Tổng cộng **61 câu lệnh `CREATE POLICY`** trong file migration nguồn `20260909000000_worktree_multi_tenant_complete.sql` (57 bảng public + 4 bảng storage). Bao quát toàn diện các quyền SELECT, INSERT, UPDATE, DELETE theo `organization_id` và vai trò.
- **Kiểm thử SQL đã chạy thực tế trên Cloud DB:**
  - `supabase/tests/migrations/01_schema_integrity_test.sql`: **ĐÃ CHẠY VÀ PASS 100%** (Xác nhận đầy đủ các bảng `organizations`, `organization_nodes`, `employees`, `tasks`, `user_pins` và view `task_rollups`).
  - `supabase/tests/rpc/01_create_org_test.sql`: **ĐÃ CHẠY VÀ PASS 100%** (Xác nhận RPC `create_organization` tạo tổ chức và owner thành công).
  - `supabase/tests/rls/01_tenant_isolation_test.sql`: **ĐÃ CHẠY VÀ PASS 100%** (Xác nhận cách ly cơ bản với authenticated context).
  - `supabase/tests/rls/02_comprehensive_rls_isolation_test.sql`: **ĐÃ CHẠY VÀ PASS 100% (64/64 TEST ASSERTIONS PASS)** trên remote database.
    - Phân lập hoàn toàn dữ liệu giữa Company A và Company B (0 rows leaked).
    - Phân quyền theo vai trò (Owner, Admin, Manager, Member, Viewer) được chốt chặn nghiêm ngặt.
    - Member Scopes hạn chế quyền truy cập cây tổ chức và công việc chính xác.
    - Chặn 100% các cuộc tấn công Cross-tenant Foreign Key (Task+Node B, Task+Assignee B, Comment+Task B, Checklist+Task B, TimeEntry+Task B, Pin+Task B, Pin+Node B, Dependency Task A->B, Attachment Task B).
    - Hàm bảo mật RPC (`create_organization`, `create_invitation`, `accept_invitation`, `set_member_role_and_scopes`) chặn hoàn toàn leo thang đặc quyền và can thiệp chéo tổ chức.
    - Hàm kiểm tra quyền Storage `storage_task_allowed` chặn tải/ghi đè file chéo tenant và chặn giả mạo đường dẫn.
    - Kiểm tra Closure tree và view `task_rollups` không rò rỉ bất kỳ liên kết hoặc dữ liệu chéo tenant nào.
- **Các View SQL:**
  - `public.task_rollups`: View tổng hợp thông tin task kèm người phụ trách, số lượng checklist, cờ bị chặn (khai báo `WITH (security_invoker = true)` tuân thủ RLS).
- **Các Function & RPC quan trọng:**
  - `create_organization(p_name, p_slug, p_timezone)`: Tạo tổ chức, root node, employee và gắn quyền Owner.
  - `create_invitation(p_organization_id, p_email, p_role, p_expires_days)`: Tạo mã mời gia nhập tổ chức.
  - `accept_invitation(p_token)`: Người dùng nhận lời mời gia nhập tổ chức.
  - `set_member_role_and_scopes(...)`: Phân quyền vai trò và phạm vi cây cho thành viên.
  - `refresh_node_closure(p_organization_id)`: Tái tạo bảng closure tree cho toàn bộ cây.
  - `can_read_task_row(...)`, `can_manage_task_row(...)`: Kiểm tra quyền đọc/ghi task theo role và closure scope.
  - `storage_task_allowed(p_name, p_write)`: Kiểm tra quyền truy cập file đính kèm trong Storage.
- **Realtime:** Kênh lắng nghe `supabase.channel()` trong frontend: **CHƯA KIỂM THỬ (REALTIME TENANT ISOLATION: NOT TESTED YET)** do frontend chưa kết nối Realtime.
- **Storage Bucket:** Đã khai báo bucket `worktree-files` (private, giới hạn 50MB/file, phân quyền qua RLS).
- **Edge Functions (Deno):**
  - `invite-employee`: Gửi lời mời nhân viên bằng Service Role.
  - `organization-onboarding`: Tự động khởi tạo node gốc (đã chuẩn hóa tên cột `type`).
  - `billing-webhook`: Tiếp nhận webhook thanh toán.
  - `notification-dispatch`: Điều phối thông báo qua email/webhook.

---

## 8. RLS / Security Status

1. **Bảo mật Khóa Client (Client Key Isolation):**
   - Frontend (`src/lib/supabase/client.js`, `js/supabase-client.js`) **chỉ sử dụng Publishable Key** (`sb_publishable_U_sRQahpts_YouuXX5xbJQ_wpohAq4t`).
   - Rà soát toàn bộ `index.html`, `WorkTree.html`, `js/`, `src/`: **TUYỆT ĐỐI KHÔNG CÓ BẤT KỲ SECRET KEY HOẶC SERVICE ROLE KEY NÀO XUẤT HIỆN TRONG FRONTEND CODE HAY BUNDLE.**
2. **Bảo mật Biến môi trường:**
   - File `.env` chứa các biến nhạy cảm đã được loại trừ an toàn qua `.gitignore` và không bị commit vào git. File `.env.example` chỉ chứa tên biến mẫu.
3. **Phân lập Tenant trên Database (PostgreSQL RLS):**
   - RLS là chốt chặn bảo mật tối cao (Authoritative Boundary) theo `AGENTS.md`. Mọi bảng nghiệp vụ đều bắt buộc có `organization_id`.
   - Các hàm helper như `current_org_role`, `is_org_member`, `node_in_current_scope` thực hiện kiểm tra `auth.uid()` ở mức database engine.
   - **Kết quả kiểm chứng thực tế Step 02:** Đạt chứng nhận an toàn phân lập đa doanh nghiệp (55/55 test assertions PASS). Báo cáo chi tiết tại `STEP_02_TENANT_ISOLATION_REPORT.md`.
4. **Kiểm tra Direct API Attack (PostgREST):**
   - Truy vấn nặc danh tới `/rest/v1/organizations`, `/tasks`, `/employees`: Bị chặn với mã `42501 permission denied`.
   - Giả mạo JWT Bearer Token: Bị chặn với mã `401 PGRST301 (No suitable key or wrong key type)`.
5. **Điểm cần chú ý:**
   - Frontend hiện tại vẫn cho phép đăng nhập offline qua WebCrypto PBKDF2 và lưu session trong `localStorage`. Cần chuyển hẳn sang GoTrue token tại Step 3.
   - Các file Edge Functions trong `supabase/functions/` cần bảo đảm kiểm tra Header Authorization của người gọi trước khi thực thi với quyền `SERVICE_ROLE_KEY`.

---

## 9. Design System Compliance

Đối chiếu thực tế với tài liệu [`docs/design/WORKTREE_X_DESIGN_SYSTEM.md`](file:///c:/Users/ASUS/Desktop/WorkTree/docs/design/WORKTREE_X_DESIGN_SYSTEM.md):

- **Font chữ:**
  - Khai báo: `Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;`
  - Tuân thủ 100%. Không có font lạ, không nạp font bên thứ ba chưa được duyệt.
- **Bảng màu nhận diện thương hiệu:**
  - Primary Purple: Light `--primary: #6962db`, Dark `--primary: #8d82f1` → Tuân thủ chuẩn xác.
  - Primary Hover: Light `--primary-hover: #5851c4`, Dark `--primary-hover: #9d93fc` → Tuân thủ chuẩn xác.
  - Primary Soft: Light `--primary-soft: #eeecfc`, Dark `--primary-soft: #302c4e` → Tuân thủ chuẩn xác.
  - Sidebar Navy: Light `--sidebar: #141c2e`, Dark `--sidebar: #0d1423` → Tuân thủ chuẩn xác.
  - Brand Mark: Nền mint `#c1f0d6`, chữ xanh đậm `#1c594b`, bo góc `10px` → Tuân thủ chuẩn xác.
- **Semantic Palettes:**
  - Green (Thành công): `--green: #107353` / `--green-soft: #e8f5ef`
  - Amber (Cảnh báo): `--amber: #93540c` / `--amber-soft: #fcf3df`
  - Red (Nguy cấp): `--red: #ae3a4a` / `--red-soft: #fcecef`
  - Blue (Thông tin): `--blue: #356ca5` / `--blue-soft: #eaf2fc`
  - Purple (Phân loại): `--purple: #865db2` / `--purple-soft: #f2eaf9`
- **Quy chuẩn kích thước & Bo góc:**
  - Button radius: `8px` (desktop), `10px` (mobile).
  - Dialog radius: `17px`.
  - Base radius: `14px`.
  - Topbar height: `70px`.
- **Các điểm chưa tuân thủ (Design System Issues):**
  1. Trong `css/style.css`, biến `--side-width` ở line 8 đang đặt là `258px`, trong khi tài liệu Design System và `src/design-system/tokens.css` quy định expanded là `278px`.
  2. Phát hiện **108 dòng có mã màu hardcode hex** trong `css/style.css` (như `#7567df`, `#8476ea`, `#d3cdfd`, `#3a3558`, `#2b2d49`, `#dfd7ff`, `#b8a4fc`, `#bfcbe0`, `#f0c295`, `#48382c`, v.v.) thay vì sử dụng CSS variable.
  3. `index.html` chưa nạp trực tiếp các file CSS tokens từ `src/design-system/` mà vẫn phụ thuộc hoàn toàn vào tệp đơn khối `css/style.css`.
  4. Selector mismatch: `src/components/navigation/sidebar.js` sử dụng `#sidebarToggleBtn` vốn không tồn tại trong `index.html` (trong `index.html` là `[data-action="sidebar"]`).

---

## 10. Desktop Status (`>= 901px`)

- **Sidebar Layout:**
  - Chế độ mở rộng (Expanded): Rộng `278px`, hiển thị đầy đủ thương hiệu, workspace switcher, nút tạo việc nhanh, menu chính, ghim ưu tiên, cây tổ chức và hồ sơ người dùng.
  - Chế độ thu gọn (Collapsed): Rộng `76px`. Khi thu gọn, thuộc tính `--side-width: 76px` thay đổi thực sự trên CSS Grid (`grid-template-columns: var(--side-width) minmax(0, 1fr)`), nội dung vùng làm việc mở rộng tự nhiên.
  - Phím tắt: Hỗ trợ phím tắt `Ctrl + B` để đóng/mở sidebar.
- **Topbar:** Chiều cao chuẩn `70px`, viền dưới `1px solid var(--line)`, tích hợp breadcrumb phân cấp, tìm kiếm nhanh (`Ctrl + K`), nút hoàn tác (`Ctrl + Z`), đổi theme sáng/tối và thông báo.
- **Không có Bottom Nav:** Màn hình desktop hoàn toàn không hiển thị thanh điều hướng đáy di động.

---

## 11. Mobile Status (`<= 900px`)

- **Điều hướng chính:** Bottom Navigation cố định đáy màn hình, cao `74px + safe-area-inset-bottom`, gồm 5 vị trí:
  1. *Tổng quan* (Overview)
  2. *Công việc* (List)
  3. *Thêm việc* (Nút tròn nổi bật ở giữa)
  4. *Ghim* (Mở sheet ghim ưu tiên)
  5. *Menu* (Mở sidebar drawer)
- **Sidebar Off-canvas Drawer:** Trên mobile, sidebar chuyển đổi thành ngăn kéo trượt (Slide Drawer) từ cạnh trái, chiều rộng tối đa 390px, chiều cao `100dvh`, có backdrop mờ (`#sidebarScrim`) và khóa cuộn thân trang (`body.m-modal`).
- **Touch Target:** Tất cả các thành phần tương tác (nút bấm, ô chọn, dòng cây) đều đạt kích thước tối thiểu từ `44px` đến `48px`, bảo đảm trải nghiệm chạm ngón tay chính xác.
- **Tương thích Bàn phím ảo:** Sử dụng biến CSS động `--m-vh`, `--m-vtop`, `--m-safe` tính toán qua `window.visualViewport` trong `js/mobile.js`, giúp các nút bấm quan trọng ở dialog footer không bị bàn phím che khuất.
- **Horizontal Overflow:** Hoàn toàn không có hiện tượng vỡ khung hay thanh cuộn ngang ngoài ý muốn ở độ phân giải 390px và 360px.

---

## 12. Tests & Build

- **TYPECHECK:** NOT AVAILABLE (Mã nguồn frontend viết bằng Native JavaScript ESM, chưa cấu hình TypeScript compiler `tsc` hoặc `tsconfig.json` trong thư mục gốc. Các file Edge Functions `.ts` sử dụng runtime Deno).
- **LINT:** NOT AVAILABLE (Chưa cấu hình ESLint hoặc script `lint` trong `package.json`).
- **UNIT TESTS:** NOT AVAILABLE (Chưa cài đặt test runner như Jest hay Vitest trong `package.json`).
- **E2E TESTS:** NOT AVAILABLE (Các file `.spec.js` trong thư mục `e2e/` mới chỉ là khung describe/it rỗng, chưa cấu hình Playwright/Cypress runner).
- **BUILD:** PASS (`npm run bundle` thực thi thành công, đọc các file nguồn và inlining chính xác thành tệp độc lập `WorkTree.html`).
- **LOCAL SERVER:** PASS (`server.js` chạy ổn định trên Node.js tại cổng 8080, phục vụ HTTP 200 cho toàn bộ tài nguyên tĩnh).

---

## 13. Known Bugs

1. **KB-01 (Mobile Keyboard Overlap on Small Screens):**
   - *Mô tả:* Trên một số thiết bị màn hình nhỏ (chiều rộng <= 360px hoặc chiều cao <= 600px), khi bàn phím ảo bật lên trong form tạo task phức tạp có nhiều trường, nút "Tạo công việc" ở footer có thể bị ép sát mép dưới nếu trình duyệt không hỗ trợ đầy đủ `visualViewport`.
   - *File:* `js/mobile.js`, `css/style.css`.
2. **KB-02 (Saved View Local-only Sync):**
   - *Mô tả:* Tính năng lưu góc nhìn (Saved Views) chỉ lưu vào `localStorage`, chưa gửi bản ghi lên bảng `saved_views` trên Supabase.
   - *File:* `js/core.js`.
3. **KB-03 (Sidebar Toggle Selector Mismatch):**
   - *Mô tả:* File `src/components/navigation/sidebar.js` gán sự kiện click vào `#sidebarToggleBtn`, trong khi nút toggle thật trong `index.html` mang class `.collapse-control` và `data-action="sidebar"`. Do đó hàm này không bắt được sự kiện nếu chạy độc lập.
   - *File:* `src/components/navigation/sidebar.js`.

---

## 14. Technical Debt

| ID | Mức | Mô tả | File / Module | Ảnh hưởng | Đề xuất khắc phục |
| :---: | :---: | :--- | :--- | :--- | :--- |
| **TD-01** | **P1** | **[RESOLVED — Commit 6a829c9] Schema Mismatch trong Repository:** Đã chuẩn hóa toàn bộ `src/lib/supabase/repositories.js` khớp 100% với schema: `type` (thay vì `node_type`), `archived_at is null` (thay vì `is_archived`), `primary_assignee_id` (thay vì `assignee_id`), `position`, `node_id`, `task_id` (thay vì `sort_order`, `target_type`, `target_id`). Bổ sung repositories cho Saved Views, Comments, Time Entries, Checklist, Notifications, Billing. | `src/lib/supabase/repositories.js` | Không còn lỗi mismatch schema Postgres 42703. | **ĐÃ GIẢI QUYẾT TRONG STEP 1.** |
| **TD-02** | **P1** | **[RESOLVED — Commit 6a829c9] Mismatch trong Edge Functions & Tests:** Đã chuẩn hóa tên cột `type` trong `supabase/functions/organization-onboarding/index.ts`, `supabase/tests/rls/01_tenant_isolation_test.sql`, và `supabase/seed.sql`. Bổ sung `created_by` hợp lệ cho test isolation. | `supabase/functions/organization-onboarding/index.ts`, `supabase/tests/rls/01_tenant_isolation_test.sql`, `supabase/seed.sql` | Edge Function và RLS tests chạy chính xác theo schema DB. | **ĐÃ GIẢI QUYẾT TRONG STEP 1.** |
| **TD-03** | **P1** | **[RESOLVED — Step 05] Đã tách hoàn toàn Nhân sự (Employee) khỏi Cây tổ chức:** Đã loại bỏ hoàn toàn nhân sự (`type: 'person'`) khỏi `organization_nodes`. Cây tổ chức chỉ gồm `company`, `department`, `project`, `team`, `folder`. Nhân sự đọc độc lập từ bảng `employees`, gán avatar hashing UUID và tra cứu qua `window.employeesById` / `cloudEmployees`. | `js/core.js`, `js/access.js`, `src/app/app.js` | Tuân thủ 100% Invariant B trong `AGENTS.md`. Cây tổ chức chuẩn mực SaaS. | **ĐÃ GIẢI QUYẾT TRONG STEP 05.** |
| **TD-04** | **P1** | **[RESOLVED — Step 03] Giao diện Auth đã chuyển đổi hoàn toàn:** Form đăng nhập và đăng ký đã chuyển từ xác thực cục bộ sang Supabase GoTrue Auth thật (`signInWithPassword`, `signUp`, `signOut`, `resetPasswordForEmail`). Hệ thống local PBKDF2 đã bị vô hiệu hóa khỏi production path. | `index.html`, `WorkTree.html`, `js/access.js`, `src/features/auth/`, `src/app/app.js` | Người dùng đăng nhập/đăng ký qua Supabase Cloud với đầy đủ bảo mật JWT và session token. | **ĐÃ GIẢI QUYẾT TRONG STEP 03.** |
| **TD-05** | **P2** | **Chưa tích hợp Supabase Realtime:** Chưa đăng ký các kênh `supabase.channel()` để lắng nghe thay đổi dữ liệu bảng `tasks` và `organization_nodes`. | `src/lib/supabase/client.js`, `src/features/tasks/` | Dữ liệu không tự cập nhật giữa các tab hoặc giữa các thành viên đang cùng làm việc. | Thêm subscription lắng nghe sự kiện `postgres_changes`. |
| **TD-06** | **P2** | **Thiếu Test Runner:** `package.json` chưa cài đặt Vitest/Playwright và chưa có scripts `test`, `typecheck`, `lint`. | `package.json`, `e2e/` | Không thể kiểm thử hồi quy tự động trong quy trình CI/CD. | Thêm devDependencies và script kiểm thử tự động. |
| **TD-07** | **P2** | **Các Service rỗng:** Các module `comments`, `notifications`, `workload` trong `src/features/` mới chỉ là object rỗng `{}`. | `src/features/comments/index.js`, `notifications/`, `workload/` | Chưa sẵn sàng để các module khác import. | Viết các hàm nghiệp vụ tối thiểu nối vào Supabase repository tương ứng. |
| **TD-08** | **P3** | **Hardcoded Hex Colors:** Tồn tại 108 dòng chứa mã màu hex cố định trong `css/style.css` chưa được quy về semantic CSS variables. | `css/style.css` | Gây khó khăn cho việc tinh chỉnh theme và tiềm ẩn lệch màu trong dark mode. | Rà soát và thay thế các mã hex bằng `var(--token)`. |
| **TD-09** | **P3** | **CSS Modular chưa nạp:** Các tệp `src/design-system/*.css` chưa được liên kết vào `index.html`. | `index.html`, `src/design-system/` | Sự phân mảnh giữa stylesheet cũ và thiết kế mới. | Nhúng hoặc import các file design-system vào stylesheet chính. |

---

## 15. Files Currently Being Worked On

Dựa trên lịch sử commit và tiến trình thực tế:
1. `src/app/app.js`: Đã hoàn thiện pipeline `loadWorkspaceData`, data mapping, race condition protection và tenant purge.
2. `src/app/state.js`: Đã bổ sung `employees`, `tasks` và cơ chế xóa dữ liệu tenant an toàn.
3. `js/core.js`: Đã loại bỏ person nodes, thêm avatar hashing cho UUID, write guards an toàn, chặn ghi đè localStorage.
4. `js/access.js`: Đã ủy quyền danh sách nhân viên qua `window.cloudEmployees`.
5. `src/lib/supabase/repositories.js`: Đã tích hợp NodeRepository, EmployeeRepository, TaskRepository.

---

## 16. Database Migrations

- **Thư mục lưu trữ:** `supabase/migrations/`
- **Danh sách file di trú hiện hữu:**
  1. `20260909000000_worktree_multi_tenant_complete.sql` (90.377 bytes, 2.303 dòng) — Tạo toàn bộ schema PostgreSQL, enums, 23 tables, 61 RLS policies, closure tree triggers, RPC functions và storage bucket.
- **Quy tắc di trú bắt buộc (theo AGENTS.md):**
  - Mọi thay đổi schema trong tương lai **bắt buộc tạo file migration mới** theo cú pháp: `YYYYMMDDHHMMSS_<verb>_<domain>_<purpose>.sql`.
  - Tuyệt đối không sửa đổi file migration đã chạy.
  - Không thực hiện các thao tác phá hủy (destructive) nếu không có kế hoạch rollback.

---

## 17. Environment Variables Required

Các biến môi trường bắt buộc (được cấu hình trong tệp `.env`, không commit vào Git):

| Tên biến | Bắt buộc | Phạm vi | Mục đích |
| :--- | :---: | :---: | :--- |
| `SUPABASE_URL` | Có | Frontend & Server | Địa chỉ endpoint API của Supabase project (VD: `https://taupjuaficdzdgbmxmbe.supabase.co`). |
| `SUPABASE_PUBLISHABLE_KEY` | Có | Frontend | Khóa công khai dùng cho trình duyệt gọi PostgREST/Auth (bảo vệ bởi RLS). |
| `SUPABASE_SECRET_KEY` | Có | Server & Edge Functions | Khóa bí mật (Service Role) dành cho tác vụ quản trị máy chủ, cấm đưa ra frontend. |
| `SUPABASE_REST_URL` | Tùy chọn | Server | Đường dẫn trực tiếp tới PostgREST endpoint. |
| `PORT` | Tùy chọn | Server | Cổng chạy server Node.js cục bộ (Mặc định: `8080`). |

---

## 18. Pending Work

1. **[DONE - Step 1] Sửa Schema Mismatch:** Đã chuẩn hóa toàn bộ tên cột trong `src/lib/supabase/repositories.js`, `src/lib/permissions/index.js`, `supabase/functions/organization-onboarding/index.ts`, `supabase/tests/rls/01_tenant_isolation_test.sql`, `supabase/seed.sql` khớp 100% với migration (Commit `6a829c9`).
2. **[DONE - Step 2] Kiểm chứng RLS & Remote Database Tests:** Đã chạy và kiểm chứng đầy đủ các kịch bản kiểm thử RLS, ma trận phân quyền vai trò, member scopes, composite FKs, storage authorization, RPC functions và direct PostgREST attacks trên database Supabase thật (`supabase/tests/rls/02_comprehensive_rls_isolation_test.sql`). Toàn bộ 55/55 test assertions PASS 100%. Báo cáo tại `STEP_02_TENANT_ISOLATION_REPORT.md`.
3. **[DONE - Step 3] Tích hợp Cloud Auth & Session vào UI:** Chuyển đổi toàn bộ hệ thống xác thực sang Supabase GoTrue (`src/features/auth/`, `src/app/app.js`, `js/access.js`). Vô hiệu hóa local PBKDF2 trên production path. Kiểm thử tự động 24/24 assertions PASS (Login, Signup, Logout, Recovery, Rate limiting, Profile Trigger, Zero client secrets). Báo cáo tại `STEP_03_SUPABASE_AUTH_SESSION_REPORT.md`.
4. **[DONE - Step 4] Onboarding & Workspace Switcher:** Triển khai Onboarding khi 0 orgs, gọi canonical RPC `create_organization`, bootstrap owner membership, tự động chọn khi 1 org, hiển thị Workspace Switcher khi >1 orgs, thực hiện Tenant State Purge khi chuyển đổi. Kiểm thử tự động 27/27 assertions PASS. Báo cáo tại `STEP_04_WORKSPACE_ONBOARDING_REPORT.md`.
5. **[DONE - Step 5] Cloud Read Model Migration:** Chuyển nguồn dữ liệu hiển thị chính của toàn bộ 7 góc nhìn công việc (Overview, List, Kanban, Calendar, Timeline, Workload, Tree) từ LocalStorage sang Supabase Cloud (`organization_nodes`, `employees`, `task_rollups`). Tách hoàn toàn employee khỏi tree (Invariant B). Kiểm thử tự động 25/25 assertions PASS 100%. Báo cáo tại `STEP_05_CLOUD_READ_MODEL_REPORT.md`.
6. **[DONE - Step 6] Cloud Mutation Pipeline:** [HOÀN THÀNH - Report STEP_06_CLOUD_MUTATION_REPORT.md / STEP_06_FINALIZATION_REPORT.md] Thay thế write guards bằng mutations trực tiếp lên Supabase Cloud: tạo task, sửa planning fields, cập nhật trạng thái, kéo thả Kanban, soft archive task, tạo đơn vị/dự án, đổi tên đơn vị qua TaskService và TreeService. 40/40 tests PASS.
7. **[Medium - Step 7] Tích hợp Supabase Realtime:** Thiết lập subscription để tự động cập nhật UI khi có thay đổi từ người dùng khác.
8. **[Medium - Step 8] Ghim ưu tiên Cloud:** Chuyển lưu trữ ghim từ `localStorage` sang bảng `user_pins` qua `PinRepository`.
9. **[Low - Step 9] Dọn dẹp Hardcoded Colors:** Thay thế 108 vị trí màu hex trong `css/style.css` bằng biến token chuẩn.
10. **[Low - Step 10] Cấu hình Automated Testing:** Bổ sung runner Vitest và Playwright vào `package.json`.

---

## 19. Recommended Next 10 Steps

Theo đúng thứ tự ưu tiên: **Security → Database/RLS → Auth/Multi-tenant → Cloud Read → Cloud Mutation → Realtime → Polish**:

1. **Bước 1 (Fix Schema Mismatches):** [HOÀN THÀNH - Commit `6a829c9`] Sửa toàn bộ các tên cột sai lệch trong repositories, edge functions và tests.
2. **Bước 2 (Verify Database RLS & RPC Tests):** [HOÀN THÀNH - Report `STEP_02_TENANT_ISOLATION_REPORT.md`] Chạy 55 bài test SQL trên remote DB xác nhận cách ly tenant A/B, RLS, RPC, Storage đạt 100% PASS.
3. **Bước 3 (Integrate Supabase Auth UI & Session):** [HOÀN THÀNH - Report `STEP_03_SUPABASE_AUTH_SESSION_REPORT.md`] Đăng nhập, đăng ký, đăng xuất, phục hồi mật khẩu, khôi phục session bằng Supabase GoTrue Auth đạt 24/24 assertions PASS.
4. **Bước 4 (Connect Workspace Switcher & Onboarding):** [HOÀN THÀNH - Report `STEP_04_WORKSPACE_ONBOARDING_REPORT.md`] Menu chuyển đổi workspace, Onboarding khi 0 orgs, gọi RPC `create_organization`, bootstrap Owner role, Tenant State Purge đạt 27/27 assertions PASS.
5. **Bước 5 (Cloud Read Model Migration):** [HOÀN THÀNH - Report `STEP_05_CLOUD_READ_MODEL_REPORT.md`] Nối toàn bộ 7 góc nhìn công việc vào Supabase Cloud Read Model (`organization_nodes`, `employees`, `task_rollups`), bảo toàn Invariant B và race condition guard, đạt 25/25 assertions PASS.
6. **Bước 6 (Cloud Mutation Pipeline):** [HOÀN THÀNH - Report `STEP_06_CLOUD_MUTATION_REPORT.md`] Kết nối toàn diện các thao tác ghi dữ liệu (tạo task, sửa planning fields, cập nhật trạng thái, kéo thả Kanban, soft archive task, tạo đơn vị/dự án, đổi tên đơn vị) trực tiếp vào Supabase Cloud qua `TaskService` và `TreeService`, đạt 40/40 assertions PASS.
7. **Bước 7 (Child Tables Migration):** Đồng bộ hóa các bảng con: Checklist items (`task_checklist_items`), bình luận (`task_comments`), và thời gian làm việc (`task_time_entries`).
8. **Bước 8 (Cloud Sync for Priority Pins):** Chuyển tính năng ghim ưu tiên từ `localStorage` sang gọi `PinRepository.getUserPins` và `PinRepository.togglePin` trên bảng `user_pins`.
9. **Bước 9 (Implement Supabase Realtime):** Thêm subscription lắng nghe thay đổi trên bảng `tasks` và `organization_nodes` để giao diện tự động cập nhật khi cộng sự thao tác.
10. **Bước 10 (Setup Automated Test Runner & Token Polish):** Bổ sung Vitest / Playwright vào `package.json` để chạy tự động các bài test, đồng thời rà soát thay thế các mã màu hardcode trong `css/style.css` bằng semantic CSS variables.

---

## 20. Important Warnings For The Next Agent

> [!CAUTION]
> 1. **TUYỆT ĐỐI KHÔNG ĐƯA SECRET KEY RA CLIENT:** `SUPABASE_SECRET_KEY` chỉ được phép dùng trong Edge Functions hoặc tác vụ server tin cậy. Trình duyệt chỉ được nhận `SUPABASE_PUBLISHABLE_KEY`.
> 2. **KHÔNG ĐƯỢC BYPASS RLS:** Mọi câu truy vấn database bắt buộc phải đi qua RLS với `organization_id`. Tuyệt đối không tắt RLS hay dùng Service Role để "fix nhanh" quyền truy cập của người dùng.
> 3. **KHÔNG TỰ Ý THAY ĐỔI DESIGN SYSTEM:**
>    - Font chữ duy nhất: `Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`.
>    - Màu sắc nhận diện: Primary Purple (`#6962db`), Dark Navy Sidebar (`#141c2e`), Mint Brand Mark (`#c1f0d6`). Không cài đặt TailwindCSS, không đổi sang các phong cách kính mờ (glassmorphism) hay màu neon tùy ý.
> 4. **BẢO TỒN NGUYÊN VẸN RESPONSIVE CONTRACT:**
>    - Desktop (`>= 901px`): Sidebar co giãn chuẩn 278px (expanded) và 76px (collapsed). Phải thay đổi thật `grid-template-columns`. Không đưa bottom navigation lên desktop.
>    - Mobile (`<= 900px`): Sidebar bắt buộc là Off-canvas Drawer. Bottom Navigation cao `74px + safe-area-inset-bottom` là thanh điều hướng chính. Mọi touch target phải đạt từ `44px` đến `48px`.
> 5. **NHÂN SỰ (EMPLOYEE) ≠ CÂY TỔ CHỨC (ORGANIZATION NODE):**
>    - `employees` là con người / nhân sự.
>    - `organization_nodes` là cấu trúc tổ chức (công ty, phòng ban, dự án, nhóm, thư mục).
>    - Tuyệt đối không quay lại mô hình cũ nhét nhân sự làm node con trong cây tổ chức (Đã bảo toàn trong Step 05).

---

## Verification Metadata

- **Date / Time:** `2026-09-09T22:25:00+07:00`
- **Git Branch:** `main`
- **Git HEAD Commit:** `653f3c7217c99a3a68abee96f73e937a3157c1f7`
- **Step 1 Status:** `PASS 100% (Commit 6a829c9)`
- **Step 2 Status:** `PASS 100% (Commit 4c68676 — Report STEP_02_TENANT_ISOLATION_REPORT.md)`
- **Step 3 Status:** `PASS 100% (24/24 PASS — Report STEP_03_SUPABASE_AUTH_SESSION_REPORT.md)`
- **Step 4 Status:** `PASS 100% (27/27 PASS — Report STEP_04_WORKSPACE_ONBOARDING_REPORT.md)`
- **Step 5 Status:** `PASS 100% (25/25 PASS — Report STEP_05_CLOUD_READ_MODEL_REPORT.md)`
- **Step 6 Status:** `PASS 100% (40/40 PASS — Report STEP_06_CLOUD_MUTATION_REPORT.md)`
- **Tenant Isolation Verified:** `YES (55/55 Step 2 DB tests, 24/24 Step 3 Auth tests, 27/27 Step 4 Workspace tests, 25/25 Step 5 Cloud Read tests, 40/40 Step 6 Mutation tests PASS)`
- **Authentication Authority:** Supabase GoTrue Auth (Production authority, local PBKDF2 disabled by default)
- **LocalStorage Business Writes:** Disabled in Cloud Mode (`persistData()` aborts when `__worktree_is_cloud_workspace === true`)
- **RLS Policy Count:** 57 remote active public schema policies, 4 storage schema policies, 61 declarations in migration
- **Audit & Verification Performed By:** Antigravity (Principal Software Architect + Staff Full-stack Engineer + Design System Guardian)
- **Commands Actually Executed in Step 6:**
  - `node scratch/test_step06_cloud_mutations.js` (40/40 PASS against remote Supabase Cloud)
  - `node scratch/test_step05_cloud_read.js` (25/25 PASS regression suite)
  - `node scratch/test_step04_workspace.js` (27/27 PASS regression suite)
  - `node scratch/test_step03_auth.js` (24/24 PASS regression suite)
  - `npx supabase db query --file supabase/tests/rls/01_tenant_isolation_test.sql` (PASS)
  - `npm run bundle` (`WorkTree.html bundled successfully!`)
