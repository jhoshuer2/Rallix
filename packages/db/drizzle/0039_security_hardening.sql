-- From the Rounds 3 to 10 security review.
-- 1. The plan's member limit counts every seat a person can take: players, coaches and scorers. Before, an admin could add someone as a coach or scorer
--    (the invite role is free for a Members admin) and get a seat without using the limit. Admins who only run the club still do not count.
CREATE OR REPLACE FUNCTION app.active_players(p_club uuid) RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT count(*)::int FROM memberships WHERE club_id = p_club AND status = 'active' AND roles && ARRAY['player','coach','scorer']::member_role[]
$$
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app.enforce_member_limit() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_limit int;
BEGIN
  IF NEW.status <> 'active' OR NOT (NEW.roles && ARRAY['player','coach','scorer']::member_role[]) THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'active' AND OLD.roles && ARRAY['player','coach','scorer']::member_role[] THEN RETURN NEW; END IF; -- already counted
  PERFORM pg_advisory_xact_lock(hashtext(NEW.club_id::text));
  v_limit := app.club_member_limit(NEW.club_id);
  IF v_limit IS NOT NULL AND (SELECT count(*) FROM memberships WHERE club_id = NEW.club_id AND status = 'active' AND roles && ARRAY['player','coach','scorer']::member_role[] AND id <> NEW.id) >= v_limit THEN
    RAISE EXCEPTION 'club_full' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$
--> statement-breakpoint
-- 2. Any signed-in person could read any club's plan limit and seats used by guessing its id. The app never calls it (admins use my_club_plan()), so only the service role keeps it.
REVOKE EXECUTE ON FUNCTION app.club_room(uuid) FROM rallix_app
--> statement-breakpoint
-- 3. Two owners demoting or removing each other at the same moment could both pass the "another owner exists" check and leave none. One lock makes them take turns.
CREATE OR REPLACE FUNCTION public.keep_one_owner() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.role = 'owner' AND (TG_OP = 'DELETE' OR NEW.role <> 'owner') THEN
    PERFORM pg_advisory_xact_lock(hashtext('platform_admins_owner'));
    IF NOT EXISTS (SELECT 1 FROM platform_admins WHERE role = 'owner' AND user_id <> OLD.user_id) THEN
      RAISE EXCEPTION 'the last owner cannot be removed or demoted' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END $$
