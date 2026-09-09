/**
 * WorkTree X Telemetry & Audit Logging Helper
 * Privacy-preserving audit logs for enterprise security.
 */

export const Telemetry = {
  logEvent(eventName, properties = {}) {
    if (process?.env?.NODE_ENV === 'development') {
      console.debug(`[Telemetry] ${eventName}:`, properties);
    }
  },

  logSecurityAlert(alertName, details = {}) {
    console.warn(`[Security Alert] ${alertName}:`, details);
  }
};
