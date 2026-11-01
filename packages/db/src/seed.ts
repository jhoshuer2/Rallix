import { sql } from "drizzle-orm";
import { fileURLToPath } from "node:url";
import { makeDb, urls, type Db } from "./client";
import * as s from "./schema";

/** Dev seed: the sample data from apps/club/lib/mock.ts. Runs as rallix_service (bypasses RLS). */
export async function seed(db: Db) {
  const names = ["Jide Taiwo", "Pastor", "Sule", "Nurudeen", "Dorathy", "Nathaniel", "Ade"];
  const levels = ["senior", "senior", "senior", "intermediate", "intermediate", "junior", "junior"] as const;
  await db.insert(s.users).values([
    { id: "u_admin", name: "Innocent Amos", email: "admin@example.com", phoneNumber: "+2348030000100", phoneNumberVerified: true },
    ...names.map((n, i) => ({ id: `u_${i}`, name: n, phoneNumber: `+234803000000${i}`, phoneNumberVerified: true })),
  ]).onConflictDoNothing();

  const [paris] = await db.insert(s.clubs).values({ slug: "paris-arena", name: "Paris Arena", location: "Abuja", ownerId: "u_admin" }).onConflictDoNothing().returning();
  const [lagos] = await db.insert(s.clubs).values({ slug: "lagos-spin", name: "Lagos Spin Club", location: "Lagos", ownerId: "u_6" }).onConflictDoNothing().returning();
  if (!paris || !lagos) { console.log("seed already applied"); return; }

  const adminM = await db.insert(s.memberships).values({ clubId: paris.id, userId: "u_admin", roles: ["admin", "scorer"] }).returning();
  const members = await db.insert(s.memberships).values(names.map((_, i) => ({ clubId: paris.id, userId: `u_${i}` }))).returning();
  await db.insert(s.memberships).values({ clubId: lagos.id, userId: "u_6", roles: ["admin", "player"] });
  await db.insert(s.playerProfiles).values([
    { membershipId: adminM[0]!.id, clubId: paris.id },
    ...members.map((m, i) => ({ membershipId: m.id, clubId: paris.id, level: levels[i]!, heightCm: 178, dateOfBirth: "1991-04-12", photoUrl: `/players/${names[i]!.split(" ")[0]!.toLowerCase()}.png` })),
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
  const at = (i: number) => members[i]!;
  const jide = at(0), pastor = at(1), sule = at(2), nurudeen = at(3), dorathy = at(4), ade = at(6);
  const result = async (p1: string, p2: string, winner: string, day: string, g: Array<[number, number]>, round = "Group A") => {
    const g1 = g.filter(([a, b]) => a > b).length, g2 = g.length - g1;
    const [mt] = await db.insert(s.matches).values({ clubId: paris.id, competitionId: comp!.id, round, player1Id: p1, player2Id: p2, status: "completed", winnerId: winner, gamesP1: g1, gamesP2: g2, scorerId: adminM[0]!.id, confirmedAt: new Date(`${day}T16:00:00Z`) }).returning();
    await db.insert(s.games).values(g.map(([a, b], i) => ({ clubId: paris.id, matchId: mt!.id, gameNo: i + 1, p1Points: a, p2Points: b })));
  };
  await result(ade.id, dorathy.id, dorathy.id, "2026-10-03", [[11, 9], [9, 11], [11, 8], [7, 11], [8, 11]]);
  await result(ade.id, jide.id, jide.id, "2026-10-10", [[5, 11], [7, 11], [9, 11]]);
  await result(ade.id, nurudeen.id, ade.id, "2026-10-21", [[11, 9], [8, 11], [11, 7], [9, 11], [11, 8]]);
  await result(ade.id, sule.id, ade.id, "2026-10-28", [[11, 7], [9, 11], [11, 8], [11, 6]]);
  await result(jide.id, pastor.id, jide.id, "2026-10-29", [[11, 6], [11, 8], [11, 9]]);
  await db.insert(s.matches).values({ clubId: paris.id, competitionId: comp!.id, round: "Group A", player1Id: ade.id, player2Id: pastor.id, status: "scheduled", scheduledAt: new Date("2026-11-07T15:00:00Z") });
  const paidAt = (d: string) => new Date(`${d}T10:00:00Z`);
  await db.insert(s.payments).values([
    { clubId: paris.id, membershipId: ade.id, amountKobo: 600000, status: "paid", providerRef: "seed-1", method: "card", paidAt: paidAt("2026-10-28") },
    { clubId: paris.id, membershipId: ade.id, amountKobo: 600000, status: "paid", providerRef: "seed-2", method: "card", paidAt: paidAt("2026-09-28") },
    { clubId: paris.id, membershipId: jide.id, amountKobo: 600000, status: "paid", providerRef: "seed-3", method: "transfer", paidAt: paidAt("2026-10-30") },
    { clubId: paris.id, membershipId: pastor.id, amountKobo: 600000, status: "paid", providerRef: "seed-4", method: "card", paidAt: new Date() },
  ]);
  await db.insert(s.ratings).values(members.map((m, i) => ({ clubId: paris.id, membershipId: m.id, scope: "club" as const, rating: 1300 - i * 25 })));
  await db.insert(s.invites).values({ clubId: paris.id, code: "AB12CD", createdBy: adminM[0]!.id });
  await db.insert(s.globalRatings).values(names.map((_, i) => ({ userId: `u_${i}`, rating: 1300 - i * 25 }))).onConflictDoNothing();

  // ----- Platform console data -----
  await db.insert(s.users).values({ id: "u_platform", name: "Platform Owner", email: "owner@rallix.app", phoneNumber: "+2348030000200", phoneNumberVerified: true }).onConflictDoNothing();
  await db.insert(s.platformAdmins).values({ userId: "u_platform" }).onConflictDoNothing();
  await db.insert(s.clubSubscriptions).values([
    { clubId: paris.id, period: "monthly", status: "active", amountKobo: 2000000, currentPeriodEnd: new Date(Date.now() + 20 * 86400000) },
    { clubId: lagos.id, period: "monthly", status: "past_due", amountKobo: 2000000, currentPeriodEnd: new Date(Date.now() - 5 * 86400000) },
  ]);
  const inv = async (clubId: string, label: string, status: "issued" | "paid", paid = false) => {
    const n = ((await db.execute(sql`select app.next_invoice_number() as n`)).rows[0] as { n: string }).n;
    await db.insert(s.platformInvoices).values({ clubId, number: n, status, amountKobo: 2000000, periodLabel: label, description: `Rallix monthly subscription, ${label}`, issuedAt: new Date(Date.now() - 20 * 86400000), dueAt: new Date(Date.now() - 6 * 86400000), paidAt: paid ? new Date(Date.now() - 18 * 86400000) : null, paymentRef: paid ? "TRF-884210" : null, payToken: status === "issued" ? `SeedToken${clubId.replace(/-/g, "").slice(0, 15)}` : null });
  };
  await inv(paris.id, "2026-10", "paid", true);
  await inv(lagos.id, "2026-10", "issued");
  await db.insert(s.issues).values([
    { title: "Score sheet freezes after the 5th game", body: "Reported by a scorer at Paris Arena on a low-end Android phone.", severity: "high", status: "investigating", clubId: paris.id, reportedBy: "u_admin", assignedTo: "u_platform" },
    { title: "Club asked to change their subdomain", severity: "low", status: "open", clubId: lagos.id },
  ]);
  console.log("seeded Paris Arena (7 players), Lagos Spin Club, platform admin +2348030000200");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const db = makeDb(urls.service(), 1);
  seed(db).then(() => db.pool.end(), (e) => { console.error(e); process.exit(1); });
}
