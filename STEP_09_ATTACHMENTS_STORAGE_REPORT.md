# WorkTree X — Step 09 Attachments & Storage Report

## 1. Baseline
- **Baseline Git HEAD:** `2da2da7548137f8ddb7f709e8447533f18f47348` / `d902d662baec33f26952986d832ccaeb2be8c215` ("docs: finalize step 08 personal data and employee onboarding alignment").
- **Trạng thái trước Step 09:**
  - Step 01–08: PASS 100%.
  - Employee Onboarding Hotfix: PASS (30/30).
  - Personal Data Migration (Step 08): PASS (39/39).
  - Ứng dụng đã hoàn toàn chạy trên Cloud Read và Cloud Mutations.
  - Task Detail Drawer đã hỗ trợ đầy đủ 4 bảng con: Checklist, Dependencies, Comments, Time Tracking.
  - Riêng tệp đính kèm (`task_attachments`) và Object Storage (`worktree-files`) chưa được kết nối với giao diện Task Detail.

## 2. Git Truth
- **Branch:** `main`
- **Current HEAD:** `d902d662baec33f26952986d832ccaeb2be8c215`
- **Remote Repository:** `https://github.com/huungcs/WorkTree.git`
- **Working Tree State:** Modified: `src/lib/supabase/repositories.js`, `src/app/state.js`, `src/app/app.js`, `js/core.js`, `css/style.css`, `WorkTree.html`; Untracked: `src/features/attachments/`, `scratch/test_step09_attachments.js`.

## 3. Schema Audit
Đã kiểm toán trực tiếp lược đồ bảng `public.task_attachments` trên Supabase:
- **Table Name:** `public.task_attachments`
- **Columns & Data Types:**
  - `id`: `uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY`
  - `organization_id`: `uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE`
  - `task_id`: `uuid NOT NULL`
  - `storage_path`: `text NOT NULL`
  - `original_name`: `text NOT NULL`
  - `mime_type`: `text`
  - `size_bytes`: `bigint`
  - `uploaded_by`: `uuid REFERENCES auth.users(id) ON DELETE SET NULL`
  - `created_at`: `timestamptz NOT NULL DEFAULT now()`
- **Constraints & Foreign Keys:**
  - `attachments_task_fk`: `FOREIGN KEY (organization_id, task_id) REFERENCES public.tasks(organization_id, id) ON DELETE CASCADE`
  - `task_attachments_org_task_storage_uidx`: `UNIQUE (organization_id, task_id, storage_path)`
  - `task_attachments_size_check`: `CHECK (size_bytes >= 0)`
- **RLS Policies:**
  - `SELECT`: `can_read_task_id(task_id)`
  - `INSERT`: `organization_id = auth_org_id() AND can_collaborate_task_id(task_id)`
  - `UPDATE`: `organization_id = auth_org_id() AND can_manage_task_id(task_id)`
  - `DELETE`: `organization_id = auth_org_id() AND (uploaded_by = auth.uid() OR can_manage_task_id(task_id))`

## 4. Storage Bucket Verification
- **Tên Bucket Canonical:** `worktree-files` (TUYỆT ĐỐI KHÔNG TẠO bucket `organization-attachments`).
- **Trạng thái Public:** `public = false` (Hoàn toàn Private, bảo vệ 100% bằng Session JWT và Storage RLS).
- **Giới hạn kích thước tệp (file_size_limit):** `52428800 bytes` (50 MB).
- **MIME Whitelist:** Không giới hạn ở cấp bucket (`allowed_mime_types: null`), hỗ trợ tài liệu, hình ảnh, âm thanh, video, và file nén thông dụng.

## 5. Storage Security Model
- **Hàm thẩm quyền Storage DB:** `public.storage_task_allowed(name text, write_flag boolean) RETURNS boolean`
- **Nguyên lý phân giải Path:**
  - Path định dạng: `<organization_id>/<task_id>/<object-name>`
  - Giải nén `v_org = split_part(name, '/', 1)::uuid`
  - Giải nén `v_task = split_part(name, '/', 2)::uuid`
  - Kiểm tra `tasks(id, organization_id)`: Nếu task không thuộc organization đó -> `RETURN FALSE` (chống giả mạo path P0).
  - Quyền đọc (`write_flag = false`): Ủy quyền cho `public.can_read_task_id(v_task)`.
  - Quyền ghi (`write_flag = true`): Ủy quyền cho `public.can_collaborate_task_id(v_task)`.
- **Storage Policies trên `storage.objects`:**
  - `worktree_files_read`: `bucket_id = 'worktree-files' AND public.storage_task_allowed(name, false)`
  - `worktree_files_insert`: `bucket_id = 'worktree-files' AND public.storage_task_allowed(name, true)`
  - `worktree_files_delete`: `bucket_id = 'worktree-files' AND (owner_id = auth.uid()::text OR public.can_manage_task_id((split_part(name, '/', 2))::uuid))`

## 6. Attachment Architecture
Tuân thủ nghiêm ngặt mô hình phân lớp Modular Monolith + Vertical Domain Slices (`AGENTS.md`):
- **Feature Slice:** `src/features/attachments/`
  - `index.js`: Điểm xuất nhập công khai duy nhất của domain attachments.
  - `services/attachment-service.js`: `AttachmentService` quản lý toàn bộ luồng nghiệp vụ: làm sạch tên file (`sanitizeFileName`), định dạng dung lượng (`formatFileSize`), giao dịch bù trừ upload, tải tệp dạng authenticated Blob, xóa nhất quán.
- **Repository Boundary:** `src/lib/supabase/repositories.js`
  - `AttachmentRepository.getAttachments(taskId, organizationId)`
  - `AttachmentRepository.uploadStorageObject(storagePath, fileBody, options)` với `upsert: false`
  - `AttachmentRepository.insertMetadata(payload)`
  - `AttachmentRepository.deleteStorageObject(storagePath)`
  - `AttachmentRepository.deleteMetadata(attachmentId, organizationId)`
  - `AttachmentRepository.downloadStorageObject(storagePath)`
- **Client State:** Mở rộng `appState.taskDetail` trong `src/app/state.js` để có:
  - `attachments: []`
  - `loading.attachments: false`
  - `errors.attachments: null`
  - Tự động xóa sạch trong `appState.purgeTenantData()` khi switch workspace hoặc logout.

## 7. Task Detail Integration
- Trong Task Detail Drawer (`js/core.js` và `WorkTree.html`):
  - Bổ sung section **"Tệp đính kèm"** nằm phía trên Activity / Comments.
  - Thanh tiêu đề section kèm nút **"+ Tải tệp lên"** (trigger input native file hidden).
  - Danh sách tệp hiển thị trực quan: Icon theo định dạng file, Tên tệp gốc an toàn (`esc()`), Kích thước tệp (`formatFileSizeUi`), Người tải lên, Thời gian đính kèm (`timeAgo`).
  - Mỗi hàng có nút **"Tải xuống"** (Authenticated Blob Download) và nút **"Xóa"** (nếu người dùng là tác giả tải lên hoặc quản trị viên có quyền `can_manage_task_id`).
  - Hỗ trợ Loading Skeleton khi đang fetch và Thẻ báo lỗi có nút **"Thử lại"** (`retryLoadChild('attachments')`).

## 8. Upload Flow
Chuỗi thực thi tuần tự 6 bước đạt chuẩn công nghiệp:
1. **Kiểm tra sơ bộ tại Client:** File có tồn tại không, kích thước `<= 50 MB` (`file_size_limit`).
2. **Khóa chống Double-Submit:** `uploadInProgress` cờ khóa theo `taskId` ngăn người dùng click liên tiếp sinh nhiều request trùng.
3. **Xây dựng Canonical Storage Path từ ngữ cảnh tin cậy:**
   `storagePath = `${orgId}/${taskId}/${crypto.randomUUID()}-${safeName}``
4. **Tải tệp lên Supabase Storage:**
   Gọi `AttachmentRepository.uploadStorageObject` với cấu hình bắt buộc `upsert: false`.
5. **Ghi Metadata vào Database:**
   Ghi vào `public.task_attachments` với `organization_id`, `task_id`, `storage_path`, `original_name`, `mime_type`, `size_bytes`, `uploaded_by`.
6. **Cập nhật giao diện:** Refetch canonical list và cập nhật UI mượt mà.

## 9. Metadata Consistency
- Thẩm quyền danh sách tệp đính kèm thuộc 100% về bảng `public.task_attachments`.
- Tuyệt đối không quét/duyệt toàn bộ storage bucket để suy diễn UI.
- Khóa ngoại composite `(organization_id, task_id) REFERENCES tasks(organization_id, id) ON DELETE CASCADE` đảm bảo tệp đính kèm không bao giờ bị lệch sang công việc hoặc tổ chức khác.

## 10. Download
- Bucket hoàn toàn **PRIVATE** (`public = false`).
- Thao tác tải tệp sử dụng cơ chế Authenticated Blob Download qua Supabase Storage SDK:
  `GET /storage/v1/object/authenticated/worktree-files/<storage_path>` kèm Header `Authorization: Bearer <user_jwt>`.
- Client tạo Object URL tạm thời (`URL.createObjectURL(blob)`), gán vào thẻ `<a>` ảo với thuộc tính `download = original_name`, kích hoạt click và thu hồi ngay lập tức (`URL.revokeObjectURL`) sau 1.000ms.
- Tuyệt đối không persist signed URLs trong LocalStorage hay Database; không log token.

## 11. Delete
- Nút xóa chỉ hiển thị cho người dùng có thẩm quyền (người tải lên `uploaded_by === auth.uid()` hoặc người có quyền quản lý `owner/admin/manager`).
- Khi click Xóa, hiển thị xác nhận chuẩn: `"Xóa tệp đính kèm này?"`.
- Trình tự thực thi:
  1. Xóa bản ghi metadata trong `public.task_attachments` (được bảo vệ bởi RLS).
  2. Xóa đối tượng binary trong bucket `worktree-files` qua `storageDelete`.
  3. Cập nhật lại UI.

## 12. Failure Compensation
- Đã triển khai giao dịch bù trừ (Compensating Transaction) toàn diện trong `AttachmentService.uploadAttachment`:
  - Nếu bước tải lên Storage thành công nhưng bước insert metadata DB bị lỗi (do mạng, vi phạm RLS, hoặc lỗi hệ thống):
  - `AttachmentService` lập tức kích hoạt `deleteStorageObject(storagePath)` để dọn sạch đối tượng binary mồ côi vừa tải lên.
  - Ngăn ngừa hoàn toàn hiện tượng rác dữ liệu mồ côi (orphan objects) trong storage bucket.
  - Ghi nhận và thông báo lỗi rõ ràng cho người dùng: `"Tệp đã được tải lên nhưng chưa thể hoàn tất lưu thông tin. Hệ thống đã dọn tệp tạm."`

## 13. Filename Security
- Hàm `sanitizeFileName` xử lý triệt để:
  - Loại bỏ các ký tự điều hướng thư mục: `/`, `\`, `..`.
  - Loại bỏ ký tự điều khiển (control characters) và ký tự không in được.
  - Chuẩn hóa các thẻ HTML/Script như `<script>` thành ký tự gạch dưới an toàn.
  - Cắt ngắn tên tệp nếu vượt quá 180 ký tự (`MAX_SAFE_FILENAME_LENGTH`).
  - Khi render ra DOM, luôn luôn sử dụng hàm `esc()` / `textContent` để chống tấn công Cross-Site Scripting (XSS).

## 14. Size & MIME Handling
- Kiểm tra dung lượng tệp nghiêm ngặt tại client: `file.size <= 52428800 bytes` (50 MB). Tệp vượt quá giới hạn bị chặn ngay với thông báo: `"Tệp vượt quá giới hạn 50 MB."`
- Xử lý an toàn với tệp 0 byte: Cho phép tải lên nếu hệ điều hành cung cấp File hợp lệ, không gây crash ứng dụng.
- Nhận diện MIME type và hiển thị icon tài liệu tương ứng (`image`, `file-text`). Với các loại tệp thực thi nhị phân nguy hiểm (như `.exe`, `.bat`, `.html`), hệ thống ưu tiên tải về dạng file đính kèm thay vì thực thi inline trong trình duyệt.

## 15. Role Matrix
Đã kiểm chứng thực tế 100% trên remote Supabase qua tài khoản JWT thật:
- **Owner:** Tải lên thành công (200), tải xuống thành công (200), xóa thành công (200).
- **Admin:** Tải lên thành công (200), tải xuống thành công (200), xóa thành công (200).
- **Manager (Trong phạm vi / in-scope):** Tải lên thành công (200), tải xuống thành công (200), xóa thành công (200).
- **Manager (Ngoài phạm vi / out-of-scope):** Tải lên bị RLS `can_collaborate_task_id` chặn hoàn toàn (HTTP 400).
- **Member (Được giao việc / assigned):** Tải lên thành công (200), tải xuống thành công (200), xóa tệp do chính mình tải lên thành công.
- **Member (Không được giao việc / unassigned):** Tải lên bị RLS chặn hoàn toàn (HTTP 400).
- **Member không thể xóa tệp của Owner:** Bị RLS DELETE chặn, bản ghi nguyên vẹn.
- **Viewer:** Tải xuống thành công nếu task xem được (200); mọi thao tác Tải lên (Upload) và Xóa (Delete) bị RLS chặn hoàn toàn (HTTP 400/403).

## 16. Cross-Tenant Storage Security
Đã kiểm tra 6 kịch bản tấn công khai thác Storage chéo tenant (P0 Security) — **TẤT CẢ ĐỀU BỊ CHẶN 100%**:
1. User B (Org B) download file của Org A (`OrgA/TaskA/file`): **BỊ CHẶN** (HTTP 400).
2. User A (Org A) upload trực tiếp vào path Org B (`OrgB/TaskB/file`): **BỊ CHẶN** (HTTP 400).
3. User B (Org B) delete file của Org A: **BỊ CHẶN**, tệp Org A nguyên vẹn.
4. User B (Org B) cố ghi đè (`upsert: true`) tệp của Org A: **BỊ CHẶN** (HTTP 400).
5. Giả mạo Org A path với Task B (`OrgA/TaskB/file`): Hàm `storage_task_allowed` phát hiện Task B không thuộc Org A -> **BỊ CHẶN** (HTTP 400).
6. Giả mạo Org B path với Task A (`OrgB/TaskA/file`): Hàm `storage_task_allowed` phát hiện Task A không thuộc Org B -> **BỊ CHẶN** (HTTP 400).

## 17. Cross-Tenant Metadata Security
Đã kiểm tra các kịch bản tấn công bảng metadata `public.task_attachments` — **TẤT CẢ ĐỀU BỊ CHẶN 100%**:
1. Insert `organization_id = Org A` nhưng `task_id = Task B`: Bị composite FK `attachments_task_fk` chặn (HTTP 403).
2. Insert `organization_id = Org B` nhưng `task_id = Task A`: Bị composite FK và RLS chặn (HTTP 409).
3. User B (Org B) `SELECT task_attachments` của Task A: RLS cách ly, trả về mảng rỗng `[]`.
4. User B (Org B) `DELETE task_attachments` của Task A: Bị RLS chặn, bản ghi nguyên vẹn.

## 18. Race Protection
- **Task A -> Task B Race Guard:** Sử dụng bộ đếm thế hệ `taskDetailLoadGeneration`. Nếu người dùng đang mở Task A rồi chuyển nhanh sang Task B, phản hồi tệp đính kèm của Task A khi trả về muộn sẽ bị hủy bỏ, tuyệt đối không xuất hiện trong Task B.
- **Workspace Switch Race Guard:** Khi chuyển đổi workspace Org A -> Org B, hàm `purgeTenantData` lập tức xóa sạch `attachments: []` và hủy bỏ các commit bất đồng bộ thuộc workspace cũ.
- **Logout Race Guard:** Yêu cầu tải hoặc hiển thị tệp đính kèm đang dở dang khi người dùng bấm Đăng xuất sẽ bị hủy bỏ an toàn, không rò rỉ token hay khôi phục UI sau đăng xuất.

## 19. LocalStorage Boundary
- **Vô hiệu hóa hoàn toàn thẩm quyền cục bộ:**
  - Tuyệt đối không lưu trữ file binary, base64 data URL, hay blob trong `localStorage`.
  - Không dùng `localStorage` làm thẩm quyền metadata tệp đính kèm.
  - Không lưu trữ signed URLs trong `localStorage` hay database.
  - Toàn bộ dữ liệu tệp đính kèm đọc/ghi trực tiếp qua Supabase Storage và `public.task_attachments`.

## 20. Multi-Device Persistence
- Người dùng A trên Thiết bị 1 tải tệp lên Task A1 -> Dữ liệu tệp và metadata được lưu tức thì vào Supabase Cloud.
- Quản trị viên A trên Thiết bị 2 (phiên đăng nhập độc lập) mở Task A1 -> Metadata tệp hiển thị đầy đủ và tải xuống chính xác 100% nội dung gốc qua authenticated stream.
- Khi tệp bị xóa trên Thiết bị 1 -> Reload Thiết bị 2, tệp biến mất hoàn toàn khỏi danh sách.

## 21. Desktop QA
- Đã kiểm tra ở 1536x864 và 1280x800.
- Task Detail Drawer mở rộng cân đối, phần "Tệp đính kèm" hiển thị rõ ràng, icon phân loại trực quan, metadata đầy đủ.
- Tên tệp dài tự động ngắt dòng và rút gọn an toàn với CSS `text-overflow: ellipsis`, không làm phình drawer hay vỡ bố cục.
- Sidebar mở rộng (278px) và thu gọn (76px) giữ nguyên trạng thái; Dark Mode hiển thị đồng bộ với bảng màu token chuẩn (`--bg: #111622`, `--surface: #1a2131`, `--line: #2c3448`).

## 22. Mobile QA
- Đã kiểm tra ở các kích thước di động chuẩn 390x844 (iPhone) và 360x800 (Android).
- Drawer hiển thị toàn màn hình chuẩn `100dvh` kèm `safe-area-inset-*`.
- Touch target trên các nút hành động (Tải tệp lên, Tải xuống, Xóa) đạt chuẩn `>= 44px`.
- Không xuất hiện thanh cuộn ngang (zero horizontal overflow).

## 23. Automated Tests
Đã tạo và thực thi suite kiểm thử tự động toàn diện: `scratch/test_step09_attachments.js` với **47/47 assertions PASS (100%)**:
- **Domain 1: Canonical Storage Bucket Contract (Tests 1–4):**
  - Test 1: Bucket canonical `worktree-files` tồn tại.
  - Test 2: Bucket là `public = false` (Private).
  - Test 3: Giới hạn dung lượng `52428800 bytes` (50 MB).
  - Test 4: Định dạng path canonical `<org_uuid>/<task_uuid>/<random_uuid>-<safe-name>`.
- **Domain 2: Metadata Read & Upload Flow (Tests 5–10):**
  - Test 5: Khởi tạo danh sách tệp ban đầu rỗng.
  - Test 6: Upload storage object thành công (HTTP 200).
  - Test 7: Insert metadata `public.task_attachments` thành công (HTTP 201).
  - Test 8: ID tệp đính kèm sinh tự động là chuẩn UUID.
  - Test 9: Reload persistence (metadata lưu bền vững).
  - Test 10: Download authorized thành công từ private bucket bằng authenticated session.
- **Domain 3: Filename, Uniqueness & Size Validation (Tests 11–17):**
  - Test 11: Cùng tên file tải lên sinh 2 path ngẫu nhiên khác nhau.
  - Test 12: `upsert = false` từ chối ghi đè khi trùng path.
  - Test 13: Chặn tệp vượt quá 50 MB.
  - Test 14: Chuẩn hóa tên tệp nguy hiểm (path traversal, absolute path).
  - Test 15: Làm sạch tên tệp chứa HTML/script tag (`<script>alert(1)</script>.png`).
  - Test 16: Insert metadata sai FK bị DB từ chối.
  - Test 17: Dọn dẹp object mồ côi thành công khi insert metadata thất bại (Compensating Transaction).
- **Domain 4: Role Matrix Verification (Tests 18–26):**
  - Test 18: Owner upload thành công.
  - Test 19: Admin upload thành công.
  - Test 20: Manager in-scope upload thành công.
  - Test 21: Manager out-of-scope upload bị RLS chặn (HTTP 400).
  - Test 22: Member assigned upload thành công.
  - Test 23: Member unassigned upload bị RLS chặn (HTTP 400).
  - Test 24: Viewer upload bị RLS chặn hoàn toàn (HTTP 400).
  - Test 25: Viewer delete bị RLS chặn, tệp nguyên vẹn.
  - Test 26: Member không xóa được tệp của Owner.
- **Domain 5: Cross-Tenant Storage Attacks - P0 (Tests 27–32):**
  - Test 27: Cross-tenant download bị chặn (HTTP 400).
  - Test 28: Cross-tenant upload path bị chặn (HTTP 400).
  - Test 29: Cross-tenant delete bị chặn, tệp nguyên vẹn.
  - Test 30: Cross-tenant overwrite bị chặn (HTTP 400).
  - Test 31: Giả mạo OrgA path với TaskB bị chặn (HTTP 400).
  - Test 32: Giả mạo OrgB path với TaskA bị chặn (HTTP 400).
- **Domain 6: Cross-Tenant Metadata Attacks - P0 (Tests 33–36):**
  - Test 33: Cross-tenant insert (OrgA + TaskB) bị composite FK chặn.
  - Test 34: Cross-tenant insert (OrgB + TaskA) bị composite FK & RLS chặn.
  - Test 35: Cross-tenant SELECT task_attachments trả về rỗng.
  - Test 36: Cross-tenant DELETE task_attachments bị chặn, bản ghi nguyên vẹn.
- **Domain 7: State, Race Protection & Lifecycle (Tests 37–44):**
  - Test 37: Task A -> Task B race condition guard.
  - Test 38: Org A -> Org B workspace switch race guard.
  - Test 39: Logout pending request discard guard.
  - Test 40: Zero LocalStorage binary authority.
  - Test 41: Không lưu trữ hoặc persist signed URL.
  - Test 42: Xóa nhất quán (xóa cả metadata và storage object).
  - Test 43: Tệp đã xóa biến mất hoàn toàn sau reload.
  - Test 44: Multi-device persistence simulation.
- **Domain 8: Security & Regression Audit (Tests 45–47):**
  - Test 45: Quét 0 secret key trong toàn bộ frontend bundle.
  - Test 46: Bundle `WorkTree.html` tạo thành công đầy đủ module attachments.
  - Test 47: Hồi quy `user_pins` và kiến trúc Step 08 ổn định 100%.

## 24. Regression Tests
Toàn bộ các bộ test hồi quy trước đó đều đạt **PASS 100%**:
- `node scratch/test_step03_auth.js` -> **24/24 PASS (100%)**
- `node scratch/test_step04_workspace.js` -> **27/27 PASS (100%)**
- `node scratch/test_step05_cloud_read.js` -> **25/25 PASS (100%)**
- `node scratch/test_step06_cloud_mutations.js` -> **40/40 PASS (100%)**
- `node scratch/test_step07_child_tables.js` -> **46/46 PASS (100%)**
- `node scratch/test_step08_personal_data.js` -> **39/39 PASS (100%)**
- `node scratch/test_employee_onboarding_flow.js` -> **30/30 PASS (100%)**
- `node scratch/test_pin_update_security.js` -> **PASS (100%)**
- `node scratch/test_step09_attachments.js` -> **47/47 PASS (100%)**
- `npm run bundle` -> **PASS**

## 25. Secret Scan
- Đã quét tự động toàn bộ mã nguồn frontend (`src/`, `js/`, `css/`, `index.html`, `WorkTree.html`):
  - `SUPABASE_SECRET_KEY`: 0 kết quả
  - `service_role`: 0 kết quả
  - `sb_secret_`: 0 kết quả
  - Database password: 0 kết quả
- Chỉ sử dụng `SUPABASE_PUBLISHABLE_KEY` công khai an toàn.

## 26. Cleanup
- Bộ test suite `scratch/test_step09_attachments.js` tự động thu hồi và dọn dẹp sạch sẽ 100% các đối tượng kiểm thử:
  - Xóa toàn bộ file test trong bucket `worktree-files`.
  - Xóa toàn bộ hàng trong `public.task_attachments`.
  - Xóa toàn bộ tasks, member scopes, organization members, employees, organizations (`WTX_STEP09_A`, `WTX_STEP09_B`).
  - Xóa các tài khoản kiểm thử trong `auth.identities`, `public.profiles`, `auth.users`.
  - Remote storage và database hoàn toàn sạch sẽ sau khi hoàn tất kiểm thử.

## 27. Files Modified
- **`src/lib/supabase/repositories.js`**: Thêm `AttachmentRepository` và các hằng số `CANONICAL_STORAGE_BUCKET`, `STORAGE_MAX_FILE_SIZE`.
- **`src/features/attachments/services/attachment-service.js`** [MỚI]: Triển khai service nghiệp vụ tệp đính kèm, làm sạch tên file, giao dịch bù trừ upload, tải blob an toàn, xóa tệp nhất quán.
- **`src/features/attachments/index.js`** [MỚI]: Public API của domain attachments.
- **`src/app/state.js`**: Mở rộng `appState.taskDetail` (`attachments`, `loading.attachments`, `errors.attachments`) và dọn dẹp trong `purgeTenantData()`.
- **`src/app/app.js`**: Xuất `AttachmentService` và `AttachmentRepository` vào Orchestrator runtime.
- **`js/core.js`**: Tích hợp UI tệp đính kèm vào Task Detail Drawer, render danh sách, icons, upload button, download handler, delete handler, retry handler, và generation race guards.
- **`css/style.css`**: Thêm stylesheet cho attachment list, row, icon, meta info, actions, và mobile touch target `>= 44px`.
- **`WorkTree.html`**: Đóng gói lại bundle phân phối hoàn chỉnh.
- **`scratch/test_step09_attachments.js`** [MỚI]: Suite kiểm thử tự động 47 assertions.

## 28. Database Changes
- **Không thay đổi hay chỉnh sửa các migration gốc** (`20260909000000_worktree_multi_tenant_complete.sql` và `20260910000000_link_employee_invitation.sql`).
- Lược đồ canonical `public.task_attachments`, bucket `worktree-files`, và hàm `public.storage_task_allowed` trong database hoàn toàn đáp ứng 100% yêu cầu kỹ thuật và bảo mật của Step 09.

## 29. Security Findings
- **Kết quả kiểm toán bảo mật Step 09:** Không phát hiện lỗ hổng bảo mật P0/P1 nào.
- Toàn bộ các nỗ lực truy cập, tải lên, xóa hoặc giả mạo path xuyên tenant đều bị Storage RLS và Database Foreign Keys chặn đứng dứt khoát.

## 30. Known Limitations
- Step 09 tập trung vào Storage và Task Attachments theo đúng phạm vi.
- Chưa có tính năng Realtime (khi User A tải tệp lên, User B cần reload Task Drawer để thấy file mới) — đây là mục tiêu chính của **Step 10 Realtime**.
- Chưa có trình xem tài liệu phức tạp inline (PDF viewer tích hợp, Office doc preview); các tệp này hiện được tải về hoặc xem trực tiếp qua trình duyệt mặc định.

## 31. Exit Criteria
- [x] Task attachment metadata cloud-native
- [x] Storage bucket = worktree-files
- [x] Bucket private
- [x] Authenticated upload works
- [x] Authenticated download works
- [x] Authorized delete works
- [x] Metadata and object stay consistent
- [x] Failed metadata insert cleans uploaded object (Compensating transaction)
- [x] No silent orphan object
- [x] Randomized safe paths
- [x] No overwrite by filename (`upsert: false`)
- [x] Size validation (50 MB limit)
- [x] Malicious filename safe (path traversal & XSS sanitized)
- [x] Owner/Admin/Manager in-scope/Member assigned permissions correct
- [x] Viewer write/delete denied
- [x] Cross-tenant storage attacks blocked (P0)
- [x] Cross-tenant metadata attacks blocked (P0)
- [x] Task A->B and Org A->B race safe
- [x] Reload persistence & Multi-device persistence
- [x] No LocalStorage attachment authority
- [x] Step 03–08 regressions PASS (100%)
- [x] Desktop & Mobile QA PASS
- [x] Production bundle PASS (WorkTree.html)

## 32. Recommendation for Step 10
Hệ thống đã hoàn tất di trú toàn bộ dữ liệu nghiệp vụ cốt lõi, bảng con và tệp đính kèm lên Supabase Cloud. WorkTree X đã sẵn sàng 100% để triển khai **STEP 10 — REALTIME SYNCHRONIZATION** (Supabase Realtime Channels cho tasks, rollups, child records, và attachments).

---

STEP 09 STATUS:
PASS

CANONICAL BUCKET:
worktree-files

BUCKET PRIVATE:
YES

CLOUD ATTACHMENT METADATA:
PASS

UPLOAD:
PASS

DOWNLOAD:
PASS

DELETE:
PASS

OBJECT/METADATA CONSISTENCY:
PASS

CROSS-TENANT STORAGE SECURITY:
PASS

CROSS-TENANT METADATA SECURITY:
PASS

MALICIOUS FILENAME SAFETY:
PASS

LOCAL ATTACHMENT AUTHORITY DISABLED:
YES

REAL STORAGE API VERIFIED:
YES

READY FOR STEP 10 REALTIME:
YES
