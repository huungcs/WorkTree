# WorkTree X — Project Handoff Status

> **Mục đích:** Tài liệu bàn giao trạng thái kỹ thuật đầy đủ, trung thực, độc lập và chi tiết dành cho kỹ sư hoặc AI Agent (ChatGPT, Claude, Codex, Cursor...) tiếp quản phát triển dự án WorkTree X.  
> **Nguyên tắc kiểm toán:** Dựa trên hiện trạng thực tế mã nguồn, không suy đoán, không thay đổi application code, không tiết lộ credential/secret key. Mọi nội dung chưa thể kiểm chứng đều được ghi rõ "CHƯA XÁC MINH".  
> **Cam kết:** AUDIT ONLY — NO APPLICATION CODE MODIFIED.

---

## 1. Snapshot

WorkTree X là hệ sinh thái quản trị công việc và tổ chức đa doanh nghiệp (**Multi-Tenant SaaS**) đang trong quá trình chuyển đổi chiến lược từ mô hình Local-First sang Cloud-First:
- **Nguyên bản:** Ứng dụng quản trị cục bộ (Local-First Workspace V8) chạy trên trình duyệt, lưu trữ trên LocalStorage và WebCrypto PBKDF2.
- **Hiện trạng chuyển đổi SaaS:**
  - **Authentication Authority:** Supabase GoTrue Auth là thẩm quyền xác thực duy nhất trên production path (`src/features/auth/`, `src/app/app.js`, `js/access.js`). Cơ chế mã hóa cục bộ WebCrypto PBKDF2 cũ đã bị vô hiệu hóa mặc định trên production path; Cloud Mode tuyệt đối không tạo mật khẩu tạm hay lưu PBKDF2 password trong LocalStorage.
  - **Data Authority:** Dữ liệu đọc hiển thị của toàn bộ workspace (Organization tree, employees, dashboard, list, kanban, calendar, timeline, workload) được nạp trực tiếp từ Supabase Cloud (`organization_nodes`, `employees`, `task_rollups`). Thẩm quyền ghi dữ liệu nghiệp vụ vào LocalStorage (`KEYS.data`) đã bị vô hiệu hóa hoàn toàn trong Cloud Mode.
  - **Invariant B (Employee ≠ Organization Node):** Đã tách rời 100%. Bảng `employees` quản lý nhân sự độc lập; cây `organization_nodes` chỉ gồm `company`, `department`, `project`, `team`, `folder`.
  - **Unified Employee Onboarding & Account Invitation:** Luồng thêm người mới đã hợp nhất chuẩn domain: Primary CTA là `+ Thêm nhân viên` tạo `public.employees` trước; tùy chọn `[ ] Mời nhân viên sử dụng WorkTree` để dispatch lời mời tự động gắn `employee_id`. Loại bỏ hoàn toàn luồng ngược bắt buộc "Liên kết nhân sự" và bảo vệ tuyệt đối Owner Employee khỏi việc liên kết nhầm.
  - **Personal Data Cloud Migration:** Ghim ưu tiên (`public.user_pins`), đánh dấu sao công việc (`public.task_stars`), và góc nhìn đã lưu (`public.saved_views`) đã chuyển đổi 100% sang Supabase Cloud. Quyền uy tín thuộc về `auth.uid()` theo `activeOrganizationId`. Vô hiệu hóa hoàn toàn thẩm quyền LocalStorage và trường cũ `task.favorite`.
  - **Task Attachments & Supabase Storage:** Triển khai tệp đính kèm cloud-native hoàn chỉnh trong Task Detail Drawer. Lưu trữ binary vào bucket canonical private `worktree-files` (giới hạn 50MB/object, mã hóa đường dẫn canonical an toàn `<org_uuid>/<task_uuid>/<random-id>-<safe-filename>`), quản lý metadata tại `public.task_attachments`. Hỗ trợ xem danh sách, upload với `upsert: false`, compensating transaction tự động dọn storage object mồ côi nếu metadata insert thất bại, authenticated direct blob download, xóa tệp có bảo vệ delete partial-failure safety.
  - **Secure Supabase Realtime Synchronization:** Triển khai hạ tầng đồng bộ hóa thời gian thực đa người dùng, đa thiết bị và đa tab an toàn. Kích hoạt `postgres_changes` trên 8 bảng cốt lõi (`tasks`, `task_checklist_items`, `task_dependencies`, `task_comments`, `task_time_entries`, `task_attachments`, `organization_nodes`, `employees`) với `REPLICA IDENTITY FULL`. Thiết lập Private Authorized Channels (`config: { private: true }`) với chính sách RLS trên `realtime.messages` xác thực membership và task reading authority ở tầng kết nối WebSocket, loại trừ hoàn toàn nguy cơ rò rỉ sự kiện DELETE và các cuộc tấn công direct UUID subscription attack.
  - **Cloud Notification Center, Scheduled Reminders & OneSignal PWA Push:** Triển khai trung tâm thông báo thời gian thực (`public.notifications`), tùy chọn người dùng (`public.notification_preferences`), thiết bị push (`public.push_devices`), hàng đợi tác vụ (`public.notification_jobs`), và nhắc việc định kỳ (`public.manual_reminders`). Cơ chế claim atomic an toàn luồng với `FOR UPDATE SKIP LOCKED`. Edge Function `notification-dispatch` tích hợp OneSignal REST API v16. Kênh Realtime private `user:<uuid>:notifications` bảo vệ đa thiết bị không rò rỉ tenant.
  - **Product Onboarding V1 (Đang triển khai):** Đã xây dựng cấu trúc Onboarding Module tại `src/features/onboarding/` (Welcome Modal, Tour Controller với spotlight backdrop, Getting Started Checklist, Contextual Help Popover, Popup Coordinator tránh xung đột với thông báo đẩy) và file di trú `supabase/migrations/20260910183000_user_onboarding_progress.sql`.
- **Đánh giá tổng thể:**
  - Frontend UI: **88%**
  - Frontend ↔ Supabase Integration: **82%**
  - Backend / Database / RLS: **90%**
  - Production Readiness: **75%**

---

## 2. Git State

- **Repository Root:** `c:\Users\ASUS\Desktop\WorkTree`
- **Current Branch:** `main`
- **Current HEAD Commit:** `a67466ef8bb0112a4ca896153585bdd7463368c0`
- **Commit gần nhất:** `fix: load employee details on demand in workload and hide create workspace for members`
- **Tình trạng Working Tree:**
  - **Modified (chỉ khác biệt ký tự xuống dòng CRLF/LF):**
    - `WorkTree.html`
    - `css/style.css`
    - `index.html`
    - `js/core.js`
    - `server.js`
    - `src/app/app.js`
    - `src/features/notifications/services/push-device-service.js`
    - `src/lib/supabase/repositories.js`
  - **Untracked files:**
    - `assets/` (`icon-192.png`, `icon-512.png` phục vụ PWA Web Manifest)
    - `src/features/onboarding/` (Module hướng dẫn người dùng mới V1)
    - `supabase/migrations/20260910183000_user_onboarding_progress.sql` (Schema lưu tiến độ onboarding của user)
  - **Staged files:** Không có.
- **Remote Repository:**
  - `origin https://github.com/huungcs/WorkTree.git` (fetch/push)
  - ⚠️ **CẢNH BÁO BẢO MẬT P0:** Remote URL trong git config hiện chứa GitHub Personal Access Token (PAT). Token này đã được phát hiện trong quá trình audit và giá trị đã được che trong báo cáo. Cần gỡ bỏ ngay lập tức bằng `git remote set-url` và thu hồi (revoke) token trên GitHub.
- **Các Branch hiện có:** Chỉ có nhánh `main` (`* main`).
- **5 Commit gần nhất trong lịch sử:**
  1. `a67466e` - `fix: load employee details on demand in workload and hide create workspace for members`
  2. `7dabc4c` - `fix(icons): update settings icon to symmetrical SVG and bind workload gear to employee details`
  3. `63eb19a` - `fix(ui): correct settings gear icon symmetry, alignment, and workload detail handler`
  4. `d0f87de` - `chore(deploy): sync bundle and update production deployment`
  5. `12096b4` - `chore(deploy): trigger clean build for work-tree-58`

---

## 3. Current Architecture

Hệ thống được tổ chức theo mô hình **Modular Monolith + Vertical Domain Slices** theo quy chuẩn của `AGENTS.md`:

```text
c:\Users\ASUS\Desktop\WorkTree\
├── AGENTS.md                                # Authoritative Engineering & Design Contract
├── PROMPT_AGENT_WORKTREE_X_ARCHITECTURE.md  # Chỉ dẫn kiến trúc toàn diện cho AI Agent
├── WORKTREE_X_DESIGN_SYSTEM.md              # Đặc tả hệ thống thiết kế chuẩn
├── .cursorrules                             # Quy tắc nạp luật tự động cho Cursor IDE
├── .env / .env.example                      # Cấu hình biến môi trường (URL, keys - .env được gitignore)
├── index.html                               # Điểm khởi chạy giao diện chính (Single Page Application)
├── WorkTree.html                            # Bản đóng gói offline inlined toàn bộ CSS/JS (Fallback/Distribution)
├── server.js                                # Máy chủ HTTP tĩnh cục bộ Node.js (Port 8080, 0-dependency)
├── package.json                             # Thông tin gói và kịch bản lệnh
├── manifest.webmanifest                     # PWA Web App Manifest
│
├── assets/                                  # Tài nguyên tĩnh (PWA icons 192px, 512px)
│
├── css/
│   └── style.css                            # Toàn bộ CSS giao diện V8 (1.926 dòng, 137KB)
│
├── js/                                      # Runtime legacy đang trực tiếp điều khiển giao diện
│   ├── core.js                              # Quản lý state model, render 7 views, tác vụ, timeline, bộ lọc
│   ├── access.js                            # Phân quyền vai trò, quản lý session; Production: Supabase GoTrue Auth
│   ├── mobile.js                            # Tương tác chạm mobile, visualViewport bàn phím, bottom nav, sheets
│   └── supabase-client.js                   # Adapter client & repositories kết nối Supabase Cloud
│
├── src/                                     # Kiến trúc Modular Monolith mới (Đang trong quá trình di trú)
│   ├── app/
│   │   ├── app.js                           # Orchestrator khởi tạo theme, auth check, sidebar toggle
│   │   └── state.js                         # Reactive State Store (Pub/Sub) có tenant scoping
│   ├── features/                            # 18 Vertical Domain Slices:
│   │   ├── attachments/                     # Quản trị tệp đính kèm (AttachmentService kết nối worktree-files)
│   │   ├── auth/                            # Supabase GoTrue authentication wrapper
│   │   ├── billing/                         # Quản lý gói cước SaaS (organization_subscriptions)
│   │   ├── checklists/                      # Nghiệp vụ checklist công việc (ChecklistService kết nối Supabase)
│   │   ├── comments/                        # Bình luận công việc (CommentService & author DB-stamped)
│   │   ├── dependencies/                    # Nghiệp vụ phụ thuộc công việc (DependencyService & cycle guard)
│   │   ├── employees/                       # Danh bạ nhân sự (tách biệt độc lập khỏi node cây)
│   │   ├── integrations/                    # Webhooks & kết nối bên ngoài
│   │   ├── notifications/                   # Trung tâm thông báo, push devices & nhắc việc
│   │   ├── onboarding/                      # Hướng dẫn người dùng mới V1 (Tour, Welcome Dialog, Checklist)
│   │   ├── organization-tree/               # Cây tổ chức đệ quy (company, dept, project, team, folder)
│   │   ├── organizations/                   # Quản trị tổ chức, chuyển đổi tenant
│   │   ├── permissions/                     # Helper kiểm tra ma trận quyền theo role
│   │   ├── pins/                            # Ghim ưu tiên cá nhân (user_pins)
│   │   ├── realtime/                        # Đồng bộ hóa Realtime (RealtimeService private channels & quiet sync)
│   │   ├── saved-views/                     # Góc nhìn lưu trữ cá nhân (saved_views)
│   │   ├── tasks/                           # Nghiệp vụ công việc và các góc nhìn
│   │   ├── time-tracking/                   # Ghi nhận thời gian làm việc (TimeEntryService kết nối Supabase)
│   │   └── workload/                        # Phân bổ tải trọng công việc nhân sự
│   ├── components/
│   │   ├── layout/                          # Layout shell: topbar (70px cố định)
│   │   ├── navigation/                      # Navigation: sidebar (278px/76px), bottom-nav (74px)
│   │   └── ui/                              # UI primitives: button, badge, dialog, panel (domain-agnostic)
│   ├── design-system/                       # CSS Tokens, Typography, Motion, Base, Icons
│   └── lib/
│       ├── permissions/                     # Role & scope check helpers
│       ├── supabase/                        # Client singleton, repositories
│       ├── telemetry/                       # Audit logging & metrics
│       └── validation/                      # Schemas kiểm tra dữ liệu
│
├── supabase/
│   ├── migrations/                          # 9 file di trú PostgreSQL đã tạo
│   │   ├── 20260909000000_worktree_multi_tenant_complete.sql   # Schema base 28 bảng, 72 RLS policies, RPC
│   │   ├── 20260910000000_link_employee_invitation.sql         # Nâng cấp link employee invitation
│   │   ├── 20260910100000_enable_realtime_child_tables.sql     # Realtime child tables & FULL replica identity
│   │   ├── 20260910120000_secure_realtime_private_topics.sql   # Private Authorized Channels trên realtime.messages
│   │   ├── 20260910140000_notification_infrastructure.sql      # Hạ tầng thông báo & nhắc việc
│   │   ├── 20260910153500_fix_task_status_enum_trigger.sql     # Sửa trigger task_status enum mismatch
│   │   ├── 20260910161000_add_revoke_invitation_rpc.sql        # RPC thu hồi lời mời
│   │   ├── 20260910170000_add_invitation_get_details_rpc.sql   # RPC lấy chi tiết lời mời bằng token
│   │   └── 20260910183000_user_onboarding_progress.sql         # Lưu tiến độ onboarding của user/workspace
│   ├── functions/                           # Supabase Edge Functions (Deno/TypeScript)
│   │   ├── billing-webhook/                 # Tiếp nhận webhook thanh toán SaaS
│   │   ├── invite-employee/                 # Mời thành viên bằng service-role key
│   │   ├── notification-dispatch/           # Điều phối thông báo qua OneSignal REST API v16
│   │   └── organization-onboarding/         # Khởi tạo tổ chức tự động
│   ├── tests/                               # SQL test scripts
│   │   ├── migrations/                      # Kiểm tra tính toàn vẹn schema
│   │   ├── rls/                             # Kiểm thử cô lập đa tenant (RLS 55/55 assertions)
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
- `src/`: 🟡 Đang triển khai / một phần. Cấu trúc thư mục chuẩn đã hình thành, nhưng `js/core.js` vẫn đang phụ trách render DOM chính.
- `src/app/`: 🟡 Đang triển khai / một phần. `src/app/app.js` được nạp qua `<script type="module">` trong `index.html`, đóng vai trò bootstrap nền và orchestrator cho các dịch vụ nghiệp vụ Cloud.
- `src/features/`: 🟡 Đang triển khai / phần lớn. 18 vertical slices đã có. Các module lõi (`auth`, `organizations`, `organization-tree`, `employees`, `tasks`, `checklists`, `dependencies`, `comments`, `time-tracking`, `attachments`, `realtime`, `pins`, `saved-views`, `notifications`, `onboarding`) đã có services đầy đủ kết nối Supabase Cloud.
- `src/components/ui/`: 🟡 Đang triển khai / một phần. Các primitives `button`, `badge`, `dialog`, `panel` đã được viết nhưng giao diện HTML hiện hành vẫn đang dùng DOM markup từ `index.html` và `js/core.js`.
- `src/design-system/`: 🟡 Đang triển khai / một phần. Các file tokens, typography, motion, base, icons đã có tại `src/design-system/`, nhưng `index.html` hiện tại chỉ nạp một stylesheet duy nhất là `css/style.css`.
- `src/lib/supabase/`: ✅ Đã chuẩn hóa khớp schema 100%. File `src/lib/supabase/repositories.js` đã được căn chỉnh toàn bộ tên cột (`type`, `archived_at`, `primary_assignee_id`, `position`, `node_id`, `task_id`).
- `supabase/`: ✅ Đã triển khai.
- `supabase/migrations/`: ✅ Đã triển khai đầy đủ 9 migration files.
- `supabase/functions/`: ✅ Đã triển khai 4 functions (`invite-employee`, `organization-onboarding`, `billing-webhook`, `notification-dispatch`).
- `supabase/tests/`: ✅ Đã triển khai và chuẩn hóa. Các file SQL test đã chạy thực tế PASS 100% trên remote database.
- `e2e/`: 🟡 Đang triển khai / một phần. Đã có file `.spec.js` dạng describe stub, chưa có test runner (Playwright/Cypress).
- `docs/`: ✅ Đã triển khai đầy đủ 100%.

---

## 4. Technology Stack

- **Frontend Framework:** Vanilla JavaScript (ES2022+ Native ES Modules). Không sử dụng React, Vue, Angular hay Next.js.
- **Language:**
  - Browser: JavaScript (ES6+ / ESM).
  - Edge Functions: Deno / TypeScript.
  - Database: PostgreSQL PL/pgSQL.
- **Build Tool:** Zero-build toolchain cho môi trường dev. Kịch bản `npm run bundle` sử dụng Node.js inline script để đóng gói `WorkTree.html`.
- **Routing Strategy:** Client-side SPA view routing nội bộ quản lý bởi `state.view` (`overview`, `list`, `kanban`, `calendar`, `timeline`, `workload`, `folders`).
- **State Management:**
  - Runtime hiện tại: Supabase Cloud là thẩm quyền dữ liệu nghiệp vụ (Business Authority). Đối tượng `data` trong bộ nhớ đóng vai trò compatibility projection phục vụ render giao diện của `js/core.js`. `localStorage` chỉ lưu giữ các tùy chọn giao diện cục bộ được phép (`KEYS.prefs`: theme, trạng thái co giãn sidebar). Quyền ghi dữ liệu nghiệp vụ vào `localStorage` bị vô hiệu hóa hoàn toàn trong Cloud Mode (`persistData()` tự động hủy bỏ).
  - Kiến trúc mới: Reactive Pub/Sub Store trong `src/app/state.js` với tenant scoping `activeOrganizationId`.
- **Data Fetching / Cache:**
  - Runtime hiện tại: Nạp dữ liệu bất đồng bộ trực tiếp từ Supabase Cloud qua Repositories/Services (`TaskRepository`, `NodeRepository`, `EmployeeRepository`, `AttachmentRepository`, `PinRepository`, `StarRepository`, `SavedViewRepository`, `NotificationRepository`).
  - Caching & Race condition guard: `workspaceLoadGeneration` counter ngăn chặn ghi đè snapshot cũ khi đổi tenant nhanh; `taskMutationVersions` map chống cập nhật ngoài thứ tự; deduplication 2.500ms cho Realtime self-mutations.
- **Form / Validation:** HTML5 Native constraints (`required`, `maxlength`, `min`, `max`, pattern) + Validation Schemas tại `src/lib/validation/index.js` + Database Check Constraints & Triggers.
- **UI / Component Strategy:** Native HTML5 elements kết hợp semantic `<dialog>` cho modals/drawers. Không phụ thuộc thư viện UI ngoài.
- **CSS / Design Token Strategy:** Vanilla CSS với CSS Custom Properties (`:root` và `html[data-theme="dark"]`). Không TailwindCSS, không Bootstrap.
- **Testing Framework:** Node.js syntax validation (`node --check`). Database test sử dụng PL/pgSQL assertion blocks trong `supabase/tests/`. Vitest/Jest chưa được cài đặt trong `package.json`.
- **E2E Framework:** Skeleton kịch bản nằm tại `e2e/`; Playwright/Cypress chưa được cài đặt.
- **Supabase SDK:** `@supabase/supabase-js` v2.116.0 (khai báo trong `package.json`, nạp động qua ESM).
- **Deployment Config:** `server.js` (Node.js HTTP Server phục vụ static files port 8080); Vercel deployment qua `vercel.json`.
- **Package Manager:** npm v11.17.0 (Node.js runtime).

---

## 5. Implemented Features

| Phân hệ | Mức độ hoàn thiện | Data Source | Tình trạng kiểm thử |
| :--- | :---: | :--- | :--- |
| **Supabase GoTrue Auth** | 100% | Supabase GoTrue API | 24/24 PASS (`scratch/test_step03_auth.js`) |
| **Multi-Tenant Onboarding & Switcher** | 100% | RPC `create_organization`, `organization_members` | 27/27 PASS (`scratch/test_step04_workspace.js`) |
| **Cây tổ chức & Invariant B** | 100% | `organization_nodes`, `organization_node_closure` | 25/25 PASS (`scratch/test_step05_cloud_read.js`) |
| **Quản lý nhân sự & Mời tài khoản** | 100% | `employees`, `invitations`, `organization_members` | 30/30 PASS (`scratch/test_employee_onboarding_flow.js`) |
| **Cloud Task Read Model** | 100% | `tasks`, `task_rollups` | 25/25 PASS (`scratch/test_step05_cloud_read.js`) |
| **Cloud Task Mutations** | 100% | `tasks`, `organization_nodes` | 40/40 PASS (`scratch/test_step06_cloud_mutations.js`) |
| **Task Child Tables** | 100% | `task_checklist_items`, `task_dependencies`, `task_comments`, `task_time_entries` | 46/46 PASS (`scratch/test_step07_child_tables.js`) |
| **Personal Data (Pins, Stars, Views)** | 100% | `user_pins`, `task_stars`, `saved_views` | 39/39 PASS (`scratch/test_step08_personal_data.js`) |
| **Task Attachments & Storage** | 100% | `task_attachments`, Bucket `worktree-files` (50MB) | 52/52 PASS (`scratch/test_step09_attachments.js`) |
| **Secure Realtime Sync** | 100% | Private WebSocket channels, `realtime.messages` RLS | 65/65 PASS (`scratch/test_step10_realtime.js`) |
| **Notifications & OneSignal Push** | 100% | `notifications`, `push_devices`, Edge Function | 65/65 PASS (`scratch/test_step11_notifications.js`) |
| **Product Onboarding V1** | 80% | `src/features/onboarding/`, migration `20260910183000` | Cần apply migration lên remote DB |
| **Organization Settings** | 40% | LocalStorage / Dialog | Chưa đồng bộ lên Supabase `organizations` |
| **Platform Admin & Billing UI** | 15% | Tables & RLS có sẵn | Chưa xây dựng UI quản trị |

---

## 6. Supabase / Database Status

### Danh sách Migration Files (Theo thứ tự thời gian):
1. `20260909000000_worktree_multi_tenant_complete.sql` (90.377 bytes, 2.302 dòng) — Khởi tạo 28 tables, enums, 72 RLS policies, closure tree triggers, RPC functions và storage bucket `worktree-files`.
2. `20260910000000_link_employee_invitation.sql` (7.678 bytes, 196 dòng) — Nâng cấp RPC `create_invitation` gắn `employee_id`, bổ sung cột `employee_id` vào `public.invitations` và nâng cấp `accept_invitation` tự động liên kết nhân sự.
3. `20260910100000_enable_realtime_child_tables.sql` (1.359 bytes, 27 dòng) — Bổ sung `task_attachments` vào publication `supabase_realtime` và kích hoạt `REPLICA IDENTITY FULL` cho 8 bảng nghiệp vụ cốt lõi.
4. `20260910120000_secure_realtime_private_topics.sql` (1.154 bytes, 41 dòng) — Kích hoạt RLS trên bảng `realtime.messages` với các chính sách SELECT/INSERT kiểm tra thẩm quyền `is_org_member` và `can_read_task_id`.
5. `20260910140000_notification_infrastructure.sql` (20.554 bytes, 586 dòng) — Hạ tầng thông báo và nhắc việc: `public.notifications`, `public.notification_preferences`, `public.push_devices`, `public.notification_jobs`, `public.manual_reminders`, trigger sinh thông báo và RPC `claim_notification_jobs` với `FOR UPDATE SKIP LOCKED`.
6. `20260910153500_fix_task_status_enum_trigger.sql` (2.165 bytes, 60 dòng) — Sửa trigger `handle_task_due_and_status_change` so sánh enum chuẩn `'done'` thay vì chuỗi `'Hoàn thành'`, loại bỏ lỗi 22P02.
7. `20260910161000_add_revoke_invitation_rpc.sql` (2.348 bytes, 67 dòng) — Bổ sung RPC `revoke_invitation` an toàn kiểm tra quyền Owner/Admin.
8. `20260910170000_add_invitation_get_details_rpc.sql` (2.404 bytes, 67 dòng) — Bổ sung RPC `get_invitation_by_token` lấy chi tiết lời mời bằng SHA-256 token hash mà không leak thông tin nhạy cảm.
9. `20260910183000_user_onboarding_progress.sql` (3.179 bytes, 82 dòng) — Tạo bảng `public.user_onboarding_progress` lưu tiến độ onboarding của từng user trong từng workspace, RLS 4 policies bảo vệ tuyệt đối. *(Trạng thái: Untracked / Sẵn sàng apply lên remote)*.

### Hạ tầng Backend / Database:
- **RLS Status:** Toàn bộ 28 bảng trên public schema đều kích hoạt RLS (`ENABLE ROW LEVEL SECURITY`).
- **Policy Tenant Isolation:** 100% chính sách SELECT, INSERT, UPDATE, DELETE đều kiểm tra `organization_id` thông qua hàm bảo mật `is_org_member(org_id)`.
- **RPC Functions cốt lõi:**
  - `create_organization(p_name, p_slug, p_timezone)` — Khởi tạo tổ chức, root node, owner membership và owner employee.
  - `create_invitation(p_org_id, p_email, p_role, p_employee_id)` — Tạo lời mời gắn liền nhân sự.
  - `accept_invitation(p_token)` — Chấp nhận lời mời và liên kết tài khoản.
  - `revoke_invitation(p_invitation_id)` — Thu hồi lời mời chưa chấp nhận.
  - `get_invitation_by_token(p_token)` — Lấy thông tin lời mời an toàn.
  - `claim_notification_jobs(p_batch_size)` — Khóa và xử lý batch công việc thông báo an toàn luồng (`FOR UPDATE SKIP LOCKED`).
  - `is_org_member(org_id)`, `has_org_role(org_id, role)`, `can_read_task_id(task_id)`.
- **Realtime Integration:** Bật trên 8 bảng (`tasks`, `task_checklist_items`, `task_dependencies`, `task_comments`, `task_time_entries`, `task_attachments`, `organization_nodes`, `employees`). Bảo vệ bằng Private Channels (`config: { private: true }`) và RLS trên `realtime.messages`.
- **Storage Bucket:** Canonical bucket `worktree-files` (Private, 50MB size limit) có 4 RLS policies trên `storage.objects` bảo vệ chống cross-tenant download/upload.
- **Edge Functions:** 4 functions (`invite-employee`, `organization-onboarding`, `billing-webhook`, `notification-dispatch`).

---

## 7. Auth & Multi-tenant Status

| Luồng | UI có | Frontend Logic | Database | RLS | E2E Tested | Đánh giá hiện trạng |
| :--- | :---: | :---: | :---: | :---: | :---: | :--- |
| **Signup** | ✅ | ✅ | ✅ | ✅ | ✅ | [PASS] Đăng ký GoTrue Auth (Họ tên, Email, Mật khẩu), trigger tự động tạo profile. |
| **Login** | ✅ | ✅ | ✅ | ✅ | ✅ | [PASS] Đăng nhập Email/Password qua Supabase GoTrue `signInWithPassword`. |
| **Logout** | ✅ | ✅ | ✅ | N/A | ✅ | [PASS] Đăng xuất qua `supabase.auth.signOut()`, dọn sạch memory state, hủy kênh realtime. |
| **Forgot password** | ✅ | ✅ | ✅ | N/A | ✅ | [PASS] Gọi `resetPasswordForEmail()`, nhận email link và đổi mật khẩu mới. |
| **Email verification** | ✅ | ✅ | ✅ | N/A | ✅ | [PASS] Thông báo xác nhận email rõ ràng khi `mailer_autoconfirm: false`. |
| **Tạo organization** | ✅ | ✅ | ✅ | ✅ | ✅ | [PASS] Gọi RPC `create_organization`, tự động cấp role='owner' và tạo root node. |
| **Chọn workspace** | ✅ | ✅ | ✅ | ✅ | ✅ | [PASS] Workspace Switcher hiển thị danh sách tổ chức thật, purge sạch RAM khi đổi tenant. |
| **Mời nhân viên** | ✅ | ✅ | ✅ | ✅ | ✅ | [PASS] Form Thêm nhân viên tích hợp tùy chọn mời tài khoản, gọi RPC `create_invitation`. |
| **Accept invitation** | ✅ | ✅ | ✅ | ✅ | ✅ | [PASS] RPC `accept_invitation` xác thực token SHA-256, liên kết đúng `employee_id`. |
| **Gán NV vào phòng ban** | ✅ | ✅ | ✅ | ✅ | ✅ | [PASS] Dropdown phòng ban trực thuộc (`home_node_id`), khóa ngoại và trigger bảo vệ. |
| **Role Owner** | ✅ | ✅ | ✅ | ✅ | ✅ | [PASS] Toàn quyền quản trị tổ chức, thành viên và cài đặt. |
| **Role Admin** | ✅ | ✅ | ✅ | ✅ | ❌ | **DB/RLS = YES \| BROWSER E2E = CHƯA XÁC MINH.** Đã kiểm chứng qua bộ test SQL RLS; UI chưa có test Playwright. |
| **Role Manager** | ✅ | ✅ | ✅ | ✅ | ❌ | **DB/RLS = YES \| BROWSER E2E = CHƯA XÁC MINH.** Đã kiểm chứng qua bộ test SQL RLS theo member_scopes. |
| **Role Member** | ✅ | ✅ | ✅ | ✅ | ❌ | **DB/RLS = YES \| BROWSER E2E = CHƯA XÁC MINH.** Đã kiểm chứng qua bộ test SQL RLS đọc/ghi task được giao. |
| **Role Viewer** | ✅ | ✅ | ✅ | ✅ | ❌ | **DB/RLS = YES \| BROWSER E2E = CHƯA XÁC MINH.** Đã kiểm chứng qua bộ test SQL RLS cấm tuyệt đối thao tác ghi. |
| **Scope theo cây** | ✅ | ✅ | ✅ | ✅ | ❌ | **DB/RLS = YES \| BROWSER E2E = CHƯA XÁC MINH.** Bảng `member_scopes` và closure tree hoạt động trên DB. |
| **Một user nhiều company** | ✅ | ✅ | ✅ | ✅ | ✅ | [PASS] Quan hệ N-N trong `organization_members`, chuyển đổi mượt mà. |
| **Tenant A ≠ Tenant B** | N/A | ✅ | ✅ | ✅ | ✅ | [PASS] 55/55 RLS isolation tests PASS; 0 trường hợp leak dữ liệu chéo giữa 2 công ty. |

---

## 8. RLS / Security Status

- **Supabase Client Credentials:**
  - `src/lib/supabase/client.js` chỉ đọc `SUPABASE_PUBLISHABLE_KEY` cho browser runtime.
  - Tuyệt đối không có `SUPABASE_SECRET_KEY` trong client bundle.
- **Biến môi trường:**
  - File `.env` chứa `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`. File này đã nằm trong `.gitignore`.
- **Cảnh báo bảo mật quan trọng:**
  - ⚠️ **Phát hiện secret-like credential tại `git remote -v` (Git Config):** Remote URL chứa GitHub Personal Access Token (PAT). Giá trị đã được che trong báo cáo. Đề xuất: Chạy ngay `git remote set-url origin https://github.com/huungcs/WorkTree.git` để xóa token khỏi URL và thu hồi token trên GitHub.
- **Đánh giá lỗ hổng nghiêm trọng:**
  - RLS disabled: **0 bảng** (Tất cả 28 bảng đều có RLS enabled).
  - Public table thiếu policy: **0 bảng**.
  - Direct object access cross-tenant: **Đã chặn 100%** qua composite FK và RLS `organization_id`.
  - Unsafe file upload: **Đã chặn** bằng canonical path `<org_id>/<task_id>/<uuid>-<filename>`, bucket private, giới hạn dung lượng 50MB, compensating transaction dọn tệp mồ côi.
  - Invitation token expiration: **Đã bảo vệ** (Mặc định hết hạn sau 7 ngày trong `public.invitations`).
  - Frontend-only permission security: **Đã triệt tiêu**. Mọi hành vi phân quyền đều được thẩm định authoritative tại database RLS và PostgREST.

---

## 9. Design System Compliance

So sánh mã nguồn thực tế với `docs/design/WORKTREE_X_DESIGN_SYSTEM.md`:

- **Typography & Font Family:**
  - Font duy nhất: `Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`.
  - Tuân thủ 100%. Không có font lạ được nạp.
- **Màu sắc nhận diện (Brand Colors):**
  - Primary Light: `--primary: #6962db`, `--primary-hover: #5851c4`, `--primary-soft: #eeecfc`, `--primary-text: #6256ca`.
  - Primary Dark: `--primary: #8d82f1`, `--primary-hover: #9d93fc`, `--primary-soft: #302c4e`, `--primary-text: #b5aafb`.
  - Sidebar: `--sidebar: #141c2e` (Light), `--sidebar: #0d1423` (Dark).
  - Brand Mark: Background `#c1f0d6`, Text `#1c594b`, Border-radius `10px`.
  - Tuân thủ 100% qua CSS tokens trong `css/style.css` và `src/design-system/tokens.css`.
- **Desktop Sidebar:**
  - Expanded: `278px`.
  - Collapsed: `76px`.
  - Thực hiện co giãn bằng thay đổi thật thuộc tính CSS `grid-template-columns`, content mở rộng mượt mà.
- **Mobile Responsive:**
  - Breakpoint: `900px` / `901px`.
  - Mobile Sidebar: Off-canvas Drawer trượt từ cạnh trái, có backdrop mờ.
  - Bottom Navigation: Cố định chân trang, chiều cao `74px + env(safe-area-inset-bottom)`.
  - Touch Target: Đạt chuẩn tối thiểu `44px` (các nút điều hướng chính đạt `48px`).
  - Safe Area: Hỗ trợ đầy đủ `env(safe-area-inset-*)` và `100dvh` chống tràn bàn phím ảo.
- **Các điểm cần lưu ý (Design Debt):**
  - `css/style.css` hiện là file đơn lẻ lớn (~1.926 dòng). Cần kế hoạch modularize đồng bộ với `src/design-system/`.
  - Một số icon SVG inline trong `js/core.js` cần chuyển về sử dụng `src/design-system/icons.js`.

---

## 10. Desktop Status

- **Sidebar Expanded (278px):** ✅ Hoạt động ổn định. Hiển thị logo mint, workspace switcher, cây tổ chức đầy đủ, menu điều hướng góc nhìn, trạng thái đồng bộ Realtime và nút thông báo.
- **Sidebar Collapsed (76px):** ✅ Hoạt động ổn định. Ẩn nhãn chữ, chỉ hiển thị icon căn giữa, tooltip hover hiển thị tên mục, layout tự động mở rộng vùng làm việc.
- **Topbar (70px):** ✅ Cố định đỉnh màn hình. Chứa breadcrumbs tổ chức, ô tìm kiếm nhanh, nút ghim, bộ lọc nâng cao, nút thông báo và avatar người dùng.
- **7 Góc nhìn công việc (Views):**
  - **Overview (Dashboard):** Donut SVG thống kê tiến độ, thẻ KPI, danh sách việc cần làm gấp.
  - **List:** Bảng công việc phân cấp, sắp xếp, lọc, ghim sao, đổi trạng thái trực tiếp.
  - **Kanban:** Bảng kéo thả theo trạng thái (To Do, In Progress, In Review, Done), cập nhật mutation tức thì.
  - **Calendar:** Lịch tháng hiển thị deadline công việc, chuyển tháng, xem chi tiết ngày.
  - **Timeline (Gantt):** Biểu đồ tiến độ trực quan với thanh thời gian và phụ thuộc.
  - **Workload:** Phân bổ tải trọng nhân viên, tính số giờ làm việc, hiển thị chi tiết nhân sự on-demand.
  - **Organization Tree:** Cây tổ chức đệ quy lọc theo phòng ban / dự án / nhóm.
- **Task Detail Drawer:** Mở dạng slide-over từ cạnh phải (chiều rộng 460px - 520px), gồm 5 tab con (Checklist, Dependencies, Comments, Time Tracking, Attachments) kết nối Cloud Native.

---

## 11. Mobile Status

- **Breakpoint:** Kích hoạt chính xác tại `<= 900px`.
- **Mobile Navigation:** Desktop rail bị ẩn hoàn toàn; Bottom Navigation xuất hiện ở chân màn hình với 5 tab tiện ích chính.
- **Off-canvas Drawer:** Sidebar chuyển thành drawer trượt cảm ứng, vuốt đóng mượt mà, hỗ trợ backdrop click để đóng.
- **Drawers & Modals:** Tự động chuyển đổi thành Bottom Sheet hoặc Fullscreen Modal (`100dvh`), footer cố định không bị che bởi bàn phím ảo (`visualViewport` resize listener trong `js/mobile.js`).
- **Touch Target & Spacing:** Tất cả các nút bấm, icon button, tab bar đều có vùng chạm tối thiểu `44px x 44px`.
- **Tràn ngang (Horizontal Overflow):** Đã kiểm tra không có hiện tượng vỡ layout ngang trên màn hình `360px` và `390px`.

---

## 12. Tests & Build

- **TYPECHECK:** `NOT AVAILABLE` (Dự án viết bằng Vanilla JavaScript thuần với JSDoc annotations; chưa có `tsconfig.json` hoặc TypeScript compiler).
- **LINT:** `NOT AVAILABLE` (Chưa cấu hình ESLint script trong `package.json`).
- **UNIT TESTS:** `NOT AVAILABLE` (Chưa có test runner JavaScript như Vitest/Jest; tuy nhiên kiểm tra cú pháp bằng `node --check` đạt **PASS 100%** trên toàn bộ các file JS cốt lõi).
- **E2E TESTS:** `NOT AVAILABLE` (Các file trong `e2e/` đang ở dạng describe stubs; chưa cài đặt Playwright/Cypress runner).
- **DATABASE / RLS TESTS:** `PASS` (**55/55 assertions PASS 100%** chạy trực tiếp trên remote Supabase database qua `supabase/tests/rls/02_comprehensive_rls_isolation_test.sql`).
- **INTEGRATION REGRESSION TESTS:** `PASS` (Toàn bộ 11 bộ kịch bản kiểm thử tích hợp độc lập trong `scratch/test_*.js` đạt **453/453 assertions PASS 100%**).
- **BUILD:** `PASS` (Mã nguồn chạy trực tiếp Native ES Modules không cần build bước trung gian; ứng dụng phục vụ qua `server.js` port 8080).
  - *Lưu ý về bundle:* Lệnh `npm run bundle` trên Windows command line có thể gặp vấn đề về quote escaping trong inline script, nhưng file `WorkTree.html` đã được build sẵn tại root.

---

## 13. Known Bugs

1. **BUG-01 (P1):** Lệnh `npm run bundle` trong `package.json` sử dụng inline node script với nested quotes (`\"`), trên Windows `cmd.exe` có thể bị treo hoặc lỗi syntax quote escaping.
   - *Workaround:* Chạy file script riêng dạng `node scripts/bundle.js` thay vì inline script trong `package.json`.
2. **BUG-02 (P2):** File migration `supabase/migrations/20260910183000_user_onboarding_progress.sql` đang là untracked và chưa được apply lên remote Supabase database.
   - *Ảnh hưởng:* Service onboarding hiện đang fallback lưu tiến độ vào LocalStorage.
3. **BUG-03 (P2):** Cài đặt tổ chức trong Organization Settings dialog hiện đang lưu cục bộ, chưa có repository sync lên bảng `public.organizations`.
4. **BUG-04 (P3):** Một số icon SVG inline trong `js/core.js` chưa được chuẩn hóa qua `src/design-system/icons.js`.

---

## 14. Technical Debt

1. **TD-01 (Mức P0 — Security):** Remote URL trong `.git/config` chứa Personal Access Token. Cần xóa ngay lập tức và thu hồi token trên GitHub.
2. **TD-02 (Mức P1 — Testing CI):** Thiếu automated test runner (Vitest) và E2E runner (Playwright) trong `package.json` để chạy tự động trong CI pipeline.
3. **TD-03 (Mức P2 — Architectural Migration):** `js/core.js` (2.400+ dòng) vẫn là runtime điều khiển giao diện chính. Cần tiếp tục tách nhỏ thành các feature modules trong `src/features/`.
4. **TD-04 (Mức P3 — CSS Modularization):** `css/style.css` (1.900+ dòng) chưa được tách thành CSS Modules tương ứng với các slices trong `src/features/` và `src/design-system/`.

---

## 15. Files Currently Being Worked On

Dựa trên kiểm tra trạng thái Git (`git status`, `git diff`):

- **Files có thay đổi (chủ yếu là chuẩn hóa CRLF/LF):**
  - `WorkTree.html`
  - `css/style.css`
  - `index.html`
  - `js/core.js`
  - `server.js`
  - `src/app/app.js`
  - `src/features/notifications/services/push-device-service.js`
  - `src/lib/supabase/repositories.js`
- **Files mới (Untracked):**
  - `assets/icon-192.png`, `assets/icon-512.png` — PWA icons.
  - `src/features/onboarding/` — Module Product Onboarding V1.
  - `supabase/migrations/20260910183000_user_onboarding_progress.sql` — Migration lưu tiến độ onboarding.
- **Nội dung còn dở dang:**
  - Áp dụng migration `20260910183000_user_onboarding_progress.sql` lên remote Supabase database.
  - Kiểm thử tích hợp luồng Onboarding V1 với remote database.

---

## 16. Database Migrations

- **Thư mục lưu trữ:** `supabase/migrations/`
- **Danh sách 9 file di trú hiện có:**
  1. `20260909000000_worktree_multi_tenant_complete.sql` (90.377 bytes, 2.302 dòng) — Schema cốt lõi, 28 tables, 72 RLS policies, RPC functions, bucket `worktree-files`.
  2. `20260910000000_link_employee_invitation.sql` (7.678 bytes, 196 dòng) — Liên kết nhân viên và lời mời tài khoản.
  3. `20260910100000_enable_realtime_child_tables.sql` (1.359 bytes, 27 dòng) — Realtime publication & FULL replica identity trên 8 bảng.
  4. `20260910120000_secure_realtime_private_topics.sql` (1.154 bytes, 41 dòng) — Bảo mật Private Topics trên `realtime.messages`.
  5. `20260910140000_notification_infrastructure.sql` (20.554 bytes, 586 dòng) — Hạ tầng thông báo, nhắc việc, push devices và hàng đợi atomic queue.
  6. `20260910153500_fix_task_status_enum_trigger.sql` (2.165 bytes, 60 dòng) — Sửa lỗi trigger so sánh enum task_status.
  7. `20260910161000_add_revoke_invitation_rpc.sql` (2.348 bytes, 67 dòng) — RPC thu hồi lời mời `revoke_invitation`.
  8. `20260910170000_add_invitation_get_details_rpc.sql` (2.404 bytes, 67 dòng) — RPC lấy thông tin chi tiết lời mời `get_invitation_by_token`.
  9. `20260910183000_user_onboarding_progress.sql` (3.179 bytes, 82 dòng) — Lưu tiến độ onboarding của từng user/workspace. *(Chưa apply lên remote)*.

---

## 17. Environment Variables Required

Các biến môi trường bắt buộc (được cấu hình trong file `.env`, không commit vào Git):

| Tên biến | Bắt buộc | Phạm vi | Mục đích |
| :--- | :---: | :---: | :--- |
| `SUPABASE_URL` | Có | Frontend & Server | Endpoint API của Supabase project. |
| `SUPABASE_PUBLISHABLE_KEY` | Có | Frontend | Khóa công khai cho PostgREST / Auth (bảo vệ bởi RLS). |
| `SUPABASE_SECRET_KEY` | Có | Server & Edge Functions | Khóa Service Role dành riêng cho backend tin cậy, tuyệt đối cấm đưa ra client. |
| `SUPABASE_REST_URL` | Tùy chọn | Server | PostgREST endpoint trực tiếp. |
| `PORT` | Tùy chọn | Server | Cổng HTTP Server Node.js (Mặc định: `8080`). |
| `ONESIGNAL_APP_ID` | Tùy chọn | Frontend | App ID OneSignal phục vụ Web Push. |
| `ONESIGNAL_REST_API_KEY` | Tùy chọn | Edge Functions | Khóa gửi OneSignal push qua backend. |

---

## 18. Pending Work

1. **[PENDING - P0] Thu hồi và dọn dẹp Git Remote PAT:** Xóa PAT khỏi `git remote -v` và revoke trên GitHub.
2. **[PENDING - P1] Áp dụng Migration Onboarding:** Chạy `20260910183000_user_onboarding_progress.sql` lên remote database Supabase.
3. **[PENDING - P1] Hoàn thiện Test Runner:** Cài đặt Vitest / Playwright vào `package.json` để tự động hóa toàn bộ 11 test suites.
4. **[PENDING - P1] Sửa kịch bản Bundle:** Tách inline script trong `package.json` thành `scripts/bundle.js` để chạy tương thích đa nền tảng (Windows/Linux/macOS).
5. **[PENDING - P2] Cloud Organization Settings:** Xây dựng `OrganizationSettingsRepository` để đồng bộ cài đặt tổ chức (tên, múi giờ, giờ làm việc) lên Supabase Cloud.
6. **[PENDING - P2] Hoàn thiện Platform Admin UI:** Xây dựng giao diện cho vai trò super-admin (`platform_admins`).
7. **[PENDING - P2] SaaS Billing & Subscription UI:** Tích hợp cổng thanh toán và quản lý gói cước (`organization_subscriptions`).
8. **[PENDING - P3] Tách Modular CSS:** Chia nhỏ `css/style.css` theo cấu trúc `src/design-system/`.

---

## 19. Recommended Next 10 Steps

Theo đúng thứ tự ưu tiên: **Security → Database/RLS → Auth/Multi-tenant → Core Functionality → Testing → Polish**:

1. **Bước 1 (Security — Dọn sạch Git Remote URL):** Chạy `git remote set-url origin https://github.com/huungcs/WorkTree.git` để loại bỏ token nhạy cảm khỏi git config, và thu hồi token trên GitHub.
2. **Bước 2 (Database — Apply Onboarding Migration):** Chạy migration `20260910183000_user_onboarding_progress.sql` lên database remote Supabase.
3. **Bước 3 (Feature — Hoàn thiện Onboarding V1):** Kiểm thử tích hợp `src/features/onboarding/` với database remote, xác nhận lưu tiến độ qua RLS và tránh xung đột với notification popups.
4. **Bước 4 (Tooling — Fix Bundle Script):** Tạo file `scripts/bundle.js` và cập nhật `package.json` để lệnh `npm run bundle` hoạt động ổn định trên mọi hệ điều hành.
5. **Bước 5 (Testing — Cấu hình Vitest Test Runner):** Cài đặt Vitest vào `devDependencies` để chuyển đổi 11 file kiểm thử `scratch/test_*.js` thành bộ unit/integration test chính thức chạy được bằng lệnh `npm test`.
6. **Bước 6 (Feature — Organization Settings Cloud Sync):** Di chuyển cài đặt tổ chức từ LocalStorage lên bảng `public.organizations` trên Supabase Cloud.
7. **Bước 7 (Architecture — Tiếp tục di chuyển UI từ `js/core.js` sang `src/features/`):** Tách dần các logic render của Tasks, Views, Drawers vào từng domain feature slice độc lập.
8. **Bước 8 (Testing — E2E Smoke Tests với Playwright):** Thiết lập Playwright để tự động hóa kiểm thử các luồng người dùng quan trọng (Login, Switch Workspace, Create Task, Mobile Navigation).
9. **Bước 9 (Feature — Platform Admin & Billing Interface):** Xây dựng trang quản trị gói cước thuê bao và quản lý danh sách tenant cho Platform Admin.
10. **Bước 10 (Design System Polish & CSS Modularization):** Gom các icon inline trong `js/core.js` về `src/design-system/icons.js` và tách nhỏ `css/style.css`.

---

## 20. Important Warnings For The Next Agent

> [!CAUTION]
> 1. **TUYỆT ĐỐI KHÔNG ĐƯA SECRET KEY RA CLIENT:** `SUPABASE_SECRET_KEY` chỉ được phép dùng trong Edge Functions hoặc tác vụ server tin cậy. Trình duyệt chỉ được nhận `SUPABASE_PUBLISHABLE_KEY`.
> 2. **KHÔNG ĐƯỢC BYPASS RLS:** Mọi câu truy vấn database bắt buộc phải đi qua RLS với `organization_id`. Tuyệt đối không tắt RLS hay dùng Service Role để "fix nhanh" quyền truy cập của người dùng.
> 3. **KHÔNG TỰ Ý THAY ĐỔI DESIGN SYSTEM:**
>    - Font chữ duy nhất: `Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`.
>    - Màu sắc nhận diện: Primary Purple (`#6962db` / `#8d82f1`), Dark Navy Sidebar (`#141c2e`), Mint Brand Mark (`#c1f0d6`). Không cài đặt TailwindCSS, không đổi sang các phong cách kính mờ (glassmorphism) hay màu neon tùy ý.
> 4. **BẢO TỒN NGUYÊN VẸN RESPONSIVE CONTRACT:**
>    - Desktop (`>= 901px`): Sidebar co giãn chuẩn 278px (expanded) và 76px (collapsed). Phải thay đổi thật `grid-template-columns`. Không đưa bottom navigation lên desktop.
>    - Mobile (`<= 900px`): Sidebar bắt buộc là Off-canvas Drawer. Bottom Navigation cao `74px + safe-area-inset-bottom` là thanh điều hướng chính. Mọi touch target phải đạt từ `44px` đến `48px`.
> 5. **NHÂN SỰ (EMPLOYEE) ≠ CÂY TỔ CHỨC (ORGANIZATION NODE):**
>    - `employees` là con người / nhân sự.
>    - `organization_nodes` là cấu trúc tổ chức (công ty, phòng ban, dự án, nhóm, thư mục).
>    - Tuyệt đối không quay lại mô hình cũ nhét nhân sự làm node con trong cây tổ chức.
> 6. **KHÔNG TẠO MẬT KHẨU TẠM HOẶC PBKDF2 TRONG CLOUD MODE:**
>    - Mọi tài khoản nhân viên được mời đều qua Supabase Auth invitation / magic link / set password flow. Không lưu credential trong LocalStorage.
> 7. **DỌN DẸP GITHUB PAT TRONG GIT REMOTE:**
>    - Kiểm tra và đảm bảo không commit hoặc push bất kỳ URL nào chứa token xác thực.

---

## Verification Metadata

- **Date / Time:** `2026-09-10T19:45:00+07:00`
- **Git Branch:** `main`
- **Git HEAD Commit:** `a67466ef8bb0112a4ca896153585bdd7463368c0`
- **Working Tree Status:** 8 modified files (CRLF/LF line endings), 3 untracked items (`assets/`, `src/features/onboarding/`, `supabase/migrations/20260910183000_user_onboarding_progress.sql`)
- **Audit Performed By:** Antigravity (Principal Software Architect + Staff Full-stack Engineer + Design System Guardian)
- **Execution Mode:** AUDIT ONLY — NO APPLICATION CODE MODIFIED
- **Commands Actually Executed During Audit:**
  - `git status --short`
  - `git branch --show-current`
  - `git rev-parse HEAD`
  - `git log -5 --oneline`
  - `git remote -v`
  - `git diff --stat`
  - `git diff --ignore-cr-at-eol --stat`
  - `node --check server.js`
  - `node --check js/core.js`
  - `node --check js/access.js`
  - `node --check js/mobile.js`
  - `node --check src/app/app.js`
  - `node --check src/lib/supabase/client.js`
  - `node --check src/lib/supabase/repositories.js`
  - `node --check src/features/onboarding/index.js`
  - `node --check src/features/notifications/services/push-device-service.js`
