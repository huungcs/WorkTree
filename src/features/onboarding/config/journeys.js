/**
 * WorkTree X — Onboarding Journeys Configuration
 * Role-aware guided tour steps strictly matching existing capabilities and DOM elements.
 */

export const ONBOARDING_VERSION = 1;

export const JOURNEYS = {
  owner: {
    id: 'owner_v1',
    version: ONBOARDING_VERSION,
    role: 'owner',
    title: 'Hành trình Thiết lập Không gian Doanh nghiệp',
    welcome: {
      title: 'Chào mừng đến với WorkTree X',
      subtitle: 'Không gian làm việc & điều hành công việc doanh nghiệp',
      description: 'Hãy cùng làm quen với cấu trúc tổ chức và cách giao việc, theo dõi tiến độ một cách khoa học.',
      startLabel: 'Bắt đầu hướng dẫn (2 phút)',
      skipLabel: 'Tự khám phá'
    },
    steps: [
      {
        id: 'workspace-brand',
        targetKey: 'workspace-brand',
        title: '1/5. Không gian làm việc',
        body: 'Đây là không gian công ty của bạn. Bạn có thể bấm vào để chuyển đổi giữa các công ty con hoặc chi nhánh.',
        placement: 'bottom'
      },
      {
        id: 'org-tree',
        targetKey: 'org-tree',
        title: '2/5. Cây tổ chức 5 cấp',
        body: 'Cấu trúc quản lý chuẩn: Công ty ➔ Phòng ban ➔ Dự án ➔ Nhóm ➔ Thư mục. Bấm dấu (+) ở góc trên để thêm phòng ban hoặc dự án mới.',
        placement: 'right'
      },
      {
        id: 'access-nav',
        targetKey: 'access-nav',
        title: '3/5. Quản lý nhân sự & phân quyền',
        body: 'Mời thành viên tham gia, cấp mã nhân viên và phân chia phạm vi dữ liệu (Scopes) cho từng phòng ban cụ thể.',
        placement: 'top'
      },
      {
        id: 'new-task-btn',
        targetKey: 'new-task-btn',
        title: '4/5. Tạo & giao việc',
        body: 'Bấm nút này hoặc phím tắt N để tạo công việc mới, gán người phụ trách chính (DRI) và thời hạn hoàn thành.',
        placement: 'bottom',
        actionLabel: 'Thử mở form tạo việc',
        actionName: 'open-new-task'
      },
      {
        id: 'view-tabs',
        targetKey: 'view-tabs',
        title: '5/5. Bảy góc nhìn công việc',
        body: 'Theo dõi tiến độ linh hoạt qua Danh sách, Kanban, Dòng thời gian Gantt, Lịch tháng và Cân đối tải tuần (Workload).',
        placement: 'bottom'
      }
    ]
  },

  admin: {
    id: 'admin_v1',
    version: ONBOARDING_VERSION,
    role: 'admin',
    title: 'Hành trình Quản trị viên Không gian',
    welcome: {
      title: 'Chào mừng Quản trị viên đến với WorkTree X',
      subtitle: 'Điều hành và phân bổ công việc tổ chức',
      description: 'Khám phá các công cụ quản trị cây tổ chức, phân bổ nhân sự và điều phối luồng công việc.',
      startLabel: 'Bắt đầu hướng dẫn',
      skipLabel: 'Tự khám phá'
    },
    steps: [
      {
        id: 'workspace-brand',
        targetKey: 'workspace-brand',
        title: '1/5. Không gian làm việc',
        body: 'Không gian công ty bạn đang trực tiếp tham gia quản trị.',
        placement: 'bottom'
      },
      {
        id: 'org-tree',
        targetKey: 'org-tree',
        title: '2/5. Cây tổ chức & đơn vị',
        body: 'Quản lý các phòng ban, dự án và cấu trúc trực thuộc. Bấm vào từng đơn vị để lọc dữ liệu theo phạm vi.',
        placement: 'right'
      },
      {
        id: 'access-nav',
        targetKey: 'access-nav',
        title: '3/5. Tài khoản & phân quyền',
        body: 'Quản lý danh sách nhân sự, gửi lời mời tham gia và thiết lập quyền truy cập cho nhân viên.',
        placement: 'top'
      },
      {
        id: 'new-task-btn',
        targetKey: 'new-task-btn',
        title: '4/5. Khởi tạo & giao việc',
        body: 'Tạo công việc trong phạm vi được giao và phân bổ cho nhân sự phụ trách.',
        placement: 'bottom'
      },
      {
        id: 'view-tabs',
        targetKey: 'view-tabs',
        title: '5/5. Theo dõi tiến độ toàn diện',
        body: 'Chuyển đổi giữa 7 góc nhìn để nắm bắt tiến độ, phát hiện việc trễ hạn và cân đối tải tuần.',
        placement: 'bottom'
      }
    ]
  },

  manager: {
    id: 'manager_v1',
    version: ONBOARDING_VERSION,
    role: 'manager',
    title: 'Hành trình Quản lý Phòng ban & Dự án',
    welcome: {
      title: 'Chào mừng bạn đến với WorkTree X',
      subtitle: 'Quản lý công việc và điều phối đội ngũ',
      description: 'Làm quen với các công cụ theo dõi tiến độ công việc trong phạm vi bạn phụ trách.',
      startLabel: 'Xem hướng dẫn quản lý',
      skipLabel: 'Để sau'
    },
    steps: [
      {
        id: 'org-tree',
        targetKey: 'org-tree',
        title: '1/5. Phạm vi phụ trách',
        body: 'Cây tổ chức hiển thị các phòng ban và dự án bạn được phân quyền quản lý. Bấm chọn đơn vị để xem việc của nhóm.',
        placement: 'right'
      },
      {
        id: 'view-tabs',
        targetKey: 'view-tabs',
        title: '2/5. Đa góc nhìn công việc',
        body: 'Theo dõi tình trạng công việc qua bảng Kanban, danh sách tiến độ và lịch trình hoàn thành.',
        placement: 'bottom'
      },
      {
        id: 'new-task-btn',
        targetKey: 'new-task-btn',
        title: '3/5. Giao việc cho thành viên',
        body: 'Tạo công việc trong phạm vi quản lý và phân công cho nhân sự trong đội ngũ.',
        placement: 'bottom'
      },
      {
        id: 'workload-tab',
        targetKey: 'workload-tab',
        title: '4/5. Cân đối tải công việc',
        body: 'Theo dõi số giờ làm trong tuần của từng nhân viên để tránh quá tải hoặc thiếu việc.',
        placement: 'bottom'
      },
      {
        id: 'pin-section',
        targetKey: 'pin-section',
        title: '5/5. Ghim ưu tiên cá nhân',
        body: 'Ghim các công việc trọng tâm cần theo dõi sát sao lên góc làm việc riêng của bạn.',
        placement: 'right'
      }
    ]
  },

  member: {
    id: 'member_v1',
    version: ONBOARDING_VERSION,
    role: 'member',
    title: 'Hành trình Thành viên Không gian',
    welcome: {
      title: 'Chào mừng bạn đến với công ty',
      subtitle: 'Không gian làm việc & cộng tác hàng ngày',
      description: 'Tìm công việc được giao, cập nhật tiến độ và thảo luận cùng đồng nghiệp dễ dàng.',
      startLabel: 'Bắt đầu làm quen',
      skipLabel: 'Để sau'
    },
    steps: [
      {
        id: 'workspace-brand',
        targetKey: 'workspace-brand',
        title: '1/5. Không gian công ty',
        body: 'Bạn đang tham gia không gian làm việc của công ty. Mọi công việc và tài liệu được lưu trữ an toàn tại đây.',
        placement: 'bottom'
      },
      {
        id: 'my-tasks-nav',
        targetKey: 'my-tasks-nav',
        title: '2/5. Công việc của tôi',
        body: 'Nơi tập trung toàn bộ công việc bạn được giao phụ trách. Bấm vào đây để xem ngay những việc cần làm.',
        placement: 'right'
      },
      {
        id: 'view-tabs',
        targetKey: 'view-tabs',
        title: '3/5. Góc nhìn Danh sách & Kanban',
        body: 'Xem trực quan các việc Chưa làm, Đang làm, Đang duyệt và Hoàn thành.',
        placement: 'bottom'
      },
      {
        id: 'pin-section',
        targetKey: 'pin-section',
        title: '4/5. Ghim công việc ưu tiên',
        body: 'Đưa các việc gấp bạn cần chú ý lên khu vực Ghim riêng để không bao giờ bị trễ hạn.',
        placement: 'right'
      },
      {
        id: 'help-nav',
        targetKey: 'help-nav',
        title: '5/5. Trợ giúp & Hướng dẫn',
        body: 'Bấm biểu tượng (?) trên thanh trên cùng bất cứ lúc nào để xem lại hướng dẫn hoặc tra cứu phím tắt nhanh.',
        placement: 'bottom'
      }
    ]
  },

  viewer: {
    id: 'viewer_v1',
    version: ONBOARDING_VERSION,
    role: 'viewer',
    title: 'Hành trình Theo dõi & Tra cứu',
    welcome: {
      title: 'Chào mừng bạn đến với WorkTree X',
      subtitle: 'Xem tiến độ và báo cáo công việc',
      description: 'Làm quen với cách tra cứu, lọc thông tin và theo dõi tiến độ các dự án bạn được cấp quyền xem.',
      startLabel: 'Xem hướng dẫn',
      skipLabel: 'Tự khám phá'
    },
    steps: [
      {
        id: 'org-tree',
        targetKey: 'org-tree',
        title: '1/4. Phạm vi được cấp quyền',
        body: 'Cây tổ chức hiển thị các phòng ban và dự án bạn có quyền xem dữ liệu.',
        placement: 'right'
      },
      {
        id: 'view-tabs',
        targetKey: 'view-tabs',
        title: '2/4. Các chế độ xem trực quan',
        body: 'Chuyển đổi linh hoạt giữa Danh sách, Bảng Kanban, Dòng thời gian Gantt và Lịch tháng.',
        placement: 'bottom'
      },
      {
        id: 'filter-toolbar',
        targetKey: 'filter-toolbar',
        title: '3/4. Tìm kiếm & Lọc dữ liệu',
        body: 'Tìm nhanh công việc theo tên, lọc theo người phụ trách, mức độ ưu tiên hoặc trạng thái hoàn thành.',
        placement: 'bottom'
      },
      {
        id: 'help-nav',
        targetKey: 'help-nav',
        title: '4/4. Trợ giúp & Hướng dẫn',
        body: 'Tìm lại tài liệu hướng dẫn và tra cứu các phím tắt hữu ích tại đây.',
        placement: 'bottom'
      }
    ]
  }
};

export function getJourneyForRole(role) {
  const clean = (role || 'member').toLowerCase();
  return JOURNEYS[clean] || JOURNEYS.member;
}
