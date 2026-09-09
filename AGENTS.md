# AGENTS.md — WORKTREE X ENGINEERING & DESIGN CONTRACT

**Status:** Authoritative repository instruction  
**Applies to:** mọi coding agent, AI agent, developer, reviewer và automation sửa code trong repository WorkTree X.  
**Rule:** đọc file này trước khi thay đổi code.

---

## 0. Mục tiêu

WorkTree X là sản phẩm quản trị công việc/doanh nghiệp theo mô hình **multi-tenant SaaS**.

Mọi thay đổi phải đồng thời bảo vệ 4 thứ:

1. **Tenant isolation:** công ty A không bao giờ đọc/sửa dữ liệu công ty B.
2. **Authorization:** role + scope được kiểm tra ở backend/database, không chỉ ẩn UI.
3. **Design consistency:** không làm lệch font, màu, spacing, component language, desktop/mobile behavior.
4. **Maintainability:** feature mới có ranh giới module rõ, test được, migration được, rollback được.

Nếu một yêu cầu làm nhanh xung đột với bốn mục này, ưu tiên tính đúng và khả năng mở rộng.

---

# 1. Source of Truth

Thứ tự ưu tiên khi có mâu thuẫn:

1. `AGENTS.md`
2. Database migration hiện hành + RLS trong `supabase/migrations/`
3. `docs/architecture/`
4. `src/design-system/tokens.css`
5. `docs/design/WORKTREE_X_DESIGN_SYSTEM.md`
6. Feature contract/test
7. Component implementation

Không dùng screenshot, localStorage cũ hoặc route param làm nguồn bảo mật.

---

# 2. Kiến trúc repository bắt buộc

```text
src/app/                  routing + composition
src/features/             domain/vertical slices
src/components/ui/        generic UI primitives
src/components/layout/    shell/layout/navigation
src/design-system/        tokens, typography, icons, motion
src/lib/supabase/         clients, repositories, realtime, generated DB types
src/lib/permissions/      permission helpers for UI/server orchestration
src/lib/validation/       validation schemas
src/hooks/                truly cross-feature hooks
src/stores/               UI/session state only when necessary
src/types/                shared non-database types

supabase/migrations/      immutable migration history
supabase/functions/       trusted server/secret operations
supabase/tests/           RLS/RPC/migration checks

docs/architecture/        architecture + ADR
docs/design/              visual/UX rules
docs/operations/          deploy/backup/runbook
docs/qa/                  test strategy/release checklist

e2e/                      user journeys + tenant isolation + responsive tests
scripts/                  deterministic engineering checks
```

### Architecture rule
Ưu tiên **modular monolith + feature slices**. Không tạo microservice chỉ vì một feature mới.

---

# 3. Dependency Rules

## `src/app`
Được:
- route;
- layout;
- provider;
- composition;
- boundary loading/error.

Không được:
- business rule dài;
- SQL/Supabase query rải rác;
- permission logic phức tạp;
- secret.

## `src/features/<name>`
Mỗi feature nên có:

```text
components/
hooks/
queries/
mutations/
services/
schemas/
types/
utils/
tests/
index.ts
```

- External code chỉ import từ public API của feature (`index.ts`) khi thực tế phù hợp.
- Tránh import sâu kiểu `features/tasks/components/internal/...` từ feature khác.
- Feature domain component được phép biết domain của chính nó.

## `src/components/ui`
- Domain-agnostic.
- Không import từ `features/`.
- Không query Supabase.
- Không chứa string như "task", "organization", "employee" trừ ví dụ/story/test.
- Variant phải dựa trên token/semantic state.

## `src/lib/supabase`
- Một nơi thống nhất tạo Supabase client.
- Tách browser/server/trusted context.
- Generated database type không sửa tay.
- Repository/query helper phải rõ tenant scope.
- Không expose secret key ra client bundle.

---

# 4. Multi-tenant Contract — KHÔNG ĐƯỢC VI PHẠM

Kiến trúc dữ liệu chuẩn:

- Identity: `auth.users`
- Hồ sơ user: `profiles`
- Công ty: `organizations`
- Thành viên công ty: `organization_members`
- Cây tổ chức: `organization_nodes`
- Closure tree: `organization_node_closure`
- Nhân viên: `employees`
- Scope quyền: `member_scopes`
- Công việc: `tasks`
- Read model task: `task_rollups` khi cần
- Checklist: `task_checklist_items`
- Dependency: `task_dependencies`
- Comment: `task_comments`
- Time tracking: `task_time_entries`
- Attachment: `task_attachments`
- Ghim cá nhân: `user_pins`
- Star: `task_stars`
- Notification: `notifications`
- Activity: `activity_logs`
- Security audit: `security_audit_logs`
- Invite: `invitations`
- Subscription: `organization_subscriptions`
- Platform super-admin: `platform_admins`

## Invariant

### A. Tenant
Mọi dữ liệu tenant phải có `organization_id` trực tiếp hoặc được khóa tenant bằng FK/composite FK chắc chắn.

### B. Employee ≠ Organization node
`employees` là nhân sự.  
`organization_nodes` là company/department/project/team/folder.  
Không quay lại model cũ nhét `person` vào cây.

### C. Membership ≠ Employee
Một `auth.users` có thể có membership ở nhiều organization.  
Membership có thể liên kết employee tương ứng của từng organization.

### D. Role + Scope
- owner/admin: quyền cấp organization theo policy.
- manager/member/viewer: phạm vi dùng `member_scopes`.
- ancestor cần thiết có thể được đọc để render breadcrumb/tree nếu RLS hiện hành cho phép.
- task ngoài scope không được leak.

### E. RLS là authoritative
Frontend filter không phải security.
Ẩn button không phải security.
`orgSlug` không phải security.
`activeOrganizationId` trong localStorage không phải security.

---

# 5. Supabase Security Rules

## Browser
Chỉ được dùng publishable/public client key phù hợp với Supabase client.

## Server/Edge Function
Secret key chỉ ở trusted environment.

## Cấm
- commit secret;
- đưa secret vào `NEXT_PUBLIC_*`;
- log access token/refresh token/raw invite token/secret API key;
- disable RLS để "fix nhanh";
- dùng service privilege cho request user thông thường;
- bypass RLS rồi tự filter bằng JavaScript;
- xây Platform Admin bằng secret key trong browser.

## Với bảng mới, PR/agent phải trả lời
1. tenant key là gì?
2. SELECT policy?
3. INSERT policy?
4. UPDATE policy?
5. DELETE policy?
6. role/scope nào có quyền?
7. Realtime có leak tenant không?
8. Storage path có leak tenant không?
9. View dùng `security_invoker` hay cơ chế tương đương phù hợp?
10. có test cross-tenant không?

---

# 6. Database Migration Rules

- Mọi schema change tạo migration mới.
- Không edit migration đã chạy production.
- Migration phải deterministic.
- Không dùng thao tác destructive mà không có kế hoạch dữ liệu/rollback.
- Index phải xét pattern query thật.
- FK tenant-sensitive ưu tiên composite guard khi cần.
- Timestamp dùng timezone-aware type theo schema.
- Soft archive ưu tiên cho dữ liệu nghiệp vụ quan trọng.
- Database types regenerate sau migration.

Tên migration:
```text
YYYYMMDDHHMMSS_<verb>_<domain>_<purpose>.sql
```

Ví dụ:
```text
20260909153000_add_task_watchers.sql
```

---

# 7. Design System Contract

## Font duy nhất
```css
Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif
```

Không tự đổi typography family.

## Light tokens
```css
--bg:#f7f8fb;
--surface:#fff;
--surface-2:#f9fafc;
--surface-3:#f1f3f8;
--text:#20283d;
--muted:#65728a;
--subtle:#64718a;
--line:#e8ebf2;
--line-strong:#d8deea;

--primary:#6962db;
--primary-hover:#5851c4;
--primary-soft:#eeecfc;
--primary-text:#6256ca;

--green:#107353;
--green-soft:#e8f5ef;
--amber:#93540c;
--amber-soft:#fcf3df;
--red:#ae3a4a;
--red-soft:#fcecef;
--blue:#356ca5;
--blue-soft:#eaf2fc;
--purple:#865db2;
--purple-soft:#f2eaf9;

--sidebar:#141c2e;
--sidebar-muted:#96a3bf;
--sidebar-text:#e2e7f3;
--sidebar-line:rgba(186,201,238,.1);

--focus:#8a7fec;
--radius:14px;
```

## Dark tokens
```css
--bg:#111622;
--surface:#1a2131;
--surface-2:#20283a;
--surface-3:#252e43;
--text:#e6eaf3;
--muted:#a0acc4;
--subtle:#a6b2ca;
--line:#2c3448;
--line-strong:#424d68;

--primary:#8d82f1;
--primary-hover:#9d93fc;
--primary-soft:#302c4e;
--primary-text:#b5aafb;

--green:#73d6b4;
--green-soft:#1c3a34;
--amber:#e9bd72;
--amber-soft:#3e3424;
--red:#f28f9c;
--red-soft:#432834;
--blue:#8bbcf0;
--blue-soft:#25384e;
--purple:#c5a0e7;
--purple-soft:#392d4a;

--sidebar:#0d1423;
--sidebar-muted:#98a8c5;
--sidebar-text:#e2e8f5;
```

## Brand mark
```text
background  #c1f0d6
foreground  #1c594b
radius      10px
```

## Existing sizing language
- global radius token: `14px`
- common button radius: `8px`
- standard desktop button min-height: `36px`
- desktop topbar: `70px`
- desktop sidebar expanded: `278px`
- desktop sidebar collapsed: `76px`
- mobile breakpoint boundary: desktop starts at `901px`
- mobile bottom nav target: khoảng `74px + safe area`
- important mobile touch target: `44px` minimum; navigation/tree often `48px`

## Icons
Line icons only unless asset/brand specifies otherwise:
```css
fill: none;
stroke: currentColor;
stroke-width: 1.7;
stroke-linecap: round;
stroke-linejoin: round;
```

---

# 8. Styling Rules

## MUST
- dùng CSS variable/token;
- hỗ trợ light/dark;
- focus-visible rõ;
- responsive không horizontal overflow;
- mobile dùng safe area;
- component state có hover/focus/disabled/loading;
- typography có hierarchy nhưng không phô trương.

## MUST NOT
- hardcode hex màu trong feature/component business;
- thêm font mới;
- dùng emoji thay icon hệ thống cho UI chính;
- tạo gradient/neon/glassmorphism mới tùy ý;
- làm mỗi feature một button/modal style khác nhau;
- scale nguyên desktop xuống mobile;
- thay primary purple hoặc dark sidebar khi chưa duyệt.

Ngoại lệ hardcoded color:
- logo/brand asset được duyệt;
- visualization/chart cần palette riêng đã thêm vào design token;
- third-party integration brand color, có comment rõ.

---

# 9. Responsive Contract

## Desktop `>= 901px`
- Sidebar là rail cố định trong grid.
- Expanded: 278px.
- Collapsed: 76px.
- Collapse phải thay đổi thật `grid-template-columns`, content mở rộng.
- Không để CSS media query override mất trạng thái collapsed.
- Desktop không được nhận bottom nav mobile.

## Mobile `<= 900px`
- Sidebar = off-canvas.
- Không dùng 76px desktop rail.
- Bottom navigation là navigation chính.
- Modal/form có thể fullscreen hoặc gần fullscreen.
- Dùng `100dvh`.
- Tôn trọng `safe-area-inset-*`.
- Khi keyboard mở, action footer vẫn truy cập được.
- Data table nên chuyển card/mobile layout khi phù hợp.
- Không đặt text 9px chỉ để nhét đủ dữ liệu; ưu tiên hierarchy và progressive disclosure.

---

# 10. Component Rules

Trước khi tạo component mới:
1. tìm primitive đang có;
2. tìm variant;
3. tìm feature pattern tương tự;
4. chỉ tạo component mới nếu reuse rõ.

Nên có các primitive thống nhất:
- Button
- IconButton
- Input
- SearchInput
- Select
- Checkbox
- Switch
- Badge
- Avatar
- Dialog
- Drawer
- BottomSheet
- Tabs
- Tooltip
- Toast
- EmptyState
- Skeleton
- ConfirmDialog
- Card/Panel

Feature component không được copy CSS primitive.

---

# 11. Accessibility

- Interactive control có accessible name.
- Keyboard tab order hợp lý.
- Focus-visible giữ nguyên.
- Dialog trap/restore focus đúng.
- `aria-current`, `aria-selected`, `aria-expanded`, `aria-pressed` khi phù hợp.
- Không chỉ dùng màu để truyền đạt trạng thái.
- Touch target đủ lớn.
- Hỗ trợ `prefers-reduced-motion`.
- Contrast phải được kiểm tra khi thêm token mới.

---

# 12. State Management

Phân biệt:
- **Server state:** Supabase/query cache.
- **UI state:** modal, filter draft, selected tab, sidebar.
- **URL state:** search/filter/view đáng chia sẻ/bookmark.
- **Preference:** theme/density/last workspace có thể lưu local.
- **Security state:** không lưu làm nguồn tin cậy ở client.

Không đưa toàn bộ app vào một global store.

---

# 13. Error & Loading Contract

Mọi network flow phải có:
- loading;
- empty;
- error;
- retry/recovery khi hợp lý;
- optimistic update chỉ khi rollback rõ.

Không dùng `alert()` cho UX production trừ fallback cực hạn.

Error message cho user không được lộ SQL, JWT, stack trace hoặc secret.

---

# 14. Testing Contract

Tùy thay đổi, phải có:

### Unit
- pure domain logic;
- permission helpers;
- validation;
- derived metrics.

### Integration
- repository;
- mutation;
- RPC contract.

### Supabase
- RLS theo 2 organization tối thiểu;
- owner/admin/manager/member/viewer;
- inactive membership;
- out-of-scope node/task;
- direct UUID attack.

### E2E
- signup/login;
- organization switch;
- invite/join;
- create/edit task;
- permission restrictions;
- pins;
- mobile critical flows.

### Visual
Ít nhất các state ảnh hưởng:
- desktop expanded;
- desktop collapsed;
- mobile 390px;
- mobile 360px;
- light;
- dark.

---

# 15. Change Discipline

Agent phải:
1. đọc file này;
2. đọc code liên quan;
3. nêu plan;
4. thay đổi nhỏ/reversible;
5. chạy test;
6. kiểm tra responsive;
7. cập nhật docs;
8. báo limitation.

Agent không được:
- "cleanup" cả codebase ngoài scope;
- rename schema/table tùy ý;
- thay UI style theo gu cá nhân;
- sửa DB production bằng thao tác tay không migration;
- bỏ security test vì UI đã ẩn;
- báo pass nếu chưa chạy test tương ứng.

---

# 16. Khi cần thay đổi chuẩn

Nếu product yêu cầu thay:
- font;
- primary color;
- sidebar identity;
- breakpoints;
- global radius;
- permission model;
- multi-tenant model;
- core table naming;
- auth strategy;

thì đó là **architecture/design-system change**, không phải feature edit.

Phải:
1. tạo ADR;
2. mô tả before/after;
3. liệt kê migration;
4. liệt kê visual impact;
5. có rollout/rollback;
6. được chủ dự án duyệt.

---

# 17. PR / Agent Completion Template

```md
## Scope
...

## Architecture impact
...

## Database / RLS
...

## UI / Design-system impact
...

## Desktop verification
- [ ] Expanded
- [ ] Collapsed
- [ ] Light
- [ ] Dark

## Mobile verification
- [ ] 390px
- [ ] 360px
- [ ] Keyboard/form
- [ ] Safe area

## Security
- [ ] Cross-tenant denied
- [ ] Role denied where expected
- [ ] No secret in client

## Tests
...

## Migration / rollback
...

## Known limitations
...
```

---

# 18. Golden Rule

> **Không được đổi bảo mật để tiện code. Không được đổi nhận diện để tiện CSS. Không được phá kiến trúc để ship nhanh một feature.**

Nếu có lựa chọn giữa:
- duplication nhỏ có kiểm soát và coupling lớn,
- refactor từng bước và rewrite một lần,
- RLS rõ ràng và frontend-only permission,
- token hiện tại và màu mới tùy ý,

hãy chọn phương án bảo vệ hệ thống lâu dài.
