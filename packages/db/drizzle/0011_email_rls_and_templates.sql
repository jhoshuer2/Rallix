ALTER TABLE email_log ENABLE ROW LEVEL SECURITY
--> statement-breakpoint
ALTER TABLE notification_deliveries ENABLE ROW LEVEL SECURITY
--> statement-breakpoint
GRANT ALL ON ALL TABLES IN SCHEMA public TO rallix_service
--> statement-breakpoint
-- Players' dues reminders go by email now. (Sending them is a later feature; this just keeps the template usable.)
UPDATE templates SET kind = 'email', subject = 'Your {{club_name}} dues are due', name = 'Dues reminder' WHERE key = 'dues_reminder' AND kind = 'sms'
--> statement-breakpoint
-- Users can no longer be created without an email, so their sign-in identity is unique case-insensitively too.
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_uq ON users (lower(email))
