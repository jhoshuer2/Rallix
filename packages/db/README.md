# @rallix/db

Postgres schema, row-level security, migrations, seed and isolation tests.

## Roles (`scripts/bootstrap-roles.sql`)
| Role | Used by | Notes |
|---|---|---|
| `rallix_owner` | migrations only | owns tables, exempt from RLS. Never use at runtime. |
| `rallix_app` | the web app (club PWA) | subject to RLS, least-privilege grants, no BYPASSRLS. |
| `rallix_service` | console, auth, stats engine, Paystack webhooks | BYPASSRLS. Server-only, keep off any client path. |

## How isolation works
Every club-scoped table has `club_id` and RLS. Each request runs through `withTenant(db, { userId, clubId }, fn)`, which sets `app.user_id` and `app.club_id` for that transaction only. Policies require an active membership in `app.club_id` and check roles for writes. References between club tables use composite foreign keys `(id, club_id)`, so a row cannot point into another club.

Clubs and memberships are created only through `app.create_club()` and `app.join_club()` (security definer). The app role cannot insert them directly.

Known limit: the context values are ordinary session settings, so a SQL injection bug in the app could change them. Always use parameterised queries and keep `withTenant` as the only way the app talks to Postgres.

## Commands
```bash
pnpm --filter @rallix/db db:create rallix_dev   # local roles + database (needs the postgres OS user)
pnpm --filter @rallix/db migrate
pnpm --filter @rallix/db seed
pnpm --filter @rallix/db test                   # rebuilds rallix_test from scratch, then runs isolation tests
pnpm --filter @rallix/db generate               # after editing src/schema
```
Row-level security and functions live in a hand-written migration (`drizzle/0001_rls_and_functions.sql`). Statements are separated by `--> statement-breakpoint`.

## Auth tables
`users`, `sessions`, `accounts`, `verifications` follow Better Auth's default column names plus phone-number fields. Confirm against the installed Better Auth version when wiring auth. Only `rallix_service` can read `sessions`, `accounts` and `verifications`.
