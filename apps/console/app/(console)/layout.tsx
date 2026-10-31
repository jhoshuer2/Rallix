import type { ReactNode } from "react";
import { sql } from "drizzle-orm";
import { Nav } from "../../components/Nav";
import { db } from "../../lib/db";
import { requireAdmin } from "../../lib/guard";

export default async function ConsoleLayout({ children }: { children: ReactNode }) {
  const staff = await requireAdmin();
  const open = Number(((await db().execute(sql`select count(*)::int as n from issues where status in ('open','investigating')`)).rows[0] as { n: number }).n);
  return (
    <div className="cs-shell">
      <aside className="cs-side">
        <div className="cs-brand">Rallix<small>Platform console</small></div>
        <Nav items={[
          { href: "/", label: "Overview" },
          { href: "/clubs", label: "Clubs" },
          { href: "/billing", label: "Billing" },
          { href: "/invoices", label: "Invoices" },
          { href: "/notifications", label: "Notifications" },
          { href: "/templates", label: "Templates" },
          { href: "/issues", label: "Issues", count: open },
          { href: "/audit", label: "Audit log" },
          { href: "/team", label: "Team" },
        ]} />
        <div className="cs-who">{staff.name}<br /><a href="/sign-out">Sign out</a></div>
      </aside>
      <main className="cs-main">{children}</main>
    </div>
  );
}
