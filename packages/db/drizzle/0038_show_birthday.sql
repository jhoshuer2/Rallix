-- Birthdays are shown to the club by default; each person can switch it off. Only month and day are ever shown (never an age).
ALTER TABLE "player_profiles" ADD COLUMN "show_birthday" boolean DEFAULT true NOT NULL
