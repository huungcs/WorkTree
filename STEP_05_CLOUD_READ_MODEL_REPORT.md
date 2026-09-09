# WorkTree X — Step 05 Cloud Read Model Report

**Status:** Authoritative Implementation Report  
**Domain:** Workspace Read Model Migration (Organization Nodes, Employees, Task Rollups)  
**Date:** 2026-09-09  

---

## 1. Baseline
- **Git Branch:** `main`
- **Baseline Git HEAD:** `4c68676501ce8b82b17d8b5f8d41826f06b816cd`
- **Current Git HEAD:** `4c68676501ce8b82b17d8b5f8d41826f06b816cd`
- **Database Environment:** Supabase Cloud PostgreSQL 15.8 (`https://taupjuaficdzdgbmxmbe.supabase.co`)
- **Key Precedents:**
  - Step 01: Schema Contract Alignment (PASS)
  - Step 02: Multi-Tenant RLS & Isolation (PASS - 55/55)
  - Step 03: Supabase Auth & Session Integration (PASS - 23/24)
  - Step 04: Workspace Onboarding & Multi-Tenant Switcher (PASS - 27/27)

---

## 2. Files Audited
1. `src/app/app.js`: Quản lý luồng khởi tạo, điều phối pipeline nạp workspace, mappers và giao tiếp với legacy core.
2. `src/app/state.js`: Kho lưu trữ trạng thái trung tâm của ứng dụng frontend (bổ sung danh sách nodes, employees, tasks và cơ chế dọn dẹp tenant data).
3. `src/lib/supabase/repositories.js`: Lớp data access canonical cho NodeRepository, EmployeeRepository, TaskRepository, OrganizationRepository.
4. `js/core.js`: Động cơ render legacy (cây tổ chức, danh sách việc, kanban, gantt, workload, avatar hashing, write guards).
5. `js/access.js`: Logic phân quyền UI, chuyển tiếp nhân sự hợp lệ sang `window.cloudEmployees`.
6. `css/style.css`: Lớp phủ loading workspace, card thông báo tải trạng thái và hiệu ứng chuyển cảnh.
7. `supabase/migrations/20260909000000_worktree_multi_tenant_complete.sql`: Schema nguồn của các thực thể và view `public.task_rollups`.
8. `scratch/test_step05_cloud_read.js`: Bộ kiểm thử tự động 25 tiêu chí đọc dữ liệu đa tenant.

---

## 3. Previous Local Data Architecture
- **Nguồn dữ liệu cũ:** Trạng thái cố định được đọc và ghi trực tiếp vào `localStorage.getItem('wt_v8_data')`.
- **Cấu trúc cũ:** Khởi tạo sẵn dữ liệu mẫu cố định "Four Group" với 100+ tasks demo và các phòng ban Marketing, Sales, Automation.
- **Vi phạm Invariant B:** Nhân viên được biểu diễn thành các node có `type: 'person'` gắn thẳng vào cây tổ chức `data.nodes`.
- **Định danh giả lập:** Sử dụng số nguyên tự tăng `1, 2, 3...` thay vì UUID chuẩn.
- **Rủi ro:** Khi chuyển đổi công ty, dữ liệu cũ vẫn tồn tại trong localStorage, gây chớp dữ liệu chéo tổ chức và ghi đè trái phép.

---

## 4. Cloud Read Architecture
- **Nguồn dữ liệu Authoritative duy nhất:** Toàn bộ dữ liệu hiển thị trong workspace đến trực tiếp từ 3 nguồn Supabase Cloud:
  1. `public.organization_nodes`: Cây phân cấp tổ chức (chỉ gồm `company`, `department`, `project`, `team`, `folder`).
  2. `public.employees`: Bảng nhân sự độc lập (đảm bảo `employees != organization_nodes`).
  3. `public.task_rollups`: View đọc tổng hợp công việc có sẵn trường `actual_minutes`, `checklist_total`, `checklist_done`, `is_blocked`.
- **Bảo mật RLS:** Mọi truy vấn HTTP đều đính kèm Header `Authorization: Bearer <user_jwt>`, thực thi phân quyền trực tiếp tại tầng PostgreSQL.
- **Tách biệt dữ liệu:** LocalStorage bị vô hiệu hóa tư cách nguồn dữ liệu nghiệp vụ; chỉ còn phục vụ UI preferences (như trạng thái thu gọn sidebar, theme dark/light).

---

## 5. Workspace Load Pipeline
Khi một `activeOrganizationId` được chọn hoặc chuyển đổi, hàm canonical `loadWorkspaceData(orgId)` thực thi quy trình nguyên tử:
1. **Kiểm tra hợp lệ:** Xác thực membership và trạng thái hoạt động của người dùng trong tổ chức.
2. **Hiển thị Loading State:** Kích hoạt lớp phủ loading (`.workspace-loading-overlay`) chặn tương tác và hiển thị spinner.
3. **Dọn dẹp triệt để (Purge):** Gọi `purgeTenantData()` xóa sạch toàn bộ nodes, employees, tasks của tổ chức trước đó khỏi bộ nhớ RAM và UI layer.
4. **Tải song song (Parallel Fetch):** Thực thi đồng thời qua `Promise.all`:
   - `NodeRepository.getNodes(orgId)`
   - `EmployeeRepository.getEmployees(orgId)`
   - `TaskRepository.getTasks(orgId)` (truy vấn từ `task_rollups`)
5. **Client-Side Data Leak Assertion:** Quét toàn bộ các bản ghi nhận về, xác nhận 100% bản ghi có `record.organization_id === orgId`. Nếu sai, lập tức từ chối commit và phát cảnh báo an ninh.
6. **Ánh xạ chuẩn hóa (Data Mapping):** Ánh xạ DB entities sang UI models qua các mapper hàm thuần túy.
7. **Commit Snapshot Nguyên Tử:** Cập nhật đồng loạt vào `appState` và `window.setCloudWorkspaceData()`.
8. **Tái tạo chỉ mục & Render:** Gọi `rebuild()` để tính toán lại layout cây, biểu đồ, avatar index và bảng công việc.
9. **Ẩn Loading State:** Tắt lớp phủ tải, đưa workspace vào trạng thái sẵn sàng.

---

## 6. Race Condition Protection
- **Vấn đề:** Khi người dùng chuyển nhanh Org A → Org B → Org C, các phản hồi mạng chậm của Org A hoặc B có thể đến sau Org C và ghi đè dữ liệu sai lệch.
- **Giải pháp bảo vệ:** Sử dụng biến thế hệ tải toàn cục `workspaceLoadGeneration`:
  ```javascript
  const currentLoadGen = ++workspaceLoadGeneration;
  // ... sau khi fetch dữ liệu hoàn tất ...
  if (currentLoadGen !== workspaceLoadGeneration || orgId !== appState.activeOrganizationId) {
    console.warn(`Bỏ qua kết quả tải lỗi thời của thế hệ ${currentLoadGen}`);
    return;
  }
  ```
- **Kiểm thử thực tế:** Mô phỏng Org A có độ trễ 100ms và Org B có độ trễ 20ms; kết quả phản hồi của Org A bị loại bỏ hoàn toàn, không gây ô nhiễm Org B (Test 23 PASS).

---

## 7. Organization Node Migration
- **Repository:** `NodeRepository.getNodes(orgId)` lọc `organization_id = activeOrganizationId AND archived_at IS NULL`.
- **Root Node Thật:** Root node được tải trực tiếp từ bản ghi `type: 'company'` trong database với UUID chuẩn của tổ chức. Tuyệt đối không tạo root giả lập `{id: 1, type: 'company'}`.
- **Thuộc tính bảo toàn:** `parent_id`, `type`, `name`, `description`, `capacity_hours_week`, `sort_order`.
- **Sắp xếp:** Thứ tự phân cấp hiển thị được sắp xếp chính xác theo `sort_order`.

---

## 8. Employee Migration
- **Repository:** `EmployeeRepository.getEmployees(orgId)` lọc `organization_id = activeOrganizationId AND employment_status = 'active'`.
- **Bảo toàn Invariant B:** Tuyệt đối không có nhân viên nào bị ép chuyển thành organization node (`type: 'person'`). Cây tổ chức thuần túy phản ánh cơ cấu phòng ban và dự án.
- **Bảng chỉ mục nhân sự:** Xây dựng `window.employeesById` và `window.cloudEmployees` để phân giải nhanh `primary_assignee_id` sang họ tên, email, chức danh trong dropdown, bảng công việc và chế độ xem Workload.
- **Hỗ trợ Avatar:** Bổ sung thuật toán băm chuỗi UUID (`getAvatarIndex`) phân bổ đều 6 bảng màu avatar mà không phụ thuộc vào ID số nguyên cũ.

---

## 9. Task Rollup Migration
- **Truy vấn tối ưu:** Đọc trực tiếp từ `public.task_rollups` có bật `security_invoker = true`.
- **Loại bỏ N+1:** View cơ sở dữ liệu đã tính toán sẵn:
  - `actual_minutes`: Tính từ `sum(te.minutes)` trong `public.task_time_entries`.
  - `checklist_total` & `checklist_done`: Đếm từ `public.task_checklist_items`.
  - `is_blocked`: Tính từ hàm `public.task_is_blocked(id)`.
- **Bảo toàn tính toán:** Giờ ước tính và giờ thực tế chuyển đổi chính xác sang đơn vị giờ (`minutes / 60`) mà không làm suy giảm độ chính xác.

---

## 10. Data Mapping Contract
- **Trạng thái công việc:**
  - `todo` ➔ `Chưa làm`
  - `in_progress` ➔ `Đang làm`
  - `review` ➔ `Chờ duyệt`
  - `done` ➔ `Hoàn thành`
- **Độ ưu tiên:**
  - `urgent` ➔ `Khẩn cấp`
  - `high` ➔ `Cao`
  - `medium` ➔ `Trung bình`
  - `low` ➔ `Thấp`
- **Phụ thuộc:** `is_blocked === true` ➔ `Chờ phụ thuộc`.
- **Assignee:** `primary_assignee_id` ➔ đối chiếu qua `employeesById[id]` để lấy thông tin hiển thị, giữ nguyên UUID gốc.

---

## 11. Overview (Dashboard)
- Tính toán KPI thời gian thực trực tiếp từ mảng `tasks` thuộc cloud snapshot:
  - Tổng số việc, số việc chưa làm, đang làm, chờ duyệt, hoàn thành.
  - Tỷ lệ hoàn thành (Progress %) tính toán chính xác.
- **Empty Workspace:** Khi tổ chức mới có 0 công việc, màn hình Overview hiển thị 0 việc, 0 trễ hạn, tiến độ 0% một cách thanh thoát mà không bị lỗi chia cho 0 hay chớp dữ liệu demo.

---

## 12. List (Danh Sách Công Việc)
- Render 100% từ dữ liệu `task_rollups`.
- Giữ nguyên các bộ lọc theo phòng ban, trạng thái, độ ưu tiên, ô tìm kiếm và giao diện chọn hàng loạt (Bulk Selection).
- Thuộc tính ID của các thẻ HTML và dữ liệu được neo giữ nguyên vẹn bằng chuỗi UUID.

---

## 13. Kanban
- Các cột Kanban (`Chưa làm`, `Đang làm`, `Chờ duyệt`, `Hoàn thành`) gom nhóm và hiển thị trực quan các cloud tasks.
- **Write Path Safety Gate:** Thao tác kéo thả (drag & drop) thay đổi trạng thái được chặn an toàn kèm thông báo Toast tiếng Việt: *"Tính năng cập nhật Cloud đang được hoàn thiện trong Step 06."* Không âm thầm ghi đè vào bộ nhớ cục bộ.

---

## 14. Calendar (Lịch Biểu)
- Đọc trực tiếp trường `start_date` và `due_date` từ cloud task entity.
- Hiển thị các sự kiện công việc theo đúng múi giờ tổ chức (`Asia/Ho_Chi_Minh`), không tạo ngày ngẫu nhiên từ seed data.

---

## 15. Timeline (Tiến Độ / Gantt)
- Render thanh tiến độ dựa trên `start_date`, `due_date`, và tỷ lệ `progress` thực tế của Supabase Cloud.
- Thao tác kéo dãn thời gian trên timeline được bảo vệ an toàn bằng write guard, không gây mất đồng bộ với server.

---

## 16. Workload (Tải Công Việc)
- Khắc phục hoàn toàn lỗi kiến trúc cũ: Tải công việc được tổng hợp dựa trên danh sách `employees` thực tế thuộc tổ chức hiện hành.
- Tính toán tổng số giờ được giao dựa trên `primary_assignee_id` của từng nhân viên, không dựa vào person nodes.

---

## 17. Task Detail Read Path
- Màn hình chi tiết công việc mở ra với thông tin tiêu đề, mô tả, phòng ban phụ trách, người thực hiện, độ ưu tiên và ngày hạn từ cloud task snapshot.
- Các bảng con chưa chuyển dịch trong Step 05 (checklist chi tiết, bình luận) được đưa về trạng thái trống an toàn, không pha trộn dữ liệu của task demo cũ.

---

## 18. LocalStorage Boundary
- **Audit toàn diện:** Đã kiểm tra tất cả các vị trí `persistData()`, `save()`, `localStorage.setItem`.
- Khi đang ở chế độ Cloud Workspace (`window.__is_cloud_workspace === true`), hàm `persistData()` lập tức thoát mà không ghi đè bất kỳ bản ghi nào vào key `wt_v8_data`.
- LocalStorage chỉ được phép ghi nhận UI preferences (ví dụ: cờ `wt_sidebar_collapsed`, theme).

---

## 19. Workspace Switch Regression
- **Quy trình kiểm thử A → B → A:**
  1. Tổ chức A có 3 tasks, 2 nodes, 2 nhân sự.
  2. Chuyển sang Tổ chức B (tổ chức mới tạo): Lập tức xóa sạch dữ liệu của A; Tổ chức B hiển thị 0 tasks, 1 root node, 1 owner employee. Không có bất kỳ frame hình nào bị chớp nháy dữ liệu của A.
  3. Chuyển ngược lại Tổ chức B → A: Tải lại toàn bộ 3 tasks, nodes và nhân sự của A chính xác 100%.

---

## 20. Security Verification
- **Tầng Database (RLS):** Toàn bộ chính sách RLS trên các bảng `organizations`, `organization_nodes`, `employees`, `tasks`, `task_rollups` được giữ nguyên vẹn 100%, không bị nới lỏng.
- **Tầng Client Guard:** Kiểm tra chéo `organization_id` ngay sau khi nhận phản hồi HTTP; từ chối xử lý nếu có bất kỳ bản ghi nào khác tenant ID.
- **Quét Secrets:** Quét toàn bộ file client, bundle và mã nguồn frontend; khẳng định không có `service_role_key` hay database password bị lộ lọt (Test 24 PASS).

---

## 21. Performance
- Số lượng truy vấn ban đầu khi tải workspace được gom cụm tối ưu thành 3 lệnh gọi API song song qua `Promise.all`:
  1. `organization_nodes`
  2. `employees`
  3. `task_rollups`
- Chỉ mục bộ nhớ `employeesById` và `nodesById` được tạo một lần duy nhất sau khi tải, đạt độ phức tạp $O(1)$ khi tra cứu quan hệ. Không phát sinh truy vấn N+1.

---

## 22. Desktop QA
- **Độ phân giải kiểm tra:** 1536x864, 1280x800.
- **Chế độ Sidebar:**
  - Expanded (278px): Hiển thị đầy đủ cơ cấu tổ chức, switcher và thanh công cụ.
  - Collapsed (76px): Thu gọn trơn tru, mở rộng diện tích hiển thị nội dung chính.
- **Các góc nhìn:** Overview, List, Kanban, Calendar, Timeline, Workload đều hiển thị dữ liệu cloud nhất quán.
- **Chế độ Dark/Light:** Chuyển đổi mượt mà theo đúng bảng mã token trong `AGENTS.md`.

---

## 23. Mobile QA
- **Độ phân giải kiểm tra:** 390x844 (iPhone / chuẩn mobile hiện đại).
- **Navigation:** Thanh điều hướng dưới đáy (Bottom Navigation Bar) target $\ge 44\text{px}$ hoạt động hoàn hảo; Drawer trượt off-canvas hiển thị mượt mà.
- **Không tràn ngang:** Toàn bộ bảng dữ liệu và danh sách tự động chuyển thành card layout co giãn responsive, không bị horizontal overflow.

---

## 24. Automated Tests
Đã xây dựng và thực thi bộ kiểm thử tự động tại `scratch/test_step05_cloud_read.js`:
- **Số lượng bài kiểm thử:** 25/25 assertions.
- **Tỷ lệ vượt qua:** 100% PASS.
- **Chi tiết các tiêu chí kiểm tra:**
  1. `Test 1`: Node fetch trả về danh sách nodes của Org A (PASS)
  2. `Test 2`: Toàn bộ nodes nhận về có `organization_id === Org A` (PASS)
  3. `Test 3`: Employee fetch trả về danh sách nhân sự active của Org A (PASS)
  4. `Test 4`: Toàn bộ employees nhận về có `organization_id === Org A` (PASS)
  5. `Test 5`: Task rollups fetch trả về đúng 3 tasks của Org A (PASS)
  6. `Test 6`: Toàn bộ task_rollups nhận về có `organization_id === Org A` (PASS)
  7. `Test 7`: Task status mapper: `todo`, `in_progress`, `done` (PASS)
  8. `Test 8`: Priority mapper: `urgent`, `high`, `medium` (PASS)
  9. `Test 9`: Task assignee resolve qua `primary_assignee_id` sang Employee UUID & Name (PASS)
  10. `Test 10`: Org B là workspace mới có đúng 0 tasks (PASS)
  11. `Test 11`: Overview KPI trên empty workspace không crash chia cho 0 (PASS)
  12. `Test 12`: Overview KPI trên Org A tính toán chính xác 3 tasks, 33% progress (PASS)
  13. `Test 13`: Chuyển sang Org B: Purge lập tức xóa sạch state Org A (PASS)
  14. `Test 14`: Org B commit snapshot thật: đúng 1 root node và 0 tasks (PASS)
  15. `Test 15`: Chuyển ngược lại B -> A: Tải lại nguyên vẹn 3 tasks và nodes Org A (PASS)
  16. `Test 16`: RLS chặn User A đọc task_rollups của Org C (PASS)
  17. `Test 17`: RLS chặn User A đọc organization_nodes của Org C (PASS)
  18. `Test 18`: Invariant B: Tuyệt đối không có node `type = 'person'` trong tree (PASS)
  19. `Test 19`: Định danh authority là UUID trên toàn bộ read path (PASS)
  20. `Test 20`: Empty workspace không rơi về dữ liệu mẫu "Four Group" (PASS)
  21. `Test 21`: `task_rollups.is_blocked` ánh xạ thành boolean trên UI (PASS)
  22. `Test 22`: Chuyển đổi giờ ước tính và giờ thực tế chính xác (PASS)
  23. `Test 23`: Race Condition Guard: Phản hồi chậm của Org A bị loại bỏ, không ghi đè Org B (PASS)
  24. `Test 24`: Quét bảo mật: Không có secret key nào bị rò rỉ trong client bundle (PASS)
  25. `Test 25`: Lệnh `npm run bundle` hoàn thành thành công và `WorkTree.html` được cập nhật (PASS)

---

## 25. Files Modified
- `src/app/state.js`: Bổ sung cấu trúc dữ liệu `employees`, `tasks` và cơ chế dọn dẹp tenant state.
- `src/app/app.js`: Tích hợp các repositories, xây dựng pipeline `loadWorkspaceData`, bảo vệ race condition và mapping dữ liệu.
- `js/core.js`: Tích hợp write guards, phân giải nhân viên tách biệt khỏi cây tổ chức, băm màu avatar UUID, vô hiệu hóa ghi đè localStorage nghiệp vụ.
- `js/access.js`: Ủy quyền danh sách nhân viên qua `window.cloudEmployees`.
- `css/style.css`: Bổ sung CSS cho workspace loading overlay và error recovery state.
- `WorkTree.html`: Cập nhật production bundle qua lệnh `npm run bundle`.
- `scratch/test_step05_cloud_read.js`: Bộ kiểm thử tự động Step 05.

---

## 26. Known Limitations
- **Write Path (Mutations):** Các thao tác thêm việc, sửa việc, xóa việc, kéo thả kanban và thay đổi timeline hiện tại đang được gác cổng an toàn (gated) bằng thông báo hướng dẫn, chuẩn bị để di chuyển đồng bộ lên Supabase Cloud trong Step 06.
- **Child Tables:** Các mục checklist con và nhật ký bình luận chi tiết chưa được kết nối API viết mới trong Step 05 và hiển thị trạng thái chờ đồng bộ.

---

## 27. Exit Criteria
- [x] Organization tree reads Supabase nodes
- [x] Employees read Supabase employees
- [x] No employee represented as organization node (Invariant B preserved)
- [x] Tasks read from `public.task_rollups`
- [x] Overview renders cloud tasks
- [x] List renders cloud tasks
- [x] Kanban renders cloud tasks
- [x] Calendar renders cloud tasks
- [x] Timeline renders cloud tasks
- [x] Workload uses cloud employees & tasks
- [x] IDs remain UUID on cloud path
- [x] `activeOrganizationId` strictly applied
- [x] Empty workspace has zero demo data
- [x] Switching tenant has zero stale flash (Purge verified)
- [x] Async race protected via generation counter
- [x] No mixed cloud/local task child data
- [x] No silent local-only mutations on cloud workspace
- [x] RLS policies unchanged
- [x] Auth regression PASS
- [x] Workspace regression PASS
- [x] Tenant isolation regression PASS
- [x] Desktop QA PASS
- [x] Mobile QA PASS
- [x] Dark mode PASS
- [x] `npm run bundle` PASS

---

## 28. Recommendation for Step 06
- Bắt đầu **Step 06 — Supabase Cloud Mutation Pipeline**:
  - Di chuyển các hàm tạo mới công việc (`create_task` / `TaskRepository.createTask`).
  - Di chuyển các hàm cập nhật trạng thái (`updateTaskStatus`), kéo thả Kanban và cập nhật ngày tháng.
  - Kết nối tạo phòng ban/dự án trên cây tổ chức (`create_node`).
  - Triển khai cập nhật thời gian làm việc (`task_time_entries`) và checklist items (`task_checklist_items`).

---

STEP 05 STATUS:
PASS

CLOUD NODES ACTIVE:
YES

CLOUD EMPLOYEES ACTIVE:
YES

TASK_ROLLUPS ACTIVE:
YES

LOCAL BUSINESS DATA AUTHORITY DISABLED:
YES

TENANT SWITCH STALE-DATA TEST:
PASS

READY FOR STEP 06 CLOUD MUTATIONS:
YES
