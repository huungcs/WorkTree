/**
 * WorkTree X Feature: User Pins Service
 * Personal priority pins (tasks & nodes) backed by Supabase Cloud (public.user_pins).
 */

import { PinRepository } from '../../../lib/supabase/repositories.js';

export const PinService = {
  async loadUserPins(organizationId) {
    return await PinRepository.getUserPins(organizationId);
  },

  async togglePin({ organizationId, targetType, kind, targetId, isUrgent = false }) {
    const resolvedType = targetType || kind;
    return await PinRepository.togglePin({ organizationId, targetType: resolvedType, kind: resolvedType, targetId, isUrgent });
  },

  async setPinUrgent({ organizationId, targetType, kind, targetId, pinId, isUrgent }) {
    const resolvedType = targetType || kind;
    return await PinRepository.setPinUrgent({ organizationId, targetType: resolvedType, kind: resolvedType, targetId, pinId, isUrgent });
  },

  async reorderPins({ organizationId, pinIdsInOrder, orderedPinIds }) {
    const ids = pinIdsInOrder || orderedPinIds;
    return await PinRepository.reorderPins({ organizationId, pinIdsInOrder: ids, orderedPinIds: ids });
  },

  async deletePin({ organizationId, pinId }) {
    return await PinRepository.deletePin({ organizationId, pinId });
  }
};
