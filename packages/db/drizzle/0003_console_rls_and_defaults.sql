-- Console tables are service-role only: RLS on, no policy and no grant for rallix_app.
ALTER TABLE issues ENABLE ROW LEVEL SECURITY
--> statement-breakpoint
ALTER TABLE issue_notes ENABLE ROW LEVEL SECURITY
--> statement-breakpoint
ALTER TABLE templates ENABLE ROW LEVEL SECURITY
--> statement-breakpoint
ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY
--> statement-breakpoint
GRANT ALL ON issues, issue_notes, templates, platform_settings TO rallix_service
--> statement-breakpoint
GRANT ALL ON ALL TABLES IN SCHEMA public TO rallix_service
--> statement-breakpoint
CREATE TRIGGER touch BEFORE UPDATE ON issues FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at()
--> statement-breakpoint
-- A suspended or closed club is invisible to its members: no reads, no writes, no role checks pass.
CREATE OR REPLACE FUNCTION app.is_member(p_club uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM memberships m JOIN clubs c ON c.id = m.club_id
    WHERE m.club_id = p_club AND m.user_id = app.uid() AND m.status = 'active' AND c.status = 'active')
$$
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app.has_role(p_club uuid, VARIADIC p_roles member_role[]) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM memberships m JOIN clubs c ON c.id = m.club_id
    WHERE m.club_id = p_club AND m.user_id = app.uid() AND m.status = 'active' AND c.status = 'active' AND m.roles && p_roles)
$$
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app.is_self(p_membership uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM memberships m JOIN clubs c ON c.id = m.club_id
    WHERE m.id = p_membership AND m.user_id = app.uid() AND m.status = 'active' AND c.status = 'active')
$$
--> statement-breakpoint
-- The signed-in user's memberships whose club is suspended or closed (so the app can explain why a club is missing).
CREATE FUNCTION app.blocked_clubs() RETURNS TABLE (club_id uuid, name text, status club_status) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT c.id, c.name, c.status FROM memberships m JOIN clubs c ON c.id = m.club_id
  WHERE m.user_id = app.uid() AND m.status = 'active' AND c.status <> 'active'
$$
--> statement-breakpoint
REVOKE ALL ON FUNCTION app.blocked_clubs() FROM PUBLIC
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app.blocked_clubs() TO rallix_app
--> statement-breakpoint
-- Invoice numbers like RLX-2026-0007. Service role only; takes a row lock so numbers never repeat.
CREATE FUNCTION app.next_invoice_number() RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE s platform_settings%ROWTYPE;
BEGIN
  UPDATE platform_settings SET invoice_next = invoice_next + 1, updated_at = now() WHERE id = 1 RETURNING * INTO s;
  RETURN s.invoice_prefix || '-' || to_char(now(), 'YYYY') || '-' || lpad((s.invoice_next - 1)::text, 4, '0');
END $$
--> statement-breakpoint
REVOKE ALL ON FUNCTION app.next_invoice_number() FROM PUBLIC
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app.next_invoice_number() TO rallix_service
--> statement-breakpoint
-- Defaults the console needs to work on a fresh database.
INSERT INTO platform_settings (id, company_name, invoice_prefix, footer_note) VALUES (1, 'Rallix', 'RLX', 'Thank you for using Rallix.') ON CONFLICT (id) DO NOTHING
--> statement-breakpoint
INSERT INTO templates (key, kind, name, subject, body) VALUES
 ('invoice_issued', 'email', 'Invoice issued', 'Invoice {{invoice_number}} from {{company_name}}', 'Hello {{admin_name}},' || E'\n\n' || 'Your Rallix invoice {{invoice_number}} for {{club_name}} ({{period}}) is ready. Amount due: {{amount}} by {{due_date}}.' || E'\n\n' || '{{payment_instructions}}' || E'\n\n' || 'Thank you,' || E'\n' || '{{company_name}}'),
 ('subscription_past_due', 'email', 'Subscription past due', 'Action needed: {{club_name}} subscription is past due', 'Hello {{admin_name}},' || E'\n\n' || 'We have not received payment for {{club_name}} ({{period}}). Please pay {{amount}} to keep your club active.' || E'\n\n' || '{{company_name}}'),
 ('dues_reminder', 'sms', 'Dues reminder', NULL, 'Hi {{player_name}}, your {{club_name}} dues of {{amount}} are due on {{due_date}}.'),
 ('welcome_admin', 'email', 'Welcome to Rallix', 'Welcome to Rallix, {{admin_name}}', 'Welcome to Rallix! {{club_name}} is set up. Share your invite link in your WhatsApp group so players can join.')
ON CONFLICT (key) DO NOTHING
