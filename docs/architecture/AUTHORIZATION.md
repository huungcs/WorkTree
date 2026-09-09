# WorkTree X — Authorization & Permissions

## Roles & Capabilities
| Role | Scope | Node Management | Task Creation | Member Admin |
| :--- | :--- | :--- | :--- | :--- |
| `owner` | Organization | Full | Full | Full |
| `admin` | Organization | Full | Full | Full |
| `manager` | Subtree via `member_scopes` | Within scope | Full | None |
| `member` | Subtree via `member_scopes` | Read-only | Create & Assigned | None |
| `viewer` | Subtree via `member_scopes` | Read-only | Read-only | None |
