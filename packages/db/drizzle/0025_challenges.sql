-- Friendly challenges: a one-on-one between two members of a club, outside any competition.
CREATE TABLE "challenges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL,
	"challenger_id" uuid NOT NULL,
	"opponent_id" uuid NOT NULL,
	"status" text DEFAULT 'proposed' NOT NULL,
	"proposed_for" timestamp with time zone,
	"message" text,
	"best_of" smallint DEFAULT 3 NOT NULL,
	"challenger_rated" boolean DEFAULT false NOT NULL,
	"opponent_rated" boolean DEFAULT false NOT NULL,
	"challenger_games" smallint,
	"opponent_games" smallint,
	"entered_by" uuid,
	"responded_at" timestamp with time zone,
	"confirmed_at" timestamp with time zone,
	"rated_at" timestamp with time zone,
	"challenger_before" integer,
	"challenger_after" integer,
	"opponent_before" integer,
	"opponent_after" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "challenges_id_club_uq" UNIQUE("id","club_id"),
	CONSTRAINT "challenges_distinct" CHECK ("challenger_id" <> "opponent_id"),
	CONSTRAINT "challenges_status" CHECK ("status" IN ('proposed','accepted','awaiting','confirmed','declined','cancelled')),
	CONSTRAINT "challenges_best_of" CHECK ("best_of" IN (1,3,5)),
	CONSTRAINT "challenges_message" CHECK ("message" IS NULL OR char_length("message") <= 140)
)
--> statement-breakpoint
ALTER TABLE "challenges" ADD CONSTRAINT "challenges_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "clubs"("id") ON DELETE cascade
--> statement-breakpoint
ALTER TABLE "challenges" ADD CONSTRAINT "challenges_challenger_fk" FOREIGN KEY ("challenger_id","club_id") REFERENCES "memberships"("id","club_id")
--> statement-breakpoint
ALTER TABLE "challenges" ADD CONSTRAINT "challenges_opponent_fk" FOREIGN KEY ("opponent_id","club_id") REFERENCES "memberships"("id","club_id")
--> statement-breakpoint
CREATE INDEX "challenges_challenger_idx" ON "challenges" ("challenger_id")
--> statement-breakpoint
CREATE INDEX "challenges_opponent_idx" ON "challenges" ("opponent_id")
--> statement-breakpoint
ALTER TABLE challenges ENABLE ROW LEVEL SECURITY
--> statement-breakpoint
-- Only the two players read a challenge. Nobody writes it directly: every change goes through the functions below.
CREATE POLICY players_read ON challenges FOR SELECT TO rallix_app USING (club_id = app.cid() AND app.is_member(club_id) AND (app.is_self(challenger_id) OR app.is_self(opponent_id)))
--> statement-breakpoint
GRANT SELECT ON challenges TO rallix_app
--> statement-breakpoint
GRANT ALL ON challenges TO rallix_service
--> statement-breakpoint
-- The caller's own membership in the active club.
CREATE FUNCTION app.my_membership(p_club uuid) RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT m.id FROM memberships m JOIN clubs c ON c.id = m.club_id
  WHERE m.club_id = p_club AND m.user_id = app.uid() AND m.status = 'active' AND c.status = 'active'
$$
--> statement-breakpoint
CREATE FUNCTION app.propose_challenge(p_opponent uuid, p_when timestamptz, p_message text, p_best_of int, p_rated boolean) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_club uuid := app.cid();
  v_me uuid;
  v_id uuid;
BEGIN
  IF app.uid() IS NULL OR v_club IS NULL THEN RAISE EXCEPTION 'not authenticated' USING ERRCODE = '28000'; END IF;
  v_me := app.my_membership(v_club);
  IF v_me IS NULL THEN RETURN 'denied'; END IF;
  IF v_me = p_opponent THEN RETURN 'self'; END IF;
  IF NOT EXISTS (SELECT 1 FROM memberships WHERE id = p_opponent AND club_id = v_club AND status = 'active') THEN RETURN 'unknown'; END IF;
  IF p_best_of NOT IN (1,3,5) THEN RETURN 'invalid'; END IF;
  IF p_when IS NOT NULL AND p_when < now() - interval '1 hour' THEN RETURN 'past'; END IF;
  IF p_message IS NOT NULL AND char_length(p_message) > 140 THEN RETURN 'invalid'; END IF;
  -- One open challenge per pair, and at most 5 waiting answers from one player.
  IF EXISTS (SELECT 1 FROM challenges WHERE club_id = v_club AND status IN ('proposed','accepted','awaiting')
      AND ((challenger_id = v_me AND opponent_id = p_opponent) OR (challenger_id = p_opponent AND opponent_id = v_me))) THEN RETURN 'exists'; END IF;
  IF (SELECT count(*) FROM challenges WHERE club_id = v_club AND challenger_id = v_me AND status = 'proposed') >= 5 THEN RETURN 'limit'; END IF;
  INSERT INTO challenges (club_id, challenger_id, opponent_id, proposed_for, message, best_of, challenger_rated)
  VALUES (v_club, v_me, p_opponent, p_when, nullif(btrim(p_message), ''), p_best_of, coalesce(p_rated, false));
  RETURN 'sent';
END $$
--> statement-breakpoint
CREATE FUNCTION app.respond_challenge(p_id uuid, p_accept boolean, p_rated boolean) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_c challenges%ROWTYPE;
  v_me uuid;
BEGIN
  IF app.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated' USING ERRCODE = '28000'; END IF;
  SELECT * INTO v_c FROM challenges WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RETURN 'unknown'; END IF;
  v_me := app.my_membership(v_c.club_id);
  IF v_me IS NULL OR v_me <> v_c.opponent_id THEN RETURN 'denied'; END IF;
  IF v_c.status <> 'proposed' THEN RETURN 'closed'; END IF;
  IF p_accept THEN
    UPDATE challenges SET status = 'accepted', opponent_rated = coalesce(p_rated, false), responded_at = now(), updated_at = now() WHERE id = p_id;
    RETURN 'accepted';
  END IF;
  UPDATE challenges SET status = 'declined', responded_at = now(), updated_at = now() WHERE id = p_id;
  RETURN 'declined';
END $$
--> statement-breakpoint
CREATE FUNCTION app.cancel_challenge(p_id uuid) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_c challenges%ROWTYPE;
  v_me uuid;
BEGIN
  IF app.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated' USING ERRCODE = '28000'; END IF;
  SELECT * INTO v_c FROM challenges WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RETURN 'unknown'; END IF;
  v_me := app.my_membership(v_c.club_id);
  IF v_me IS NULL OR (v_me <> v_c.challenger_id AND v_me <> v_c.opponent_id) THEN RETURN 'denied'; END IF;
  IF v_c.status NOT IN ('proposed','accepted') THEN RETURN 'closed'; END IF;
  -- Only the challenger can withdraw an unanswered challenge; either player can call off an accepted one.
  IF v_c.status = 'proposed' AND v_me <> v_c.challenger_id THEN RETURN 'denied'; END IF;
  UPDATE challenges SET status = 'cancelled', updated_at = now() WHERE id = p_id;
  RETURN 'cancelled';
END $$
--> statement-breakpoint
-- p_mine / p_theirs are games won by the caller and by the other player. The other player then confirms.
CREATE FUNCTION app.record_challenge_result(p_id uuid, p_mine int, p_theirs int) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_c challenges%ROWTYPE;
  v_me uuid;
  v_need int;
  v_cg int;
  v_og int;
BEGIN
  IF app.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated' USING ERRCODE = '28000'; END IF;
  SELECT * INTO v_c FROM challenges WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RETURN 'unknown'; END IF;
  v_me := app.my_membership(v_c.club_id);
  IF v_me IS NULL OR (v_me <> v_c.challenger_id AND v_me <> v_c.opponent_id) THEN RETURN 'denied'; END IF;
  IF v_c.status <> 'accepted' THEN RETURN 'closed'; END IF;
  v_need := v_c.best_of / 2 + 1;
  IF p_mine IS NULL OR p_theirs IS NULL OR p_mine < 0 OR p_theirs < 0 THEN RETURN 'invalid'; END IF;
  -- Exactly one side reaches the games needed to win; the other has fewer.
  IF NOT ((p_mine = v_need AND p_theirs < v_need) OR (p_theirs = v_need AND p_mine < v_need)) THEN RETURN 'invalid'; END IF;
  IF v_me = v_c.challenger_id THEN v_cg := p_mine; v_og := p_theirs; ELSE v_cg := p_theirs; v_og := p_mine; END IF;
  UPDATE challenges SET status = 'awaiting', challenger_games = v_cg, opponent_games = v_og, entered_by = v_me, updated_at = now() WHERE id = p_id;
  RETURN 'recorded';
END $$
--> statement-breakpoint
-- The player who did NOT enter the score confirms it (and says whether it counts for the ranking) or disputes it,
-- which clears the score so it can be entered again.
CREATE FUNCTION app.confirm_challenge_result(p_id uuid, p_ok boolean, p_rated boolean) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_c challenges%ROWTYPE;
  v_me uuid;
BEGIN
  IF app.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated' USING ERRCODE = '28000'; END IF;
  SELECT * INTO v_c FROM challenges WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RETURN 'unknown'; END IF;
  v_me := app.my_membership(v_c.club_id);
  IF v_me IS NULL OR (v_me <> v_c.challenger_id AND v_me <> v_c.opponent_id) THEN RETURN 'denied'; END IF;
  IF v_c.status <> 'awaiting' THEN RETURN 'closed'; END IF;
  IF v_me = v_c.entered_by THEN RETURN 'denied'; END IF;
  IF p_ok THEN
    -- The confirming player's rating choice is final here; the entering player's was given when the challenge started or was accepted.
    IF v_me = v_c.challenger_id THEN
      UPDATE challenges SET status = 'confirmed', confirmed_at = now(), challenger_rated = coalesce(p_rated, challenger_rated), updated_at = now() WHERE id = p_id;
    ELSE
      UPDATE challenges SET status = 'confirmed', confirmed_at = now(), opponent_rated = coalesce(p_rated, opponent_rated), updated_at = now() WHERE id = p_id;
    END IF;
    RETURN 'confirmed';
  END IF;
  UPDATE challenges SET status = 'accepted', challenger_games = NULL, opponent_games = NULL, entered_by = NULL, updated_at = now() WHERE id = p_id;
  RETURN 'disputed';
END $$
--> statement-breakpoint
REVOKE ALL ON FUNCTION app.my_membership(uuid), app.propose_challenge(uuid, timestamptz, text, int, boolean), app.respond_challenge(uuid, boolean, boolean),
  app.cancel_challenge(uuid), app.record_challenge_result(uuid, int, int), app.confirm_challenge_result(uuid, boolean, boolean) FROM PUBLIC
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app.my_membership(uuid), app.propose_challenge(uuid, timestamptz, text, int, boolean), app.respond_challenge(uuid, boolean, boolean),
  app.cancel_challenge(uuid), app.record_challenge_result(uuid, int, int), app.confirm_challenge_result(uuid, boolean, boolean) TO rallix_app
