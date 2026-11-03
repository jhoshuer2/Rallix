# Rallix

**Read `docs/PRODUCT.md` first: it defines what Rallix is, who uses it and the principles every screen follows (calm, show a section only when it has data, understandable without the creator).**

Mobile-first PWA for table tennis clubs in Nigeria. Slack-style multi-tenancy: one platform, many clubs, each on its own subdomain. A player account can belong to several clubs, and each club's data is separate.

## Layout (pnpm + Turborepo monorepo)
- `apps/club`: club PWA (admin and player, role-based routes), on `{club}.rallix.app`
- `apps/console`: Rallix platform console (desktop-first, platform owner only): usage, payments, invoices and templates, notifications, issues
- `packages/ui`: design tokens, fonts, shared components. `packages/db`, `stats`, `payments`, `mailer`, `config`
- `design/admin-screens/`: source design frames (440x956 SVG, club admin side). Text is outlined, so render to PNG to read them.

Tokens live in `packages/ui/src/tokens.css`. Fonts: Barlow Condensed 600/700 (headlines, big numbers, scores), General Sans Variable (body). Files go in `packages/ui/fonts/`.

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
- Grant access with `pnpm --filter @rallix/db make-platform-admin you@example.com "Name"` (creates the account if needed; makes them an OWNER). Dev seed admin: owner@rallix.app. Team members are added by email by an owner, with a role, and must already have an account.
- Staff roles (`platform_admins.role`): owner (everything), admin (everything except the team), finance (clubs, subscriptions, invoices, payments), support (issues and the club inbox; can look at clubs). The pure map is `staffCan(role, area)` in `packages/config/src/staff.ts`. EVERY console page and server action calls `requireAdmin(area)` with its area (`clubs`, `clubs_manage`, `billing`, `support`, `notifications`, `templates`, `audit`, `team`); a role without the area is sent to the overview. A trigger keeps at least one owner. Unknown roles get no access.
- Club approval: `platform_settings.club_approval` (default OFF, switch on the console Clubs page). When on, `app.create_club` starts a club `pending`; its members are blocked like a suspended club (`app.blocked_clubs`) and the club app shows "We're reviewing your club". Staff with `clubs_manage` approve (club becomes `active`) or decline with a reason (`closed`); both email the owner (`email_log` kind `club_review`) and write an audit row. Only a pending club can be approved or declined (`canChangeClubStatus` in `packages/config/src/club-status.ts`). A payment never reactivates a pending club.
- Plan catalogue: `platform_plans` (console only, never deleted, switch off to stop offering) and `club_subscriptions.plan_id`. The console subscription form takes the price from the plan (no plan = the old custom amount). The member limit is enforced by a TRIGGER on `memberships` (`app.enforce_member_limit`: only active players count, per-club advisory lock, error `club_full`), so invites, open join, approved applications and the console are all covered; the club app turns `club_full` into a friendly message. Limit comes from the club's latest trialing/active/past_due plan (`app.club_member_limit`); admins read `app.my_club_plan()`; Home nudges at five places left (`memberLimitState`). Test: `apps/club/e2e/approval.cjs` (needs both apps).
- Support inbox: club members send requests with `app.report_issue` (club app Help screens, five a day each, club and sender set by the database); `app.my_issues()` returns only the sender's own requests. Staff reply from the issue page (`replyToIssue`), which emails the sender (`email_log` kind `support`).
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

## Home screens
- Player home (`(player)/play/page.tsx`): header, My performance, Upcoming matches, Latest results, Top 5, Upcoming competitions, Club updates. Admin home (`(admin)/page.tsx`): overview KPIs, quick actions, competitions with registrations, membership overview, activity, top players. Pure helpers `membershipOverview` and `mergeActivity` live in `packages/stats/src/overview.ts`. The bell opens `/activity`, derived from real records (no unread counts).

## Arrival check-in and alerts (`lib/arrival-*.ts`, `lib/push.ts`, `public/sw.js`)
- A web app cannot track location in the background. Arrival is a tap on "I've arrived" (or automatic only while the app is open and location is already allowed). True background geofencing needs a native shell later, which can reuse `checkIn` with `method: auto`.
- Admin sets the court (`clubs.venue_lat/lng/radius_m`, admin-only via RLS). Players opt in per club (`player_profiles.share_arrival`, `notify_arrivals`, `auto_arrival`). `checkIn` verifies the position SERVER-side with the pure `withinVenue` (`packages/stats/src/geo.ts`: accuracy above 150 m refused, accuracy allowed as slack) and stores NO coordinates, only `arrivals` times. One open arrival per member (partial unique index); arrivals older than 6 h stop counting; others are alerted at most once per 2 h (`arrivals.alerted_at`, written by the service role only).
- The `arrivals` insert uses plain SQL on purpose: the app role has a column-level INSERT grant (`club_id, membership_id, method`), and Drizzle's insert names every column.
- Push: `PUSH_PROVIDER=web` with `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`; dev uses the console sender (`[push:dev] to <userId> | ...`), production refuses it. `push_subscriptions` holds secrets: service-role only. `sendToUsers` never throws and deletes dead (404/410) subscriptions. `public/sw.js` only shows pushes and handles clicks (same-site URLs only); it caches nothing. iPhone alerts need the app added to the Home Screen.
- Tests: `pnpm --filter @rallix/stats test` (geo), `pnpm --filter @rallix/db test` (arrivals, venue, push RLS), `apps/club/e2e/arrivals.cjs`.

## Competition preview and sign-up (`lib/competition-*.ts`, `components/CompetitionJoin.tsx`)
- Lifecycle: `draft` is the sign-up phase (no fixtures); an admin presses Start (`startCompetition`) to seed by rating and generate fixtures (`seedAndGenerate` in `lib/competition-core.ts`, also used by `createCompetition`), then it is `active`. With "Players can join themselves" off, creation works as before (active at once).
- Visibility is enforced by the `competitions` read policy: players see active, completed, and drafts with `open_registration`; admins see all. Entries of hidden drafts are hidden too.
- Players never write `competition_entries`: they call `app.join_competition` / `app.leave_competition` (SECURITY DEFINER, row lock so the last spot cannot be taken twice; checks open, deadline in the club's timezone, spot limit, level). The pure `registrationState` (`packages/stats/src/registration.ts`) drives the button and must agree with the SQL.
- Preview details (summary 140, prize 100, rules 8000, cover, spots, closing date) are admin-written via `saveCompetitionDetails`; the cover uses the media pipeline kind `competition-cover` (target `competition-cover` plus `competitionId`).
- UI: `CompetitionBanner`, `SpotsBar`, `ListRow onClick` (opens a sheet); one main button per state, a quiet Leave while it is a draft. Test: `apps/club/e2e/competition-preview.cjs`.

## Pictures (`packages/media`, `apps/club/lib/media*.ts`, `components/PhotoUploader.tsx`)
- Every upload goes through `uploadPhoto` / `removePhoto` (`lib/media-actions.ts`) and `applyUpload` in `lib/media-core.ts`: authorise with `authorizeTarget` (player: own photo only; admin: any member and the club logo and cover), rate limit from `upload_log` (service-only), `processImage` (sharp: JPEG/PNG/WebP only, EXIF and GPS stripped, resized to WebP; SVG, GIF, HEIC refused), `store.put`, then the DB write runs AS THE USER so row-level security is a second lock, then best-effort delete of the old object (only our own keys, only in this club).
- Keys are `clubs/{clubId}/{people|logo|cover}/{uuid}.webp` (never user filenames). Stores: `LocalStore` (dev and tests, served by `app/media/[...key]/route.ts`, 404 in production) and `S3Store` (Supabase Storage). `createStore` refuses local in production. Config: `STORAGE_PROVIDER`, `S3_*`, `MEDIA_PUBLIC_BASE`, `UPLOAD_LIMIT_PER_DAY` (see `DEPLOY.md` section 6).
- `photo_url`, `logo_url`, `cover_url` have CHECK constraints: `https://...` or a local `/path` (never `//host`, `javascript:` or `data:`).
- Do not use `instanceof` on store classes across bundles; compare `store.name`.
- Tests: `pnpm --filter @rallix/media test`, RLS tests in `packages/db`, crop maths in `packages/ui`, and `apps/club/e2e/uploads.cjs`.

## Friendly challenges (`lib/friendly-*.ts`, `(playerflow)/play/friendlies`)
- A friendly is a one-on-one between two members of a club, outside any competition (`challenges` table; `matches` still requires a competition). Flow: `proposed` -> `accepted` -> `awaiting` (one player entered the score) -> `confirmed`; or `declined` / `cancelled`. The player who did NOT enter the score confirms it or disputes it (which clears the score).
- Nobody writes `challenges` directly and only the two players can read a row (not even the club admin). Every change is a SECURITY DEFINER function run as the user: `app.propose_challenge`, `respond_challenge`, `cancel_challenge`, `record_challenge_result`, `confirm_challenge_result` (+ helper `app.my_membership`). One open challenge per pair, at most 5 unanswered per player.
- Rating: each player ticks "Count it for the ranking"; it moves Elo only when BOTH agreed (`isRated`). `applyFriendlyRating` (service role, after the app-role checks) claims `rated_at IS NULL` once, and moves only the club and global ratings, never competition ratings. The Stats rating chart still comes from competition `rating_events`.
- Pure rules (score validity, next step, record, Elo helper) are in `packages/stats/src/friendly.ts` and must agree with the SQL. UI: Ranks rows open the challenge form, `/play/friendlies` lists Needs you / Coming up / Played, Home shows a short "waiting for you" list only when something needs the player.
- Cross-club challenges wait for the global leaderboard phase. Test: `apps/club/e2e/friendlies.cjs`.

## Schedule, facilities, attendance (`lib/schedule-*`, `lib/facility-*`, `lib/attendance-*`, `lib/card.ts`)
- Schedule: `club_events` (kind `play` | `event` | `closed`; weekly repeat only for `play`; optional `doors_open`). Facilities admin writes it, every member reads it. The pure `occurrences` (`packages/stats/src/schedule.ts`) expands weekly sessions and hides sessions on closed days. Player `/play/calendar` has Today / This week / This month chips and an "I'm coming" button per session or event (`app.rsvp`: the day must be real, not closed, today to 60 days ahead; RSVPs are private: your own, or everyone's for the Members admin).
- Facilities: `facility_items` and the append-only `facility_log`, Facilities admin only. Stock changes go through `app.adjust_stock` (logged in the same step, never below zero).
- Attendance: door check-in is `app.door_check_in/out` (Members admin, method `door`). The member card QR is a signed token (`@rallix/config/card-token`: HMAC over club, member and the current minute, valid two minutes, key derived from `BETTER_AUTH_SECRET`). The scan (`lookupCard`) shows standing only (paid up or not), never amounts, and never blocks: the admin decides. Camera scanning needs HTTPS and permission; it is not covered by an automated test.
- Tests: `schedule.cjs`, `facilities.cjs`, `attendance.cjs`, `rsvp.cjs`.

## Competition formats, points, awards, seasons, waitlist
- Knockout (`packages/stats/src/knockout.ts`): `buildKnockout` (byes to top seeds, standard seed placement, feeds), `drawOrder` (seeded or raffle, the raffle is drawn once at start and `drawn_at` is set). `generateKnockout` in `lib/competition-core.ts` inserts the final first so each match knows what it feeds. `saveResult` moves the winner into the next match in the same transaction.
- Points and awards: `standings` (win/loss points per competition, tie-breaks head-to-head, game difference, point difference), `seasonTable`, `awardsFromTable`, `awardsFromKnockout`. `finishIfDone` (`lib/competition-finish.ts`, service role, idempotent) completes a competition when every match is decided and records the podium in `competition_awards` (written only by the server). Group stage completes without awards.
- Seasons: `seasons` plus `competitions.season_id` (composite FK, own club only). Never deleted. Ranks shows the running season as an extra option once it has results.
- Waitlist: `competition_waitlist`, written only by `app.join_waitlist` / `leave_waitlist`. A trigger on `competition_entries` promotes the oldest eligible waiter whenever a spot opens (leave, admin removal) and `app.promote_waitlist` is called after the admin raises the limit. `registrationState` has `waitlist` and `waiting`. The competition preview's one main action is a sticky bottom bar (`StickyBar`).
- Tests: `knockout.cjs`, `seasons.cjs`, `waitlist.cjs`.

## Rules
- Every tenant table has `club_id` and is protected by Postgres row-level security. `users` is global. `memberships(user_id, club_id, role, status)` links them.
- Roles: club admin, player, scorer/umpire, coach.
- Stats and Elo come from confirmed match data. Keep the engine in `lib/stats/` as pure functions with tests. Never claim a stat the recorded data cannot support.
- The `points` table exists from day one (nullable data until point-by-point scoring ships). AI video analysis is phase 3.
- Scoring must work offline and sync later.
- Visual source of truth is the user's uploaded designs. Extract tokens first and do not invent a new look.
- Meet WCAG 2.1 AA, respect `prefers-reduced-motion`, and keep touch targets at least 44px in the club PWA.

## Skills
Project skills live in `.claude/skills/`: `rallix-motion`, `figma-to-code`, `rallix-a11y`, `rallix-premium-ui` (the design system: use it for EVERY club-app screen. `PageShell`/`EntryShell` layouts, six card kinds, condensed uppercase titles, Hugeicons, table blue `#1B6FE0`; `/kit` is the living style guide and `packages/ui/src/design-system.test.ts` fails on legacy cards). Also use `design:design-critique`, `design:accessibility-review`, `design:design-handoff`, `design:design-system` and `design:ux-copy`.

## Phases
0 design intake and foundation, 1 MVP (clubs, invites, profiles, dues, competitions, scoring, club leaderboard), 2 point-by-point and Elo and global leaderboard, 3 AI video analysis, 4 coach, spectator and inter-club features.
