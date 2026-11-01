# Rallix

Mobile-first PWA for table tennis clubs in Nigeria. Slack-style multi-tenancy: one platform, many clubs, each on its own subdomain. A player account can belong to several clubs, and each club's data is separate.

## Layout (pnpm + Turborepo monorepo)
- `apps/club`: club PWA (admin and player, role-based routes), on `{club}.rallix.app`
- `apps/console`: Rallix platform console (desktop-first, platform owner only): usage, payments, invoices and templates, notifications, issues
- `packages/ui`: design tokens, fonts, shared components. `packages/db`, `stats`, `payments`, `mailer`, `config`
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

## App (`apps/club`)
- Auth: Better Auth with an emailed 6-digit code (`emailOTP` plugin, `lib/auth.ts`), runs on the service DB role. A first successful code creates the account. Codes are 5 minutes, 3 attempts, stored hashed. Sending is `sendSignInCode` in `lib/mail.ts`: it never throws, and caps one address at 5 codes per 10 minutes (counted in `email_log`). In development the email is printed to the server log (`[mail:dev] to ...`); production needs SMTP (see `packages/mailer/README.md`). Phone is an OPTIONAL contact field (normalised to +234 by `@rallix/config/phone`, saved via `updateContact`, unique, never verified, not readable by the app role).
- Request context: `lib/context.ts`. `requireClub()` / `requireRole()` guard pages, `inClub(ctx, fn)` runs queries as the signed-in user in the active club (cookie `rallix_club`, always re-validated against memberships).
- Reads live in `lib/queries.ts`, writes are server actions in `lib/actions.ts`. Only export intended actions from that file: every export in a `"use server"` file is a public endpoint.
- Never use `serviceDb()` for anything scoped by user input unless the app-role checks have already passed (see `saveResult` then `updateRatings`).
- Pure logic (Elo, records, head to head, score validation, round-robin) lives in `packages/stats` with tests. Keep it free of I/O.
- Club switching is a plain `<a href="/switch/:id">` on purpose: `next/link` would prefetch it and change the active club.
- `pnpm --filter @rallix/stats test`, `pnpm --filter @rallix/db test`, and `apps/club/e2e/full-flow.cjs` (see its header) should all pass before merging.

## Email (`packages/mailer`)
- `createMailer(env)`: `SmtpMailer` (nodemailer, one `SMTP_URL`) or `ConsoleMailer` (dev; `MAIL_FAIL_ADDRESSES=a@x.com,b@x.com` makes chosen addresses fail on purpose). Production refuses the console mailer. Setup, SPF/DKIM/DMARC and the go-live check: `packages/mailer/README.md`; try it with `pnpm --filter @rallix/mailer send-test you@example.com`.
- `email_log` records every attempt (never the code or body); `notification_deliveries` is the per-person broadcast queue. Both are service-only.
- SQL trap: `error <> 'x'` is NOT true when `error` is NULL. Use `(error is null or error <> 'x')` (a regression test covers it).
- Tests: `pnpm --filter @rallix/mailer test` (includes a real SMTP round trip against a local server), `apps/club/e2e/email.cjs` (needs both apps; console must run with `MAIL_FAIL_ADDRESSES=fail@example.com`).

## Console (`apps/console`, port 3001)
- Desktop-first back office for the platform team. Own sign-in (emailed code, cookie prefix `rallix-console`, 12 h sessions) on the same user tables. `disableSignUp` is on: the console never creates accounts and an unknown email gets no code but the same screen, so it does not reveal who exists. Signing in is not enough: `requireAdmin()` (`lib/guard.ts`) checks the `platform_admins` list on every page and action, so removing someone takes effect on their next request.
- Uses only the service DB role (BYPASSRLS). Every server action in `lib/actions.ts` must call `requireAdmin()` first, validate its input, and write an `audit_log` row. Console-only tables (`issues`, `templates`, `platform_settings`, `notifications`, `audit_log`, `platform_admins`) have no app-role grants.
- Grant access with `pnpm --filter @rallix/db make-platform-admin you@example.com "Name"` (creates the account if needed). Dev seed admin: owner@rallix.app. Team members are added by email and must already have an account.
- Suspending or closing a club (`clubs.status`) is enforced in Postgres (`app.is_member` / `has_role` / `is_self` require an active club), not just in the UI. Members land on `/suspended` in the club app.
- Email is real: invoices (and past-due reminders) are emailed to a club's admins from the invoice page (`lib/email-core.ts`), and notifications on the Email channel are sent in batches of 100 with per-person rows in `notification_deliveries` (claimed with `FOR UPDATE SKIP LOCKED`, so two staff clicking at once never double-send). Push, SMS and WhatsApp are not connected and stay `queued`. Template placeholders are whitelisted per template in `lib/placeholders.ts`; a missing value fails before anything is sent. Invoices can also be paid online or recorded by hand.
- Templates, `{{pay_link}}`, `{{invoice_number}}` etc. are filled by `@rallix/mailer` `compose()`: values are escaped for HTML, and CR/LF in subjects or addresses is rejected (header injection).
- Invoice numbers come from `app.next_invoice_number()` (service role only); one invoice per club per `period_label`.
- Touch targets: 44px minimum in the club PWA; the desktop console uses at least 36px for buttons and inputs.
- Console e2e: `apps/console/e2e/full-flow.cjs` (needs both apps running; see its header).

## Payments (`packages/payments`, `apps/club/lib/payments*.ts`)
- `PaymentProvider` interface with `PaystackProvider` and a `FakeProvider` (dev/tests; production refuses it). Money is integer kobo and always comes from the database.
- ONE crediting routine: `finalizeByReference` in `lib/payments-core.ts`. Webhook (`/api/webhooks/paystack`) and return page (`/pay/return`) both call it. It verifies with the provider and reconciles reference, amount, currency and status against what we recorded BEFORE the customer paid; credit is transactional and idempotent. Never credit from a request body.
- Club bank details (`clubs.paystack_subaccount_code`, `payout_*`) are service-role only; the app role has column-level grants and cannot read or change them. Only `savePayoutAccount` writes them, after re-resolving the account with the provider.
- Do not use `instanceof PaymentError` across bundles; use `isPaymentError()`.
- Do not pass JS arrays to `= any(...)` in raw SQL; expand into `IN (...)` (see `list()` in the console queries).
- Before real money: run `pnpm --filter @rallix/payments smoke` with a TEST key and follow `packages/payments/README.md`.
- Public pay links: `/pay/invoice/[token]` (club app, no sign-in). `lookupPayLink` in `lib/pay-link.ts` is the only reader; it returns club name, number, period, amount and nothing personal. Tokens (`platform_invoices.pay_token`) are service-only: the app role has column grants that exclude them. Shape-check tokens (`isPayTokenShape`) before any DB lookup. A return page must verify the reference belongs to the token's invoice.
- Reactivation lives inside `finalizeInvoice` (same transaction as the credit): only a club suspended with `suspension_reason = non_payment` and no other overdue invoice comes back; the rule is the pure `shouldReactivate()`. Setting a reason without a suspension is blocked by a CHECK; clear it in the same UPDATE as the status.
- Never grant `SELECT` on a whole table when it holds secrets: use column grants (`platform_invoices`, `clubs`). When adding a column, decide whether the app role may read it.
- Tests: `pnpm --filter @rallix/payments test`, `apps/club/e2e/payments.cjs` and `apps/club/e2e/pay-link.cjs` (both need both apps and a fresh seeded DB).
- Every account now has a real email, so Paystack receipts reach the payer (no more placeholder addresses).

## Dues reminders
- Per-club, OFF by default (`reminder_settings`: `enabled`, `offsets` = days relative to due date, e.g. -3, 0, 3, 7). Club admins edit them at `/membership/reminders` and can press "Send now".
- Rules are the pure `nextReminder` in `packages/payments/src/reminders.ts` (browser-safe, import from `@rallix/payments/reminders`): only the latest eligible offset, a 2-day grace window, never repeat. Sending is `runDueReminders` in `apps/club/lib/reminders-core.ts`.
- Idempotence: each send first claims a row in `reminder_log` (UNIQUE `due_id, offset_days`) with `INSERT ... ON CONFLICT DO UPDATE ... WHERE`; failed rows retry up to 3 attempts, stale `sending` rows after 10 minutes. Never send without a claim.
- Scheduler: call `POST /api/jobs/dues-reminders` once a day with `Authorization: Bearer $CRON_SECRET` (optional `?club=<uuid>`). 503 if `CRON_SECRET` is missing or under 16 chars. "Today" is computed in each club's timezone. The `today` override is ignored in production.
- Opt-out: `users.email_opt_out`. Every reminder carries a signed one-click unsubscribe link (`@rallix/mailer` `signUnsubscribeToken`, `List-Unsubscribe` headers). GET only shows a confirm page; POST acts. Players also have a switch on their Me page. The console's optional broadcasts honour it too.
- `UNSUBSCRIBE_SECRET` must be identical in both apps; `CRON_SECRET` is only needed by the club app. Test: `apps/club/e2e/reminders.cjs` (needs both apps).

## Rules
- Every tenant table has `club_id` and is protected by Postgres row-level security. `users` is global. `memberships(user_id, club_id, role, status)` links them.
- Roles: club admin, player, scorer/umpire, coach.
- Stats and Elo come from confirmed match data. Keep the engine in `lib/stats/` as pure functions with tests. Never claim a stat the recorded data cannot support.
- The `points` table exists from day one (nullable data until point-by-point scoring ships). AI video analysis is phase 3.
- Scoring must work offline and sync later.
- Visual source of truth is the user's uploaded designs. Extract tokens first and do not invent a new look.
- Meet WCAG 2.1 AA, respect `prefers-reduced-motion`, and keep touch targets at least 44px in the club PWA.

## Skills
Project skills live in `.claude/skills/`: `rallix-motion`, `figma-to-code`, `rallix-a11y`, `rallix-premium-ui` (the design system: use it for EVERY club-app screen. `PageShell`/`EntryShell` layouts, six card kinds, serif titles, Hugeicons, table blue `#1450C8`; `/kit` is the living style guide and `packages/ui/src/design-system.test.ts` fails on legacy cards). Also use `design:design-critique`, `design:accessibility-review`, `design:design-handoff`, `design:design-system` and `design:ux-copy`.

## Phases
0 design intake and foundation, 1 MVP (clubs, invites, profiles, dues, competitions, scoring, club leaderboard), 2 point-by-point and Elo and global leaderboard, 3 AI video analysis, 4 coach, spectator and inter-club features.
