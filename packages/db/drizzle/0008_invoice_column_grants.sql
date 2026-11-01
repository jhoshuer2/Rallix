-- platform_invoices was granted table-wide in 0001, which now includes pay_token. A pay token lets anyone who holds it
-- start a payment for that invoice, so club admins and the app role must never read it: switch to column grants.
REVOKE SELECT ON platform_invoices FROM rallix_app
--> statement-breakpoint
GRANT SELECT (id, club_id, number, status, amount_kobo, period_label, description, issued_at, due_at, paid_at, payment_ref, pdf_url, created_at) ON platform_invoices TO rallix_app
