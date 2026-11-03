import { eq } from "drizzle-orm";
import { makeDb, urls } from "./client";
import { platformAdmins, users } from "./schema";

/**
 * Grant platform-console access. Usage: pnpm --filter @rallix/db make-platform-admin you@example.com "Full Name"
 * Creates the account if it doesn't exist (email marked verified: you are vouching for it by running this).
 * They become an OWNER (full access, including the team page). Owners then add everyone else with a narrower role in the console.
 * They sign in to the console with an emailed code.
 */
async function main() {
  const [emailArg, ...nameParts] = process.argv.slice(2);
  const email = (emailArg ?? "").trim().toLowerCase();
  if (!/^[^\s@,;<>]{1,64}@[^\s@,;<>]{1,190}\.[^\s@,;<>]{2,}$/.test(email)) { console.error("Usage: make-platform-admin <email address> [name]"); process.exit(1); }
  const db = makeDb(urls.service(), 1);
  try {
    let [u] = await db.select().from(users).where(eq(users.email, email));
    if (!u) {
      const name = nameParts.join(" ").trim() || "Platform admin";
      [u] = await db.insert(users).values({ id: crypto.randomUUID(), name, email, emailVerified: true }).returning();
      console.log(`created account for ${name}`);
    }
    await db.insert(platformAdmins).values({ userId: u!.id, role: "owner" }).onConflictDoUpdate({ target: platformAdmins.userId, set: { role: "owner" } });
    console.log(`${u!.name} (${email}) is now a platform OWNER and can sign in to the console with an emailed code`);
  } finally { await db.pool.end(); }
}
main().catch((e) => { console.error(e); process.exit(1); });
