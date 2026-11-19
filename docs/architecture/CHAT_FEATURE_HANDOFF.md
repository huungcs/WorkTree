# Đề xuất Chat WorkTree X và prompt bàn giao backend

Ngày: 18/11/2026. Trạng thái: chủ dự án đã đồng ý triển khai giao diện. Bản UI dùng dữ liệu minh họa đã có; backend/schema chat chưa triển khai trong phần việc này.

Tham khảo người dùng: https://fiine.pro/messages. Trang chuyển về đăng nhập trong phiên khảo sát; tài liệu này không khẳng định đã xem hoặc sao chép màn chat Fiine.

## 1. Phân công

- Agent giao diện: layout, navigation, component, state UI, mock adapter, accessibility, responsive, kiểm chứng light/dark và các kích thước quy định.
- Agent backend: schema/migration, RLS, RPC, Storage, Realtime, repository adapter thật, test bảo mật và tài liệu vận hành.

Nếu danh bạ cloud báo cần cập nhật, kiểm tra migration `20261119110000_add_internal_chat.sql` và bản vá `20261119131500_fix_chat_directory_employee_job_title.sql` trên cùng dự án Supabase. Bản vá đổi cột chức danh sang `employees.job_title` và giữ phạm vi doanh nghiệp cùng điều kiện thành viên đang hoạt động. Sau khi áp dụng, xác nhận bằng hai tài khoản đã kích hoạt trong cùng workspace.
- Dùng hợp đồng bên dưới làm điểm nối. Thay đổi hợp đồng phải được ghi lại trước khi ghép hai phần.
- Đây là feature slice trong modular monolith hiện tại; không đổi framework, auth hoặc các quyền task đang có.

## 2. Phạm vi giao diện đề xuất

### Điều hướng và desktop

- Mục “Tin nhắn” riêng trong sidebar, có badge tổng số hội thoại chưa đọc của công ty hiện tại.
- Giữ sidebar 278px/76px và topbar 70px. Vùng chat tận dụng phần nội dung còn lại.
- Vùng nội dung có danh sách hội thoại khoảng 300–320px và khung chat co giãn.
- Panel thông tin nhóm khoảng 300px chỉ mở khi cần. Khi không đủ chỗ, dùng drawer thay vì ép ba cột; phải tính cả sidebar đang mở.
- Không thay màn công việc hoặc nhét chat vào drawer chi tiết task hiện tại.

### Danh sách hội thoại

- Tìm theo tên người/nhóm; bộ lọc Tất cả, Chưa đọc, Nhóm.
- Nút soạn tin mới và tạo nhóm.
- Avatar, tên, tin cuối, thời gian, số chưa đọc, trạng thái ghim/tắt thông báo.
- Sắp xếp ghim cá nhân trước, tiếp theo theo hoạt động gần nhất; backend trả thứ tự có cursor.

### Khung chat

- Header hiển thị người/nhóm, số thành viên và nút thông tin.
- Tin của mình bên phải, tin người khác bên trái; nhóm có tên/avatar người gửi.
- Phân cách ngày, mốc chưa đọc, nút về tin mới nhất. Không kéo người đang đọc lịch sử xuống cuối khi có tin mới.
- Composer hỗ trợ nhiều dòng; desktop Enter gửi, Shift+Enter xuống dòng; không gửi khi đang IME composition. Mobile dùng nút gửi rõ ràng.
- Có trả lời một tin, emoji reaction, ảnh/tệp, liên kết công việc.
- Trạng thái gửi: đang gửi, đã được server lưu, gửi lỗi và thử lại. Không gọi “đã nhận” khi server chưa xác nhận giao đến thiết bị.
- Tin chỉnh sửa có nhãn; tin xóa hiển thị tombstone theo quyền backend. Nội dung người dùng render như text, không chèn HTML trực tiếp.

### Tạo và quản lý nhóm

- Dialog chọn người từ danh sách đủ điều kiện do backend trả, tìm theo tên/email được phép xem, chọn nhiều người và bỏ chọn.
- Nhập tên nhóm, mô tả tùy chọn; nút tạo có loading/error/retry.
- Người tạo trở thành chủ nhóm. Vai trò nhóm tách khỏi role organization.
- Bảng thông tin: thành viên, ảnh/tệp chung, tin ghim, đổi tên, thêm/xóa thành viên, chuyển chủ nhóm, rời nhóm; thao tác hiện theo capabilities backend.
- Phải chuyển quyền trước khi chủ nhóm rời nếu còn thành viên khác. Đóng/lưu trữ nhóm cuối cùng là thao tác riêng có xác nhận.

### Mobile

- Giữ breakpoint 900px. Danh sách → hội thoại → thông tin là các màn riêng, có quay lại và khôi phục vị trí cuộn.
- Đề xuất thêm lối vào Tin nhắn trên bottom navigation bằng cách đưa Ghim vào menu/sheet; thay đổi này cần chủ dự án duyệt trước khi sửa. Trong lúc chưa duyệt vẫn truy cập Tin nhắn từ menu hiện tại.
- Trong màn hội thoại, composer ở đáy và truy cập được khi bàn phím mở; tránh cạnh tranh không gian với bottom navigation.
- Dùng 100dvh, visualViewport khi cần, safe area và touch target tối thiểu 44px.

### State bắt buộc

- Loading skeleton, chưa có hội thoại, chưa chọn hội thoại, không có kết quả tìm kiếm.
- Đang tải lịch sử, hết lịch sử, gửi lỗi, tải tệp lỗi, mất kết nối và kết nối lại.
- Bị xóa khỏi nhóm, membership bị khóa, workspace vừa đổi, quyền vừa thay đổi.
- Draft chỉ nằm trong bộ nhớ và được khóa theo organization + user + conversation; purge khi logout/chuyển workspace.
- Mọi demo/mock có nhãn rõ, không trộn với dữ liệu cloud thật.

## 3. Thứ tự triển khai

1. Khung giao diện + mock adapter: danh sách, chat cá nhân/nhóm, tạo nhóm, thông tin nhóm, đầy đủ state.
2. Ghép backend: tin text, lịch sử phân trang, gửi lại không trùng, unread/read cursor, Realtime, quản lý nhóm.
3. Bổ sung ảnh/tệp, reply, reaction, tin ghim và chia sẻ task theo hợp đồng đã được bảo vệ bằng RLS.
4. Để sau: gọi thoại/video, ghi âm, bot AI, nhóm liên công ty, tự đồng bộ thành viên theo phòng ban. Không đưa nút hoạt động giả vào bản production.

## 4. Nguyên tắc quyền đề xuất cho feature mới

Các lựa chọn dưới đây cần được ghi trong ADR của chat trước khi rollout; chúng không sửa quyền task/nhân sự hiện tại.

- Hội thoại chỉ nằm trong một organization. Chỉ tài khoản có membership active mới tham gia; employee chưa có tài khoản không thể nhận tin.
- Danh bạ chọn người chỉ trả thành viên mà chính sách hiện hành cho phép người gọi phát hiện/liên hệ. Không mở rộng quyền đọc toàn bộ HR để phục vụ chat.
- Mọi role organization có thể chat/tạo nhóm trong tập người đủ điều kiện; owner/admin organization không mặc nhiên được đọc chat riêng của người khác.
- Chỉ thành viên active của hội thoại và organization active mới đọc/gửi/nhận event/tải tệp. Biết UUID không tạo ra quyền.
- Đề xuất cho nhóm nội bộ: thành viên mới được xem toàn bộ lịch sử khi tham gia; dialog thêm người phải thông báo điều này. Backend chỉ bật sau khi chủ dự án chấp thuận lựa chọn lịch sử này.
- Khi rời/bị xóa/khóa membership, mất quyền truy cập tiếp theo cả lịch sử, tìm kiếm, file và Realtime; UI đóng hội thoại và xóa cache liên quan. Dữ liệu đã tải về máy không thể thu hồi.
- Chỉ tác giả được sửa/xóa tin của mình trong bản đầu; group owner/admin quản lý nhóm và tin ghim, không sửa lời người khác. Mọi thao tác đều kiểm tra lại phía server.
- Đính task vào chat chỉ chia sẻ reference. Người đọc không có quyền task không nhận title, description, preview hoặc attachment của task đó. Không tự mở rộng scope task.

## 5. Hợp đồng adapter đề xuất

Các tên dưới đây là API JavaScript giữa hai agent, không bắt buộc là tên SQL. Dùng camelCase ở DTO; adapter backend chuyển từ schema database.

### Ngữ cảnh và DTO

- Context: `{ organizationId, userId, signal? }`. `userId` là ngữ cảnh UI, backend luôn lấy actor từ JWT/auth.uid(), không tin actor do client truyền.
- Conversation: `{ id, organizationId, type: 'direct'|'group', title, avatarPath, participantCount, lastMessage, unreadCount, pinned, muted, capabilities, updatedAt }`.
- Participant: `{ membershipId, userId, employeeId, displayName, avatarPath, groupRole: 'owner'|'admin'|'member', joinedAt }`.
- Message: `{ id, organizationId, conversationId, senderUserId, clientMessageId, kind: 'text'|'attachment'|'task_reference'|'system', text, replyToMessageId, taskReference, attachments, reactions, createdAt, editedAt, deletedAt }`.
- Task reference lưu ID; adapter chỉ trả preview sau khi xác minh quyền task của người đọc. System message chỉ được tạo bởi server.
- Attachment: `{ id, fileName, mimeType, sizeBytes, status }`; không trả URL public vĩnh viễn. Tên file không được dùng làm đường dẫn tin cậy.
- Gửi tin dùng UUID `clientMessageId` ổn định qua các lần retry. Message DTO của server là authoritative; UI giữ sending/failed riêng.
- Page: `{ items, nextCursor, hasMore }`. Cursor opaque; thứ tự server ổn định bằng timestamp + ID hoặc sequence tương đương.
- Capabilities là các boolean rõ ràng: `canSend`, `canRename`, `canAddMembers`, `canRemoveMembers`, `canTransferOwnership`, `canLeave`, `canPinMessages`. Chỉ hỗ trợ UI; server vẫn kiểm tra từng mutation.

### Các phương thức

```text
listConversations(context, { filter, query, cursor, limit }) -> Page<Conversation>
listEligibleParticipants(context, { query, cursor, limit }) -> Page<ParticipantCandidate>
getConversation(context, conversationId) -> { conversation, participants }
getOrCreateDirectConversation(context, targetMembershipId) -> Conversation
createGroup(context, { name, description, participantMembershipIds }) -> Conversation
updateGroup(context, conversationId, { name?, description? }) -> Conversation
addParticipants(context, conversationId, membershipIds) -> conversation detail
removeParticipant(context, conversationId, membershipId) -> conversation detail
transferOwnership(context, conversationId, membershipId) -> conversation detail
leaveConversation(context, conversationId) -> void
listMessages(context, conversationId, { beforeCursor, limit }) -> Page<Message>
sendMessage(context, conversationId, input) -> Message
editMessage(context, conversationId, messageId, { text, expectedEditedAt? }) -> Message
deleteMessage(context, conversationId, messageId) -> Message tombstone
markRead(context, conversationId, messageId) -> { unreadCount, lastReadMessageId }
setConversationPreferences(context, conversationId, { pinned?, muted? }) -> preferences
subscribe(context, handlers) -> async unsubscribe()
```

Các phương thức phase 3: `prepareUpload`, `completeUpload`, `getAttachmentDownloadUrl`, `toggleReaction`, `pinMessage`, `unpinMessage`, `listPinnedMessages`, `searchMessages`.

- `sendMessage` input chứa `clientMessageId`, `kind`, `text?`, `replyToMessageId?`, `attachmentIds?`, `taskId?`; tổ hợp field phải hợp lệ theo kind.
- Không đưa attachment UI lên production trước khi upload/finalize/download có kiểm tra quyền đầy đủ.
- Sự kiện subscribe: `conversationChanged`, `messagesChanged`, `readStateChanged`, `membershipRevoked`, `connectionChanged`. Dùng chúng để invalidation/refetch qua RLS, không phát payload chat vào channel organization mà mọi người có thể nghe.
- Không bắt buộc typing/presence ở phase 2. Nếu có phải scoped private channel, TTL ngắn và không suy diễn “online” từ một event cũ.
- Mã lỗi ổn định: `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `VALIDATION_ERROR`, `CONFLICT`, `RATE_LIMITED`, `NETWORK_ERROR`. Không phân biệt tồn tại tài nguyên cho caller không có quyền. UI không hiển thị SQL/JWT/stack.

## 6. Prompt giao agent backend

Copy nội dung khối sau cho agent làm backend. Agent giao diện sử dụng mục 2–5 và không sửa các file backend trong phạm vi được giao.

```text
Bạn phụ trách BACKEND/DATABASE cho feature chat của repository WorkTree X.

Đọc AGENTS.md trước; sau đó đọc docs/architecture/CHAT_FEATURE_HANDOFF.md,
migration hiện hành, docs/architecture/AUTHORIZATION.md,
MULTI_TENANCY.md, src/lib/supabase/client.js và repositories.js.

Phân công:
- Agent khác phụ trách toàn bộ giao diện, CSS, navigation và mock adapter.
- Chỉ sửa migration mới, tests backend, backend services/functions,
  src/features/chat/queries/, mutations/, services/backend-adapter.js,
  schemas/, types/ và tài liệu backend liên quan.
- Không sửa index.html, js/core.js, js/access.js, js/mobile.js, CSS,
  src/app/, UI components hoặc public index của chat nếu chưa phối hợp.
- Không overwrite thay đổi đang có của người dùng/agent giao diện.

Đầu ra:
1. Lập kế hoạch và ADR mô tả quyền chat, lịch sử khi thêm/xóa thành viên,
   quyền group owner/admin/member, before/after và rollout/rollback.
   Phân biệt đề xuất chưa được chủ dự án duyệt; không tự đổi role/scope,
   auth hoặc quyền task hiện có. Chưa áp migration lên cloud/production.
2. Đề xuất schema chat_conversations, chat_participants, chat_messages,
   preferences/read state; phase 3 có chat_attachments, reactions,
   message pins nếu cần. Không gắn chat vào task_comments.
3. Implement phase 2 theo adapter contract ở mục 5; đồng bộ DTO camelCase.
   Nếu tên/API cần đổi, ghi rõ trong contract trước khi ghép UI.
4. Thiết kế migration mới deterministic, không sửa lịch sử migration.
   Dữ liệu tenant phải có organization_id và composite FK cần thiết:
   participant, reply, attachment, reaction, pin, task reference không thể
   trỏ chéo tenant hoặc trỏ sang hội thoại khác trái phép.
5. RLS là authoritative cho mọi SELECT/INSERT/UPDATE/DELETE, kể cả view,
   search, last-message preview, unread count và Storage.
   Không coi frontend filter, organizationId hoặc route là bảo mật.
6. Actor lấy từ auth.uid(); mọi membership và organization phải active.
   Group role và tổ chức là hai loại quyền khác nhau. Organization admin
   không có backdoor đọc chat riêng. Danh bạ không leak HR ngoài quyền.
7. Conversation direct có đúng hai tài khoản active cùng tenant;
   get-or-create phải nguyên tử và không tạo trùng khi gọi đồng thời.
   Gửi tin idempotent theo actor + conversation + clientMessageId;
   retry không gửi thông báo hoặc tăng unread hai lần.
8. Kiểm tra NULL fail-closed trong mọi SECURITY DEFINER; search_path an toàn,
   REVOKE PUBLIC/anon mặc định và chỉ GRANT role thực sự cần.
   Tránh policy membership tự đệ quy; helper phải có guard đúng.
9. Tin nhắn phân trang có cursor và thứ tự ổn định. Read cursor không lùi,
   chỉ nhận message của đúng conversation mà caller được đọc.
   last-message/unread vẫn đúng khi sửa/xóa hoặc nhận event trùng thứ tự.
10. Realtime private theo conversation và user; kiểm tra quyền join và
    kiểm chứng thu hồi sau remove/leave/suspend. Không dựa vào việc client
    tự unsubscribe. Nếu Postgres Changes/private broadcast có giới hạn
    thu hồi, nêu cơ chế và cửa sổ còn hiệu lực rõ ràng.
11. Đường gửi notification kiểm tra lại người nhận còn quyền ở thời điểm
    dispatch, tôn trọng mute. Payload push mặc định không chứa nội dung
    chat nhạy cảm; không dùng fallback gửi mọi employee.
12. Phase 3: private bucket; organization/conversation/message guard cho
    upload, finalize và download. MIME/kích thước kiểm tra server; xử lý
    tệp mồ côi và signed URL TTL ngắn. Nêu rõ URL đã cấp còn hiệu lực đến
    hết TTL, không hứa thu hồi tức thì. Không public hóa attachment.
13. Task reference không mở rộng task scope; kiểm tra quyền từng người đọc
    trước khi trả preview. Reply/reaction không leak tin của nhóm khác.
14. Regenerate DB types bằng công cụ, không sửa generated type bằng tay.
    Không commit secret hoặc dùng service privilege cho request user thường.

Kiểm thử bắt buộc trên database local/test, ít nhất hai organization:
- Đủ owner/admin/manager/member/viewer; membership suspended/inactive.
- Người cùng organization nhưng ngoài conversation bị từ chối.
- Direct UUID attack; giả sender; thêm membership tenant khác; đổi
  conversation_id/organization_id; actor NULL; enum/field sai.
- Hai lời gọi tạo direct/gửi cùng clientMessageId đồng thời.
- Reply/attachment/reaction/pin chéo tenant và chéo conversation bị từ chối.
- Mới thêm thành viên theo history policy được duyệt; remove/leave/suspend
  chặn read/send/search/attachment/realtime; group owner cuối được bảo vệ.
- Nhóm admin không tự đọc task ngoài scope; unread cursor không lùi;
  phân trang không mất/trùng tin; retry không nhân notification.
- Anon/authenticated không gọi được RPC worker/trusted ngoài quyền.

Bàn giao: danh sách file, migration, cách chạy test, kết quả thật,
adapter đã triển khai, phần phase 3 chưa có, env chỉ tên biến,
rollout/rollback, và limitation. Không báo pass DB/RLS nếu chưa chạy.
```

## 7. Kiểm chứng và ghép giao diện

- Desktop expanded/collapsed, light/dark; vùng chat hẹp khi sidebar mở.
- Mobile 390px/360px; bàn phím, safe area, back navigation và không overflow.
- Dialog trap/restore focus, accessible names, focus-visible, reduced motion.
- Tin mới không cướp scroll/focus; lịch sử tải thêm giữ đúng vị trí; ảnh tải xong không đẩy người dùng khỏi đoạn đang đọc.
- Chuyển workspace/logout hủy request/subscription và purge dữ liệu/draft chat. Response cũ không được commit sang tenant mới.
- Gửi lỗi retry giữ clientMessageId; reconnect không trùng tin; revoked membership xóa màn và ngừng refetch.
- Chỉ bật adapter thật khi backend contract/security tests tương ứng pass; mock vẫn được dùng ở môi trường preview riêng.

## 8. Bàn giao sau khi triển khai UI

- Bản không cần đăng nhập: chạy `npm start`, mở `http://127.0.0.1:8080/chat-preview.html`.
- Entrypoint thật: `src/app/app.js` khởi tạo `mountChatFeature` từ public API `src/features/chat/index.js`, truyền context và subscription qua tham số. Không tạo thêm global service trên window.
- UI nằm ở `src/features/chat/components/chat-view.js`; CSS scoped ở `src/features/chat/styles/chat.css`; dữ liệu mẫu ở `services/mock-adapter.js`.
- Navigation dùng `#messages[/conversationId]`. Core phát `worktree:navigate` khi quay lại công việc; mobile phát `worktree:open-messages`. Ghim vẫn truy cập trong menu mobile.
- Có chat cá nhân/nhóm, tạo nhóm, thêm thành viên, đổi tên/mô tả, tìm tên/nội dung, bản nháp từng hội thoại, reply, reaction, ghim tin/hội thoại, tắt thông báo trong phiên mẫu.
- Adapter mẫu không gọi mạng, không dùng localStorage/IndexedDB, không đọc danh bạ/nhân sự thật. Reload xóa toàn bộ thay đổi mẫu.
- Danh bạ mẫu dùng ảnh chân dung minh họa. Mỗi người có thể chọn ảnh cho mình trong phiên mẫu bằng nút bên cạnh Tạo nhóm. Ảnh chỉ đọc trong trình duyệt và được giải phóng khi đổi workspace, đăng xuất hoặc tải lại trang. Lưu avatar hồ sơ thật và đồng bộ cho người khác cần tích hợp quy trình Profile/Storage riêng.
- Các label, thông báo lưu và màn chọn thành viên hiện được thiết kế cho preview. Khi adapter backend sẵn sàng, agent UI cần ghép adapter thật và chuyển các label sang chế độ thật; không chỉ đổi factory rồi đưa lên production.
- Phase 2 còn phải ghép pagination/filter server, Realtime/connection states và unread metadata thực tế. Bản mẫu hiện trả toàn bộ dataset nhỏ, không chứng minh hiệu năng dữ liệu lớn.
- Chưa có UI sửa/xóa tin, xóa thành viên, chuyển chủ nhóm/rời nhóm. Các phương thức tương ứng vẫn thuộc backend contract để hoàn thiện khi ghép phase 2.
- Attachment/task reference chưa được bật; không có nút tải file giả hoặc đường dẫn task giả. Reply/reaction/pin chỉ bật với backend khi các contract này đã được hỗ trợ và bảo vệ.
- Không thêm chat table, RLS hoặc Edge Function trong phần việc UI. Quyền chat trong mục 4 là đầu vào ADR/backend, không phải đảm bảo bảo mật của bản mock.
- Kiểm chứng chi tiết: `docs/qa/CHAT_UI_IMPLEMENTATION_REPORT.md`.

## 9. Bàn giao lưu ảnh hồ sơ

Giao diện Hồ sơ hỗ trợ chọn JPG, PNG hoặc WebP tối đa 5 MB, xem trước, hủy và lưu. Chỉ sau khi API báo thành công, ảnh mới xuất hiện trên hồ sơ, thanh điều hướng và tin nhắn của chính người dùng. Adapter frontend nằm ở `src/features/profile/services/avatar-adapter.js`.

Prompt cho agent backend:

```text
Đọc AGENTS.md và triển khai Supabase Edge Function profile-avatar cho ảnh hồ sơ.
Giữ hợp đồng của src/features/profile/services/avatar-adapter.js.

- POST JSON { action: "resolve" } trả { avatarUrl } cho hồ sơ của caller.
- POST multipart/form-data với action=save và file lưu ảnh của caller,
  cập nhật profiles.avatar_path và trả { avatarUrl }.
- avatarUrl là HTTPS signed URL cho ảnh trong bucket private. Chọn thời hạn
  phù hợp với phiên dùng, ghi rõ TTL và cách cấp lại. Dùng path mới khi thay
  ảnh để tránh cache cũ. Nếu hồ sơ chưa có ảnh, resolve trả 404.
- Xác minh JWT, suy ra chủ hồ sơ từ danh tính đó. Không nhận userId, tenant
  hoặc object path do browser tự chọn. Profile là dữ liệu cấp identity.
- Bucket riêng cho avatar, chỉ owner đọc/ghi qua policy, đường dẫn theo UID.
  Ưu tiên client chạy với JWT của caller. Kiểm tra kích thước tối đa 5 MiB,
  định dạng JPEG/PNG/WebP theo bytes và kích thước ảnh. Không cho SVG/HTML.
- Chỉ báo thành công sau khi ảnh và profile đã lưu. Xử lý file mồ côi khi
  bước cập nhật hồ sơ thất bại, và cập nhật đồng thời bằng cơ chế nhất quán.
- Thêm migration mới nếu cần. Kiểm thử caller A không sửa/đọc được ảnh
  private của B, anonymous bị chặn, file sai định dạng/kích thước bị chặn.
- Frontend hiện chỉ đọc ảnh của chính caller. Để đồng nghiệp thấy ảnh trong
  chat, trả signed URL qua RPC chat sau khi kiểm tra cùng tenant và quyền
  đọc hội thoại. Không mở rộng SELECT profiles cho toàn công ty.
- Bàn giao migration, cấu hình function, cách chạy test, TTL và rollout.
```

## 10. Tạo công việc từ tin nhắn

Trong workspace, người có quyền tạo công việc có thể mở form hiện có từ tin nhắn mẫu. Nút hiện khi rê chuột hoặc chuyển tiêu điểm vào tin nhắn. Trên thiết bị cảm ứng, nút luôn hiện. Form để trống tiêu đề, người phụ trách và hạn hoàn thành. Người tạo có thể xem tin gốc và chủ động đưa nội dung vào mô tả. Chỉ nội dung họ chọn lưu trong form đi qua luồng tạo công việc.

Sau khi tạo thành công, chi tiết công việc hiển thị “Xem tin nhắn gốc”. Liên kết mẫu chỉ nằm trong bộ nhớ của phiên, theo tài khoản và workspace. Tải lại, đổi workspace hoặc đăng xuất sẽ bỏ liên kết. Công việc vẫn được lưu qua luồng WorkTree X hiện có. Phần Bình luận tiếp tục là nơi trao đổi trực tiếp trong công việc.

Khi nối chat thật, agent backend cần mở rộng thao tác tạo công việc để lưu tham chiếu nguồn cùng giao dịch. Kiểm tra quyền tạo ở đơn vị đích và quyền đọc tin nhắn nguồn, cùng organization. Khi đọc task, chỉ trả tham chiếu nguồn nếu caller vẫn có quyền đọc hội thoại. Không tự chép nội dung chat, không gắn nội dung hoặc metadata tin nhắn vào notification/task preview khi chưa có quyền. Bổ sung kiểm thử rollback và cách ly giữa công ty. Gắn tin vào công việc có sẵn và đánh dấu nội dung đã thống nhất vẫn nằm ngoài bản này.
