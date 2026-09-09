/**
 * WorkTree X - Supabase Client Adapter (Multi-Tenant V8)
 * 
 * Hướng dẫn cấu hình:
 * 1. Điền SUPABASE_URL và SUPABASE_KEY từ Supabase Dashboard của bạn.
 * 2. Publishable Key (sb_publishable_...) hoặc Anon Key an toàn để sử dụng ở frontend.
 * 3. Bảo vệ dữ liệu được thực thi bởi RLS (Row-Level Security) ở database.
 */

// Cấu hình kết nối Supabase
export const SUPABASE_CONFIG = {
  url: window.__ENV__?.SUPABASE_URL || 'https://YOUR_PROJECT_REF.supabase.co',
  publishableKey: window.__ENV__?.SUPABASE_PUBLISHABLE_KEY || 'YOUR_PUBLISHABLE_OR_ANON_KEY'
};

// Mapping dữ liệu giữa Database Supabase (English) và Giao diện WorkTree (Tiếng Việt)
export const STATUS_MAP = {
  dbToUi: {
    todo: 'Chưa làm',
    in_progress: 'Đang làm',
    review: 'Chờ duyệt',
    done: 'Hoàn thành'
  },
  uiToDb: {
    'Chưa làm': 'todo',
    'Đang làm': 'in_progress',
    'Chờ duyệt': 'review',
    'Hoàn thành': 'done'
  }
};

export const PRIORITY_MAP = {
  dbToUi: {
    urgent: 'Khẩn cấp',
    high: 'Cao',
    medium: 'Trung bình',
    low: 'Thấp'
  },
  uiToDb: {
    'Khẩn cấp': 'urgent',
    'Cao': 'high',
    'Trung bình': 'medium',
    'Thấp': 'low'
  }
};

export const ROLE_MAP = {
  owner: 'Chủ sở hữu',
  admin: 'Quản trị viên',
  manager: 'Quản lý',
  member: 'Nhân viên',
  viewer: 'Chỉ xem'
};
