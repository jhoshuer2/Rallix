/**
 * Every exported function in a "use server" file is a public endpoint. This test reads those files and fails when an exported
 * action reaches the database or the service role before it has checked who is calling.
 * A new action that is deliberately public must be added to PUBLIC below, with the reason.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(__dirname, "../../..");
const GUARDS = /\b(requireClub|requireRole|requirePermission|requireScoringAccess|requireAdmin|getCtx|getSessionUser|requireUser)\(/;
// Helpers that start with a guard themselves (checked below): friendly-actions' `call()`.
const HELPER_GUARDS: Record<string, RegExp> = { "apps/club/lib/friendly-actions.ts": /\bcall\(/ };
const TOUCHES_DATA = /\b(inClub|serviceDb|appDb|withTenant|db\.|sql`)/;

/** Public on purpose: they are reached with a secret token or before sign-in, and check that token themselves. */
const PUBLIC: Record<string, string> = {
  "apps/club/lib/payment-actions.ts#startInvoicePaymentByToken": "pay link: the unguessable token is the credential, rate limited per invoice",
  "apps/club/lib/preference-actions.ts#setOptOutByToken": "unsubscribe link: a signed token is the credential",
};

function actionFiles(): string[] {
  const out: string[] = [];
  for (const dir of ["apps/club/lib", "apps/console/lib"]) {
    for (const f of readdirSync(join(root, dir))) {
      if (!f.endsWith(".ts")) continue;
      const rel = `${dir}/${f}`;
      const head = readFileSync(join(root, rel), "utf8").split("\n", 3).join("\n");
      if (/["']use server["']/.test(head)) out.push(rel);
    }
  }
  return out;
}

function actions(src: string): Array<{ name: string; body: string }> {
  const res: Array<{ name: string; body: string }> = [];
  const re = /^export async function (\w+)/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const rest = src.slice(m.index + m[0].length);
    const next = rest.search(/^(export |async function |function )/m);
    res.push({ name: m[1]!, body: src.slice(m.index, m.index + m[0].length + (next === -1 ? rest.length : next)) });
  }
  return res;
}

describe("server actions check the caller before touching data", () => {
  const files = actionFiles();
  it("finds the action files", () => { expect(files.length).toBeGreaterThan(10); });
  for (const rel of files) {
    const list = actions(readFileSync(join(root, rel), "utf8"));
    for (const a of list) {
      it(`${rel} ${a.name}`, () => {
        if (PUBLIC[`${rel}#${a.name}`]) return;
        const guard = GUARDS.exec(a.body) ?? HELPER_GUARDS[rel]?.exec(a.body) ?? null;
        expect(guard, `${a.name} never checks who is calling`).not.toBeNull();
        const data = TOUCHES_DATA.exec(a.body);
        if (data) expect(guard!.index, `${a.name} uses data before checking the caller`).toBeLessThan(data.index);
      });
    }
  }
  it("every public exception still exists (remove it from PUBLIC when the action goes away)", () => {
    for (const key of Object.keys(PUBLIC)) {
      const [rel, name] = key.split("#");
      expect(actions(readFileSync(join(root, rel!), "utf8")).some((a) => a.name === name), key).toBe(true);
    }
  });
});
