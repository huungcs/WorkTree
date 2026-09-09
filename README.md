# WorkTree X (Phiên Bản V8)

> **Không gian điều hành công việc, quản lý dự án & phân quyền cục bộ (Local-First Workspace)**  
> *Hoạt động độc lập trên trình duyệt, không cần kết nối Internet, dữ liệu thuộc quyền kiểm soát của bạn.*

---

## 🌟 Giới Thiệu

**WorkTree X V8** là một hệ thống quản lý công việc và điều hành tổ chức đa cấp (Công ty → Phòng ban → Dự án → Nhóm → Nhân sự). Dự án được thiết kế theo triết lý **Local-First**, bảo đảm tốc độ phản hồi tức thì, bảo mật dữ liệu trên máy tính cá nhân và không phụ thuộc vào hạ tầng đám mây.

Phiên bản **V8** giới thiệu kiến trúc **Xác thực WebCrypto**, **Phân quyền 4 vai trò (Role Matrix)** và **Hệ thống ghim ưu tiên cá nhân (Priority Pins)**.

---

## 🚀 Tính Năng Nổi Bật

### 1. 🛡️ Phân Quyền & Bảo Mật Chuẩn Doanh Nghiệp (V8 Identity)
- **Mã hóa mật khẩu WebCrypto:** Dùng thuật toán `PBKDF2-SHA256` với 600.000 vòng lặp và muối ngẫu nhiên 128-bit.
- **Chống dò quét (Brute-force):** Khóa đăng nhập tạm thời 60 giây nếu nhập sai 5 lần liên tiếp.
- **Tự động khóa phiên an toàn:** Khóa sau 30 phút không hoạt động, tối đa 12 giờ cho một phiên.
- **Ma trận 4 vai trò:**
  - **Quản trị viên (`admin`):** Toàn quyền quản trị, cấu trúc cây, quản lý tài khoản, sao lưu JSON.
  - **Quản lý (`manager`):** Điều hành các dự án/phòng ban trong phạm vi được cấp phép.
  - **Nhân viên (`member`):** Chỉ xem và xử lý các công việc được giao cho bản thân.
  - **Chỉ xem (`viewer`):** Xem báo cáo, không được chỉnh sửa dữ liệu.

### 2. 📌 Ghim Ưu Tiên Cá Nhân (Priority Pins)
- Cho phép từng tài khoản ghim nhanh các dự án hoặc công việc quan trọng lên đầu thanh điều hướng.
- Đánh dấu cờ khẩn cấp (`urgent`), sắp xếp thứ tự tùy ý và hỗ trợ hoàn tác.

### 3. 📊 7 Chế Độ Xem Đa Chiều
- **Tổng quan (Overview):** KPI tiến độ, biểu đồ phân bổ trạng thái Donut SVG, gợi ý hành động thông minh.
- **Danh sách (List):** Bảng quản lý chi tiết, phân trang, lọc đa tiêu chí, thao tác hàng loạt (Bulk actions).
- **Bảng Kanban:** Kéo thả linh hoạt 4 cột trạng thái (*Chưa làm, Đang làm, Chờ duyệt, Hoàn thành*).
- **Tiến độ (Timeline / Gantt):** Biểu đồ tiến độ 14 hoặc 28 ngày kèm tính năng tự ước lượng ngày bắt đầu.
- **Lịch (Calendar):** Quản lý thời hạn công việc theo lịch tháng trực quan.
- **Tải công việc (Workload):** Đối soát năng lực giờ làm tuần của từng nhân sự, cảnh báo quá tải (>100%).
- **Đơn vị con (Children / Folders):** Trực quan hóa cấu trúc nhánh dưới dạng lưới thẻ thư mục.

### 4. 📱 Giao Diện Tối Ưu Mọi Thiết Bị (V8 Mobile Touch)
- Giao diện riêng biệt cho thiết bị di động (< 900px) với thanh điều hướng đáy (Bottom Bar).
- Hỗ trợ đầy đủ cử chỉ chạm, hộp thoại trượt (Bottom Sheets) và tương thích bàn phím ảo (`visualViewport`).

### 5. 💾 Quản Lý Dữ Liệu An Toàn
- Đồng bộ đa tab và cơ chế cảnh báo chống ghi đè dữ liệu.
- Lưu trữ bản sao lưu dự phòng tự động trước mỗi lần sửa đổi.
- Xuất/Nhập JSON bảo toàn dữ liệu và Xuất báo cáo CSV chuẩn hóa.

---

## 📁 Cấu Trúc Thư Mục

```
WorkTree/
├── index.html            # File khởi chạy giao diện dạng Module (tải CSS & JS riêng)
├── WorkTree.html         # File chạy độc lập All-in-One (nhúng sẵn toàn bộ CSS & JS)
├── server.js             # Local HTTP server nhẹ (Node.js thuần, 0 dependency)
├── package.json          # Cấu hình dự án & scripts (start, dev, bundle)
├── .gitignore            # Danh sách loại trừ file tạm khi đẩy lên Git
│
├── css/
│   └── style.css         # Toàn bộ CSS giao diện, dark/light mode, mobile responsive
│
└── js/
    ├── core.js           # Dữ liệu SEED, cây tổ chức, bảng Kanban, Lịch, Quản lý task
    ├── access.js         # Phân quyền V8, xác thực WebCrypto PBKDF2, Ghim ưu tiên
    └── mobile.js         # Giao diện chạm và điều hướng di động
```

---

## ⚡ Cài Đặt & Chạy Ứng Dụng

### Cách 1: Chạy trực tiếp từ file (Không cần cài đặt)
Chỉ cần nhấp đúp vào file `index.html` hoặc `WorkTree.html` để mở trên bất kỳ trình duyệt nào.

### Cách 2: Chạy qua Localhost Server (Khuyến nghị)
1. Cài đặt **Node.js** (phiên bản 18+).
2. Mở Terminal trong thư mục dự án và chạy:
   ```bash
   npm start
   ```
3. Truy cập trình duyệt tại:
   - **Giao diện chuẩn:** `http://localhost:8080`
   - **Bản file đơn:** `http://localhost:8080/WorkTree.html`

### Cách đóng gói lại file đơn `WorkTree.html` sau khi sửa code:
```bash
npm run bundle
```

---

## 🌿 Hướng Dẫn Đẩy Dự Án Lên Git (GitHub / GitLab)

### Bước 1: Khởi tạo Git Repo và Commit lần đầu (nếu chưa làm):
```bash
git init
git add .
git commit -m "feat: khoi tao du an WorkTree X V8"
```

### Bước 2: Tạo Repo mới trên GitHub hoặc GitLab
1. Truy cập [GitHub](https://github.com/new) và tạo một repository mới (ví dụ: `worktree-x-v8`).
2. Copy đường dẫn repository (dạng `https://github.com/<username>/<repo-name>.git`).

### Bước 3: Liên kết và Đẩy lên remote:
```bash
git branch -M main
git remote add origin <URL_REPOSITORY_CUA_BAN>
git push -u origin main
```

---

## 📄 Bản Quyền
Dự án được phân phối dưới giấy phép **MIT License**.
