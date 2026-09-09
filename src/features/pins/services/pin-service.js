/**
 * WorkTree X Feature: User Pins Service
 * Personal priority pins (tasks & nodes).
 */

import { PinRepository } from '../../../lib/supabase/repositories.js';

export const PinService = {
  async loadUserPins(organizationId) {
    return await PinRepository.getUserPins(organizationId);
  },

  async togglePin({ organizationId, targetType, targetId, isUrgent = false }) {
    return await PinRepository.togglePin({ organizationId, targetType, targetId, isUrgent });
  }
};
