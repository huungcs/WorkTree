/**
 * WorkTree X Feature: Billing & Subscriptions
 * Manages organization subscription tier, seats, and invoices.
 */

import { getSupabase } from '../../lib/supabase/client.js';

export const BillingService = {
  async getSubscription(organizationId) {
    const sb = await getSupabase();
    const { data, error } = await sb
      .from('organization_subscriptions')
      .select('*')
      .eq('organization_id', organizationId)
      .maybeSingle();
    if (error) throw error;
    return data;
  }
};
