-- Migration: 20260910183000_user_onboarding_progress.sql
-- Purpose: Persist user onboarding journeys, steps, and getting started progress per user and workspace with strict RLS isolation.

create table if not exists public.user_onboarding_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  journey_id text not null,
  journey_version integer not null default 1,
  current_step text default null,
  completed_steps text[] not null default '{}'::text[],
  is_completed boolean not null default false,
  is_dismissed boolean not null default false,
  dismissed_at timestamptz default null,
  last_seen_at timestamptz not null default timezone('utc'::text, now()),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint user_onboarding_progress_unique unique (user_id, organization_id, journey_id, journey_version)
);

create index if not exists user_onboarding_progress_lookup_idx
  on public.user_onboarding_progress (user_id, organization_id, journey_id);

-- Updated_at trigger
create or replace function public.set_user_onboarding_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;

drop trigger if exists user_onboarding_set_updated_at on public.user_onboarding_progress;
create trigger user_onboarding_set_updated_at
  before update on public.user_onboarding_progress
  for each row execute function public.set_user_onboarding_updated_at();

-- Enable RLS
alter table public.user_onboarding_progress enable row level security;

-- Policies: Only the authenticated user themselves who has valid membership in the organization can access/modify their progress
drop policy if exists user_onboarding_progress_select on public.user_onboarding_progress;
create policy user_onboarding_progress_select on public.user_onboarding_progress
for select
using (
  auth.uid() = user_id
  and public.is_org_member(organization_id)
);

drop policy if exists user_onboarding_progress_insert on public.user_onboarding_progress;
create policy user_onboarding_progress_insert on public.user_onboarding_progress
for insert
with check (
  auth.uid() = user_id
  and public.is_org_member(organization_id)
);

drop policy if exists user_onboarding_progress_update on public.user_onboarding_progress;
create policy user_onboarding_progress_update on public.user_onboarding_progress
for update
using (
  auth.uid() = user_id
  and public.is_org_member(organization_id)
)
with check (
  auth.uid() = user_id
  and public.is_org_member(organization_id)
);

drop policy if exists user_onboarding_progress_delete on public.user_onboarding_progress;
create policy user_onboarding_progress_delete on public.user_onboarding_progress
for delete
using (
  auth.uid() = user_id
  and public.is_org_member(organization_id)
);

grant select, insert, update, delete on public.user_onboarding_progress to authenticated;
