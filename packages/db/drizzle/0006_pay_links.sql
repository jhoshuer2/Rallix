CREATE TYPE "public"."suspension_reason" AS ENUM('non_payment', 'other');--> statement-breakpoint
ALTER TABLE "clubs" ADD COLUMN "suspension_reason" "suspension_reason";--> statement-breakpoint
ALTER TABLE "invoice_payments" ADD COLUMN "via_link" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "invoice_payments" ADD COLUMN "payer_email" text;--> statement-breakpoint
ALTER TABLE "platform_invoices" ADD COLUMN "pay_token" text;--> statement-breakpoint
ALTER TABLE "platform_invoices" ADD COLUMN "pay_token_revoked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "platform_invoices" ADD CONSTRAINT "platform_invoices_pay_token_unique" UNIQUE("pay_token");