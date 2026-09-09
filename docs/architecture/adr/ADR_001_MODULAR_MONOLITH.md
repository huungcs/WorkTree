# ADR 001: Adoption of Modular Monolith & Feature Slices

## Status
Accepted

## Context
WorkTree X is transitioning from a single-file application to a multi-tenant SaaS.

## Decision
Adopt a Modular Monolith architecture with domain feature slices in `src/features/` instead of prematurely splitting into microservices.

## Consequences
- Clean boundaries without deployment complexity.
- Direct local development compatibility without heavy toolchains.
- High maintainability and tenant isolation.
