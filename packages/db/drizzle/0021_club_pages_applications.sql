CREATE TABLE "club_pages" (
	"club_id" uuid PRIMARY KEY NOT NULL,
	"about" text,
	"schedule" text,
	"dress_code" text,
	"equipment" text,
	"rules" text,
	"contact" text,
	"join_mode" text DEFAULT 'review' NOT NULL,
	"published" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "club_pages_join_mode" CHECK ("club_pages"."join_mode" IN ('review','open')),
	CONSTRAINT "club_pages_lengths" CHECK (char_length(coalesce("club_pages"."about", '')) <= 1000 AND char_length(coalesce("club_pages"."schedule", '')) <= 2000 AND char_length(coalesce("club_pages"."dress_code", '')) <= 1000 AND char_length(coalesce("club_pages"."equipment", '')) <= 1000 AND char_length(coalesce("club_pages"."rules", '')) <= 8000 AND char_length(coalesce("club_pages"."contact", '')) <= 500)
);
--> statement-breakpoint
CREATE TABLE "membership_applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"level" "player_level" DEFAULT 'junior' NOT NULL,
	"message" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"decided_by" uuid,
	"decided_at" timestamp with time zone,
	"decision_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "applications_status" CHECK ("membership_applications"."status" IN ('pending','approved','declined','withdrawn')),
	CONSTRAINT "applications_message" CHECK ("membership_applications"."message" IS NULL OR char_length("membership_applications"."message") <= 500),
	CONSTRAINT "applications_note" CHECK ("membership_applications"."decision_note" IS NULL OR char_length("membership_applications"."decision_note") <= 300)
);
--> statement-breakpoint
ALTER TABLE "email_log" DROP CONSTRAINT "email_log_kind";--> statement-breakpoint
ALTER TABLE "club_pages" ADD CONSTRAINT "club_pages_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_applications" ADD CONSTRAINT "membership_applications_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_applications" ADD CONSTRAINT "membership_applications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "applications_one_pending" ON "membership_applications" USING btree ("club_id","user_id") WHERE "membership_applications"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "applications_club_idx" ON "membership_applications" USING btree ("club_id","status","created_at");--> statement-breakpoint
CREATE INDEX "applications_user_idx" ON "membership_applications" USING btree ("user_id","created_at");--> statement-breakpoint
ALTER TABLE "email_log" ADD CONSTRAINT "email_log_kind" CHECK ("email_log"."kind" IN ('otp','invoice','reminder','broadcast','application'));