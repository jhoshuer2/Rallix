-- Service-only tables: RLS on, no policy, no app-role grant.
ALTER TABLE invoice_payments ENABLE ROW LEVEL SECURITY
--> statement-breakpoint
ALTER TABLE payment_events ENABLE ROW LEVEL SECURITY
--> statement-breakpoint
GRANT ALL ON ALL TABLES IN SCHEMA public TO rallix_service
--> statement-breakpoint
-- Clubs: replace table-wide SELECT/UPDATE with column grants so the app role can neither read
-- bank/subaccount details nor change where money is paid out.
REVOKE SELECT, UPDATE ON clubs FROM rallix_app
--> statement-breakpoint
GRANT SELECT (id, slug, name, logo_url, location, timezone, status, owner_id, payouts_enabled_at, created_at, updated_at) ON clubs TO rallix_app
--> statement-breakpoint
GRANT UPDATE (name, logo_url, location, timezone) ON clubs TO rallix_app
