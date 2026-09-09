# WorkTree X — Backup & Recovery Runbook

## Database Backup
Daily automated backups are managed via Supabase PostgreSQL.
Manual backup command:
```bash
pg_dump --clean --if-exists --no-owner -h <host> -U postgres -d postgres > backup.sql
```
