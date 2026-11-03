-- League points per competition, seasons, and podium awards.
CREATE TABLE "seasons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL,
	"name" text NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "seasons_id_club_uq" UNIQUE("id","club_id"),
	CONSTRAINT "seasons_name" CHECK (char_length("name") BETWEEN 1 AND 60),
	CONSTRAINT "seasons_range" CHECK ("ends_on" >= "starts_on")
)
--> statement-breakpoint
ALTER TABLE "seasons" ADD CONSTRAINT "seasons_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "clubs"("id") ON DELETE cascade
--> statement-breakpoint
ALTER TABLE "competitions" ADD COLUMN "points_win" smallint DEFAULT 3 NOT NULL
--> statement-breakpoint
ALTER TABLE "competitions" ADD COLUMN "points_loss" smallint DEFAULT 0 NOT NULL
--> statement-breakpoint
ALTER TABLE "competitions" ADD COLUMN "season_id" uuid
--> statement-breakpoint
ALTER TABLE "competitions" ADD CONSTRAINT "competitions_points" CHECK ("points_win" BETWEEN 0 AND 10 AND "points_loss" BETWEEN 0 AND 10 AND "points_loss" <= "points_win")
--> statement-breakpoint
-- A competition can only join a season of its own club.
ALTER TABLE "competitions" ADD CONSTRAINT "competitions_season_fk" FOREIGN KEY ("season_id","club_id") REFERENCES "seasons"("id","club_id")
--> statement-breakpoint
CREATE TABLE "competition_awards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL,
	"competition_id" uuid NOT NULL,
	"membership_id" uuid NOT NULL,
	"place" smallint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "competition_awards_uq" UNIQUE("competition_id","membership_id"),
	CONSTRAINT "competition_awards_place" CHECK ("place" BETWEEN 1 AND 3)
)
--> statement-breakpoint
ALTER TABLE "competition_awards" ADD CONSTRAINT "competition_awards_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "clubs"("id") ON DELETE cascade
--> statement-breakpoint
ALTER TABLE "competition_awards" ADD CONSTRAINT "awards_competition_fk" FOREIGN KEY ("competition_id","club_id") REFERENCES "competitions"("id","club_id") ON DELETE cascade
--> statement-breakpoint
ALTER TABLE "competition_awards" ADD CONSTRAINT "awards_membership_fk" FOREIGN KEY ("membership_id","club_id") REFERENCES "memberships"("id","club_id")
--> statement-breakpoint
ALTER TABLE seasons ENABLE ROW LEVEL SECURITY
--> statement-breakpoint
ALTER TABLE competition_awards ENABLE ROW LEVEL SECURITY
--> statement-breakpoint
CREATE POLICY tenant_read ON seasons FOR SELECT TO rallix_app USING (club_id = app.cid() AND app.is_member(club_id))
--> statement-breakpoint
-- Seasons are created and renamed by the Competitions admin; they are never deleted (a season simply ends).
CREATE POLICY competitions_write ON seasons FOR INSERT TO rallix_app WITH CHECK (club_id = app.cid() AND app.has_permission(club_id, 'competitions'))
--> statement-breakpoint
CREATE POLICY competitions_update ON seasons FOR UPDATE TO rallix_app USING (club_id = app.cid() AND app.has_permission(club_id, 'competitions')) WITH CHECK (club_id = app.cid() AND app.has_permission(club_id, 'competitions'))
--> statement-breakpoint
-- Awards are visible whenever the competition is (the sub-select runs under the competitions read policy); only the server writes them.
CREATE POLICY tenant_read ON competition_awards FOR SELECT TO rallix_app USING (club_id = app.cid() AND app.is_member(club_id) AND EXISTS (SELECT 1 FROM competitions c WHERE c.id = competition_id))
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON seasons TO rallix_app
--> statement-breakpoint
GRANT SELECT ON competition_awards TO rallix_app
--> statement-breakpoint
GRANT ALL ON seasons, competition_awards TO rallix_service
