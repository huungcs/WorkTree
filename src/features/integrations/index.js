/**
 * WorkTree X Feature: Integrations & Bots
 * Outbound and inbound webhooks, and Zalo Bot integration.
 */

export * from './services/zalo-bot-service.js';

export const IntegrationService = {
  async getWebhooks(organizationId) {
    return [];
  }
};
