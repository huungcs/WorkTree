/**
 * WorkTree X Feature: Task Star Service
 * Personal task favorites backed by Supabase Cloud (public.task_stars).
 */

import { StarRepository } from '../../../lib/supabase/repositories.js';

export const StarService = {
  async loadStarredTaskIds(organizationId) {
    return await StarRepository.getStarredTaskIds(organizationId);
  },

  async toggleStar({ organizationId, taskId }) {
    return await StarRepository.toggleStar({ organizationId, taskId });
  }
};
