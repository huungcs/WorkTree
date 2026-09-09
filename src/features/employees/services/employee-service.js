/**
 * WorkTree X Feature: Employee Service
 * Handles employee directory queries and caching.
 */

import { EmployeeRepository } from '../../../lib/supabase/repositories.js';

export const EmployeeService = {
  async loadEmployees(organizationId) {
    return await EmployeeRepository.getEmployees(organizationId);
  }
};
