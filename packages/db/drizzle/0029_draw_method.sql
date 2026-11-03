-- Knockout draws: how the seeds were decided, and when (set once, when the competition starts).
ALTER TABLE "competitions" ADD COLUMN "draw_method" text DEFAULT 'seeded' NOT NULL
--> statement-breakpoint
ALTER TABLE "competitions" ADD COLUMN "drawn_at" timestamp with time zone
--> statement-breakpoint
ALTER TABLE "competitions" ADD CONSTRAINT "competitions_draw_method" CHECK ("draw_method" IN ('seeded','raffle'))
