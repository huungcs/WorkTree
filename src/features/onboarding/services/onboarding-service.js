/**
 * WorkTree X — Onboarding Service
 * Handles persistence, eligibility determination, and real business state evaluators.
 * Follows AGENTS.md: RLS authoritative, no client secret key, namespace fallback.
 */

import { getSupabase } from '../../../lib/supabase/client.js';

class OnboardingServiceImpl {
  constructor() {
    this.context = {
      user: null,
      organization: null,
      role: 'member'
    };
  }

  /**
   * Set user and workspace context
   */
  setContext({ user, organization, role }) {
    this.context = {
      user: user || null,
      organization: organization || null,
      role: (role || 'member').toLowerCase()
    };
  }

  /**
   * Tạo storage key chuẩn cho namespace offline / local fallback
   */
  getLocalKey(userId, orgId, journeyId, version = 1) {
    const uId = userId || this.context.user?.id || 'anon';
    const oId = orgId || this.context.organization?.id || 'no_org';
    return `worktree_onboarding_${uId}_${oId}_${journeyId}_v${version}`;
  }

  /**
   * Lấy tiến độ onboarding từ Supabase Cloud với fallback LocalStorage
   */
  async getProgress(arg1, arg2, arg3, arg4) {
    let userId, orgId, journeyId, version;

    if (arg2 !== undefined) {
      userId = arg1;
      orgId = arg2;
      journeyId = arg3;
      version = arg4 || 1;
    } else {
      journeyId = arg1;
      userId = this.context.user?.id;
      orgId = this.context.organization?.id;
      version = 1;
    }

    if (!userId || !orgId) return null;
    const localKey = this.getLocalKey(userId, orgId, journeyId, version);

    let localData = null;
    try {
      const raw = localStorage.getItem(localKey);
      if (raw) localData = this._normalizeProgress(JSON.parse(raw));
    } catch (_) {}

    try {
      const supabase = await getSupabase();
      const { data, error } = await supabase
        .from('user_onboarding_progress')
        .select('*')
        .eq('user_id', userId)
        .eq('organization_id', orgId)
        .eq('journey_id', journeyId)
        .eq('journey_version', version)
        .maybeSingle();

      if (!error && data) {
        const normalized = this._normalizeProgress(data);
        // Cache to local
        try { localStorage.setItem(localKey, JSON.stringify(normalized)); } catch (_) {}
        return normalized;
      }
    } catch (err) {
      console.warn('[Onboarding] Không thể đọc tiến độ từ Cloud, sử dụng dữ liệu cục bộ:', err);
    }

    return localData;
  }

  /**
   * Chuẩn hóa dữ liệu tiến độ cho giao diện người dùng
   */
  _normalizeProgress(raw) {
    if (!raw) return null;
    const meta = raw.metadata || {};
    const stepIdx = typeof raw.step_index === 'number'
      ? raw.step_index
      : (raw.current_step !== null && raw.current_step !== undefined && !isNaN(Number(raw.current_step))
          ? Number(raw.current_step)
          : (typeof meta.step_index === 'number' ? meta.step_index : 0));
    const milestones = Array.isArray(raw.completed_milestones)
      ? raw.completed_milestones
      : (Array.isArray(meta.completed_milestones) ? meta.completed_milestones : []);

    return {
      ...raw,
      step_index: stepIdx,
      completed_milestones: milestones
    };
  }

  /**
   * Lưu tiến độ onboarding lên Cloud và cập nhật LocalStorage ngay lập tức
   */
  async saveProgress(params) {
    const userId = params.userId || this.context.user?.id;
    const orgId = params.orgId || this.context.organization?.id;
    const journeyId = params.journeyId;
    const version = params.version || 1;
    const currentStep = params.currentStep !== undefined ? params.currentStep : null;
    const completedSteps = params.completedSteps || [];
    const isCompleted = params.isCompleted || false;
    const isDismissed = params.isDismissed || false;
    const completedMilestones = params.completedMilestones || [];
    const metadata = params.metadata || {};

    if (!userId || !orgId) return null;

    const payloadMetadata = {
      ...metadata,
      step_index: typeof currentStep === 'number' ? currentStep : 0,
      completed_milestones: completedMilestones
    };

    // Payload chỉ chứa các cột thực tế trong bảng database public.user_onboarding_progress
    const payload = {
      user_id: userId,
      organization_id: orgId,
      journey_id: journeyId,
      journey_version: version,
      current_step: currentStep !== null && currentStep !== undefined ? String(currentStep) : '0',
      completed_steps: completedSteps,
      is_completed: isCompleted,
      is_dismissed: isDismissed,
      dismissed_at: isDismissed ? new Date().toISOString() : null,
      last_seen_at: new Date().toISOString(),
      metadata: payloadMetadata,
      updated_at: new Date().toISOString()
    };

    // Dữ liệu chuẩn hóa hoàn chỉnh cho UI & LocalStorage
    const normalizedData = {
      ...payload,
      step_index: typeof currentStep === 'number' ? currentStep : 0,
      completed_milestones: completedMilestones
    };

    // 1. Luôn lưu LocalStorage trước để phản hồi tức thì
    const localKey = this.getLocalKey(userId, orgId, journeyId, version);
    try {
      localStorage.setItem(localKey, JSON.stringify(normalizedData));
    } catch (_) {}

    // 2. Lưu lên Supabase Cloud
    try {
      const supabase = await getSupabase();
      const { data, error } = await supabase
        .from('user_onboarding_progress')
        .upsert(payload, {
          onConflict: 'user_id,organization_id,journey_id,journey_version'
        })
        .select()
        .maybeSingle();

      if (error) {
        console.warn('[Onboarding] Lỗi upsert tiến độ lên Cloud:', error.message);
        return normalizedData;
      }
      return this._normalizeProgress(data) || normalizedData;
    } catch (err) {
      console.warn('[Onboarding] Không thể lưu tiến độ lên Cloud (mạng gián đoạn):', err);
      return normalizedData;
    }
  }

  /**
   * Cập nhật bước đang xem trong tour
   */
  async updateStepProgress(journeyId, stepIndex, totalSteps) {
    const existing = await this.getProgress(journeyId) || {};
    const completedSteps = Array.isArray(existing.completed_steps) ? [...existing.completed_steps] : [];
    const stepKey = `step_${stepIndex}`;
    if (!completedSteps.includes(stepKey)) {
      completedSteps.push(stepKey);
    }

    return await this.saveProgress({
      journeyId,
      currentStep: stepIndex,
      completedSteps,
      isCompleted: stepIndex >= totalSteps - 1,
      isDismissed: existing.is_dismissed || false,
      completedMilestones: existing.completed_milestones || [],
      metadata: existing.metadata || {}
    });
  }

  /**
   * Đánh dấu hoàn thành toàn bộ tour
   */
  async markTourCompleted(journeyId) {
    const existing = await this.getProgress(journeyId) || {};
    return await this.saveProgress({
      journeyId,
      currentStep: existing.step_index || 0,
      completedSteps: existing.completed_steps || [],
      isCompleted: true,
      isDismissed: false,
      completedMilestones: existing.completed_milestones || [],
      metadata: existing.metadata || {}
    });
  }

  /**
   * Bỏ qua / dismiss tour
   */
  async dismissTour(journeyId) {
    const existing = await this.getProgress(journeyId) || {};
    return await this.saveProgress({
      journeyId,
      currentStep: existing.step_index || 0,
      completedSteps: existing.completed_steps || [],
      isCompleted: existing.is_completed || false,
      isDismissed: true,
      completedMilestones: existing.completed_milestones || [],
      metadata: existing.metadata || {}
    });
  }

  /**
   * Kiểm tra xem thẻ Getting Started Checklist có bị ẩn không
   */
  isCardDismissed() {
    const uId = this.context.user?.id || 'anon';
    const oId = this.context.organization?.id || 'no_org';
    return localStorage.getItem(`worktree_checklist_dismissed_${uId}_${oId}`) === 'true';
  }

  /**
   * Ẩn thẻ Getting Started Checklist
   */
  async dismissCard() {
    const uId = this.context.user?.id || 'anon';
    const oId = this.context.organization?.id || 'no_org';
    try {
      localStorage.setItem(`worktree_checklist_dismissed_${uId}_${oId}`, 'true');
    } catch (_) {}
  }

  /**
   * Khôi phục hiển thị thẻ Getting Started Checklist
   */
  async restoreCard() {
    const uId = this.context.user?.id || 'anon';
    const oId = this.context.organization?.id || 'no_org';
    try {
      localStorage.removeItem(`worktree_checklist_dismissed_${uId}_${oId}`);
    } catch (_) {}
  }

  /**
   * Lưu các mốc nghiệp vụ đã hoàn thành
   */
  async saveChecklistMilestones(milestones) {
    const journeyId = this.context.role === 'owner' || this.context.role === 'admin' ? 'owner' : this.context.role;
    const existing = await this.getProgress(journeyId) || {};
    const merged = Array.from(new Set([...(existing.completed_milestones || []), ...milestones]));

    return await this.saveProgress({
      journeyId,
      currentStep: existing.step_index || 0,
      completedSteps: existing.completed_steps || [],
      isCompleted: existing.is_completed || false,
      isDismissed: existing.is_dismissed || false,
      completedMilestones: merged,
      metadata: existing.metadata || {}
    });
  }

  /**
   * Kiểm tra điều kiện hiển thị Welcome Dialog
   */
  async isEligibleForWelcome(journeyId) {
    if (!this.context.user || !this.context.organization) return false;

    // Kiểm tra cloud / local progress
    const progress = await this.getProgress(journeyId);
    if (progress?.is_completed || progress?.is_dismissed) {
      return false;
    }

    // Không bật khi đang trong luồng khẩn cấp
    if (typeof window !== 'undefined') {
      const hash = window.location.hash || '';
      if (hash.includes('type=recovery') || hash.includes('type=invitation')) {
        return false;
      }
    }

    return true;
  }

  /**
   * Đánh giá trạng thái thực tế của Checklist trên Tổng quan
   * (Kiểm tra dữ liệu thực từ appState / database, không giả tạo)
   */
  async evaluateChecklist(journeyId, context = {}) {
    const role = (context.role || this.context.role || 'member').toLowerCase();
    const appState = context.appState || window.appState || {};
    const nodes = appState.nodes || [];
    const employees = appState.employees || [];
    const tasks = appState.tasks || [];
    const pins = appState.userPins || [];

    if (role === 'owner' || role === 'admin') {
      const hasStructure = nodes.length > 1;
      const hasEmployees = employees.length > 1;
      const hasTasks = tasks.length > 0;
      const hasAssignedDue = tasks.some(t => t.owner && t.due);

      return [
        {
          id: 'owner-setup-structure',
          title: 'Tổ chức không gian làm việc',
          description: 'Tạo phòng ban hoặc dự án trên Cây tổ chức.',
          completed: hasStructure,
          actionText: 'Thêm đơn vị',
          actionType: 'create-node'
        },
        {
          id: 'owner-add-employee',
          title: 'Thêm nhân viên nếu cần',
          description: 'Mời thành viên hoặc bổ sung nhân sự vào đội ngũ.',
          completed: hasEmployees,
          actionText: '+ Nhân viên',
          actionType: 'add-employee'
        },
        {
          id: 'owner-first-task',
          title: 'Tạo công việc đầu tiên',
          description: 'Đặt tên công việc, gán vào phòng ban/dự án phù hợp.',
          completed: hasTasks,
          actionText: 'Tạo việc ngay',
          actionType: 'create-task'
        },
        {
          id: 'owner-assign-deadline',
          title: 'Giao việc hoặc đặt hạn hoàn thành',
          description: 'Chỉ định người phụ trách và ngày hoàn thành rõ ràng.',
          completed: hasAssignedDue,
          actionText: 'Tạo việc có hạn',
          actionType: 'create-task'
        }
      ];
    }

    if (role === 'manager') {
      const hasTasks = tasks.length > 0;
      const hasAssignedDue = tasks.some(t => t.owner && t.due);
      const hasPins = pins.length > 0;

      return [
        {
          id: 'manager-scope',
          title: 'Khám phá phạm vi quản lý',
          description: 'Xem các nhánh phòng ban và dự án thuộc quyền điều hành.',
          completed: nodes.length > 1,
          actionText: 'Xem cây tổ chức',
          actionType: 'create-node'
        },
        {
          id: 'manager-filter-tasks',
          title: 'Theo dõi danh sách công việc',
          description: 'Xem các công việc đang mở trong phạm vi của bạn.',
          completed: hasTasks,
          actionText: 'Xem danh sách',
          actionType: 'my-tasks'
        },
        {
          id: 'manager-assign-work',
          title: 'Phân công hoặc cập nhật công việc',
          description: 'Giao việc cho thành viên trong quyền hạn của bạn.',
          completed: hasAssignedDue,
          actionText: 'Giao việc',
          actionType: 'create-task'
        },
        {
          id: 'manager-pin-important',
          title: 'Ghim công việc cần chú ý',
          description: 'Đưa các việc khẩn cấp hoặc dự án trọng tâm vào danh sách Ghim.',
          completed: hasPins,
          actionText: 'Ghim việc',
          actionType: 'pins'
        }
      ];
    }

    if (role === 'member') {
      const myId = appState.activeMembership?.employeeId || appState.user?.id || this.context.user?.id;
      const myTasks = tasks.filter(t => t.owner && (String(t.owner) === String(myId) || String(t.owner) === String(this.context.user?.id)));
      const hasAssigned = myTasks.length > 0;
      const hasDoneOrUpdated = myTasks.some(t => t.status !== 'Chưa làm' || t.progress > 0);
      const hasPins = pins.length > 0;

      return [
        {
          id: 'member-my-tasks',
          title: 'Mở Công việc của tôi',
          description: 'Khu vực tập trung toàn bộ nhiệm vụ được giao cho bạn.',
          completed: true,
          actionText: 'Mở ngay',
          actionType: 'my-tasks'
        },
        {
          id: 'member-view-assigned',
          title: 'Xem một công việc được giao',
          description: hasAssigned 
            ? `Bạn đang có ${myTasks.length} công việc được giao.`
            : 'Hiện tại bạn chưa có công việc được giao.',
          completed: hasAssigned,
          note: hasAssigned ? null : 'Bạn chưa có công việc được giao từ quản lý.',
          actionText: hasAssigned ? 'Xem việc' : null,
          actionType: hasAssigned ? 'my-tasks' : null
        },
        {
          id: 'member-update-progress',
          title: 'Thực hiện một cập nhật hoặc bình luận',
          description: 'Đổi trạng thái, tích checklist hoặc gửi bình luận trên công việc.',
          completed: hasDoneOrUpdated,
          actionText: 'Cập nhật việc',
          actionType: 'my-tasks'
        },
        {
          id: 'member-pin-focus',
          title: 'Ghim một công việc cần chú ý',
          description: 'Đưa việc quan trọng lên thanh ghim cá nhân để mở nhanh.',
          completed: hasPins,
          actionText: 'Mục Ghim',
          actionType: 'pins'
        }
      ];
    }

    // Viewer role
    return [
      {
        id: 'viewer-explore-tree',
        title: 'Làm quen Cây tổ chức',
        description: 'Khám phá cơ cấu phòng ban và các dự án trong công ty.',
        completed: nodes.length > 1,
        actionText: 'Xem cây',
        actionType: 'create-node'
      },
      {
        id: 'viewer-browse-tasks',
        title: 'Xem danh sách công việc',
        description: 'Quan sát các nhiệm vụ đang diễn ra và tiến độ chung.',
        completed: tasks.length > 0,
        actionText: 'Xem công việc',
        actionType: 'my-tasks'
      },
      {
        id: 'viewer-use-filters',
        title: 'Sử dụng bộ lọc và tìm kiếm',
        description: 'Tìm công việc theo trạng thái, mức ưu tiên hoặc người phụ trách.',
        completed: true,
        actionText: 'Tìm kiếm',
        actionType: 'my-tasks'
      },
      {
        id: 'viewer-track-progress',
        title: 'Theo dõi tiến độ dự án',
        description: 'Quan sát các chỉ số hoàn thành trên trang Tổng quan.',
        completed: true,
        actionText: 'Tổng quan',
        actionType: 'my-tasks'
      }
    ];
  }
}

export const OnboardingService = new OnboardingServiceImpl();
