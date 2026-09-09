/**
 * WorkTree X Permissions Helper
 * Enforces role hierarchy: owner > admin > manager > member > viewer
 */

export const ROLES = {
  OWNER: 'owner',
  ADMIN: 'admin',
  MANAGER: 'manager',
  MEMBER: 'member',
  VIEWER: 'viewer'
};

export function canManageOrg(role) {
  return role === ROLES.OWNER || role === ROLES.ADMIN;
}

export function canManageMembers(role) {
  return role === ROLES.OWNER || role === ROLES.ADMIN;
}

export function canCreateNode(role) {
  return [ROLES.OWNER, ROLES.ADMIN, ROLES.MANAGER].includes(role);
}

export function canCreateTask(role) {
  return role !== ROLES.VIEWER;
}

export function canUpdateTask(role, task, currentUserId) {
  if ([ROLES.OWNER, ROLES.ADMIN, ROLES.MANAGER].includes(role)) return true;
  if (role === ROLES.MEMBER && task?.assignee_id === currentUserId) return true;
  return false;
}

export function canDeleteTask(role) {
  return [ROLES.OWNER, ROLES.ADMIN].includes(role);
}
