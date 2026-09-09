/**
 * WorkTree X Feature: User Pins Service
 * Personal priority pins (tasks & nodes) backed by Supabase Cloud (public.user_pins).
 */

import { PinRepository } from '../../../lib/supabase/repositories.js';

export const PinService = {
  async loadUserPins(organizationId) {
    return await PinRepository.getUserPins(organizationId);
  },

  async togglePin({ organizationId, targetType, targetId, isUrgent = false }) {
    return await PinRepository.togglePin({ organizationId, targetType, targetId, isUrgent });
  },

  async setPinUrgent({ organizationId, targetType, targetId, isUrgent }) {
    return await PinRepository.setPinUrgent({ organizationId, targetType, targetId, isUrgent });
  },

  async reorderPins({ organizationId, pinIdsInOrder }) {
    return await PinRepository.reorderPins({ organizationId, pinIdsInOrder });
  },

  async deletePin({ organizationId, pinId }) {
    return await PinRepository.deletePin({ organizationId, pinId });
  }
};
