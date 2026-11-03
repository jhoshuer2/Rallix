import type { ReactNode } from "react";
import { sql } from "drizzle-orm";
import { Nav } from "../../components/Nav";
import { db } from "../../lib/db";
import { staffCan, type Area } from "@rallix/config/staff";
import { requireAdmin } from "../../lib/guard";
import { attentionCount } from "../../lib/queries";

export default async function ConsoleLayout({ children }: { children: ReactNode }) {
  const staff = await requireAdmin();
  const open = Number(((await db().execute(sql`select count(*)::int as n from issues where status in ('open','investigating')`)).rows[0] as { n: number }).n);
  // A failing badge count must never take the whole console down.
  const attention = await attentionCount().catch(() => 0);
  return (
    <div className="cs-shell">
      <aside className="cs-side">
        <div className="cs-brand">Rallix<small>Platform console</small></div>
        <Nav items={([
          { href: "/", label: "Overview", area: null },
          { href: "/clubs", label: "Clubs", area: "clubs" },
          { href: "/billing", label: "Billing", area: "billing" },
          { href: "/plans", label: "Plans", area: "billing" },
          { href: "/invoices", label: "Invoices", area: "billing" },
          { href: "/payments", label: "Payments", count: attention, area: "billing" },
          { href: "/notifications", label: "Notifications", area: "notifications" },
          { href: "/templates", label: "Templates", area: "templates" },
          { href: "/issues", label: "Issues", count: open, area: "support" },
          { href: "/audit", label: "Audit log", area: "audit" },
          { href: "/team", label: "Team", area: "team" },
        ] as Array<{ href: string; label: string; count?: number; area: Area | null }>).filter((i) => i.area === null || staffCan(staff.role, i.area)).map(({ area: _a, ...i }) => i)} />
        <div className="cs-who">{staff.name}<br /><a href="/sign-out">Sign out</a></div>
      </aside>
      <main className="cs-main">{children}</main>
    </div>
  );
}
