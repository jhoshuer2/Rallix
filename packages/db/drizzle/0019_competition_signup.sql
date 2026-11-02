ALTER TABLE "upload_log" DROP CONSTRAINT "upload_log_kind";--> statement-breakpoint
ALTER TABLE "competitions" ADD COLUMN "summary" text;--> statement-breakpoint
ALTER TABLE "competitions" ADD COLUMN "prize" text;--> statement-breakpoint
ALTER TABLE "competitions" ADD COLUMN "rules" text;--> statement-breakpoint
ALTER TABLE "competitions" ADD COLUMN "cover_url" text;--> statement-breakpoint
ALTER TABLE "competitions" ADD COLUMN "open_registration" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "competitions" ADD COLUMN "max_players" smallint;--> statement-breakpoint
ALTER TABLE "competitions" ADD COLUMN "registration_closes_on" date;--> statement-breakpoint
ALTER TABLE "competitions" ADD CONSTRAINT "competitions_summary" CHECK ("competitions"."summary" IS NULL OR char_length("competitions"."summary") <= 140);--> statement-breakpoint
ALTER TABLE "competitions" ADD CONSTRAINT "competitions_prize" CHECK ("competitions"."prize" IS NULL OR char_length("competitions"."prize") <= 100);--> statement-breakpoint
ALTER TABLE "competitions" ADD CONSTRAINT "competitions_rules" CHECK ("competitions"."rules" IS NULL OR char_length("competitions"."rules") <= 8000);--> statement-breakpoint
ALTER TABLE "competitions" ADD CONSTRAINT "competitions_max_players" CHECK ("competitions"."max_players" IS NULL OR "competitions"."max_players" BETWEEN 2 AND 128);--> statement-breakpoint
ALTER TABLE "competitions" ADD CONSTRAINT "competitions_cover_url" CHECK ("competitions"."cover_url" IS NULL OR "competitions"."cover_url" ~ '^(https://[^ ]+|/[^/ ][^ ]*)$');--> statement-breakpoint
ALTER TABLE "upload_log" ADD CONSTRAINT "upload_log_kind" CHECK ("upload_log"."kind" IN ('person','club-logo','club-cover','competition-cover'));