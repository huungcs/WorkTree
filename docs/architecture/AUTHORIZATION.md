# WorkTree X — Authorization & Permissions

## Roles & Capabilities
| Role | Scope | Node Management | Task Creation | Member Admin |
| :--- | :--- | :--- | :--- | :--- |
| `owner` | Organization | Full | Full | Full |
| `admin` | Organization | Full | Full | Full |
| `manager` | Subtree via `member_scopes` | Within scope | Full | Invite `member`/`viewer` within scope |
| `member` | Subtree via `member_scopes` | Read-only | Create & Assigned | None |
| `viewer` | Subtree via `member_scopes` | Read-only | Read-only | None |

Managers cannot grant `manager`, `admin`, or `owner`, cannot place an invite
outside their own subtree, and cannot edit/suspend memberships. These limits
are enforced by the `create_invitation` RPC; hiding UI controls is not the
security boundary.
