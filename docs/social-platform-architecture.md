# Social publishing platform: architecture and delivery plan

## Repository assessment (Phase 1)

The repository is a single Next.js 16.2 App Router application using React 19.2, TypeScript 5.9, Tailwind CSS 4, npm, Biome, and local shadcn/ui wrappers in `src/components/ui` (`radix-nova` style). It has a reusable dashboard shell, sidebar, theme presets, cards, forms, tables, dialogs, a FullCalendar based calendar, and several example dashboard screens. The current examples use local arrays and JSON. The login and registration forms only display submitted values in a toast. `src/proxy.disabled.ts` is an unused example; there is no session enforcement. There is no database, API service, worker, object storage, OAuth integration, environment contract, or automated test suite. No poster templates or renderer were found in this repository. The existing `.gitignore` has a user edit and must be preserved.

The existing shell and UI wrappers stay in place. New social screens should live under `src/app/(main)/dashboard/<feature>` and use the existing design tokens. Example analytics and calendar data must not be presented as real social metrics or publishing records.

## Target architecture

```text
repo/
  src/                         # existing Next.js web app, retained during migration
  apps/
    api/                       # NestJS REST/OpenAPI; authorization and business services
    worker/                    # publication, media and notification jobs
    trend-worker/              # public feed ingestion
  packages/
    database/                  # Drizzle schema, reviewed SQL migrations, DB client
    shared/                    # pure contracts, capabilities, validation
    social-adapters/           # provider contract and provider implementations
    template-engine/           # validated template data and renderer
    ai-agent/                  # tool registry, policy, LLM provider boundary
  infra/
    docker/                    # local and production images/Compose
    coolify/                   # deployment descriptors
    caddy/                     # HTTPS routing
    monitoring/                # OTel, Prometheus, Grafana, Loki
  docs/
```

The root Next.js package is temporarily the web workspace to avoid moving 278 source files before any product functionality exists. The workspace layout lets the API and shared packages grow now. Move the web app to `apps/web` in a dedicated change after auth and API integration, with import paths and deployment verified. npm workspaces are the package boundary; shared code is imported by package name, never by reaching into another workspace's source tree.

The browser talks to the API through a same-origin proxy/BFF. NestJS owns authorization, validation, state transitions, and writes. PostgreSQL is the source of truth. Valkey/BullMQ executes jobs; a reconciler re-enqueues due targets and recovers leases after restarts. S3 compatible storage holds private originals and derived media; provider adapters alone call social APIs. Keycloak issues OIDC identities; the API verifies tokens and resolves workspace membership on every protected request. The AI agent calls permission checked application tools and may only propose or create drafts without approval for consequential actions.

## Data model

Every tenant-owned row has `workspace_id`; joins and foreign keys must keep child records in the same workspace. UUID primary keys, `created_at`, and `updated_at` are used throughout. Time instants use `timestamptz` in UTC; workspaces also store an IANA timezone. The first migration implements the core tables marked **Phase 2** below. Later phases add the remaining tables through reviewed migrations.

| Domain | Tables and key relationships |
| --- | --- |
| Identity **Phase 2** | `users` (Keycloak subject unique), `workspaces` (owner user, timezone), `workspace_members` (unique workspace/user, role). |
| Connections **Phase 2** | `social_providers` (provider integration state), `social_accounts` (many per provider/workspace; unique provider external account per workspace), `social_credentials` (encrypted token material only), `oauth_states` (hashed state, PKCE material, expiry and one-time use). |
| Publishing **Phase 2** | `posts` (logical content and aggregate status), `post_versions` (revision snapshots), `post_targets` (account-specific content/status, unique idempotency key, external ID, schedule), `publish_attempts` (sanitized attempt record), `schedules` (target schedule history and timezone). Each target references one post and one account in the same workspace. |
| Content | `campaigns`, `categories`, `assets`, `asset_variants`, `post_media`, `post_target_media`, `templates`, `template_versions`; media references are relational and JSONB is reserved for provider metadata or validated template payloads. |
| Discovery | `trend_sources`, `trend_items`, `saved_trends`; canonical URL and content fingerprint support deduplication. |
| Operations | `bulk_schedule_jobs`, `automation_rules`, `automation_runs`, `notifications`, `audit_logs`, `webhooks`; durable state and immutable-style audit events. |
| AI | `ai_conversations`, `ai_messages`, `ai_tool_calls`; tool calls record actor, permission decision, validated arguments and outcome, with secrets redacted. |

Core indexes include workspace/status/time for due publishing and listings, workspace/account for target lookups, unique target idempotency keys, unique membership, account external identity, OAuth state hash, and attempt number per target. API queries must scope by workspace even when IDs are UUIDs. A database constraint cannot by itself enforce every multi-table tenant relationship; application transactions and composite foreign keys where practical will enforce it.

## State and reliability rules

- `Post` is a logical content item; `PostTarget` is one delivery to one social account. Aggregate post status is derived from target statuses, including `PARTIALLY_PUBLISHED`.
- A publisher claims a target with a database lease/transaction before calling a provider. Attempts are recorded before and after calls. Provider idempotency support is used where available; an ambiguous timeout requires status reconciliation before retrying, since a local key alone cannot guarantee a remote side effect is not repeated.
- Credentials use authenticated encryption with a key version and rotation path. Access and refresh tokens never appear in API responses, audit metadata, or logs.
- OAuth callback state is random, stored as a hash, expires, and is consumed once. PKCE is used where a provider supports or requires it.
- Authorize every read and mutation by workspace membership and role on the server. Worker service access uses a separate identity and narrow operations.

## Delivery phases

1. **Audit:** record existing code and reusable UI (this document).
2. **Foundation:** npm workspaces, database package, initial reviewed migration, API bootstrap, health checks, and local PostgreSQL. No write endpoints before auth.
3. **Identity:** Keycloak OIDC login, workspace selection, RBAC and audit events.
4. **Connections:** provider contract, mock provider, multiple accounts, secure credentials and OAuth state handling.
5. **Content:** post composer, per-target overrides, media library and real previews.
6. **Publishing:** durable schedule records, worker, retries, lease recovery and reconciliation.
7. **Planning:** real calendar, bulk scheduling, CSV validation and drag rescheduling.
8. **Providers:** official integrations one at a time, gated by credentials/review status and contract tests.
9. **Discovery:** public feed adapters, deduplication, scoring and trend-to-draft.
10. **Design:** validated template registry and server-rendered poster variants.
11. **AI:** provider abstraction, structured tools, chat streaming and approval workflow.
12. **Automation:** draft-first rules, execution history and explicit publish authorization.
13. **Hardening:** SSRF protection, malware scanning, observability, backup/restore and security review.
14. **Delivery:** production Compose/Coolify, Forgejo CI/CD and end-to-end acceptance checks.

Each phase requires its own reviewed migrations, relevant tests, type checking, linting and build. Production readiness is gated on the end-to-end journey in the product brief; a foundation alone does not meet it.
