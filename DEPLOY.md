# Deploying Rallix on Vercel

Two Vercel projects from this one repo, plus a Postgres database (Supabase by default).

## 1. Database (Supabase project `dihsahdbmpkbyzisskrw`)
Do this on your own machine (needs `psql`, `openssl`, `pnpm install`); the Supabase host is not reachable from the Claude sandbox, so this script has been tested against a local Postgres only.
1. Supabase dashboard, **Connect**, tab **Session pooler**: copy the connection string for the `postgres` user (port 5432) and note the pooler host (e.g. `aws-0-<region>.pooler.supabase.com`). Use the database password you set when creating the project. Do not paste it into chat or commit it.
2. Run:
```bash
export SUPABASE_ADMIN_URL='postgres://postgres.dihsahdbmpkbyzisskrw:<db password>@<pooler host>:5432/postgres?sslmode=require'
export SUPABASE_POOLER_HOST='<pooler host>'
export SUPABASE_PROJECT_REF='dihsahdbmpkbyzisskrw'
DATABASE_SSL=no-verify packages/db/scripts/supabase-setup.sh
```
It creates the `rallix_owner`, `rallix_app` and `rallix_service` roles with fresh random passwords, applies all migrations as the owner, checks that the app role cannot read `sessions`, and prints the two runtime connection strings (Transaction pooler, port 6543) once. Copy them straight into Vercel as `DATABASE_URL_APP` and `DATABASE_URL_SERVICE`, and set `DATABASE_SSL=no-verify` too.
3. No demo data is seeded. Create your own platform admin after the first sign-in (see step 5).

## 2. Projects (Vercel dashboard, "Add New Project", import this repo twice)
| Project | Root Directory | Domain |
|---|---|---|
| rallix-club | `apps/club` | `rallix.app` + wildcard `*.rallix.app` |
| rallix-console | `apps/console` | `console.rallix.app` |

The `vercel.json` in each app sets install and build commands for the monorepo. Enable "Include source files outside of the Root Directory" in each project's General settings. Wildcard domains need Vercel nameservers (or a wildcard CNAME) for `rallix.app`.

## 3. Environment variables
Copy names from `apps/club/.env.example` and `apps/console/.env.example`. Production needs at least:
- Both: `DATABASE_URL_APP` and `DATABASE_URL_SERVICE` (console needs only the service one), `DATABASE_SSL=no-verify`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `MAIL_PROVIDER=smtp`, `SMTP_URL`, `MAIL_FROM`, `PAYMENTS_PROVIDER=paystack`, `PAYSTACK_SECRET_KEY`, `UNSUBSCRIBE_SECRET` (**same value in both**).
- Club: `APP_URL`, `CRON_SECRET` (16+ random chars).
- Console: `CLUB_APP_URL`.
Never set `MAIL_FAIL_ADDRESSES` or `PAYMENTS_PROVIDER=fake` in production (the app refuses them).

## 4. Reminders scheduler
`apps/club/vercel.json` registers a Vercel Cron that calls `/api/jobs/dues-reminders` daily at 07:00 UTC (08:00 in Lagos). Vercel sends `Authorization: Bearer $CRON_SECRET` automatically when `CRON_SECRET` is set. Check runs under Project, Settings, Cron Jobs.

## 5. After first deploy
- Paystack dashboard: webhook URL `https://<club host>/api/webhooks/paystack`.
- Run `pnpm --filter @rallix/payments smoke` with a TEST key, and `pnpm --filter @rallix/mailer send-test you@example.com`.
- Grant yourself console access: `pnpm --filter @rallix/db make-platform-admin you@example.com "Name"`.


## 6. Pictures (profile photos, club logo and cover)
Pictures are stored in a public Supabase Storage bucket. The app re-encodes every upload on the server (JPEG, PNG or WebP only, location data removed, resized to WebP) before saving. Dashboard labels may differ slightly from these names.

1. **Apply the new database changes** (new `cover_url` column, upload log, address checks). On your Mac, in the repo folder, with the same three `export` lines as in section 1:
   ```bash
   packages/db/scripts/supabase-migrate.sh
   ```
2. **Create the bucket:** Supabase → Storage → New bucket → name `rallix-media` → turn **Public bucket** on.
3. **Create a storage-only access key:** Supabase → Storage → S3 Connection (or Settings → Storage → S3) → New access key. Copy the access key ID and secret now (the secret is shown once). Note the **endpoint** and **region** shown on that page. This key can only reach Storage, never your database.
4. **Set these variables on the club project in Vercel** (Production), then redeploy:
   | Variable | Value |
   |---|---|
   | `STORAGE_PROVIDER` | `supabase` |
   | `S3_ENDPOINT` | `https://<project-ref>.storage.supabase.co/storage/v1/s3` (as shown on the S3 page) |
   | `S3_REGION` | the region shown on that page, e.g. `eu-west-1` |
   | `S3_BUCKET` | `rallix-media` |
   | `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | the key from step 3 |
   | `MEDIA_PUBLIC_BASE` | `https://<project-ref>.supabase.co/storage/v1/object/public/rallix-media` |
5. **Check it:** sign in, open Me, tap "Add a picture", choose a photo and tap "Use picture". Then open the picture's address in a new tab: it must load. If the page says "Picture storage is not configured", a variable above is missing.

Limits: 4 MB per file at the server (the browser shrinks photos to under 1.5 MB first), 20 uploads per person per day (`UPLOAD_LIMIT_PER_DAY` to change).
