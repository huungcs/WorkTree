# WORKTREE X DESIGN SYSTEM — VISUAL IDENTITY & UX GOVERNANCE

**Tài liệu:** Design system baseline cho WorkTree X  
**Mục tiêu:** mọi agent/developer mở rộng cổng WorkTree X phải giữ đúng ngôn ngữ hình ảnh, desktop/mobile behavior và accessibility.  
**Baseline:** giao diện WorkTree X V8 Mobile + desktop sidebar fix hiện tại.

> Đây là **design governance**, không phải nơi chứa business logic. Token thực thi nên nằm ở `src/design-system/tokens.css`; file này giải thích ý nghĩa và quy tắc sử dụng.

---

# 1. Tính cách thương hiệu

WorkTree X cần tạo cảm giác:

- enterprise nhưng không nặng nề;
- yên tĩnh, tập trung, có thứ bậc;
- hiện đại nhưng không chạy theo hiệu ứng;
- tin cậy cho dữ liệu công ty;
- màu chủ đạo tím dịu kết hợp sidebar xanh đen;
- mint chỉ đóng vai trò dấu nhận diện/logo, không biến toàn UI thành màu xanh;
- trạng thái dùng màu semantic rõ và có nền soft.

Không hướng tới:
- neon;
- gradient quá nhiều;
- glassmorphism đậm;
- card bóng quá lớn;
- font trang trí;
- icon nhiều phong cách trộn lẫn;
- màu sắc tùy ý theo từng feature.

---

# 2. Typography

## Font family chuẩn

```css
:root {
  --font-sans: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

body {
  font-family: var(--font-sans);
}
```

### Quy tắc
- Inter là font ưu tiên.
- Fallback theo system font để tải nhanh và an toàn.
- Các trang nạp `src/design-system/typography.css` để dùng chung tệp Inter Variable trong `assets/fonts/` và các token chữ. Giữ thông báo bản quyền Inter đi kèm font.
- Dùng `--text-page-title`, `--text-dialog-title`, `--text-control` và `--text-entry` cho tiêu đề, điều khiển và ô nhập. `--text-entry` là 16px trên mobile để giữ chữ nhập liệu rõ và tránh phóng to khi lấy tiêu điểm.
- Không đổi family trong feature.
- Không dùng quá nhiều font-weight.
- Không dùng ALL CAPS cho nội dung dài.

## Scale khuyến nghị để chuẩn hóa codebase

> Các size dưới đây là token hóa từ ngôn ngữ hiện tại; agent có thể map dần mà không đổi cảm giác thị giác.

```css
--text-2xs: 9px;
--text-xs: 10px;
--text-sm: 11px;
--text-label: 12px;
--text-base: 13px;
--text-mobile-base: 14px;
--text-md: 16px;
--text-lg: 20px;
--text-xl: 24px;
--text-2xl: 28px;
--text-3xl: 31px;
```

Weight:
```css
--weight-regular: 400;
--weight-medium: 500;
--weight-semibold: 600;
--weight-strong: 650;
--weight-bold: 700;
--weight-brand: 750;
```

### Heading
- Đầu trang phân hệ bắt đầu bằng tiêu đề chính. Bỏ dải nhãn viết hoa và chấm trang trí phía trên tiêu đề. Dùng breadcrumb để thể hiện vị trí trong ứng dụng.
- Page title desktop baseline: khoảng `28px`, weight `700`, tracking âm nhẹ.
- Màn hình lớn có thể lên khoảng `31px`.
- Mobile page title khoảng `24–26px`.
- Section title thường `13px` và weight 650.
- Text body desktop thường 12–13px; mobile body khoảng 13–14px.

Không giảm chữ mobile xuống quá nhỏ để cố nhét dữ liệu.

Trong bảng chi tiết công việc, đặt nhãn phía trên ô người phụ trách và người liên quan. Dùng cùng thang chữ cho mô tả và checklist. Các trường trạng thái và ưu tiên có chung kích thước và viền focus. Mỗi liên kết phụ thuộc dùng một hàng, căn giữa biểu tượng, tên và nút gỡ. Trên mobile, hai ô người nằm cùng hàng, danh sách đầy đủ mở theo chiều rộng của hàng và nút thao tác có vùng chạm tối thiểu 44px.

---

# 3. Color System — Light

```css
:root {
  --bg: #f7f8fb;

  --surface: #ffffff;
  --surface-2: #f9fafc;
  --surface-3: #f1f3f8;

  --text: #20283d;
  --muted: #65728a;
  --subtle: #64718a;

  --line: #e8ebf2;
  --line-strong: #d8deea;

  --primary: #6962db;
  --primary-hover: #5851c4;
  --primary-soft: #eeecfc;
  --primary-text: #6256ca;

  --green: #107353;
  --green-soft: #e8f5ef;

  --amber: #93540c;
  --amber-soft: #fcf3df;

  --red: #ae3a4a;
  --red-soft: #fcecef;

  --blue: #356ca5;
  --blue-soft: #eaf2fc;

  --purple: #865db2;
  --purple-soft: #f2eaf9;

  --sidebar: #141c2e;
  --sidebar-muted: #96a3bf;
  --sidebar-text: #e2e7f3;
  --sidebar-line: rgba(186, 201, 238, .1);

  --focus: #8a7fec;
}
```

---

# 4. Color System — Dark

```css
html[data-theme="dark"] {
  --bg: #111622;

  --surface: #1a2131;
  --surface-2: #20283a;
  --surface-3: #252e43;

  --text: #e6eaf3;
  --muted: #a0acc4;
  --subtle: #a6b2ca;

  --line: #2c3448;
  --line-strong: #424d68;

  --primary: #8d82f1;
  --primary-hover: #9d93fc;
  --primary-soft: #302c4e;
  --primary-text: #b5aafb;

  --green: #73d6b4;
  --green-soft: #1c3a34;

  --amber: #e9bd72;
  --amber-soft: #3e3424;

  --red: #f28f9c;
  --red-soft: #432834;

  --blue: #8bbcf0;
  --blue-soft: #25384e;

  --purple: #c5a0e7;
  --purple-soft: #392d4a;

  --sidebar: #0d1423;
  --sidebar-muted: #98a8c5;
  --sidebar-text: #e2e8f5;
}
```

### Quy tắc semantic
- Success/complete/healthy → green.
- Warning/near due/waiting → amber.
- Error/destructive/urgent risk → red.
- Informational/doing → blue.
- Brand/selection/focus → primary purple.
- Purple semantic phụ chỉ dùng khi cần phân biệt category/role.

Không lấy màu semantic làm màu decoration vô nghĩa.

---

# 5. Brand Mark

Baseline hiện tại:

```text
Container background: #c1f0d6
Foreground/icon:       #1c594b
Border radius:         10px
Size desktop baseline: 33px
```

Brand mark đặt trên sidebar tối tạo tương phản nhận diện.

Không:
- đổi sang logo gradient;
- đổi màu logo theo primary purple;
- tự thêm glow;
- thay icon khác phong cách mà chưa duyệt.

Nếu có logo chính thức mới, asset phải lưu trong:
```text
public/brand/logos/
```
và cập nhật file này + `AGENTS.md`.

---

# 6. Surface, Radius & Shadow

## Radius
Baseline:
```css
--radius: 14px;
```

Pattern:
- common button/input: khoảng `6–9px`;
- panel/card: `14px`;
- dialog: khoảng `17px`;
- mobile controls quan trọng có thể `10–13px`;
- nhãn trạng thái, phân loại và thông tin ngắn dùng `--radius-badge` (5px).
- chip có thao tác dùng `--radius-md` (8px). Hình viên thuốc dùng cho các thành phần có hình dạng riêng như công tắc và thanh tiến độ.

Không tạo ngẫu nhiên 18 kiểu radius.

Khuyến nghị token hóa:

```css
--radius-xs: 5px;
--radius-badge: var(--radius-xs);
--radius-sm: 7px;
--radius-md: 8px;
--radius-lg: 10px;
--radius-panel: 14px;
--radius-dialog: 17px;
--radius-pill: 999px;
```

## Shadow
Baseline:
```css
--shadow: 0 3px 15px rgba(23,35,70,.025);
--shadow-lg: 0 24px 90px rgba(14,22,46,.2);
```

Dark:
```css
--shadow: 0 3px 18px rgba(0,0,0,.07);
--shadow-lg: 0 24px 90px rgba(0,0,0,.4);
```

Shadow phải nhẹ. Hierarchy chủ yếu đến từ border/surface/spacing.

---

# 7. Layout Contract

## Desktop

Boundary:
```text
>= 901 CSS px
```

### Sidebar
```text
Expanded:  278px
Collapsed: 76px
```

Collapse phải thay đổi grid width thật:
```css
.app {
  grid-template-columns: var(--side-width) minmax(0, 1fr);
}
```

State collapsed phải đặt `--side-width: 76px`.

Không viết media query muộn hơn làm hardcode `278px` trực tiếp lên `grid-template-columns` và phá collapsed state.

### Topbar
Baseline:
```text
height: 70px
background: surface
border-bottom: line
sticky top
```

### Content
Trên màn hình rộng, content có padding lớn hơn; trên laptop giảm padding nhưng không bó chữ.

---

# 8. Sidebar Identity

Sidebar:
```css
background: var(--sidebar);
color: var(--sidebar-text);
```

Nav item:
- trạng thái bình thường: `sidebar-muted`;
- hover: nền trắng alpha rất nhẹ;
- active: nền tím/indigo tối `#2b2d49` theo baseline;
- icon active: tím nhạt;
- không dùng gradient lớn.

Tree:
- indentation rõ;
- row phải có hover/focus;
- tên dài ellipsis trên desktop, wrap hợp lý trên mobile;
- count nhỏ, không cạnh tranh với label;
- trên desktop có chuột, nút thêm đơn vị con và ghim chỉ chiếm chỗ khi rê chuột hoặc điều hướng bằng bàn phím;
- trên màn hình cảm ứng, các nút luôn hiển thị và có vùng chạm tối thiểu 44px.

Collapsed:
- chỉ giữ icon/brand mark/action chính;
- tooltip/accessibility label vẫn phải tồn tại;
- content area mở rộng theo width mới.

---

# 9. Button System

Baseline common:
```text
min-height: 36px
border-radius: 8px
font-size: khoảng 11–12px desktop
```

Variants:
- `default`: surface + line-strong.
- `primary`: primary + white/light readable text.
- `soft`: primary-soft + primary-text.
- `danger`: red-soft + red.
- `text`: transparent + muted/primary hover.
- `icon`: square touch target tương ứng context.

### Rule
Không tạo:
```css
.feature-x-button { background:#6f5dfb; ... }
```

Hãy dùng:
```tsx
<Button variant="primary" />
```

Nếu chưa có variant, thêm vào primitive và document.

---

# 10. Panel / Card

Baseline:

```css
.panel {
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: var(--surface);
  box-shadow: var(--shadow);
}
```

Panel heading:
- padding thoáng;
- title khoảng 13px/650;
- secondary text muted;
- action không chiếm nhiều visual weight.

Không đặt box-shadow lớn trên mọi card.

---

# 11. Dialog / Drawer / Sheet

Desktop dialog baseline:
```text
width phổ biến: khoảng 660px
radius: khoảng 17px
border: line
background: surface
shadow: shadow-lg
backdrop: dark transparent + blur nhẹ
```

Dialog gồm:
1. fixed head;
2. scrollable body;
3. fixed/sticky foot.

Mobile:
- width gần/full viewport;
- safe area;
- body scroll riêng;
- footer action luôn có thể truy cập;
- keyboard không che nút Save.

Drawer:
- dùng cho task detail/secondary editing;
- mobile có thể chuyển fullscreen sheet nếu trải nghiệm tốt hơn;
- không chồng nhiều modal sâu.

---

Trên điện thoại, hai ô Người phụ trách và Người liên quan nằm cùng hàng. Ô Người liên quan hiển thị tối đa hai avatar và tổng số người. Chạm vào ô để xem danh sách, ưu tiên người đã được chọn. Trên điện thoại, danh sách mở rộng bằng cả hàng và cuộn riêng khi có nhiều người.

### Biểu mẫu công việc

Khi tạo việc từ tin nhắn, Tin nhắn gốc mặc định thu gọn. Nội dung nguồn, các trường được gợi ý và nút chèn chỉ xuất hiện khi mở khối này. Sau khi chèn, biểu mẫu đưa focus về mô tả.

Tóm tắt AI mở từ thanh công cụ hội thoại. Khi đủ rộng, bảng nằm bên phải lịch sử tin nhắn. Trên màn hình hẹp, bảng nổi trong vùng đọc và cuộn riêng, để tin ghim và ô soạn luôn trong tầm tay. Gợi ý cập nhật khi nội dung hội thoại thay đổi. Biểu tượng dấu cộng trên từng gợi ý mở biểu mẫu tạo công việc từ tin nhắn tương ứng.

Ô nhập và bộ chọn dùng cùng kiểu chữ, viền focus và góc bo như bảng chi tiết. Chiều cao tối thiểu là 44px trên desktop và 48px trên điện thoại.

Trên điện thoại, ngày bắt đầu và hạn hoàn thành nằm ở phần chính. Thông tin bổ sung mở bên dưới và thứ tự Tab đi theo thứ tự hiển thị. Chân biểu mẫu hiển thị nơi lưu tương ứng với không gian làm việc hiện tại.

---

### Biểu mẫu đơn vị

Bộ chọn đơn vị cấp trên mở toàn chiều rộng ngay dưới ô đã chọn. Nội dung dùng chung thanh cuộn của biểu mẫu để giữ nút lưu và hủy luôn truy cập được. Tên đơn vị dài được xuống dòng trong danh sách.

---

### Biểu mẫu nhân sự

Bộ chọn Đơn vị công tác dùng cây có tìm kiếm và lọc theo loại đơn vị. Danh sách mở toàn chiều rộng bên dưới ô chọn và cuộn cùng biểu mẫu.

### Vai trò và phạm vi truy cập

Khối phạm vi hiện tại cách các thẻ vai trò 16px. Bảng quyền căn giữa nội dung từng vai trò và cuộn ngang trong khung riêng trên màn hình hẹp.

### Bộ lọc chu kỳ công việc

Số việc đã hoàn thành bị ẩn hiển thị dưới dạng nút đếm ghép vào bộ chọn chu kỳ. Bấm vào số việc để chuyển sang Tất cả lịch sử. Chỉ hiển thị liên kết khi có việc bị ẩn.

### Tiêu đề phân hệ

Công việc, Tin nhắn và Quản trị & Cài đặt dùng khoảng đệm 18px dưới thanh trên cùng trên desktop và 16px trên điện thoại. Trang Công việc và Quản trị & Cài đặt dùng tiêu đề tối đa 28px trên desktop. Tin nhắn đưa nút icon Tạo nhóm cạnh Tin nhắn mới trong đầu danh sách hội thoại để dành chỗ cho nội dung. Trong trang công việc, mô tả nằm sát tiêu đề và cách đường dẫn phạm vi 16px.

### Nhật ký tài khoản

Trong workspace đám mây, Chủ sở hữu và Quản trị viên xem tối đa 50 sự kiện bảo mật gần nhất. Nhật ký có trạng thái tải, trống, lỗi và nút làm mới. Các hàng hiển thị thao tác, người thực hiện khi xác định được và thời điểm.

### Thông báo và nhắc việc

Quản trị & Cài đặt có tab Thông báo & Nhắc việc cho các tùy chọn cá nhân và lịch nhắc. Lối tắt trong trung tâm thông báo mở trực tiếp tab này.

### Việc định kỳ

Tab Việc định kỳ nhóm biểu mẫu thành Phân công, Lịch lặp và Nội dung công việc; bộ chọn đơn vị và nhân sự dùng chung Tree Node Picker (`.node-picker-box`) và Employee Avatar Picker (`.owner-picker-box`), đồng bộ đầy đủ token bo tròn `--radius-*` trong `css/style.css`. Mỗi quy tắc hiển thị đối tượng nhận, chu kỳ và trạng thái. Lịch sử tạo việc mở theo yêu cầu. Bản demo dùng quy tắc minh họa có sẵn ở chế độ chỉ xem.

Hộp thoại Báo cáo hôm nay hiển thị trạng thái tiến độ, danh sách việc và kết quả theo thứ tự cập nhật. Số việc đã chọn và số phút cập nhật ngay khi nhập. Nút gửi nằm ở chân hộp thoại, phần biểu mẫu cuộn riêng trên điện thoại.

### Chia sẻ công việc

Hộp thoại dùng tiêu đề cố định và hiển thị tên công việc bên dưới. Phần quyền người nhận và danh sách liên kết cuộn chung. Chân hộp thoại giữ nút tạo liên kết trong tầm chạm. Trên điện thoại, thời hạn và mã PIN xếp dọc. Liên kết đã thu hồi chỉ hiển thị thông tin trạng thái.

Trang dành cho người nhận dùng nhận diện WorkTree X, font Inter và màu trạng thái của hệ thống. Trên màn hình hẹp, đầu trang giữ logo, thông tin tổ chức và nút đổi giao diện trên cùng một hàng. Quyền của người nhận nằm cạnh trạng thái công việc. Thông tin công việc xếp bốn cột trên màn hình rộng và hai cột trên điện thoại. Checklist dùng dấu trạng thái ở chế độ chỉ xem và ô đánh dấu khi liên kết cho phép chỉnh sửa.

### Trợ lý AI và kết nối MCP

Trong bảng chi tiết công việc, Gợi ý checklist và Tóm tắt công việc dùng nút phụ gọn. Kết quả mở ngay bên dưới và chuyển focus vào tiêu đề để người dùng bàn phím đọc được nội dung.

Trợ lý AI mở bên phải trên desktop và cho phép thao tác với phần còn lại của workspace. Trên điện thoại, Trợ lý AI chiếm toàn màn hình. Khi màn hình thấp, các gợi ý nằm trên một hàng cuộn ngang để dành chỗ đọc hội thoại. Cả hai bố cục đều dùng nền trang rõ nét. Nút Gửi nằm trong cùng khung với ô nhập, ở góc dưới bên phải. Trợ lý AI và Bản tin điều hành dùng tiêu đề ngắn, với tên workspace hoặc phạm vi bên dưới. Form MCP dùng cỡ chữ và viền focus của hệ thống. Lựa chọn quyền có trạng thái focus trên toàn thẻ và ô nhập trên điện thoại dùng cỡ chữ nhập liệu chung.

### Bản demo công khai

Avatar trên thanh trên cùng mở danh sách vai trò mẫu. Vai trò đang xem được đánh dấu trong danh sách. Workspace mẫu duy nhất là NTH GROUP. Khách có thể thử thao tác với dữ liệu minh họa trong phiên, sau khi tải lại demo sẽ trở về vai trò Chủ sở hữu và dữ liệu ban đầu. Ngày của các công việc mẫu được tính theo ngày mở demo để biểu đồ Tiến độ có dữ liệu trong khoảng xem mặc định. Một công việc đã hoàn thành vẫn nằm trong lịch sử.

---

# 12. Mobile UX Contract

Boundary:
```text
<= 900 CSS px
```

## Navigation
Bottom nav:
```text
height: khoảng 74px + safe-area-bottom
5 slots
fixed bottom
surface background
top border
subtle shadow
```

Active:
```text
color: primary-text
background: primary-soft
```

Create action có thể dùng primary emphasized icon.

## Touch
- Topbar icon: khoảng 44px.
- Nav/tree/action quan trọng: 44–48px.
- Không phụ thuộc hover.
- Action ẩn trên desktop hover phải luôn discoverable trên touch.

## Sidebar mobile
- off-canvas;
- width tối đa khoảng 390px nhưng không vượt viewport;
- full dynamic viewport height;
- backdrop/scrim;
- body lock khi menu mở.

## Data
Không ép bảng desktop 9 cột vào 360px.
Ưu tiên:
- card;
- stacked metadata;
- progressive disclosure;
- bottom sheet filter;
- select/status trực tiếp trên card khi hữu ích.

## Keyboard
- theo dõi visual viewport khi cần;
- bottom nav có thể ẩn lúc keyboard/modal;
- footer dialog giữ reachable;
- không để `position: fixed` che input đang focus.

---

# 13. Spacing

Code cũ có nhiều spacing thực dụng. Khi modular hóa, chuẩn hóa dần trên thang 4px:

```css
--space-1: 4px;
--space-2: 8px;
--space-3: 12px;
--space-4: 16px;
--space-5: 20px;
--space-6: 24px;
--space-8: 32px;
--space-10: 40px;
```

Không cần refactor toàn bộ một lần. Khi chạm component nào, map spacing sang token nếu không làm thay đổi visual đáng kể.

---

# 14. Iconography

Canonical line icon:

```css
.icon {
  fill: none;
  stroke: currentColor;
  stroke-width: 1.7;
  stroke-linecap: round;
  stroke-linejoin: round;
}
```

Quy tắc:
- cùng một action dùng cùng icon toàn hệ thống;
- tránh emoji làm UI icon;
- icon không thay thế text ở action khó hiểu nếu không có tooltip/aria-label;
- icon active kế thừa semantic/brand color.

---

# 15. Status & Priority

Không hardcode màu trực tiếp theo từng feature.

Ví dụ mapping:

```ts
status = {
  todo:     { tone: "neutral" },
  doing:    { tone: "blue" },
  review:   { tone: "amber" },
  done:     { tone: "green" }
}

priority = {
  urgent:   { tone: "red" },
  high:     { tone: "amber" },
  medium:   { tone: "blue-or-neutral-by-existing-pattern" },
  low:      { tone: "neutral" }
}
```

Tên nghiệp vụ tiếng Việt có thể thay đổi nhưng semantic token không đổi tùy ý.

---

# 16. Accessibility & Motion

Baseline hiện tại có `focus-visible` rõ và hỗ trợ `prefers-reduced-motion`.

Ô tìm kiếm, nhập liệu và bộ chọn lấy viền màu chính và quầng tím nhạt 3px từ `src/design-system/field-focus.css`. Ô có biểu tượng hoặc nút bên trong hiển thị viền trên khung ngoài. Chế độ tương phản cao dùng viền hệ thống.

Giữ:
```css
:focus-visible {
  outline: 3px solid var(--focus);
  outline-offset: 3px;
}
```

Khi reduced motion:
- bỏ animation/transition không cần thiết;
- không làm mất state feedback.

Dialog animation phải ngắn, nhẹ. Không dùng motion phức tạp trong màn hình vận hành.

---

# 17. Design Token Enforcement

## Rule
Feature code không được chứa brand hex mới.

CI nên có script:
```text
scripts/check-design-tokens.mjs
```

Script có thể:
- scan `src/features` và `src/components`;
- cảnh báo hex/rgb/hsl mới ngoài allowlist;
- bỏ qua token file và approved assets.

Mục tiêu: chặn visual drift tự động.

---

# 18. Khi tạo feature mới

Agent phải trả lời:

### Visual
- dùng primitive nào?
- token nào?
- desktop state?
- collapsed sidebar có ảnh hưởng?
- mobile state?
- dark mode?
- empty/loading/error?
- focus/touch?

### Brand
- có thêm màu mới không?
- có thêm font/weight mới không?
- có thêm radius/shadow mới không?
- có icon mới không?

Nếu có token mới, phải:
1. đặt tên semantic;
2. có light + dark;
3. update docs;
4. visual regression;
5. được review.

---

# 19. Visual Regression Matrix

Tối thiểu với thay đổi layout/component global:

| Viewport | Theme | Sidebar |
|---|---|---|
| 1440×900 | Light | Expanded |
| 1440×900 | Light | Collapsed |
| 1440×900 | Dark | Expanded |
| 1024×768 | Light | Expanded |
| 390×844 | Light | Mobile |
| 390×844 | Dark | Mobile |
| 360×800 | Light | Mobile |

Thêm screenshot cho:
- dialog;
- task detail;
- account/permission form;
- pins;
- filters;
- form có keyboard nếu thay mobile form.

---

# 20. Những thay đổi cần phê duyệt trước

Không tự ý thay:
- Inter;
- primary purple family;
- sidebar dark family;
- mint brand mark;
- desktop width 278/76;
- breakpoint 900/901;
- global panel radius;
- bottom nav pattern;
- icon style;
- overall density philosophy.

Nếu muốn redesign:
- tạo proposal riêng;
- không gộp vào feature PR.

---

# 21. Migration từ single-file HTML

Không rewrite big-bang.

Ưu tiên thứ tự:

1. Extract design tokens.
2. Extract UI primitives.
3. Extract layout shell.
4. Extract auth/workspace selection.
5. Connect Supabase client/auth.
6. Extract organization tree.
7. Extract tasks vertical slice.
8. Extract pins/comments/time.
9. Replace localStorage domain data bằng server state.
10. Keep localStorage chỉ cho preference không nhạy cảm.
11. Add RLS integration tests.
12. Remove compatibility layer khi migration hoàn tất.

Ở mỗi bước, desktop/mobile phải giữ hành vi đã duyệt.

---

# 22. Golden Visual Rule

> **WorkTree X should look like WorkTree X after every feature is added.**

Một feature mới được xem là làm đúng khi người dùng cảm giác nó "vốn đã thuộc về sản phẩm", không phải một module được ghép từ hệ thống khác.
