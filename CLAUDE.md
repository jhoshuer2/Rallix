# Rallix

Mobile-first PWA for table tennis clubs in Nigeria. Slack-style multi-tenancy: one platform, many clubs, each on its own subdomain. A player account can belong to several clubs, and each club's data is separate.

## Layout (pnpm + Turborepo monorepo)
- `apps/club`: club PWA (admin and player, role-based routes), on `{club}.rallix.app`
- `apps/console`: Rallix platform console (desktop-first, platform owner only): usage, payments, invoices and templates, notifications, issues
- `packages/ui`: design tokens, fonts, shared components. `packages/db`, `stats`, `payments`, `config`
- `design/admin-screens/`: source design frames (440x956 SVG, club admin side). Text is outlined, so render to PNG to read them.

Tokens live in `packages/ui/src/tokens.css`. Fonts: Spotlight (headings), General Sans Variable (body). Files go in `packages/ui/fonts/`.

## Stack
- Next.js (App Router, TypeScript), PWA via serwist
- Postgres (Supabase by default) with Drizzle ORM
- Paystack for club subscriptions and player dues, behind a `PaymentProvider` interface
- Vitest for unit tests, Playwright (mobile viewport) for E2E

## Database (`packages/db`)
- Drizzle schema in `src/schema/`, migrations in `drizzle/`. RLS, helper functions and grants are hand-written in `0001_rls_and_functions.sql`.
- Three roles: `rallix_owner` (migrations only), `rallix_app` (web app, subject to RLS), `rallix_service` (console, auth, stats engine, webhooks; BYPASSRLS, server-only).
- The app must query only through `withTenant(db, { userId, clubId }, fn)`. Club and membership rows are created only via `app.create_club()` and `app.join_club()`.
- All club data points at `memberships.id` (a user's identity inside one club), never `users.id`. Cross-table references are composite `(id, club_id)` foreign keys.
- Money is stored in kobo (integers). `app` role can read only `id, name, image, created_at` from `users`.
- Any new club-scoped table needs: `club_id`, RLS enabled, policies, composite FKs, least-privilege grants, and a test in `test/rls.test.ts`.
- Run `pnpm --filter @rallix/db test` after any schema or policy change (needs local Postgres; see `packages/db/README.md`).

## Rules
- Every tenant table has `club_id` and is protected by Postgres row-level security. `users` is global. `memberships(user_id, club_id, role, status)` links them.
- Roles: club admin, player, scorer/umpire, coach.
- Stats and Elo come from confirmed match data. Keep the engine in `lib/stats/` as pure functions with tests. Never claim a stat the recorded data cannot support.
- The `points` table exists from day one (nullable data until point-by-point scoring ships). AI video analysis is phase 3.
- Scoring must work offline and sync later.
- Visual source of truth is the user's uploaded designs. Extract tokens first and do not invent a new look.
- Meet WCAG 2.1 AA, respect `prefers-reduced-motion`, and keep touch targets at least 44px.

## Skills
Project skills live in `.claude/skills/`: `rallix-motion`, `figma-to-code`, `rallix-a11y`. Also use `design:design-critique`, `design:accessibility-review`, `design:design-handoff`, `design:design-system` and `design:ux-copy`.

## Phases
0 design intake and foundation, 1 MVP (clubs, invites, profiles, dues, competitions, scoring, club leaderboard), 2 point-by-point and Elo and global leaderboard, 3 AI video analysis, 4 coach, spectator and inter-club features.
