-- Waitlist for full competitions. People join and leave only through the functions below; a spot that opens goes to the oldest waiter.
CREATE TABLE "competition_waitlist" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL,
	"competition_id" uuid NOT NULL,
	"membership_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "competition_waitlist_uq" UNIQUE("competition_id","membership_id")
)
--> statement-breakpoint
ALTER TABLE "competition_waitlist" ADD CONSTRAINT "competition_waitlist_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "clubs"("id") ON DELETE cascade
--> statement-breakpoint
ALTER TABLE "competition_waitlist" ADD CONSTRAINT "waitlist_competition_fk" FOREIGN KEY ("competition_id","club_id") REFERENCES "competitions"("id","club_id") ON DELETE cascade
--> statement-breakpoint
ALTER TABLE "competition_waitlist" ADD CONSTRAINT "waitlist_membership_fk" FOREIGN KEY ("membership_id","club_id") REFERENCES "memberships"("id","club_id") ON DELETE cascade
--> statement-breakpoint
CREATE INDEX "competition_waitlist_idx" ON "competition_waitlist" ("competition_id","created_at")
--> statement-breakpoint
ALTER TABLE competition_waitlist ENABLE ROW LEVEL SECURITY
--> statement-breakpoint
-- Visible whenever the competition is (the sub-select runs under the competitions read policy). Nobody writes it directly.
CREATE POLICY tenant_read ON competition_waitlist FOR SELECT TO rallix_app USING (club_id = app.cid() AND app.is_member(club_id) AND EXISTS (SELECT 1 FROM competitions c WHERE c.id = competition_id))
--> statement-breakpoint
GRANT SELECT ON competition_waitlist TO rallix_app
--> statement-breakpoint
GRANT ALL ON competition_waitlist TO rallix_service
--> statement-breakpoint
-- Internal: fill free spots from the queue, oldest first, skipping anyone who no longer fits the level. Not callable by the app role.
CREATE FUNCTION app.promote_waitlist_internal(p_competition uuid) RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_c competitions%ROWTYPE;
  v_tz text;
  v_w competition_waitlist%ROWTYPE;
  v_n int := 0;
BEGIN
  SELECT * INTO v_c FROM competitions WHERE id = p_competition FOR UPDATE;
  IF NOT FOUND OR v_c.status <> 'draft' OR NOT v_c.open_registration THEN RETURN 0; END IF;
  SELECT timezone INTO v_tz FROM clubs WHERE id = v_c.club_id;
  IF v_c.registration_closes_on IS NOT NULL AND (now() AT TIME ZONE v_tz)::date > v_c.registration_closes_on THEN RETURN 0; END IF;
  LOOP
    EXIT WHEN v_c.max_players IS NOT NULL AND (SELECT count(*) FROM competition_entries WHERE competition_id = p_competition) >= v_c.max_players;
    SELECT w.* INTO v_w FROM competition_waitlist w
      LEFT JOIN player_profiles p ON p.membership_id = w.membership_id
      JOIN memberships m ON m.id = w.membership_id AND m.status = 'active'
      WHERE w.competition_id = p_competition AND (v_c.level IS NULL OR p.level = v_c.level)
      ORDER BY w.created_at, w.id LIMIT 1;
    EXIT WHEN NOT FOUND;
    INSERT INTO competition_entries (club_id, competition_id, membership_id) VALUES (v_c.club_id, p_competition, v_w.membership_id) ON CONFLICT DO NOTHING;
    DELETE FROM competition_waitlist WHERE id = v_w.id;
    v_n := v_n + 1;
  END LOOP;
  RETURN v_n;
END $$
--> statement-breakpoint
CREATE FUNCTION app.entry_deleted() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  PERFORM app.promote_waitlist_internal(OLD.competition_id);
  RETURN OLD;
END $$
--> statement-breakpoint
CREATE TRIGGER competition_entries_promote AFTER DELETE ON competition_entries FOR EACH ROW EXECUTE FUNCTION app.entry_deleted()
--> statement-breakpoint
-- An admin adding someone by hand takes them off the queue.
CREATE FUNCTION app.entry_added() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  DELETE FROM competition_waitlist WHERE competition_id = NEW.competition_id AND membership_id = NEW.membership_id;
  RETURN NEW;
END $$
--> statement-breakpoint
CREATE TRIGGER competition_entries_unqueue AFTER INSERT ON competition_entries FOR EACH ROW EXECUTE FUNCTION app.entry_added()
--> statement-breakpoint
CREATE FUNCTION app.join_waitlist(p_competition uuid) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_user text := app.uid();
  v_c competitions%ROWTYPE;
  v_member uuid;
  v_level player_level;
  v_tz text;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'not authenticated' USING ERRCODE = '28000'; END IF;
  SELECT * INTO v_c FROM competitions WHERE id = p_competition FOR UPDATE;
  IF NOT FOUND OR NOT app.is_member(v_c.club_id) THEN RETURN 'closed'; END IF;
  SELECT id INTO v_member FROM memberships WHERE club_id = v_c.club_id AND user_id = v_user AND status = 'active';
  IF EXISTS (SELECT 1 FROM competition_entries WHERE competition_id = p_competition AND membership_id = v_member) THEN RETURN 'registered'; END IF;
  IF v_c.status <> 'draft' OR NOT v_c.open_registration THEN RETURN 'closed'; END IF;
  SELECT timezone INTO v_tz FROM clubs WHERE id = v_c.club_id;
  IF v_c.registration_closes_on IS NOT NULL AND (now() AT TIME ZONE v_tz)::date > v_c.registration_closes_on THEN RETURN 'closed'; END IF;
  IF v_c.level IS NOT NULL THEN
    SELECT level INTO v_level FROM player_profiles WHERE membership_id = v_member;
    IF v_level IS DISTINCT FROM v_c.level THEN RETURN 'level'; END IF;
  END IF;
  IF EXISTS (SELECT 1 FROM competition_waitlist WHERE competition_id = p_competition AND membership_id = v_member) THEN RETURN 'already'; END IF;
  -- The queue is only for a competition that is really full; otherwise join it directly.
  IF v_c.max_players IS NULL OR (SELECT count(*) FROM competition_entries WHERE competition_id = p_competition) < v_c.max_players THEN RETURN 'room'; END IF;
  INSERT INTO competition_waitlist (club_id, competition_id, membership_id) VALUES (v_c.club_id, p_competition, v_member);
  RETURN 'waiting';
END $$
--> statement-breakpoint
CREATE FUNCTION app.leave_waitlist(p_competition uuid) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_user text := app.uid();
  v_club uuid;
  v_member uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'not authenticated' USING ERRCODE = '28000'; END IF;
  SELECT club_id INTO v_club FROM competitions WHERE id = p_competition;
  IF v_club IS NULL OR NOT app.is_member(v_club) THEN RETURN 'closed'; END IF;
  SELECT id INTO v_member FROM memberships WHERE club_id = v_club AND user_id = v_user AND status = 'active';
  DELETE FROM competition_waitlist WHERE competition_id = p_competition AND membership_id = v_member;
  RETURN 'left';
END $$
--> statement-breakpoint
-- The Competitions admin raised the limit (or otherwise made room): fill it from the queue.
CREATE FUNCTION app.promote_waitlist(p_competition uuid) RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_club uuid;
BEGIN
  IF app.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated' USING ERRCODE = '28000'; END IF;
  SELECT club_id INTO v_club FROM competitions WHERE id = p_competition;
  IF v_club IS NULL OR NOT app.has_permission(v_club, 'competitions') THEN RETURN 0; END IF;
  RETURN app.promote_waitlist_internal(p_competition);
END $$
--> statement-breakpoint
REVOKE ALL ON FUNCTION app.promote_waitlist_internal(uuid), app.entry_deleted(), app.entry_added(), app.join_waitlist(uuid), app.leave_waitlist(uuid), app.promote_waitlist(uuid) FROM PUBLIC
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app.join_waitlist(uuid), app.leave_waitlist(uuid), app.promote_waitlist(uuid) TO rallix_app
