-- Allow scoped managers to create and update child organization nodes inside their assigned branches,
-- while preserving strict tenant isolation and protecting root company nodes.

drop policy if exists nodes_insert_admin on public.organization_nodes;
create policy nodes_insert_admin on public.organization_nodes
for insert to authenticated
with check (
  public.is_org_admin(organization_id)
  or (
    parent_id is not null
    and type in ('department', 'project', 'team', 'folder')
    and public.can_manage_task_row(organization_id, parent_id)
  )
);

drop policy if exists nodes_update_admin on public.organization_nodes;
create policy nodes_update_admin on public.organization_nodes
for update to authenticated
using (
  public.is_org_admin(organization_id)
  or (
    parent_id is not null
    and public.can_manage_task_row(organization_id, id)
  )
)
with check (
  public.is_org_admin(organization_id)
  or (
    parent_id is not null
    and type in ('department', 'project', 'team', 'folder')
    and public.can_manage_task_row(organization_id, id)
    and public.can_manage_task_row(organization_id, parent_id)
  )
);
