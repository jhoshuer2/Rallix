-- Supabase bootstrap. Run as the `postgres` user with psql variables (never commit real passwords):
--   psql "$SUPABASE_ADMIN_URL" -v ON_ERROR_STOP=1 \
--     -v owner_pw="$OWNER_PW" -v app_pw="$APP_PW" -v service_pw="$SERVICE_PW" \
--     -f scripts/bootstrap-roles.supabase.sql
-- Safe to re-run: it resets the three passwords.
SELECT NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'rallix_owner')   AS mk_owner   \gset
SELECT NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'rallix_app')     AS mk_app     \gset
SELECT NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'rallix_service') AS mk_service \gset
\if :mk_owner
  CREATE ROLE rallix_owner LOGIN NOBYPASSRLS NOSUPERUSER;
\endif
\if :mk_app
  CREATE ROLE rallix_app LOGIN NOBYPASSRLS NOSUPERUSER NOCREATEDB NOCREATEROLE;
\endif
\if :mk_service
  CREATE ROLE rallix_service LOGIN BYPASSRLS;
\endif
ALTER ROLE rallix_owner   PASSWORD :'owner_pw';
ALTER ROLE rallix_app     PASSWORD :'app_pw';
ALTER ROLE rallix_service PASSWORD :'service_pw';
-- Let the postgres user manage objects the owner creates, and let the owner create schemas and tables.
GRANT rallix_owner TO postgres;
SELECT format('GRANT CREATE ON DATABASE %I TO rallix_owner', current_database()) \gexec
GRANT ALL ON SCHEMA public TO rallix_owner;
