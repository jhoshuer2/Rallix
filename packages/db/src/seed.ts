import { sql } from "drizzle-orm";
import { fileURLToPath } from "node:url";
import { makeDb, urls, type Db } from "./client";
import * as s from "./schema";

/** Dev seed: the sample data from apps/club/lib/mock.ts. Runs as rallix_service (bypasses RLS). */
export async function seed(db: Db) {
  const names = ["Jide Taiwo", "Pastor", "Sule", "Nurudeen", "Dorathy", "Nathaniel", "Ade"];
  const levels = ["senior", "senior", "senior", "intermediate", "intermediate", "junior", "junior"] as const;
  await db.insert(s.users).values([
    { id: "u_admin", name: "Innocent Amos", email: "admin@example.com" },
    ...names.map((n, i) => ({ id: `u_${i}`, name: n, phoneNumber: `+23480300000${i}` })),
  ]).onConflictDoNothing();

  const [paris] = await db.insert(s.clubs).values({ slug: "paris-arena", name: "Paris Arena", location: "Abuja", ownerId: "u_admin" }).onConflictDoNothing().returning();
  const [lagos] = await db.insert(s.clubs).values({ slug: "lagos-spin", name: "Lagos Spin Club", location: "Lagos", ownerId: "u_6" }).onConflictDoNothing().returning();
  if (!paris || !lagos) { console.log("seed already applied"); return; }

  const adminM = await db.insert(s.memberships).values({ clubId: paris.id, userId: "u_admin", roles: ["admin", "scorer"] }).returning();
  const members = await db.insert(s.memberships).values(names.map((_, i) => ({ clubId: paris.id, userId: `u_${i}` }))).returning();
  await db.insert(s.memberships).values({ clubId: lagos.id, userId: "u_6", roles: ["admin", "player"] });
  await db.insert(s.playerProfiles).values([
    { membershipId: adminM[0]!.id, clubId: paris.id },
    ...members.map((m, i) => ({ membershipId: m.id, clubId: paris.id, level: levels[i]!, heightCm: 178 })),
  ]);

  const [monthly, pro, yearly] = await db.insert(s.plans).values([
    { clubId: paris.id, name: "Monthly", priceKobo: 600000, period: "monthly", perks: ["unlimited open play", "competition entry"] },
    { clubId: paris.id, name: "Monthly with Pro", priceKobo: 1000000, period: "monthly", perks: ["unlimited open play", "competition entry"] },
    { clubId: paris.id, name: "Yearly", priceKobo: 6000000, period: "yearly", perks: ["unlimited open play", "competition entry", "2 months free"], active: false },
  ]).returning();
  void pro; void yearly;
  const statuses = ["paid", "paid", "due", "overdue", "paid", "due", "due"] as const;
  await db.insert(s.dues).values(members.map((m, i) => ({
    clubId: paris.id, membershipId: m.id, planId: monthly!.id, amountKobo: 600000, periodLabel: "2026-11", dueDate: "2026-11-28", status: statuses[i]!,
  })));

  const [comp] = await db.insert(s.competitions).values({ clubId: paris.id, name: "Paris Arena Group Stage", level: "junior", format: "group_stage", status: "active", startsOn: "2026-08-28", endsOn: "2026-10-16" }).returning();
  await db.insert(s.competitionEntries).values(members.map((m, i) => ({ clubId: paris.id, competitionId: comp!.id, membershipId: m.id, seed: i + 1 })));
  const ade = members[6]!, sule = members[2]!, pastor = members[1]!;
  const [m1] = await db.insert(s.matches).values({ clubId: paris.id, competitionId: comp!.id, round: "Group A", player1Id: ade.id, player2Id: sule.id, status: "completed", winnerId: ade.id, gamesP1: 3, gamesP2: 1, scorerId: adminM[0]!.id, confirmedAt: sql`now()` as never }).returning();
  await db.insert(s.games).values([[11, 7], [9, 11], [11, 8], [11, 6]].map(([a, b], i) => ({ clubId: paris.id, matchId: m1!.id, gameNo: i + 1, p1Points: a!, p2Points: b! })));
  await db.insert(s.matches).values({ clubId: paris.id, competitionId: comp!.id, round: "Group A", player1Id: ade.id, player2Id: pastor.id, status: "scheduled", scheduledAt: new Date("2026-11-07T15:00:00Z") });
  await db.insert(s.ratings).values(members.map((m, i) => ({ clubId: paris.id, membershipId: m.id, scope: "club" as const, rating: 1300 - i * 25 })));
  await db.insert(s.invites).values({ clubId: paris.id, code: "AB12CD", createdBy: adminM[0]!.id });
  await db.insert(s.globalRatings).values(names.map((_, i) => ({ userId: `u_${i}`, rating: 1300 - i * 25 }))).onConflictDoNothing();
  console.log("seeded Paris Arena (7 players), Lagos Spin Club");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const db = makeDb(urls.service(), 1);
  seed(db).then(() => db.pool.end(), (e) => { console.error(e); process.exit(1); });
}
