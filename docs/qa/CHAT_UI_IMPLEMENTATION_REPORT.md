# Chat UI — Implementation report

Ngày: 18/11/2026. Phạm vi: giao diện và dữ liệu minh họa; không triển khai backend chat.

## Scope

- Thêm mục Tin nhắn trên sidebar và mobile bottom navigation; giữ Ghim trong menu mobile.
- Layout inbox/thread/info, chat cá nhân/nhóm, tạo nhóm, thêm người, sửa tên/mô tả.
- Tìm hội thoại, lọc unread/group, tìm nội dung, reply, emoji composer, reaction, ghim tin/hội thoại, mute.
- Draft in-memory theo organization/user/conversation; context mới hủy request, unsubscribe và purge dữ liệu.
- Bản xem trước độc lập ở `/chat-preview.html`; không cần auth, chỉ có dữ liệu giả.

## Architecture impact

- Feature mới dưới `src/features/chat/`, public API ở index.js.
- Tenant/session context được inject từ app; không import app/state vào feature.
- Không thêm window global. Navigation qua DOM custom event tại boundary legacy.
- Tiếp tục dùng primitive CSS `.btn`, `.icon-btn`, `.dialog`, `.field`, native dialog và icon hệ thống.
- Không thay framework hoặc dependency.

## Database / RLS

- Không có schema change, migration hoặc cloud mutation từ phần việc này.
- Adapter preview không phải security boundary. Test isolation của mock không thay cho SQL/RLS test thật.
- Prompt và contract backend: `docs/architecture/CHAT_FEATURE_HANDOFF.md`, mục 5, 6 và 8.

## UI / Design-system impact

- Mốc giờ và nhãn Tạo công việc dùng cùng cỡ chữ và chiều cao dòng. Đã đo hai nhãn cùng vị trí dọc trên desktop và ở 390px.
- Các ô tìm kiếm, soạn tin, tên nhóm và mô tả dùng viền focus 1px theo màu chủ đạo và quầng nhẹ 2px. Đã kiểm tra focus trên giao diện sáng, tối và ô soạn tin ở 390px.

- Dùng màu semantic hiện tại; không thêm font hoặc đổi primary/sidebar identity.
- Icon mới bổ sung vào `src/design-system/icons.js` theo line icon stroke 1.7.
- Desktop không đổi breakpoint hoặc 278/76px grid. Info panel là drawer khi vùng màn hình hẹp.
- Mobile dùng màn riêng inbox/thread/info, safe-area CSS, visualViewport và nút gửi riêng.
- Gửi Enter trên desktop, xuống dòng Enter trên mobile; Shift+Enter và IME được xử lý.

## Desktop verification

- [x] Expanded — browser đo grid `278px 1322px` ở CSS viewport 1600px.
- [x] Collapsed — browser đo grid `76px 1524px`; label sidebar ẩn, vùng nội dung mở rộng.
- [x] Light — kiểm tra trực quan inbox/thread/info và dialog tạo nhóm.
- [x] Dark — kiểm tra trực quan thread, composer, info và selected states.

## Mobile verification

- [x] 390px — browser đo `innerWidth=390`, không horizontal overflow; list và thread.
- [x] 360px — browser đo `innerWidth=360`, không horizontal overflow; header/composer/info.
- [x] Form và vùng nhìn thấp — thêm thành viên, footer truy cập được; viewport 360×625 và composer bottom 595.5px.
- [x] Enter mobile tạo newline và không tự gửi; nhấn nút gửi tạo đúng một tin.
- [x] Touch target — các nút thread nhìn thấy ở 390px không nhỏ hơn 44px.
- [ ] Bàn phím ảo trên iOS/Android thật — chưa có thiết bị; không kết luận pass.
- [ ] Safe area trên thiết bị có notch thật — CSS đã có, chưa xác minh phần cứng.

## Security

- [x] Không có network/storage/real directory access trong mock adapter.
- [x] Mock từ chối context khác organization/user, request bị abort và adapter đã dispose.
- [x] Message HTML payload hiển thị thành text; kiểm tra bằng browser với thẻ img/onerror không tạo ảnh/script.
- [x] Draft nhóm được khôi phục khi quay lại, không xuất hiện trong chat cá nhân khác.
- [ ] Cross-tenant RLS, role denial, Storage ACL và Realtime revoke thật — chờ agent backend.
- Không thêm secret vào client trong phần chat.

## Tests

- `npm run test:chat`: 7/7 pass. Bao phủ scoped preview, abort, idempotent send/event, direct reuse, validate/deduplicate group members, reply chéo conversation, DTO clone/dispose và nội dung markup literal.
- Syntax check trong lần chạy full: pass 83 file JavaScript; architecture: pass 79 source files. Số này gồm feature MCP được agent khác thêm song song.
- Các nhóm state/employees/checklists/visibility/notifications/Zalo/server: pass trong lần chạy full.
- `test:platform-admin`: chạy riêng, 6/6 pass; HTTP smoke: 13/13 route pass.
- `npm run check` lần khảo sát này không pass toàn bộ: dừng ở 2 test MCP thuộc thay đổi song song (`404 !== 200` ở zero-auth route và regex architecture khớp comment chứa app/state.js). Không sửa phần MCP trong task chat.
- Kiểm tra browser: tạo nhóm với hai người, gửi text, chọn hội thoại, thêm thành viên lên 7 người, không có kết quả search, restore draft, mobile newline, sidebar grid và light/dark.

## Migration / rollback

- Không cần DB migration cho preview UI.
- Rollback theo các thay đổi chat: import/init trong app.js, CSS/nav/root trong index.html, DOM navigation events và chat shortcut guard trong core.js, mục messages/menu pins trong mobile.js, icons và script test:chat; sau đó gỡ feature/preview/test chat.
- Không rollback file MCP/server/vercel/migration hoặc các thay đổi khác do agent song song thực hiện.

## Known limitations

- Không có gửi/nhận giữa tài khoản thật, lưu cloud, push chat, online/typing thật, upload hoặc task sharing.
- Chưa có sửa/xóa tin, xóa thành viên, chuyển chủ/rời nhóm. Không đưa các hành động giả vào UI.
- Data mẫu nhỏ; chưa xác minh pagination, load lớn, realtime reconnect hoặc out-of-order trên server thật.
- Error/retry/loading/revocation có nhánh UI nhưng chưa kiểm chứng bằng fault injection trên backend thật.
- Đã kiểm tra trực tiếp trong phiên workspace NTH GROUP 4 sau khi sửa xung đột giữa `window.history` và biến undo của legacy. Nút Tin nhắn mở hội thoại mẫu trên desktop và mobile 390px. Nút Tổng quan đóng chat và xóa hash. Chưa kiểm tra lại toàn bộ hành trình đăng nhập và chuyển công ty.
- Các nhãn preview được giữ cố ý. Ghép backend cần một vòng UI integration/QA trước khi bật cho dữ liệu thật.
