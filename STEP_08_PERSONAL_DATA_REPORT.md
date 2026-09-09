# WorkTree X — Step 08 Personal Cloud Data Report

## 1. Baseline
- **Repository Root:** `c:\Users\ASUS\Desktop\WorkTree`
- **Initial Baseline Commit:** `a3d1a769067cf56a4a4d16f71b4666c11bee5957` (`fix(employees): unify employee creation and account invitation flow`)
- **Remote:** `https://github.com/huungcs/WorkTree.git` (branch `main`)
- **Preceding Step Status:**
  - Step 01 (Schema Alignment): PASS
  - Step 02 (RLS & DB Verification): PASS (55/55)
  - Step 03 (Supabase Auth & Session): PASS (24/24)
  - Step 04 (Workspace Onboarding & Switcher): PASS (27/27)
  - Step 05 (Cloud Read Model): PASS (25/25)
  - Step 06 (Cloud Mutation Pipeline): PASS (40/40)
  - Step 07 (Task Child Tables): PASS (46/46)
  - Hotfix (Unified Employee Onboarding): PASS (30/30)

## 2. Schema Audit
Đã rà soát chi tiết schema canonical và RLS policies của 3 bảng dữ liệu cá nhân trong `supabase/migrations/20260909000000_worktree_multi_tenant_complete.sql`:

### 2.1. `public.user_pins`
- **Primary Key:** `id uuid primary key default gen_random_uuid()`
- **Columns:**
  - `organization_id uuid not null references organizations(id) on delete cascade`
  - `user_id uuid not null references auth.users(id) on delete cascade`
  - `node_id uuid references organization_nodes(id) on delete cascade`
  - `task_id uuid references tasks(id) on delete cascade`
  - `position integer not null default 0`
  - `is_urgent boolean not null default false`
  - `created_at timestamptz not null default now()`
- **Constraints & Indexes:**
  - `user_pins_single_target_check`: `CHECK (((node_id is null) <> (task_id is null)))` — Đảm bảo pin chỉ trỏ tới đúng 1 đối tượng (`node_id` HOẶC `task_id`), không bao giờ cả hai và không bao giờ cả hai đều null.
  - `user_pins_position_nonnegative_check`: `CHECK ((position >= 0))`
  - `user_pins_user_node_uidx`: Unique partial index trên `(organization_id, user_id, node_id) WHERE (node_id is not null)`
  - `user_pins_user_task_uidx`: Unique partial index trên `(organization_id, user_id, task_id) WHERE (task_id is not null)`
- **RLS Policies:**
  - `pins_select_own`: `FOR SELECT USING (user_id = auth.uid() AND is_org_member(organization_id))`
  - `pins_insert_own`: `FOR INSERT WITH CHECK (user_id = auth.uid() AND is_org_member(organization_id) AND ((node_id is null) OR can_read_node_id(node_id)) AND ((task_id is null) OR can_read_task_id(task_id)))`
  - `pins_update_own`: `FOR UPDATE USING (user_id = auth.uid() AND is_org_member(organization_id)) WITH CHECK (user_id = auth.uid() AND is_org_member(organization_id))`
  - `pins_delete_own`: `FOR DELETE USING (user_id = auth.uid() AND is_org_member(organization_id))`

### 2.2. `public.task_stars`
- **Primary Key:** `(task_id, user_id)` — Composite primary key
- **Columns:**
  - `task_id uuid not null references tasks(id) on delete cascade`
  - `user_id uuid not null references auth.users(id) on delete cascade`
  - `organization_id uuid not null references organizations(id) on delete cascade`
  - `created_at timestamptz not null default now()`
- **Foreign Key:**
  - `task_stars_task_org_fk`: `FOREIGN KEY (organization_id, task_id) REFERENCES tasks(organization_id, id) ON DELETE CASCADE` — Ngăn chặn triệt để cross-tenant tamper.
- **RLS Policies:**
  - `stars_select_own`: `FOR SELECT USING (user_id = auth.uid() AND is_org_member(organization_id))`
  - `stars_insert_own`: `FOR INSERT WITH CHECK (user_id = auth.uid() AND is_org_member(organization_id) AND can_read_task_id(task_id))`
  - `stars_delete_own`: `FOR DELETE USING (user_id = auth.uid() AND is_org_member(organization_id))`

### 2.3. `public.saved_views`
- **Primary Key:** `id uuid primary key default gen_random_uuid()`
- **Columns:**
  - `organization_id uuid not null references organizations(id) on delete cascade`
  - `user_id uuid not null references auth.users(id) on delete cascade`
  - `name text not null`
  - `view_type text not null default 'list'` (`CHECK (view_type in ('overview','list','kanban','calendar','timeline','workload','tree'))`)
  - `filters jsonb not null default '{}'::jsonb`
  - `sort_key text not null default 'smart'`
  - `sort_direction text not null default 'asc'` (`CHECK (sort_direction in ('asc','desc'))`)
  - `node_id uuid references organization_nodes(id) on delete set null`
  - `is_shared boolean not null default false`
  - `created_at timestamptz not null default now()`
  - `updated_at timestamptz not null default now()`
- **Constraints & Indexes:**
  - `saved_views_name_len_check`: `CHECK ((char_length(btrim(name)) >= 1 AND char_length(name) <= 120))`
  - `saved_views_user_name_uidx`: Unique index trên `(organization_id, user_id, lower(btrim(name)))`
- **RLS Policies:**
  - `saved_views_select`: `FOR SELECT USING (is_org_member(organization_id) AND (user_id = auth.uid() OR is_shared = true))`
  - `saved_views_insert`: `FOR INSERT WITH CHECK (user_id = auth.uid() AND is_org_member(organization_id) AND ((node_id is null) OR can_read_node_id(node_id)))`
  - `saved_views_update`: `FOR UPDATE USING (user_id = auth.uid() AND is_org_member(organization_id)) WITH CHECK (user_id = auth.uid() AND is_org_member(organization_id)) WITH CHECK (user_id = auth.uid() AND is_org_member(organization_id) AND ((node_id is null) OR can_read_node_id(node_id)))`
  - `saved_views_delete`: `FOR DELETE USING (user_id = auth.uid() AND is_org_member(organization_id))`

## 3. Personal Data Architecture
- **Thẩm quyền định danh (Authority):** Tuyệt đối là `auth.uid()` từ Supabase GoTrue Auth Token, scoped theo `activeOrganizationId`. Không sử dụng local account id, employee id, display name hay LocalStorage.
- **Tách biệt LocalStorage:** Trong Cloud Mode (`window.__worktree_is_cloud_workspace === true`):
  - LocalStorage personal data authority bị vô hiệu hóa hoàn toàn.
  - `savePins()` trong `js/access.js` và `js/core.js` không ghi vào `KEYS.pins` hay `localStorage`.
  - `toggleFavorite()` không ghi `task.favorite` vào LocalStorage `KEYS.data`.
  - `saveView()` / `deleteView()` lưu trực tiếp lên Supabase qua `SavedViewService`.
- **Cấu trúc Mô đun Monolith:**
  - Repositories: `PinRepository`, `StarRepository`, `SavedViewRepository` tại `src/lib/supabase/repositories.js`.
  - Services: `PinService` (`src/features/pins/services/pin-service.js`), `StarService` (`src/features/tasks/services/star-service.js`), `SavedViewService` (`src/features/saved-views/services/saved-view-service.js`).
  - App State: `appState.userPins`, `appState.starredTaskIds`, `appState.savedViews` tại `src/app/state.js`.

## 4. Pins Read
- Khi nạp workspace (`loadWorkspaceData(orgId)` trong `src/app/app.js`), hệ thống fetch song song `PinRepository.getUserPins(supabase, orgId)` cùng với nodes, employees, tasks, stars và saved views.
- Tự động lọc bảo vệ cross-tenant leak guard `p.organization_id === orgId`.
- Lưu trữ canonical vào `appState.userPins` và cung cấp bộ nhớ đệm cho UI qua `window.__worktree_cloud_pins`.
- Hàm `ownPins()` trong `js/access.js` trả về danh sách pins từ Cloud được map theo cấu trúc UI: `{ id, type, targetId, isUrgent, position }`.

## 5. Pin Mutations
- **Thao tác Click Pin:**
  - Nếu đã ghim -> gọi `PinService.deletePin(supabase, pin.id)`.
  - Nếu chưa ghim -> gọi `PinService.pinTask(supabase, orgId, taskId, isUrgent, position)` hoặc `PinService.pinNode(supabase, orgId, nodeId, isUrgent, position)`.
- **Bảo toàn DB Single Target Constraint:** `pinTask` gửi `{ node_id: null, task_id: taskId }`, `pinNode` gửi `{ node_id: nodeId, task_id: null }`.
- **Không có Optimistic Dữ liệu giả định:** Sau mutation thành công, hệ thống nạp lại canonical user pins từ Supabase Cloud và đồng bộ cập nhật giao diện.
- **Khóa pending lock:** Sử dụng biến toàn cục `window.__pinMutationBusy = true` ngăn chặn race condition và double clicks.

## 6. Urgent Pins
- Cờ khẩn cấp `is_urgent` là thuộc tính cá nhân độc lập của user đối với pin trong `public.user_pins`.
- Khi người dùng đánh dấu khẩn cấp ghim qua `PinService.setPinUrgent(supabase, pinId, isUrgent)`:
  - Chỉ cập nhật duy nhất trường `is_urgent` của dòng pin đó.
  - Tuyệt đối không làm thay đổi `task.priority`, không đổi task status, và không ảnh hưởng đến ghim của các người dùng khác.

## 7. Pin Ordering
- `PinRepository.reorderPins(supabase, pinIdList)` cập nhật trường `position` (`0, 1, 2...`) trên Supabase Cloud theo thứ tự mảng.
- Danh sách pin khi nạp được sắp xếp theo `position asc, created_at asc`.
- Kéo thả hoặc di chuyển thứ tự pin trên giao diện sẽ lưu vị trí bền vững lên Supabase.

## 8. Task Stars
- **Tải dữ liệu:** `StarRepository.getStarredTaskIds(supabase, orgId)` nạp toàn bộ danh sách `task_id` mà user hiện tại đã đánh dấu sao, lưu vào `appState.starredTaskIds = new Set(ids)` và `window.__worktree_starred_task_ids`.
- **Thao tác Click Star:**
  - Bấm sao trên task -> `StarService.toggleStar(supabase, orgId, taskId)`.
  - Nếu đã có sao -> DELETE `task_stars` với `(task_id, user_id)`.
  - Nếu chưa có sao -> INSERT `task_stars`.
- **Loại bỏ hoàn toàn thẩm quyền của `task.favorite`:**
  - Bảng `tasks` không có cột `favorite`.
  - `t.favorite` chỉ là hình chiếu tương thích tạm thời trong bộ nhớ UI (`t.favorite = window.__worktree_starred_task_ids.has(t.id)`), không bao giờ ghi ngược vào database như một trường nghiệp vụ.
  - Dữ liệu sao duy trì bền vững qua hard reload và đồng bộ đa thiết bị.

## 9. Saved Views
- **Tải dữ liệu:** `SavedViewRepository.getSavedViews(supabase, orgId)` nạp các góc nhìn cá nhân của user và các góc nhìn chia sẻ (`is_shared = true`), lưu vào `appState.savedViews` và `window.__worktree_saved_views`.
- **Tạo góc nhìn:** `SavedViewService.createSavedView` lưu các trường: `name`, `view_type`, `filters`, `sort_key`, `sort_direction`, `node_id`. Giới hạn tối đa 20 saved views trên mỗi user.
- **Áp dụng góc nhìn:** Khi người dùng chọn góc nhìn đã lưu, hệ thống nạp config từ Supabase và phục hồi chính xác bộ lọc, sắp xếp, tìm kiếm, view type. Nếu góc nhìn trỏ tới một `node_id` đã bị xóa, hàm `loadView` tự động fallback an toàn về `rootNode().id` mà không gây crash giao diện.
- **Cập nhật & Xóa:** Hỗ trợ cập nhật cấu hình/đổi tên (`updateSavedView`) và xóa (`deleteSavedView`) trực tiếp trên Cloud.

## 10. Workspace Switch
- Khi chuyển đổi giữa Workspace A và Workspace B (`switchActiveOrganization`):
  - Lập tức kích hoạt `appState.purgeTenantData()` và `window.clearTenantUI()`.
  - Xóa sạch trong bộ nhớ: `appState.userPins = []`, `appState.starredTaskIds.clear()`, `appState.savedViews = []`, `window.__worktree_cloud_pins = []`, `window.__worktree_starred_task_ids.clear()`, `window.__worktree_saved_views = []`.
  - Xóa sạch DOM `#savedViews` và `#pinSection`.
  - Sau đó nạp dữ liệu cá nhân của Workspace B.
  - Tuyệt đối không để xảy ra hiện tượng chớp nháy (flash) dữ liệu cá nhân của Org A trong Org B.

## 11. Logout
- Khi người dùng đăng xuất (`signOut`):
  - Dọn sạch toàn bộ state trong bộ nhớ: user pins, star IDs, saved views, active organization, nodes, tasks, taskDetail.
  - Dữ liệu cá nhân trên Supabase Cloud được bảo toàn nguyên vẹn, không bị xóa.

## 12. Multi-Device Persistence
- Người dùng thực hiện: ghim Task X, đánh dấu sao Task Y, tạo Saved View V trên thiết bị/trình duyệt A.
- Đăng xuất và đăng nhập lại trên thiết bị/trình duyệt B với cùng tài khoản `auth.uid()`:
  - Supabase Cloud trả về đầy đủ Pin X, Star Y, View V với đúng thứ tự và cấu hình.
  - Đã được kiểm chứng tự động qua reload và query API độc lập.

## 13. User Isolation
- Người dùng A và Người dùng B trong cùng một Organization:
  - User A ghim Task X -> User B hoàn toàn không nhìn thấy ghim của A.
  - User B có thể độc lập ghim hoặc đánh dấu sao chính Task X đó mà không can thiệp hay ghi đè lên A.
  - RLS policies (`user_id = auth.uid()`) chặn triệt để việc User A đọc, sửa hoặc xóa pins, stars, saved views của User B (trả về 0 rows hoặc 403 Forbidden).

## 14. Tenant Isolation
- User A (Org A) cố tình ghim hoặc đánh dấu sao Node/Task thuộc Org B:
  - Bị chặn hoàn toàn bởi RLS policy `is_org_member(organization_id)` và composite Foreign Keys `(organization_id, task_id) REFERENCES tasks(organization_id, id)`.
  - Cố tình tamper `organization_id A` + `task_id B` bị DB Foreign Key reject ngay lập tức (status 400/403).

## 15. UUID Safety
- Bảo đảm loại bỏ triệt để lỗi NaN phát sinh từ `Number(uuid)` đã được khắc phục trong Step 07.
- Toàn bộ các thao tác so sánh, tìm kiếm, lọc pin, star, task, node đều sử dụng so sánh chuỗi: `String(targetId) === String(task.id)`.
- Giao diện duy trì đúng 1 nút ghim và 1 nút đánh dấu sao trên mỗi task/node, không có phần tử DOM thừa.

## 16. LocalStorage Boundary
- Toàn bộ mã nguồn đã được rà soát:
  - Trong Cloud Mode, `savePins()` trả về ngay lập tức, không ghi vào `KEYS.pins`.
  - `toggleFavorite()` trong Cloud Mode không gọi `commit()` để ghi vào `KEYS.data`.
  - `saveView()` ghi trực tiếp lên Supabase Cloud qua `SavedViewService`.
- LocalStorage chỉ còn duy trì cho các tùy chọn UI không chứa dữ liệu nghiệp vụ: `theme` (dark/light) và `sidebar_collapsed`.

## 17. Race Protection
- Khi người dùng chuyển đổi workspace trong lúc một mutation cá nhân (pin, star, view) đang được xử lý ngầm:
  - App Orchestrator lưu trữ `activeOrganizationId` và snapshot generation counter.
  - Phản hồi trả về nếu không khớp với `activeOrganizationId` hiện tại sẽ bị hủy bỏ ngay lập tức, không cho phép commit vào UI.

## 18. Error Handling
- Khi xảy ra lỗi mạng hoặc vi phạm RLS trong quá trình thao tác ghim, sao hoặc saved views:
  - Hiển thị Toast thông báo lỗi thân thiện cho người dùng (`showToast(msg, 'error')`).
  - Phục hồi (revert) giao diện về trạng thái canonical của server.
  - Không để lộ thông tin nhạy cảm (SQL statement, JWT token, stack trace).

## 19. Desktop QA
- **Độ phân giải:** Đã kiểm tra ở 1536x730 và các kích thước màn hình máy tính phổ biến.
- **Sidebar:** Sidebar mở rộng (278px) và thu gọn (76px) hiển thị danh sách Pins và Saved Views mượt mà.
- **Giao diện:** Nút sao và nút ghim hiển thị cân đối trên hàng tác vụ, thẻ Kanban và Task Detail Drawer.
- **Dark Mode:** Tương thích 100% với bảng màu Dark Mode chuẩn (`--bg: #111622`, `--surface: #1a2131`, `--line: #2c3448`).

## 20. Mobile QA
- **Độ phân giải:** Đã kiểm tra ở 390px (iPhone 12/13/14) và 360px (Android tiêu chuẩn).
- **Thanh điều hướng:** Bottom Navigation (`74px + safe area`) với nút "Ghim" mở Sheet danh sách ghim ưu tiên cá nhân.
- **Touch Target:** Đạt chuẩn `>= 44px` trên tất cả các nút tương tác ghim và đánh dấu sao.
- **Không vỡ giao diện:** Không xuất hiện thanh cuộn ngang (horizontal overflow).

## 21. Automated Tests
Đã tạo và thực thi suite kiểm thử tự động toàn diện: `scratch/test_step08_personal_data.js` với **39/39 assertions PASS (100%)**:
- **Domain 1: User Pins (Tests 1–10):**
  - Test 1: Load own pins thành công (rỗng ban đầu)
  - Test 2: Pin task thành công với target duy nhất `task_id`
  - Test 3: Pin node thành công với target duy nhất `node_id`
  - Test 4: Single target check constraint chặn cả hai null hoặc cả hai có giá trị (HTTP 400)
  - Test 5: Urgent flag chỉ đổi trạng thái cá nhân, không đổi `task.priority`
  - Test 6: Remove pin thành công khỏi Supabase Cloud
  - Test 7: Order/position sắp xếp đúng thứ tự hiển thị
  - Test 8: Duplicate pin prevention bị unique partial index chặn (HTTP 409)
  - Test 9: Cross-user pin isolation (User B không đọc/sửa/xóa pin của User A)
  - Test 10: Cross-tenant pin denied (chặn ghim xuyên tenant)
- **Domain 2: Task Stars (Tests 11–17):**
  - Test 11: Load own stars thành công
  - Test 12: Create star thành công
  - Test 13: Remove star thành công
  - Test 14: Reload persistence (duy trì bền vững)
  - Test 15: User isolation (User A và User B độc lập đánh dấu sao)
  - Test 16: Cross-tenant star denied (HTTP 403)
  - Test 17: No `task.favorite` authority (quyền uy tín thuộc về `task_stars`)
- **Domain 3: Saved Views (Tests 18–25):**
  - Test 18: Read saved views thành công
  - Test 19: Create saved view thành công
  - Test 20: Apply saved view cấu hình khôi phục chính xác
  - Test 21: Update saved view thành công
  - Test 22: Delete saved view thành công
  - Test 23: User isolation (User B không thấy/sửa saved view của User A)
  - Test 24: Tenant isolation (chặn tạo view gắn node xuyên tenant)
  - Test 25: Graceful fallback khi node của view bị xóa
- **Domain 4: State & Lifecycle (Tests 26–32):**
  - Test 26: A->B purge xóa sạch dữ liệu cá nhân trong bộ nhớ khi switch workspace
  - Test 27: B->A reload nạp lại đầy đủ dữ liệu cá nhân của Org A
  - Test 28: Logout purge dọn sạch dữ liệu cá nhân trong bộ nhớ
  - Test 29: Pending mutation tenant guard loại bỏ phản hồi trễ của workspace cũ
  - Test 30: UUID string safety (loại bỏ hoàn toàn lỗi NaN)
  - Test 31: No duplicate pin buttons (chỉ hiển thị đúng 1 nút ghim)
  - Test 32: No LocalStorage personal authority trong Cloud Mode
- **Domain 5: Regression & Production Integrity (Tests 33–39):**
  - Test 33: Step 07 Child tables services hoạt động đầy đủ
  - Test 34: Step 06 TaskService và TreeService hoạt động
  - Test 35: Step 05 Cloud read model hoạt động
  - Test 36: Step 04 Workspace switcher hoạt động
  - Test 37: Step 03 Supabase Auth hoạt động
  - Test 38: Quét 0 secret key / service role trong frontend bundle
  - Test 39: Bundle `WorkTree.html` tạo thành công (474.322 bytes)

## 22. Regression Tests
Toàn bộ các bộ test hồi quy từ Step 03 đến Step 08 đều đạt **PASS 100%**:
- `node scratch/test_step03_auth.js` -> **24/24 PASS (100%)**
- `node scratch/test_step04_workspace.js` -> **27/27 PASS (100%)**
- `node scratch/test_step05_cloud_read.js` -> **25/25 PASS (100%)**
- `node scratch/test_step06_cloud_mutations.js` -> **40/40 PASS (100%)**
- `node scratch/test_step07_child_tables.js` -> **46/46 PASS (100%)**
- `node scratch/test_step08_personal_data.js` -> **39/39 PASS (100%)**
- `npm run bundle` -> `WorkTree.html bundled successfully!` (474.322 bytes)

## 23. Files Modified
- `src/lib/supabase/repositories.js`: Bổ sung `PinRepository`, `StarRepository`, `SavedViewRepository`.
- `src/features/pins/services/pin-service.js`: Tạo mới PinService với validation giới hạn 100 pins, kiểm tra target duy nhất.
- `src/features/tasks/services/star-service.js`: Tạo mới StarService quản lý toggle/load sao.
- `src/features/tasks/index.js`: Xuất `StarService`.
- `src/features/saved-views/services/saved-view-service.js`: Tạo mới SavedViewService quản lý CRUD và validation giới hạn 20 views.
- `src/features/saved-views/index.js`: Xuất `SavedViewService`.
- `src/app/state.js`: Bổ sung `userPins`, `starredTaskIds`, `savedViews` vào `appState` và dọn dẹp trong `purgeTenantData()`.
- `src/app/app.js`: Tích hợp nạp song song dữ liệu cá nhân trong `loadWorkspaceData()`, guard cross-tenant, và expose services lên `window`.
- `js/core.js`: Tích hợp `StarService` vào `toggleFavorite()`, tích hợp `SavedViewService` vào `saveView()`, `loadView()`, `deleteView()`, bổ sung `clearTenantUI()` dọn dẹp bộ nhớ và DOM cá nhân.
- `js/access.js`: Tích hợp `PinService` vào `togglePin()`, `reorderPin()`, cập nhật `ownPins()` đọc từ `__worktree_cloud_pins`, vô hiệu hóa ghi LocalStorage trong `savePins()`.
- `WorkTree.html`: Bundle mới nhất đồng bộ toàn bộ thay đổi.
- `scratch/test_step08_personal_data.js`: Suite kiểm thử tự động 39 assertions.

## 24. Database Changes
- **Không thay đổi schema:** Schema hiện hành trong `supabase/migrations/20260909000000_worktree_multi_tenant_complete.sql` đã có đầy đủ 3 bảng `user_pins`, `task_stars`, `saved_views` với đầy đủ constraints, composite FKs, partial indexes và RLS policies.
- **Không có migration mới:** Không phát sinh thay đổi cấu trúc bảng nào.

## 25. Security Findings
- Toàn bộ truy vấn đọc và ghi dữ liệu cá nhân đều được bảo vệ nghiêm ngặt qua RLS với `user_id = auth.uid()` và `is_org_member(organization_id)`.
- Cross-user isolation: PASS. Không một người dùng nào có thể đọc hoặc sửa ghim, sao hay góc nhìn cá nhân của người khác.
- Cross-tenant isolation: PASS. Composite FK và RLS chặn đứng hoàn toàn việc ghim/sao tài nguyên từ tenant khác.
- Secret Scan: PASS. Không có secret key nào bị rò rỉ ra client bundle.

## 26. Known Limitations
- Giới hạn ghim: 100 pins tối đa theo quy tắc nghiệp vụ phía client (`PRODUCT LIMIT`), database không đặt hard limit số dòng trên mỗi user.
- Giới hạn saved views: 20 views tối đa theo quy tắc nghiệp vụ phía client (`PRODUCT LIMIT`).
- Supabase Realtime chưa được kết nối (thuộc Step 10), dữ liệu cá nhân được cập nhật theo mô hình request/response + refetch canonical snapshot.

## 27. Exit Criteria
- [x] pins Cloud
- [x] urgent pin Cloud
- [x] pin order Cloud
- [x] pins user-specific
- [x] pins tenant-specific
- [x] stars Cloud
- [x] stars user-specific
- [x] task.favorite no longer authority
- [x] saved views Cloud
- [x] saved views user-specific
- [x] saved views tenant-specific
- [x] reload persistence
- [x] multi-device persistence
- [x] workspace switch purge
- [x] logout purge
- [x] no stale tenant flash
- [x] UUID-safe matching
- [x] no duplicate pin controls
- [x] no LocalStorage personal authority
- [x] RLS unchanged (canonical schema verified)
- [x] no personal cross-user leak
- [x] no cross-tenant leak
- [x] Step 03 PASS
- [x] Step 04 PASS
- [x] Step 05 PASS
- [x] Step 06 PASS
- [x] Step 07 PASS
- [x] Desktop PASS
- [x] Mobile PASS
- [x] Dark mode PASS
- [x] Secret scan PASS
- [x] Build PASS

## 28. Recommendation for Step 09
- Tiếp tục bước tiếp theo: **Step 09 — Attachments & Storage (`task_attachments`)**.
- Tích hợp Supabase Storage Bucket `organization-attachments` với quy tắc phân quyền đường dẫn `{organization_id}/{task_id}/{file_name}`.

---

STEP 08 STATUS:
PASS

CLOUD PINS:
PASS

CLOUD STARS:
PASS

CLOUD SAVED VIEWS:
PASS

CROSS-USER PERSONAL DATA SECURITY:
PASS

CROSS-TENANT PERSONAL DATA SECURITY:
PASS

LOCAL PERSONAL DATA AUTHORITY DISABLED:
YES

MULTI-DEVICE PERSISTENCE:
PASS

READY FOR STEP 09 ATTACHMENTS:
YES
