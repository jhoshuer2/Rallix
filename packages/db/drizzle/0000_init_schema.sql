CREATE TYPE "public"."club_status" AS ENUM('active', 'suspended', 'closed');--> statement-breakpoint
CREATE TYPE "public"."competition_format" AS ENUM('group_stage', 'one_on_one', 'knockout', 'round_robin');--> statement-breakpoint
CREATE TYPE "public"."competition_status" AS ENUM('draft', 'active', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."due_status" AS ENUM('due', 'paid', 'overdue', 'waived');--> statement-breakpoint
CREATE TYPE "public"."invoice_status" AS ENUM('draft', 'issued', 'paid', 'void');--> statement-breakpoint
CREATE TYPE "public"."player_level" AS ENUM('junior', 'intermediate', 'senior');--> statement-breakpoint
CREATE TYPE "public"."match_status" AS ENUM('scheduled', 'live', 'completed', 'walkover', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."member_role" AS ENUM('admin', 'scorer', 'coach', 'player');--> statement-breakpoint
CREATE TYPE "public"."member_status" AS ENUM('invited', 'active', 'suspended', 'left');--> statement-breakpoint
CREATE TYPE "public"."notification_channel" AS ENUM('push', 'email', 'sms', 'whatsapp');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('pending', 'paid', 'failed', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."plan_period" AS ENUM('monthly', 'yearly');--> statement-breakpoint
CREATE TYPE "public"."rating_scope" AS ENUM('club', 'competition');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('trialing', 'active', 'past_due', 'cancelled');--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"phone_number" text,
	"phone_number_verified" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_phone_number_unique" UNIQUE("phone_number")
);
--> statement-breakpoint
CREATE TABLE "verifications" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clubs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"logo_url" text,
	"location" text,
	"timezone" text DEFAULT 'Africa/Lagos' NOT NULL,
	"status" "club_status" DEFAULT 'active' NOT NULL,
	"owner_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "clubs_slug_unique" UNIQUE("slug"),
	CONSTRAINT "clubs_slug_format" CHECK ("clubs"."slug" ~ '^[a-z0-9]([a-z0-9-]{0,40}[a-z0-9])?$')
);
--> statement-breakpoint
CREATE TABLE "invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL,
	"code" text NOT NULL,
	"role" "member_role" DEFAULT 'player' NOT NULL,
	"created_by" uuid,
	"expires_at" timestamp with time zone,
	"max_uses" integer,
	"uses" integer DEFAULT 0 NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invites_code_unique" UNIQUE("code"),
	CONSTRAINT "invites_uses_nonneg" CHECK ("invites"."uses" >= 0)
);
--> statement-breakpoint
CREATE TABLE "memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"roles" "member_role"[] DEFAULT ARRAY['player']::member_role[] NOT NULL,
	"status" "member_status" DEFAULT 'active' NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "memberships_club_user_uq" UNIQUE("club_id","user_id"),
	CONSTRAINT "memberships_id_club_uq" UNIQUE("id","club_id"),
	CONSTRAINT "memberships_roles_nonempty" CHECK (cardinality("memberships"."roles") > 0)
);
--> statement-breakpoint
CREATE TABLE "competition_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL,
	"competition_id" uuid NOT NULL,
	"membership_id" uuid NOT NULL,
	"seed" smallint,
	"group_label" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "competition_entries_uq" UNIQUE("competition_id","membership_id")
);
--> statement-breakpoint
CREATE TABLE "competitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL,
	"name" text NOT NULL,
	"level" "player_level",
	"format" "competition_format" NOT NULL,
	"status" "competition_status" DEFAULT 'draft' NOT NULL,
	"starts_on" date,
	"ends_on" date,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "competitions_id_club_uq" UNIQUE("id","club_id"),
	CONSTRAINT "competitions_dates" CHECK ("competitions"."ends_on" IS NULL OR "competitions"."starts_on" IS NULL OR "competitions"."ends_on" >= "competitions"."starts_on")
);
--> statement-breakpoint
CREATE TABLE "dues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL,
	"membership_id" uuid NOT NULL,
	"plan_id" uuid NOT NULL,
	"amount_kobo" integer NOT NULL,
	"period_label" text NOT NULL,
	"due_date" date NOT NULL,
	"status" "due_status" DEFAULT 'due' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "dues_id_club_uq" UNIQUE("id","club_id"),
	CONSTRAINT "dues_member_plan_period_uq" UNIQUE("membership_id","plan_id","period_label"),
	CONSTRAINT "dues_amount_nonneg" CHECK ("dues"."amount_kobo" >= 0)
);
--> statement-breakpoint
CREATE TABLE "games" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL,
	"match_id" uuid NOT NULL,
	"game_no" smallint NOT NULL,
	"p1_points" smallint DEFAULT 0 NOT NULL,
	"p2_points" smallint DEFAULT 0 NOT NULL,
	CONSTRAINT "games_id_club_uq" UNIQUE("id","club_id"),
	CONSTRAINT "games_match_no_uq" UNIQUE("match_id","game_no"),
	CONSTRAINT "games_points_nonneg" CHECK ("games"."p1_points" >= 0 AND "games"."p2_points" >= 0),
	CONSTRAINT "games_no_pos" CHECK ("games"."game_no" > 0)
);
--> statement-breakpoint
CREATE TABLE "matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL,
	"competition_id" uuid NOT NULL,
	"round" text NOT NULL,
	"round_order" smallint DEFAULT 1 NOT NULL,
	"slot" smallint DEFAULT 1 NOT NULL,
	"player1_id" uuid,
	"player2_id" uuid,
	"scheduled_at" timestamp with time zone,
	"status" "match_status" DEFAULT 'scheduled' NOT NULL,
	"best_of" smallint DEFAULT 5 NOT NULL,
	"winner_id" uuid,
	"games_p1" smallint DEFAULT 0 NOT NULL,
	"games_p2" smallint DEFAULT 0 NOT NULL,
	"scorer_id" uuid,
	"confirmed_at" timestamp with time zone,
	"feeds_match_id" uuid,
	"feeds_slot" smallint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "matches_id_club_uq" UNIQUE("id","club_id"),
	CONSTRAINT "matches_distinct_players" CHECK ("matches"."player1_id" IS NULL OR "matches"."player2_id" IS NULL OR "matches"."player1_id" <> "matches"."player2_id"),
	CONSTRAINT "matches_winner_is_player" CHECK ("matches"."winner_id" IS NULL OR "matches"."winner_id" = "matches"."player1_id" OR "matches"."winner_id" = "matches"."player2_id"),
	CONSTRAINT "matches_best_of_odd" CHECK ("matches"."best_of" > 0 AND "matches"."best_of" % 2 = 1),
	CONSTRAINT "matches_completed_has_winner" CHECK ("matches"."status" NOT IN ('completed','walkover') OR "matches"."winner_id" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL,
	"membership_id" uuid NOT NULL,
	"due_id" uuid,
	"amount_kobo" integer NOT NULL,
	"status" "payment_status" DEFAULT 'pending' NOT NULL,
	"provider" text DEFAULT 'paystack' NOT NULL,
	"provider_ref" text NOT NULL,
	"method" text,
	"paid_at" timestamp with time zone,
	"raw" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payments_provider_ref_unique" UNIQUE("provider_ref"),
	CONSTRAINT "payments_amount_pos" CHECK ("payments"."amount_kobo" > 0)
);
--> statement-breakpoint
CREATE TABLE "plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL,
	"name" text NOT NULL,
	"price_kobo" integer NOT NULL,
	"currency" text DEFAULT 'NGN' NOT NULL,
	"period" "plan_period" NOT NULL,
	"perks" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"paystack_plan_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "plans_id_club_uq" UNIQUE("id","club_id"),
	CONSTRAINT "plans_club_name_period_uq" UNIQUE("club_id","name","period"),
	CONSTRAINT "plans_price_nonneg" CHECK ("plans"."price_kobo" >= 0)
);
--> statement-breakpoint
CREATE TABLE "player_profiles" (
	"membership_id" uuid PRIMARY KEY NOT NULL,
	"club_id" uuid NOT NULL,
	"level" "player_level" DEFAULT 'junior' NOT NULL,
	"date_of_birth" date,
	"height_cm" smallint,
	"country" text DEFAULT 'NGR' NOT NULL,
	"bio" text,
	"photo_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "player_profiles_height" CHECK ("player_profiles"."height_cm" IS NULL OR "player_profiles"."height_cm" BETWEEN 80 AND 260)
);
--> statement-breakpoint
CREATE TABLE "points" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL,
	"game_id" uuid NOT NULL,
	"seq" smallint NOT NULL,
	"winner_side" smallint NOT NULL,
	"server_side" smallint,
	"tag" text,
	CONSTRAINT "points_game_seq_uq" UNIQUE("game_id","seq"),
	CONSTRAINT "points_sides" CHECK ("points"."winner_side" IN (1,2) AND ("points"."server_side" IS NULL OR "points"."server_side" IN (1,2)))
);
--> statement-breakpoint
CREATE TABLE "rating_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL,
	"membership_id" uuid NOT NULL,
	"match_id" uuid NOT NULL,
	"scope" "rating_scope" DEFAULT 'club' NOT NULL,
	"before" integer NOT NULL,
	"after" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rating_events_uq" UNIQUE("membership_id","match_id","scope")
);
--> statement-breakpoint
CREATE TABLE "ratings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL,
	"membership_id" uuid NOT NULL,
	"scope" "rating_scope" NOT NULL,
	"competition_id" uuid,
	"rating" integer DEFAULT 1200 NOT NULL,
	"matches_played" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ratings_scope_competition" CHECK (("ratings"."scope" = 'competition') = ("ratings"."competition_id" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "stat_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL,
	"membership_id" uuid NOT NULL,
	"period" text DEFAULT 'all' NOT NULL,
	"stats" jsonb NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stat_snapshots_uq" UNIQUE("membership_id","period")
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" text,
	"action" text NOT NULL,
	"entity" text,
	"entity_id" text,
	"meta" jsonb,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "club_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL,
	"period" "plan_period" NOT NULL,
	"status" "subscription_status" DEFAULT 'trialing' NOT NULL,
	"amount_kobo" integer NOT NULL,
	"current_period_end" timestamp with time zone,
	"paystack_subscription_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "global_ratings" (
	"user_id" text PRIMARY KEY NOT NULL,
	"rating" integer DEFAULT 1200 NOT NULL,
	"matches_played" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"audience" jsonb NOT NULL,
	"channel" "notification_channel" NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"created_by" text,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_admins" (
	"user_id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL,
	"number" text NOT NULL,
	"status" "invoice_status" DEFAULT 'draft' NOT NULL,
	"amount_kobo" integer NOT NULL,
	"issued_at" timestamp with time zone,
	"pdf_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "platform_invoices_number_unique" UNIQUE("number"),
	CONSTRAINT "platform_invoices_amount" CHECK ("platform_invoices"."amount_kobo" >= 0)
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clubs" ADD CONSTRAINT "clubs_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invites" ADD CONSTRAINT "invites_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competition_entries" ADD CONSTRAINT "competition_entries_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competition_entries" ADD CONSTRAINT "entries_competition_fk" FOREIGN KEY ("competition_id","club_id") REFERENCES "public"."competitions"("id","club_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competition_entries" ADD CONSTRAINT "entries_membership_fk" FOREIGN KEY ("membership_id","club_id") REFERENCES "public"."memberships"("id","club_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competitions" ADD CONSTRAINT "competitions_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dues" ADD CONSTRAINT "dues_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dues" ADD CONSTRAINT "dues_membership_fk" FOREIGN KEY ("membership_id","club_id") REFERENCES "public"."memberships"("id","club_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dues" ADD CONSTRAINT "dues_plan_fk" FOREIGN KEY ("plan_id","club_id") REFERENCES "public"."plans"("id","club_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_match_fk" FOREIGN KEY ("match_id","club_id") REFERENCES "public"."matches"("id","club_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_competition_fk" FOREIGN KEY ("competition_id","club_id") REFERENCES "public"."competitions"("id","club_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_p1_fk" FOREIGN KEY ("player1_id","club_id") REFERENCES "public"."memberships"("id","club_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_p2_fk" FOREIGN KEY ("player2_id","club_id") REFERENCES "public"."memberships"("id","club_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_winner_fk" FOREIGN KEY ("winner_id","club_id") REFERENCES "public"."memberships"("id","club_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_scorer_fk" FOREIGN KEY ("scorer_id","club_id") REFERENCES "public"."memberships"("id","club_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_membership_fk" FOREIGN KEY ("membership_id","club_id") REFERENCES "public"."memberships"("id","club_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_due_fk" FOREIGN KEY ("due_id","club_id") REFERENCES "public"."dues"("id","club_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plans" ADD CONSTRAINT "plans_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_profiles" ADD CONSTRAINT "player_profiles_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_profiles" ADD CONSTRAINT "player_profiles_membership_fk" FOREIGN KEY ("membership_id","club_id") REFERENCES "public"."memberships"("id","club_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "points" ADD CONSTRAINT "points_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "points" ADD CONSTRAINT "points_game_fk" FOREIGN KEY ("game_id","club_id") REFERENCES "public"."games"("id","club_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rating_events" ADD CONSTRAINT "rating_events_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rating_events" ADD CONSTRAINT "rating_events_membership_fk" FOREIGN KEY ("membership_id","club_id") REFERENCES "public"."memberships"("id","club_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rating_events" ADD CONSTRAINT "rating_events_match_fk" FOREIGN KEY ("match_id","club_id") REFERENCES "public"."matches"("id","club_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_membership_fk" FOREIGN KEY ("membership_id","club_id") REFERENCES "public"."memberships"("id","club_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_competition_fk" FOREIGN KEY ("competition_id","club_id") REFERENCES "public"."competitions"("id","club_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stat_snapshots" ADD CONSTRAINT "stat_snapshots_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stat_snapshots" ADD CONSTRAINT "stat_snapshots_membership_fk" FOREIGN KEY ("membership_id","club_id") REFERENCES "public"."memberships"("id","club_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_subscriptions" ADD CONSTRAINT "club_subscriptions_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "global_ratings" ADD CONSTRAINT "global_ratings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_admins" ADD CONSTRAINT "platform_admins_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_invoices" ADD CONSTRAINT "platform_invoices_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "accounts_user_idx" ON "accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verifications_identifier_idx" ON "verifications" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "invites_club_idx" ON "invites" USING btree ("club_id");--> statement-breakpoint
CREATE INDEX "memberships_user_idx" ON "memberships" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "competitions_club_status_idx" ON "competitions" USING btree ("club_id","status");--> statement-breakpoint
CREATE INDEX "dues_club_status_idx" ON "dues" USING btree ("club_id","status");--> statement-breakpoint
CREATE INDEX "matches_competition_idx" ON "matches" USING btree ("competition_id","round_order","slot");--> statement-breakpoint
CREATE INDEX "matches_p1_idx" ON "matches" USING btree ("player1_id");--> statement-breakpoint
CREATE INDEX "matches_p2_idx" ON "matches" USING btree ("player2_id");--> statement-breakpoint
CREATE INDEX "payments_club_status_idx" ON "payments" USING btree ("club_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "ratings_member_scope_uq" ON "ratings" USING btree ("membership_id","scope",coalesce("competition_id", '00000000-0000-0000-0000-000000000000'::uuid));--> statement-breakpoint
CREATE INDEX "audit_log_at_idx" ON "audit_log" USING btree ("at");--> statement-breakpoint
CREATE INDEX "club_subscriptions_club_idx" ON "club_subscriptions" USING btree ("club_id");--> statement-breakpoint
CREATE INDEX "platform_invoices_club_idx" ON "platform_invoices" USING btree ("club_id");