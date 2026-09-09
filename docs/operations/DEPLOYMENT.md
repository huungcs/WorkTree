# WorkTree X — Deployment Guide

## Architecture
- Frontend: Static asset hosting or Node.js server.
- Database & Auth: Supabase (PostgreSQL 15+, PostgREST, GoTrue).
- Storage: Supabase Storage bucket `worktree-files`.

## Deployment Checklist
1. Verify migrations applied up to `20260909000000_worktree_multi_tenant_complete.sql`.
2. Configure environment variables.
3. Validate client bundle does not contain `SUPABASE_SECRET_KEY`.
