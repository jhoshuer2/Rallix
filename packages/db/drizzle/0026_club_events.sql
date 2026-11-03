-- Club schedule: regular sessions, events and closures.
CREATE TABLE "club_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"note" text,
	"starts_on" date NOT NULL,
	"ends_on" date,
	"start_time" text,
	"end_time" text,
	"repeats_weekly" boolean DEFAULT false NOT NULL,
	"until" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "club_events_kind" CHECK ("kind" IN ('play','event','closed')),
	CONSTRAINT "club_events_title" CHECK (char_length("title") BETWEEN 1 AND 80),
	CONSTRAINT "club_events_note" CHECK ("note" IS NULL OR char_length("note") <= 280),
	CONSTRAINT "club_events_range" CHECK ("ends_on" IS NULL OR "ends_on" >= "starts_on"),
	CONSTRAINT "club_events_times" CHECK (("start_time" IS NULL OR "start_time" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$') AND ("end_time" IS NULL OR "end_time" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$') AND ("end_time" IS NULL OR "start_time" IS NOT NULL) AND ("end_time" IS NULL OR "end_time" > "start_time")),
	CONSTRAINT "club_events_repeat" CHECK (NOT "repeats_weekly" OR ("kind" = 'play' AND "ends_on" IS NULL)),
	CONSTRAINT "club_events_until" CHECK ("until" IS NULL OR ("repeats_weekly" AND "until" >= "starts_on"))
)
--> statement-breakpoint
ALTER TABLE "club_events" ADD CONSTRAINT "club_events_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "clubs"("id") ON DELETE cascade
--> statement-breakpoint
CREATE INDEX "club_events_club_idx" ON "club_events" ("club_id","starts_on")
--> statement-breakpoint
ALTER TABLE club_events ENABLE ROW LEVEL SECURITY
--> statement-breakpoint
CREATE POLICY tenant_read ON club_events FOR SELECT TO rallix_app USING (club_id = app.cid() AND app.is_member(club_id))
--> statement-breakpoint
CREATE POLICY facilities_write ON club_events FOR ALL TO rallix_app USING (club_id = app.cid() AND app.has_permission(club_id, 'facilities')) WITH CHECK (club_id = app.cid() AND app.has_permission(club_id, 'facilities'))
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON club_events TO rallix_app
--> statement-breakpoint
GRANT ALL ON club_events TO rallix_service
