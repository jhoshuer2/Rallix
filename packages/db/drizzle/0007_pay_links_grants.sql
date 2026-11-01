-- New clubs column and the token columns are service-only: re-state the app role's column grants without them.
-- (Column grants from 0005 list columns explicitly, so suspension_reason is already excluded. This makes the intent explicit.)
REVOKE ALL (suspension_reason) ON clubs FROM rallix_app
--> statement-breakpoint
-- A pay token must be 24+ chars from a non-guessable alphabet and cannot be set on non-issued invoices by accident.
ALTER TABLE platform_invoices ADD CONSTRAINT platform_invoices_pay_token_format CHECK (pay_token IS NULL OR pay_token ~ '^[A-Za-z0-9]{24,64}$')
--> statement-breakpoint
ALTER TABLE invoice_payments ADD CONSTRAINT invoice_payments_email_len CHECK (payer_email IS NULL OR length(payer_email) <= 254)
--> statement-breakpoint
-- A suspension reason only makes sense while the club is not active.
ALTER TABLE clubs ADD CONSTRAINT clubs_reason_needs_suspension CHECK (suspension_reason IS NULL OR status <> 'active')
--> statement-breakpoint
GRANT ALL ON ALL TABLES IN SCHEMA public TO rallix_service
