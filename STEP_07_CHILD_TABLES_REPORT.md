# WorkTree X — Step 07 Child Tables Cloud Report

## 1. Baseline
- **Git Commit:** `2475720a37b0ffa2b220c617a3eb575cbb2085b2` (main)
- **Supabase Cloud Remote:** `https://taupjuaficdzdgbmxmbe.supabase.co`
- **Postgres Authority:** `db.taupjuaficdzdgbmxmbe.supabase.co:5432`
- **Preceding Status:**
  - Step 01: Baseline Static App — PASS
  - Step 02: Multi-Tenant RLS & Schema Isolation — PASS
  - Step 03: Supabase Auth Session & Security — PASS
  - Step 04: Workspace Onboarding & Multi-Tenant Switcher — PASS
  - Step 05: Cloud Read Model & Task Rollups — PASS
  - Step 06: Cloud Task & Node Mutations Pipeline — PASS
- **Mission Step 07:** Migrate all task child domains (`task_checklist_items`, `task_dependencies`, `task_comments`, `task_time_entries`) to Supabase Cloud, removing LocalStorage as business authority.

---

## 2. Schema Audit
Detailed canonical schema and constraints audit from `supabase/migrations/20260909000000_worktree_multi_tenant_complete.sql`:

| Table | Primary Key | organization_id | task_id | User / Actor Field | Required Columns | RLS SELECT | RLS INSERT | RLS UPDATE | RLS DELETE | Triggers & Constraints |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `task_checklist_items` | `id` (UUID default `gen_random_uuid()`) | `organization_id` (UUID, NOT NULL) | `task_id` (UUID, NOT NULL) | `created_by`, `completed_by` | `organization_id`, `task_id`, `content` | Tenant member with task read scope | Role in (owner, admin, manager in scope, assigned member) | Same role scope; updates `is_done`, `content`, `sort_order` | Same role scope | `checklist_sync_progress` (updates task progress when `auto_progress=true`), `checklist_completion_before` (stamps `completed_at`, `completed_by`), `checklist_content_len` (1-400 chars) |
| `task_dependencies` | Composite: `(task_id, depends_on_task_id)` | `organization_id` (UUID, NOT NULL) | `task_id` (UUID, NOT NULL) | `created_by` (UUID) | `organization_id`, `task_id`, `depends_on_task_id` | Tenant member with read scope on both tasks | Role in (owner, admin, manager in scope, assigned member) | N/A (edges are immutable) | Same role scope | `task_dependencies_guard` -> `guard_task_dependency()` (recursive CTE cycle prevention, self-dependency block `task_id <> depends_on_task_id`, composite FK same-org guard) |
| `task_comments` | `id` (UUID default `gen_random_uuid()`) | `organization_id` (UUID, NOT NULL) | `task_id` (UUID, NOT NULL) | `author_user_id` (UUID, NOT NULL) | `organization_id`, `task_id`, `author_user_id`, `body` | Tenant member with task read scope | Active tenant member with task read scope | Author user only (within edit grace period) | Author user or Tenant Owner/Admin | `comments_guard_write` (stamps `author_user_id := auth.uid()`, enforces immutability of org/task/author), `comments_body_len` (1-5000 chars) |
| `task_time_entries` | `id` (UUID default `gen_random_uuid()`) | `organization_id` (UUID, NOT NULL) | `task_id` (UUID, NOT NULL) | `user_id` (UUID, NOT NULL) | `organization_id`, `task_id`, `user_id`, `minutes` | Tenant member with task read scope | Active tenant member with task write scope | Author user or Admin | Author user or Admin | `time_entries_guard` -> `guard_time_entry()` (verifies active org membership), `time_entries_minutes_check` (`minutes > 0 and minutes <= 10080`), `time_entries_note_len` (<=500 chars) |

---

## 3. Child Data Architecture
- **Layer Separation:**
  - `src/lib/supabase/repositories.js`: Canonical repositories (`ChecklistRepository`, `DependencyRepository`, `CommentRepository`, `TimeEntryRepository`) communicating with Supabase PostgREST endpoints under authoritative user JWT and active `organization_id`.
  - Feature Domain Services:
    - `src/features/checklists/services/checklist-service.js`
    - `src/features/dependencies/services/dependency-service.js`
    - `src/features/comments/services/comment-service.js`
    - `src/features/time-tracking/services/time-entry-service.js`
  - App State Management (`src/app/state.js`):
    - Added reactive `appState.taskDetail` structure with independent loading states and error boundaries:
      ```javascript
      taskDetail: {
        taskId: null,
        checklist: [],
        dependencies: [],
        comments: [],
        timeEntries: [],
        loading: { checklist: false, dependencies: false, comments: false, timeEntries: false },
        errors: { checklist: null, dependencies: null, comments: null, timeEntries: null }
      }
      ```
    - Complete wipe of `taskDetail` in `purgeTenantData()`.

---

## 4. Task Detail Load Pipeline
When the user opens any task drawer (`openDrawer(id)`):
1. Task header and basic attributes are rendered immediately from the existing in-memory snapshot (`byTask.get(id)`).
2. Four concurrent promises are dispatched via `Promise.allSettled`:
   - `ChecklistService.getItems(id, currentOrgId)`
   - `DependencyService.getDependencies(id, currentOrgId)`
   - `CommentService.getComments(id, currentOrgId)`
   - `TimeEntryService.getTimeEntries(id, currentOrgId)`
3. Each child section renders dedicated skeleton loaders (`Đang tải checklist...`, `Đang tải phụ thuộc...`, etc.).
4. If an individual child request fails, it renders an inline error card with a retry button (`Thử lại`), without crashing or closing the drawer.

---

## 5. Race Protection
- **`taskDetailLoadGen` Concurrency Guard:**
  - Every drawer open increments `window.__taskDetailLoadGen`.
  - The captured `thisGen`, `currentTaskId`, and `currentOrgId` are verified prior to committing settled responses:
    ```javascript
    if (thisGen !== window.__taskDetailLoadGen || drawerId !== currentTaskId) return;
    if (currentOrgId && window.__active_org_id && currentOrgId !== window.__active_org_id) return;
    ```
  - Opening Task A then rapidly switching to Task B guarantees Task A's network response will never be committed into Task B's drawer.

---

## 6. Checklist Read
- Queried via `ChecklistRepository.getChecklistItems(taskId, organizationId)`.
- Sorted canonically by `sort_order ASC, created_at ASC`.
- Canonical fields preserved: `id` (UUID), `task_id`, `organization_id`, `content`, `is_done`, `sort_order`, `completed_at`, `completed_by`.
- Fake numeric client IDs strictly prohibited.

---

## 7. Checklist Mutations
- **Add Item:**
  - Validates `content.trim()` between 1 and 400 characters.
  - In-flight lock `submittingItems` prevents double submit.
  - Submits to PostgREST under user JWT.
  - Automatically triggers `syncTaskRollup(taskId, orgId)` to refresh rollups.
- **Toggle Item:**
  - Sets `is_done` (boolean). Database trigger `checklist_completion_before` stamps `completed_at` and `completed_by`.
  - Immediately synchronizes `task_rollups`.
- **Delete Item:**
  - Deletes row by UUID. Refetches canonical rows and rollups.

---

## 8. Checklist Rollups & Auto-Progress
- When `auto_progress = true`, database trigger `checklist_sync_progress` recalculates `tasks.progress` upon checklist changes (`todo -> count(done)/count(total)*100`).
- The database is the authoritative compute engine; the UI refetches `task_rollups` via `TaskRepository.getTaskById(taskId)` to align `progress`, `checklist_total`, and `checklist_done` with zero local simulation drift.
- Tasks with open checklist items cannot be set to status `done` when `auto_progress = true` (Postgres exception raised).

---

## 9. Dependencies
- Queried via `DependencyRepository.getDependencies(taskId, organizationId)`.
- Persists composite relation `(organization_id, task_id, depends_on_task_id)`.
- Dependency badges display resolved task title and blocker state based on `task_rollups.is_blocked`.

---

## 10. Dependency Cycle Protection
- Database trigger `task_dependencies_guard` -> function `guard_task_dependency()`:
  - Enforces `task_id <> depends_on_task_id` (self-dependency blocked).
  - Enforces composite FKs (`task_dependencies_task_fk`, `task_dependencies_dep_fk`), guaranteeing both tasks belong to the same `organization_id`.
  - Executes a recursive Common Table Expression (CTE) traversing the dependency graph. Detects cycles (`A -> B -> C -> A`) and raises Postgres exception: `'Dependency would create a cycle'`.
  - Client service catches and formats the error into user-friendly Vietnamese notifications.

---

## 11. Comments
- Read from `task_comments` ordered by `created_at ASC`.
- Author name resolution maps `author_user_id` to `window.__worktree_supabase_user` or `window.cloudEmployees` rather than hardcoding.
- Validates non-empty content and max 5,000 characters.
- Database trigger `guard_comment_write` forces `author_user_id := auth.uid()`, preventing client spoofing.
- Immutability enforced on `organization_id`, `task_id`, and `author_user_id`.

---

## 12. Time Entries
- Stored in `task_time_entries`.
- Client hours input (`1.5h`) is normalized to integer minutes (`90m`).
- Schema constraint `time_entries_minutes_check` enforces `minutes > 0 and minutes <= 10080` (7 days max).
- DB trigger `guard_time_entry` ensures the user is an active member of the target organization.

---

## 13. Timer Integration
- Local client timer counts elapsed seconds in-memory during active tracking.
- When stopped:
  - Computes elapsed minutes (`Math.max(1, Math.round(elapsed / 60000))`).
  - Calls `TimeEntryService.logTime({ taskId, minutes, note: 'Bộ đếm thời gian' })`.
  - Persists directly to Supabase Cloud.
  - Refetches `task_rollups` to update total `actual_minutes` authoritatively.
- Double-stop protection prevents duplicate submissions.

---

## 14. Role Enforcement
- **Owner / Admin:** Full CRUD permissions across all child tables in the organization.
- **Manager:** Authorized within assigned `member_scopes`. Out-of-scope mutations rejected by RLS.
- **Member:** Can create comments and log time on readable/assigned tasks. Checklist and dependency edits permitted according to policy.
- **Viewer:** Read-only access. Direct insert/update/delete attempts on checklist, dependencies, comments, or time entries are rejected with HTTP 403 / 400.

---

## 15. Cross-Tenant Security
All cross-tenant attack vectors were explicitly verified and confirmed DENIED:
1. Checklist A -> Task B: DENIED (RLS / FK mismatch).
2. Dependency Task A (Org A) -> Task B (Org B): DENIED (composite FK violation).
3. Comment Org B -> Task A: DENIED (RLS violation).
4. Time Entry Org B -> Task A: DENIED (RLS / trigger `guard_time_entry` violation).

---

## 16. LocalStorage Boundary
- In Cloud Mode (`window.__worktree_is_cloud_workspace = true`):
  - `persistData()` strictly returns true without writing to `localStorage.setItem(KEYS.data, ...)`.
  - `commit()` is bypassed for all child table operations; cloud services execute mutations directly against Supabase PostgREST.
  - Zero business child data is written to browser storage.

---

## 17. Reload Persistence
- Reloading queries fresh data from Supabase Cloud:
  - Checklist items, toggle states, and completion stamps persist.
  - Comments persist with correct author and timestamp.
  - Time entries persist and aggregate into `actual_minutes`.
  - Dependencies persist and maintain `is_blocked` status.

---

## 18. Multi-User Persistence
- User A posts comments, checks items, or logs time.
- User B refreshing or reopening the task drawer receives updated data from Supabase Cloud under authoritative RLS.

---

## 19. Error Handling
- Network failures display isolated error cards with "Thử lại" (Retry) buttons for the affected child section.
- User drafts in input fields (`newChecklist`, `commentText`) are preserved locally in memory while the drawer remains open.

---

## 20. Performance
- Child data queries execute in parallel (`Promise.allSettled`).
- Single task rollup refetch (`TaskRepository.getTaskById`) avoids refetching the entire workspace on every checklist tick or time log.
- Clean database indexes on `(organization_id, task_id)` optimize child row retrieval.

---

## 21. Desktop QA
- Tested desktop layouts (1280x800, 1536x864):
  - Task drawer renders cleanly with all 4 child sections.
  - Resolved UI bug where multiple duplicate pin buttons appeared in table rows and kanban cards due to UUID `NaN` parsing.

---

## 22. Mobile QA
- Tested mobile viewport (390x844):
  - Task drawer adheres to `100dvh` and mobile safe areas.
  - Touch targets for checklist checkboxes, buttons, and inputs meet >= 44px minimum touch target standard.

---

## 23. Automated Tests
- Created: `scratch/test_step07_child_tables.js`
- **Total Assertions: 46 / 46 PASS (100%)**
  - Checklist: 9/9 PASS
  - Dependencies: 8/8 PASS
  - Comments: 8/8 PASS
  - Time Entries & Timer: 8/8 PASS
  - Client State & Invariants: 7/7 PASS
  - Regression & Integrity: 6/6 PASS

---

## 24. Regression Tests
All existing suites remain 100% passing:
- `scratch/test_step03_auth.js`: 24/24 PASS (100%)
- `scratch/test_step04_workspace.js`: 27/27 PASS (100%)
- `scratch/test_step05_cloud_read.js`: 25/25 PASS (100%)
- `scratch/test_step06_cloud_mutations.js`: 40/40 PASS (100%)
- `scratch/test_step07_child_tables.js`: 46/46 PASS (100%)
- Secret scan: 0 leaks
- Production bundle: `WorkTree.html` bundled successfully

---

## 25. Files Modified
- `src/lib/supabase/repositories.js` (Updated `ChecklistRepository`, `CommentRepository`, `TimeEntryRepository`; created `DependencyRepository`)
- `src/features/checklists/services/checklist-service.js` & `index.js` (Created)
- `src/features/dependencies/services/dependency-service.js` & `index.js` (Created)
- `src/features/comments/services/comment-service.js` & `index.js` (Created)
- `src/features/time-tracking/services/time-entry-service.js` & `index.js` (Created)
- `src/app/state.js` (Added `appState.taskDetail` & child data purge in `purgeTenantData`)
- `src/app/app.js` (Exported child services to orchestrator / window)
- `js/core.js` (Integrated cloud drawer pipeline, generation race guards, inline retry states, cloud mutations)
- `js/access.js` (Fixed duplicate pin buttons bug, supported UUID string matching in permissions and pin decor)
- `WorkTree.html` (Re-bundled production bundle)
- `scratch/test_step07_child_tables.js` (Created comprehensive 46-assertion test suite)

---

## 26. Database Changes
- **0 Database Schema Changes Required:** Canonical schema, RLS policies, and database triggers from `supabase/migrations/20260909000000_worktree_multi_tenant_complete.sql` already provided full support for child tables.

---

## 27. Security Findings
- None. RLS policies and trigger guards (`task_dependencies_guard`, `comments_guard_write`, `time_entries_guard`, `checklist_sync_progress`) functioned flawlessly without modifications.

---

## 28. Known Limitations
- Personal pins (`user_pins`) and task stars (`task_stars`) remain stored in client state for now (scheduled for Step 08).
- Attachments, notifications center, and Supabase Realtime are out of scope for Step 07 and will be integrated in subsequent milestones.

---

## 29. Exit Criteria
All acceptance criteria for Step 07 are met in full:
- [x] Checklist: cloud read, create, toggle, delete, rollup sync.
- [x] Dependencies: cloud read, create, delete, cycle detection, self-block, cross-tenant block, `is_blocked` rollup sync.
- [x] Comments: cloud read, create, author stamp, length validation, cross-tenant block.
- [x] Time Entries: cloud read, manual minute entry, timer stop persist, DB sum rollup, cross-tenant block.
- [x] Global invariants: 0 LocalStorage business authority, race guards, zero client secrets, 100% test pass.

---

## 30. Recommendation for Step 08
- Proceed with **STEP 08 — CLOUD PERSONAL DATA & ATTACHMENTS MIGRATION** (`user_pins`, `task_stars`, `saved_views`, `task_attachments`).

---

STEP 07 STATUS: PASS  
CLOUD CHECKLIST: PASS  
CLOUD DEPENDENCIES: PASS  
CLOUD COMMENTS: PASS  
CLOUD TIME ENTRIES: PASS  
TASK ROLLUP CONSISTENCY: PASS  
CROSS-TENANT CHILD SECURITY: PASS  
LOCAL CHILD DATA AUTHORITY DISABLED: YES  
READY FOR STEP 08: YES
