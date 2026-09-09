/**
 * WorkTree X Feature: Billing & Subscriptions
 * Manages organization subscription tier, seats, and invoices.
 */

import { BillingRepository } from '../../lib/supabase/repositories.js';

export const BillingService = {
  async getSubscription(organizationId) {
    return await BillingRepository.getSubscription(organizationId);
  }
};
