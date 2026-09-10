/**
 * WorkTree X — Secure Supabase Realtime Service (Step 10)
 * 
 * Invariants:
 *  - Database is the sole source of truth. Realtime events serve as invalidation signals.
 *  - All client UI updates happen through canonical RLS-protected repository refetches.
 *  - Workspace channels: 'org:<organization_id>:workspace' (filtered by organization_id).
 *  - Task detail channels: 'task:<task_id>:details' (filtered by task_id).
 *  - Strict lifecycle management: channels are cleanly removed on workspace switch,
 *    task drawer open/close, and logout. No abandoned channels or memory growth.
 *  - Debounces rapid bursts (150ms) to avoid request storms and out-of-order race conditions.
 *  - Idempotent canonical refetches eliminate duplicate items and flicker.
 */

import { getSupabase } from '../../../lib/supabase/client.js';

class RealtimeServiceManager {
  constructor() {
    this.workspaceChannel = null;
    this.taskDetailChannel = null;
    this.activeOrgId = null;
    this.activeTaskId = null;
    this.connectionStatus = 'offline'; // 'connecting' | 'connected' | 'reconnecting' | 'offline' | 'error'
    this.wasConnected = false;
    this.statusListeners = new Set();

    // Debounce timers by key
    this.debounceTimers = new Map();

    // Local mutation tracking for self-event deduplication
    this.recentLocalMutations = new Map(); // key -> timestamp

    // Callbacks
    this.workspaceCallbacks = null;
    this.taskDetailCallbacks = null;
  }

  /**
   * Đăng ký lắng nghe thay đổi trạng thái kết nối
   */
  onConnectionStatusChange(listener) {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  setConnectionStatus(status) {
    if (this.connectionStatus === status) return;
    this.connectionStatus = status;
    this.statusListeners.forEach(listener => {
      try {
        listener(status);
      } catch (err) {
        console.error('[Realtime] Lỗi listener trạng thái:', err);
      }
    });
  }

  getConnectionStatus() {
    return this.connectionStatus;
  }

  /**
   * Ghi nhận mutation cục bộ vừa thực thi để khử trùng lặp (self-event deduplication)
   */
  notifyLocalMutation(resource, id) {
    if (!resource || !id) return;
    const key = `${resource}:${id}`;
    this.recentLocalMutations.set(key, Date.now());
    // Tự động dọn dẹp sau 5 giây
    setTimeout(() => {
      if (this.recentLocalMutations.get(key) <= Date.now() - 4500) {
        this.recentLocalMutations.delete(key);
      }
    }, 5000);
  }

  isRecentLocalMutation(resource, id) {
    if (!resource || !id) return false;
    const key = `${resource}:${id}`;
    const ts = this.recentLocalMutations.get(key);
    if (!ts) return false;
    return (Date.now() - ts) < 3000;
  }

  /**
   * Thực thi callback được debounce để hợp nhất các event dồn dập
   */
  debounce(key, fn, delay = 150) {
    if (this.debounceTimers.has(key)) {
      clearTimeout(this.debounceTimers.get(key));
    }
    const timer = setTimeout(async () => {
      this.debounceTimers.delete(key);
      try {
        await fn();
      } catch (err) {
        console.error(`[Realtime] Lỗi xử lý callback debounce [${key}]:`, err);
      }
    }, delay);
    this.debounceTimers.set(key, timer);
  }

  /**
   * Đăng ký kênh Workspace (tasks, organization_nodes, employees)
   */
  async subscribeWorkspace(orgId, callbacks = {}) {
    if (!orgId) return null;

    // Nếu đã đăng ký đúng tổ chức này, cập nhật callbacks và giữ nguyên kênh
    if (this.workspaceChannel && this.activeOrgId === orgId) {
      this.workspaceCallbacks = callbacks;
      return this.workspaceChannel;
    }

    // Nếu đổi tổ chức, hủy kênh cũ trước
    if (this.workspaceChannel) {
      await this.unsubscribeWorkspace();
    }

    this.activeOrgId = orgId;
    this.workspaceCallbacks = callbacks;
    this.setConnectionStatus('connecting');

    const supabase = await getSupabase();
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        await supabase.realtime.setAuth(session.access_token);
      }
    } catch (authErr) {
      console.warn('[Realtime] Không thể thiết lập auth token cho realtime:', authErr);
    }

    const channelName = `org:${orgId}:workspace`;
    const channel = supabase.channel(channelName, { config: { private: true } });

    // 1. tasks changes
    channel.on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'tasks',
      filter: `organization_id=eq.${orgId}`
    }, (payload) => {
      const isLocal = this.isRecentLocalMutation('tasks', payload.new?.id || payload.old?.id);
      this.debounce(`workspace:tasks:${orgId}`, () => {
        if (this.workspaceCallbacks?.onTaskChange) {
          this.workspaceCallbacks.onTaskChange(payload, { isLocal });
        }
      }, 150);
    });

    // 2. organization_nodes changes
    channel.on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'organization_nodes',
      filter: `organization_id=eq.${orgId}`
    }, (payload) => {
      const isLocal = this.isRecentLocalMutation('nodes', payload.new?.id || payload.old?.id);
      this.debounce(`workspace:nodes:${orgId}`, () => {
        if (this.workspaceCallbacks?.onNodeChange) {
          this.workspaceCallbacks.onNodeChange(payload, { isLocal });
        }
      }, 200);
    });

    // 3. employees changes
    channel.on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'employees',
      filter: `organization_id=eq.${orgId}`
    }, (payload) => {
      const isLocal = this.isRecentLocalMutation('employees', payload.new?.id || payload.old?.id);
      this.debounce(`workspace:employees:${orgId}`, () => {
        if (this.workspaceCallbacks?.onEmployeeChange) {
          this.workspaceCallbacks.onEmployeeChange(payload, { isLocal });
        }
      }, 200);
    });

    channel.subscribe((status, err) => {
      if (status === 'SUBSCRIBED') {
        const isReconnect = this.wasConnected;
        this.wasConnected = true;
        this.setConnectionStatus('connected');
        if (this.workspaceCallbacks?.onSubscribed) {
          this.workspaceCallbacks.onSubscribed(channelName, { isReconnect });
        }
        if (isReconnect && this.workspaceCallbacks?.onReconnect) {
          this.workspaceCallbacks.onReconnect();
        }
      } else if (status === 'TIMED_OUT' || status === 'CHANNEL_ERROR') {
        console.warn(`[Realtime] Workspace channel ${channelName} status:`, status, err);
        this.setConnectionStatus('reconnecting');
      } else if (status === 'CLOSED') {
        this.setConnectionStatus('offline');
      }
    });

    this.workspaceChannel = channel;
    return channel;
  }

  /**
   * Hủy đăng ký kênh Workspace
   */
  async unsubscribeWorkspace() {
    if (this.workspaceChannel) {
      const ch = this.workspaceChannel;
      this.workspaceChannel = null;
      this.activeOrgId = null;
      this.workspaceCallbacks = null;

      try {
        const supabase = await getSupabase();
        await supabase.removeChannel(ch);
      } catch (err) {
        console.warn('[Realtime] Lỗi xóa workspace channel:', err);
      }
    }
  }

  /**
   * Đăng ký kênh Task Detail (checklist, dependencies, comments, time entries, attachments)
   */
  async subscribeTaskDetail(taskId, orgId, callbacks = {}) {
    if (!taskId) return null;

    // Nếu đã đăng ký đúng task này, cập nhật callbacks và giữ nguyên kênh
    if (this.taskDetailChannel && this.activeTaskId === taskId) {
      this.taskDetailCallbacks = callbacks;
      return this.taskDetailChannel;
    }

    // Nếu đổi task, hủy kênh task cũ trước
    if (this.taskDetailChannel) {
      await this.unsubscribeTaskDetail();
    }

    this.activeTaskId = taskId;
    this.taskDetailCallbacks = callbacks;

    const supabase = await getSupabase();
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        await supabase.realtime.setAuth(session.access_token);
      }
    } catch (authErr) {
      console.warn('[Realtime] Không thể thiết lập auth token cho task realtime:', authErr);
    }

    const channelName = `task:${taskId}:details`;
    const channel = supabase.channel(channelName, { config: { private: true } });

    // 1. Checklist changes
    channel.on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'task_checklist_items',
      filter: `task_id=eq.${taskId}`
    }, (payload) => {
      const isLocal = this.isRecentLocalMutation('checklist', payload.new?.id || payload.old?.id);
      this.debounce(`task:${taskId}:checklist`, () => {
        if (this.taskDetailCallbacks?.onChecklistChange && this.activeTaskId === taskId) {
          this.taskDetailCallbacks.onChecklistChange(payload, { isLocal });
        }
      }, 100);
    });

    // 2. Dependencies changes (task_id)
    channel.on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'task_dependencies',
      filter: `task_id=eq.${taskId}`
    }, (payload) => {
      const isLocal = this.isRecentLocalMutation('dependencies', payload.new?.id || payload.old?.id);
      this.debounce(`task:${taskId}:dependencies`, () => {
        if (this.taskDetailCallbacks?.onDependencyChange && this.activeTaskId === taskId) {
          this.taskDetailCallbacks.onDependencyChange(payload, { isLocal });
        }
      }, 100);
    });

    // Dependencies changes (dependent_task_id)
    channel.on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'task_dependencies',
      filter: `dependent_task_id=eq.${taskId}`
    }, (payload) => {
      this.debounce(`task:${taskId}:dependencies_rev`, () => {
        if (this.taskDetailCallbacks?.onDependencyChange && this.activeTaskId === taskId) {
          this.taskDetailCallbacks.onDependencyChange(payload, { isLocal: false });
        }
      }, 100);
    });

    // 3. Comments changes
    channel.on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'task_comments',
      filter: `task_id=eq.${taskId}`
    }, (payload) => {
      const isLocal = this.isRecentLocalMutation('comments', payload.new?.id || payload.old?.id);
      this.debounce(`task:${taskId}:comments`, () => {
        if (this.taskDetailCallbacks?.onCommentChange && this.activeTaskId === taskId) {
          this.taskDetailCallbacks.onCommentChange(payload, { isLocal });
        }
      }, 100);
    });

    // 4. Time entries changes
    channel.on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'task_time_entries',
      filter: `task_id=eq.${taskId}`
    }, (payload) => {
      const isLocal = this.isRecentLocalMutation('time_entries', payload.new?.id || payload.old?.id);
      this.debounce(`task:${taskId}:time_entries`, () => {
        if (this.taskDetailCallbacks?.onTimeEntryChange && this.activeTaskId === taskId) {
          this.taskDetailCallbacks.onTimeEntryChange(payload, { isLocal });
        }
      }, 100);
    });

    // 5. Attachments changes (Metadata only - never preloads Storage binary!)
    channel.on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'task_attachments',
      filter: `task_id=eq.${taskId}`
    }, (payload) => {
      const isLocal = this.isRecentLocalMutation('attachments', payload.new?.id || payload.old?.id);
      this.debounce(`task:${taskId}:attachments`, () => {
        if (this.taskDetailCallbacks?.onAttachmentChange && this.activeTaskId === taskId) {
          this.taskDetailCallbacks.onAttachmentChange(payload, { isLocal });
        }
      }, 100);
    });

    // 6. Task direct metadata changes (title, status, priority, description, etc.)
    channel.on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'tasks',
      filter: `id=eq.${taskId}`
    }, (payload) => {
      const isLocal = this.isRecentLocalMutation('tasks', taskId);
      this.debounce(`task:${taskId}:meta`, () => {
        if (this.taskDetailCallbacks?.onTaskMetaChange && this.activeTaskId === taskId) {
          this.taskDetailCallbacks.onTaskMetaChange(payload, { isLocal });
        }
      }, 100);
    });

    channel.subscribe((status, err) => {
      if (status === 'SUBSCRIBED') {
        if (this.taskDetailCallbacks?.onSubscribed) {
          this.taskDetailCallbacks.onSubscribed(channelName);
        }
      } else if (status === 'TIMED_OUT' || status === 'CHANNEL_ERROR') {
        console.warn(`[Realtime] Task channel ${channelName} status:`, status, err);
      }
    });

    this.taskDetailChannel = channel;
    return channel;
  }

  /**
   * Hủy đăng ký kênh Task Detail khi đóng Drawer hoặc chuyển Task
   */
  async unsubscribeTaskDetail() {
    if (this.taskDetailChannel) {
      const ch = this.taskDetailChannel;
      this.taskDetailChannel = null;
      this.activeTaskId = null;
      this.taskDetailCallbacks = null;

      try {
        const supabase = await getSupabase();
        await supabase.removeChannel(ch);
      } catch (err) {
        console.warn('[Realtime] Lỗi xóa task detail channel:', err);
      }
    }
  }

  /**
   * Xóa sạch toàn bộ channels (workspace switch, logout, unmount)
   */
  async cleanupAll() {
    // Clear all pending debounce timers
    this.debounceTimers.forEach(timer => clearTimeout(timer));
    this.debounceTimers.clear();
    this.recentLocalMutations.clear();

    await this.unsubscribeTaskDetail();
    await this.unsubscribeWorkspace();
    this.setConnectionStatus('offline');
  }

  /**
   * Lấy danh sách tên kênh đang hoạt động
   */
  async getActiveChannelTopics() {
    try {
      const supabase = await getSupabase();
      return (supabase.getChannels() || []).map(ch => ch.topic);
    } catch (e) {
      return [];
    }
  }
}

export const RealtimeService = new RealtimeServiceManager();
