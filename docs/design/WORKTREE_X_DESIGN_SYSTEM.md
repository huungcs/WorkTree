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
- Không đổi family trong feature.
- Không dùng quá nhiều font-weight.
- Không dùng ALL CAPS cho nội dung dài.

## Scale khuyến nghị để chuẩn hóa codebase

> Các size dưới đây là token hóa từ ngôn ngữ hiện tại; agent có thể map dần mà không đổi cảm giác thị giác.

```css
--text-2xs: 9px;
--text-xs: 10px;
--text-sm: 11px;
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
- Page title desktop baseline: khoảng `28px`, weight `700`, tracking âm nhẹ.
- Màn hình lớn có thể lên khoảng `31px`.
- Mobile page title khoảng `24–26px`.
- Section title thường `13px` và weight 650.
- Text body desktop thường 12–13px; mobile body khoảng 13–14px.

Không giảm chữ mobile xuống quá nhỏ để cố nhét dữ liệu.

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
- pill/badge dùng radius riêng phù hợp.

Không tạo ngẫu nhiên 18 kiểu radius.

Khuyến nghị token hóa:

```css
--radius-xs: 5px;
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
- pin là secondary action.

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
