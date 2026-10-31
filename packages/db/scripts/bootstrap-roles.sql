-- Run once as a superuser (local dev: `su postgres -c "psql -f scripts/bootstrap-roles.sql"`).
-- On Supabase, run in the SQL editor and set real passwords.
--   rallix_owner   owns objects, runs migrations. Never used at runtime.
--   rallix_app     the web app role. Subject to RLS. No BYPASSRLS.
--   rallix_service server-only role for the console, auth and the stats engine. BYPASSRLS, so keep it off the client path.
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'rallix_owner')   THEN CREATE ROLE rallix_owner   LOGIN PASSWORD 'owner_dev'   NOBYPASSRLS; END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'rallix_app')     THEN CREATE ROLE rallix_app     LOGIN PASSWORD 'app_dev'     NOBYPASSRLS NOSUPERUSER NOCREATEDB NOCREATEROLE; END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'rallix_service') THEN CREATE ROLE rallix_service LOGIN PASSWORD 'service_dev' BYPASSRLS; END IF;
END $$;
