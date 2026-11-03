-- Doors open time on sessions and events, and "I'm coming" (RSVPs).
ALTER TABLE "club_events" ADD COLUMN "doors_open" text
--> statement-breakpoint
ALTER TABLE "club_events" ADD CONSTRAINT "club_events_doors" CHECK ("doors_open" IS NULL OR ("doors_open" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' AND "start_time" IS NOT NULL AND "doors_open" <= "start_time"))
--> statement-breakpoint
ALTER TABLE "club_events" ADD CONSTRAINT "club_events_id_club_uq" UNIQUE ("id","club_id")
--> statement-breakpoint
CREATE TABLE "event_rsvps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"on_date" date NOT NULL,
	"membership_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_rsvps_uq" UNIQUE("event_id","on_date","membership_id")
)
--> statement-breakpoint
ALTER TABLE "event_rsvps" ADD CONSTRAINT "event_rsvps_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "clubs"("id") ON DELETE cascade
--> statement-breakpoint
ALTER TABLE "event_rsvps" ADD CONSTRAINT "rsvps_event_fk" FOREIGN KEY ("event_id","club_id") REFERENCES "club_events"("id","club_id") ON DELETE cascade
--> statement-breakpoint
ALTER TABLE "event_rsvps" ADD CONSTRAINT "rsvps_membership_fk" FOREIGN KEY ("membership_id","club_id") REFERENCES "memberships"("id","club_id") ON DELETE cascade
--> statement-breakpoint
CREATE INDEX "event_rsvps_day_idx" ON "event_rsvps" ("club_id","on_date")
--> statement-breakpoint
ALTER TABLE event_rsvps ENABLE ROW LEVEL SECURITY
--> statement-breakpoint
-- Private: you see your own; the Members admin sees everyone's. Nobody writes the table directly.
CREATE POLICY own_or_admin_read ON event_rsvps FOR SELECT TO rallix_app USING (club_id = app.cid() AND app.is_member(club_id) AND (app.is_self(membership_id) OR app.has_permission(club_id, 'members')))
--> statement-breakpoint
GRANT SELECT ON event_rsvps TO rallix_app
--> statement-breakpoint
GRANT ALL ON event_rsvps TO rallix_service
--> statement-breakpoint
-- Say you are coming to (or no longer coming to) one day of a session or event. The day must really be one of its days, not closed, and
-- from today up to 60 days ahead in the club's timezone.
CREATE FUNCTION app.rsvp(p_event uuid, p_date date, p_going boolean) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_e club_events%ROWTYPE;
  v_member uuid;
  v_today date;
  v_tz text;
  v_real boolean;
BEGIN
  IF app.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated' USING ERRCODE = '28000'; END IF;
  SELECT * INTO v_e FROM club_events WHERE id = p_event;
  IF NOT FOUND OR NOT app.is_member(v_e.club_id) OR v_e.kind = 'closed' THEN RETURN 'invalid'; END IF;
  v_member := app.my_membership(v_e.club_id);
  IF v_member IS NULL THEN RETURN 'invalid'; END IF;
  SELECT timezone INTO v_tz FROM clubs WHERE id = v_e.club_id;
  v_today := (now() AT TIME ZONE v_tz)::date;
  IF p_date IS NULL OR p_date < v_today OR p_date > v_today + 60 THEN RETURN 'past'; END IF;
  IF v_e.repeats_weekly THEN
    v_real := p_date >= v_e.starts_on AND (v_e.until IS NULL OR p_date <= v_e.until) AND extract(dow FROM p_date) = extract(dow FROM v_e.starts_on);
  ELSE
    v_real := p_date BETWEEN v_e.starts_on AND coalesce(v_e.ends_on, v_e.starts_on);
  END IF;
  IF NOT v_real THEN RETURN 'invalid'; END IF;
  IF EXISTS (SELECT 1 FROM club_events c WHERE c.club_id = v_e.club_id AND c.kind = 'closed' AND p_date BETWEEN c.starts_on AND coalesce(c.ends_on, c.starts_on)) THEN RETURN 'closed'; END IF;
  IF p_going THEN
    INSERT INTO event_rsvps (club_id, event_id, on_date, membership_id) VALUES (v_e.club_id, p_event, p_date, v_member) ON CONFLICT DO NOTHING;
    RETURN 'going';
  END IF;
  DELETE FROM event_rsvps WHERE event_id = p_event AND on_date = p_date AND membership_id = v_member;
  RETURN 'not_going';
END $$
--> statement-breakpoint
REVOKE ALL ON FUNCTION app.rsvp(uuid, date, boolean) FROM PUBLIC
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app.rsvp(uuid, date, boolean) TO rallix_app
