/**
 * WorkTree X Feature: Saved Views Service
 * Personal query preferences and filter presets backed by Supabase Cloud (public.saved_views).
 */

import { SavedViewRepository } from '../../../lib/supabase/repositories.js';

export const SavedViewService = {
  async loadSavedViews(organizationId) {
    return await SavedViewRepository.getSavedViews(organizationId);
  },

  async createSavedView(payload) {
    return await SavedViewRepository.createSavedView(payload);
  },

  async updateSavedView(viewId, patch) {
    return await SavedViewRepository.updateSavedView(viewId, patch);
  },

  async deleteSavedView(viewId) {
    return await SavedViewRepository.deleteSavedView(viewId);
  }
};
