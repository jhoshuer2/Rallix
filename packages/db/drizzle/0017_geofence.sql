CREATE TABLE "arrivals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL,
	"membership_id" uuid NOT NULL,
	"arrived_at" timestamp with time zone DEFAULT now() NOT NULL,
	"left_at" timestamp with time zone,
	"method" text DEFAULT 'manual' NOT NULL,
	"alerted_at" timestamp with time zone,
	CONSTRAINT "arrivals_method" CHECK ("arrivals"."method" IN ('manual','auto')),
	CONSTRAINT "arrivals_left_after" CHECK ("arrivals"."left_at" IS NULL OR "arrivals"."left_at" >= "arrivals"."arrived_at")
);
--> statement-breakpoint
CREATE TABLE "push_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_ok_at" timestamp with time zone,
	CONSTRAINT "push_subscriptions_endpoint_unique" UNIQUE("endpoint"),
	CONSTRAINT "push_subscriptions_endpoint" CHECK ("push_subscriptions"."endpoint" ~ '^https://[^ ]+$')
);
--> statement-breakpoint
ALTER TABLE "clubs" ADD COLUMN "venue_label" text;--> statement-breakpoint
ALTER TABLE "clubs" ADD COLUMN "venue_lat" double precision;--> statement-breakpoint
ALTER TABLE "clubs" ADD COLUMN "venue_lng" double precision;--> statement-breakpoint
ALTER TABLE "clubs" ADD COLUMN "venue_radius_m" integer DEFAULT 100 NOT NULL;--> statement-breakpoint
ALTER TABLE "player_profiles" ADD COLUMN "share_arrival" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "player_profiles" ADD COLUMN "notify_arrivals" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "player_profiles" ADD COLUMN "auto_arrival" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "arrivals" ADD CONSTRAINT "arrivals_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arrivals" ADD CONSTRAINT "arrivals_membership_fk" FOREIGN KEY ("membership_id","club_id") REFERENCES "public"."memberships"("id","club_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "arrivals_one_open" ON "arrivals" USING btree ("membership_id") WHERE "arrivals"."left_at" IS NULL;--> statement-breakpoint
CREATE INDEX "arrivals_club_idx" ON "arrivals" USING btree ("club_id","arrived_at");--> statement-breakpoint
CREATE INDEX "push_subscriptions_user_idx" ON "push_subscriptions" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "clubs" ADD CONSTRAINT "clubs_venue_point" CHECK (("clubs"."venue_lat" IS NULL) = ("clubs"."venue_lng" IS NULL) AND ("clubs"."venue_lat" IS NULL OR ("clubs"."venue_lat" BETWEEN -90 AND 90 AND "clubs"."venue_lng" BETWEEN -180 AND 180)));--> statement-breakpoint
ALTER TABLE "clubs" ADD CONSTRAINT "clubs_venue_radius" CHECK ("clubs"."venue_radius_m" BETWEEN 25 AND 500);