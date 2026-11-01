import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { makeDb, urls, withTenant, type Db } from "../src";
import * as s from "../src/schema";

let svc: Db, app: Db;
const ids = {} as {
  A: string; B: string; planA: string; compA: string; compB: string; matchA: string;
  mAdminA: string; mP1: string; mP2: string; mMultiA: string; mAdminB: string; mMultiB: string;
};

/** Run a query that must be rejected, returning the Postgres error code. */
async function denied(p: Promise<unknown>): Promise<string> {
  try { await p; } catch (e) { return (e as { cause?: { code?: string }; code?: string }).cause?.code ?? (e as { code?: string }).code ?? "unknown"; }
  throw new Error("expected the query to be denied but it succeeded");
}
const rows = async (db: Db, ctx: { userId: string; clubId?: string }, q: ReturnType<typeof sql>) =>
  (await withTenant(db, ctx, (tx) => tx.execute(q))).rows as Array<Record<string, unknown>>;

beforeAll(async () => {
  svc = makeDb(urls.service(), 2);
  app = makeDb(urls.app(), 4);
  await svc.insert(s.users).values([
    { id: "adminA", name: "Admin A", email: "a@x.com", phoneNumber: "+2340000001" },
    { id: "scorerA", name: "Scorer A", email: "sa@x.com" },
    { id: "playerA1", name: "Player A1", email: "p1@x.com" },
    { id: "playerA2", name: "Player A2", email: "p2@x.com" },
    { id: "adminB", name: "Admin B", email: "b@x.com" },
    { id: "multi", name: "Multi", email: "m@x.com" },
    { id: "stranger", name: "Stranger", email: "st@x.com" },
  ]);
  const [A, B] = await svc.insert(s.clubs).values([
    { slug: "club-a", name: "Club A", ownerId: "adminA" }, { slug: "club-b", name: "Club B", ownerId: "adminB" },
  ]).returning();
  ids.A = A!.id; ids.B = B!.id;
  const ma = await svc.insert(s.memberships).values([
    { clubId: A!.id, userId: "adminA", roles: ["admin"] }, { clubId: A!.id, userId: "scorerA", roles: ["scorer"] },
    { clubId: A!.id, userId: "playerA1" }, { clubId: A!.id, userId: "playerA2" }, { clubId: A!.id, userId: "multi" },
  ]).returning();
  const mb = await svc.insert(s.memberships).values([
    { clubId: B!.id, userId: "adminB", roles: ["admin"] }, { clubId: B!.id, userId: "multi" },
  ]).returning();
  const byUser = (arr: typeof ma, u: string) => arr.find((m) => m.userId === u)!.id;
  Object.assign(ids, { mAdminA: byUser(ma, "adminA"), mP1: byUser(ma, "playerA1"), mP2: byUser(ma, "playerA2"), mMultiA: byUser(ma, "multi"), mAdminB: byUser(mb, "adminB"), mMultiB: byUser(mb, "multi") });
  const [pl] = await svc.insert(s.plans).values([{ clubId: A!.id, name: "Monthly", priceKobo: 600000, period: "monthly" }, { clubId: B!.id, name: "B plan", priceKobo: 100, period: "monthly" }]).returning();
  ids.planA = pl!.id;
  const [cA, cB] = await svc.insert(s.competitions).values([
    { clubId: A!.id, name: "A Cup", format: "group_stage" }, { clubId: B!.id, name: "B Cup", format: "knockout" },
  ]).returning();
  ids.compA = cA!.id; ids.compB = cB!.id;
  const [mt] = await svc.insert(s.matches).values({ clubId: A!.id, competitionId: cA!.id, round: "R1", player1Id: ids.mP1, player2Id: ids.mP2 }).returning();
  ids.matchA = mt!.id;
  await svc.insert(s.matches).values({ clubId: B!.id, competitionId: cB!.id, round: "R1", player1Id: ids.mAdminB, player2Id: ids.mMultiB });
  await svc.insert(s.dues).values([
    { clubId: A!.id, membershipId: ids.mP1, planId: pl!.id, amountKobo: 600000, periodLabel: "2026-11", dueDate: "2026-11-28" },
    { clubId: A!.id, membershipId: ids.mP2, planId: pl!.id, amountKobo: 600000, periodLabel: "2026-11", dueDate: "2026-11-28" },
  ]);
  await svc.insert(s.invites).values([
    { clubId: A!.id, code: "GOOD", createdBy: ids.mAdminA },
    { clubId: A!.id, code: "EXPIRED", expiresAt: new Date(Date.now() - 1000) },
    { clubId: A!.id, code: "ONCE", maxUses: 1 },
  ]);
  await svc.insert(s.globalRatings).values({ userId: "playerA1", rating: 1250 });
});
afterAll(async () => { await svc.pool.end(); await app.pool.end(); });

describe("tenant isolation", () => {
  it("a member of club A sees only club A rows and nothing of club B", async () => {
    const own = await rows(app, { userId: "playerA1", clubId: ids.A }, sql`select name from competitions`);
    expect(own.map((r) => r.name)).toEqual(["A Cup"]);
    const other = await rows(app, { userId: "playerA1", clubId: ids.B }, sql`select name from competitions`);
    expect(other).toHaveLength(0); // claims club B but is not a member
    expect(await rows(app, { userId: "playerA1", clubId: ids.B }, sql`select id from matches`)).toHaveLength(0);
  });

  it("a user in two clubs sees each club's data only under that club's context", async () => {
    const a = await rows(app, { userId: "multi", clubId: ids.A }, sql`select name from competitions`);
    const b = await rows(app, { userId: "multi", clubId: ids.B }, sql`select name from competitions`);
    expect(a.map((r) => r.name)).toEqual(["A Cup"]);
    expect(b.map((r) => r.name)).toEqual(["B Cup"]);
    const clubs = await rows(app, { userId: "multi" }, sql`select name from clubs order by name`);
    expect(clubs.map((r) => r.name)).toEqual(["Club A", "Club B"]); // club switcher works with no club context
  });

  it("no context returns nothing", async () => {
    expect(await rows(app, { userId: "" }, sql`select id from competitions`)).toHaveLength(0);
    expect(await rows(app, { userId: "stranger" }, sql`select id from memberships`)).toHaveLength(0);
  });

  it("cannot write into another club, even with that club in context", async () => {
    expect(await denied(withTenant(app, { userId: "adminA", clubId: ids.B }, (tx) => tx.execute(sql`insert into competitions (club_id, name, format) values (${ids.B}, 'Hack', 'knockout')`)))).toBe("42501");
    const upd = await withTenant(app, { userId: "adminA", clubId: ids.B }, (tx) => tx.execute(sql`update competitions set name = 'Owned' where id = ${ids.compB}`));
    expect(upd.rowCount).toBe(0);
    expect(await denied(withTenant(app, { userId: "adminA", clubId: ids.A }, (tx) => tx.execute(sql`insert into competitions (club_id, name, format) values (${ids.B}, 'Hack', 'knockout')`)))).toBe("42501");
  });
});

describe("roles", () => {
  it("players cannot write scores or matches; scorers can score but not create matches; admins can do both", async () => {
    const setWin = sql`update matches set status = 'live' where id = ${ids.matchA}`;
    expect((await withTenant(app, { userId: "playerA1", clubId: ids.A }, (tx) => tx.execute(setWin))).rowCount).toBe(0);
    expect(await denied(withTenant(app, { userId: "playerA1", clubId: ids.A }, (tx) => tx.execute(sql`insert into games (club_id, match_id, game_no) values (${ids.A}, ${ids.matchA}, 1)`)))).toBe("42501");
    expect((await withTenant(app, { userId: "scorerA", clubId: ids.A }, (tx) => tx.execute(setWin))).rowCount).toBe(1);
    await withTenant(app, { userId: "scorerA", clubId: ids.A }, (tx) => tx.execute(sql`insert into games (club_id, match_id, game_no, p1_points, p2_points) values (${ids.A}, ${ids.matchA}, 1, 11, 7)`));
    expect(await denied(withTenant(app, { userId: "scorerA", clubId: ids.A }, (tx) => tx.execute(sql`insert into matches (club_id, competition_id, round) values (${ids.A}, ${ids.compA}, 'R2')`)))).toBe("42501");
    await withTenant(app, { userId: "adminA", clubId: ids.A }, (tx) => tx.execute(sql`insert into matches (club_id, competition_id, round) values (${ids.A}, ${ids.compA}, 'R2')`));
  });

  it("players cannot create competitions, plans or change roles", async () => {
    expect(await denied(withTenant(app, { userId: "playerA1", clubId: ids.A }, (tx) => tx.execute(sql`insert into competitions (club_id, name, format) values (${ids.A}, 'Mine', 'knockout')`)))).toBe("42501");
    expect((await withTenant(app, { userId: "playerA1", clubId: ids.A }, (tx) => tx.execute(sql`update memberships set roles = ARRAY['admin']::member_role[] where id = ${ids.mP1}`))).rowCount).toBe(0);
    expect(await denied(withTenant(app, { userId: "playerA1", clubId: ids.A }, (tx) => tx.execute(sql`insert into memberships (club_id, user_id) values (${ids.A}, 'stranger')`)))).toBe("42501");
    expect(await denied(withTenant(app, { userId: "adminA", clubId: ids.A }, (tx) => tx.execute(sql`insert into clubs (slug, name, owner_id) values ('direct', 'Direct', 'adminA')`)))).toBe("42501");
  });
});

describe("money privacy", () => {
  it("a player sees only their own dues; an admin sees all", async () => {
    const mine = await rows(app, { userId: "playerA1", clubId: ids.A }, sql`select membership_id from dues`);
    expect(mine.map((r) => r.membership_id)).toEqual([ids.mP1]);
    expect(await rows(app, { userId: "adminA", clubId: ids.A }, sql`select id from dues`)).toHaveLength(2);
  });

  it("a player may start a pending payment for themselves only", async () => {
    const ins = (member: string, status: string, ref: string) => sql`insert into payments (club_id, membership_id, amount_kobo, status, provider_ref) values (${ids.A}, ${member}, 600000, ${status}::payment_status, ${ref})`;
    await withTenant(app, { userId: "playerA1", clubId: ids.A }, (tx) => tx.execute(ins(ids.mP1, "pending", "ref-1")));
    expect(await denied(withTenant(app, { userId: "playerA1", clubId: ids.A }, (tx) => tx.execute(ins(ids.mP1, "paid", "ref-2"))))).toBe("42501");
    expect(await denied(withTenant(app, { userId: "playerA1", clubId: ids.A }, (tx) => tx.execute(ins(ids.mP2, "pending", "ref-3"))))).toBe("42501");
    expect(await denied(withTenant(app, { userId: "playerA1", clubId: ids.A }, (tx) => tx.execute(sql`update payments set status = 'paid' where provider_ref = 'ref-1'`)))).toBe("42501");
  });
});

describe("integrity", () => {
  it("composite foreign keys reject cross-club references", async () => {
    // match in club A pointing at a competition from club B
    expect(await denied(svc.execute(sql`insert into matches (club_id, competition_id, round) values (${ids.A}, ${ids.compB}, 'X')`))).toBe("23503");
    // match in club A with a player from club B
    expect(await denied(svc.execute(sql`insert into matches (club_id, competition_id, round, player1_id) values (${ids.A}, ${ids.compA}, 'X', ${ids.mAdminB})`))).toBe("23503");
    // game in club B pointing at a match from club A
    expect(await denied(svc.execute(sql`insert into games (club_id, match_id, game_no) values (${ids.B}, ${ids.matchA}, 9)`))).toBe("23503");
  });

  it("check constraints hold: distinct players, winner must be a player, odd best-of, slug format", async () => {
    expect(await denied(svc.execute(sql`insert into matches (club_id, competition_id, round, player1_id, player2_id) values (${ids.A}, ${ids.compA}, 'X', ${ids.mP1}, ${ids.mP1})`))).toBe("23514");
    expect(await denied(svc.execute(sql`insert into matches (club_id, competition_id, round, player1_id, player2_id, winner_id) values (${ids.A}, ${ids.compA}, 'X', ${ids.mP1}, ${ids.mP2}, ${ids.mAdminA})`))).toBe("23514");
    expect(await denied(svc.execute(sql`insert into matches (club_id, competition_id, round, best_of) values (${ids.A}, ${ids.compA}, 'X', 4)`))).toBe("23514");
    expect(await denied(svc.execute(sql`insert into clubs (slug, name, owner_id) values ('Bad Slug!', 'x', 'adminA')`))).toBe("23514");
  });
});

describe("the app role cannot bypass security", () => {
  it("has no superuser or BYPASSRLS, cannot assume the service role, cannot touch auth secrets", async () => {
    const r = await rows(app, { userId: "adminA" }, sql`select rolsuper, rolbypassrls from pg_roles where rolname = current_user`);
    expect(r[0]).toEqual({ rolsuper: false, rolbypassrls: false });
    expect(await denied(app.execute(sql`set role rallix_service`))).toBe("42501");
    expect(await denied(app.execute(sql`select * from sessions`))).toBe("42501");
    expect(await denied(app.execute(sql`select * from accounts`))).toBe("42501");
    expect(await denied(app.execute(sql`select * from audit_log`))).toBe("42501");
    expect(await denied(app.execute(sql`select * from global_ratings`))).toBe("42501");
    expect(await denied(app.execute(sql`alter table clubs disable row level security`))).toBe("42501");
  });

  it("members can see co-members' names, but never email or phone, and nobody else", async () => {
    const names = await rows(app, { userId: "playerA1", clubId: ids.A }, sql`select name from users where id = 'playerA2'`);
    expect(names).toHaveLength(1);
    expect(await denied(withTenant(app, { userId: "playerA1", clubId: ids.A }, (tx) => tx.execute(sql`select email from users`)))).toBe("42501");
    expect(await denied(withTenant(app, { userId: "playerA1", clubId: ids.A }, (tx) => tx.execute(sql`select phone_number from users`)))).toBe("42501");
    expect(await rows(app, { userId: "playerA1", clubId: ids.A }, sql`select name from users where id = 'adminB'`)).toHaveLength(0);
  });

  it("the global leaderboard exposes only id, name and rating", async () => {
    const r = await rows(app, { userId: "stranger" }, sql`select * from app.global_leaderboard`);
    expect(r).toHaveLength(1);
    expect(Object.keys(r[0]!).sort()).toEqual(["matches_played", "name", "rating", "user_id"]);
  });
});

describe("typed queries", () => {
  it("drizzle parses enum arrays and respects RLS through withTenant", async () => {
    const out = await withTenant(app, { userId: "scorerA", clubId: ids.A }, (tx) =>
      tx.select({ roles: s.memberships.roles, status: s.memberships.status }).from(s.memberships).where(eq(s.memberships.userId, "scorerA")));
    expect(out).toEqual([{ roles: ["scorer"], status: "active" }]);
  });
});

describe("club creation and invites", () => {
  it("create_club makes the caller an admin and player with a profile", async () => {
    const r = await withTenant(app, { userId: "stranger" }, (tx) => tx.execute(sql`select app.create_club('New Club', 'new-club', 'Abuja') as id`));
    const clubId = (r.rows[0] as { id: string }).id;
    const m = await rows(app, { userId: "stranger", clubId }, sql`select roles::text[] as roles from memberships where club_id = ${clubId}`);
    expect(m[0]!.roles).toEqual(["admin", "player"]);
    expect(await rows(app, { userId: "stranger", clubId }, sql`select 1 from player_profiles`)).toHaveLength(1);
  });

  it("create_club requires a signed-in user and a valid slug", async () => {
    expect(await denied(app.execute(sql`select app.create_club('x', 'y', null)`))).toBe("28000");
    expect(await denied(withTenant(app, { userId: "stranger" }, (tx) => tx.execute(sql`select app.create_club('x', 'Bad Slug', null)`)))).toBe("23514");
  });

  it("join_club adds a player once, counts uses, and rejects expired, exhausted, revoked and suspended", async () => {
    await svc.insert(s.users).values([{ id: "j1", name: "J1", email: "j1@x.com" }, { id: "j2", name: "J2", email: "j2@x.com" }, { id: "j3", name: "J3", email: "j3@x.com" }]);
    await withTenant(app, { userId: "j1" }, (tx) => tx.execute(sql`select app.join_club('GOOD', 'senior')`));
    const again = await withTenant(app, { userId: "j1" }, (tx) => tx.execute(sql`select app.join_club('GOOD')`));
    expect(again.rows).toHaveLength(1); // idempotent for an active member
    const inv = await svc.execute(sql`select uses from invites where code = 'GOOD'`);
    expect((inv.rows[0] as { uses: number }).uses).toBe(1);
    const prof = await rows(app, { userId: "j1", clubId: ids.A }, sql`select level from player_profiles p join memberships m on m.id = p.membership_id where m.user_id = 'j1'`);
    expect(prof[0]!.level).toBe("senior");

    expect(await denied(withTenant(app, { userId: "j2" }, (tx) => tx.execute(sql`select app.join_club('EXPIRED')`)))).toBe("P0001");
    expect(await denied(withTenant(app, { userId: "j2" }, (tx) => tx.execute(sql`select app.join_club('NOPE')`)))).toBe("P0001");
    await withTenant(app, { userId: "j2" }, (tx) => tx.execute(sql`select app.join_club('ONCE')`));
    expect(await denied(withTenant(app, { userId: "j3" }, (tx) => tx.execute(sql`select app.join_club('ONCE')`)))).toBe("P0001");

    await svc.execute(sql`update memberships set status = 'suspended' where user_id = 'j1'`);
    expect(await denied(withTenant(app, { userId: "j1" }, (tx) => tx.execute(sql`select app.join_club('GOOD')`)))).toBe("P0001");
    await svc.execute(sql`update invites set revoked_at = now() where code = 'GOOD'`);
    expect(await denied(withTenant(app, { userId: "j3" }, (tx) => tx.execute(sql`select app.join_club('GOOD')`)))).toBe("P0001");
  });

  it("players cannot read or create invites", async () => {
    expect(await rows(app, { userId: "playerA1", clubId: ids.A }, sql`select code from invites`)).toHaveLength(0);
    expect(await denied(withTenant(app, { userId: "playerA1", clubId: ids.A }, (tx) => tx.execute(sql`insert into invites (club_id, code) values (${ids.A}, 'MINE')`)))).toBe("42501");
  });
});

describe("console tables and suspended clubs", () => {
  it("the app role cannot read or write any console-only table", async () => {
    for (const t of ["issues", "issue_notes", "templates", "platform_settings", "notifications", "platform_admins", "audit_log"]) {
      expect(await denied(app.execute(sql.raw(`select * from ${t}`)))).toBe("42501");
    }
    expect(await denied(app.execute(sql`select app.next_invoice_number()`))).toBe("42501");
  });

  it("invoice numbers are sequential, unique and formatted with the prefix and year", async () => {
    const a = (await svc.execute(sql`select app.next_invoice_number() as n`)).rows[0] as { n: string };
    const b = (await svc.execute(sql`select app.next_invoice_number() as n`)).rows[0] as { n: string };
    expect(a.n).toMatch(/^RLX-\d{4}-\d{4}$/);
    expect(Number(b.n.slice(-4))).toBe(Number(a.n.slice(-4)) + 1);
  });

  it("default templates and settings exist on a fresh database", async () => {
    const t = (await svc.execute(sql`select count(*)::int as n from templates`)).rows[0] as { n: number };
    expect(t.n).toBeGreaterThanOrEqual(4);
    expect(((await svc.execute(sql`select count(*)::int as n from platform_settings`)).rows[0] as { n: number }).n).toBe(1);
  });

  it("a suspended club disappears for its members: no reads, no writes, no joins", async () => {
    await svc.insert(s.users).values({ id: "susp", name: "Susp Admin", email: "susp@x.com" });
    const [c] = await svc.insert(s.clubs).values({ slug: "susp-club", name: "Susp Club", ownerId: "susp" }).returning();
    const [m] = await svc.insert(s.memberships).values({ clubId: c!.id, userId: "susp", roles: ["admin", "player"] }).returning();
    await svc.insert(s.competitions).values({ clubId: c!.id, name: "S Cup", format: "knockout" });
    await svc.insert(s.invites).values({ clubId: c!.id, code: "SUSPCODE" });
    const ctx = { userId: "susp", clubId: c!.id };
    expect(await rows(app, ctx, sql`select name from competitions`)).toHaveLength(1);

    await svc.execute(sql`update clubs set status = 'suspended' where id = ${c!.id}`);
    expect(await rows(app, ctx, sql`select name from competitions`)).toHaveLength(0);
    expect(await rows(app, ctx, sql`select name from clubs`)).toHaveLength(0);
    expect(await denied(withTenant(app, ctx, (tx) => tx.execute(sql`insert into competitions (club_id, name, format) values (${c!.id}, 'New', 'knockout')`)))).toBe("42501");
    expect(await denied(withTenant(app, { userId: "stranger" }, (tx) => tx.execute(sql`select app.join_club('SUSPCODE')`)))).toBe("P0001");
    const blocked = await rows(app, { userId: "susp" }, sql`select name, status from app.blocked_clubs()`);
    expect(blocked).toEqual([{ name: "Susp Club", status: "suspended" }]);
    expect(await rows(app, { userId: "adminA" }, sql`select name from app.blocked_clubs()`)).toHaveLength(0); // other clubs unaffected

    await svc.execute(sql`update clubs set status = 'active' where id = ${c!.id}`);
    expect(await rows(app, ctx, sql`select name from competitions`)).toHaveLength(1); // reactivation restores access
    void m;
  });
});

describe("payout and payment tables", () => {
  const adminCtx = () => ({ userId: "adminA", clubId: ids.A });
  it("the app role cannot read bank or subaccount details, even an admin reading their own club", async () => {
    for (const col of ["paystack_subaccount_code", "payout_bank_name", "payout_bank_code", "payout_account_name", "payout_account_last4"]) {
      expect(await denied(withTenant(app, adminCtx(), (tx) => tx.execute(sql.raw(`select ${col} from clubs`))))).toBe("42501");
    }
    expect(await denied(withTenant(app, adminCtx(), (tx) => tx.execute(sql`select * from clubs`)))).toBe("42501");
  });

  it("an admin cannot change where money is paid out, nor mark payouts enabled", async () => {
    for (const set of ["paystack_subaccount_code = 'ACCT_evil'", "payouts_enabled_at = now()", "payout_account_last4 = '9999'"]) {
      expect(await denied(withTenant(app, adminCtx(), (tx) => tx.execute(sql.raw(`update clubs set ${set} where id = '${ids.A}'`))))).toBe("42501");
    }
  });

  it("an admin can still edit the ordinary club details, and players cannot", async () => {
    const r = await withTenant(app, adminCtx(), (tx) => tx.execute(sql`update clubs set location = 'Abuja' where id = ${ids.A}`));
    expect(r.rowCount).toBe(1);
    const p = await withTenant(app, { userId: "playerA1", clubId: ids.A }, (tx) => tx.execute(sql`update clubs set location = 'Hacked' where id = ${ids.A}`));
    expect(p.rowCount).toBe(0);
  });

  it("members can see whether online payments are on, and nothing else about payouts", async () => {
    await svc.execute(sql`update clubs set paystack_subaccount_code = 'ACCT_test', payout_bank_name = 'Test Bank', payout_account_last4 = '6789', payouts_enabled_at = now() where id = ${ids.A}`);
    const r = await rows(app, { userId: "playerA1", clubId: ids.A }, sql`select payouts_enabled_at is not null as enabled from clubs`);
    expect(r).toEqual([{ enabled: true }]);
  });

  it("payouts cannot be marked enabled without a subaccount", async () => {
    expect(await denied(svc.execute(sql`update clubs set paystack_subaccount_code = null, payouts_enabled_at = now() where id = ${ids.B}`))).toBe("23514");
  });

  it("the app role cannot read, write or even see invoice payments and webhook events", async () => {
    for (const t of ["invoice_payments", "payment_events"]) {
      expect(await denied(app.execute(sql.raw(`select * from ${t}`)))).toBe("42501");
      expect(await denied(app.execute(sql.raw(`insert into ${t} default values`)))).toBe("42501");
    }
  });

  it("payment references are unique, so one reference can never credit two payments", async () => {
    const ins = sql`insert into payments (club_id, membership_id, amount_kobo, status, provider_ref) values (${ids.A}, ${ids.mP2}, 600000, 'pending', 'dup-ref-1')`;
    await svc.execute(ins);
    expect(await denied(svc.execute(ins))).toBe("23505");
  });

  it("invoice payment amounts must be positive and statuses valid", async () => {
    const inv = (await svc.execute(sql`insert into platform_invoices (club_id, number, status, amount_kobo, period_label) values (${ids.A}, 'T-1', 'issued', 100, 'p1') returning id`)).rows[0] as { id: string };
    expect(await denied(svc.execute(sql`insert into invoice_payments (invoice_id, club_id, reference, amount_kobo) values (${inv.id}, ${ids.A}, 'RLX-I-T1', 0)`))).toBe("23514");
    expect(await denied(svc.execute(sql`insert into invoice_payments (invoice_id, club_id, reference, amount_kobo, status) values (${inv.id}, ${ids.A}, 'RLX-I-T2', 100, 'hacked')`))).toBe("23514");
  });
});

describe("pay links and suspension reasons", () => {
  const adminCtx = () => ({ userId: "adminA", clubId: ids.A });
  let invId: string;
  beforeAll(async () => {
    invId = ((await svc.execute(sql`insert into platform_invoices (club_id, number, status, amount_kobo, period_label, pay_token) values (${ids.A}, 'PL-1', 'issued', 100000, 'pl-1', 'AbCdEfGhIjKlMnOpQrStUvWx') returning id`)).rows[0] as { id: string }).id;
  });

  it("an admin can read their club's invoices but never the pay token", async () => {
    const ok = await rows(app, adminCtx(), sql`select number, status from platform_invoices where id = ${invId}`);
    expect(ok).toEqual([{ number: "PL-1", status: "issued" }]);
    expect(await denied(withTenant(app, adminCtx(), (tx) => tx.execute(sql`select pay_token from platform_invoices`)))).toBe("42501");
    expect(await denied(withTenant(app, adminCtx(), (tx) => tx.execute(sql`select * from platform_invoices`)))).toBe("42501");
  });

  it("the app role cannot read or write the suspension reason", async () => {
    expect(await denied(withTenant(app, adminCtx(), (tx) => tx.execute(sql`select suspension_reason from clubs`)))).toBe("42501");
    expect(await denied(withTenant(app, adminCtx(), (tx) => tx.execute(sql`update clubs set suspension_reason = 'other' where id = ${ids.A}`)))).toBe("42501");
  });

  it("pay tokens are unique and must be long, plain alphanumerics", async () => {
    const dup = svc.execute(sql`insert into platform_invoices (club_id, number, status, amount_kobo, period_label, pay_token) values (${ids.A}, 'PL-2', 'issued', 100, 'pl-2', 'AbCdEfGhIjKlMnOpQrStUvWx')`);
    expect(await denied(dup)).toBe("23505");
    for (const bad of ["short", "has spaces in it 1234567890", "has-dashes-1234567890abcdef", "x".repeat(65)]) {
      expect(await denied(svc.execute(sql`insert into platform_invoices (club_id, number, status, amount_kobo, period_label, pay_token) values (${ids.A}, ${"PL-" + bad.length}, 'issued', 100, ${"b" + bad.length}, ${bad})`))).toBe("23514");
    }
  });

  it("a reason can only be set while the club is not active, and the enum is closed", async () => {
    expect(await denied(svc.execute(sql`update clubs set suspension_reason = 'non_payment' where id = ${ids.B}`))).toBe("23514");
    await svc.execute(sql`update clubs set status = 'suspended', suspension_reason = 'non_payment' where id = ${ids.B}`);
    expect(await denied(svc.execute(sql`update clubs set suspension_reason = 'because' where id = ${ids.B}`))).toBe("22P02");
    expect(await denied(svc.execute(sql`update clubs set status = 'active' where id = ${ids.B}`))).toBe("23514"); // must clear the reason in the same update
    await svc.execute(sql`update clubs set status = 'active', suspension_reason = null where id = ${ids.B}`);
  });

  it("the app role can't touch invoice payments made through links", async () => {
    expect(await denied(app.execute(sql`select via_link, payer_email from invoice_payments`))).toBe("42501");
  });
});

describe("email tables and email-based accounts", () => {
  it("the app role cannot see or write the email log or notification deliveries", async () => {
    for (const t of ["email_log", "notification_deliveries"]) {
      expect(await denied(app.execute(sql.raw(`select * from ${t}`)))).toBe("42501");
      expect(await denied(app.execute(sql.raw(`insert into ${t} default values`)))).toBe("42501");
    }
  });

  it("every account must have an email, and emails are unique regardless of letter case", async () => {
    expect(await denied(svc.execute(sql`insert into users (id, name) values ('noemail', 'No Email')`))).toBe("23502");
    await svc.execute(sql`insert into users (id, name, email) values ('case1', 'Case One', 'MixedCase@Example.com')`);
    expect(await denied(svc.execute(sql`insert into users (id, name, email) values ('case2', 'Case Two', 'mixedcase@example.com')`))).toBe("23505");
  });

  it("phone is optional, but two accounts cannot share one", async () => {
    await svc.execute(sql`insert into users (id, name, email, phone_number) values ('ph1', 'Ph One', 'ph1@x.com', '+2348031110000')`);
    await svc.execute(sql`insert into users (id, name, email) values ('ph2', 'Ph Two', 'ph2@x.com')`);
    expect(await denied(svc.execute(sql`insert into users (id, name, email, phone_number) values ('ph3', 'Ph Three', 'ph3@x.com', '+2348031110000')`))).toBe("23505");
  });

  it("email log only accepts known kinds and statuses", async () => {
    expect(await denied(svc.execute(sql`insert into email_log (to_email, kind, status) values ('a@x.com', 'spam', 'sent')`))).toBe("23514");
    expect(await denied(svc.execute(sql`insert into email_log (to_email, kind, status) values ('a@x.com', 'otp', 'maybe')`))).toBe("23514");
    await svc.execute(sql`insert into email_log (to_email, kind, status) values ('a@x.com', 'otp', 'sent')`);
  });

  it("a notification can be delivered to each person only once", async () => {
    const n = (await svc.execute(sql`insert into notifications (audience, channel, title, body) values ('{}'::jsonb, 'email', 'T', 'B') returning id`)).rows[0] as { id: string };
    const ins = sql`insert into notification_deliveries (notification_id, user_id, email) values (${n.id}, 'ph1', 'ph1@x.com')`;
    await svc.execute(ins);
    expect(await denied(svc.execute(ins))).toBe("23505");
    expect(await denied(svc.execute(sql`insert into notification_deliveries (notification_id, user_id, email, status) values (${n.id}, 'ph2', 'ph2@x.com', 'lost')`))).toBe("23514");
  });

  it("the dues reminder template is an email template now", async () => {
    const r = (await svc.execute(sql`select kind::text as kind, subject from templates where key = 'dues_reminder'`)).rows[0] as { kind: string; subject: string };
    expect(r.kind).toBe("email"); expect(r.subject).toMatch(/dues/i);
  });
});

describe("null-safe filters (regression: NULL <> 'x' is not true)", () => {
  it("rate-limit counting must include rows whose error is NULL", async () => {
    await svc.execute(sql`insert into email_log (to_email, kind, status) values ('rl@x.com', 'otp', 'sent'), ('rl@x.com', 'otp', 'sent')`);
    await svc.execute(sql`insert into email_log (to_email, kind, status, error) values ('rl@x.com', 'otp', 'failed', 'rate_limited')`);
    const bad = (await svc.execute(sql`select count(*)::int as n from email_log where to_email = 'rl@x.com' and error <> 'rate_limited'`)).rows[0] as { n: number };
    const good = (await svc.execute(sql`select count(*)::int as n from email_log where to_email = 'rl@x.com' and (error is null or error <> 'rate_limited')`)).rows[0] as { n: number };
    expect(bad.n).toBe(0); // documents the trap
    expect(good.n).toBe(2);
  });
});
