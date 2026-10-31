CREATE TYPE "public"."issue_severity" AS ENUM('low', 'normal', 'high', 'critical');--> statement-breakpoint
CREATE TYPE "public"."issue_status" AS ENUM('open', 'investigating', 'resolved', 'closed');--> statement-breakpoint
CREATE TYPE "public"."notification_status" AS ENUM('draft', 'queued', 'sent', 'failed');--> statement-breakpoint
CREATE TYPE "public"."template_kind" AS ENUM('email', 'sms', 'push', 'whatsapp');--> statement-breakpoint
CREATE TABLE "issue_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"issue_id" uuid NOT NULL,
	"author_id" text,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "issues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"severity" "issue_severity" DEFAULT 'normal' NOT NULL,
	"status" "issue_status" DEFAULT 'open' NOT NULL,
	"club_id" uuid,
	"reported_by" text,
	"assigned_to" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "platform_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"company_name" text DEFAULT 'Rallix' NOT NULL,
	"address" text DEFAULT '' NOT NULL,
	"email" text DEFAULT '' NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"invoice_prefix" text DEFAULT 'RLX' NOT NULL,
	"invoice_next" integer DEFAULT 1 NOT NULL,
	"vat_percent" integer DEFAULT 0 NOT NULL,
	"footer_note" text DEFAULT 'Thank you for using Rallix.' NOT NULL,
	"payment_instructions" text DEFAULT '' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "platform_settings_single" CHECK ("platform_settings"."id" = 1),
	CONSTRAINT "platform_settings_vat" CHECK ("platform_settings"."vat_percent" BETWEEN 0 AND 100)
);
--> statement-breakpoint
CREATE TABLE "templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"kind" "template_kind" NOT NULL,
	"name" text NOT NULL,
	"subject" text,
	"body" text NOT NULL,
	"updated_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "templates_key_unique" UNIQUE("key")
);
--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "status" "notification_status" DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "recipient_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "failure_reason" text;--> statement-breakpoint
ALTER TABLE "platform_invoices" ADD COLUMN "period_label" text NOT NULL;--> statement-breakpoint
ALTER TABLE "platform_invoices" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "platform_invoices" ADD COLUMN "due_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "platform_invoices" ADD COLUMN "paid_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "platform_invoices" ADD COLUMN "payment_ref" text;--> statement-breakpoint
ALTER TABLE "issue_notes" ADD CONSTRAINT "issue_notes_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_notes" ADD CONSTRAINT "issue_notes_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_reported_by_users_id_fk" FOREIGN KEY ("reported_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "templates" ADD CONSTRAINT "templates_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "issue_notes_issue_idx" ON "issue_notes" USING btree ("issue_id");--> statement-breakpoint
CREATE INDEX "issues_status_idx" ON "issues" USING btree ("status","severity");--> statement-breakpoint
CREATE INDEX "issues_club_idx" ON "issues" USING btree ("club_id");--> statement-breakpoint
ALTER TABLE "platform_invoices" ADD CONSTRAINT "platform_invoices_club_period_uq" UNIQUE("club_id","period_label");