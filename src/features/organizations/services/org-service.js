/**
 * WorkTree X Feature: Organization Service
 * Multi-tenant organization manager.
 */

import { OrganizationRepository } from '../../../lib/supabase/repositories.js';

export const OrgService = {
  async listUserOrganizations() {
    return await OrganizationRepository.getOrganizations();
  },

  async createNewOrganization(name, slug, timezone = 'Asia/Ho_Chi_Minh') {
    return await OrganizationRepository.createOrganization(name, slug, timezone);
  }
};
