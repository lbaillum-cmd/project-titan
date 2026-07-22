# PROJECT TITAN

Consolidated Sprint 034–045 private-beta candidate: production monorepo, authentication, profiles, community selection, Community Dashboard, append-only Inventory Engine, participant Verification Engine, authenticated Real-Time Engine, persistent Notifications Engine, protected Administration Engine, Analytics Engine, and beta operational hardening.

## Prerequisites

- Node.js 22+
- pnpm 10+
- Docker Desktop
- Git

## Start locally

```bash
cp .env.example .env
docker compose up -d postgres
pnpm install
pnpm db:generate
pnpm db:migrate
pnpm dev
```

Open:

- Web: http://localhost:3000
- API: http://localhost:4000
- Health: http://localhost:4000/health

## Workspace

- `apps/web` — Next.js frontend
- `apps/api` — Fastify API
- `packages/database` — Prisma schema and shared Prisma client

## Implemented journey

1. Create an account or sign in.
2. Select a state, city, and community role.
3. Enter the Community Dashboard.
4. See database-backed city membership progress and the next mission.
5. Record five-token participant contributions in an idempotent, append-only inventory ledger.
6. Approve or reject contributions made about you; projected balances update without rewriting ledger history.
7. Receive live inventory, verification, and community-progress updates over user-scoped WebSocket channels.
8. Review persistent notifications, follow action links, and manage individual or bulk read state.
9. Authorized operators can review platform health, accounts, rejected claims, and audited suspension/reactivation actions.
10. Operators can measure the participation funnel, verification outcomes, token volume, community adoption, and 30-day trends.
11. CI migrates a fresh PostgreSQL database and exercises the complete register → onboard → contribute → verify → inventory First Loop.

Authentication uses short-lived JWT access tokens and opaque, hashed, rotating refresh sessions. Passwords are hashed with bcrypt.

Inventory balances are projections of immutable `InventoryEvent` records. New contributions begin as `PENDING`; participant decisions add `CONTRIBUTION_VERIFIED` or `CONTRIBUTION_REJECTED` events without rewriting ledger history.

Real-time connections require a short-lived, single-use ticket issued through an authenticated API request. Event channels are scoped to the signed-in user.

Contribution and verification activity creates durable notifications in PostgreSQL and also publishes a user-scoped `notification.created` event for immediate interface refresh.

## Enable the first administrator

Register the founder account normally, set `TITAN_ADMIN_EMAIL` in `.env`, then run `pnpm db:seed-admin`. Administrative role and status are enforced by the API; suspended accounts cannot sign in and their active sessions are revoked.

Analytics are calculated from authoritative membership and immutable inventory-event records. Administrative metrics are protected by role checks; personal inventory analytics remain scoped to the authenticated member.

## Private beta readiness

- API security headers and per-client rate limits are enabled.
- Authentication endpoints have stricter rate limits.
- Production environment variables are validated at startup.
- `/health/live` reports process liveness; `/health/ready` verifies PostgreSQL connectivity.
- SIGINT and SIGTERM trigger graceful shutdown.
- Web responses include anti-framing, MIME-sniffing, referrer, and browser-permission headers.
- CI installs from the lockfile, deploys migrations to PostgreSQL 17, runs static gates and unit tests, executes the database-backed First Loop, and builds production artifacts.

Local verification in the Codex workspace covers typecheck, lint, 25 unit/API tests, and both production builds. The database-backed integration test requires PostgreSQL and is configured for CI; it was not executed in the current workspace because Docker/PostgreSQL is unavailable there.

## First commit

```bash
git init
git add .
git commit -m "chore: bootstrap TITAN production monorepo"
```
