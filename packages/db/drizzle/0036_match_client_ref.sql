-- Offline scoring: the scorer's phone makes a random reference for each result. If a send lands but the reply is lost, the retry carries
-- the same reference, so the server knows it is the same result (success) and not someone else's (conflict).
ALTER TABLE "matches" ADD COLUMN "client_ref" text;--> statement-breakpoint
CREATE UNIQUE INDEX "matches_client_ref_uq" ON "matches" USING btree ("client_ref") WHERE "matches"."client_ref" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_client_ref_len" CHECK ("client_ref" IS NULL OR char_length("client_ref") BETWEEN 8 AND 64)
