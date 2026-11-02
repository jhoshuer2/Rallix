-- Picture uploads: grants and row-level security for the new column and table.
-- Admins may change the club logo and cover (the clubs_update policy already restricts UPDATE to the club's admins).
GRANT SELECT (cover_url) ON clubs TO rallix_app
--> statement-breakpoint
GRANT UPDATE (cover_url) ON clubs TO rallix_app
--> statement-breakpoint
-- The upload log is service-only: the app role must not read who uploaded what, or write its own counts.
ALTER TABLE upload_log ENABLE ROW LEVEL SECURITY
--> statement-breakpoint
GRANT ALL ON ALL TABLES IN SCHEMA public TO rallix_service
