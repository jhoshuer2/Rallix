# Deploying Rallix on Vercel

Two Vercel projects from this one repo, plus a Postgres database (Supabase by default).

## 1. Database
1. Create a Supabase project. Use the **pooled** (transaction) connection string for the apps and the **direct** one for migrations.
2. Run migrations once as the owner role, then seed only if you want demo data:
   `DATABASE_URL_OWNER=<direct url> pnpm --filter @rallix/db exec tsx src/migrate.ts`
3. Set passwords for `rallix_app` and `rallix_service` (see `packages/db/README.md`) and build each app's connection string from them.

## 2. Projects (Vercel dashboard, "Add New Project", import this repo twice)
| Project | Root Directory | Domain |
|---|---|---|
| rallix-club | `apps/club` | `rallix.app` + wildcard `*.rallix.app` |
| rallix-console | `apps/console` | `console.rallix.app` |

The `vercel.json` in each app sets install and build commands for the monorepo. Enable "Include source files outside of the Root Directory" in each project's General settings. Wildcard domains need Vercel nameservers (or a wildcard CNAME) for `rallix.app`.

## 3. Environment variables
Copy names from `apps/club/.env.example` and `apps/console/.env.example`. Production needs at least:
- Both: `DATABASE_URL_APP` and `DATABASE_URL_SERVICE` (console needs only the service one), `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `MAIL_PROVIDER=smtp`, `SMTP_URL`, `MAIL_FROM`, `PAYMENTS_PROVIDER=paystack`, `PAYSTACK_SECRET_KEY`, `UNSUBSCRIBE_SECRET` (**same value in both**).
- Club: `APP_URL`, `CRON_SECRET` (16+ random chars).
- Console: `CLUB_APP_URL`.
Never set `MAIL_FAIL_ADDRESSES` or `PAYMENTS_PROVIDER=fake` in production (the app refuses them).

## 4. Reminders scheduler
`apps/club/vercel.json` registers a Vercel Cron that calls `/api/jobs/dues-reminders` daily at 07:00 UTC (08:00 in Lagos). Vercel sends `Authorization: Bearer $CRON_SECRET` automatically when `CRON_SECRET` is set. Check runs under Project, Settings, Cron Jobs.

## 5. After first deploy
- Paystack dashboard: webhook URL `https://<club host>/api/webhooks/paystack`.
- Run `pnpm --filter @rallix/payments smoke` with a TEST key, and `pnpm --filter @rallix/mailer send-test you@example.com`.
- Grant yourself console access: `pnpm --filter @rallix/db make-platform-admin you@example.com "Name"`.
