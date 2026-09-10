# WorkTree X — Legacy Runtime Migration Map

## 1. Purpose

This document records the explicit compatibility surface between the classic runtime
(`js/core.js`, `js/access.js`, `js/mobile.js`) and the modular runtime under `src/`.
It describes the current state, not the target architecture.

Rules while migration is in progress:

1. Do not add a new `window.*` bridge without an architecture review.
2. Do not treat browser state as an authorization boundary; Supabase RLS remains authoritative.
3. Move one vertical slice at a time and remove its bridge only after behavior and responsive tests pass.
4. Prefer module imports and injected application context over global service access.

Browser-owned APIs such as `window.location`, `window.history`, `window.matchMedia`,
`window.visualViewport`, and event APIs are outside the legacy bridge inventory.

## 2. Runtime loading order

`index.html` currently loads these scripts in order:

1. `js/core.js`
2. `js/access.js`
3. `js/mobile.js`
4. `src/app/app.js` as an ES module

The classic scripts create UI functions and mutable state first. The module entrypoint then
publishes repositories, services, session context, and lifecycle functions onto `window`.
Both sides therefore depend on load order and optional runtime capability checks.

## 3. Tenant and session bridge

| Global | Current owner | Main consumers | Target owner | Migration action |
| --- | --- | --- | --- | --- |
| `appState` | `src/app/app.js` | `core.js`, `access.js`, organization UI | application context | Stop exporting the full mutable object; expose narrow selectors/actions. |
| `__active_org_id` | `src/app/app.js` | task detail, notifications, attachments, access | workspace controller | Pass `organizationId` explicitly to feature services. |
| `__worktree_supabase_user` | `src/app/app.js` | `core.js`, `access.js`, attachments | session controller | Replace with `{ userId, profile, membership }` context. |
| `__worktree_is_cloud_workspace` | `core.js` | `core.js`, `access.js` | remove | Cloud is the canonical runtime; isolate any local/demo mode behind an adapter. |
| `__WORKTREE_LEGACY_LOCAL_AUTH__` | `access.js` | `access.js` | local/demo adapter | Remove from production bootstrap after local-mode policy is decided. |

Risk: tenant identity currently has multiple fallbacks. A migration must never make these
client values authoritative for access control.

## 4. Mutable legacy UI state

| Global | Current owner | Purpose | Target owner |
| --- | --- | --- | --- |
| `cloudEmployees` | `core.js` / `access.js` | employee read model | employees feature state |
| `employeesById` | `core.js` / `access.js` | employee lookup cache | employees selector |
| `__worktree_cloud_pins` | `core.js` / `access.js` | personal pins | pins feature state |
| `__worktree_starred_task_ids` | `core.js` | task stars | tasks/personal-data state |
| `__worktree_saved_views` | `core.js` | saved filters/views | saved-views feature state |
| `__taskDetailData` | `core.js` | checklist, dependencies, comments, time and attachments | task-detail feature state |
| `__taskDetailLoadGen` | `core.js` | stale request guard | task-detail controller |
| `__pinMutationBusy` | `access.js` | duplicate mutation guard | pins mutation state |
| `__starMutationBusy` | `core.js` | duplicate mutation guard | stars mutation state |

These values must be migrated as complete feature slices. Copying them into another global
store would preserve the same coupling under a different name.

## 5. Module services published for classic scripts

Published primarily by `src/app/app.js`:

| Domain | Globals | Classic consumers | Planned replacement |
| --- | --- | --- | --- |
| Tasks | `TaskService`, `StarService`, `StarRepository` | `core.js` | task feature controller imports |
| Task detail | `ChecklistService`, `DependencyService`, `CommentService`, `TimeEntryService`, `AttachmentService`, `AttachmentRepository`, `ActivityRepository` | `core.js` | task-detail controller imports |
| Organization tree | `TreeService` | `core.js` | organization-tree controller imports |
| Employees/access | `EmployeeService`, `EmployeeRepository`, `InvitationRepository` | `access.js` | employees/access controller imports |
| Personal views | `PinService`, `PinRepository`, `SavedViewService`, `SavedViewRepository` | `core.js`, `access.js` | feature controller imports |
| Workspace | `OrganizationRepository` | module/global bridge | workspace controller import |
| Realtime/notifications | `RealtimeService`, `NotificationService`, `PushDeviceService` | `core.js`, onboarding | dedicated application controllers |

Repositories should not be exposed to UI code. During migration, classic UI actions should
call a feature/application service rather than a repository global.

## 6. Classic callbacks consumed by modules

| Global callback | Current owner | Module consumers | Target replacement |
| --- | --- | --- | --- |
| `clearTenantUI` | `core.js` | app state/workspace lifecycle | workspace reset action |
| `setCloudWorkspaceData` | `core.js` | workspace loader | feature state hydration |
| `updateCloudTasksQuietly` | `core.js` | realtime/app orchestration | tasks realtime reducer |
| `updateCloudNodesQuietly` | `core.js` | realtime/app orchestration | tree realtime reducer |
| `updateCloudEmployeesQuietly` | `core.js` | realtime/app orchestration | employees realtime reducer |
| `mergeCloudActivities` | `core.js` | realtime/app orchestration | activity feature reducer |
| `refreshDrawerChildQuietly` | `core.js` | task detail/realtime | task-detail refresh action |
| `updateRealtimeIndicator` | `core.js` | app/realtime | layout status component |
| `refreshNotificationBadge` | `core.js` | app/notifications | notification UI controller |
| `renderSupabaseAuth` | `src/app/app.js` | `access.js` | auth feature render lifecycle |
| `supabaseSignOut` | `src/app/app.js` | `access.js` | auth action import/event |
| `loadWorkspaceData` | `src/app/app.js` | `access.js` | workspace controller method |
| `enterWorkspace`, `lockWorkspace` | classic runtime | app bootstrap | explicit shell lifecycle API |
| `toast`, `showToast`, `rebuild` | classic runtime | app and feature services | UI notification/render adapters |

## 7. Global UI entrypoints

The following functions exist so delegated events, onboarding, or classic UI can open a
screen without importing its owner:

- Workspace: `openWorkspaceSwitcher`, `openCreateWorkspaceModal`
- Access/employees: `openAccess`, `openAddEmployeeDialog`,
  `openInviteExistingEmployeeDialog`, `openInviteLinkDialog`,
  `openEmployeeDetailsDialog`, `confirmSuspendEmployee`,
  `confirmReactivateEmployee`, `confirmRevokeInvitation`,
  `renderCloudEmployeeDirectory`
- Onboarding/help: `WorkTreeOnboarding`, `HelpCenterDialog`, `WorkTreeTour`, `openHelp`
- Legacy onboarding fallbacks: `openTaskModal`, `showCreateTaskDialog`,
  `openEmployeeModal`, `showAddEmployeeModal`, `showAddNodeModal`, `switchView`,
  `renderOverview`
- Public legacy facade: `WorkTree`

Target pattern: navigation and dialogs should be invoked through imported controllers or
application events with typed payloads. Fallback chains should be removed after each owning
feature has one canonical entrypoint.

## 8. Migration sequence

1. Introduce one explicit legacy bridge module under `src/app/legacy/`; do not change behavior.
2. Move personal data first: pins, stars, and saved views.
3. Move task-detail child resources as one coordinated slice.
4. Move employees/access after membership and scope tests exist.
5. Move task CRUD and organization tree.
6. Replace workspace hydration and realtime callbacks with feature-owned state updates.
7. Move navigation, dialogs, and mobile behavior.
8. Remove classic script tags only when no required bridge remains.

For each slice, the removal gate is:

- no new `window.*` dependency;
- existing behavior covered by executable tests;
- tenant and role checks still enforced by RLS;
- desktop expanded/collapsed verified;
- mobile 390 px and 360 px verified;
- light and dark themes verified;
- old global has no remaining consumer before deletion.

## 9. Known structural debt baseline

The architecture checker currently allows seven feature imports of `src/app/state.js`:

- attachments
- checklists
- comments
- dependencies
- organization tree
- tasks
- time tracking

This allowlist is a decreasing baseline. Remove one entry whenever that feature receives its
tenant/application context through parameters. Adding another entry is not an acceptable fix.
