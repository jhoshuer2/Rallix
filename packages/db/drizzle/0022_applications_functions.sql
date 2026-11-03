-- DRAFT for Round 2a (moved into packages/db/drizzle once the Round 1 regression has finished).
-- club_pages: members read, club admins write. membership_applications: applicant sees own, admins of the club see theirs; changes only through functions.
ALTER TABLE club_pages ENABLE ROW LEVEL SECURITY
--> statement-breakpoint
CREATE POLICY tenant_read ON club_pages FOR SELECT TO rallix_app USING (club_id = app.cid() AND app.is_member(club_id))
--> statement-breakpoint
CREATE POLICY admin_write ON club_pages FOR ALL TO rallix_app USING (club_id = app.cid() AND app.has_role(club_id, 'admin')) WITH CHECK (club_id = app.cid() AND app.has_role(club_id, 'admin'))
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON club_pages TO rallix_app
--> statement-breakpoint
ALTER TABLE membership_applications ENABLE ROW LEVEL SECURITY
--> statement-breakpoint
CREATE POLICY own_or_admin_read ON membership_applications FOR SELECT TO rallix_app USING (user_id = app.uid() OR (club_id = app.cid() AND app.has_role(club_id, 'admin')))
--> statement-breakpoint
GRANT SELECT ON membership_applications TO rallix_app
--> statement-breakpoint
-- Apply (or join straight away when the club is open). Same invite rules as app.join_club.
CREATE FUNCTION app.apply_to_club(p_code text, p_name text, p_level player_level, p_message text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_user text := app.uid(); v_inv invites%ROWTYPE; v_mode text; v_status member_status; v_member uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'not authenticated' USING ERRCODE = '28000'; END IF;
  SELECT * INTO v_inv FROM invites WHERE code = p_code AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > now()) AND (max_uses IS NULL OR uses < max_uses);
  IF NOT FOUND THEN RETURN 'invalid'; END IF;
  IF NOT EXISTS (SELECT 1 FROM clubs WHERE id = v_inv.club_id AND status = 'active') THEN RETURN 'invalid'; END IF;
  SELECT status INTO v_status FROM memberships WHERE club_id = v_inv.club_id AND user_id = v_user;
  IF FOUND AND v_status = 'active' THEN RETURN 'member'; END IF;
  IF FOUND AND v_status = 'suspended' THEN RETURN 'blocked'; END IF;
  SELECT coalesce((SELECT join_mode FROM club_pages WHERE club_id = v_inv.club_id), 'review') INTO v_mode;
  IF v_mode = 'open' THEN
    PERFORM app.join_club(p_code, p_level);
    RETURN 'joined';
  END IF;
  IF EXISTS (SELECT 1 FROM membership_applications WHERE club_id = v_inv.club_id AND user_id = v_user AND status = 'pending') THEN RETURN 'pending'; END IF;
  IF (SELECT count(*) FROM membership_applications WHERE user_id = v_user AND created_at > now() - interval '1 day') >= 5 THEN RETURN 'limit'; END IF;
  INSERT INTO membership_applications (club_id, user_id, name, level, message) VALUES (v_inv.club_id, v_user, left(trim(p_name), 80), p_level, nullif(left(trim(coalesce(p_message, '')), 500), ''));
  RETURN 'applied';
END $$
--> statement-breakpoint
-- An admin of the club approves or declines. Approval creates the active membership and profile.
CREATE FUNCTION app.decide_application(p_id uuid, p_approve boolean, p_note text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_app membership_applications%ROWTYPE; v_admin uuid; v_member uuid;
BEGIN
  IF app.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated' USING ERRCODE = '28000'; END IF;
  SELECT * INTO v_app FROM membership_applications WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR NOT app.has_role(v_app.club_id, 'admin') THEN RETURN 'closed'; END IF;
  IF v_app.status <> 'pending' THEN RETURN 'closed'; END IF;
  SELECT id INTO v_admin FROM memberships WHERE club_id = v_app.club_id AND user_id = app.uid();
  IF p_approve THEN
    SELECT id INTO v_member FROM memberships WHERE club_id = v_app.club_id AND user_id = v_app.user_id;
    IF FOUND THEN UPDATE memberships SET status = 'active', roles = ARRAY['player']::member_role[], joined_at = now() WHERE id = v_member AND status <> 'suspended';
    ELSE INSERT INTO memberships (club_id, user_id, roles) VALUES (v_app.club_id, v_app.user_id, ARRAY['player']::member_role[]) RETURNING id INTO v_member; END IF;
    INSERT INTO player_profiles (membership_id, club_id, level) VALUES (v_member, v_app.club_id, v_app.level) ON CONFLICT (membership_id) DO NOTHING;
  END IF;
  UPDATE membership_applications SET status = CASE WHEN p_approve THEN 'approved' ELSE 'declined' END, decided_by = v_admin, decided_at = now(), decision_note = nullif(left(trim(coalesce(p_note, '')), 300), '') WHERE id = p_id;
  RETURN CASE WHEN p_approve THEN 'approved' ELSE 'declined' END;
END $$
--> statement-breakpoint
CREATE FUNCTION app.withdraw_application(p_id uuid) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  UPDATE membership_applications SET status = 'withdrawn', decided_at = now() WHERE id = p_id AND user_id = app.uid() AND status = 'pending';
  RETURN CASE WHEN FOUND THEN 'withdrawn' ELSE 'closed' END;
END $$
--> statement-breakpoint
REVOKE ALL ON FUNCTION app.apply_to_club(text, text, player_level, text), app.decide_application(uuid, boolean, text), app.withdraw_application(uuid) FROM PUBLIC
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app.apply_to_club(text, text, player_level, text), app.decide_application(uuid, boolean, text), app.withdraw_application(uuid) TO rallix_app
--> statement-breakpoint
GRANT ALL ON ALL TABLES IN SCHEMA public TO rallix_service
