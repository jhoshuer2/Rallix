import { eq } from "drizzle-orm";
import { normalizePhone } from "@rallix/config/phone";
import { makeDb, urls } from "./client";
import { platformAdmins, users } from "./schema";

/**
 * Grant platform-console access. Usage: pnpm --filter @rallix/db make-platform-admin 08031234567 "Full Name"
 * Creates the account if it doesn't exist (phone marked verified: you are vouching for it by running this).
 */
async function main() {
  const [phoneArg, ...nameParts] = process.argv.slice(2);
  const phone = phoneArg ? normalizePhone(phoneArg) : null;
  if (!phone) { console.error("Usage: make-platform-admin <nigerian phone> [name]"); process.exit(1); }
  const db = makeDb(urls.service(), 1);
  try {
    let [u] = await db.select().from(users).where(eq(users.phoneNumber, phone));
    if (!u) {
      const name = nameParts.join(" ").trim() || "Platform admin";
      [u] = await db.insert(users).values({ id: crypto.randomUUID(), name, email: `${phone.slice(1)}@phone.rallix.app`, phoneNumber: phone, phoneNumberVerified: true }).returning();
      console.log(`created account for ${name}`);
    }
    await db.insert(platformAdmins).values({ userId: u!.id }).onConflictDoNothing();
    console.log(`${u!.name} (${phone}) can now sign in to the console`);
  } finally { await db.pool.end(); }
}
main().catch((e) => { console.error(e); process.exit(1); });
