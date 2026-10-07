# Local development

The Next.js dashboard template remains intact while the social platform is added alongside it. The API and database are separate npm workspaces. Docker is optional.

## Run the existing dashboard

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. The existing screens, calendar data, and login/register pages are template examples. They are not yet connected to the social platform.

## Run the API with local PostgreSQL, without Docker

On the current development machine, PostgreSQL 17 is installed through Homebrew and `studio_dev` has already been migrated. It is running on `127.0.0.1:55432`. In a second terminal:

```bash
export DATABASE_URL="postgresql://$(whoami)@127.0.0.1:55432/studio_dev"
npm run dev:api
```

Check `http://localhost:3001/v1/health/live`, `http://localhost:3001/v1/health/ready`, and `http://localhost:3001/docs`. If readiness is unavailable, start the existing local cluster:

```bash
"$(brew --prefix postgresql@17)/bin/pg_ctl" \
  -D "$(brew --prefix)/var/postgresql@17" \
  -o '-p 55432 -h 127.0.0.1' \
  -l /tmp/studio-admin-postgres.log start
```

For a fresh macOS setup, install PostgreSQL with `brew install postgresql@17`, start its default service with `brew services start postgresql@17`, create a database with `"$(brew --prefix postgresql@17)/bin/createdb" studio_dev`, and set `DATABASE_URL="postgresql://$(whoami)@127.0.0.1:5432/studio_dev"`. Then run `npm run db:migrate` before starting the API. Use one cluster start method at a time.

Docker users can instead run `docker compose -f infra/docker/compose.yml up -d` and use `DATABASE_URL=postgresql://studio:studio-dev-only@localhost:5432/studio`.

The API exposes protected workspace list, create, read, and update routes. These require a signed OIDC access token with the configured issuer, API audience, authorized client ID, and an email claim. Set `OIDC_ISSUER_URL`, `OIDC_API_AUDIENCE`, and `OIDC_ALLOWED_CLIENT_ID` as shown in `apps/api/.env.example` after an identity provider is configured. The API does not load `.env` automatically; export variables in its shell. An unauthenticated workspace request returns 401. End-to-end web login is not connected yet.

## Schema and verification

Edit `packages/database/src/schema.ts`, run `npm run db:generate`, and inspect generated SQL and the Drizzle snapshot. Apply with `npm run db:migrate` only against the intended database. The initial migration orders composite unique indexes before foreign keys that reference them. Production migrations must be reviewed and applied as a separate deployment step.

The signed-token workspace integration test needs a disposable migrated database:

```bash
export TEST_DATABASE_URL="$DATABASE_URL"
npm run test:integration -w @studio/api
```

The test creates and removes its own users and workspace. Use a dedicated test database when possible. `npm run test:shared` and `npm run test -w @studio/api` run without PostgreSQL.
