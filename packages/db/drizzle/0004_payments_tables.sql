CREATE TABLE "invoice_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" uuid NOT NULL,
	"club_id" uuid NOT NULL,
	"reference" text NOT NULL,
	"amount_kobo" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"initiated_by" text,
	"paid_at" timestamp with time zone,
	"raw" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invoice_payments_reference_unique" UNIQUE("reference"),
	CONSTRAINT "invoice_payments_status" CHECK ("invoice_payments"."status" IN ('pending','paid','failed')),
	CONSTRAINT "invoice_payments_amount" CHECK ("invoice_payments"."amount_kobo" > 0)
);
--> statement-breakpoint
CREATE TABLE "payment_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"event" text NOT NULL,
	"reference" text,
	"signature_valid" boolean NOT NULL,
	"outcome" text NOT NULL,
	"detail" text,
	"raw" jsonb,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "clubs" ADD COLUMN "paystack_subaccount_code" text;--> statement-breakpoint
ALTER TABLE "clubs" ADD COLUMN "payout_bank_name" text;--> statement-breakpoint
ALTER TABLE "clubs" ADD COLUMN "payout_bank_code" text;--> statement-breakpoint
ALTER TABLE "clubs" ADD COLUMN "payout_account_name" text;--> statement-breakpoint
ALTER TABLE "clubs" ADD COLUMN "payout_account_last4" text;--> statement-breakpoint
ALTER TABLE "clubs" ADD COLUMN "payouts_enabled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "invoice_payments" ADD CONSTRAINT "invoice_payments_invoice_id_platform_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."platform_invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_payments" ADD CONSTRAINT "invoice_payments_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_payments" ADD CONSTRAINT "invoice_payments_initiated_by_users_id_fk" FOREIGN KEY ("initiated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "invoice_payments_invoice_idx" ON "invoice_payments" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "payment_events_ref_idx" ON "payment_events" USING btree ("reference");--> statement-breakpoint
CREATE INDEX "payment_events_received_idx" ON "payment_events" USING btree ("received_at");--> statement-breakpoint
ALTER TABLE "clubs" ADD CONSTRAINT "clubs_payouts_need_subaccount" CHECK ("clubs"."payouts_enabled_at" IS NULL OR "clubs"."paystack_subaccount_code" IS NOT NULL);