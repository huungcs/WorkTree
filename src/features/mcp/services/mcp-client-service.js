/**
 * WorkTree X Feature: MCP Client Service
 * Communicates with /api/mcp management API using the current user's Supabase JWT.
 * Uses isolated feature-slice architecture and never accesses secret keys in the browser.
 */

import { getSupabase } from '../../../lib/supabase/client.js';

export const McpClientService = {
  async getAccessToken() {
    const sb = await getSupabase();
    const { data: { session } } = await sb.auth.getSession();
    return session?.access_token || null;
  },

  async request(endpoint = '', options = {}) {
    const token = await this.getAccessToken();
    if (!token) {
      throw new Error('Yêu cầu đăng nhập để quản lý kết nối MCP.');
    }

    const res = await fetch(`/api/mcp${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...(options.headers || {})
      }
    });

    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok) {
      throw new Error(data?.error || 'Không thể kết nối máy chủ MCP. Vui lòng thử lại.');
    }
    return data;
  },

  async listMcpServers(organizationId) {
    if (!organizationId) throw new Error('Chưa chọn không gian làm việc.');
    const params = new URLSearchParams({ action: 'list', organizationId });
    const data = await this.request(`?${params.toString()}`, { method: 'GET' });
    return data.servers || [];
  },

  async listMcpLogs(organizationId, { mcpId = '', limit = 20 } = {}) {
    if (!organizationId) throw new Error('Chưa chọn không gian làm việc.');
    const params = new URLSearchParams({
      action: 'logs',
      organizationId,
      limit: String(limit)
    });
    if (mcpId) params.set('mcpId', mcpId);
    const data = await this.request(`?${params.toString()}`, { method: 'GET' });
    return {
      logs: data.logs || [],
      migrationRequired: Boolean(data.migrationRequired)
    };
  },

  async createMcpServer({
    organizationId,
    name,
    accessMode = 'full',
    scopeNodeIds = [],
    rateLimitPerMin = 60
  }) {
    if (!organizationId) throw new Error('Chưa chọn không gian làm việc.');
    const data = await this.request('', {
      method: 'POST',
      body: JSON.stringify({
        action: 'create',
        organizationId,
        name,
        accessMode,
        scopeNodeIds,
        rateLimitPerMin
      })
    });
    return data.server;
  },

  async rotateMcpKey({ organizationId, mcpId }) {
    if (!organizationId || !mcpId) throw new Error('Thiếu thông tin kết nối MCP.');
    const data = await this.request('', {
      method: 'POST',
      body: JSON.stringify({
        action: 'rotate',
        organizationId,
        mcpId
      })
    });
    return data.server;
  },

  async toggleMcpServer({ organizationId, mcpId, status }) {
    if (!organizationId || !mcpId) throw new Error('Thiếu thông tin kết nối MCP.');
    const data = await this.request('', {
      method: 'POST',
      body: JSON.stringify({
        action: 'toggle',
        organizationId,
        mcpId,
        status
      })
    });
    return data.server;
  },

  async deleteMcpServer({ organizationId, mcpId }) {
    if (!organizationId || !mcpId) throw new Error('Thiếu thông tin kết nối MCP.');
    const data = await this.request('', {
      method: 'POST',
      body: JSON.stringify({
        action: 'delete',
        organizationId,
        mcpId
      })
    });
    return data;
  }
};
