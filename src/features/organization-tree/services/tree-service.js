/**
 * WorkTree X Feature: Organization Tree Service
 * Handles company / department / project / team / folder hierarchies,
 * node mutations, closure tree updates, and canonical domain mapping.
 */

import { NodeRepository, NODE_TYPE_MAP } from '../../../lib/supabase/repositories.js';
import { appState } from '../../../app/state.js';

/**
 * Translates Supabase / Postgres error to user-friendly Vietnamese text
 */
export function formatNodeErrorMessage(error) {
  if (!error) return 'Đã xảy ra lỗi không xác định.';
  const msg = error.message || String(error);

  if (error.code === '42501' || msg.includes('permission denied') || msg.includes('violates row-level security')) {
    return 'Bạn không có quyền thực hiện thao tác này. Chỉ Chủ sở hữu hoặc Quản trị viên mới có thể quản lý cơ cấu tổ chức.';
  }
  if (msg.includes('Cannot move a node to another organization')) {
    return 'Không thể chuyển đơn vị sang tổ chức khác.';
  }
  if (msg.includes('Root node must have type company')) {
    return 'Đơn vị gốc bắt buộc phải là cấp công ty.';
  }
  if (msg.includes('Only the root node can have type company')) {
    return 'Chỉ đơn vị gốc mới có thể là cấp công ty.';
  }
  if (msg.includes('Parent node does not exist in this organization')) {
    return 'Đơn vị cha không tồn tại trong tổ chức này.';
  }
  if (msg.includes('A node cannot be its own parent')) {
    return 'Một đơn vị không thể là cấp cha của chính nó.';
  }
  if (msg.includes('Cannot move a node into its own descendant')) {
    return 'Không thể di chuyển một đơn vị vào nhánh con của chính nó.';
  }
  if (msg.includes('Không thể lưu trữ hoặc xóa đơn vị công ty gốc.')) {
    return 'Không thể lưu trữ hoặc xóa đơn vị công ty gốc.';
  }
  if (msg.includes('Nhân sự không thuộc cây tổ chức')) {
    return 'Nhân sự không thuộc cây tổ chức (Invariant B). Hãy quản lý nhân sự tại danh sách nhân viên.';
  }
  if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('Network request failed')) {
    return 'Không thể kết nối máy chủ. Vui lòng kiểm tra đường truyền.';
  }
  return msg;
}

/**
 * Ánh xạ raw organization_nodes sang UI projection model
 */
export function mapCloudNodeToUI(n, fallbackOrgName = 'Không gian tổ chức') {
  return {
    id: n.id,
    parent: n.parent_id || null,
    type: n.type,
    name: n.name || fallbackOrgName,
    desc: n.description || '',
    capacity: n.capacity_hours_week || 40,
    sort_order: n.sort_order || 0,
    node_type: n.type,
    uiType: NODE_TYPE_MAP.dbToUi[n.type] || n.type
  };
}

export const TreeService = {
  async loadOrganizationTree(organizationId) {
    const flatNodes = await NodeRepository.getNodes(organizationId);
    return this.buildTreeHierarchy(flatNodes);
  },

  buildTreeHierarchy(flatNodes) {
    const nodeMap = new Map();
    const roots = [];

    flatNodes.forEach(node => {
      nodeMap.set(node.id, { ...node, children: [] });
    });

    flatNodes.forEach(node => {
      const mapped = nodeMap.get(node.id);
      if (node.parent_id && nodeMap.has(node.parent_id)) {
        nodeMap.get(node.parent_id).children.push(mapped);
      } else {
        roots.push(mapped);
      }
    });

    return roots;
  },

  /**
   * Tạo đơn vị mới trên Cloud
   */
  async createNode({
    organizationId,
    parentId = null,
    name,
    type = 'folder',
    description = '',
    capacityHoursWeek = 40,
    sortOrder = 0
  }) {
    const activeOrg = appState.activeOrganizationId;
    const targetOrg = organizationId || activeOrg;
    if (!targetOrg) {
      throw new Error('Chưa chọn không gian làm việc (active organization).');
    }

    try {
      const created = await NodeRepository.createNode({
        organizationId: targetOrg,
        parentId,
        name,
        type,
        description,
        capacityHoursWeek,
        sortOrder
      });

      // Reload fresh node list
      const freshNodes = await NodeRepository.getNodes(targetOrg);
      return {
        created: mapCloudNodeToUI(created),
        nodes: freshNodes.map(n => mapCloudNodeToUI(n))
      };
    } catch (err) {
      console.error('[TreeService.createNode error]', err);
      throw new Error(formatNodeErrorMessage(err));
    }
  },

  /**
   * Cập nhật / đổi tên đơn vị trên Cloud
   */
  async updateNode(nodeId, updates = {}) {
    if (!nodeId) throw new Error('Thiếu nodeId để cập nhật.');
    const activeOrg = appState.activeOrganizationId;

    try {
      const updated = await NodeRepository.updateNode(nodeId, updates);
      const freshNodes = await NodeRepository.getNodes(activeOrg);
      return {
        updated: mapCloudNodeToUI(updated),
        nodes: freshNodes.map(n => mapCloudNodeToUI(n))
      };
    } catch (err) {
      console.error('[TreeService.updateNode error]', err);
      throw new Error(formatNodeErrorMessage(err));
    }
  },

  /**
   * Lưu trữ (soft-archive) đơn vị
   */
  async archiveNode(nodeId) {
    if (!nodeId) throw new Error('Thiếu nodeId để lưu trữ.');
    const activeOrg = appState.activeOrganizationId;

    try {
      await NodeRepository.archiveNode(nodeId);
      const freshNodes = await NodeRepository.getNodes(activeOrg);
      return {
        nodes: freshNodes.map(n => mapCloudNodeToUI(n))
      };
    } catch (err) {
      console.error('[TreeService.archiveNode error]', err);
      throw new Error(formatNodeErrorMessage(err));
    }
  }
};
