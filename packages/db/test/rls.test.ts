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
    { clubId: A!.id, name: "A Cup", format: "group_stage", status: "active" }, { clubId: B!.id, name: "B Cup", format: "knockout", status: "active" },
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
    expect(await denied(withTenant(app, { userId: "playerA1", clubId: ids.A }, (tx) => tx.execute(sql`update memberships set roles = ARRAY['admin']::member_role[] where id = ${ids.mP1}`)))).toBe("42501"); // roles are only changed through app.set_admin, never directly
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

describe("dues reminders", () => {
  const adminCtx = () => ({ userId: "adminA", clubId: ids.A });
  let dueP1: string;
  beforeAll(async () => { dueP1 = ((await svc.execute(sql`select id from dues where membership_id = ${ids.mP1}`)).rows[0] as { id: string }).id; });

  it("reminders are off by default and only the club's own admins can see or change the settings", async () => {
    await withTenant(app, adminCtx(), (tx) => tx.execute(sql`insert into reminder_settings (club_id) values (${ids.A})`));
    const mine = await rows(app, adminCtx(), sql`select enabled, offsets from reminder_settings`);
    expect(mine).toEqual([{ enabled: false, offsets: [-3, 0, 3, 7] }]);
    await withTenant(app, adminCtx(), (tx) => tx.execute(sql`update reminder_settings set enabled = true where club_id = ${ids.A}`));
    expect(await rows(app, { userId: "playerA1", clubId: ids.A }, sql`select * from reminder_settings`)).toHaveLength(0); // a player sees nothing
    expect(await rows(app, { userId: "adminB", clubId: ids.B }, sql`select * from reminder_settings`)).toHaveLength(0); // another club's admin sees nothing
    expect(await rows(app, { userId: "adminB", clubId: ids.A }, sql`select * from reminder_settings`)).toHaveLength(0); // even claiming club A
  });

  it("nobody else can change a club's settings or create them for another club", async () => {
    expect((await withTenant(app, { userId: "playerA1", clubId: ids.A }, (tx) => tx.execute(sql`update reminder_settings set enabled = false where club_id = ${ids.A}`))).rowCount).toBe(0);
    expect(await denied(withTenant(app, { userId: "adminB", clubId: ids.B }, (tx) => tx.execute(sql`insert into reminder_settings (club_id) values (${ids.A})`)))).toBe("42501");
    expect(await denied(withTenant(app, { userId: "playerA1", clubId: ids.A }, (tx) => tx.execute(sql`insert into reminder_settings (club_id) values (${ids.B})`)))).toBe("42501");
  });

  it("reminder days must be 1 to 6 distinct whole numbers between -14 and 30", async () => {
    const set = (v: string) => withTenant(app, adminCtx(), (tx) => tx.execute(sql.raw(`update reminder_settings set offsets = ${v} where club_id = '${ids.A}'`)));
    for (const bad of ["ARRAY[]::int[]", "ARRAY[1,2,3,4,5,6,7]", "ARRAY[-15]", "ARRAY[31]", "ARRAY[3,3]", "ARRAY[NULL]::int[]"]) expect(await denied(set(bad)), bad).toBe("23514");
    await set("ARRAY[-14,30]"); await set("ARRAY[-3,0,3,7]");
  });

  it("the app role cannot read or write the reminder log, or any player's opt-out flag", async () => {
    expect(await denied(app.execute(sql`select * from reminder_log`))).toBe("42501");
    expect(await denied(app.execute(sql`insert into reminder_log (club_id, due_id, offset_days) values (${ids.A}, ${dueP1}, 0)`))).toBe("42501");
    expect(await denied(withTenant(app, { userId: "playerA1", clubId: ids.A }, (tx) => tx.execute(sql`select email_opt_out from users`)))).toBe("42501");
    expect(await denied(withTenant(app, { userId: "playerA1", clubId: ids.A }, (tx) => tx.execute(sql`update users set email_opt_out = true where id = 'playerA1'`)))).toBe("42501");
  });

  it("a due can only be reminded once per reminder day, which is what makes the job safe to repeat", async () => {
    await svc.execute(sql`insert into reminder_log (club_id, due_id, offset_days, status) values (${ids.A}, ${dueP1}, -3, 'sent')`);
    expect(await denied(svc.execute(sql`insert into reminder_log (club_id, due_id, offset_days) values (${ids.A}, ${dueP1}, -3)`))).toBe("23505");
    await svc.execute(sql`insert into reminder_log (club_id, due_id, offset_days, status) values (${ids.A}, ${dueP1}, 0, 'sent')`);
    expect(await denied(svc.execute(sql`insert into reminder_log (club_id, due_id, offset_days, status) values (${ids.A}, ${dueP1}, 3, 'bounced')`))).toBe("23514");
  });

  it("the unsent-reminder claim pattern lets exactly one of several concurrent runners win", async () => {
    const claim = () => svc.execute(sql`insert into reminder_log (club_id, due_id, offset_days) values (${ids.A}, ${dueP1}, 7) on conflict (due_id, offset_days) do nothing returning id`);
    const results = await Promise.all(Array.from({ length: 8 }, claim));
    expect(results.filter((r) => r.rows.length === 1)).toHaveLength(1);
  });

  it("the reminder wording was upgraded, and mentions the timing and pay link", async () => {
    const t = (await svc.execute(sql`select subject, body from templates where key = 'dues_reminder'`)).rows[0] as { subject: string; body: string };
    expect(t.subject).toContain("{{timing}}"); expect(t.body).toContain("{{pay_link}}");
  });
});

describe("picture uploads", () => {
  const p1 = () => ({ userId: "playerA1", clubId: ids.A });
  beforeAll(async () => { // members created directly by the test setup have no profile row yet
    await svc.execute(sql`insert into player_profiles (membership_id, club_id) values (${ids.mP1}, ${ids.A}), (${ids.mP2}, ${ids.A}) on conflict (membership_id) do nothing`);
  });
  const setPhoto = (ctx: { userId: string; clubId: string }, membership: string, url: string | null) =>
    withTenant(app, ctx, (tx) => tx.execute(sql`update player_profiles set photo_url = ${url} where membership_id = ${membership} returning membership_id`));
  const photoOf = async (membership: string) => ((await svc.execute(sql`select photo_url from player_profiles where membership_id = ${membership}`)).rows[0] as { photo_url: string | null }).photo_url;

  it("a player can set their own photo but not another player's", async () => {
    expect((await setPhoto(p1(), ids.mP1, "https://cdn.example/a.webp")).rows).toHaveLength(1);
    expect(await photoOf(ids.mP1)).toBe("https://cdn.example/a.webp");
    expect((await setPhoto(p1(), ids.mP2, "https://cdn.example/evil.webp")).rows).toHaveLength(0); // row-level security hides it, so nothing updates
    expect(await photoOf(ids.mP2)).not.toBe("https://cdn.example/evil.webp");
  });
  it("a club admin can set any member's photo in their own club, and an admin of another club cannot", async () => {
    expect((await setPhoto({ userId: "adminA", clubId: ids.A }, ids.mP2, "https://cdn.example/b.webp")).rows).toHaveLength(1);
    expect((await setPhoto({ userId: "adminB", clubId: ids.B }, ids.mP2, "https://cdn.example/x.webp")).rows).toHaveLength(0);
    expect((await setPhoto({ userId: "adminB", clubId: ids.A }, ids.mP2, "https://cdn.example/x.webp")).rows).toHaveLength(0); // claiming club A does not help
    expect(await photoOf(ids.mP2)).toBe("https://cdn.example/b.webp");
  });
  it("picture addresses must be web addresses or local paths, never javascript: or data:", async () => {
    for (const bad of ["javascript:alert(1)", "data:text/html;base64,AAAA", "ftp://x/y.png", "//cdn.example/a.png"]) {
      expect(await denied(setPhoto(p1(), ids.mP1, bad)), bad).toBe("23514");
    }
    expect((await setPhoto(p1(), ids.mP1, "/players/ade.png")).rows).toHaveLength(1);
    expect((await setPhoto(p1(), ids.mP1, null)).rows).toHaveLength(1);
  });
  it("only a club's admins can change its logo and cover", async () => {
    const setClub = (ctx: { userId: string; clubId: string }, col: "logo_url" | "cover_url", url: string) =>
      withTenant(app, ctx, (tx) => tx.execute(sql.raw(`update clubs set ${col} = '${url}' where id = '${ids.A}' returning id`)));
    expect((await setClub({ userId: "adminA", clubId: ids.A }, "cover_url", "https://cdn.example/cover.webp")).rows).toHaveLength(1);
    expect((await setClub({ userId: "adminA", clubId: ids.A }, "logo_url", "https://cdn.example/logo.webp")).rows).toHaveLength(1);
    expect((await setClub({ userId: "playerA1", clubId: ids.A }, "cover_url", "https://cdn.example/x.webp")).rows).toHaveLength(0);
    expect((await setClub({ userId: "adminB", clubId: ids.B }, "cover_url", "https://cdn.example/x.webp")).rows).toHaveLength(0);
    const back = (await svc.execute(sql`select cover_url, logo_url from clubs where id = ${ids.A}`)).rows[0] as Record<string, string>;
    expect(back).toEqual({ cover_url: "https://cdn.example/cover.webp", logo_url: "https://cdn.example/logo.webp" });
    expect(await denied(withTenant(app, { userId: "adminA", clubId: ids.A }, (tx) => tx.execute(sql`update clubs set cover_url = 'javascript:x' where id = ${ids.A}`)))).toBe("23514");
  });
  it("a member of another club cannot read this club's cover through the clubs table", async () => {
    const r = await rows(app, { userId: "adminB", clubId: ids.B }, sql`select cover_url from clubs where id = ${ids.A}`);
    expect(r).toHaveLength(0);
  });
  it("the app role can neither read nor write the upload log", async () => {
    expect(await denied(withTenant(app, p1(), (tx) => tx.execute(sql`select * from upload_log`)))).toBe("42501");
    expect(await denied(withTenant(app, p1(), (tx) => tx.execute(sql`insert into upload_log (user_id, kind, bytes) values ('playerA1', 'person', 1)`)))).toBe("42501");
    await svc.execute(sql`insert into upload_log (user_id, club_id, kind, bytes) values ('playerA1', ${ids.A}, 'person', 1234)`);
    expect(await denied(svc.execute(sql`insert into upload_log (user_id, kind, bytes) values ('playerA1', 'video', 1)`))).toBe("23514");
  });
});

describe("arrival check-in", () => {
  const p1 = () => ({ userId: "playerA1", clubId: ids.A });
  const p2 = () => ({ userId: "playerA2", clubId: ids.A });
  const arrive = (ctx: { userId: string; clubId: string }, membership: string) =>
    withTenant(app, ctx, (tx) => tx.execute(sql`insert into arrivals (club_id, membership_id, method) values (${ctx.clubId}, ${membership}, 'manual') returning id`));
  const leave = (ctx: { userId: string; clubId: string }, membership: string) =>
    withTenant(app, ctx, (tx) => tx.execute(sql`update arrivals set left_at = now() where membership_id = ${membership} and left_at is null returning id`));

  it("a player can record and close their own arrival only", async () => {
    expect((await arrive(p1(), ids.mP1)).rows).toHaveLength(1);
    expect(await denied(arrive(p1(), ids.mP2))).toBe("42501"); // row-level security refuses someone else's identity
    expect(await denied(arrive(p1(), ids.mP1))).toBe("23505"); // only one open arrival at a time
    expect((await leave(p2(), ids.mP1)).rows).toHaveLength(0); // cannot close another player's
    expect((await leave(p1(), ids.mP1)).rows).toHaveLength(1);
  });
  it("club members see arrivals in their own club, other clubs do not", async () => {
    await arrive(p2(), ids.mP2);
    expect((await rows(app, p1(), sql`select id from arrivals`)).length).toBeGreaterThan(0);
    expect(await rows(app, { userId: "adminB", clubId: ids.B }, sql`select id from arrivals`)).toHaveLength(0);
    expect(await rows(app, { userId: "adminB", clubId: ids.A }, sql`select id from arrivals`)).toHaveLength(0);
    await leave(p2(), ids.mP2);
  });
  it("the app role cannot backdate an arrival or write the alert marker", async () => {
    expect(await denied(withTenant(app, p1(), (tx) => tx.execute(sql`insert into arrivals (club_id, membership_id, arrived_at) values (${ids.A}, ${ids.mP1}, now() - interval '3 hours')`)))).toBe("42501");
    await arrive(p1(), ids.mP1);
    expect(await denied(withTenant(app, p1(), (tx) => tx.execute(sql`update arrivals set alerted_at = now() where membership_id = ${ids.mP1}`)))).toBe("42501");
    await leave(p1(), ids.mP1);
  });
  it("only a club's admins can set the court location, and bad values are refused", async () => {
    const setVenue = (ctx: { userId: string; clubId: string }, lat: number, lng: number) =>
      withTenant(app, ctx, (tx) => tx.execute(sql`update clubs set venue_lat = ${lat}, venue_lng = ${lng}, venue_label = 'Court' where id = ${ids.A} returning id`));
    expect((await setVenue({ userId: "adminA", clubId: ids.A }, 9.0765, 7.3986)).rows).toHaveLength(1);
    expect((await setVenue(p1(), 1, 1)).rows).toHaveLength(0);
    expect((await setVenue({ userId: "adminB", clubId: ids.B }, 1, 1)).rows).toHaveLength(0);
    expect(await denied(setVenue({ userId: "adminA", clubId: ids.A }, 91, 7))).toBe("23514");
    expect(await denied(withTenant(app, { userId: "adminA", clubId: ids.A }, (tx) => tx.execute(sql`update clubs set venue_lat = null where id = ${ids.A}`)))).toBe("23514"); // lat without lng
    expect(await denied(withTenant(app, { userId: "adminA", clubId: ids.A }, (tx) => tx.execute(sql`update clubs set venue_radius_m = 5000 where id = ${ids.A}`)))).toBe("23514");
  });
  it("a player can switch their own arrival settings but not read push subscriptions", async () => {
    await svc.execute(sql`insert into player_profiles (membership_id, club_id) values (${ids.mP1}, ${ids.A}) on conflict (membership_id) do nothing`);
    const r = await withTenant(app, p1(), (tx) => tx.execute(sql`update player_profiles set share_arrival = true, notify_arrivals = true where membership_id = ${ids.mP1} returning membership_id`));
    expect(r.rows).toHaveLength(1);
    expect(await denied(withTenant(app, p1(), (tx) => tx.execute(sql`select * from push_subscriptions`)))).toBe("42501");
    expect(await denied(withTenant(app, p1(), (tx) => tx.execute(sql`insert into push_subscriptions (user_id, endpoint, p256dh, auth) values ('playerA1', 'https://push.example/a', 'k', 'a')`)))).toBe("42501");
    expect(await denied(svc.execute(sql`insert into push_subscriptions (user_id, endpoint, p256dh, auth) values ('playerA1', 'http://push.example/a', 'k', 'a')`))).toBe("23514");
  });
});

describe("competition sign-up", () => {
  const P1 = () => ({ userId: "playerA1", clubId: ids.A });
  const P2 = () => ({ userId: "playerA2", clubId: ids.A });
  const MULTI = () => ({ userId: "multi", clubId: ids.A });
  const ADMIN = () => ({ userId: "adminA", clubId: ids.A });
  let n = 0;
  beforeAll(async () => {
    await svc.execute(sql`insert into player_profiles (membership_id, club_id) values (${ids.mP1}, ${ids.A}), (${ids.mP2}, ${ids.A}), (${ids.mMultiA}, ${ids.A}) on conflict (membership_id) do nothing`);
    await svc.execute(sql`update player_profiles set level = 'junior' where membership_id in (${ids.mP1}, ${ids.mMultiA})`);
    await svc.execute(sql`update player_profiles set level = 'senior' where membership_id = ${ids.mP2}`);
  });
  async function make(o: { status?: string; open?: boolean; max?: number | null; closes?: string | null; level?: string | null; club?: string } = {}) {
    const r = await svc.execute(sql`insert into competitions (club_id, name, format, status, open_registration, max_players, registration_closes_on, level)
      values (${o.club ?? ids.A}, ${`Signup ${++n}`}, 'group_stage', ${o.status ?? "draft"}, ${o.open ?? true}, ${o.max ?? null}, ${o.closes ?? null}, ${o.level ?? null}) returning id`);
    return (r.rows[0] as { id: string }).id;
  }
  const join = async (ctx: { userId: string; clubId: string }, id: string) => ((await withTenant(app, ctx, (tx) => tx.execute(sql`select app.join_competition(${id}) as r`))).rows[0] as { r: string }).r;
  const leave = async (ctx: { userId: string; clubId: string }, id: string) => ((await withTenant(app, ctx, (tx) => tx.execute(sql`select app.leave_competition(${id}) as r`))).rows[0] as { r: string }).r;
  const count = async (id: string) => Number(((await svc.execute(sql`select count(*)::int as n from competition_entries where competition_id = ${id}`)).rows[0] as { n: number }).n);
  const today = async () => ((await svc.execute(sql`select (now() at time zone 'Africa/Lagos')::date::text as d`)).rows[0] as { d: string }).d;
  const shift = async (days: number) => ((await svc.execute(sql`select ((now() at time zone 'Africa/Lagos')::date + ${days}::int)::text as d`)).rows[0] as { d: string }).d;

  it("a player joins an open draft once, and joining again changes nothing", async () => {
    const id = await make();
    expect(await join(P1(), id)).toBe("joined");
    expect(await join(P1(), id)).toBe("already");
    expect(await count(id)).toBe(1);
  });
  it("players still cannot write competition entries directly", async () => {
    const id = await make();
    expect(await denied(withTenant(app, P1(), (tx) => tx.execute(sql`insert into competition_entries (club_id, competition_id, membership_id) values (${ids.A}, ${id}, ${ids.mP1})`)))).toBe("42501");
    expect(await count(id)).toBe(0);
  });
  it("stops at the spot limit, and people racing for the last spots cannot take more than exist", async () => {
    const id = await make({ max: 2 });
    const res = await Promise.all([join(P1(), id), join(P2(), id), join(MULTI(), id)]);
    expect(res.filter((r) => r === "joined")).toHaveLength(2);
    expect(res.filter((r) => r === "full")).toHaveLength(1);
    expect(await count(id)).toBe(2);
  });
  it("closes the day after the closing date, not on it", async () => {
    expect(await join(P1(), await make({ closes: await today() }))).toBe("joined");
    expect(await join(P1(), await make({ closes: await shift(-1) }))).toBe("closed");
  });
  it("only a draft with open registration can be joined", async () => {
    expect(await join(P1(), await make({ status: "active" }))).toBe("closed");
    expect(await join(P1(), await make({ status: "completed" }))).toBe("closed");
    expect(await join(P1(), await make({ open: false }))).toBe("closed");
  });
  it("enforces the level, and a combined competition takes everyone", async () => {
    const senior = await make({ level: "senior" });
    expect(await join(P1(), senior)).toBe("level"); // junior player
    expect(await join(P2(), senior)).toBe("joined"); // senior player
    expect(await join(P1(), await make({ level: null }))).toBe("joined");
  });
  it("refuses people from other clubs and signed-out callers", async () => {
    const id = await make();
    expect(await join({ userId: "adminB", clubId: ids.B }, id)).toBe("closed");
    expect(await count(id)).toBe(0);
    expect(await denied(withTenant(app, { userId: "", clubId: ids.A }, (tx) => tx.execute(sql`select app.join_competition(${id})`)))).toBe("28000");
  });
  it("leaving is allowed while it is a draft and refused once it is running", async () => {
    const id = await make();
    await join(P1(), id);
    expect(await leave(P1(), id)).toBe("left");
    expect(await count(id)).toBe(0);
    await join(P1(), id);
    await svc.execute(sql`update competitions set status = 'active' where id = ${id}`);
    expect(await leave(P1(), id)).toBe("closed");
    expect(await count(id)).toBe(1);
  });
  it("a player cannot make someone else leave", async () => {
    const id = await make();
    await join(P1(), id);
    expect(await leave(P2(), id)).toBe("left"); // P2 was never in it: only their own entry is ever touched
    expect(await count(id)).toBe(1);
  });
  it("a draft with registration off is invisible to players but visible to the admin, along with its entries", async () => {
    const id = await make({ open: false });
    await svc.execute(sql`insert into competition_entries (club_id, competition_id, membership_id) values (${ids.A}, ${id}, ${ids.mP2})`);
    expect(await rows(app, P1(), sql`select id from competitions where id = ${id}`)).toHaveLength(0);
    expect(await rows(app, P1(), sql`select id from competition_entries where competition_id = ${id}`)).toHaveLength(0);
    expect(await rows(app, ADMIN(), sql`select id from competitions where id = ${id}`)).toHaveLength(1);
    expect(await rows(app, ADMIN(), sql`select id from competition_entries where competition_id = ${id}`)).toHaveLength(1);
    const open = await make({ open: true });
    expect(await rows(app, P1(), sql`select id from competitions where id = ${open}`)).toHaveLength(1);
  });
  it("only an admin can edit the preview details, and bad values are refused", async () => {
    const id = await make();
    const set = (ctx: { userId: string; clubId: string }, frag: ReturnType<typeof sql>) => withTenant(app, ctx, (tx) => tx.execute(sql`update competitions set ${frag} where id = ${id} returning id`));
    expect((await set(ADMIN(), sql`summary = 'A friendly open', prize = 'Trophy', rules = 'Best of five', max_players = 8`)).rows).toHaveLength(1);
    expect((await set(P1(), sql`summary = 'hacked'`)).rows).toHaveLength(0);
    expect(await denied(set(ADMIN(), sql`summary = ${"x".repeat(141)}`))).toBe("23514");
    expect(await denied(set(ADMIN(), sql`max_players = 1`))).toBe("23514");
    expect(await denied(set(ADMIN(), sql`cover_url = 'javascript:alert(1)'`))).toBe("23514");
    await svc.execute(sql`insert into upload_log (user_id, kind, bytes) values ('adminA', 'competition-cover', 10)`); // the new picture kind is accepted
  });
});

describe("club pages and applications", () => {
  const ADMIN = () => ({ userId: "adminA", clubId: ids.A });
  const P1 = () => ({ userId: "playerA1", clubId: ids.A });
  const ADMIN_B = () => ({ userId: "adminB", clubId: ids.B });
  const anyone = (u: string) => ({ userId: u });
  let n = 0;
  const mkUser = async () => { const id = `appl${++n}`; await svc.execute(sql`insert into users (id, name, email) values (${id}, ${`Applicant ${n}`}, ${`appl${n}@x.com`})`); return id; };
  const mkInvite = async (club: string) => { const code = `APPLY${String(++n).padStart(3, "0")}`; await svc.execute(sql`insert into invites (club_id, code) values (${club}, ${code})`); return code; };
  const setMode = (club: string, mode: "review" | "open") => svc.execute(sql`insert into club_pages (club_id, join_mode) values (${club}, ${mode}) on conflict (club_id) do update set join_mode = ${mode}`);
  const apply = async (u: string, code: string, level = "junior", msg = "Hi") => ((await withTenant(app, anyone(u), (tx) => tx.execute(sql`select app.apply_to_club(${code}, 'Some Name', ${level}::player_level, ${msg}) as r`))).rows[0] as { r: string }).r;
  const decide = async (ctx: { userId: string; clubId?: string }, id: string, yes: boolean) => ((await withTenant(app, ctx, (tx) => tx.execute(sql`select app.decide_application(${id}, ${yes}, 'ok') as r`))).rows[0] as { r: string }).r;
  const appId = async (u: string, club: string) => ((await svc.execute(sql`select id from membership_applications where user_id = ${u} and club_id = ${club} order by created_at desc limit 1`)).rows[0] as { id: string }).id;
  const isMember = async (u: string, club: string) => Number(((await svc.execute(sql`select count(*)::int n from memberships where user_id = ${u} and club_id = ${club} and status = 'active'`)).rows[0] as { n: number }).n) === 1;

  it("club admins write the club page, members read it, players cannot write, other clubs cannot read", async () => {
    expect((await withTenant(app, ADMIN(), (tx) => tx.execute(sql`insert into club_pages (club_id, about, rules, join_mode, published) values (${ids.A}, 'We play on Saturdays', 'Be kind', 'review', true) on conflict (club_id) do update set about = excluded.about, rules = excluded.rules, published = true returning club_id`))).rows).toHaveLength(1);
    expect(await rows(app, P1(), sql`select about from club_pages where club_id = ${ids.A}`)).toHaveLength(1);
    expect((await withTenant(app, P1(), (tx) => tx.execute(sql`update club_pages set rules = 'hacked' where club_id = ${ids.A} returning club_id`))).rows).toHaveLength(0);
    expect(await rows(app, ADMIN_B(), sql`select about from club_pages where club_id = ${ids.A}`)).toHaveLength(0);
    expect(await denied(withTenant(app, ADMIN(), (tx) => tx.execute(sql`update club_pages set join_mode = 'whatever' where club_id = ${ids.A}`)))).toBe("23514");
    expect(await denied(withTenant(app, ADMIN(), (tx) => tx.execute(sql`update club_pages set rules = ${"x".repeat(8001)} where club_id = ${ids.A}`)))).toBe("23514");
  });
  it("a review club records an application instead of a membership, once", async () => {
    await setMode(ids.A, "review");
    const u = await mkUser(), code = await mkInvite(ids.A);
    expect(await apply(u, code)).toBe("applied");
    expect(await isMember(u, ids.A)).toBe(false);
    expect(await apply(u, code)).toBe("pending");
    expect(Number(((await svc.execute(sql`select count(*)::int n from membership_applications where user_id = ${u} and status = 'pending'`)).rows[0] as { n: number }).n)).toBe(1);
  });
  it("applicants see only their own applications; the club's admins see theirs; other clubs' admins see none", async () => {
    await setMode(ids.A, "review");
    const u1 = await mkUser(), u2 = await mkUser(), code = await mkInvite(ids.A);
    await apply(u1, code); await apply(u2, code);
    expect((await rows(app, anyone(u1), sql`select user_id from membership_applications`)).every((r) => (r as { user_id: string }).user_id === u1)).toBe(true);
    expect((await rows(app, ADMIN(), sql`select user_id from membership_applications`)).length).toBeGreaterThanOrEqual(2);
    expect(await rows(app, ADMIN_B(), sql`select id from membership_applications where club_id = ${ids.A}`)).toHaveLength(0);
    expect(await rows(app, P1(), sql`select id from membership_applications where club_id = ${ids.A}`)).toHaveLength(0);
  });
  it("applications cannot be written directly", async () => {
    const u = await mkUser();
    expect(await denied(withTenant(app, anyone(u), (tx) => tx.execute(sql`insert into membership_applications (club_id, user_id, name) values (${ids.A}, ${u}, 'x')`)))).toBe("42501");
    expect(await denied(withTenant(app, ADMIN(), (tx) => tx.execute(sql`update membership_applications set status = 'approved'`)))).toBe("42501");
  });
  it("an admin of the club approves: the membership and profile are created with the chosen level", async () => {
    await setMode(ids.A, "review");
    const u = await mkUser(), code = await mkInvite(ids.A);
    await apply(u, code, "senior");
    const id = await appId(u, ids.A);
    expect(await decide(P1(), id, true)).toBe("closed"); // a player cannot decide
    expect(await decide(ADMIN_B(), id, true)).toBe("closed"); // neither can another club's admin
    expect(await isMember(u, ids.A)).toBe(false);
    expect(await decide(ADMIN(), id, true)).toBe("approved");
    expect(await isMember(u, ids.A)).toBe(true);
    expect(((await svc.execute(sql`select p.level from player_profiles p join memberships m on m.id = p.membership_id where m.user_id = ${u} and m.club_id = ${ids.A}`)).rows[0] as { level: string }).level).toBe("senior");
    expect(await decide(ADMIN(), id, true)).toBe("closed"); // already decided
    expect(await apply(u, code)).toBe("member");
  });
  it("declining creates no membership and records who decided", async () => {
    await setMode(ids.A, "review");
    const u = await mkUser(), code = await mkInvite(ids.A);
    await apply(u, code);
    const id = await appId(u, ids.A);
    expect(await decide(ADMIN(), id, false)).toBe("declined");
    expect(await isMember(u, ids.A)).toBe(false);
    const r = (await svc.execute(sql`select status, decided_by is not null as by, decision_note from membership_applications where id = ${id}`)).rows[0] as { status: string; by: boolean; decision_note: string };
    expect(r).toMatchObject({ status: "declined", by: true, decision_note: "ok" });
    expect(await apply(u, code)).toBe("applied"); // may apply again after a decline
  });
  it("an open club joins people straight away", async () => {
    await setMode(ids.B, "open");
    const u = await mkUser(), code = await mkInvite(ids.B);
    expect(await apply(u, code)).toBe("joined");
    expect(await isMember(u, ids.B)).toBe(true);
  });
  it("invalid codes, suspended members and the daily limit are handled", async () => {
    const u = await mkUser();
    expect(await apply(u, "NOSUCHCODE")).toBe("invalid");
    await setMode(ids.A, "review");
    const code = await mkInvite(ids.A);
    await svc.execute(sql`insert into memberships (club_id, user_id, status) values (${ids.A}, ${u}, 'suspended')`);
    expect(await apply(u, code)).toBe("blocked");
    const v = await mkUser();
    const codes = await Promise.all([ids.A, ids.A, ids.A, ids.A, ids.A].map((c) => mkInvite(c)));
    for (let i = 0; i < 5; i++) { await svc.execute(sql`insert into membership_applications (club_id, user_id, name, status) values (${ids.A}, ${v}, 'x', 'declined')`); }
    expect(await apply(v, codes[0]!)).toBe("limit");
  });
  it("an applicant can withdraw their own pending application only", async () => {
    await setMode(ids.A, "review");
    const u = await mkUser(), other = await mkUser(), code = await mkInvite(ids.A);
    await apply(u, code);
    const id = await appId(u, ids.A);
    const wd = async (who: string) => ((await withTenant(app, anyone(who), (tx) => tx.execute(sql`select app.withdraw_application(${id}) as r`))).rows[0] as { r: string }).r;
    expect(await wd(other)).toBe("closed");
    expect(await wd(u)).toBe("withdrawn");
    expect(await wd(u)).toBe("closed");
  });
});

describe("admin team and responsibilities", () => {
  const OWNER = () => ({ userId: "adminA", clubId: ids.A });
  let n = 0;
  async function mkAdmin(perms: string[], club = ids.A) {
    const u = `team${++n}`;
    await svc.execute(sql`insert into users (id, name, email) values (${u}, ${`Team ${n}`}, ${`team${n}@x.com`})`);
    const r = await svc.execute(sql`insert into memberships (club_id, user_id, roles, permissions) values (${club}, ${u}, ARRAY['admin','player']::member_role[], ${sql.raw(`ARRAY[${perms.map((p) => `'${p}'`).join(",")}]::text[]`)}) returning id`);
    return { u, id: (r.rows[0] as { id: string }).id, ctx: { userId: u, clubId: club } };
  }
  const can = async (ctx: { userId: string; clubId: string }, perm: string) => ((await withTenant(app, ctx, (tx) => tx.execute(sql`select app.has_permission(${ctx.clubId}, ${perm}) as r`))).rows[0] as { r: boolean }).r;
  const setAdmin = async (ctx: { userId: string; clubId?: string }, member: string, perms: string[]) => ((await withTenant(app, ctx, (tx) => tx.execute(sql`select app.set_admin(${member}, ${sql.raw(`ARRAY[${perms.map((p) => `'${p}'`).join(",")}]::text[]`)}) as r`))).rows[0] as { r: string }).r;
  const removeAdmin = async (ctx: { userId: string; clubId?: string }, member: string) => ((await withTenant(app, ctx, (tx) => tx.execute(sql`select app.remove_admin(${member}) as r`))).rows[0] as { r: string }).r;

  it("the owner has every responsibility; an admin has only the ones they were given; a player has none", async () => {
    const fin = await mkAdmin(["finance"]);
    for (const p of ["members", "competitions", "finance", "facilities"]) expect(await can(OWNER(), p)).toBe(true);
    expect(await can(fin.ctx, "finance")).toBe(true);
    for (const p of ["members", "competitions", "facilities"]) expect(await can(fin.ctx, p)).toBe(false);
    expect(await can({ userId: "playerA1", clubId: ids.A }, "finance")).toBe(false);
    expect(await can({ userId: "adminB", clubId: ids.A }, "finance")).toBe(false); // another club's owner has nothing here
  });
  it("a finance admin can manage fees but not competitions, invites or the club page", async () => {
    const fin = await mkAdmin(["finance"]);
    expect((await withTenant(app, fin.ctx, (tx) => tx.execute(sql`insert into plans (club_id, name, price_kobo, period) values (${ids.A}, 'Quarterly', 1000, 'monthly') returning id`))).rows).toHaveLength(1);
    expect(await denied(withTenant(app, fin.ctx, (tx) => tx.execute(sql`insert into competitions (club_id, name, format) values (${ids.A}, 'No', 'knockout')`)))).toBe("42501");
    expect(await denied(withTenant(app, fin.ctx, (tx) => tx.execute(sql`insert into invites (club_id, code) values (${ids.A}, 'FINADM01')`)))).toBe("42501");
    expect(await denied(withTenant(app, fin.ctx, (tx) => tx.execute(sql`insert into club_pages (club_id, about) values (${ids.A}, 'x') on conflict (club_id) do update set about = 'x'`)))).toBe("42501");
  });
  it("a competitions admin can create and score but cannot touch fees", async () => {
    const comp = await mkAdmin(["competitions"]);
    expect((await withTenant(app, comp.ctx, (tx) => tx.execute(sql`insert into competitions (club_id, name, format) values (${ids.A}, 'Open', 'knockout') returning id`))).rows).toHaveLength(1);
    expect(await denied(withTenant(app, comp.ctx, (tx) => tx.execute(sql`insert into plans (club_id, name, price_kobo, period) values (${ids.A}, 'Nope', 1, 'monthly')`)))).toBe("42501");
    expect(await rows(app, comp.ctx, sql`select id from dues where club_id = ${ids.A}`)).toHaveLength(0); // cannot read other people's dues
  });
  it("a members admin can invite and review applications but cannot score", async () => {
    const mem = await mkAdmin(["members"]);
    expect((await withTenant(app, mem.ctx, (tx) => tx.execute(sql`insert into invites (club_id, code) values (${ids.A}, ${`MEM${n}ADM1`}) returning id`))).rows).toHaveLength(1);
    expect((await withTenant(app, mem.ctx, (tx) => tx.execute(sql`update matches set status = 'live' where id = ${ids.matchA} returning id`))).rows).toHaveLength(0);
  });
  it("scorers can still record results without any admin responsibility", async () => {
    expect((await withTenant(app, { userId: "scorerA", clubId: ids.A }, (tx) => tx.execute(sql`update matches set status = 'live' where id = ${ids.matchA} returning id`))).rows).toHaveLength(1);
  });
  it("an admin cannot hand themselves or anyone else more power", async () => {
    const a = await mkAdmin(["members"]), b = await mkAdmin([]);
    expect(await setAdmin(a.ctx, a.id, ["members", "finance"])).toBe("closed");
    expect(await setAdmin(a.ctx, b.id, ["finance"])).toBe("closed");
    expect(await denied(withTenant(app, a.ctx, (tx) => tx.execute(sql`update memberships set permissions = ARRAY['finance']::text[] where id = ${a.id}`)))).toBe("42501");
    expect(await removeAdmin(a.ctx, b.id)).toBe("closed");
  });
  it("only the club owner makes, changes and removes admins", async () => {
    const mem = ((await svc.execute(sql`insert into users (id, name, email) values ('cand1', 'Candidate', 'cand1@x.com')`)), (await svc.execute(sql`insert into memberships (club_id, user_id) values (${ids.A}, 'cand1') returning id`)).rows[0] as { id: string });
    expect(await setAdmin({ userId: "playerA1", clubId: ids.A }, mem.id, ["finance"])).toBe("closed"); // a player cannot
    expect(await setAdmin({ userId: "adminB", clubId: ids.B }, mem.id, ["finance"])).toBe("closed"); // another club's owner cannot
    expect(await setAdmin(OWNER(), mem.id, ["finance", "members"])).toBe("ok");
    const r = (await svc.execute(sql`select roles::text, permissions from memberships where id = ${mem.id}`)).rows[0] as { roles: string; permissions: string[] };
    expect(r.roles).toContain("admin"); expect(r.roles).toContain("player"); expect([...r.permissions].sort()).toEqual(["finance", "members"]);
    expect(await setAdmin(OWNER(), mem.id, ["finance", "powers"])).toBe("invalid");
    expect(await setAdmin(OWNER(), mem.id, ["competitions"])).toBe("ok"); // replace the set
    expect(((await svc.execute(sql`select permissions from memberships where id = ${mem.id}`)).rows[0] as { permissions: string[] }).permissions).toEqual(["competitions"]);
    expect(await removeAdmin(OWNER(), mem.id)).toBe("ok");
    const after = (await svc.execute(sql`select roles::text, permissions from memberships where id = ${mem.id}`)).rows[0] as { roles: string; permissions: string[] };
    expect(after.roles).not.toContain("admin"); expect(after.permissions).toEqual([]);
  });
  it("the owner cannot be demoted or edited, and unknown permissions are refused by the table too", async () => {
    expect(await setAdmin(OWNER(), ids.mAdminA, ["finance"])).toBe("owner");
    expect(await removeAdmin(OWNER(), ids.mAdminA)).toBe("owner");
    expect(await denied(svc.execute(sql`update memberships set permissions = ARRAY['everything']::text[] where id = ${ids.mP1}`))).toBe("23514");
  });
  it("a suspended club's admins lose every responsibility", async () => {
    const x = await mkAdmin(["finance"]);
    await svc.execute(sql`update clubs set status = 'suspended', suspension_reason = 'other' where id = ${ids.A}`);
    expect(await can(x.ctx, "finance")).toBe(false);
    await svc.execute(sql`update clubs set status = 'active', suspension_reason = null where id = ${ids.A}`);
    expect(await can(x.ctx, "finance")).toBe(true);
  });
});

describe("friendly challenges", () => {
  const p1 = () => ({ userId: "playerA1", clubId: ids.A });
  const p2 = () => ({ userId: "playerA2", clubId: ids.A });
  const fn = async (ctx: { userId: string; clubId: string }, q: ReturnType<typeof sql>) =>
    String((await rows(app, ctx, q))[0]!.r);
  const propose = (ctx: { userId: string; clubId: string }, opp: string, rated = false, bestOf = 3) =>
    fn(ctx, sql`select app.propose_challenge(${opp}::uuid, now() + interval '1 day', 'Fancy a game?', ${bestOf}, ${rated}) as r`);
  const latest = async () => (await svc.execute(sql`select * from challenges where club_id = ${ids.A} order by created_at desc limit 1`)).rows[0] as Record<string, unknown>;
  const reset = () => svc.execute(sql`delete from challenges`);

  it("a player challenges another member; only the two players can read it", async () => {
    await reset();
    expect(await propose(p1(), ids.mP2)).toBe("sent");
    expect(await rows(app, p1(), sql`select id from challenges`)).toHaveLength(1);
    expect(await rows(app, p2(), sql`select id from challenges`)).toHaveLength(1);
    expect(await rows(app, { userId: "multi", clubId: ids.A }, sql`select id from challenges`)).toHaveLength(0); // another member
    expect(await rows(app, { userId: "adminA", clubId: ids.A }, sql`select id from challenges`)).toHaveLength(0); // even the club admin
    expect(await rows(app, { userId: "adminB", clubId: ids.B }, sql`select id from challenges`)).toHaveLength(0);
  });
  it("nobody writes challenges directly, and the rules of a challenge are enforced", async () => {
    expect(await denied(withTenant(app, p1(), (tx) => tx.execute(sql`insert into challenges (club_id, challenger_id, opponent_id) values (${ids.A}, ${ids.mP1}, ${ids.mP2})`)))).toBe("42501");
    expect(await denied(withTenant(app, p1(), (tx) => tx.execute(sql`update challenges set status = 'confirmed'`)))).toBe("42501");
    expect(await propose(p1(), ids.mP1)).toBe("self");
    expect(await propose(p1(), ids.mP2)).toBe("exists"); // one open challenge per pair, in either direction
    expect(await propose(p2(), ids.mP1)).toBe("exists");
    expect(await propose(p1(), ids.mAdminB)).toBe("unknown"); // a member of another club
    expect(await propose(p1(), ids.mMultiA, false, 4)).toBe("invalid");
    expect(await fn(p1(), sql`select app.propose_challenge(${ids.mMultiA}::uuid, now() - interval '2 days', null, 3, false) as r`)).toBe("past");
    expect(await fn({ userId: "stranger", clubId: ids.A }, sql`select app.propose_challenge(${ids.mP1}::uuid, null, null, 3, false) as r`)).toBe("denied");
  });
  it("only the challenged player answers; accepting records their own rating choice", async () => {
    const c = await latest();
    expect(await fn(p1(), sql`select app.respond_challenge(${c.id}::uuid, true, true) as r`)).toBe("denied");
    expect(await fn({ userId: "multi", clubId: ids.A }, sql`select app.respond_challenge(${c.id}::uuid, true, true) as r`)).toBe("denied");
    expect(await fn(p2(), sql`select app.respond_challenge(${c.id}::uuid, true, true) as r`)).toBe("accepted");
    expect(await fn(p2(), sql`select app.respond_challenge(${c.id}::uuid, true, true) as r`)).toBe("closed");
    const after = await latest();
    expect(after.status).toBe("accepted");
    expect(after.opponent_rated).toBe(true);
    expect(after.challenger_rated).toBe(false);
  });
  it("a result is entered by one player and confirmed by the other; the same player cannot confirm their own score", async () => {
    const c = await latest();
    expect(await fn({ userId: "multi", clubId: ids.A }, sql`select app.record_challenge_result(${c.id}::uuid, 2, 0) as r`)).toBe("denied");
    expect(await fn(p1(), sql`select app.record_challenge_result(${c.id}::uuid, 3, 0) as r`)).toBe("invalid"); // best of 3 needs 2
    expect(await fn(p1(), sql`select app.record_challenge_result(${c.id}::uuid, 2, 2) as r`)).toBe("invalid");
    expect(await fn(p1(), sql`select app.record_challenge_result(${c.id}::uuid, 1, 1) as r`)).toBe("invalid");
    expect(await fn(p1(), sql`select app.record_challenge_result(${c.id}::uuid, 2, 1) as r`)).toBe("recorded");
    const mid = await latest();
    expect(mid.status).toBe("awaiting");
    expect([mid.challenger_games, mid.opponent_games]).toEqual([2, 1]);
    expect(await fn(p1(), sql`select app.confirm_challenge_result(${c.id}::uuid, true, true) as r`)).toBe("denied");
    expect(await fn(p2(), sql`select app.record_challenge_result(${c.id}::uuid, 2, 0) as r`)).toBe("closed"); // already waiting for confirmation
  });
  it("disputing clears the score; confirming makes it final, and it counts only if both agreed", async () => {
    const c = await latest();
    expect(await fn(p2(), sql`select app.confirm_challenge_result(${c.id}::uuid, false, false) as r`)).toBe("disputed");
    expect(await latest()).toMatchObject({ status: "accepted", challenger_games: null, opponent_games: null });
    // The opponent enters it this time (they won 2-1): scores are stored from the challenger's point of view.
    expect(await fn(p2(), sql`select app.record_challenge_result(${c.id}::uuid, 2, 1) as r`)).toBe("recorded");
    expect(await latest()).toMatchObject({ challenger_games: 1, opponent_games: 2 });
    expect(await fn(p1(), sql`select app.confirm_challenge_result(${c.id}::uuid, true, false) as r`)).toBe("confirmed");
    const done = await latest();
    expect(done.status).toBe("confirmed");
    expect(done.challenger_rated).toBe(false); // the challenger said no, so it will not count
    expect(done.opponent_rated).toBe(true);
    expect(await fn(p1(), sql`select app.cancel_challenge(${c.id}::uuid) as r`)).toBe("closed");
  });
  it("withdrawing: only the challenger cancels an unanswered challenge; either may call off an accepted one", async () => {
    await reset();
    await propose(p1(), ids.mP2);
    const c = await latest();
    expect(await fn(p2(), sql`select app.cancel_challenge(${c.id}::uuid) as r`)).toBe("denied");
    expect(await fn(p1(), sql`select app.cancel_challenge(${c.id}::uuid) as r`)).toBe("cancelled");
    await propose(p1(), ids.mP2);
    const d = await latest();
    await fn(p2(), sql`select app.respond_challenge(${d.id}::uuid, false, false) as r`);
    expect((await latest()).status).toBe("declined");
    await propose(p2(), ids.mP1);
    const e = await latest();
    await fn(p1(), sql`select app.respond_challenge(${e.id}::uuid, true, false) as r`);
    expect(await fn(p1(), sql`select app.cancel_challenge(${e.id}::uuid) as r`)).toBe("cancelled");
  });
  it("a player has at most five unanswered challenges, and a suspended club blocks everything", async () => {
    await reset();
    const users = ["ch1", "ch2", "ch3", "ch4", "ch5", "ch6"];
    await svc.insert(s.users).values(users.map((u) => ({ id: u, name: u, email: `${u}@x.com` })));
    const ms = await svc.insert(s.memberships).values(users.map((u) => ({ clubId: ids.A, userId: u }))).returning();
    for (const m of ms.slice(0, 5)) expect(await propose(p1(), m.id)).toBe("sent");
    expect(await propose(p1(), ms[5]!.id)).toBe("limit");
    await reset();
    await svc.execute(sql`update clubs set status = 'suspended', suspension_reason = 'other' where id = ${ids.A}`);
    expect(await propose(p1(), ids.mP2)).toBe("denied");
    await svc.execute(sql`update clubs set status = 'active', suspension_reason = null where id = ${ids.A}`);
  });
});
