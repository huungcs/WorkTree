# Đánh giá kỹ thuật WorkTree X — 04/10/2026

Phạm vi: checkout tại C:/Users/ASUS/Desktop/WorkTree, HEAD 574d1cb. Đối chiếu AGENTS.md, 21 migration, frontend legacy/module, API Node/Vercel, Edge Functions, test và tài liệu vận hành. Đây là đánh giá mã nguồn và kiểm chứng cục bộ; chưa xác minh schema/ACL hoặc cấu hình đang triển khai trên production.

**Kết luận: chưa đạt điều kiện phát hành SaaS nhiều khách hàng với dữ liệu thật.** Dự án có nền tảng dữ liệu và chức năng đáng giữ lại, nhưng các đường gọi SECURITY DEFINER và tích hợp Zalo đang phá vỡ ranh giới bảo mật được mô tả trong hợp đồng. Cần ưu tiên sửa bảo mật và kiểm thử có thể tái lập, sau đó tiếp tục tách feature từng bước.

Không thay đổi code sản phẩm, schema, dữ liệu nghiệp vụ hoặc credentials trong đợt đánh giá. Các thí nghiệm gửi tin đều dùng fetch/Supabase mock. Giá trị secret không được chép vào báo cáo.

## 1. Kết quả kiểm chứng

| Hạng mục | Kết quả thực tế |
| --- | --- |
| Check cú pháp | Pass 76 file JavaScript trong js/ và src/; script không bao phủ toàn bộ API/Edge TS |
| Check architecture | Pass 72 source files; còn 7 feature import app/state được allowlist |
| npm run check khi chưa chạy server | Fail 3 test Platform Admin với ECONNREFUSED cổng 8080; smoke chưa được chạy do chuỗi && dừng |
| npm run check sau khi khởi động server | Pass 32 test Node, không skip; HTTP smoke pass 13 route |
| HTTP file nhạy cảm trên server local | GET /.env và /.git/config đều trả 200; không xuất nội dung |
| API Zalo bằng mock | Request không Authorization vẫn tới bước gửi tin; webhook không chữ ký vẫn tới RPC pairing |
| API push bằng mock | Anonymous GET tới bước dispatch; upstream từ chối vẫn cập nhật job thành sent |
| TaskRepository bằng mock | PATCH canonical primary_assignee_id/due_date/start_date = null được serialize thành {} |
| Bundler trong VM, output giữ trong RAM | Chạy được nhưng HTML còn tham chiếu src/app/app.js và onboarding CSS ngoài file |
| SQL/RLS trên database thật | Chưa chạy; không có psql/Supabase CLI/Docker sẵn trong PATH và không thao tác DB cloud |
| E2E/visual/a11y thực tế | Chưa chạy; 4 file E2E chỉ có 8 khung test/comment, không có assertion hoặc thao tác browser |
| Production, tải lớn, dependency advisory | Chưa kiểm chứng |

Pass các test hiện có không chứng minh tenant isolation: nhiều test chỉ tìm chuỗi trong source, test visibility tự định nghĩa lại logic, SQL chưa nằm trong npm check, và E2E chưa triển khai.

## 2. Phát hiện bảo mật cần xử lý trước phát hành

### S01 — P0: RPC kiểm tra role không từ chối NULL, có đường vượt tenant

Bằng chứng:
- [create_invitation hiện hành](C:/Users/ASUS/Desktop/WorkTree/supabase/migrations/20260923120000_allow_managers_invite_scoped_members.sql:32).
- [set_member_role_and_scopes](C:/Users/ASUS/Desktop/WorkTree/supabase/migrations/20260909000000_worktree_multi_tenant_complete.sql:1797).
- [set_member_status](C:/Users/ASUS/Desktop/WorkTree/supabase/migrations/20260909000000_worktree_multi_tenant_complete.sql:1855).
- [revoke_invitation và revoke_employee_invitation](C:/Users/ASUS/Desktop/WorkTree/supabase/migrations/20260910161000_add_revoke_invitation_rpc.sql:18).

current_org_role trả NULL khi không có membership active hoặc organization không active. Điều kiện IF v_actor_role NOT IN (...) và v_actor_role <> 'owner' cũng trả NULL; PL/pgSQL không đi vào nhánh RAISE khi điều kiện không phải TRUE. Các hàm SECURITY DEFINER tiếp tục mutation bằng quyền owner của hàm.

Kịch bản từ code: tài khoản đã đăng nhập nhưng không thuộc tenant đích, biết organization/home-node hợp lệ, có thể đi qua kiểm tra create_invitation với role admin; người đang bị suspended có thể đi qua kiểm tra đổi role/status vì current_org_role trả NULL. Đây không phụ thuộc việc UI ẩn nút.

Độ chắc chắn: lỗi điều kiện xác nhận bằng đọc toàn bộ nhánh và migration kế tiếp; chưa thực thi trên DB. Cần migration mới dùng kiểm tra NULL rõ ràng hoặc biểu thức allowlist IS NOT TRUE, kiểm tra active organization/membership, và test trực tiếp RPC bằng UUID ở hai tenant cùng membership suspended. Không sửa lịch sử migration đã áp dụng.

### S02 — P0: Bot token được giao trực tiếp cho trình duyệt và đã nằm trong Git

[Frontend integration](C:/Users/ASUS/Desktop/WorkTree/src/features/integrations/services/zalo-bot-service.js:13) chứa DEFAULT_TOKEN; getToken trả token, payload gửi token về proxy và có đường gọi API trực tiếp. Token khác còn có trong [API gửi tin](C:/Users/ASUS/Desktop/WorkTree/api/zalo-send.js:7), webhook, server và script listener. Các file này được Git track. Module integration được import từ app runtime.

Ai tải frontend đều có thể đọc credential bot. Không kiểm tra token còn hoạt động để tránh dùng credential ngoài mục đích đánh giá. Cần xem các token này là đã lộ: rotate/revoke, chuyển vào secret phía server, bỏ direct fallback/browser token, mở rộng secret scan cho integration và artifact đầu ra. Xóa literal ở phiên bản mới không tự thu hồi token cũ trong lịch sử/cache.

### S03 — P0: Ghép Zalo bằng số điện thoại không xác minh chủ sở hữu, vượt tenant

[RPC pairing](C:/Users/ASUS/Desktop/WorkTree/supabase/migrations/20260913213000_add_employee_zalo_integration.sql:31) là SECURITY DEFINER, được [grant cho anon](C:/Users/ASUS/Desktop/WorkTree/supabase/migrations/20260913213000_add_employee_zalo_integration.sql:113), tìm nhân viên trên tất cả organization bằng phone rồi ghi đè zalo_chat_id. Không kiểm tra membership, tenant, OTP/challenge hoặc liên kết trước đó; trường hợp trùng số chọn employee cập nhật gần nhất. Kết quả trả tên, organization ID/name và employee ID.

Biết số điện thoại đủ để yêu cầu thay địa chỉ nhận thông báo và lấy metadata người/công ty. Webhook cũng không xác thực nguồn gửi trước khi gọi RPC; đường này đã kiểm chứng bằng mock. Cần thu hồi quyền gọi public/anon/authenticated không cần thiết, dùng challenge một lần gắn với user/employee/organization và xác thực webhook. Chỉ xác thực webhook không bảo vệ đường RPC công khai.

### S04 — P1: Server local phục vụ .env và Git metadata

[PUBLIC_DIR](C:/Users/ASUS/Desktop/WorkTree/server.js:6) là toàn repository. [Path guard](C:/Users/ASUS/Desktop/WorkTree/server.js:275) chỉ chặn thoát thư mục, không chặn dotfiles hoặc file backend. Đã kiểm chứng /.env và /.git/config trả 200.

Mặc định listen 127.0.0.1 nên chưa kết luận production đang lộ; rủi ro tăng mạnh nếu dùng tunnel/reverse proxy hoặc đem server này deploy. Cần public asset allowlist/thư mục build riêng và test deny .env, .git, backend/config. .gitignore không phải quy tắc HTTP.

### S05 — P1: Các endpoint tích hợp thực hiện hành động đặc quyền khi chưa xác thực

[api/zalo-send.js](C:/Users/ASUS/Desktop/WorkTree/api/zalo-send.js:28) nhận chatId/text tùy ý; không xác minh user, tenant hoặc người nhận. Mock xác nhận anonymous POST tới outbound send. [Webhook](C:/Users/ASUS/Desktop/WorkTree/api/zalo-webhook.js:198) tin payload đến từ bất kỳ caller. Server local còn mở set-webhook, delete-webhook và get-updates không có auth tại [server.js](C:/Users/ASUS/Desktop/WorkTree/server.js:165).

[api/push-dispatch.js](C:/Users/ASUS/Desktop/WorkTree/api/push-dispatch.js:36) dùng service role nhưng không xác thực request, kể cả GET. Khi đủ env, caller bên ngoài có thể kích hoạt xử lý queue. Test đang kiểm tra Edge dispatcher có auth, không kiểm tra API Vercel này.

Cần gate trên từng entrypoint, kiểm tra tenant/task/recipient ở server, tách chức năng quản trị bot, hạn chế rate và bỏ endpoint dư. CORS không thay authorization.

### S06 — P1: claim_notification_jobs thiếu REVOKE PUBLIC và không có kiểm tra caller

[RPC queue](C:/Users/ASUS/Desktop/WorkTree/supabase/migrations/20260910140000_notification_infrastructure.sql:228) là SECURITY DEFINER, trả toàn bộ row và đổi trạng thái job của mọi organization. Dòng 257 chỉ GRANT EXECUTE cho service_role; không thấy REVOKE PUBLIC hoặc thay default function privileges trong migration repository.

Với ACL mặc định PostgreSQL, thêm GRANT không loại quyền EXECUTE của PUBLIC. Điều này có thể cho caller không phải worker đọc/claim queue xuyên tenant và làm job mắc ở processing. Chưa xác minh ACL live; cần kiểm tra has_function_privilege cho anon/authenticated, REVOKE cụ thể và test denial. Không chạy RPC này trên production để thử vì nó có tác dụng ghi.

### S07 — P1: RLS đọc task rộng hơn chính sách member đang thể hiện ở UI/test

[Migration quyền đọc mới nhất](C:/Users/ASUS/Desktop/WorkTree/supabase/migrations/20260911170000_allow_member_read_assigned_tasks.sql:21) cho assignee đọc ngoài scope, nhưng nhánh ELSE TRUE còn cho member đọc task của người khác nằm trong scope. Trong khi [UI](C:/Users/ASUS/Desktop/WorkTree/js/access.js:78) và [test visibility](C:/Users/ASUS/Desktop/WorkTree/tests/task-visibility.test.js:89) vẫn giới hạn member vào task được giao.

Nếu ý định là mở ngoại lệ cho task được giao ngoài scope, nhánh SQL hiện tại mở rộng thêm quyền ngoài mục tiêu đó. API trực tiếp/rollup/child resources dựa can_read_task_id sẽ theo SQL. Cần chốt hợp đồng rõ ràng, nếu thay permission model phải có ADR/phê duyệt theo AGENTS; test cùng-scope/khác-assignee và ngoài-scope/đúng-assignee trên DB.

### S08 — P1: Thông báo trạng thái Zalo fallback gửi cho mọi employee có liên kết

[Recipient resolver](C:/Users/ASUS/Desktop/WorkTree/src/features/tasks/services/task-service.js:173) khi không tìm thấy manager có Zalo sẽ gửi mọi employee có zalo_chat_id trừ actor. Read model employee thường không mang role, nên fallback có khả năng xảy ra trong luồng bình thường. Nội dung task có thể gửi cho người không được giao task; API gửi tin không kiểm tra lại quyền của recipient.

Cần xác định recipients từ membership/scope của task ở server, không dùng fallback phát tán. Bộ test comment-recipient mới chỉ bảo vệ comment, chưa bao phủ status-recipient.

## 3. Lỗi chức năng và tính nhất quán dữ liệu

### F01 — P1: Push báo sent dù gửi thất bại; thiếu claim nguyên tử

[Dispatcher](C:/Users/ASUS/Desktop/WorkTree/api/push-dispatch.js:114) chỉ log khi OneSignal trả lỗi nhưng luôn UPDATE sent ở dòng 126. Mock upstream lỗi đã tái hiện. Endpoint SELECT pending rồi gửi, không claim bằng lock/idempotency; hai request đồng thời có thể xử lý cùng job.

Cần một đường dispatch thống nhất, claim nguyên tử, chỉ sent sau xác nhận thành công, phân biệt no-device/failed và retry có giới hạn. Dự án hiện có Edge dispatcher, Vercel dispatcher và trigger SQL gửi trực tiếp; cần kiểm thử tính tương tác giữa các đường này.

### F02 — P2: Xóa assignee/start/due bằng NULL không đến database

[TaskRepository.updateTask](C:/Users/ASUS/Desktop/WorkTree/src/lib/supabase/repositories.js:770) dùng chuỗi ?? để chọn alias. Khi canonical field được truyền null, nó rơi sang alias undefined; JSON bỏ field. Mock gọi xóa ba field cho payload {}. Cần chọn alias dựa trên sự hiện diện property, giữ null có chủ đích, thêm regression test và xác nhận UI sau reload.

### F03 — P2: Unlink Zalo gọi helper không có trong migration

[unlink_employee_zalo](C:/Users/ASUS/Desktop/WorkTree/supabase/migrations/20260913213000_add_employee_zalo_integration.sql:132) gọi public.has_org_role; không có định nghĩa helper này trong toàn bộ migration. Khi dựng DB chỉ từ repository, đường thực thi cho employee tồn tại sẽ lỗi. Membership branch cũng thiếu điều kiện active. Cần migration mới dùng helper hiện hành và test active/suspended/cross-tenant.

### F04 — P2: Realtime dependency đăng ký filter sai tên cột

[Realtime](C:/Users/ASUS/Desktop/WorkTree/src/features/realtime/services/realtime-service.js:297) dùng dependent_task_id, schema dùng depends_on_task_id. Kênh chi tiết có thể lỗi đăng ký hoặc không nhận đúng event. Cần test subscribe và dependency invalidation thực tế; chưa xác định biểu hiện cụ thể trên Realtime server live.

### F05 — P2: Không có phân trang đầy đủ ở các read model chính

[getTasks](C:/Users/ASUS/Desktop/WorkTree/src/lib/supabase/repositories.js:631), getNodes và getEmployees đọc một request rồi coi mảng trả về là toàn bộ dữ liệu. Không có cursor/range hoặc kiểm tra tổng số row. Khi tenant vượt giới hạn response của backend, danh sách và KPI dẫn xuất có nguy cơ thiếu dữ liệu; tăng giới hạn đơn thuần lại làm payload và render nặng.

Cần query phân trang, aggregate thống kê phía DB có RLS, test fixture vượt giới hạn row cấu hình. Chưa benchmark tải lớn hoặc đo thời gian render nên không kết luận một ngưỡng người dùng cụ thể.

## 4. Kiến trúc và khả năng bảo trì

**Điểm mạnh:** model phân biệt auth user, membership, employee, organization node; nhiều composite FK khóa tenant; task_rollups dùng security_invoker; storage kiểm tra cặp organization/task; các bảng lõi có RLS; Platform Admin xác minh JWT và platform_admins ở backend; mutations task có optimistic concurrency; workspace có purge và generation guard; đã có tài liệu legacy migration map.

**Thực tế triển khai:** modular monolith đang ở giữa quá trình chuyển đổi. src/app/app.js khoảng 1.238 dòng, js/core.js 4.289, js/access.js 2.215, repository tập trung 1.834, platform-admin-shell 2.832. Kích thước chỉ là chỉ báo; vấn đề chính là UI/domain/query/state nối qua window globals và load order. App orchestrator vẫn chứa mapping, repository orchestration và bridge lớn; 7 feature dùng trực tiếp appState.

Không cần rewrite hoặc đổi framework ngay. Nên làm theo [legacy migration map](C:/Users/ASUS/Desktop/WorkTree/docs/architecture/LEGACY_MIGRATION_MAP.md): một feature mỗi lần, inject tenant/session context, thu hẹp public API và xóa bridge khi đủ test. Check architecture hiện chưa chứng minh toàn bộ dependency contract; allowlist và regex chỉ bảo vệ một phần. Không có generated DB type được đưa vào quy trình kiểm tra, khiến lỗi tên cột/helper dễ lọt.

[Permission helper](C:/Users/ASUS/Desktop/WorkTree/src/lib/permissions/index.js:22) cũng chưa thống nhất SQL: canCreateTask cho mọi role khác viewer kể cả undefined; member task creation và manager node creation khác RLS; canUpdateTask so employee ID với currentUserId. Một số helper có thể chưa dùng ở runtime nên đây là nợ hợp đồng cần xử lý trước khi reuse, không phải bằng chứng frontend có thể tự vượt RLS.

## 5. UI, design system và accessibility

Source có nhiều phần đúng hợp đồng: Inter fallback, semantic colors light/dark, line icon stroke 1.7, focus-visible, desktop 278/76 với rule collapse cụ thể, mobile off-canvas, bottom nav 74 + safe area, 100dvh, 44px controls và reduced motion.

Chưa chứng nhận visual pass cho expanded/collapsed/light/dark/390/360, keyboard hoặc safe area trên thiết bị. Không có screenshot comparison hoặc browser journey đã chạy trong đợt này.

Các vấn đề từ source:
- [tokens.css](C:/Users/ASUS/Desktop/WorkTree/src/design-system/tokens.css:1) tồn tại nhưng entrypoint chỉ nạp css/style.css và onboarding.css; design-system/index.js chỉ export icons. Token bị sao chép ở stylesheet legacy và Platform Admin, khó giữ một nguồn chuẩn.
- [Platform Admin styles](C:/Users/ASUS/Desktop/WorkTree/src/features/platform-admin/ui/platform-admin-shell.js:415) chứa palette/gradient hardcode chưa gom vào token; CSS mobile còn rule nhãn nav 9px ở [style.css](C:/Users/ASUS/Desktop/WorkTree/css/style.css:1231).
- [Dialog primitive](C:/Users/ASUS/Desktop/WorkTree/src/components/ui/dialog.js:39) ghi chú có focus trap nhưng implementation không chuyển/trap/restore focus; listener Escape chỉ gỡ khi dùng Escape, không gỡ khi close button/backdrop; title ID cố định. Primitive hiện ít/không được reuse nên tác động runtime cần theo từng caller, nhưng chưa đủ an toàn để làm chuẩn mới.
- Các primitive Button/Badge ghép label vào innerHTML khi có icon. Không kết luận stored XSS đang khai thác được khi chưa chứng minh nguồn user data đi vào; nên dùng textContent cho label và test khi mở rộng reuse.

## 6. QA và release gate

Bốn E2E file là placeholder; không thấy browser runner/config/dependency hoặc workflow CI trong checkout. SQL có fixture hai tổ chức và nhiều kiểm tra hữu ích nhưng chưa được npm check gọi. Hai case T55/T56 tại [RLS suite](C:/Users/ASUS/Desktop/WorkTree/supabase/tests/rls/02_comprehensive_rls_isolation_test.sql:968) gọi set_member_role_and_scopes với 4 tham số trong khi hàm có 3, rồi bắt WHEN OTHERS. Case có thể báo denial do lỗi signature, không phải authorization.

Test visibility tự chép lại logic thay vì gọi implementation, nên không bắt được S07. Secret scan chỉ bao phủ vài pattern Supabase/OneSignal nên bỏ lọt Zalo token. Push contract test kiểm tra source Edge Function, không bảo vệ api/push-dispatch.js.

Ưu tiên: test API bằng mock deny-by-default; bootstrap server bằng ephemeral port trong suite; áp toàn bộ migration vào DB test dùng một lần; chạy direct RPC tests cho outsider/suspended/anon; thay catch-all bằng SQLSTATE mong đợi cùng positive control; triển khai E2E auth/workspace/invite/task và visual matrix theo AGENTS. Điều kiện release phải đo bằng test đã chạy, không theo tên file/report cũ.

## 7. Vận hành, triển khai và mức hoàn thiện SaaS

- README/package description vẫn mô tả Local-First, WebCrypto và chạy file trực tiếp, không phản ánh auth/cloud runtime hiện tại.
- Browser client hardcode Supabase project và CDN @2 không pin patch; tách staging/prod bằng env hiện chưa đầy đủ. Publishable key tự nó không phải secret; vấn đề là tách môi trường và tái lập phiên bản.
- Build là script inline legacy CSS/JS, không đóng gói toàn bộ module graph. Thí nghiệm giữ output trong RAM xác nhận WorkTree.html còn phụ thuộc module/CSS bên ngoài nên không thực sự standalone như README.
- [invite-employee](C:/Users/ASUS/Desktop/WorkTree/supabase/functions/invite-employee/index.ts:15) và [organization-onboarding](C:/Users/ASUS/Desktop/WorkTree/supabase/functions/organization-onboarding/index.ts:11) dùng service role không kiểm tra quyền caller trong handler. Luồng invite insert thiếu token_hash/invited_by bắt buộc. Các function này không thấy được frontend gọi; cần loại khỏi deployment hoặc hoàn thiện và kiểm thử, không coi là luồng đã sẵn sàng.
- [billing-webhook](C:/Users/ASUS/Desktop/WorkTree/supabase/functions/billing-webhook/index.ts:6) chỉ trả received:true; chưa verify signature, reconcile payment hoặc provision capacity. Billing feature chủ yếu đọc subscription. Chưa đủ bằng chứng hệ thống thu phí hoàn chỉnh.
- Backup/restore runbook chỉ có mô tả backup/pg_dump; thiếu restore drill, RPO/RTO, storage restore và xác minh dữ liệu sau phục hồi. Telemetry mới là console helper, không có bằng chứng quan sát vận hành/alerting đủ dùng.
- Không có local Supabase config/CI trong checkout để chứng minh dựng môi trường mới từ đầu một cách deterministic. Không kiểm chứng dashboard deployment, cloud secrets, backups hoặc lịch sử migration production.

## 8. Thứ tự xử lý và tiêu chí nghiệm thu

| Đợt | Công việc | Tiêu chí hoàn tất |
| --- | --- | --- |
| 1 — Khóa rủi ro đang lộ | S01–S06, rotate bot tokens, chặn private files, gate/disable endpoint dư | Anonymous/outsider/suspended bị từ chối ở API và DB; source/bundle không có bot secret; .env/.git trả 403/404 |
| 2 — Phục hồi tính đúng | S07–S08, F01–F04; migration mới và test hồi quy | Policy/UI thống nhất; recipient có quyền; failed push không sent; null PATCH giữ nguyên; unlink/realtime đúng |
| 3 — Release có thể tái lập | CI, SQL/RLS tests, E2E thực, staging, visual matrix, restore drill | Một lệnh kiểm tra tự chạy được; hai tenant và toàn bộ role pass; checklist có evidence |
| 4 — Mở rộng có kiểm soát | Phân trang/aggregate, tách feature/bridge, hợp nhất token, hoàn thiện billing/telemetry | Load test theo dữ liệu mục tiêu; giảm bridge; không drift visual; billing có reconciliation |

Khuyến nghị duy trì modular monolith, dùng feature slices đang có. Chưa nên ưu tiên thêm màn hình hoặc một cuộc rewrite lớn trước khi chặn các lỗi P0/P1.

## 9. Completion / giới hạn của đợt đánh giá

- Scope: chỉ đánh giá và viết báo cáo.
- Architecture impact: không sửa implementation.
- Database/RLS: không áp migration, không thực hiện mutation trên cloud; phát hiện SQL là kết luận source-level cần regression trên DB test.
- UI/design-system: đánh giá source; các mục desktop expanded/collapsed/light/dark, mobile 390/360/keyboard/safe-area chưa được verify bằng browser.
- Security: đã tái hiện local static-file exposure và mocked API failures; chưa xác nhận cross-tenant denied trên live DB; client chứa bot secret nên mục No secret in client không đạt.
- Tests: 32 Node + 13 HTTP routes pass khi có server; lần cold check fail 3 test vì thiếu server. Các probe bổ sung không gửi tin thật.
- Migration/rollback: không có schema/code migration trong audit; chỉ thêm tài liệu này.
- Known limitations: không kiểm thử production, không chạy SQL engine, không chạy full browser/visual/load testing, chưa kiểm tra dependency advisories. Truy cập tài liệu PostgreSQL online không thành công trong môi trường này; không dựa vào nguồn web chưa đọc để báo pass.

