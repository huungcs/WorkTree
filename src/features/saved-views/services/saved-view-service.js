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

  async updateSavedView(viewIdOrPayload, patch) {
    const viewId = typeof viewIdOrPayload === 'object' && viewIdOrPayload !== null
      ? (viewIdOrPayload.viewId || viewIdOrPayload.id)
      : viewIdOrPayload;
    const updatePatch = typeof viewIdOrPayload === 'object' && viewIdOrPayload !== null && viewIdOrPayload.patch
      ? viewIdOrPayload.patch
      : patch;
    return await SavedViewRepository.updateSavedView(viewId, updatePatch);
  },

  async deleteSavedView(viewIdOrPayload) {
    const viewId = typeof viewIdOrPayload === 'object' && viewIdOrPayload !== null
      ? (viewIdOrPayload.viewId || viewIdOrPayload.id)
      : viewIdOrPayload;
    return await SavedViewRepository.deleteSavedView(viewId);
  }
};
