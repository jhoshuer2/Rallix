-- Valid reminder days: 1 to 6 whole numbers between -14 and 30, no duplicates.
CREATE FUNCTION app.valid_offsets(o integer[]) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT o IS NOT NULL AND cardinality(o) BETWEEN 1 AND 6 AND NOT EXISTS (SELECT 1 FROM unnest(o) AS v WHERE v IS NULL OR v < -14 OR v > 30)
         AND (SELECT count(DISTINCT v) FROM unnest(o) AS v) = cardinality(o)
$$
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app.valid_offsets(integer[]) TO rallix_app, rallix_service
--> statement-breakpoint
ALTER TABLE reminder_settings ADD CONSTRAINT reminder_settings_offsets_valid CHECK (app.valid_offsets(offsets))
--> statement-breakpoint
ALTER TABLE reminder_settings ENABLE ROW LEVEL SECURITY
--> statement-breakpoint
ALTER TABLE reminder_log ENABLE ROW LEVEL SECURITY
--> statement-breakpoint
-- Only a club's admins can see or change that club's reminder settings.
CREATE POLICY admin_all ON reminder_settings FOR ALL TO rallix_app USING (club_id = app.cid() AND app.has_role(club_id, 'admin')) WITH CHECK (club_id = app.cid() AND app.has_role(club_id, 'admin'))
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON reminder_settings TO rallix_app
--> statement-breakpoint
GRANT ALL ON ALL TABLES IN SCHEMA public TO rallix_service
--> statement-breakpoint
-- Better wording for the dues reminder, but ONLY if staff haven't already edited the original text.
UPDATE templates SET
  subject = 'Reminder: your {{club_name}} dues {{timing}}',
  body = 'Hi {{player_name}},' || E'\n\n' || 'This is a friendly reminder that your {{club_name}} dues of {{amount}} {{timing}} (due date: {{due_date}}).' || E'\n\n' || 'You can pay online in the Rallix app: {{pay_link}}' || E'\n\n' || 'If you have already paid your club, please ignore this message.',
  updated_at = now()
WHERE key = 'dues_reminder' AND body = 'Hi {{player_name}}, your {{club_name}} dues of {{amount}} are due on {{due_date}}.'
