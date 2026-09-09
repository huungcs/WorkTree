/**
 * WorkTree X Feature: Organization Tree Service
 * Handles company / department / project / team / folder hierarchies.
 */

import { NodeRepository } from '../../../lib/supabase/repositories.js';

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

  async createNode(params) {
    return await NodeRepository.createNode(params);
  }
};
