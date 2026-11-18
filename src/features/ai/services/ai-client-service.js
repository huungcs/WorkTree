/**
 * WorkTree X Feature: AI Assistant Client Service
 * Calls /api/ai using the authenticated user's Supabase JWT.
 * Never touches or stores AI provider secret keys in the browser.
 */

import { getSupabase } from '../../../lib/supabase/client.js';

export const AiClientService = {
  async getAccessToken() {
    const sb = await getSupabase();
    const { data: { session } } = await sb.auth.getSession();
    return session?.access_token || null;
  },

  async request(endpoint = '', options = {}) {
    const token = await this.getAccessToken();
    if (!token) {
      throw new Error('Yêu cầu đăng nhập tài khoản đám mây để sử dụng Trợ lý AI.');
    }

    const res = await fetch(`/api/ai${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...(options.headers || {})
      }
    });

    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok) {
      throw new Error(data?.error || 'Không thể kết nối Trợ lý AI. Vui lòng thử lại.');
    }
    return data;
  },

  async getStatus(organizationId) {
    if (!organizationId) throw new Error('Chưa chọn không gian làm việc.');
    const params = new URLSearchParams({ action: 'status', organizationId });
    return await this.request(`?${params.toString()}`, { method: 'GET' });
  },

  async sendMessage({ organizationId, messages = [], promptPreset = null, promptArgs = null }) {
    if (!organizationId) throw new Error('Chưa chọn không gian làm việc.');
    return await this.request('', {
      method: 'POST',
      body: JSON.stringify({
        action: 'chat',
        organizationId,
        messages,
        ...(promptPreset ? { promptPreset, promptArgs: promptArgs || {} } : {})
      })
    });
  },

  async executeAction({ organizationId, toolName, arguments: toolArgs = {} }) {
    if (!organizationId || !toolName) throw new Error('Thiếu thông tin thao tác cần xác nhận.');
    return await this.request('', {
      method: 'POST',
      body: JSON.stringify({
        action: 'execute_action',
        organizationId,
        toolName,
        arguments: toolArgs
      })
    });
  }
};
