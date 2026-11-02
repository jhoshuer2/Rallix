-- Arrival check-in: court location columns, arrivals table and push subscriptions.
-- Court location: members read it, admins change it (the clubs_update policy already limits UPDATE to the club's admins).
GRANT SELECT (venue_label, venue_lat, venue_lng, venue_radius_m) ON clubs TO rallix_app
--> statement-breakpoint
GRANT UPDATE (venue_label, venue_lat, venue_lng, venue_radius_m) ON clubs TO rallix_app
--> statement-breakpoint
ALTER TABLE arrivals ENABLE ROW LEVEL SECURITY
--> statement-breakpoint
-- Everyone in the club can see who is at the court. A player can only record and close their own arrival.
CREATE POLICY tenant_read ON arrivals FOR SELECT TO rallix_app USING (club_id = app.cid() AND app.is_member(club_id))
--> statement-breakpoint
CREATE POLICY self_insert ON arrivals FOR INSERT TO rallix_app WITH CHECK (club_id = app.cid() AND app.is_self(membership_id))
--> statement-breakpoint
CREATE POLICY self_update ON arrivals FOR UPDATE TO rallix_app USING (club_id = app.cid() AND app.is_self(membership_id)) WITH CHECK (club_id = app.cid() AND app.is_self(membership_id))
--> statement-breakpoint
-- Least privilege: the app role cannot backdate an arrival, reopen one, or write alerted_at (service role only).
GRANT SELECT ON arrivals TO rallix_app
--> statement-breakpoint
GRANT INSERT (club_id, membership_id, method) ON arrivals TO rallix_app
--> statement-breakpoint
GRANT UPDATE (left_at) ON arrivals TO rallix_app
--> statement-breakpoint
-- Push subscriptions hold secrets: service role only, no app-role grants.
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY
--> statement-breakpoint
GRANT ALL ON ALL TABLES IN SCHEMA public TO rallix_service
