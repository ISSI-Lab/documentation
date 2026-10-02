# ADR-0005: Refactor Team Domain To Organization

- **Status**: Accepted
- **Date**: 2026-10-02
- **Deciders**: Platform Architecture Team, Engineering

---

## Context
In the original platform implementation ([ADR-0004](0004-user-authentication-and-hierarchical-team-collaboration.md)), collaborative grouping was modeled under the concept of a `Team`. However, the enterprise roadmap requires supporting hierarchical structures where individual projects, squads, and teams are organized under top-level enterprise entities.

To prepare the platform for nested teams within organizations without semantic naming confusion, the top-level entity is elevated from `Team` to `Organization`.

## Decision
1. **Database Schema & DDL Migration**:
   - Renamed table `teams` to `organizations` with primary key `id VARCHAR(64)`.
   - Renamed table `team_members` to `organization_members`.
   - Foreign key column `team_id` is renamed to `organization_id` in `projects`, `templates`, and `documents`.
   - Dynamic schema auto-migration is integrated into `src/backend/src/db.ts` to seamlessly upgrade existing databases during container/service startup without data loss.
2. **Backend API**:
   - Introduced primary REST endpoints under `/api/v1/organizations` with role enforcement (`isOrganizationOwner`, `isOrganizationManager`, `isOrganizationMember`).
   - Retained `/api/v1/teams` as a backward-compatible alias route.
   - Updated join tokens to use prefix `ORG-` with support for legacy tokens.
3. **Frontend Architecture & UX**:
   - Created dedicated `OrganizationManagement` component under `src/frontend/src/components/organizations/`.
   - Updated `Navigation`, `PersonalHomepage`, `DocumentList`, `TemplateList`, `TemplateBuilder`, and `CreateDocumentModal` to display organization labels, icons (`Building2`), and filters.
   - Preserved `TeamManagement` as a backward-compatible proxy wrapper.
4. **Integration Test Suite**:
   - Updated integration test suite (`tests/integration/test_auth_and_teams.py`) to validate organization workflows, RBAC checks, invite codes, and backward compatibility.

## Consequences
### Positive
- Clarifies domain boundaries: top-level tenants are now explicitly organizations.
- Enables seamless future extension for nested teams/workgroups within an organization without schema breaking changes.
- 100% backward compatibility preserved for legacy API clients and existing database deployments.

### Negative / Trade-offs
- Transitional dual-support in TypeScript types and API query parameters (`organization_id` with `team_id` fallback) until deprecation window closes.
