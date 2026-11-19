# ADR-002: Scoped External Task Share & Real Multi-Tenant Internal Chat

- **Status:** Accepted
- **Date:** 2026-11-19
- **Context:** WorkTree X needed two collaboration upgrades requested by product direction:
  1. Safe external task sharing via capability URLs for clients/vendors without workspace accounts, replacing unsafe generic "Add / Edit + Delete" patterns.
  2. Real cloud persistence & Realtime sync for Internal Chat ([src/features/chat/](file:///c:/Users/ASUS/Desktop/WorkTree/src/features/chat/index.js)), moving authenticated cloud workspaces off in-memory preview (`mock-adapter.js`).

---

## Decision 1 — Scoped External Task Share (`task_share_links` + `/api/share`)

- **Schema:** [20261119103000_add_task_share_links.sql](file:///c:/Users/ASUS/Desktop/WorkTree/supabase/migrations/20261119103000_add_task_share_links.sql)
  - `public.organization_settings.allow_external_task_share` (`boolean default true`) acts as a tenant-level kill-switch controllable by `owner`/`admin`.
  - `public.task_share_links` locks every link to `(organization_id, task_id)` via composite FK to `public.tasks(organization_id, id)`.
  - Stores only `token_hash` (SHA-256), `token_prefix`, server-encrypted `token_encrypted` (AES-256-GCM, cleared on revoke), optional salted `scrypt` `pin_hash`, `hide_internal_comments` (`default true`), `allow_checklist_toggle`, and explicit `expires_at` (UI default: 7 days).
  - Permissions are strictly bounded to `view | comment | edit_progress`. External links can **never** delete tasks, comments, or checklist rows (`HTTP 403`).
  - `public.task_comments` gains nullable `author_user_id` strictly guarded by CHECK constraint requiring `(author_user_id IS NULL AND guest_author_name IS NOT NULL AND share_link_id IS NOT NULL AND is_internal = false)` when inserted via `/api/share`, plus `is_internal` flag for internal team notes.
- **Zero Disclosure:** Invalid, missing, paused, revoked, expired tokens, archived tasks, or org-disabled links always return `HTTP 404 {"error":"not_found"}` via [api/share.js](file:///c:/Users/ASUS/Desktop/WorkTree/api/share.js) without revealing organization or task existence.
- **10 Security Checklist Summary:**
  - Tenant key: `organization_id` + composite FK `(organization_id, task_id)`.
  - `SELECT`/`INSERT`/`UPDATE`/`DELETE`: `authenticated` scoped via `is_org_member`, `can_read_task_id`, `can_collaborate_task_id`, `can_manage_task_id`. Zero `anon` RLS policies.
  - Public access runs exclusively through server whitelist in [api/share.js](file:///c:/Users/ASUS/Desktop/WorkTree/api/share.js) (never exposing employee PII, organization trees, `task_time_entries`, or private `storage_path`).

---

## Decision 2 — Multi-Tenant Internal Chat (`chat_*` + `supabase-adapter.js`)

- **Schema:** [20261119110000_add_internal_chat.sql](file:///c:/Users/ASUS/Desktop/WorkTree/supabase/migrations/20261119110000_add_internal_chat.sql)
  - Tables: `public.chat_conversations`, `public.chat_participants`, `public.chat_messages`.
  - Composite foreign keys lock participants (`(organization_id, membership_id)` + `(organization_id, user_id) -> organization_members`) and replies (`(organization_id, conversation_id, reply_to_message_id) -> chat_messages`) inside the same tenant and conversation.
  - Organization admins have **no** backdoor to read conversations they are not active participants of.
  - Group history policy: members newly added to a group inside the same active organization can read prior group messages; removal (`removed_at IS NOT NULL`), membership suspension, or org deactivation immediately blocks table access, RPCs, and `chat:<id>:*` Realtime topics.
  - Direct conversations use partial unique index `(organization_id, direct_key)` for race-free atomic `get_or_create_direct_chat`.
  - Messaging is idempotent per `(organization_id, conversation_id, sender_user_id, client_message_id)`.
  - Read cursor `mark_chat_read` is monotonic (never moves backwards).
- **Adapter Integration:** [supabase-adapter.js](file:///c:/Users/ASUS/Desktop/WorkTree/src/features/chat/services/supabase-adapter.js) implements the exact contract in `CHAT_FEATURE_HANDOFF.md` for cloud sessions (`isPreview: false`), while demo mode keeps [mock-adapter.js](file:///c:/Users/ASUS/Desktop/WorkTree/src/features/chat/services/mock-adapter.js) strictly isolated (`isPreview: true`).

---

## Rollout & Rollback

1. Apply migrations `20261119103000_add_task_share_links.sql` and `20261119110000_add_internal_chat.sql` sequentially on Supabase.
2. Deploy application bundle (`npm run bundle` + push to Vercel `main`).
3. **Rollback:**
   - External sharing can be disabled immediately per tenant via `organization_settings.allow_external_task_share = false` or globally by reverting `/api/share` + `share.html`.
   - Internal chat can revert to preview-only in `src/app/app.js` without affecting existing tasks/organizations/comments tables.
