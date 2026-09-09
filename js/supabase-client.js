/**
 * WorkTree X - Supabase Client & Service Adapter (Multi-Tenant V8)
 * Project: taupjuaficdzdgbmxmbe
 */

export const SUPABASE_CONFIG = {
  url: 'https://taupjuaficdzdgbmxmbe.supabase.co',
  publishableKey: 'sb_publishable_U_sRQahpts_YouuXX5xbJQ_wpohAq4t'
};

// Data Enum Mappings (Database English <-> UI Tiếng Việt)
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

let supabaseInstance = null;

/**
 * Khởi tạo hoặc lấy instance Supabase Client
 */
export async function getSupabase() {
  if (supabaseInstance) return supabaseInstance;

  // Nếu Supabase SDK đã được nạp qua script tag trên window
  if (window.supabase?.createClient) {
    supabaseInstance = window.supabase.createClient(
      SUPABASE_CONFIG.url,
      SUPABASE_CONFIG.publishableKey,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      }
    );
    return supabaseInstance;
  }

  // Tải động thư viện qua ESM nếu chưa có sẵn
  try {
    const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
    supabaseInstance = createClient(
      SUPABASE_CONFIG.url,
      SUPABASE_CONFIG.publishableKey,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      }
    );
    return supabaseInstance;
  } catch (err) {
    console.error('Không thể tải Supabase JS SDK:', err);
    throw new Error('Chưa kết nối được tới Supabase SDK. Vui lòng kiểm tra internet hoặc script tag.');
  }
}

/**
 * 1. Xác thực Auth
 */
export async function authSignUp(email, password, fullName) {
  const sb = await getSupabase();
  const { data, error } = await sb.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName }
    }
  });
  if (error) throw error;
  return data;
}

export async function authSignIn(email, password) {
  const sb = await getSupabase();
  const { data, error } = await sb.auth.signInWithPassword({
    email,
    password
  });
  if (error) throw error;
  return data;
}

export async function authSignOut() {
  const sb = await getSupabase();
  const { error } = await sb.auth.signOut();
  if (error) throw error;
}

export async function authGetUser() {
  const sb = await getSupabase();
  const { data: { user } } = await sb.auth.getUser();
  return user;
}

/**
 * 2. Tổ chức (Organizations)
 */
export async function createOrganization(name, slug, timezone = 'Asia/Ho_Chi_Minh') {
  const sb = await getSupabase();
  const { data: organizationId, error } = await sb.rpc('create_organization', {
    p_name: name,
    p_slug: slug,
    p_timezone: timezone
  });
  if (error) throw error;
  return organizationId;
}

export async function getOrganizations() {
  const sb = await getSupabase();
  const { data, error } = await sb
    .from('organizations')
    .select('id, name, slug, root_node_id, timezone, status')
    .order('name');
  if (error) throw error;
  return data || [];
}

/**
 * 3. Cây tổ chức (Organization Nodes)
 */
export async function getOrganizationNodes(organizationId) {
  const sb = await getSupabase();
  const { data, error } = await sb
    .from('organization_nodes')
    .select('*')
    .eq('organization_id', organizationId)
    .is('archived_at', null)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return data || [];
}

/**
 * 4. Nhân viên (Employees)
 */
export async function getEmployees(organizationId) {
  const sb = await getSupabase();
  const { data, error } = await sb
    .from('employees')
    .select('id, full_name, email, employee_code, job_title, home_node_id, employment_status')
    .eq('organization_id', organizationId)
    .eq('employment_status', 'active');
  if (error) throw error;
  return data || [];
}

/**
 * 5. Công việc (Tasks từ view task_rollups)
 */
export async function getTasks(organizationId) {
  const sb = await getSupabase();
  const { data, error } = await sb
    .from('task_rollups')
    .select('*')
    .eq('organization_id', organizationId)
    .is('archived_at', null)
    .order('due_date', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function updateTaskStatus(taskId, statusUi) {
  const sb = await getSupabase();
  const dbStatus = STATUS_MAP.uiToDb[statusUi] || statusUi;
  const { data, error } = await sb
    .from('tasks')
    .update({ status: dbStatus })
    .eq('id', taskId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * 6. Ghim cá nhân (User Pins)
 */
export async function getUserPins(organizationId) {
  const sb = await getSupabase();
  const { data, error } = await sb
    .from('user_pins')
    .select('*')
    .eq('organization_id', organizationId)
    .order('position', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function pinItem(organizationId, targetType, targetId, isUrgent = false) {
  const sb = await getSupabase();
  const user = await authGetUser();
  if (!user) throw new Error('Cần đăng nhập để ghim ưu tiên.');

  const payload = {
    organization_id: organizationId,
    user_id: user.id,
    is_urgent: isUrgent
  };

  if (targetType === 'task') {
    payload.task_id = targetId;
  } else {
    payload.node_id = targetId;
  }

  const { data, error } = await sb
    .from('user_pins')
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data;
}
