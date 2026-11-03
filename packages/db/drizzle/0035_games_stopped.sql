-- A game the umpire ended early (time, injury, a dispute). Whoever led won it; the score is kept as it stood.
ALTER TABLE "games" ADD COLUMN "stopped" boolean DEFAULT false NOT NULL
