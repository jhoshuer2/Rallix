-- Facilities: what the club owns, and an append-only upkeep log.
CREATE TABLE "facility_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"name" text NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"min_quantity" integer,
	"status" text DEFAULT 'ok' NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "facility_items_id_club_uq" UNIQUE("id","club_id"),
	CONSTRAINT "facility_items_kind" CHECK ("kind" IN ('table','bat','ball','net','other')),
	CONSTRAINT "facility_items_name" CHECK (char_length("name") BETWEEN 1 AND 80),
	CONSTRAINT "facility_items_quantity" CHECK ("quantity" BETWEEN 0 AND 100000 AND ("min_quantity" IS NULL OR "min_quantity" BETWEEN 0 AND 100000)),
	CONSTRAINT "facility_items_status" CHECK ("status" IN ('ok','needs_attention','out')),
	CONSTRAINT "facility_items_note" CHECK ("note" IS NULL OR char_length("note") <= 280)
)
--> statement-breakpoint
CREATE TABLE "facility_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"note" text,
	"delta" integer,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "facility_log_kind" CHECK ("kind" IN ('maintenance','stock','note')),
	CONSTRAINT "facility_log_note" CHECK ("note" IS NULL OR char_length("note") <= 280)
)
--> statement-breakpoint
ALTER TABLE "facility_items" ADD CONSTRAINT "facility_items_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "clubs"("id") ON DELETE cascade
--> statement-breakpoint
ALTER TABLE "facility_log" ADD CONSTRAINT "facility_log_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "clubs"("id") ON DELETE cascade
--> statement-breakpoint
ALTER TABLE "facility_log" ADD CONSTRAINT "facility_log_item_fk" FOREIGN KEY ("item_id","club_id") REFERENCES "facility_items"("id","club_id") ON DELETE cascade
--> statement-breakpoint
ALTER TABLE "facility_log" ADD CONSTRAINT "facility_log_by_fk" FOREIGN KEY ("created_by","club_id") REFERENCES "memberships"("id","club_id")
--> statement-breakpoint
CREATE INDEX "facility_items_club_idx" ON "facility_items" ("club_id","kind")
--> statement-breakpoint
CREATE INDEX "facility_log_item_idx" ON "facility_log" ("item_id","created_at")
--> statement-breakpoint
ALTER TABLE facility_items ENABLE ROW LEVEL SECURITY
--> statement-breakpoint
ALTER TABLE facility_log ENABLE ROW LEVEL SECURITY
--> statement-breakpoint
-- Only the Facilities admin (or the owner) reads or writes either table.
CREATE POLICY facilities_all ON facility_items FOR ALL TO rallix_app USING (club_id = app.cid() AND app.has_permission(club_id, 'facilities')) WITH CHECK (club_id = app.cid() AND app.has_permission(club_id, 'facilities'))
--> statement-breakpoint
CREATE POLICY facilities_read ON facility_log FOR SELECT TO rallix_app USING (club_id = app.cid() AND app.has_permission(club_id, 'facilities'))
--> statement-breakpoint
-- The log is append-only: inserts record the admin's own identity; nobody updates or deletes a line.
CREATE POLICY facilities_insert ON facility_log FOR INSERT TO rallix_app WITH CHECK (club_id = app.cid() AND app.has_permission(club_id, 'facilities') AND (created_by IS NULL OR app.is_self(created_by)))
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON facility_items TO rallix_app
--> statement-breakpoint
GRANT SELECT, INSERT ON facility_log TO rallix_app
--> statement-breakpoint
GRANT ALL ON facility_items, facility_log TO rallix_service
--> statement-breakpoint
-- Change a stock count and write its log line in one step; never below zero.
CREATE FUNCTION app.adjust_stock(p_item uuid, p_delta int, p_note text) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_i facility_items%ROWTYPE;
  v_me uuid;
BEGIN
  IF app.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated' USING ERRCODE = '28000'; END IF;
  SELECT * INTO v_i FROM facility_items WHERE id = p_item FOR UPDATE;
  IF NOT FOUND THEN RETURN 'unknown'; END IF;
  IF NOT app.has_permission(v_i.club_id, 'facilities') THEN RETURN 'denied'; END IF;
  IF p_delta IS NULL OR p_delta = 0 OR abs(p_delta) > 100000 THEN RETURN 'invalid'; END IF;
  IF v_i.quantity + p_delta < 0 THEN RETURN 'negative'; END IF;
  IF v_i.quantity + p_delta > 100000 THEN RETURN 'invalid'; END IF;
  IF p_note IS NOT NULL AND char_length(p_note) > 280 THEN RETURN 'invalid'; END IF;
  v_me := app.my_membership(v_i.club_id);
  UPDATE facility_items SET quantity = quantity + p_delta, updated_at = now() WHERE id = p_item;
  INSERT INTO facility_log (club_id, item_id, kind, note, delta, created_by) VALUES (v_i.club_id, p_item, 'stock', nullif(btrim(p_note), ''), p_delta, v_me);
  RETURN 'ok';
END $$
--> statement-breakpoint
REVOKE ALL ON FUNCTION app.adjust_stock(uuid, int, text) FROM PUBLIC
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app.adjust_stock(uuid, int, text) TO rallix_app
