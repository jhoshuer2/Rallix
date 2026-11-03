-- Club approval (new clubs can start "pending"), the plan catalogue, and a member limit enforced in the database.
ALTER TYPE "club_status" ADD VALUE IF NOT EXISTS 'pending'
--> statement-breakpoint
ALTER TABLE "platform_settings" ADD COLUMN "club_approval" boolean DEFAULT false NOT NULL
--> statement-breakpoint
CREATE TABLE "platform_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"monthly_kobo" integer NOT NULL,
	"yearly_kobo" integer NOT NULL,
	"member_limit" integer,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "platform_plans_name_unique" UNIQUE("name"),
	CONSTRAINT "platform_plans_name" CHECK (char_length("name") BETWEEN 1 AND 60),
	CONSTRAINT "platform_plans_prices" CHECK ("monthly_kobo" >= 0 AND "yearly_kobo" >= 0),
	CONSTRAINT "platform_plans_limit" CHECK ("member_limit" IS NULL OR "member_limit" BETWEEN 1 AND 100000)
)
--> statement-breakpoint
ALTER TABLE platform_plans ENABLE ROW LEVEL SECURITY
--> statement-breakpoint
GRANT ALL ON platform_plans TO rallix_service
--> statement-breakpoint
ALTER TABLE "club_subscriptions" ADD COLUMN "plan_id" uuid
--> statement-breakpoint
ALTER TABLE "club_subscriptions" ADD CONSTRAINT "club_subscriptions_plan_fk" FOREIGN KEY ("plan_id") REFERENCES "platform_plans"("id")
--> statement-breakpoint
ALTER TABLE "email_log" DROP CONSTRAINT "email_log_kind"
--> statement-breakpoint
ALTER TABLE "email_log" ADD CONSTRAINT "email_log_kind" CHECK ("kind" IN ('otp','invoice','reminder','broadcast','application','support','club_review'))
--> statement-breakpoint
-- A new club starts pending when the platform has approval switched on. Everything else is as before.
CREATE OR REPLACE FUNCTION app.create_club(p_name text, p_slug text, p_location text DEFAULT NULL) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_user text := app.uid(); v_club uuid; v_member uuid; v_status club_status;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'not authenticated' USING ERRCODE = '28000'; END IF;
  v_status := CASE WHEN coalesce((SELECT club_approval FROM platform_settings WHERE id = 1), false) THEN 'pending'::club_status ELSE 'active'::club_status END;
  INSERT INTO clubs (slug, name, location, owner_id, status) VALUES (p_slug, p_name, p_location, v_user, v_status) RETURNING id INTO v_club;
  INSERT INTO memberships (club_id, user_id, roles) VALUES (v_club, v_user, ARRAY['admin','player']::member_role[]) RETURNING id INTO v_member;
  INSERT INTO player_profiles (membership_id, club_id) VALUES (v_member, v_club);
  RETURN v_club;
END $$
--> statement-breakpoint
-- The member limit of the plan a club currently pays for, or NULL (no plan, or no limit).
CREATE FUNCTION app.club_member_limit(p_club uuid) RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT p.member_limit FROM club_subscriptions s JOIN platform_plans p ON p.id = s.plan_id
  WHERE s.club_id = p_club AND s.status IN ('trialing','active','past_due')
  ORDER BY s.created_at DESC LIMIT 1
$$
--> statement-breakpoint
CREATE FUNCTION app.active_players(p_club uuid) RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT count(*)::int FROM memberships WHERE club_id = p_club AND status = 'active' AND 'player' = ANY(roles)
$$
--> statement-breakpoint
-- One guard for every way in: invite, open join, approved application, console. A per-club advisory lock stops two people taking the last place.
CREATE FUNCTION app.enforce_member_limit() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_limit int;
BEGIN
  IF NEW.status <> 'active' OR NOT ('player' = ANY(NEW.roles)) THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'active' AND 'player' = ANY(OLD.roles) THEN RETURN NEW; END IF; -- already counted
  PERFORM pg_advisory_xact_lock(hashtext(NEW.club_id::text));
  v_limit := app.club_member_limit(NEW.club_id);
  IF v_limit IS NOT NULL AND (SELECT count(*) FROM memberships WHERE club_id = NEW.club_id AND status = 'active' AND 'player' = ANY(roles) AND id <> NEW.id) >= v_limit THEN
    RAISE EXCEPTION 'club_full' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$
--> statement-breakpoint
CREATE TRIGGER memberships_member_limit BEFORE INSERT OR UPDATE ON memberships FOR EACH ROW EXECUTE FUNCTION app.enforce_member_limit()
--> statement-breakpoint
-- What a club admin may see about their own plan: name, limit and how many places are used.
CREATE FUNCTION app.my_club_plan() RETURNS TABLE (plan_name text, member_limit integer, members integer) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT p.name, p.member_limit, app.active_players(app.cid())
  FROM club_subscriptions s JOIN platform_plans p ON p.id = s.plan_id
  WHERE s.club_id = app.cid() AND app.has_role(app.cid(), 'admin') AND s.status IN ('trialing','active','past_due')
  ORDER BY s.created_at DESC LIMIT 1
$$
--> statement-breakpoint
-- Friendly check used before joining: how many places are left (NULL = no limit).
CREATE FUNCTION app.club_room(p_club uuid) RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT CASE WHEN app.club_member_limit(p_club) IS NULL THEN NULL ELSE greatest(0, app.club_member_limit(p_club) - app.active_players(p_club)) END
$$
--> statement-breakpoint
REVOKE ALL ON FUNCTION app.club_member_limit(uuid), app.active_players(uuid), app.enforce_member_limit(), app.my_club_plan(), app.club_room(uuid) FROM PUBLIC
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app.my_club_plan(), app.club_room(uuid) TO rallix_app
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app.club_member_limit(uuid), app.active_players(uuid), app.club_room(uuid) TO rallix_service
