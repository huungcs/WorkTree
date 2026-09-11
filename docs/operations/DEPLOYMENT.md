# WorkTree X — Deployment Guide

## Architecture
- Frontend: Static asset hosting or Node.js server.
- Database & Auth: Supabase (PostgreSQL 15+, PostgREST, GoTrue).
- Storage: Supabase Storage bucket `worktree-files`.

## Deployment Checklist
1. Verify all immutable migrations in `supabase/migrations/` are applied.
2. Configure environment variables.
3. Validate client bundle does not contain `SUPABASE_SECRET_KEY`.
4. Deploy all Edge Functions used by the release.
5. For remote phone notifications, complete and verify [NOTIFICATION_PUSH.md](./NOTIFICATION_PUSH.md).
