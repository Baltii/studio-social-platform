# Social platform implementation status

Updated 2026-10-07.

## Completed

- Phase 1 repository audit and target architecture are documented in `social-platform-architecture.md`.
- An npm workspace layout adds NestJS API, shared role policy, and database packages alongside the existing Next.js template. No template page or component has been removed.
- The database package defines 13 foundation tables and a reviewed Drizzle migration. PostgreSQL enforces tenant-matching composite foreign keys, unique target idempotency keys, and one active schedule per target.
- A native PostgreSQL 17 instance is running on this development machine without Docker. The migration was applied to `studio_dev`; database readiness returns 200. Cross-workspace post/account references and duplicate active schedules were rejected in a rollback-only database check.
- The API exposes OpenAPI documentation, health checks, OIDC bearer-token verification with JWKS, local user resolution, and workspace list/create/read/update routes. Workspace creation adds owner membership and an audit event transactionally. Membership and role checks protect workspace routes.
- Signed-token verifier and role-policy tests pass. A workspace integration test covers create, read, list, duplicate slug, cross-user denial, viewer restrictions, and owner update against PostgreSQL.
- Next.js was updated to 16.4.0 after a dependency audit. `npm audit --omit=dev` reported zero findings. The full audit reported 11 development-tool findings (4 moderate, 7 high) at the foundation checkpoint.

## Current limits

- Keycloak or another compatible identity provider is not configured locally. The web app has no OIDC session or API proxy yet, so its illustrative login pages remain examples.
- No social account OAuth connection, media flow, publishing worker, persisted calendar experience, trends, AI, automation, or deployment has been implemented. The existing dashboard data is still template data.
- Docker is optional. `foundation-development.md` documents the native PostgreSQL setup already used on this machine.

## Next vertical slice

1. Configure a local OIDC provider and a web client with authorization-code PKCE, a signed session, and an API audience.
2. Add authenticated web routes and a same-origin API proxy; keep template pages and components intact while introducing social screens alongside them.
3. Add provider contracts and a local mock account to implement draft, schedule, publish, and retry behavior before real social API integrations.
4. Extend tenant and role integration tests as new resources are added.

Production milestone requirements in the product brief remain open. Each phase needs its own reviewed migrations, relevant tests, and build checks.
