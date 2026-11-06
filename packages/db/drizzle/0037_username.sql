-- Optional sign-in name. Accounts are still created by the emailed code; a username and password are added later by the person.
-- Private like email and phone: the app role has no column grant on it, only the service role (sign-in) reads it.
ALTER TABLE "users" ADD COLUMN "username" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "display_username" text;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_username_unique" UNIQUE("username");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_username_shape" CHECK ("username" IS NULL OR "username" ~ '^[a-z0-9_]{3,20}$')
