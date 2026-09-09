# WorkTree X — Project Structure & Dependency Architecture

## 1. Modular Monolith Architecture
WorkTree X is organized as a modular monolith with strict domain slicing.

```text
src/
├── app/                  # Application composition, routing, and shell lifecycle
├── features/             # Vertical domain slices (independent business units)
├── components/           # Generic reusable UI primitives & layout
├── design-system/        # Authoritative design tokens (CSS variables & line icons)
└── lib/                  # Foundational infrastructure (Supabase client, repositories)
```

## 2. Dependency Rules
1. `src/components/ui`: Strictly domain-agnostic. No knowledge of tasks, organizations, or employees.
2. `src/features/<domain>`: Encapsulated vertical slices. Other modules may only import through the public API (`index.js`).
3. `src/lib/supabase`: Exposes repositories scoped by `organization_id`. The client uses publishable keys only.
