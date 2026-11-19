/**
 * WorkTree X Feature: Task Share Client Service
 * Manages scoped external share links via /api/share using authenticated Supabase JWT.
 */

import { getSupabase } from '../../../lib/supabase/client.js';

export const TaskShareService = {
  async getAccessToken() {
    const sb = await getSupabase();
    const { data: { session } } = await sb.auth.getSession();
    return session?.access_token || null;
  },

  async request(endpoint = '', options = {}) {
    const token = await this.getAccessToken();
    if (!token) {
      throw new Error('Yêu cầu đăng nhập để quản lý chia sẻ công việc.');
    }

    const res = await fetch(`/api/share${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...(options.headers || {})
      }
    });

    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok) {
      const err = new Error(data?.error || 'Không thể xử lý yêu cầu chia sẻ công việc.');
      err.status = res.status;
      err.code = data?.code || null;
      throw err;
    }
    return data;
  },

  async listShareLinks(organizationId, taskId) {
    if (!organizationId || !taskId) throw new Error('Thiếu organizationId hoặc taskId.');
    const qs = new URLSearchParams({ action: 'list', organizationId, taskId });
    return await this.request(`?${qs.toString()}`, { method: 'GET' });
  },

  async createShareLink(organizationId, taskId, payload = {}) {
    if (!organizationId || !taskId) throw new Error('Thiếu organizationId hoặc taskId.');
    return await this.request('?action=create', {
      method: 'POST',
      body: JSON.stringify({ action: 'create', organizationId, taskId, ...payload })
    });
  },

  async toggleShareLink(organizationId, shareId) {
    if (!organizationId || !shareId) throw new Error('Thiếu organizationId hoặc shareId.');
    return await this.request('?action=toggle', {
      method: 'POST',
      body: JSON.stringify({ action: 'toggle', organizationId, shareId })
    });
  },

  async rotateShareLink(organizationId, shareId) {
    if (!organizationId || !shareId) throw new Error('Thiếu organizationId hoặc shareId.');
    return await this.request('?action=rotate', {
      method: 'POST',
      body: JSON.stringify({ action: 'rotate', organizationId, shareId })
    });
  },

  async revokeShareLink(organizationId, shareId) {
    if (!organizationId || !shareId) throw new Error('Thiếu organizationId hoặc shareId.');
    return await this.request('?action=delete', {
      method: 'POST',
      body: JSON.stringify({ action: 'delete', organizationId, shareId })
    });
  },

  async setOrgSharePolicy(organizationId, allowExternalTaskShare) {
    if (!organizationId) throw new Error('Thiếu organizationId.');
    return await this.request('?action=org_policy', {
      method: 'POST',
      body: JSON.stringify({
        action: 'org_policy',
        organizationId,
        allowExternalTaskShare: Boolean(allowExternalTaskShare)
      })
    });
  }
};
