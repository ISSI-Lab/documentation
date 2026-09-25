# ADR-0004: User Authentication And Hierarchical Team Collaboration

- **Status**: Accepted
- **Date**: 2026-09-25
- **Deciders**: Engineering Team & AI Assistant

---

## Context
The initial document authoring engine operated under an open, unauthenticated model where templates and documents were shared uniformly. To scale the platform for multi-team organizations, cross-functional projects, and public onboarding, we required:
1. **User Identity & Security**: Secure authentication and session management.
2. **Frictionless Onboarding**: Ability for prospective users and unauthenticated guests to discover and preview the public template catalog without mandatory upfront sign-in.
3. **Collaborative Structure**: Organizational containers (Teams and Projects) that allow members to co-author and organize documents.
4. **Autonomous Team Management**: Elimination of central admin bottlenecks by allowing any user to create teams and manage their own team's member roster and role assignments.
5. **Scoped Asset Visibility**: Clear boundaries between Public, Personal (private to user), and Team assets.

---

## Decision

We have implemented a comprehensive identity and collaborative asset governance system:

### 1. Authentication & Security Layer
- **JWT-Based Authentication**: Stateless token generation (`jsonwebtoken`) with 7-day session expiry and HMAC-SHA256 signing.
- **Password Security**: Strong hashing via `bcryptjs` with salt rounds = 10.
- **Profile Management**: Endpoints for authentication (`/api/auth/register`, `/api/auth/login`, `/api/auth/me`), profile updates (`/api/auth/profile`), and secure password rotation (`/api/auth/password`).
- **Client Auth State**: Reactive token storage in `localStorage` with automatic Authorization header injection across all API requests.

### 2. Dual-Mode Landing & Guest Discovery
- **Public Template Pool**: Unauthenticated visitors are directed to the public template catalog to explore schema blueprints, view formatting tools, and test workflows before registration.
- **Personal Homepage**: Authenticated users land on a personalized hub displaying active team memberships, associated projects, recently authored documents, and quick creation actions.

### 3. Democratic Team Creation & Role-Based Access Control (RBAC)
- **Open Team Creation**: Any registered user can create a team without requiring system-wide administrator privileges.
- **Hierarchical Roles**:
  - **`owner`**: Complete authority over the team. Can manage settings, transfer ownership, assign/revoke manager status, invite/remove members, and delete the team.
  - **`manager`**: Operational authority. Can invite members, update member roles between manager/member, create team projects, and author team templates/documents. Cannot remove the owner or delete the team.
  - **`member`**: Collaborative contributor. Can view team projects, author team documents, and utilize team templates.

### 4. Scoped Asset Visibility Model
- **Templates**: Can be scoped as `public` (accessible to all), `personal` (private to author), or `team` (restricted to team members).
- **Documents**: Can be scoped as `personal` (author only) or `team` (associated with a specific `team_id` and optional `project_id`).

---

## Consequences

### Positive
- **Frictionless Onboarding**: Guests can immediately see the value of document templates before signing up.
- **Autonomous Collaboration**: Teams can self-organize, manage their members, and structure projects without administrative overhead.
- **Security & Multi-Tenancy**: Data isolation between personal and team workspaces is enforced at both API route middleware and database query levels.
- **Unified Navigation**: The revised layout clearly distinguishes between Personal Homepage, Document workspace, Template catalog, and Team management.

### Negative / Trade-offs
- **Query Complexity**: API routes must perform additional SQL `JOIN`s against `team_members` to verify user access rights for team-scoped resources.
- **Token Invalidation**: Stateless JWTs require client-side token disposal on logout; future enterprise requirements may require a token revocation blocklist in Redis.
