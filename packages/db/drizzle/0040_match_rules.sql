-- What a match means is the club's choice: how many games, how many points decide a game, and what happens at one short of the target.
--   game_points: the target (11, 21...). win_by: 2 = a lead of two (deuce), 1 = the next point wins. point_cap: optional hard limit for win-by-two games.
-- Each match keeps its own copy, so changing a rule later never rewrites a played match. Existing rows keep today's rule (11, win by two, best of 5).
ALTER TABLE "matches" ADD COLUMN "game_points" smallint DEFAULT 11 NOT NULL;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "win_by" smallint DEFAULT 2 NOT NULL;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "point_cap" smallint;--> statement-breakpoint
ALTER TABLE "matches" DROP CONSTRAINT "matches_best_of_odd";--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_best_of_odd" CHECK ("best_of" IN (1,3,5,7,9));--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_game_points" CHECK ("game_points" BETWEEN 5 AND 30);--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_win_by" CHECK ("win_by" IN (1,2));--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_point_cap" CHECK ("point_cap" IS NULL OR ("win_by" = 2 AND "point_cap" > "game_points" AND "point_cap" <= "game_points" + 20));--> statement-breakpoint
-- The rules new fixtures of a competition get.
ALTER TABLE "competitions" ADD COLUMN "best_of" smallint DEFAULT 5 NOT NULL;--> statement-breakpoint
ALTER TABLE "competitions" ADD COLUMN "game_points" smallint DEFAULT 11 NOT NULL;--> statement-breakpoint
ALTER TABLE "competitions" ADD COLUMN "win_by" smallint DEFAULT 2 NOT NULL;--> statement-breakpoint
ALTER TABLE "competitions" ADD COLUMN "point_cap" smallint;--> statement-breakpoint
ALTER TABLE "competitions" ADD CONSTRAINT "competitions_best_of" CHECK ("best_of" IN (1,3,5,7,9));--> statement-breakpoint
ALTER TABLE "competitions" ADD CONSTRAINT "competitions_game_points" CHECK ("game_points" BETWEEN 5 AND 30);--> statement-breakpoint
ALTER TABLE "competitions" ADD CONSTRAINT "competitions_win_by" CHECK ("win_by" IN (1,2));--> statement-breakpoint
ALTER TABLE "competitions" ADD CONSTRAINT "competitions_point_cap" CHECK ("point_cap" IS NULL OR ("win_by" = 2 AND "point_cap" > "game_points" AND "point_cap" <= "game_points" + 20));--> statement-breakpoint
-- The club's usual rules, pre-filled when an admin creates a competition.
ALTER TABLE "clubs" ADD COLUMN "default_best_of" smallint DEFAULT 5 NOT NULL;--> statement-breakpoint
ALTER TABLE "clubs" ADD COLUMN "default_game_points" smallint DEFAULT 11 NOT NULL;--> statement-breakpoint
ALTER TABLE "clubs" ADD COLUMN "default_win_by" smallint DEFAULT 2 NOT NULL;--> statement-breakpoint
ALTER TABLE "clubs" ADD COLUMN "default_point_cap" smallint;--> statement-breakpoint
ALTER TABLE "clubs" ADD CONSTRAINT "clubs_default_best_of" CHECK ("default_best_of" IN (1,3,5,7,9));--> statement-breakpoint
ALTER TABLE "clubs" ADD CONSTRAINT "clubs_default_game_points" CHECK ("default_game_points" BETWEEN 5 AND 30);--> statement-breakpoint
ALTER TABLE "clubs" ADD CONSTRAINT "clubs_default_win_by" CHECK ("default_win_by" IN (1,2));--> statement-breakpoint
ALTER TABLE "clubs" ADD CONSTRAINT "clubs_default_point_cap" CHECK ("default_point_cap" IS NULL OR ("default_win_by" = 2 AND "default_point_cap" > "default_game_points" AND "default_point_cap" <= "default_game_points" + 20));--> statement-breakpoint
-- Members read the club's rules; only club admins change them (the existing admin-only clubs_update policy applies).
GRANT SELECT (default_best_of, default_game_points, default_win_by, default_point_cap) ON clubs TO rallix_app;--> statement-breakpoint
GRANT UPDATE (default_best_of, default_game_points, default_win_by, default_point_cap) ON clubs TO rallix_app
