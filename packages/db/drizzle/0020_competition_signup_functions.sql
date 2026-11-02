-- Competition preview and self sign-up.
-- Players see a competition only when it is running, finished, or a draft open for sign-up. Admins always see everything.
DROP POLICY tenant_read ON competitions
--> statement-breakpoint
CREATE POLICY tenant_read ON competitions FOR SELECT TO rallix_app USING (
  club_id = app.cid() AND app.is_member(club_id) AND (status <> 'draft' OR open_registration OR app.has_role(club_id, 'admin')))
--> statement-breakpoint
-- Entries of a competition the caller cannot see are hidden too (the sub-select runs under the competitions policy above).
DROP POLICY tenant_read ON competition_entries
--> statement-breakpoint
CREATE POLICY tenant_read ON competition_entries FOR SELECT TO rallix_app USING (
  club_id = app.cid() AND app.is_member(club_id) AND EXISTS (SELECT 1 FROM competitions c WHERE c.id = competition_id))
--> statement-breakpoint
-- Players cannot write competition_entries directly (admin_write only). They sign up through these two functions, which
-- lock the competition row so two people cannot take the last spot, and only ever act for the signed-in user.
CREATE FUNCTION app.join_competition(p_competition uuid) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_user text := app.uid();
  v_c competitions%ROWTYPE;
  v_member uuid;
  v_level player_level;
  v_tz text;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'not authenticated' USING ERRCODE = '28000'; END IF;
  SELECT * INTO v_c FROM competitions WHERE id = p_competition FOR UPDATE;
  IF NOT FOUND THEN RETURN 'closed'; END IF;
  IF NOT app.is_member(v_c.club_id) THEN RETURN 'closed'; END IF;
  SELECT id INTO v_member FROM memberships WHERE club_id = v_c.club_id AND user_id = v_user AND status = 'active';
  IF EXISTS (SELECT 1 FROM competition_entries WHERE competition_id = p_competition AND membership_id = v_member) THEN RETURN 'already'; END IF;
  IF v_c.status <> 'draft' OR NOT v_c.open_registration THEN RETURN 'closed'; END IF;
  SELECT timezone INTO v_tz FROM clubs WHERE id = v_c.club_id;
  IF v_c.registration_closes_on IS NOT NULL AND (now() AT TIME ZONE v_tz)::date > v_c.registration_closes_on THEN RETURN 'closed'; END IF;
  IF v_c.level IS NOT NULL THEN
    SELECT level INTO v_level FROM player_profiles WHERE membership_id = v_member;
    IF v_level IS DISTINCT FROM v_c.level THEN RETURN 'level'; END IF;
  END IF;
  IF v_c.max_players IS NOT NULL AND (SELECT count(*) FROM competition_entries WHERE competition_id = p_competition) >= v_c.max_players THEN RETURN 'full'; END IF;
  INSERT INTO competition_entries (club_id, competition_id, membership_id) VALUES (v_c.club_id, p_competition, v_member);
  RETURN 'joined';
END $$
--> statement-breakpoint
CREATE FUNCTION app.leave_competition(p_competition uuid) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_user text := app.uid();
  v_c competitions%ROWTYPE;
  v_member uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'not authenticated' USING ERRCODE = '28000'; END IF;
  SELECT * INTO v_c FROM competitions WHERE id = p_competition FOR UPDATE;
  IF NOT FOUND OR NOT app.is_member(v_c.club_id) THEN RETURN 'closed'; END IF;
  IF v_c.status <> 'draft' THEN RETURN 'closed'; END IF;
  SELECT id INTO v_member FROM memberships WHERE club_id = v_c.club_id AND user_id = v_user AND status = 'active';
  DELETE FROM competition_entries WHERE competition_id = p_competition AND membership_id = v_member;
  RETURN 'left';
END $$
--> statement-breakpoint
REVOKE ALL ON FUNCTION app.join_competition(uuid), app.leave_competition(uuid) FROM PUBLIC
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app.join_competition(uuid), app.leave_competition(uuid) TO rallix_app
--> statement-breakpoint
GRANT ALL ON ALL TABLES IN SCHEMA public TO rallix_service
