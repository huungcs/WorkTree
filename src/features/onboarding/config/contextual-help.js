/**
 * WorkTree X — Contextual Help Configuration
 * High-value contextual help triggers explaining key concepts simply and clearly.
 */

export const CONTEXTUAL_HELP_TOPICS = {
  'org-tree-help': {
    id: 'org-tree-help',
    title: 'Cây tổ chức 5 cấp chuẩn mực',
    description: 'WorkTree X tổ chức dữ liệu theo thứ bậc logic: Công ty ➔ Phòng ban ➔ Dự án ➔ Nhóm ➔ Thư mục. Nhân sự được quản lý riêng và phân bổ vào các phòng ban phù hợp, không đặt lẫn lộn vào cây đơn vị.',
    tip: 'Bấm biểu tượng (+) trên thanh tiêu đề để thêm phòng ban hoặc dự án mới.',
    placement: 'right'
  },
  'task-form-assignee-help': {
    id: 'task-form-assignee-help',
    title: 'Người phụ trách chính (DRI)',
    description: 'Mỗi công việc có một người chịu trách nhiệm chính về tiến độ và kết quả bàn giao. Nếu có nhiều người cùng tham gia, hãy sử dụng danh sách Checklist để phân chia từng hạng mục cụ thể cho các thành viên.',
    tip: 'Có thể gán hạn hoàn thành và ước tính giờ làm việc để hệ thống cân đối tải tuần.',
    placement: 'top'
  },
  'pins-help': {
    id: 'pins-help',
    title: 'Ghim công việc ưu tiên',
    description: 'Khu vực ghim là không gian cá nhân của riêng bạn. Việc ghim một công việc giúp bạn theo dõi nhanh các đầu việc gấp mà không làm thay đổi thứ tự hay độ ưu tiên chung của nhóm.',
    tip: 'Bấm biểu tượng ghim trên thẻ công việc để đưa lên danh sách Ghim.',
    placement: 'right'
  },
  'checklist-progress-help': {
    id: 'checklist-progress-help',
    title: 'Tự tính tiến độ theo checklist',
    description: 'Khi bật tính năng này, phần trăm tiến độ của công việc sẽ tự động cập nhật tương ứng theo tỷ lệ các mục checklist hoàn thành (ví dụ: hoàn thành 2/4 mục sẽ tự động đạt 50% tiến độ).',
    tip: 'Mặc định checklist và tiến độ độc lập nhau để bạn chủ động điều chỉnh.',
    placement: 'left'
  },
  'filters-saved-views-help': {
    id: 'filters-saved-views-help',
    title: 'Bộ lọc & Góc nhìn đã lưu',
    description: 'Kết hợp các tiêu chí lọc (người phụ trách, trạng thái, thời hạn) và bấm biểu tượng (+) ở mục Góc nhìn đã lưu để lưu lại không gian làm việc thường dùng, giúp truy cập nhanh chỉ bằng một cú click.',
    tip: 'Góc nhìn đã lưu được đồng bộ lên tài khoản cá nhân của bạn.',
    placement: 'bottom'
  }
};

export const CONTEXTUAL_HELP = CONTEXTUAL_HELP_TOPICS;
