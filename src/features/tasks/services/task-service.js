/**
 * WorkTree X Feature: Task Service
 * Task business operations and rollups.
 */

import { TaskRepository } from '../../../lib/supabase/repositories.js';

export const TaskService = {
  async loadTasks(organizationId, filter = {}) {
    return await TaskRepository.getTasks(organizationId, filter);
  },

  async createTask(params) {
    return await TaskRepository.createTask(params);
  },

  async updateStatus(taskId, status) {
    return await TaskRepository.updateTaskStatus(taskId, status);
  }
};
