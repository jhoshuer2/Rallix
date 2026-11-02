CREATE TABLE "upload_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"club_id" uuid,
	"kind" text NOT NULL,
	"bytes" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "upload_log_kind" CHECK ("upload_log"."kind" IN ('person','club-logo','club-cover'))
);
--> statement-breakpoint
ALTER TABLE "clubs" ADD COLUMN "cover_url" text;--> statement-breakpoint
CREATE INDEX "upload_log_user_idx" ON "upload_log" USING btree ("user_id","created_at");