# WorkTree X — Hướng dẫn triển khai Supabase Multi‑Tenant hoàn chỉnh

**Phiên bản tài liệu:** 1.0  
**Ngày:** 09/09/2026  
**Mục tiêu:** chuyển WorkTree X từ ứng dụng HTML/localStorage sang một hệ thống SaaS nhiều công ty, đăng ký/đăng nhập thật, dữ liệu tách biệt theo công ty, phân quyền theo vai trò + cây tổ chức, đồng bộ nhiều thiết bị và có nền tảng để public cho khách hàng bên ngoài.

> Tài liệu này là **production-oriented baseline** cho database Supabase. Script đã được rà soát tĩnh và thiết kế theo các nguyên tắc hiện hành của Supabase/Postgres, nhưng chưa thể được chạy thật trên project Supabase của bạn trong môi trường này. Hãy chạy trước trên **project staging**, kiểm thử RLS bằng ít nhất 2 công ty và 5 vai trò, sau đó mới đưa production.

---

## 1. Quyết định kiến trúc

WorkTree X nên dùng kiến trúc sau:

```text
Browser / Mobile Web
        │
        │  Supabase JS + sb_publishable_...
        ▼
Supabase Auth ─────── PostgreSQL
                         │
                         ├── RLS theo organization + role + scope
                         ├── RPC bảo mật cho tạo công ty / mời thành viên
                         ├── Realtime
                         └── Audit / notifications
        │
        └──────────── Supabase Storage
                       └── file đính kèm task

Trusted backend / Edge Function
        │
        ├── gửi email mời
        ├── billing / webhook
        └── sb_secret_... (TUYỆT ĐỐI không đưa vào browser)
```

### Nguyên tắc quan trọng nhất

**Mọi dữ liệu nghiệp vụ đều gắn `organization_id`.** Không dựa vào URL, slug, JavaScript hay việc “ẩn giao diện” để tách công ty.

Ví dụ:

```text
Four Group                    ABC Company
organization_id = A           organization_id = B
      │                              │
      ├── phòng ban                  ├── phòng ban
      ├── nhân viên                  ├── nhân viên
      ├── dự án                      ├── dự án
      └── task                       └── task
```

RLS kiểm tra quyền ở **database**, vì vậy nhân viên của A không đọc được row của B kể cả họ sửa request bằng DevTools.

---

## 2. WorkTree X hiện tại sẽ được ánh xạ sang database như thế nào

| WorkTree hiện tại | Supabase production |
|---|---|
| Cây `company / department / project / team / folder` | `organization_nodes` |
| Node `person` | **tách thành `employees`**, không để nhân viên là node nữa |
| Tài khoản local | Supabase `auth.users` + `organization_members` |
| Vai trò admin/manager/member/viewer | `org_role`; bổ sung `owner` |
| Phạm vi quyền theo nhánh | `member_scopes` + `organization_node_closure` |
| Công việc | `tasks` |
| Owner công việc | `tasks.primary_assignee_id -> employees.id` |
| Checklist | `task_checklist_items` |
| Phụ thuộc | `task_dependencies` |
| Bình luận | `task_comments` |
| Ghi giờ / timer | `task_time_entries` |
| Ghim cá nhân | `user_pins` |
| Đánh dấu sao | `task_stars` |
| Saved view | `saved_views` |
| Activity | `activity_logs` |
| Audit phân quyền | `security_audit_logs` |
| Thông báo | `notifications` |
| File task | Supabase Storage + `task_attachments` |
| Gói SaaS | `organization_subscriptions` |

### Vì sao tách nhân viên khỏi cây node?

Một nhân viên là **thực thể nhân sự**, còn phòng ban/dự án/team là **thực thể tổ chức**. Tách riêng giúp xử lý đúng trường hợp:

- nhân viên thuộc một phòng ban nhưng làm nhiều dự án;
- nhân viên tồn tại trước khi được cấp tài khoản;
- nghỉ việc nhưng lịch sử task vẫn giữ;
- cùng một user có thể tham gia nhiều công ty;
- không phải tạo bản sao nhân viên ở nhiều nhánh.

Trong schema này, khi thêm nhân viên bắt buộc chọn `home_node_id` thuộc **company / department / team**. Khi mời tài khoản, nhân viên đó được liên kết với `organization_members.employee_id`.

---

## 3. Vai trò và phạm vi quyền

| Vai trò | Quyền đề xuất |
|---|---|
| `owner` | Chủ workspace. Toàn quyền; quản lý admin/owner, trạng thái công ty, billing. |
| `admin` | Quản lý cây, nhân viên, tài khoản thường, task và cấu hình công ty. Không tự nâng thành owner. |
| `manager` | Xem/tạo/giao/sửa task trong các nhánh được cấp. Không sửa cây/tài khoản. |
| `member` | Chỉ thấy task **giao cho chính nhân viên liên kết với tài khoản** và nằm trong scope; được đổi trạng thái/progress, checklist, comment, ghi giờ. |
| `viewer` | Xem dữ liệu trong scope; không thay đổi nghiệp vụ. |

### Scope kế thừa theo cây

Nếu manager được cấp:

```text
Phòng Marketing
```

thì scope tự bao gồm:

```text
Phòng Marketing
├── Marketing Q4
│   ├── Content Team
│   └── Ads Team
└── các folder/project/team con khác
```

Database dùng bảng closure `organization_node_closure` để kiểm tra tổ tiên/hậu duệ nhanh hơn việc chạy recursive CTE cho từng row RLS.

Người dùng scoped vẫn được phép thấy **các ancestor cần thiết để render breadcrumb/tree**, nhưng task chỉ được đọc khi task nằm trong nhánh được cấp.

---

# 4. Tạo project Supabase

1. Tạo một Supabase project mới dành cho WorkTree production hoặc staging.
2. Chọn region gần phần lớn người dùng.
3. Vào **Authentication → URL Configuration**:
   - đặt Site URL bằng domain thật, ví dụ `https://app.worktreex.vn`;
   - thêm redirect URL cho login, signup, reset password.
4. Bật Email + Password.
5. Production nên bật xác minh email.
6. Cấu hình **Custom SMTP** trước khi public. Dịch vụ email mặc định của Supabase chỉ phù hợp thử nghiệm và có rate limit thấp.
7. Bật CAPTCHA/Turnstile cho signup, login và password reset khi public.
8. Đặt password policy tối thiểu 12 ký tự; nếu gói hỗ trợ, bật leaked-password protection.
9. Dùng **publishable key `sb_publishable_...` trong frontend**.
10. Chỉ dùng **secret key `sb_secret_...` ở Edge Function/server**.

> Từ năm 2026 Supabase đang chuyển từ legacy `anon/service_role` keys sang publishable/secret keys. Policy Postgres vẫn viết cho role `anon` và `authenticated`, nhưng code frontend mới nên dùng publishable key.

---

# 5. Chạy database migration

## Cách A — nhanh nhất bằng SQL Editor

1. Supabase Dashboard → **SQL Editor** → New query.
2. Copy toàn bộ SQL ở mục **“SQL all-in-one”** cuối tài liệu.
3. Run.
4. Không chạy lại nguyên script trên cùng database vì đây là migration tạo schema lần đầu.
5. Sau khi chạy, kiểm tra:
   - Table Editor có các bảng `organizations`, `organization_members`, `organization_nodes`, `employees`, `tasks`, ...
   - Storage có bucket `worktree-files` và **Public = false**.
   - RLS được bật trên tất cả bảng public.

## Cách B — khuyến nghị cho dự án nghiêm túc bằng Supabase CLI

```bash
supabase init
supabase link --project-ref YOUR_PROJECT_REF
supabase migration new worktree_multi_tenant_v1
```

Đặt nội dung SQL vào file migration vừa tạo, rồi:

```bash
supabase db push
```

Mọi thay đổi về sau nên tạo migration mới, không sửa migration đã chạy production.

---

# 6. Luồng đăng ký công ty mới

## Bước 1 — Owner đăng ký Supabase Auth

Frontend:

```js
const { data, error } = await supabase.auth.signUp({
  email,
  password,
  options: {
    data: { full_name: fullName }
  }
})
```

Trigger `handle_new_user()` tự tạo `public.profiles`.

Nếu bật email confirmation, sau khi xác minh và có session mới chạy bước 2.

## Bước 2 — tạo workspace/công ty

```js
const { data: organizationId, error } = await supabase.rpc(
  'create_organization',
  {
    p_name: 'Four Group',
    p_slug: 'four-group',
    p_timezone: 'Asia/Ho_Chi_Minh'
  }
)
```

RPC tự tạo cùng transaction:

```text
organizations
└── root company node
    └── employee của owner
        └── organization_members(role=owner)

organization_settings
organization_subscriptions
security_audit_logs
```

Do đó không có tình trạng tạo công ty thành công nhưng quên tạo owner hoặc root tree.

---

# 7. Luồng “Thêm nhân viên” đúng với UI WorkTree

Màn hình nên là:

```text
Họ tên                 [________________]
Email                   [________________]
Phòng ban trực thuộc    [Phòng Marketing ▼]
Chức danh               [________________]

[ ] Cấp tài khoản đăng nhập ngay

Vai trò                 [Nhân viên ▼]
Phạm vi được cấp        [Marketing / ...]
```

Có **hai luồng**.

## A. Chỉ tạo nhân sự, chưa cấp tài khoản

Admin insert vào `employees`:

```js
const { data, error } = await supabase
  .from('employees')
  .insert({
    organization_id: orgId,
    full_name: 'Nguyễn Văn A',
    email: 'a@company.vn',
    job_title: 'Content Executive',
    home_node_id: departmentId
  })
  .select()
  .single()
```

RLS chỉ cho owner/admin thực hiện.

## B. Tạo nhân viên + gửi lời mời đăng nhập

**Khuyến nghị:** frontend gọi Edge Function `invite-employee`; Edge Function gọi RPC dưới JWT của admin và gửi email bằng SMTP/Resend/Postmark/... Không để API key email trong browser.

RPC database:

```js
const { data: rawToken, error } = await supabase.rpc('create_invitation', {
  p_organization_id: orgId,
  p_email: 'a@company.vn',
  p_full_name: 'Nguyễn Văn A',
  p_home_node_id: departmentId,
  p_role: 'member',
  p_scope_node_ids: [departmentId]
})
```

`create_invitation`:

- yêu cầu owner/admin;
- bắt buộc phòng ban/team hợp lệ;
- tự tạo hoặc tái sử dụng employee cùng email trong công ty;
- lưu **hash token**, không lưu raw token;
- token có hạn 7 ngày;
- admin không thể mời owner;
- chỉ owner mới mời admin;
- member/manager/viewer có scope.

Edge Function gửi link dạng:

```text
https://app.worktreex.vn/join?token=<raw-token>
```

Sau khi người nhận signup/login đúng email:

```js
const { data: organizationId, error } = await supabase.rpc(
  'accept_invitation',
  { p_token: tokenFromUrl }
)
```

RPC kiểm tra email đăng nhập có trùng email lời mời rồi mới tạo membership.

---

# 8. Đăng nhập và chọn workspace

Login:

```js
const { data, error } = await supabase.auth.signInWithPassword({
  email,
  password
})
```

Sau login, lấy danh sách công ty:

```js
const { data: organizations, error } = await supabase
  .from('organizations')
  .select('id,name,slug,root_node_id,timezone')
  .order('name')
```

RLS tự chỉ trả về các organization mà user đang là thành viên active.

Nếu user thuộc 1 công ty → vào thẳng.  
Nếu thuộc nhiều công ty → hiển thị **Chọn không gian làm việc**.

Nên lưu `activeOrganizationId` trong localStorage chỉ như **preference UI**, không dùng nó làm bảo mật. Database vẫn tự kiểm tra membership/RLS.

---

# 9. Query tree, nhân viên và task

## Tree

```js
const { data: nodes } = await supabase
  .from('organization_nodes')
  .select('*')
  .eq('organization_id', orgId)
  .is('archived_at', null)
  .order('sort_order')
```

RLS tự loại nhánh ngoài scope và vẫn cho ancestor cần thiết để hiển thị đường dẫn.

## Nhân viên

```js
const { data: employees } = await supabase
  .from('employees')
  .select('id,full_name,email,employee_code,job_title,home_node_id,employment_status')
  .eq('organization_id', orgId)
  .eq('employment_status', 'active')
```

## Danh sách task tối ưu cho UI hiện tại

Schema tạo view `task_rollups` với `security_invoker=true` để RLS của bảng gốc vẫn áp dụng.

```js
const { data: tasks, error } = await supabase
  .from('task_rollups')
  .select('*')
  .eq('organization_id', orgId)
  .is('archived_at', null)
  .order('due_date', { ascending: true })
```

`task_rollups` có thêm:

- `actual_minutes`
- `checklist_total`
- `checklist_done`
- `is_blocked`

`is_blocked` chỉ tiết lộ boolean “đang bị chặn”; không làm lộ nội dung dependency nằm ngoài quyền của member.

---

# 10. Mapping trạng thái từ WorkTree V8 hiện tại

Database dùng giá trị ổn định bằng tiếng Anh; UI vẫn hiển thị tiếng Việt.

```js
const STATUS_DB_TO_UI = {
  todo: 'Chưa làm',
  in_progress: 'Đang làm',
  review: 'Chờ duyệt',
  done: 'Hoàn thành'
}

const PRIORITY_DB_TO_UI = {
  urgent: 'Khẩn cấp',
  high: 'Cao',
  medium: 'Trung bình',
  low: 'Thấp'
}
```

Khi ghi:

```js
await supabase
  .from('tasks')
  .update({ status: 'in_progress' })
  .eq('id', taskId)
```

RLS + trigger kiểm tra quyền thật, không tin UI.

---

# 11. Quy tắc task đã được bảo vệ ở database

Script SQL thực hiện các nguyên tắc sau:

1. Không chuyển task sang công ty khác.
2. Manager không được di chuyển/giao task ra ngoài scope.
3. Member chỉ cập nhật row task của chính mình và chỉ các phần cho phép như status/progress.
4. Viewer không ghi dữ liệu.
5. Task `done` luôn progress = 100.
6. Task không thể `done` khi dependency còn mở.
7. Với `auto_progress=true`, checklist còn mục mở thì không cho hoàn thành.
8. Dependency không được tạo vòng lặp.
9. Checklist auto-progress cập nhật % tại database.
10. Task creator và thời điểm tạo không bị client sửa lại.

Đây là lớp bảo vệ thứ hai bên cạnh UI.

---

# 12. Ghim ưu tiên và đánh dấu sao

## Ghim cá nhân

```js
await supabase.from('user_pins').insert({
  organization_id: orgId,
  user_id: user.id,
  task_id: taskId,
  position: 0,
  is_urgent: true
})
```

Hoặc ghim node bằng `node_id` thay vì `task_id`.

Constraint bắt buộc pin chỉ có **một target**. RLS bắt buộc `user_id = auth.uid()` và target phải nằm trong quyền đọc hiện tại.

Khi nhân viên đăng nhập máy tính/điện thoại khác, ghim đi theo tài khoản thay vì localStorage.

## Sao task

Dùng `task_stars`. Đây là trạng thái cá nhân, không nên đặt `favorite` trên row task chung vì một người bấm sao không nên làm cả công ty thấy sao.

---

# 13. Comment, checklist và ghi giờ

### Comment

```js
await supabase.from('task_comments').insert({
  organization_id: orgId,
  task_id: taskId,
  author_user_id: user.id,
  body: comment
})
```

Database buộc tác giả là user đang login. Member chỉ comment trên task của mình; viewer không comment.

### Checklist

```js
await supabase.from('task_checklist_items').insert({
  organization_id: orgId,
  task_id: taskId,
  content: 'Gửi báo giá',
  sort_order: 10
})
```

### Ghi giờ

Khi timer dừng, frontend tính số phút rồi insert:

```js
await supabase.from('task_time_entries').insert({
  organization_id: orgId,
  task_id: taskId,
  user_id: user.id,
  minutes: 37,
  note: 'Bộ đếm thời gian',
  started_at: startedAt,
  ended_at: new Date().toISOString()
})
```

Không cần lưu `actual` trực tiếp trên task. `task_rollups.actual_minutes` tổng hợp từ time entries để không lệch dữ liệu.

---

# 14. File đính kèm

Bucket `worktree-files` là **private**.

Path bắt buộc:

```text
<organization_uuid>/<task_uuid>/<random-id>-<safe-filename>
```

Ví dụ:

```text
8051.../27af.../86db-bao-gia.pdf
```

Upload:

```js
const path = `${orgId}/${taskId}/${crypto.randomUUID()}-${safeName}`

await supabase.storage
  .from('worktree-files')
  .upload(path, file)
```

Sau đó insert metadata vào `task_attachments`.

Storage policy kiểm tra trực tiếp task có nằm trong quyền đọc/ghi của user không. Không dùng public URL cho bucket này; lấy signed URL hoặc download qua authenticated client.

> Không xóa row trực tiếp trong `storage.objects`. Xóa file qua Storage API rồi xóa `task_attachments` để tránh metadata/orphan không đồng bộ.

---

# 15. Realtime

Migration đưa các bảng chính vào publication `supabase_realtime`:

- organization_nodes
- employees
- tasks
- task_dependencies
- task_checklist_items
- task_comments
- task_time_entries
- user_pins
- notifications

Ví dụ subscribe task:

```js
const channel = supabase
  .channel(`org:${orgId}:tasks`)
  .on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'tasks',
      filter: `organization_id=eq.${orgId}`
    },
    payload => refreshTasks(payload)
  )
  .subscribe()
```

RLS vẫn kiểm soát record mà client được nhận.

### Khi hệ thống lớn

Postgres Changes rất tiện cho giai đoạn đầu. Với lượng subscriber lớn/high-frequency, Supabase hiện khuyến nghị **Realtime Broadcast** để scale tốt hơn. Hãy chuyển các kênh hoạt động dày sang Broadcast khi có số liệu thực tế.

---

# 16. Platform Admin của bạn

`platform_admins` được tạo nhưng **không có RLS policy cho browser**.

Sau khi tài khoản của bạn đã tồn tại trong `auth.users`, chạy bằng SQL Editor:

```sql
insert into public.platform_admins(user_id)
select id
from auth.users
where lower(email) = lower('EMAIL_CUA_BAN@example.com')
on conflict do nothing;
```

Trang “WorkTree Platform Admin” nên chạy qua server/Edge Function dùng `sb_secret_...` và tự xác minh user có row trong `platform_admins`.

Không nên làm kiểu:

```text
browser → sb_secret → toàn bộ tenant data
```

Secret key bypass RLS và tuyệt đối không được phát hành trong HTML/JavaScript client.

Platform Admin nên mặc định quản lý **metadata vận hành**:

- công ty nào đang active;
- gói dịch vụ;
- số seat;
- tình trạng thanh toán;
- storage usage;
- log lỗi / support.

Không nên mặc định mở nội dung task của khách hàng nếu không có quy trình support/audit rõ ràng.

---

# 17. Billing / giới hạn gói

`organization_subscriptions` chuẩn bị sẵn:

```text
plan
status
seat_limit
storage_bytes_limit
external_customer_id
external_subscription_id
current_period_end
```

Không cho browser update bảng này. Webhook thanh toán chạy server/Edge Function với secret key.

Khi tạo/mời thành viên, production nên bổ sung kiểm tra `seat_limit` ở RPC hoặc Edge Function trước khi tạo invite.

Ví dụ chính sách sản phẩm:

| Plan | Seat |
|---|---:|
| Free | 5 |
| Starter | 20 |
| Business | 100 |
| Enterprise | cấu hình theo hợp đồng |

---

# 18. Chuyển dữ liệu từ WorkTree HTML/localStorage hiện tại

## Không migrate password local sang Supabase Auth

WorkTree V8 hiện tại có cơ chế tài khoản cục bộ. **Không nhập hash mật khẩu local vào `auth.users`.** Khi chuyển production:

- owner đăng ký tài khoản Supabase mới;
- admin mời nhân viên bằng email;
- người dùng tự đặt mật khẩu qua Supabase Auth.

Đây là cách an toàn và tránh phụ thuộc cơ chế hash/auth cũ.

## Mapping node

WorkTree cũ dùng ID số; Supabase dùng UUID. Tạo một map trong script import:

```js
oldNodeId -> newNodeUuid
oldPersonId -> newEmployeeUuid
oldTaskId -> newTaskUuid
```

### Node `person`

Không insert vào `organization_nodes`.

Ví dụ cũ:

```text
Phòng Marketing
└── Content Team
    └── Phạm Chi (person)
```

mới:

```text
organization_nodes:
Phòng Marketing → Content Team

employees:
Phạm Chi
home_node_id = Content Team UUID
```

## Mapping status

```text
Chưa làm     -> todo
Đang làm     -> in_progress
Chờ duyệt    -> review
Hoàn thành   -> done
```

## Mapping priority

```text
Khẩn cấp      -> urgent
Cao           -> high
Trung bình    -> medium
Thấp          -> low
```

## Task

- `node` → `node_id`
- `owner` → `primary_assignee_id`
- `estimate` giờ → `estimate_minutes = round(hours * 60)`
- `actual` không nhập trực tiếp; chuyển log/time entries nếu có
- `checklist` → `task_checklist_items`
- `comments` → `task_comments`
- `logs` → `task_time_entries`
- `dependencies` → `task_dependencies`
- `favorite` cũ nên coi là preference người đang migrate và chuyển sang `task_stars`

## Ghim

Pins của V8 đang tách theo tài khoản local. Nếu export hiện tại không chứa pin DB/account DB, phải có bước export riêng trước migration. Sau khi tài khoản Supabase mới được tạo, map pin sang `auth.uid()` mới.

---

# 19. Không nên tiếp tục chạy bằng `file://`

Khi public, đừng gửi file HTML để mỗi nhân viên mở kiểu:

```text
file:///C:/Users/.../WorkTree_X.html
```

Hãy deploy frontend lên HTTPS, ví dụ:

```text
https://app.worktreex.vn
```

Lý do:

- redirect Auth ổn định;
- email confirmation/reset password hoạt động đúng;
- session/cookie/origin nhất quán;
- dễ cập nhật một phiên bản cho toàn công ty;
- tránh mỗi máy dùng một bản HTML khác nhau.

Frontend hiện tại vẫn có thể giữ kiến trúc vanilla HTML/CSS/JS trong giai đoạn đầu; không bắt buộc phải đổi React ngay. Việc quan trọng trước là thay localStorage bằng Supabase client + Auth + RLS.

---

# 20. Cấu hình Supabase client

Ví dụ dùng ES module:

```html
<script type="module">
  import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

  const SUPABASE_URL = 'https://YOUR_PROJECT_REF.supabase.co'
  const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_...'

  window.supabase = createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    }
  )
</script>
```

Publishable key được phép có trong browser; **RLS mới là lớp bảo vệ dữ liệu**.

Không đặt:

```text
sb_secret_...
legacy service_role key
SMTP password
payment webhook secret
```

trong HTML.

---

# 21. Kiểm thử bắt buộc trước khi public

Tạo ít nhất:

```text
Org A
  Owner A
  Admin A
  Manager A
  Member A
  Viewer A

Org B
  Owner B
  Member B
```

### Test cách ly tenant

- Owner A query `organizations`: không thấy Org B.
- Owner A dùng UUID task B trực tiếp: phải trả `0 rows` / permission denied.
- Member A sửa URL/request thành `organization_id=B`: không đọc được dữ liệu B.
- Storage path của B: A không download/upload được.
- Realtime của B: A không nhận row B.

### Test role

**Owner**
- sửa tree ✅
- mời admin ✅
- thay status organization ✅

**Admin**
- sửa tree ✅
- thêm employee ✅
- mời member/manager/viewer ✅
- mời admin ❌ (chỉ owner)

**Manager**
- tạo task trong scope ✅
- giao người trong scope ✅
- giao người ngoài scope ❌
- sửa tree ❌

**Member**
- xem task giao mình trong scope ✅
- xem task của đồng nghiệp ❌
- đổi status/progress của task mình ✅
- sửa title/priority/assignee ❌
- checklist/comment/time task mình ✅

**Viewer**
- xem task trong scope ✅
- thay đổi dữ liệu ❌

### Test dependency

- A depends B, sau đó B depends A → database phải reject.
- B chưa done, chuyển A thành done → reject.
- task auto-progress còn checklist chưa xong → done bị reject.

### Test invite

- token đúng + email đúng → accept ✅
- token đúng + email khác → reject
- token dùng lần hai → reject
- token hết hạn → reject
- admin cố invite owner → reject

---

# 22. Query kiểm tra nhanh sau migration

## Mỗi công ty đúng một root node

```sql
select organization_id, count(*) as roots
from public.organization_nodes
where parent_id is null and archived_at is null
group by organization_id
having count(*) <> 1;
```

Kết quả phải **0 rows**.

## Member không có employee link

```sql
select id, organization_id, user_id
from public.organization_members
where role = 'member' and employee_id is null;
```

Phải **0 rows** do constraint.

## Scoped role nhưng không có scope

```sql
select m.id, m.organization_id, m.role
from public.organization_members m
left join public.member_scopes s on s.membership_id = m.id
where m.status = 'active'
  and m.role in ('manager','member','viewer')
group by m.id, m.organization_id, m.role
having count(s.node_id) = 0;
```

Sau khi onboarding hoàn tất nên **0 rows**.

## Kiểm tra closure table

```sql
select n.organization_id, n.id
from public.organization_nodes n
left join public.organization_node_closure c
  on c.organization_id = n.organization_id
 and c.ancestor_id = n.id
 and c.descendant_id = n.id
where c.ancestor_id is null;
```

Phải **0 rows**.

---

# 23. Backup và vận hành production

1. Dùng migration version control bằng Git.
2. Có project staging riêng.
3. Bật backup/PITR phù hợp gói Supabase.
4. **Database backup không đồng nghĩa backup Storage object** — cần chiến lược backup file riêng.
5. Theo dõi Auth rate limits và abuse.
6. Production dùng custom SMTP.
7. Bật CAPTCHA cho endpoint public.
8. Không log access token, refresh token, invite raw token, secret API key.
9. Rotate secret khi nghi ngờ rò rỉ.
10. Mọi Edge Function có secret key phải tự kiểm tra quyền người gọi trước khi hành động.
11. Nên dùng soft archive cho task thay vì hard delete trong UI để giảm rủi ro và thuận lợi audit.
12. Đặt retention policy cho `activity_logs`/`security_audit_logs` khi dữ liệu lớn.

---

# 24. Checklist đưa WorkTree X lên public

- [ ] Tạo Supabase staging
- [ ] Chạy migration SQL
- [ ] Cấu hình Auth URL
- [ ] Custom SMTP
- [ ] Password policy
- [ ] CAPTCHA
- [ ] Tạo frontend Supabase client bằng publishable key
- [ ] Thay login local bằng Supabase Auth
- [ ] Thay local account permissions bằng `organization_members/member_scopes`
- [ ] Thay tree localStorage bằng `organization_nodes`
- [ ] Thay person node bằng `employees`
- [ ] Thay tasks localStorage bằng `tasks`
- [ ] Checklist/comments/time/pins sang bảng riêng
- [ ] Realtime task/comment/notification
- [ ] Storage attachment
- [ ] Edge Function gửi invite
- [ ] Test 2 organization cách ly hoàn toàn
- [ ] Test 5 role
- [ ] Test RLS bằng request cố tình sửa UUID
- [ ] Import dữ liệu WorkTree cũ
- [ ] UAT bằng desktop + mobile
- [ ] Deploy HTTPS
- [ ] Backup trước go-live
- [ ] Theo dõi error/log sau go-live

---

# 25. Thứ tự mình khuyên triển khai cho WorkTree

### Giai đoạn 1 — backend foundation

1. Chạy schema + RLS bên dưới.
2. Tạo Auth thật.
3. Tạo organization/workspace.
4. Tree + employee + member/scopes.

### Giai đoạn 2 — chuyển chức năng hiện tại

5. Tasks.
6. Checklist/dependency/comments/time.
7. Pins/stars/saved views.
8. Notifications + Realtime.
9. Storage.

### Giai đoạn 3 — public SaaS

10. Company self-registration.
11. Invite email.
12. Platform Admin.
13. Subscription/billing.
14. Analytics/usage/limits.
15. Audit + support tooling.

Không nên làm billing trước khi Auth/RLS/multi-tenant test pass.

---

# 26. SQL ALL‑IN‑ONE — WorkTree X Supabase Multi‑Tenant

> **Chạy trên project mới/staging trước.** Đây là migration khởi tạo, không phải script “run repeatedly”.

```sql
-- WorkTree X - Supabase multi-tenant schema
-- Target: a fresh Supabase project. Run once as a migration / SQL Editor script.
-- Internal database values are English; map them to Vietnamese labels in the frontend.

begin;

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- 1) ENUMS
-- -----------------------------------------------------------------------------
create type public.org_role as enum ('owner','admin','manager','member','viewer');
create type public.membership_status as enum ('active','suspended');
create type public.organization_status as enum ('active','suspended','closed');
create type public.node_type as enum ('company','department','project','team','folder');
create type public.task_status as enum ('todo','in_progress','review','done');
create type public.task_priority as enum ('urgent','high','medium','low');
create type public.invitation_status as enum ('pending','accepted','revoked','expired');
create type public.subscription_plan as enum ('free','starter','business','enterprise');
create type public.subscription_status as enum ('trialing','active','past_due','canceled');

-- -----------------------------------------------------------------------------
-- 2) BASE TABLES
-- -----------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  avatar_path text,
  locale text not null default 'vi-VN',
  timezone text not null default 'Asia/Ho_Chi_Minh',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_name_len check (char_length(display_name) <= 180)
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null,
  timezone text not null default 'Asia/Ho_Chi_Minh',
  status public.organization_status not null default 'active',
  created_by uuid not null references auth.users(id) on delete restrict,
  root_node_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organizations_name_len check (char_length(name) between 2 and 180),
  constraint organizations_slug_format check (
    slug = lower(slug)
    and slug ~ '^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$'
  )
);
create unique index organizations_slug_lower_uidx on public.organizations (lower(slug));

create table public.organization_settings (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  logo_path text,
  brand_color text,
  week_starts_on smallint not null default 1,
  working_hours_per_day numeric(4,2) not null default 8,
  default_task_view text not null default 'overview',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint org_settings_week_check check (week_starts_on between 0 and 6),
  constraint org_settings_hours_check check (working_hours_per_day > 0 and working_hours_per_day <= 24),
  constraint org_settings_color_check check (brand_color is null or brand_color ~ '^#[0-9A-Fa-f]{6}$')
);

create table public.organization_nodes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  parent_id uuid,
  type public.node_type not null,
  name text not null,
  description text not null default '',
  capacity_hours_week numeric(6,2) not null default 40,
  sort_order integer not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  constraint organization_nodes_name_len check (char_length(name) between 1 and 180),
  constraint organization_nodes_capacity_check check (capacity_hours_week >= 0 and capacity_hours_week <= 168),
  constraint organization_nodes_parent_fk
    foreign key (organization_id, parent_id)
    references public.organization_nodes(organization_id, id)
    on delete restrict
    deferrable initially immediate
);
create unique index organization_nodes_one_root_uidx
  on public.organization_nodes (organization_id)
  where parent_id is null and archived_at is null;
create index organization_nodes_parent_idx on public.organization_nodes (organization_id, parent_id, sort_order);
create index organization_nodes_type_idx on public.organization_nodes (organization_id, type) where archived_at is null;

alter table public.organizations
  add constraint organizations_root_node_fk
  foreign key (id, root_node_id)
  references public.organization_nodes(organization_id, id)
  deferrable initially deferred;

create table public.organization_node_closure (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  ancestor_id uuid not null,
  descendant_id uuid not null,
  depth integer not null,
  primary key (organization_id, ancestor_id, descendant_id),
  constraint node_closure_depth_check check (depth >= 0),
  constraint node_closure_ancestor_fk
    foreign key (organization_id, ancestor_id)
    references public.organization_nodes(organization_id, id) on delete cascade,
  constraint node_closure_descendant_fk
    foreign key (organization_id, descendant_id)
    references public.organization_nodes(organization_id, id) on delete cascade
);
create index organization_node_closure_desc_idx
  on public.organization_node_closure (organization_id, descendant_id, ancestor_id);

create table public.employees (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  full_name text not null,
  email text,
  employee_code text,
  job_title text,
  home_node_id uuid,
  employment_status public.membership_status not null default 'active',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  constraint employees_name_len check (char_length(full_name) between 1 and 180),
  constraint employees_home_node_fk
    foreign key (organization_id, home_node_id)
    references public.organization_nodes(organization_id, id)
    on delete restrict
);
create unique index employees_email_org_uidx
  on public.employees (organization_id, lower(email))
  where email is not null;
create unique index employees_code_org_uidx
  on public.employees (organization_id, employee_code)
  where employee_code is not null;
create index employees_home_node_idx on public.employees (organization_id, home_node_id) where employment_status = 'active';

create or replace function public.validate_employee_home_node()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_type public.node_type;
begin
  if tg_op = 'UPDATE' and (new.organization_id <> old.organization_id or new.created_at is distinct from old.created_at or new.created_by is distinct from old.created_by) then
    raise exception 'Employee organization/creation fields are immutable';
  end if;
  if tg_op = 'INSERT' and auth.uid() is not null then new.created_by := auth.uid(); end if;
  if new.home_node_id is null then return new; end if;
  select type into v_type
  from public.organization_nodes
  where organization_id = new.organization_id and id = new.home_node_id and archived_at is null;
  if v_type is null then raise exception 'Employee home node does not exist'; end if;
  if v_type not in ('company','department','team') then
    raise exception 'Employee must belong to company, department, or team';
  end if;
  return new;
end;
$$;

create trigger employees_validate_home_node
before insert or update of organization_id, home_node_id on public.employees
for each row execute function public.validate_employee_home_node();

create table public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  employee_id uuid,
  role public.org_role not null default 'member',
  status public.membership_status not null default 'active',
  joined_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id),
  unique (organization_id, id),
  constraint organization_members_member_employee_check check (role <> 'member' or employee_id is not null),
  constraint organization_members_employee_fk
    foreign key (organization_id, employee_id)
    references public.employees(organization_id, id)
    on delete restrict
);
create unique index organization_members_employee_uidx
  on public.organization_members (organization_id, employee_id)
  where employee_id is not null;
create index organization_members_user_idx on public.organization_members (user_id, status, organization_id);
create index organization_members_role_idx on public.organization_members (organization_id, role, status);

create table public.member_scopes (
  organization_id uuid not null,
  membership_id uuid not null,
  node_id uuid not null,
  granted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (membership_id, node_id),
  constraint member_scopes_member_fk
    foreign key (organization_id, membership_id)
    references public.organization_members(organization_id, id)
    on delete cascade,
  constraint member_scopes_node_fk
    foreign key (organization_id, node_id)
    references public.organization_nodes(organization_id, id)
    on delete cascade
);
create index member_scopes_org_node_idx on public.member_scopes (organization_id, node_id, membership_id);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  node_id uuid not null,
  primary_assignee_id uuid,
  title text not null,
  description text not null default '',
  status public.task_status not null default 'todo',
  priority public.task_priority not null default 'medium',
  start_date date,
  due_date date,
  estimate_minutes integer not null default 0,
  progress smallint not null default 0,
  auto_progress boolean not null default false,
  tags text[] not null default '{}',
  completed_at timestamptz,
  archived_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  constraint tasks_node_fk
    foreign key (organization_id, node_id)
    references public.organization_nodes(organization_id, id)
    on delete restrict,
  constraint tasks_assignee_fk
    foreign key (organization_id, primary_assignee_id)
    references public.employees(organization_id, id)
    on delete restrict,
  constraint tasks_title_len check (char_length(title) between 1 and 240),
  constraint tasks_desc_len check (char_length(description) <= 20000),
  constraint tasks_progress_check check (progress between 0 and 100),
  constraint tasks_estimate_check check (estimate_minutes >= 0 and estimate_minutes <= 600000),
  constraint tasks_dates_check check (start_date is null or due_date is null or start_date <= due_date),
  constraint tasks_tags_check check (cardinality(tags) <= 20)
);
create index tasks_org_node_idx on public.tasks (organization_id, node_id, archived_at, status);
create index tasks_org_assignee_idx on public.tasks (organization_id, primary_assignee_id, status) where archived_at is null;
create index tasks_org_due_idx on public.tasks (organization_id, due_date, status) where archived_at is null;
create index tasks_org_priority_idx on public.tasks (organization_id, priority, status) where archived_at is null;
create index tasks_tags_gin_idx on public.tasks using gin (tags);

create table public.task_dependencies (
  organization_id uuid not null,
  task_id uuid not null,
  depends_on_task_id uuid not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (task_id, depends_on_task_id),
  constraint task_dependencies_not_self check (task_id <> depends_on_task_id),
  constraint task_dependencies_task_fk
    foreign key (organization_id, task_id)
    references public.tasks(organization_id, id) on delete cascade,
  constraint task_dependencies_dep_fk
    foreign key (organization_id, depends_on_task_id)
    references public.tasks(organization_id, id) on delete cascade
);
create index task_dependencies_reverse_idx on public.task_dependencies (organization_id, depends_on_task_id, task_id);

create table public.task_checklist_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  task_id uuid not null,
  content text not null,
  is_done boolean not null default false,
  sort_order integer not null default 0,
  completed_by uuid references auth.users(id) on delete set null,
  completed_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint checklist_task_fk
    foreign key (organization_id, task_id)
    references public.tasks(organization_id, id) on delete cascade,
  constraint checklist_content_len check (char_length(content) between 1 and 400)
);
create index checklist_task_idx on public.task_checklist_items (organization_id, task_id, sort_order, created_at);

create table public.task_comments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  task_id uuid not null,
  author_user_id uuid not null references auth.users(id) on delete restrict,
  body text not null,
  edited_at timestamptz,
  created_at timestamptz not null default now(),
  constraint comments_task_fk
    foreign key (organization_id, task_id)
    references public.tasks(organization_id, id) on delete cascade,
  constraint comments_body_len check (char_length(body) between 1 and 5000)
);
create index task_comments_task_idx on public.task_comments (organization_id, task_id, created_at);

create table public.task_time_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  task_id uuid not null,
  user_id uuid not null references auth.users(id) on delete restrict,
  minutes integer not null,
  note text not null default '',
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint time_entries_task_fk
    foreign key (organization_id, task_id)
    references public.tasks(organization_id, id) on delete cascade,
  constraint time_entries_minutes_check check (minutes > 0 and minutes <= 10080),
  constraint time_entries_note_len check (char_length(note) <= 500),
  constraint time_entries_dates_check check (started_at is null or ended_at is null or started_at <= ended_at)
);
create index task_time_entries_task_idx on public.task_time_entries (organization_id, task_id, created_at desc);
create index task_time_entries_user_idx on public.task_time_entries (organization_id, user_id, created_at desc);

create table public.task_attachments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  task_id uuid not null,
  storage_path text not null unique,
  original_name text not null,
  mime_type text,
  size_bytes bigint,
  uploaded_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint attachments_task_fk
    foreign key (organization_id, task_id)
    references public.tasks(organization_id, id) on delete cascade,
  constraint attachments_name_len check (char_length(original_name) between 1 and 255),
  constraint attachments_size_check check (size_bytes is null or size_bytes >= 0)
);
create index task_attachments_task_idx on public.task_attachments (organization_id, task_id, created_at);

create table public.user_pins (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  node_id uuid,
  task_id uuid,
  position integer not null default 0,
  is_urgent boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_pins_exactly_one_target check ((node_id is null) <> (task_id is null)),
  constraint user_pins_node_fk
    foreign key (organization_id, node_id)
    references public.organization_nodes(organization_id, id) on delete cascade,
  constraint user_pins_task_fk
    foreign key (organization_id, task_id)
    references public.tasks(organization_id, id) on delete cascade
);
create unique index user_pins_node_uidx on public.user_pins (organization_id, user_id, node_id) where node_id is not null;
create unique index user_pins_task_uidx on public.user_pins (organization_id, user_id, task_id) where task_id is not null;
create index user_pins_order_idx on public.user_pins (organization_id, user_id, position, created_at);

create table public.task_stars (
  organization_id uuid not null,
  task_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (task_id, user_id),
  constraint task_stars_task_fk
    foreign key (organization_id, task_id)
    references public.tasks(organization_id, id) on delete cascade
);

create table public.saved_views (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  view_type text not null,
  selected_node_id uuid,
  filters jsonb not null default '{}'::jsonb,
  sort_key text not null default 'smart',
  include_children boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint saved_views_name_len check (char_length(name) between 1 and 120),
  constraint saved_views_node_fk
    foreign key (organization_id, selected_node_id)
    references public.organization_nodes(organization_id, id) on delete cascade
);
create index saved_views_user_idx on public.saved_views (organization_id, user_id, created_at desc);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  title text not null,
  body text not null default '',
  task_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint notifications_title_len check (char_length(title) between 1 and 240)
);
create index notifications_user_unread_idx on public.notifications (user_id, created_at desc) where read_at is null;

create table public.activity_logs (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  task_id uuid,
  node_id uuid,
  summary text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index activity_logs_org_time_idx on public.activity_logs (organization_id, created_at desc);
create index activity_logs_task_idx on public.activity_logs (organization_id, task_id, created_at desc) where task_id is not null;

create table public.security_audit_logs (
  id bigint generated always as identity primary key,
  organization_id uuid references public.organizations(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_type text,
  target_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index security_audit_org_time_idx on public.security_audit_logs (organization_id, created_at desc);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  employee_id uuid,
  role public.org_role not null default 'member',
  scope_node_ids uuid[] not null default '{}',
  token_hash bytea not null unique,
  status public.invitation_status not null default 'pending',
  invited_by uuid not null references auth.users(id) on delete restrict,
  accepted_by uuid references auth.users(id) on delete set null,
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  constraint invitations_email_len check (char_length(email) between 3 and 320),
  constraint invitations_employee_fk
    foreign key (organization_id, employee_id)
    references public.employees(organization_id, id) on delete restrict
);
create index invitations_org_email_idx on public.invitations (organization_id, lower(email), status, expires_at);

create table public.organization_subscriptions (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  plan public.subscription_plan not null default 'free',
  status public.subscription_status not null default 'trialing',
  seat_limit integer not null default 5,
  storage_bytes_limit bigint not null default 1073741824,
  external_customer_id text,
  external_subscription_id text,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subscriptions_seat_limit_check check (seat_limit >= 1),
  constraint subscriptions_storage_limit_check check (storage_bytes_limit >= 0)
);

-- Platform admins should be managed only from SQL / trusted server code.
create table public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- 3) GENERIC TRIGGERS AND AUTH PROFILE
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
create trigger organizations_set_updated_at before update on public.organizations
for each row execute function public.set_updated_at();
create trigger organization_settings_set_updated_at before update on public.organization_settings
for each row execute function public.set_updated_at();
create trigger organization_nodes_set_updated_at before update on public.organization_nodes
for each row execute function public.set_updated_at();
create trigger employees_set_updated_at before update on public.employees
for each row execute function public.set_updated_at();
create trigger organization_members_set_updated_at before update on public.organization_members
for each row execute function public.set_updated_at();
create trigger tasks_set_updated_at before update on public.tasks
for each row execute function public.set_updated_at();
create trigger checklist_set_updated_at before update on public.task_checklist_items
for each row execute function public.set_updated_at();
create trigger time_entries_set_updated_at before update on public.task_time_entries
for each row execute function public.set_updated_at();
create trigger user_pins_set_updated_at before update on public.user_pins
for each row execute function public.set_updated_at();
create trigger saved_views_set_updated_at before update on public.saved_views
for each row execute function public.set_updated_at();
create trigger subscriptions_set_updated_at before update on public.organization_subscriptions
for each row execute function public.set_updated_at();

create or replace function public.guard_organization_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.id <> old.id or new.created_by is distinct from old.created_by or new.created_at is distinct from old.created_at then
    raise exception 'Organization identity fields are immutable';
  end if;
  if old.root_node_id is not null and new.root_node_id is distinct from old.root_node_id then
    raise exception 'Organization root node is immutable';
  end if;
  if auth.uid() is not null and new.status is distinct from old.status and not public.is_org_owner(old.id) then
    raise exception 'Only organization owner can change organization status';
  end if;
  return new;
end;
$$;
create trigger organizations_guard_update
before update on public.organizations
for each row execute function public.guard_organization_update();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name',''), split_part(coalesce(new.email,''),'@',1), '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Backfill profile rows if Auth users already exist before this migration.
insert into public.profiles (id, display_name)
select id, coalesce(nullif(raw_user_meta_data ->> 'full_name',''), split_part(coalesce(email,''),'@',1), '')
from auth.users
on conflict (id) do nothing;

-- -----------------------------------------------------------------------------
-- 4) HIERARCHY / CLOSURE TABLE
-- -----------------------------------------------------------------------------
create or replace function public.refresh_node_closure(p_organization_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.organization_node_closure
  where organization_id = p_organization_id;

  with recursive walk as (
    select n.id as ancestor_id, n.id as descendant_id, 0 as depth
    from public.organization_nodes n
    where n.organization_id = p_organization_id

    union all

    select w.ancestor_id, c.id, w.depth + 1
    from walk w
    join public.organization_nodes c
      on c.organization_id = p_organization_id
     and c.parent_id = w.descendant_id
  )
  insert into public.organization_node_closure (organization_id, ancestor_id, descendant_id, depth)
  select p_organization_id, ancestor_id, descendant_id, min(depth)
  from walk
  group by ancestor_id, descendant_id;
end;
$$;

create or replace function public.validate_node_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_parent_type public.node_type;
begin
  if tg_op = 'UPDATE' and new.organization_id <> old.organization_id then
    raise exception 'Cannot move a node to another organization';
  end if;

  if new.parent_id is null then
    if new.type <> 'company' then
      raise exception 'Root node must have type company';
    end if;
  else
    if new.type = 'company' then
      raise exception 'Only the root node can have type company';
    end if;

    select type into v_parent_type
    from public.organization_nodes
    where organization_id = new.organization_id and id = new.parent_id;

    if v_parent_type is null then
      raise exception 'Parent node does not exist in this organization';
    end if;

    if new.parent_id = new.id then
      raise exception 'A node cannot be its own parent';
    end if;

    if tg_op = 'UPDATE' and new.parent_id is distinct from old.parent_id then
      if exists (
        select 1
        from public.organization_node_closure c
        where c.organization_id = new.organization_id
          and c.ancestor_id = new.id
          and c.descendant_id = new.parent_id
      ) then
        raise exception 'Cannot move a node into its own descendant';
      end if;
    end if;
  end if;

  return new;
end;
$$;

create trigger organization_nodes_validate
before insert or update on public.organization_nodes
for each row execute function public.validate_node_write();

create or replace function public.refresh_node_closure_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    perform public.refresh_node_closure(old.organization_id);
    return old;
  else
    perform public.refresh_node_closure(new.organization_id);
    return new;
  end if;
end;
$$;

create trigger organization_nodes_refresh_after_insert
after insert on public.organization_nodes
for each row execute function public.refresh_node_closure_trigger();
create trigger organization_nodes_refresh_after_parent_update
after update of parent_id on public.organization_nodes
for each row execute function public.refresh_node_closure_trigger();
create trigger organization_nodes_refresh_after_delete
after delete on public.organization_nodes
for each row execute function public.refresh_node_closure_trigger();

-- -----------------------------------------------------------------------------
-- 5) AUTHORIZATION HELPER FUNCTIONS
-- SECURITY DEFINER is deliberate: these functions read membership tables without
-- recursively invoking their RLS policies. They expose only booleans/IDs.
-- -----------------------------------------------------------------------------
create or replace function public.current_membership_id(p_organization_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.id
  from public.organization_members m
  join public.organizations o on o.id = m.organization_id
  where m.organization_id = p_organization_id
    and m.user_id = auth.uid()
    and m.status = 'active'
    and o.status = 'active'
  limit 1
$$;

create or replace function public.current_org_role(p_organization_id uuid)
returns public.org_role
language sql
stable
security definer
set search_path = ''
as $$
  select m.role
  from public.organization_members m
  join public.organizations o on o.id = m.organization_id
  where m.organization_id = p_organization_id
    and m.user_id = auth.uid()
    and m.status = 'active'
    and o.status = 'active'
  limit 1
$$;

create or replace function public.current_employee_id(p_organization_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.employee_id
  from public.organization_members m
  join public.organizations o on o.id = m.organization_id
  where m.organization_id = p_organization_id
    and m.user_id = auth.uid()
    and m.status = 'active'
    and o.status = 'active'
  limit 1
$$;

create or replace function public.is_org_member(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.current_membership_id(p_organization_id) is not null
$$;

create or replace function public.is_org_admin(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.current_org_role(p_organization_id) in ('owner','admin'), false)
$$;

create or replace function public.is_org_owner(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.current_org_role(p_organization_id) = 'owner', false)
$$;

create or replace function public.node_in_current_scope(p_organization_id uuid, p_node_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    case
      when m.role in ('owner','admin') then true
      else exists (
        select 1
        from public.member_scopes s
        join public.organization_node_closure c
          on c.organization_id = s.organization_id
         and c.ancestor_id = s.node_id
         and c.descendant_id = p_node_id
        where s.organization_id = p_organization_id
          and s.membership_id = m.id
      )
    end,
    false
  )
  from public.organization_members m
  join public.organizations o on o.id = m.organization_id
  where m.organization_id = p_organization_id
    and m.user_id = auth.uid()
    and m.status = 'active'
    and o.status = 'active'
  limit 1
$$;

create or replace function public.can_read_node(p_organization_id uuid, p_node_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    case
      when m.role in ('owner','admin') then true
      else exists (
        select 1
        from public.member_scopes s
        where s.organization_id = p_organization_id
          and s.membership_id = m.id
          and (
            exists (
              select 1 from public.organization_node_closure c
              where c.organization_id = p_organization_id
                and c.ancestor_id = s.node_id
                and c.descendant_id = p_node_id
            )
            or exists (
              select 1 from public.organization_node_closure c
              where c.organization_id = p_organization_id
                and c.ancestor_id = p_node_id
                and c.descendant_id = s.node_id
            )
          )
      )
    end,
    false
  )
  from public.organization_members m
  join public.organizations o on o.id = m.organization_id
  where m.organization_id = p_organization_id
    and m.user_id = auth.uid()
    and m.status = 'active'
    and o.status = 'active'
  limit 1
$$;

create or replace function public.employee_in_current_scope(p_organization_id uuid, p_employee_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    public.is_org_admin(p_organization_id)
    or exists (
      select 1
      from public.employees e
      where e.organization_id = p_organization_id
        and e.id = p_employee_id
        and e.employment_status = 'active'
        and e.home_node_id is not null
        and public.node_in_current_scope(p_organization_id, e.home_node_id)
    ), false
  )
$$;

create or replace function public.can_read_task_row(
  p_organization_id uuid,
  p_node_id uuid,
  p_primary_assignee_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    case
      when m.role in ('owner','admin') then true
      when not public.node_in_current_scope(p_organization_id, p_node_id) then false
      when m.role = 'member' then m.employee_id is not null and m.employee_id = p_primary_assignee_id
      else true
    end,
    false
  )
  from public.organization_members m
  join public.organizations o on o.id = m.organization_id
  where m.organization_id = p_organization_id
    and m.user_id = auth.uid()
    and m.status = 'active'
    and o.status = 'active'
  limit 1
$$;

create or replace function public.can_manage_task_row(p_organization_id uuid, p_node_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    case
      when m.role in ('owner','admin') then true
      when m.role = 'manager' then public.node_in_current_scope(p_organization_id, p_node_id)
      else false
    end,
    false
  )
  from public.organization_members m
  join public.organizations o on o.id = m.organization_id
  where m.organization_id = p_organization_id
    and m.user_id = auth.uid()
    and m.status = 'active'
    and o.status = 'active'
  limit 1
$$;

create or replace function public.can_collaborate_task_row(
  p_organization_id uuid,
  p_node_id uuid,
  p_primary_assignee_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    case
      when m.role in ('owner','admin') then true
      when m.role = 'manager' then public.node_in_current_scope(p_organization_id, p_node_id)
      when m.role = 'member' then
        public.node_in_current_scope(p_organization_id, p_node_id)
        and m.employee_id is not null
        and m.employee_id = p_primary_assignee_id
      else false
    end,
    false
  )
  from public.organization_members m
  join public.organizations o on o.id = m.organization_id
  where m.organization_id = p_organization_id
    and m.user_id = auth.uid()
    and m.status = 'active'
    and o.status = 'active'
  limit 1
$$;

create or replace function public.can_read_task_id(p_task_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.can_read_task_row(t.organization_id, t.node_id, t.primary_assignee_id), false)
  from public.tasks t
  where t.id = p_task_id
  limit 1
$$;

create or replace function public.can_manage_task_id(p_task_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.can_manage_task_row(t.organization_id, t.node_id), false)
  from public.tasks t
  where t.id = p_task_id
  limit 1
$$;

create or replace function public.can_collaborate_task_id(p_task_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.can_collaborate_task_row(t.organization_id, t.node_id, t.primary_assignee_id), false)
  from public.tasks t
  where t.id = p_task_id
  limit 1
$$;

create or replace function public.can_read_pin_target(p_organization_id uuid, p_node_id uuid, p_task_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_node_id is not null then public.can_read_node(p_organization_id, p_node_id)
    when p_task_id is not null then public.can_read_task_id(p_task_id)
    else false
  end
$$;

create or replace function public.task_is_blocked(p_task_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when not public.can_read_task_id(p_task_id) then false
    else exists (
      select 1
      from public.task_dependencies d
      join public.tasks prerequisite
        on prerequisite.organization_id = d.organization_id
       and prerequisite.id = d.depends_on_task_id
      where d.task_id = p_task_id
        and prerequisite.status <> 'done'
        and prerequisite.archived_at is null
    )
  end
$$;

-- Prevent generic PUBLIC execute access to security-definer helpers.
revoke all on function public.current_membership_id(uuid) from public;
revoke all on function public.current_org_role(uuid) from public;
revoke all on function public.current_employee_id(uuid) from public;
revoke all on function public.is_org_member(uuid) from public;
revoke all on function public.is_org_admin(uuid) from public;
revoke all on function public.is_org_owner(uuid) from public;
revoke all on function public.node_in_current_scope(uuid,uuid) from public;
revoke all on function public.can_read_node(uuid,uuid) from public;
revoke all on function public.employee_in_current_scope(uuid,uuid) from public;
revoke all on function public.can_read_task_row(uuid,uuid,uuid) from public;
revoke all on function public.can_manage_task_row(uuid,uuid) from public;
revoke all on function public.can_collaborate_task_row(uuid,uuid,uuid) from public;
revoke all on function public.can_read_task_id(uuid) from public;
revoke all on function public.can_manage_task_id(uuid) from public;
revoke all on function public.can_collaborate_task_id(uuid) from public;
revoke all on function public.can_read_pin_target(uuid,uuid,uuid) from public;
revoke all on function public.task_is_blocked(uuid) from public;

grant execute on function public.current_membership_id(uuid) to authenticated;
grant execute on function public.current_org_role(uuid) to authenticated;
grant execute on function public.current_employee_id(uuid) to authenticated;
grant execute on function public.is_org_member(uuid) to authenticated;
grant execute on function public.is_org_admin(uuid) to authenticated;
grant execute on function public.is_org_owner(uuid) to authenticated;
grant execute on function public.node_in_current_scope(uuid,uuid) to authenticated;
grant execute on function public.can_read_node(uuid,uuid) to authenticated;
grant execute on function public.employee_in_current_scope(uuid,uuid) to authenticated;
grant execute on function public.can_read_task_row(uuid,uuid,uuid) to authenticated;
grant execute on function public.can_manage_task_row(uuid,uuid) to authenticated;
grant execute on function public.can_collaborate_task_row(uuid,uuid,uuid) to authenticated;
grant execute on function public.can_read_task_id(uuid) to authenticated;
grant execute on function public.can_manage_task_id(uuid) to authenticated;
grant execute on function public.can_collaborate_task_id(uuid) to authenticated;
grant execute on function public.can_read_pin_target(uuid,uuid,uuid) to authenticated;
grant execute on function public.task_is_blocked(uuid) to authenticated;

-- Convenience read model for the current WorkTree UI.
-- security_invoker=true means underlying table RLS remains in force.
create view public.task_rollups
with (security_invoker = true)
as
select
  t.*,
  coalesce((
    select sum(te.minutes)::bigint
    from public.task_time_entries te
    where te.task_id = t.id
  ), 0::bigint) as actual_minutes,
  (
    select count(*)::integer
    from public.task_checklist_items ci
    where ci.task_id = t.id
  ) as checklist_total,
  (
    select count(*)::integer
    from public.task_checklist_items ci
    where ci.task_id = t.id and ci.is_done
  ) as checklist_done,
  public.task_is_blocked(t.id) as is_blocked
from public.tasks t;

-- -----------------------------------------------------------------------------
-- 6) TASK INVARIANTS, DEPENDENCIES, CHECKLIST PROGRESS
-- -----------------------------------------------------------------------------
create or replace function public.guard_task_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role public.org_role;
  v_actor uuid := auth.uid();
  v_assignee_home uuid;
begin
  if tg_op = 'UPDATE' and new.organization_id <> old.organization_id then
    raise exception 'Cannot move a task to another organization';
  end if;

  if tg_op = 'UPDATE' and (new.created_by is distinct from old.created_by or new.created_at is distinct from old.created_at) then
    raise exception 'Task creator and creation time are immutable';
  end if;

  if tg_op = 'INSERT' and v_actor is not null then
    new.created_by := v_actor;
  end if;

  if new.start_date is not null and new.due_date is not null and new.start_date > new.due_date then
    raise exception 'Task start date cannot be after due date';
  end if;

  if new.primary_assignee_id is not null then
    select home_node_id into v_assignee_home
    from public.employees
    where organization_id = new.organization_id
      and id = new.primary_assignee_id
      and employment_status = 'active';
    if not found then
      raise exception 'Assignee does not exist or is inactive';
    end if;
  end if;

  -- Trusted SQL/server operations may not carry auth.uid(); client requests do.
  if v_actor is not null then
    v_role := public.current_org_role(new.organization_id);

    if v_role is null then
      raise exception 'No active membership in organization';
    end if;

    if tg_op = 'INSERT' then
      if not public.can_manage_task_row(new.organization_id, new.node_id) then
        raise exception 'Not allowed to create tasks in this scope';
      end if;
      if new.primary_assignee_id is not null
         and v_role = 'manager'
         and not public.employee_in_current_scope(new.organization_id, new.primary_assignee_id) then
        raise exception 'Manager cannot assign outside granted scope';
      end if;
    else
      if v_role = 'member' then
        if not public.can_collaborate_task_row(old.organization_id, old.node_id, old.primary_assignee_id) then
          raise exception 'Member cannot update this task';
        end if;
        if new.node_id is distinct from old.node_id
          or new.primary_assignee_id is distinct from old.primary_assignee_id
          or new.title is distinct from old.title
          or new.description is distinct from old.description
          or new.priority is distinct from old.priority
          or new.start_date is distinct from old.start_date
          or new.due_date is distinct from old.due_date
          or new.estimate_minutes is distinct from old.estimate_minutes
          or new.auto_progress is distinct from old.auto_progress
          or new.tags is distinct from old.tags
          or new.archived_at is distinct from old.archived_at
          or new.created_by is distinct from old.created_by then
          raise exception 'Member can only update status/progress on the task row';
        end if;
      elsif v_role = 'manager' then
        if not public.can_manage_task_row(old.organization_id, old.node_id)
           or not public.can_manage_task_row(new.organization_id, new.node_id) then
          raise exception 'Manager cannot move/update task outside granted scope';
        end if;
        if new.primary_assignee_id is not null
           and not public.employee_in_current_scope(new.organization_id, new.primary_assignee_id) then
          raise exception 'Manager cannot assign outside granted scope';
        end if;
      elsif v_role not in ('owner','admin') then
        raise exception 'Role is read-only';
      end if;
    end if;
  end if;

  if new.auto_progress and new.status <> 'done' and new.id is not null then
    select case when count(*) = 0 then 0
                else round((count(*) filter (where is_done)::numeric / count(*)) * 100)::integer end
      into new.progress
    from public.task_checklist_items
    where task_id = new.id;
  end if;

  if new.status = 'done' then
    if new.auto_progress and new.id is not null and exists (
      select 1 from public.task_checklist_items c
      where c.task_id = new.id and c.is_done = false
    ) then
      raise exception 'Cannot complete an auto-progress task while checklist items are still open';
    end if;
    if new.id is not null and exists (
      select 1
      from public.task_dependencies d
      join public.tasks prerequisite
        on prerequisite.organization_id = d.organization_id
       and prerequisite.id = d.depends_on_task_id
      where d.organization_id = new.organization_id
        and d.task_id = new.id
        and prerequisite.status <> 'done'
        and prerequisite.archived_at is null
    ) then
      raise exception 'Cannot complete a task while dependencies are still open';
    end if;
    new.progress := 100;
    if new.completed_at is null then new.completed_at := now(); end if;
  else
    new.completed_at := null;
  end if;

  return new;
end;
$$;

create trigger tasks_guard_write
before insert or update on public.tasks
for each row execute function public.guard_task_write();

create or replace function public.guard_task_dependency()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.task_id = new.depends_on_task_id then
    raise exception 'A task cannot depend on itself';
  end if;

  if exists (
    with recursive chain(id) as (
      select d.depends_on_task_id
      from public.task_dependencies d
      where d.organization_id = new.organization_id
        and d.task_id = new.depends_on_task_id
      union
      select d.depends_on_task_id
      from public.task_dependencies d
      join chain c on c.id = d.task_id
      where d.organization_id = new.organization_id
    )
    select 1 from chain where id = new.task_id
  ) then
    raise exception 'Dependency would create a cycle';
  end if;

  return new;
end;
$$;
create trigger task_dependencies_guard
before insert or update on public.task_dependencies
for each row execute function public.guard_task_dependency();

create or replace function public.sync_auto_progress(p_task_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_total integer;
  v_done integer;
  v_progress integer;
begin
  if not exists (select 1 from public.tasks where id = p_task_id and auto_progress = true) then
    return;
  end if;

  select count(*), count(*) filter (where is_done)
    into v_total, v_done
  from public.task_checklist_items
  where task_id = p_task_id;

  v_progress := case when v_total = 0 then 0 else round((v_done::numeric / v_total) * 100)::integer end;

  update public.tasks
  set progress = v_progress
  where id = p_task_id and status <> 'done';
end;
$$;

create or replace function public.checklist_after_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    perform public.sync_auto_progress(old.task_id);
    return old;
  else
    perform public.sync_auto_progress(new.task_id);
    return new;
  end if;
end;
$$;
create trigger checklist_sync_progress
after insert or update or delete on public.task_checklist_items
for each row execute function public.checklist_after_change();

create or replace function public.checklist_completion_stamp()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := coalesce(auth.uid(), new.created_by);
    if new.is_done then
      new.completed_at := now();
      new.completed_by := auth.uid();
    else
      new.completed_at := null;
      new.completed_by := null;
    end if;
  else
    new.organization_id := old.organization_id;
    new.task_id := old.task_id;
    new.created_by := old.created_by;
    new.created_at := old.created_at;
    if new.is_done is distinct from old.is_done then
      if new.is_done then
        new.completed_at := now();
        new.completed_by := auth.uid();
      else
        new.completed_at := null;
        new.completed_by := null;
      end if;
    else
      new.completed_at := old.completed_at;
      new.completed_by := old.completed_by;
    end if;
  end if;
  return new;
end;
$$;
create trigger checklist_completion_before
before insert or update on public.task_checklist_items
for each row execute function public.checklist_completion_stamp();

create or replace function public.guard_comment_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' and auth.uid() is not null then
    new.author_user_id := auth.uid();
  elsif tg_op = 'UPDATE' then
    if new.organization_id <> old.organization_id or new.task_id <> old.task_id
       or new.author_user_id <> old.author_user_id or new.created_at is distinct from old.created_at then
      raise exception 'Comment task/author/creation fields are immutable';
    end if;
    if new.body is distinct from old.body then new.edited_at := now(); else new.edited_at := old.edited_at; end if;
  end if;
  return new;
end;
$$;
create trigger comments_guard_write
before insert or update on public.task_comments
for each row execute function public.guard_comment_write();

create or replace function public.guard_time_entry()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if new.organization_id <> old.organization_id
       or new.task_id <> old.task_id
       or new.created_at is distinct from old.created_at then
      raise exception 'Time entry organization/task/creation time are immutable';
    end if;
    if new.user_id is distinct from old.user_id and public.current_org_role(new.organization_id) not in ('owner','admin') then
      raise exception 'Only owner/admin can reassign a time entry';
    end if;
  end if;
  if not exists (
    select 1 from public.organization_members m
    where m.organization_id = new.organization_id
      and m.user_id = new.user_id
      and m.status = 'active'
  ) then raise exception 'Time-entry user is not an active member of this organization'; end if;
  return new;
end;
$$;
create trigger time_entries_guard
before insert or update on public.task_time_entries
for each row execute function public.guard_time_entry();

create or replace function public.guard_notification_update()
returns trigger
language plpgsql
as $$
begin
  new.organization_id := old.organization_id;
  new.user_id := old.user_id;
  new.kind := old.kind;
  new.title := old.title;
  new.body := old.body;
  new.task_id := old.task_id;
  new.metadata := old.metadata;
  new.created_at := old.created_at;
  return new;
end;
$$;
create trigger notifications_guard_update
before update on public.notifications
for each row execute function public.guard_notification_update();

-- -----------------------------------------------------------------------------
-- 7) ACTIVITY LOGS + BASIC NOTIFICATIONS
-- -----------------------------------------------------------------------------
create or replace function public.actor_display_name()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(nullif(p.display_name,''), split_part(coalesce(u.email,''),'@',1), 'System')
  from auth.users u
  left join public.profiles p on p.id = u.id
  where u.id = auth.uid()
$$;

create or replace function public.log_task_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_action text;
  v_summary text;
  v_meta jsonb := '{}'::jsonb;
  v_org uuid;
  v_task uuid;
  v_node uuid;
begin
  if tg_op = 'INSERT' then
    v_action := 'task.created';
    v_summary := 'Tạo công việc: ' || new.title;
    v_org := new.organization_id; v_task := new.id; v_node := new.node_id;
  elsif tg_op = 'DELETE' then
    v_action := 'task.deleted';
    v_summary := 'Xóa công việc: ' || old.title;
    v_org := old.organization_id; v_task := old.id; v_node := old.node_id;
  else
    v_action := 'task.updated';
    v_summary := 'Cập nhật công việc: ' || new.title;
    v_org := new.organization_id; v_task := new.id; v_node := new.node_id;
    v_meta := jsonb_strip_nulls(jsonb_build_object(
      'old_status', case when old.status is distinct from new.status then old.status::text end,
      'new_status', case when old.status is distinct from new.status then new.status::text end,
      'old_priority', case when old.priority is distinct from new.priority then old.priority::text end,
      'new_priority', case when old.priority is distinct from new.priority then new.priority::text end,
      'old_assignee', case when old.primary_assignee_id is distinct from new.primary_assignee_id then old.primary_assignee_id end,
      'new_assignee', case when old.primary_assignee_id is distinct from new.primary_assignee_id then new.primary_assignee_id end,
      'old_due', case when old.due_date is distinct from new.due_date then old.due_date end,
      'new_due', case when old.due_date is distinct from new.due_date then new.due_date end
    ));
  end if;

  insert into public.activity_logs (
    organization_id, actor_user_id, action, task_id, node_id, summary, metadata
  ) values (v_org, auth.uid(), v_action, v_task, v_node, v_summary, v_meta);

  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;
create trigger tasks_activity
after insert or update or delete on public.tasks
for each row execute function public.log_task_activity();

create or replace function public.log_comment_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.activity_logs (organization_id, actor_user_id, action, task_id, summary)
  values (new.organization_id, auth.uid(), 'comment.created', new.task_id, 'Thêm bình luận');
  return new;
end;
$$;
create trigger comments_activity after insert on public.task_comments
for each row execute function public.log_comment_activity();

create or replace function public.log_time_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.activity_logs (organization_id, actor_user_id, action, task_id, summary, metadata)
  values (
    new.organization_id, auth.uid(), 'time.logged', new.task_id,
    'Ghi thời gian', jsonb_build_object('minutes', new.minutes, 'note', new.note)
  );
  return new;
end;
$$;
create trigger time_entries_activity after insert on public.task_time_entries
for each row execute function public.log_time_activity();

create or replace function public.notify_task_assignment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid;
begin
  if new.primary_assignee_id is null then return new; end if;
  if tg_op = 'UPDATE' and new.primary_assignee_id is not distinct from old.primary_assignee_id then return new; end if;

  select m.user_id into v_user
  from public.organization_members m
  where m.organization_id = new.organization_id
    and m.employee_id = new.primary_assignee_id
    and m.status = 'active'
  limit 1;

  if v_user is not null and v_user is distinct from auth.uid() then
    insert into public.notifications (organization_id, user_id, kind, title, body, task_id)
    values (new.organization_id, v_user, 'task_assigned', 'Bạn được giao một công việc', new.title, new.id);
  end if;
  return new;
end;
$$;
create trigger tasks_notify_assignment
after insert or update of primary_assignee_id on public.tasks
for each row execute function public.notify_task_assignment();

-- Internal SECURITY DEFINER functions must not be callable directly from clients.
revoke all on function public.handle_new_user() from public;
revoke all on function public.guard_organization_update() from public;
revoke all on function public.validate_employee_home_node() from public;
revoke all on function public.refresh_node_closure(uuid) from public;
revoke all on function public.validate_node_write() from public;
revoke all on function public.refresh_node_closure_trigger() from public;
revoke all on function public.guard_task_write() from public;
revoke all on function public.guard_task_dependency() from public;
revoke all on function public.sync_auto_progress(uuid) from public;
revoke all on function public.checklist_after_change() from public;
revoke all on function public.guard_comment_write() from public;
revoke all on function public.guard_time_entry() from public;
revoke all on function public.actor_display_name() from public;
revoke all on function public.log_task_activity() from public;
revoke all on function public.log_comment_activity() from public;
revoke all on function public.log_time_activity() from public;
revoke all on function public.notify_task_assignment() from public;

-- -----------------------------------------------------------------------------
-- 8) SECURE RPC: CREATE ORGANIZATION, INVITE, ACCEPT INVITE, MEMBER MANAGEMENT
-- -----------------------------------------------------------------------------
create or replace function public.create_organization(
  p_name text,
  p_slug text,
  p_timezone text default 'Asia/Ho_Chi_Minh'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_org uuid;
  v_root uuid;
  v_employee uuid;
  v_name text;
  v_email text;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  p_name := btrim(p_name);
  p_slug := lower(btrim(p_slug));
  if char_length(p_name) < 2 or char_length(p_name) > 180 then raise exception 'Invalid organization name'; end if;
  if p_slug !~ '^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$' then raise exception 'Invalid organization slug'; end if;

  select coalesce(nullif(p.display_name,''), split_part(coalesce(u.email,''),'@',1), 'Owner'), u.email
    into v_name, v_email
  from auth.users u
  left join public.profiles p on p.id = u.id
  where u.id = v_user;

  insert into public.organizations (name, slug, timezone, created_by)
  values (p_name, p_slug, coalesce(nullif(p_timezone,''),'Asia/Ho_Chi_Minh'), v_user)
  returning id into v_org;

  insert into public.organization_nodes (organization_id, parent_id, type, name, description, sort_order)
  values (v_org, null, 'company', p_name, 'Không gian gốc của công ty', 0)
  returning id into v_root;

  update public.organizations set root_node_id = v_root where id = v_org;
  insert into public.organization_settings (organization_id) values (v_org);
  insert into public.organization_subscriptions (organization_id) values (v_org);

  insert into public.employees (organization_id, full_name, email, home_node_id, job_title, created_by)
  values (v_org, coalesce(v_name,'Owner'), lower(v_email), v_root, 'Owner', v_user)
  returning id into v_employee;

  insert into public.organization_members (organization_id, user_id, employee_id, role, status)
  values (v_org, v_user, v_employee, 'owner', 'active');

  insert into public.security_audit_logs (organization_id, actor_user_id, action, target_type, target_id)
  values (v_org, v_user, 'organization.created', 'organization', v_org::text);

  return v_org;
end;
$$;

create or replace function public.create_invitation(
  p_organization_id uuid,
  p_email text,
  p_full_name text,
  p_home_node_id uuid,
  p_role public.org_role default 'member',
  p_scope_node_ids uuid[] default '{}'
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_actor_role public.org_role;
  v_token text;
  v_employee uuid;
  v_email text := lower(btrim(p_email));
  v_scope uuid;
begin
  if v_actor is null then raise exception 'Authentication required'; end if;
  v_actor_role := public.current_org_role(p_organization_id);
  if v_actor_role not in ('owner','admin') then raise exception 'Admin permission required'; end if;
  if p_role = 'owner' then raise exception 'Owner role must be transferred separately'; end if;
  if p_role = 'admin' and v_actor_role <> 'owner' then raise exception 'Only owner can invite another admin'; end if;
  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then raise exception 'Invalid email'; end if;
  if char_length(btrim(p_full_name)) < 1 or char_length(btrim(p_full_name)) > 180 then raise exception 'Invalid employee name'; end if;

  if not exists (
    select 1 from public.organization_nodes
    where organization_id = p_organization_id
      and id = p_home_node_id
      and archived_at is null
  ) then raise exception 'Invalid department/team node'; end if;

  if p_role not in ('admin') and cardinality(p_scope_node_ids) = 0 then
    p_scope_node_ids := array[p_home_node_id];
  end if;

  foreach v_scope in array p_scope_node_ids loop
    if not exists (
      select 1 from public.organization_nodes
      where organization_id = p_organization_id and id = v_scope and archived_at is null
    ) then raise exception 'Scope node does not belong to organization'; end if;
  end loop;

  select id into v_employee
  from public.employees
  where organization_id = p_organization_id and lower(email) = v_email
  limit 1;

  if v_employee is null then
    insert into public.employees (organization_id, full_name, email, home_node_id, created_by)
    values (p_organization_id, btrim(p_full_name), v_email, p_home_node_id, v_actor)
    returning id into v_employee;
  else
    update public.employees
    set full_name = btrim(p_full_name), home_node_id = p_home_node_id, employment_status = 'active'
    where organization_id = p_organization_id and id = v_employee;
  end if;

  if exists (
    select 1
    from public.organization_members m
    join auth.users u on u.id = m.user_id
    where m.organization_id = p_organization_id
      and lower(u.email) = v_email
      and m.status = 'active'
  ) then raise exception 'This email is already an active member'; end if;

  update public.invitations
  set status = 'revoked'
  where organization_id = p_organization_id
    and lower(email) = v_email
    and status = 'pending';

  v_token := encode(gen_random_bytes(32), 'hex');

  insert into public.invitations (
    organization_id, email, employee_id, role, scope_node_ids,
    token_hash, status, invited_by, expires_at
  ) values (
    p_organization_id, v_email, v_employee, p_role, coalesce(p_scope_node_ids,'{}'),
    digest(v_token, 'sha256'), 'pending', v_actor, now() + interval '7 days'
  );

  insert into public.security_audit_logs (organization_id, actor_user_id, action, target_type, target_id, metadata)
  values (
    p_organization_id, v_actor, 'invitation.created', 'employee', v_employee::text,
    jsonb_build_object('email', v_email, 'role', p_role::text)
  );

  return v_token;
end;
$$;

create or replace function public.accept_invitation(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_email text;
  v_inv public.invitations%rowtype;
  v_membership uuid;
  v_scope uuid;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if p_token is null or char_length(p_token) < 32 then raise exception 'Invalid invitation token'; end if;

  select lower(email) into v_email from auth.users where id = v_user;
  if v_email is null then raise exception 'Authenticated user has no email'; end if;

  select * into v_inv
  from public.invitations
  where token_hash = digest(p_token, 'sha256')
    and status = 'pending'
  for update;

  if not found then raise exception 'Invitation not found or already used'; end if;
  if v_inv.expires_at <= now() then
    update public.invitations set status = 'expired' where id = v_inv.id;
    raise exception 'Invitation expired';
  end if;
  if lower(v_inv.email) <> v_email then raise exception 'Invitation email does not match signed-in user'; end if;

  insert into public.organization_members (organization_id, user_id, employee_id, role, status)
  values (v_inv.organization_id, v_user, v_inv.employee_id, v_inv.role, 'active')
  on conflict (organization_id, user_id)
  do update set employee_id = excluded.employee_id, role = excluded.role, status = 'active', updated_at = now()
  returning id into v_membership;

  delete from public.member_scopes where membership_id = v_membership;
  if v_inv.role not in ('owner','admin') then
    foreach v_scope in array v_inv.scope_node_ids loop
      insert into public.member_scopes (organization_id, membership_id, node_id, granted_by)
      values (v_inv.organization_id, v_membership, v_scope, v_inv.invited_by)
      on conflict do nothing;
    end loop;
  end if;

  update public.invitations
  set status = 'accepted', accepted_by = v_user, accepted_at = now()
  where id = v_inv.id;

  insert into public.security_audit_logs (organization_id, actor_user_id, action, target_type, target_id)
  values (v_inv.organization_id, v_user, 'invitation.accepted', 'membership', v_membership::text);

  return v_inv.organization_id;
end;
$$;

create or replace function public.set_member_role_and_scopes(
  p_membership_id uuid,
  p_role public.org_role,
  p_scope_node_ids uuid[] default '{}'
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target public.organization_members%rowtype;
  v_actor_role public.org_role;
  v_scope uuid;
begin
  select * into v_target from public.organization_members where id = p_membership_id for update;
  if not found then raise exception 'Membership not found'; end if;

  v_actor_role := public.current_org_role(v_target.organization_id);
  if v_actor_role not in ('owner','admin') then raise exception 'Admin permission required'; end if;
  if (v_target.role in ('owner','admin') or p_role in ('owner','admin')) and v_actor_role <> 'owner' then
    raise exception 'Only owner can manage owner/admin roles';
  end if;

  if v_target.role = 'owner' and p_role <> 'owner' and (
    select count(*) from public.organization_members
    where organization_id = v_target.organization_id and role = 'owner' and status = 'active'
  ) <= 1 then raise exception 'Organization must keep at least one active owner'; end if;

  if p_role = 'member' and v_target.employee_id is null then
    raise exception 'Member role requires a linked employee';
  end if;
  if p_role not in ('owner','admin') and cardinality(p_scope_node_ids) = 0 then
    raise exception 'Scoped roles require at least one node';
  end if;

  foreach v_scope in array p_scope_node_ids loop
    if not exists (
      select 1 from public.organization_nodes
      where organization_id = v_target.organization_id and id = v_scope and archived_at is null
    ) then raise exception 'Invalid scope node'; end if;
  end loop;

  update public.organization_members set role = p_role where id = p_membership_id;
  delete from public.member_scopes where membership_id = p_membership_id;
  if p_role not in ('owner','admin') then
    foreach v_scope in array p_scope_node_ids loop
      insert into public.member_scopes (organization_id, membership_id, node_id, granted_by)
      values (v_target.organization_id, p_membership_id, v_scope, auth.uid())
      on conflict do nothing;
    end loop;
  end if;

  insert into public.security_audit_logs (organization_id, actor_user_id, action, target_type, target_id, metadata)
  values (
    v_target.organization_id, auth.uid(), 'membership.role_scopes_changed', 'membership', p_membership_id::text,
    jsonb_build_object('role', p_role::text, 'scopes', p_scope_node_ids)
  );
end;
$$;

create or replace function public.set_member_status(
  p_membership_id uuid,
  p_status public.membership_status
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target public.organization_members%rowtype;
  v_actor_role public.org_role;
begin
  select * into v_target from public.organization_members where id = p_membership_id for update;
  if not found then raise exception 'Membership not found'; end if;
  v_actor_role := public.current_org_role(v_target.organization_id);
  if v_actor_role not in ('owner','admin') then raise exception 'Admin permission required'; end if;
  if v_target.role in ('owner','admin') and v_actor_role <> 'owner' then raise exception 'Only owner can change owner/admin status'; end if;
  if v_target.user_id = auth.uid() and p_status = 'suspended' then raise exception 'Cannot suspend your own active membership'; end if;
  if v_target.role = 'owner' and p_status = 'suspended' and (
    select count(*) from public.organization_members
    where organization_id = v_target.organization_id and role = 'owner' and status = 'active'
  ) <= 1 then raise exception 'Organization must keep at least one active owner'; end if;

  update public.organization_members set status = p_status where id = p_membership_id;
  insert into public.security_audit_logs (organization_id, actor_user_id, action, target_type, target_id, metadata)
  values (
    v_target.organization_id, auth.uid(), 'membership.status_changed', 'membership', p_membership_id::text,
    jsonb_build_object('status', p_status::text)
  );
end;
$$;

revoke all on function public.create_organization(text,text,text) from public;
revoke all on function public.create_invitation(uuid,text,text,uuid,public.org_role,uuid[]) from public;
revoke all on function public.accept_invitation(text) from public;
revoke all on function public.set_member_role_and_scopes(uuid,public.org_role,uuid[]) from public;
revoke all on function public.set_member_status(uuid,public.membership_status) from public;

grant execute on function public.create_organization(text,text,text) to authenticated;
grant execute on function public.create_invitation(uuid,text,text,uuid,public.org_role,uuid[]) to authenticated;
grant execute on function public.accept_invitation(text) to authenticated;
grant execute on function public.set_member_role_and_scopes(uuid,public.org_role,uuid[]) to authenticated;
grant execute on function public.set_member_status(uuid,public.membership_status) to authenticated;

-- -----------------------------------------------------------------------------
-- 9) ROW LEVEL SECURITY
-- -----------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_settings enable row level security;
alter table public.organization_nodes enable row level security;
alter table public.organization_node_closure enable row level security;
alter table public.employees enable row level security;
alter table public.organization_members enable row level security;
alter table public.member_scopes enable row level security;
alter table public.tasks enable row level security;
alter table public.task_dependencies enable row level security;
alter table public.task_checklist_items enable row level security;
alter table public.task_comments enable row level security;
alter table public.task_time_entries enable row level security;
alter table public.task_attachments enable row level security;
alter table public.user_pins enable row level security;
alter table public.task_stars enable row level security;
alter table public.saved_views enable row level security;
alter table public.notifications enable row level security;
alter table public.activity_logs enable row level security;
alter table public.security_audit_logs enable row level security;
alter table public.invitations enable row level security;
alter table public.organization_subscriptions enable row level security;
alter table public.platform_admins enable row level security;

-- Profiles: private by default.
create policy profiles_select_own on public.profiles
for select to authenticated
using (auth.uid() is not null and id = auth.uid());
create policy profiles_update_own on public.profiles
for update to authenticated
using (auth.uid() is not null and id = auth.uid())
with check (auth.uid() is not null and id = auth.uid());

-- Organization metadata.
create policy organizations_select_member on public.organizations
for select to authenticated
using (public.is_org_member(id));
create policy organizations_update_admin on public.organizations
for update to authenticated
using (public.is_org_admin(id))
with check (public.is_org_admin(id));

create policy org_settings_select_member on public.organization_settings
for select to authenticated
using (public.is_org_member(organization_id));
create policy org_settings_update_admin on public.organization_settings
for update to authenticated
using (public.is_org_admin(organization_id))
with check (public.is_org_admin(organization_id));

-- Tree: scoped users can see their branch + ancestors needed to render breadcrumbs/tree.
create policy nodes_select_visible on public.organization_nodes
for select to authenticated
using (public.can_read_node(organization_id, id));
create policy nodes_insert_admin on public.organization_nodes
for insert to authenticated
with check (public.is_org_admin(organization_id));
create policy nodes_update_admin on public.organization_nodes
for update to authenticated
using (public.is_org_admin(organization_id))
with check (public.is_org_admin(organization_id));
create policy nodes_delete_admin on public.organization_nodes
for delete to authenticated
using (public.is_org_admin(organization_id));

create policy closure_select_visible on public.organization_node_closure
for select to authenticated
using (
  public.can_read_node(organization_id, ancestor_id)
  and public.can_read_node(organization_id, descendant_id)
);

-- Employees are the business personnel records; login accounts are memberships.
create policy employees_select_visible on public.employees
for select to authenticated
using (
  public.is_org_admin(organization_id)
  or (home_node_id is not null and public.can_read_node(organization_id, home_node_id))
  or id = public.current_employee_id(organization_id)
);
create policy employees_insert_admin on public.employees
for insert to authenticated
with check (public.is_org_admin(organization_id));
create policy employees_update_admin on public.employees
for update to authenticated
using (public.is_org_admin(organization_id))
with check (public.is_org_admin(organization_id));
create policy employees_delete_admin on public.employees
for delete to authenticated
using (public.is_org_admin(organization_id));

-- Membership/scopes are readable by the current user or org admins; mutations use RPCs.
create policy members_select_self_or_admin on public.organization_members
for select to authenticated
using (user_id = auth.uid() or public.is_org_admin(organization_id));
create policy scopes_select_self_or_admin on public.member_scopes
for select to authenticated
using (
  membership_id = public.current_membership_id(organization_id)
  or public.is_org_admin(organization_id)
);

-- Tasks.
create policy tasks_select_visible on public.tasks
for select to authenticated
using (public.can_read_task_row(organization_id, node_id, primary_assignee_id));
create policy tasks_insert_manager on public.tasks
for insert to authenticated
with check (public.can_manage_task_row(organization_id, node_id));
create policy tasks_update_collaborator on public.tasks
for update to authenticated
using (public.can_collaborate_task_row(organization_id, node_id, primary_assignee_id))
with check (public.can_collaborate_task_row(organization_id, node_id, primary_assignee_id));
create policy tasks_delete_manager on public.tasks
for delete to authenticated
using (public.can_manage_task_row(organization_id, node_id));

-- Dependencies: only managers/admins change them; everyone who can read task can read visible dependencies.
create policy dependencies_select_visible on public.task_dependencies
for select to authenticated
using (public.can_read_task_id(task_id) and public.can_read_task_id(depends_on_task_id));
create policy dependencies_insert_manager on public.task_dependencies
for insert to authenticated
with check (public.can_manage_task_id(task_id) and public.can_read_task_id(depends_on_task_id));
create policy dependencies_delete_manager on public.task_dependencies
for delete to authenticated
using (public.can_manage_task_id(task_id));

-- Checklist: assigned members may maintain checklist on their own tasks.
create policy checklist_select_visible on public.task_checklist_items
for select to authenticated
using (public.can_read_task_id(task_id));
create policy checklist_insert_collaborator on public.task_checklist_items
for insert to authenticated
with check (public.can_collaborate_task_id(task_id));
create policy checklist_update_collaborator on public.task_checklist_items
for update to authenticated
using (public.can_collaborate_task_id(task_id))
with check (public.can_collaborate_task_id(task_id));
create policy checklist_delete_collaborator on public.task_checklist_items
for delete to authenticated
using (public.can_collaborate_task_id(task_id));

-- Comments.
create policy comments_select_visible on public.task_comments
for select to authenticated
using (public.can_read_task_id(task_id));
create policy comments_insert_collaborator on public.task_comments
for insert to authenticated
with check (
  author_user_id = auth.uid()
  and public.can_collaborate_task_id(task_id)
);
create policy comments_update_author on public.task_comments
for update to authenticated
using (author_user_id = auth.uid() and public.can_collaborate_task_id(task_id))
with check (author_user_id = auth.uid() and public.can_collaborate_task_id(task_id));
create policy comments_delete_author_or_manager on public.task_comments
for delete to authenticated
using (
  (author_user_id = auth.uid() and public.can_collaborate_task_id(task_id))
  or public.can_manage_task_id(task_id)
);

-- Time entries.
create policy time_entries_select_visible on public.task_time_entries
for select to authenticated
using (public.can_read_task_id(task_id));
create policy time_entries_insert_collaborator on public.task_time_entries
for insert to authenticated
with check (user_id = auth.uid() and public.can_collaborate_task_id(task_id));
create policy time_entries_update_owner_or_manager on public.task_time_entries
for update to authenticated
using ((user_id = auth.uid() and public.can_collaborate_task_id(task_id)) or public.can_manage_task_id(task_id))
with check ((user_id = auth.uid() and public.can_collaborate_task_id(task_id)) or public.can_manage_task_id(task_id));
create policy time_entries_delete_owner_or_manager on public.task_time_entries
for delete to authenticated
using ((user_id = auth.uid() and public.can_collaborate_task_id(task_id)) or public.can_manage_task_id(task_id));

-- Attachment metadata. Storage itself has separate policies below.
create policy attachments_select_visible on public.task_attachments
for select to authenticated
using (public.can_read_task_id(task_id));
create policy attachments_insert_collaborator on public.task_attachments
for insert to authenticated
with check (uploaded_by = auth.uid() and public.can_collaborate_task_id(task_id));
create policy attachments_delete_uploader_or_manager on public.task_attachments
for delete to authenticated
using ((uploaded_by = auth.uid() and public.can_collaborate_task_id(task_id)) or public.can_manage_task_id(task_id));

-- Personal pins / stars / saved views.
create policy pins_select_own on public.user_pins
for select to authenticated
using (
  user_id = auth.uid()
  and public.is_org_member(organization_id)
  and public.can_read_pin_target(organization_id, node_id, task_id)
);
create policy pins_insert_own on public.user_pins
for insert to authenticated
with check (
  user_id = auth.uid()
  and public.is_org_member(organization_id)
  and public.can_read_pin_target(organization_id, node_id, task_id)
);
create policy pins_update_own on public.user_pins
for update to authenticated
using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and public.is_org_member(organization_id)
  and public.can_read_pin_target(organization_id, node_id, task_id)
);
create policy pins_delete_own on public.user_pins
for delete to authenticated
using (user_id = auth.uid());

create policy stars_select_own on public.task_stars
for select to authenticated
using (user_id = auth.uid() and public.can_read_task_id(task_id));
create policy stars_insert_own on public.task_stars
for insert to authenticated
with check (user_id = auth.uid() and public.can_read_task_id(task_id));
create policy stars_delete_own on public.task_stars
for delete to authenticated
using (user_id = auth.uid());

create policy saved_views_select_own on public.saved_views
for select to authenticated
using (user_id = auth.uid() and public.is_org_member(organization_id));
create policy saved_views_insert_own on public.saved_views
for insert to authenticated
with check (user_id = auth.uid() and public.is_org_member(organization_id));
create policy saved_views_update_own on public.saved_views
for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid() and public.is_org_member(organization_id));
create policy saved_views_delete_own on public.saved_views
for delete to authenticated
using (user_id = auth.uid());

-- Notifications: only recipient can see/mark read. Inserts come from triggers/server.
create policy notifications_select_own on public.notifications
for select to authenticated
using (user_id = auth.uid() and public.is_org_member(organization_id));
create policy notifications_update_own on public.notifications
for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());
create policy notifications_delete_own on public.notifications
for delete to authenticated
using (user_id = auth.uid());

-- Activity/audit.
create policy activity_select_visible on public.activity_logs
for select to authenticated
using (
  public.is_org_admin(organization_id)
  or (task_id is not null and public.can_read_task_id(task_id))
  or (node_id is not null and public.can_read_node(organization_id, node_id))
);
create policy security_audit_select_admin on public.security_audit_logs
for select to authenticated
using (organization_id is not null and public.is_org_admin(organization_id));

-- Invitations and subscription metadata.
create policy invitations_select_admin on public.invitations
for select to authenticated
using (public.is_org_admin(organization_id));
create policy subscriptions_select_admin on public.organization_subscriptions
for select to authenticated
using (public.is_org_admin(organization_id));

-- No client policy is created for platform_admins. Access it only from trusted server/SQL.

-- -----------------------------------------------------------------------------
-- 10) TABLE PRIVILEGES
-- Supabase evaluates GRANT privileges before RLS. We explicitly remove anon access.
-- -----------------------------------------------------------------------------
revoke all on all tables in schema public from anon;
revoke all on all tables in schema public from authenticated;
grant usage on schema public to authenticated;

grant select, update on public.profiles to authenticated;
grant select, update on public.organizations to authenticated;
grant select, update on public.organization_settings to authenticated;
grant select, insert, update, delete on public.organization_nodes to authenticated;
grant select on public.organization_node_closure to authenticated;
grant select, insert, update, delete on public.employees to authenticated;
grant select on public.organization_members to authenticated;
grant select on public.member_scopes to authenticated;
grant select, insert, update, delete on public.tasks to authenticated;
grant select on public.task_rollups to authenticated;
grant select, insert, delete on public.task_dependencies to authenticated;
grant select, insert, update, delete on public.task_checklist_items to authenticated;
grant select, insert, update, delete on public.task_comments to authenticated;
grant select, insert, update, delete on public.task_time_entries to authenticated;
grant select, insert, delete on public.task_attachments to authenticated;
grant select, insert, update, delete on public.user_pins to authenticated;
grant select, insert, delete on public.task_stars to authenticated;
grant select, insert, update, delete on public.saved_views to authenticated;
grant select, update, delete on public.notifications to authenticated;
grant select on public.activity_logs to authenticated;
grant select on public.security_audit_logs to authenticated;
grant select on public.invitations to authenticated;
grant select on public.organization_subscriptions to authenticated;

-- -----------------------------------------------------------------------------
-- 11) STORAGE: PRIVATE TASK ATTACHMENTS
-- Object path format: <organization_uuid>/<task_uuid>/<random-id>-<safe-filename>
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('worktree-files', 'worktree-files', false, 52428800)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit;

create or replace function public.safe_uuid(p_text text)
returns uuid
language plpgsql
immutable
as $$
begin
  return p_text::uuid;
exception when invalid_text_representation then
  return null;
end;
$$;

create or replace function public.storage_task_allowed(p_name text, p_write boolean default false)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_parts text[];
  v_org uuid;
  v_task uuid;
  v_task_org uuid;
begin
  v_parts := storage.foldername(p_name);
  if cardinality(v_parts) < 2 then return false; end if;
  v_org := public.safe_uuid(v_parts[1]);
  v_task := public.safe_uuid(v_parts[2]);
  if v_org is null or v_task is null then return false; end if;
  select organization_id into v_task_org from public.tasks where id = v_task;
  if v_task_org is null or v_task_org <> v_org then return false; end if;
  if p_write then return public.can_collaborate_task_id(v_task); end if;
  return public.can_read_task_id(v_task);
end;
$$;
revoke all on function public.storage_task_allowed(text,boolean) from public;
grant execute on function public.storage_task_allowed(text,boolean) to authenticated;

create policy storage_task_files_select
on storage.objects for select to authenticated
using (
  bucket_id = 'worktree-files'
  and public.storage_task_allowed(name, false)
);

create policy storage_task_files_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'worktree-files'
  and public.storage_task_allowed(name, true)
);

create policy storage_task_files_update
on storage.objects for update to authenticated
using (
  bucket_id = 'worktree-files'
  and public.storage_task_allowed(name, true)
  and (owner_id = auth.uid()::text or public.can_manage_task_id(public.safe_uuid((storage.foldername(name))[2])))
)
with check (
  bucket_id = 'worktree-files'
  and public.storage_task_allowed(name, true)
);

create policy storage_task_files_delete
on storage.objects for delete to authenticated
using (
  bucket_id = 'worktree-files'
  and public.storage_task_allowed(name, true)
  and (owner_id = auth.uid()::text or public.can_manage_task_id(public.safe_uuid((storage.foldername(name))[2])))
);

-- -----------------------------------------------------------------------------
-- 12) REALTIME - START SIMPLE WITH POSTGRES CHANGES
-- For very large concurrency, move high-volume channels to Realtime Broadcast.
-- -----------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'organization_nodes','employees','tasks','task_dependencies','task_checklist_items',
    'task_comments','task_time_entries','user_pins','notifications'
  ] loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

commit;

```

---

# 27. Sau khi chạy SQL: smoke test bằng frontend

Sau khi owner login và gọi `create_organization`, thử:

```js
// 1. Organization chỉ trả về workspace của user
console.log(await supabase.from('organizations').select('*'))

// 2. Tree
console.log(await supabase
  .from('organization_nodes')
  .select('*')
  .eq('organization_id', orgId))

// 3. Employee
console.log(await supabase
  .from('employees')
  .select('*')
  .eq('organization_id', orgId))

// 4. Task rollup
console.log(await supabase
  .from('task_rollups')
  .select('*')
  .eq('organization_id', orgId))
```

Sau đó login bằng user thuộc công ty khác và cố dùng `orgId` cũ. Kết quả phải không có dữ liệu.

---

# 28. Các phần chưa nên làm trực tiếp bằng SQL trong browser

### Gửi email invite

Database tạo token/hash và kiểm tra quyền. Việc gửi email nên ở Edge Function/server để giữ SMTP/API secret.

### Billing webhook

Stripe/Paddle/... webhook phải ở server/Edge Function và cập nhật `organization_subscriptions` bằng secret key sau khi verify chữ ký webhook.

### Platform administration

Các API cần nhìn xuyên tenant chỉ chạy phía server với audit rõ ràng.

### Xóa toàn bộ công ty

Không cho browser `DELETE organization`. Nên có quy trình server-side: suspend → grace period → export → delete Storage object → delete database rows.

---

# 29. Gợi ý thay đổi frontend WorkTree X hiện tại

Tách code thành 4 lớp thay vì để mọi thứ trong một file lớn:

```text
src/
├── supabase.js
├── auth.js
├── data/
│   ├── organizations.js
│   ├── nodes.js
│   ├── employees.js
│   ├── tasks.js
│   ├── comments.js
│   └── pins.js
├── realtime.js
└── ui/
    └── giao diện hiện tại
```

UI desktop/mobile hiện tại có thể giữ gần như nguyên vẹn; thay các hàm `persist()/localStorage` bằng repository gọi Supabase.

Một pattern nên dùng:

```js
async function getTasks(orgId) {
  const { data, error } = await supabase
    .from('task_rollups')
    .select('*')
    .eq('organization_id', orgId)
    .is('archived_at', null)

  if (error) throw error
  return data
}
```

**Không tự thêm filter bảo mật như `user_id=...` rồi coi đó là authorization.** Filter frontend chỉ tối ưu query; RLS mới là authority.

---

# 30. Tài liệu Supabase chính thức nên đối chiếu khi triển khai

- Auth: https://supabase.com/docs/guides/auth
- User data / profile trigger: https://supabase.com/docs/guides/auth/managing-user-data
- Password security: https://supabase.com/docs/guides/auth/password-security
- Rate limits: https://supabase.com/docs/guides/auth/rate-limits
- CAPTCHA: https://supabase.com/docs/guides/auth/auth-captcha
- Row Level Security: https://supabase.com/docs/guides/database/postgres/row-level-security
- API keys: https://supabase.com/docs/guides/getting-started/api-keys
- Storage access control: https://supabase.com/docs/guides/storage/security/access-control
- Storage helper functions: https://supabase.com/docs/guides/storage/schema/helper-functions
- Realtime Postgres Changes: https://supabase.com/docs/guides/realtime/postgres-changes
- Realtime Authorization/Broadcast: https://supabase.com/docs/guides/realtime/authorization
- Production checklist: https://supabase.com/docs/guides/deployment/going-into-prod

---

# 31. Kết luận kiến trúc

Với schema này, mô hình WorkTree X trở thành:

```text
Một Supabase project
        │
        ├── Organization A
        │    └── dữ liệu A
        │
        ├── Organization B
        │    └── dữ liệu B
        │
        └── Organization C
             └── dữ liệu C
```

Tất cả dùng chung code và database cluster nhưng **row được phân tách theo tenant bằng RLS**.

Điều này cho phép bạn triển khai:

- nhiều công ty tự đăng ký;
- mỗi công ty có owner/admin riêng;
- nhân viên được xếp phòng ban ngay khi tạo;
- phân quyền theo cây;
- task/comment/checklist/time realtime;
- pin cá nhân đồng bộ mọi thiết bị;
- file private;
- platform admin;
- billing theo organization;
- mở rộng từ phần mềm nội bộ thành SaaS.

**Điểm không được thỏa hiệp:** trước khi public, phải test RLS với hai tenant độc lập và cố tình truy cập UUID của tenant khác. UI đẹp không phải lớp bảo mật; database policy mới là lớp quyết định.
