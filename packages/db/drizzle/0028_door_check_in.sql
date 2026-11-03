-- Door check-in: the admin who looks after members lets someone in (by card scan or by picking them).
ALTER TABLE arrivals DROP CONSTRAINT arrivals_method
--> statement-breakpoint
ALTER TABLE arrivals ADD CONSTRAINT arrivals_method CHECK (method IN ('manual','auto','door'))
--> statement-breakpoint
-- A player's own tap is never recorded as a door check-in.
DROP POLICY self_insert ON arrivals
--> statement-breakpoint
CREATE POLICY self_insert ON arrivals FOR INSERT TO rallix_app WITH CHECK (club_id = app.cid() AND app.is_self(membership_id) AND method <> 'door')
--> statement-breakpoint
CREATE FUNCTION app.door_check_in(p_member uuid) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_club uuid;
BEGIN
  IF app.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated' USING ERRCODE = '28000'; END IF;
  SELECT club_id INTO v_club FROM memberships WHERE id = p_member AND status = 'active' AND 'player' = ANY(roles);
  IF v_club IS NULL THEN RETURN 'unknown'; END IF;
  IF NOT app.has_permission(v_club, 'members') THEN RETURN 'denied'; END IF;
  -- An open arrival from long ago (never checked out) must not block today.
  UPDATE arrivals SET left_at = arrived_at + interval '6 hours' WHERE membership_id = p_member AND left_at IS NULL AND arrived_at < now() - interval '6 hours';
  IF EXISTS (SELECT 1 FROM arrivals WHERE membership_id = p_member AND left_at IS NULL) THEN RETURN 'already'; END IF;
  INSERT INTO arrivals (club_id, membership_id, method) VALUES (v_club, p_member, 'door');
  RETURN 'in';
END $$
--> statement-breakpoint
CREATE FUNCTION app.door_check_out(p_member uuid) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_club uuid;
  v_n int;
BEGIN
  IF app.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated' USING ERRCODE = '28000'; END IF;
  SELECT club_id INTO v_club FROM memberships WHERE id = p_member;
  IF v_club IS NULL THEN RETURN 'unknown'; END IF;
  IF NOT app.has_permission(v_club, 'members') THEN RETURN 'denied'; END IF;
  UPDATE arrivals SET left_at = now() WHERE membership_id = p_member AND left_at IS NULL;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN CASE WHEN v_n > 0 THEN 'out' ELSE 'none' END;
END $$
--> statement-breakpoint
REVOKE ALL ON FUNCTION app.door_check_in(uuid), app.door_check_out(uuid) FROM PUBLIC
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app.door_check_in(uuid), app.door_check_out(uuid) TO rallix_app
