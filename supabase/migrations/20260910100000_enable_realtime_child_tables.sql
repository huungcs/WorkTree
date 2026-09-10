-- Migration: 20260910100000_enable_realtime_child_tables.sql
-- Purpose: Add task_attachments to supabase_realtime publication and configure REPLICA IDENTITY FULL
-- for accurate DELETE filtering and invalidation events across all core WorkTree collaboration tables.

DO $$
BEGIN
    -- Add public.task_attachments to supabase_realtime publication if not already present
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
          AND schemaname = 'public' 
          AND tablename = 'task_attachments'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.task_attachments;
    END IF;
END $$;

-- Set REPLICA IDENTITY FULL to ensure DELETE operations emit previous row data (including organization_id and task_id)
-- so Supabase Realtime postgres_changes filters and RLS evaluation function accurately on row deletion.
ALTER TABLE public.tasks REPLICA IDENTITY FULL;
ALTER TABLE public.task_checklist_items REPLICA IDENTITY FULL;
ALTER TABLE public.task_dependencies REPLICA IDENTITY FULL;
ALTER TABLE public.task_comments REPLICA IDENTITY FULL;
ALTER TABLE public.task_time_entries REPLICA IDENTITY FULL;
ALTER TABLE public.task_attachments REPLICA IDENTITY FULL;
ALTER TABLE public.organization_nodes REPLICA IDENTITY FULL;
ALTER TABLE public.employees REPLICA IDENTITY FULL;
