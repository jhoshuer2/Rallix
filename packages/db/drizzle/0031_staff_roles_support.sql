-- Staff roles for the console, and a support inbox fed by club members.
ALTER TABLE "platform_admins" ADD COLUMN "role" text DEFAULT 'owner' NOT NULL
--> statement-breakpoint
-- Everyone who is staff today keeps full access; new staff start with the least (support) until an owner chooses.
ALTER TABLE "platform_admins" ALTER COLUMN "role" SET DEFAULT 'support'
--> statement-breakpoint
ALTER TABLE "platform_admins" ADD CONSTRAINT "platform_admins_role" CHECK ("role" IN ('owner','admin','finance','support'))
--> statement-breakpoint
CREATE FUNCTION public.keep_one_owner() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.role = 'owner' AND (TG_OP = 'DELETE' OR NEW.role <> 'owner')
     AND NOT EXISTS (SELECT 1 FROM platform_admins WHERE role = 'owner' AND user_id <> OLD.user_id) THEN
    RAISE EXCEPTION 'the last owner cannot be removed or demoted' USING ERRCODE = '23514';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END $$
--> statement-breakpoint
CREATE TRIGGER platform_admins_keep_one_owner BEFORE UPDATE OR DELETE ON platform_admins FOR EACH ROW EXECUTE FUNCTION public.keep_one_owner()
--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "source" text DEFAULT 'staff' NOT NULL
--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_source" CHECK ("source" IN ('staff','club'))
--> statement-breakpoint
ALTER TABLE "issue_notes" ADD COLUMN "emailed_at" timestamp with time zone
--> statement-breakpoint
ALTER TABLE "email_log" DROP CONSTRAINT "email_log_kind"
--> statement-breakpoint
ALTER TABLE "email_log" ADD CONSTRAINT "email_log_kind" CHECK ("kind" IN ('otp','invoice','reminder','broadcast','application','support'))
--> statement-breakpoint
-- A club member sends a request. The club and the reporter are filled in here, never taken from the caller; five a day each.
CREATE FUNCTION app.report_issue(p_title text, p_body text) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_club uuid := app.cid();
  v_user text := app.uid();
  v_title text := btrim(coalesce(p_title, ''));
  v_body text := btrim(coalesce(p_body, ''));
BEGIN
  IF v_user IS NULL OR v_club IS NULL THEN RAISE EXCEPTION 'not authenticated' USING ERRCODE = '28000'; END IF;
  IF NOT app.is_member(v_club) THEN RETURN 'denied'; END IF;
  IF char_length(v_title) < 3 OR char_length(v_title) > 120 OR char_length(v_body) > 2000 THEN RETURN 'invalid'; END IF;
  IF (SELECT count(*) FROM issues WHERE reported_by = v_user AND source = 'club' AND created_at > now() - interval '1 day') >= 5 THEN RETURN 'limit'; END IF;
  INSERT INTO issues (title, body, severity, club_id, reported_by, source) VALUES (v_title, nullif(v_body, ''), 'normal', v_club, v_user, 'club');
  RETURN 'sent';
END $$
--> statement-breakpoint
-- The reporter's own requests in the active club, newest first. Nothing else about an issue (notes, assignee) is exposed.
CREATE FUNCTION app.my_issues() RETURNS TABLE (id uuid, title text, status issue_status, created_at timestamptz) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT i.id, i.title, i.status, i.created_at FROM issues i
  WHERE i.reported_by = app.uid() AND i.source = 'club' AND i.club_id = app.cid() AND app.is_member(i.club_id)
  ORDER BY i.created_at DESC LIMIT 20
$$
--> statement-breakpoint
REVOKE ALL ON FUNCTION app.report_issue(text, text), app.my_issues() FROM PUBLIC
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app.report_issue(text, text), app.my_issues() TO rallix_app
