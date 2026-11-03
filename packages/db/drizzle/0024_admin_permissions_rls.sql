-- Admin team: each admin looks after chosen areas (members, competitions, finance, facilities). The club owner has all of them.
CREATE FUNCTION app.has_permission(p_club uuid, p_perm text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM memberships m JOIN clubs c ON c.id = m.club_id
    WHERE m.club_id = p_club AND m.user_id = app.uid() AND m.status = 'active' AND c.status = 'active' AND 'admin' = ANY(m.roles)
      AND (c.owner_id = m.user_id OR p_perm = ANY(m.permissions)))
$$
--> statement-breakpoint
REVOKE ALL ON FUNCTION app.has_permission(uuid, text) FROM PUBLIC
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app.has_permission(uuid, text) TO rallix_app
--> statement-breakpoint
-- Everyone who is an admin today keeps full access.
UPDATE memberships SET permissions = ARRAY['members','competitions','finance','facilities'] WHERE 'admin' = ANY(roles)
--> statement-breakpoint
-- Roles and permissions are never written directly by the app: only the owner, through the functions below.
DROP POLICY memberships_admin_write ON memberships
--> statement-breakpoint
REVOKE INSERT, UPDATE, DELETE ON memberships FROM rallix_app
--> statement-breakpoint
-- ===== Members area =====
DROP POLICY clubs_update ON clubs
--> statement-breakpoint
CREATE POLICY clubs_update ON clubs FOR UPDATE TO rallix_app USING (id = app.cid() AND (app.has_permission(id, 'members') OR app.has_permission(id, 'facilities'))) WITH CHECK (id = app.cid() AND (app.has_permission(id, 'members') OR app.has_permission(id, 'facilities')))
--> statement-breakpoint
DROP POLICY invites_admin ON invites
--> statement-breakpoint
CREATE POLICY invites_admin ON invites FOR ALL TO rallix_app USING (club_id = app.cid() AND app.has_permission(club_id, 'members')) WITH CHECK (club_id = app.cid() AND app.has_permission(club_id, 'members'))
--> statement-breakpoint
DROP POLICY self_or_admin_insert ON player_profiles
--> statement-breakpoint
CREATE POLICY self_or_admin_insert ON player_profiles FOR INSERT TO rallix_app WITH CHECK (club_id = app.cid() AND (app.has_permission(club_id, 'members') OR app.is_self(membership_id)))
--> statement-breakpoint
DROP POLICY self_or_admin_update ON player_profiles
--> statement-breakpoint
CREATE POLICY self_or_admin_update ON player_profiles FOR UPDATE TO rallix_app USING (club_id = app.cid() AND (app.has_permission(club_id, 'members') OR app.is_self(membership_id))) WITH CHECK (club_id = app.cid() AND (app.has_permission(club_id, 'members') OR app.is_self(membership_id)))
--> statement-breakpoint
DROP POLICY admin_delete ON player_profiles
--> statement-breakpoint
CREATE POLICY admin_delete ON player_profiles FOR DELETE TO rallix_app USING (club_id = app.cid() AND app.has_permission(club_id, 'members'))
--> statement-breakpoint
DROP POLICY admin_write ON club_pages
--> statement-breakpoint
CREATE POLICY admin_write ON club_pages FOR ALL TO rallix_app USING (club_id = app.cid() AND app.has_permission(club_id, 'members')) WITH CHECK (club_id = app.cid() AND app.has_permission(club_id, 'members'))
--> statement-breakpoint
DROP POLICY own_or_admin_read ON membership_applications
--> statement-breakpoint
CREATE POLICY own_or_admin_read ON membership_applications FOR SELECT TO rallix_app USING (user_id = app.uid() OR (club_id = app.cid() AND app.has_permission(club_id, 'members')))
--> statement-breakpoint
-- ===== Competitions area (scorers may still score) =====
DROP POLICY admin_write ON competitions
--> statement-breakpoint
CREATE POLICY admin_write ON competitions FOR ALL TO rallix_app USING (club_id = app.cid() AND app.has_permission(club_id, 'competitions')) WITH CHECK (club_id = app.cid() AND app.has_permission(club_id, 'competitions'))
--> statement-breakpoint
DROP POLICY tenant_read ON competitions
--> statement-breakpoint
CREATE POLICY tenant_read ON competitions FOR SELECT TO rallix_app USING (club_id = app.cid() AND app.is_member(club_id) AND (status <> 'draft' OR open_registration OR app.has_role(club_id, 'admin')))
--> statement-breakpoint
DROP POLICY admin_write ON competition_entries
--> statement-breakpoint
CREATE POLICY admin_write ON competition_entries FOR ALL TO rallix_app USING (club_id = app.cid() AND app.has_permission(club_id, 'competitions')) WITH CHECK (club_id = app.cid() AND app.has_permission(club_id, 'competitions'))
--> statement-breakpoint
DROP POLICY match_insert ON matches
--> statement-breakpoint
CREATE POLICY match_insert ON matches FOR INSERT TO rallix_app WITH CHECK (club_id = app.cid() AND app.has_permission(club_id, 'competitions'))
--> statement-breakpoint
DROP POLICY match_update ON matches
--> statement-breakpoint
CREATE POLICY match_update ON matches FOR UPDATE TO rallix_app USING (club_id = app.cid() AND (app.has_permission(club_id, 'competitions') OR app.has_role(club_id, 'scorer'))) WITH CHECK (club_id = app.cid() AND (app.has_permission(club_id, 'competitions') OR app.has_role(club_id, 'scorer')))
--> statement-breakpoint
DROP POLICY match_delete ON matches
--> statement-breakpoint
CREATE POLICY match_delete ON matches FOR DELETE TO rallix_app USING (club_id = app.cid() AND app.has_permission(club_id, 'competitions'))
--> statement-breakpoint
DROP POLICY scorer_write ON games
--> statement-breakpoint
CREATE POLICY scorer_write ON games FOR ALL TO rallix_app USING (club_id = app.cid() AND (app.has_permission(club_id, 'competitions') OR app.has_role(club_id, 'scorer'))) WITH CHECK (club_id = app.cid() AND (app.has_permission(club_id, 'competitions') OR app.has_role(club_id, 'scorer')))
--> statement-breakpoint
DROP POLICY scorer_write ON points
--> statement-breakpoint
CREATE POLICY scorer_write ON points FOR ALL TO rallix_app USING (club_id = app.cid() AND (app.has_permission(club_id, 'competitions') OR app.has_role(club_id, 'scorer'))) WITH CHECK (club_id = app.cid() AND (app.has_permission(club_id, 'competitions') OR app.has_role(club_id, 'scorer')))
--> statement-breakpoint
-- ===== Finance area =====
DROP POLICY admin_write ON plans
--> statement-breakpoint
CREATE POLICY admin_write ON plans FOR ALL TO rallix_app USING (club_id = app.cid() AND app.has_permission(club_id, 'finance')) WITH CHECK (club_id = app.cid() AND app.has_permission(club_id, 'finance'))
--> statement-breakpoint
DROP POLICY own_or_admin_read ON dues
--> statement-breakpoint
CREATE POLICY own_or_admin_read ON dues FOR SELECT TO rallix_app USING (club_id = app.cid() AND (app.has_permission(club_id, 'finance') OR app.is_self(membership_id)))
--> statement-breakpoint
DROP POLICY admin_write ON dues
--> statement-breakpoint
CREATE POLICY admin_write ON dues FOR ALL TO rallix_app USING (club_id = app.cid() AND app.has_permission(club_id, 'finance')) WITH CHECK (club_id = app.cid() AND app.has_permission(club_id, 'finance'))
--> statement-breakpoint
DROP POLICY own_or_admin_read ON payments
--> statement-breakpoint
CREATE POLICY own_or_admin_read ON payments FOR SELECT TO rallix_app USING (club_id = app.cid() AND (app.has_permission(club_id, 'finance') OR app.is_self(membership_id)))
--> statement-breakpoint
DROP POLICY admin_insert ON payments
--> statement-breakpoint
CREATE POLICY admin_insert ON payments FOR INSERT TO rallix_app WITH CHECK (club_id = app.cid() AND app.has_permission(club_id, 'finance'))
--> statement-breakpoint
DROP POLICY admin_read ON club_subscriptions
--> statement-breakpoint
CREATE POLICY admin_read ON club_subscriptions FOR SELECT TO rallix_app USING (app.has_permission(club_id, 'finance'))
--> statement-breakpoint
DROP POLICY admin_read ON platform_invoices
--> statement-breakpoint
CREATE POLICY admin_read ON platform_invoices FOR SELECT TO rallix_app USING (app.has_permission(club_id, 'finance'))
--> statement-breakpoint
DROP POLICY admin_all ON reminder_settings
--> statement-breakpoint
CREATE POLICY admin_all ON reminder_settings FOR ALL TO rallix_app USING (club_id = app.cid() AND app.has_permission(club_id, 'finance')) WITH CHECK (club_id = app.cid() AND app.has_permission(club_id, 'finance'))
--> statement-breakpoint
-- ===== Decisions on applications need the Members responsibility =====
CREATE OR REPLACE FUNCTION app.decide_application(p_id uuid, p_approve boolean, p_note text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_app membership_applications%ROWTYPE; v_admin uuid; v_member uuid;
BEGIN
  IF app.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated' USING ERRCODE = '28000'; END IF;
  SELECT * INTO v_app FROM membership_applications WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR NOT app.has_permission(v_app.club_id, 'members') THEN RETURN 'closed'; END IF;
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
-- ===== Only the club owner makes or changes admins =====
CREATE FUNCTION app.set_admin(p_member uuid, p_permissions text[]) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_m memberships%ROWTYPE;
BEGIN
  IF app.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated' USING ERRCODE = '28000'; END IF;
  SELECT * INTO v_m FROM memberships WHERE id = p_member FOR UPDATE;
  IF NOT FOUND THEN RETURN 'closed'; END IF;
  IF NOT EXISTS (SELECT 1 FROM clubs WHERE id = v_m.club_id AND owner_id = app.uid() AND status = 'active') THEN RETURN 'closed'; END IF;
  IF v_m.user_id = app.uid() THEN RETURN 'owner'; END IF;
  IF v_m.status <> 'active' THEN RETURN 'closed'; END IF;
  IF p_permissions IS NULL OR NOT (p_permissions <@ ARRAY['members','competitions','finance','facilities']::text[]) THEN RETURN 'invalid'; END IF;
  UPDATE memberships SET roles = (SELECT array_agg(DISTINCT r) FROM unnest(array_append(roles, 'admin'::member_role)) AS r), permissions = (SELECT coalesce(array_agg(DISTINCT x), '{}') FROM unnest(p_permissions) AS x) WHERE id = p_member;
  RETURN 'ok';
END $$
--> statement-breakpoint
CREATE FUNCTION app.remove_admin(p_member uuid) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_m memberships%ROWTYPE; v_roles member_role[];
BEGIN
  IF app.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated' USING ERRCODE = '28000'; END IF;
  SELECT * INTO v_m FROM memberships WHERE id = p_member FOR UPDATE;
  IF NOT FOUND THEN RETURN 'closed'; END IF;
  IF NOT EXISTS (SELECT 1 FROM clubs WHERE id = v_m.club_id AND owner_id = app.uid() AND status = 'active') THEN RETURN 'closed'; END IF;
  IF v_m.user_id = app.uid() THEN RETURN 'owner'; END IF;
  v_roles := array_remove(v_m.roles, 'admin'::member_role);
  IF cardinality(v_roles) = 0 THEN v_roles := ARRAY['player']::member_role[]; END IF;
  UPDATE memberships SET roles = v_roles, permissions = '{}' WHERE id = p_member;
  RETURN 'ok';
END $$
--> statement-breakpoint
REVOKE ALL ON FUNCTION app.set_admin(uuid, text[]), app.remove_admin(uuid) FROM PUBLIC
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app.set_admin(uuid, text[]), app.remove_admin(uuid) TO rallix_app
--> statement-breakpoint
GRANT ALL ON ALL TABLES IN SCHEMA public TO rallix_service
