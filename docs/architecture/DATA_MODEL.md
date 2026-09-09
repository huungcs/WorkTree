# WorkTree X — Multi-Tenant Data Model

## Core Entities
1. `organizations`: Tenant root.
2. `organization_members`: Junction between `auth.users` and `organizations`. Roles: `owner`, `admin`, `manager`, `member`, `viewer`.
3. `organization_nodes`: Recursive tree structure (`company`, `department`, `project`, `team`, `folder`).
4. `organization_node_closure`: Self-maintaining closure table for ancestor/descendant relationships.
5. `employees`: Workforce directory. Decoupled from `organization_nodes`.
6. `member_scopes`: Branch-level access permissions.
7. `tasks`: Core work item.
8. `task_rollups`: Canonical read model view aggregating checklists, blockers, and assignee metadata.
9. `user_pins`: Personal priority shortcuts.
