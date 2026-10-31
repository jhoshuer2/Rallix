-- Row-level security, helper functions and grants. Statements separated by lines containing only ";;".
-- Model: every request runs in a transaction that sets app.user_id and app.club_id (see src/tenant.ts).
-- The table owner (rallix_owner) is exempt from RLS and is only used for migrations.

CREATE SCHEMA IF NOT EXISTS app
--> statement-breakpoint
GRANT USAGE ON SCHEMA app TO rallix_app, rallix_service
--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO rallix_app, rallix_service
--> statement-breakpoint
-- ===== Context accessors =====
CREATE FUNCTION app.uid() RETURNS text LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('app.user_id', true), '') $$
--> statement-breakpoint
CREATE FUNCTION app.cid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('app.club_id', true), '')::uuid $$
--> statement-breakpoint
-- ===== Membership helpers. SECURITY DEFINER so they can read memberships without recursing through its own RLS. =====
CREATE FUNCTION app.is_member(p_club uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (SELECT 1 FROM memberships m WHERE m.club_id = p_club AND m.user_id = app.uid() AND m.status = 'active')
$$
--> statement-breakpoint
CREATE FUNCTION app.has_role(p_club uuid, VARIADIC p_roles member_role[]) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (SELECT 1 FROM memberships m WHERE m.club_id = p_club AND m.user_id = app.uid() AND m.status = 'active' AND m.roles && p_roles)
$$
--> statement-breakpoint
CREATE FUNCTION app.is_self(p_membership uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (SELECT 1 FROM memberships m WHERE m.id = p_membership AND m.user_id = app.uid() AND m.status = 'active')
$$
--> statement-breakpoint
CREATE FUNCTION app.shares_club(p_user text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM memberships a JOIN memberships b ON a.club_id = b.club_id
    WHERE a.user_id = app.uid() AND a.status = 'active' AND b.user_id = p_user AND b.status = 'active')
$$
--> statement-breakpoint
-- ===== updated_at trigger =====
CREATE FUNCTION app.touch_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at := now(); RETURN NEW; END $$
--> statement-breakpoint
CREATE TRIGGER touch BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at()
--> statement-breakpoint
CREATE TRIGGER touch BEFORE UPDATE ON clubs FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at()
--> statement-breakpoint
CREATE TRIGGER touch BEFORE UPDATE ON player_profiles FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at()
--> statement-breakpoint
CREATE TRIGGER touch BEFORE UPDATE ON plans FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at()
--> statement-breakpoint
CREATE TRIGGER touch BEFORE UPDATE ON competitions FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at()
--> statement-breakpoint
CREATE TRIGGER touch BEFORE UPDATE ON matches FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at()
--> statement-breakpoint
-- ===== Controlled entry points (clubs and memberships cannot be inserted directly by the app role) =====
CREATE FUNCTION app.create_club(p_name text, p_slug text, p_location text DEFAULT NULL) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_user text := app.uid(); v_club uuid; v_member uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'not authenticated' USING ERRCODE = '28000'; END IF;
  INSERT INTO clubs (slug, name, location, owner_id) VALUES (p_slug, p_name, p_location, v_user) RETURNING id INTO v_club;
  INSERT INTO memberships (club_id, user_id, roles) VALUES (v_club, v_user, ARRAY['admin','player']::member_role[]) RETURNING id INTO v_member;
  INSERT INTO player_profiles (membership_id, club_id) VALUES (v_member, v_club);
  RETURN v_club;
END $$
--> statement-breakpoint
CREATE FUNCTION app.join_club(p_code text, p_level player_level DEFAULT 'junior') RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_user text := app.uid(); v_inv invites%ROWTYPE; v_member uuid; v_status member_status;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'not authenticated' USING ERRCODE = '28000'; END IF;
  SELECT * INTO v_inv FROM invites
   WHERE code = p_code AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > now()) AND (max_uses IS NULL OR uses < max_uses)
   FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'invalid or expired invite' USING ERRCODE = 'P0001'; END IF;
  IF NOT EXISTS (SELECT 1 FROM clubs WHERE id = v_inv.club_id AND status = 'active') THEN RAISE EXCEPTION 'club is not active' USING ERRCODE = 'P0001'; END IF;
  SELECT id, status INTO v_member, v_status FROM memberships WHERE club_id = v_inv.club_id AND user_id = v_user;
  IF FOUND THEN
    IF v_status = 'suspended' THEN RAISE EXCEPTION 'membership suspended' USING ERRCODE = 'P0001'; END IF;
    IF v_status = 'active' THEN RETURN v_member; END IF;
    UPDATE memberships SET status = 'active', roles = ARRAY[v_inv.role]::member_role[], joined_at = now() WHERE id = v_member;
  ELSE
    INSERT INTO memberships (club_id, user_id, roles) VALUES (v_inv.club_id, v_user, ARRAY[v_inv.role]::member_role[]) RETURNING id INTO v_member;
  END IF;
  INSERT INTO player_profiles (membership_id, club_id, level) VALUES (v_member, v_inv.club_id, p_level) ON CONFLICT (membership_id) DO NOTHING;
  UPDATE invites SET uses = uses + 1 WHERE id = v_inv.id;
  RETURN v_member;
END $$
--> statement-breakpoint
REVOKE ALL ON FUNCTION app.is_member(uuid), app.has_role(uuid, member_role[]), app.is_self(uuid), app.shares_club(text), app.create_club(text, text, text), app.join_club(text, player_level) FROM PUBLIC
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app.uid(), app.cid(), app.is_member(uuid), app.has_role(uuid, member_role[]), app.is_self(uuid), app.shares_club(text), app.create_club(text, text, text), app.join_club(text, player_level) TO rallix_app, rallix_service
--> statement-breakpoint
-- ===== Enable RLS everywhere (deny by default; policies below open specific paths) =====
ALTER TABLE users ENABLE ROW LEVEL SECURITY
--> statement-breakpoint
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY
--> statement-breakpoint
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY
--> statement-breakpoint
ALTER TABLE verifications ENABLE ROW LEVEL SECURITY
--> statement-breakpoint
ALTER TABLE clubs ENABLE ROW LEVEL SECURITY
--> statement-breakpoint
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY
--> statement-breakpoint
ALTER TABLE invites ENABLE ROW LEVEL SECURITY
--> statement-breakpoint
ALTER TABLE player_profiles ENABLE ROW LEVEL SECURITY
--> statement-breakpoint
ALTER TABLE plans ENABLE ROW LEVEL SECURITY
--> statement-breakpoint
ALTER TABLE dues ENABLE ROW LEVEL SECURITY
--> statement-breakpoint
ALTER TABLE payments ENABLE ROW LEVEL SECURITY
--> statement-breakpoint
ALTER TABLE competitions ENABLE ROW LEVEL SECURITY
--> statement-breakpoint
ALTER TABLE competition_entries ENABLE ROW LEVEL SECURITY
--> statement-breakpoint
ALTER TABLE matches ENABLE ROW LEVEL SECURITY
--> statement-breakpoint
ALTER TABLE games ENABLE ROW LEVEL SECURITY
--> statement-breakpoint
ALTER TABLE points ENABLE ROW LEVEL SECURITY
--> statement-breakpoint
ALTER TABLE ratings ENABLE ROW LEVEL SECURITY
--> statement-breakpoint
ALTER TABLE rating_events ENABLE ROW LEVEL SECURITY
--> statement-breakpoint
ALTER TABLE stat_snapshots ENABLE ROW LEVEL SECURITY
--> statement-breakpoint
ALTER TABLE club_subscriptions ENABLE ROW LEVEL SECURITY
--> statement-breakpoint
ALTER TABLE platform_invoices ENABLE ROW LEVEL SECURITY
--> statement-breakpoint
ALTER TABLE platform_admins ENABLE ROW LEVEL SECURITY
--> statement-breakpoint
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY
--> statement-breakpoint
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY
--> statement-breakpoint
ALTER TABLE global_ratings ENABLE ROW LEVEL SECURITY
--> statement-breakpoint
-- ===== Policies: users and clubs =====
CREATE POLICY users_read ON users FOR SELECT TO rallix_app USING (id = app.uid() OR app.shares_club(id))
--> statement-breakpoint
CREATE POLICY users_update_self ON users FOR UPDATE TO rallix_app USING (id = app.uid()) WITH CHECK (id = app.uid())
--> statement-breakpoint
CREATE POLICY clubs_read ON clubs FOR SELECT TO rallix_app USING (app.is_member(id))
--> statement-breakpoint
CREATE POLICY clubs_update ON clubs FOR UPDATE TO rallix_app USING (id = app.cid() AND app.has_role(id, 'admin')) WITH CHECK (id = app.cid() AND app.has_role(id, 'admin'))
--> statement-breakpoint
-- ===== Memberships: a user can always list their own memberships (club switcher); club members see the roster =====
CREATE POLICY memberships_read ON memberships FOR SELECT TO rallix_app USING (user_id = app.uid() OR (club_id = app.cid() AND app.is_member(club_id)))
--> statement-breakpoint
CREATE POLICY memberships_admin_write ON memberships FOR ALL TO rallix_app USING (club_id = app.cid() AND app.has_role(club_id, 'admin')) WITH CHECK (club_id = app.cid() AND app.has_role(club_id, 'admin'))
--> statement-breakpoint
CREATE POLICY invites_admin ON invites FOR ALL TO rallix_app USING (club_id = app.cid() AND app.has_role(club_id, 'admin')) WITH CHECK (club_id = app.cid() AND app.has_role(club_id, 'admin'))
--> statement-breakpoint
-- ===== Member-readable club data =====
CREATE POLICY tenant_read ON player_profiles FOR SELECT TO rallix_app USING (club_id = app.cid() AND app.is_member(club_id))
--> statement-breakpoint
CREATE POLICY tenant_read ON plans FOR SELECT TO rallix_app USING (club_id = app.cid() AND app.is_member(club_id))
--> statement-breakpoint
CREATE POLICY tenant_read ON competitions FOR SELECT TO rallix_app USING (club_id = app.cid() AND app.is_member(club_id))
--> statement-breakpoint
CREATE POLICY tenant_read ON competition_entries FOR SELECT TO rallix_app USING (club_id = app.cid() AND app.is_member(club_id))
--> statement-breakpoint
CREATE POLICY tenant_read ON matches FOR SELECT TO rallix_app USING (club_id = app.cid() AND app.is_member(club_id))
--> statement-breakpoint
CREATE POLICY tenant_read ON games FOR SELECT TO rallix_app USING (club_id = app.cid() AND app.is_member(club_id))
--> statement-breakpoint
CREATE POLICY tenant_read ON points FOR SELECT TO rallix_app USING (club_id = app.cid() AND app.is_member(club_id))
--> statement-breakpoint
CREATE POLICY tenant_read ON ratings FOR SELECT TO rallix_app USING (club_id = app.cid() AND app.is_member(club_id))
--> statement-breakpoint
CREATE POLICY tenant_read ON rating_events FOR SELECT TO rallix_app USING (club_id = app.cid() AND app.is_member(club_id))
--> statement-breakpoint
CREATE POLICY tenant_read ON stat_snapshots FOR SELECT TO rallix_app USING (club_id = app.cid() AND app.is_member(club_id))
--> statement-breakpoint
-- ===== Admin writes =====
CREATE POLICY admin_write ON plans FOR ALL TO rallix_app USING (club_id = app.cid() AND app.has_role(club_id, 'admin')) WITH CHECK (club_id = app.cid() AND app.has_role(club_id, 'admin'))
--> statement-breakpoint
CREATE POLICY admin_write ON competitions FOR ALL TO rallix_app USING (club_id = app.cid() AND app.has_role(club_id, 'admin')) WITH CHECK (club_id = app.cid() AND app.has_role(club_id, 'admin'))
--> statement-breakpoint
CREATE POLICY admin_write ON competition_entries FOR ALL TO rallix_app USING (club_id = app.cid() AND app.has_role(club_id, 'admin')) WITH CHECK (club_id = app.cid() AND app.has_role(club_id, 'admin'))
--> statement-breakpoint
-- ===== Player profiles: the player edits their own; admins edit any =====
CREATE POLICY self_or_admin_insert ON player_profiles FOR INSERT TO rallix_app WITH CHECK (club_id = app.cid() AND (app.has_role(club_id, 'admin') OR app.is_self(membership_id)))
--> statement-breakpoint
CREATE POLICY self_or_admin_update ON player_profiles FOR UPDATE TO rallix_app USING (club_id = app.cid() AND (app.has_role(club_id, 'admin') OR app.is_self(membership_id))) WITH CHECK (club_id = app.cid() AND (app.has_role(club_id, 'admin') OR app.is_self(membership_id)))
--> statement-breakpoint
CREATE POLICY admin_delete ON player_profiles FOR DELETE TO rallix_app USING (club_id = app.cid() AND app.has_role(club_id, 'admin'))
--> statement-breakpoint
-- ===== Scoring: admins and scorers write results; players never do =====
CREATE POLICY match_insert ON matches FOR INSERT TO rallix_app WITH CHECK (club_id = app.cid() AND app.has_role(club_id, 'admin'))
--> statement-breakpoint
CREATE POLICY match_update ON matches FOR UPDATE TO rallix_app USING (club_id = app.cid() AND app.has_role(club_id, 'admin', 'scorer')) WITH CHECK (club_id = app.cid() AND app.has_role(club_id, 'admin', 'scorer'))
--> statement-breakpoint
CREATE POLICY match_delete ON matches FOR DELETE TO rallix_app USING (club_id = app.cid() AND app.has_role(club_id, 'admin'))
--> statement-breakpoint
CREATE POLICY scorer_write ON games FOR ALL TO rallix_app USING (club_id = app.cid() AND app.has_role(club_id, 'admin', 'scorer')) WITH CHECK (club_id = app.cid() AND app.has_role(club_id, 'admin', 'scorer'))
--> statement-breakpoint
CREATE POLICY scorer_write ON points FOR ALL TO rallix_app USING (club_id = app.cid() AND app.has_role(club_id, 'admin', 'scorer')) WITH CHECK (club_id = app.cid() AND app.has_role(club_id, 'admin', 'scorer'))
--> statement-breakpoint
-- ===== Money: players see only their own dues and payments; admins see all =====
CREATE POLICY own_or_admin_read ON dues FOR SELECT TO rallix_app USING (club_id = app.cid() AND (app.has_role(club_id, 'admin') OR app.is_self(membership_id)))
--> statement-breakpoint
CREATE POLICY admin_write ON dues FOR ALL TO rallix_app USING (club_id = app.cid() AND app.has_role(club_id, 'admin')) WITH CHECK (club_id = app.cid() AND app.has_role(club_id, 'admin'))
--> statement-breakpoint
CREATE POLICY own_or_admin_read ON payments FOR SELECT TO rallix_app USING (club_id = app.cid() AND (app.has_role(club_id, 'admin') OR app.is_self(membership_id)))
--> statement-breakpoint
CREATE POLICY admin_insert ON payments FOR INSERT TO rallix_app WITH CHECK (club_id = app.cid() AND app.has_role(club_id, 'admin'))
--> statement-breakpoint
CREATE POLICY self_insert_pending ON payments FOR INSERT TO rallix_app WITH CHECK (club_id = app.cid() AND app.is_self(membership_id) AND status = 'pending')
--> statement-breakpoint
-- ===== Platform billing: a club admin can read their own club's rows =====
CREATE POLICY admin_read ON club_subscriptions FOR SELECT TO rallix_app USING (app.has_role(club_id, 'admin'))
--> statement-breakpoint
CREATE POLICY admin_read ON platform_invoices FOR SELECT TO rallix_app USING (app.has_role(club_id, 'admin'))
--> statement-breakpoint
-- ===== Global leaderboard: exposes only user id, name and rating, via an owner-run view =====
CREATE VIEW app.global_leaderboard AS
  SELECT g.user_id, u.name, g.rating, g.matches_played FROM global_ratings g JOIN users u ON u.id = g.user_id
--> statement-breakpoint
-- ===== Least-privilege grants for the app role =====
GRANT SELECT (id, name, image, created_at) ON users TO rallix_app
--> statement-breakpoint
GRANT UPDATE (name, image) ON users TO rallix_app
--> statement-breakpoint
GRANT SELECT, UPDATE ON clubs TO rallix_app
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON memberships, invites, player_profiles, plans, dues, competitions, competition_entries, matches, games, points TO rallix_app
--> statement-breakpoint
GRANT SELECT, INSERT ON payments TO rallix_app
--> statement-breakpoint
GRANT SELECT ON ratings, rating_events, stat_snapshots, club_subscriptions, platform_invoices TO rallix_app
--> statement-breakpoint
GRANT SELECT ON app.global_leaderboard TO rallix_app
--> statement-breakpoint
GRANT ALL ON ALL TABLES IN SCHEMA public TO rallix_service
--> statement-breakpoint
GRANT SELECT ON app.global_leaderboard TO rallix_service
