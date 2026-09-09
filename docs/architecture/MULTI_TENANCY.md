# WorkTree X — Multi-Tenancy Architecture

## Tenant Isolation Invariants
1. **Direct Scoping:** Every operational table MUST include an `organization_id` UUID column.
2. **PostgreSQL RLS:** Row-Level Security is enabled on every public table.
3. **Closure Table Recursive Scoping:** `organization_node_closure` provides instant verification of descendant nodes without expensive recursive CTE queries.
4. **No Client Trust:** Route parameters and localStorage keys are considered untrusted hints. Security is enforced by Postgres policies matching `auth.uid()`.
