import Link from "next/link";
import { BackButton, PageShell, Panel } from "@rallix/ui";
import { MatchRulesForm } from "./MatchRulesForm";
import { inClub, requirePermission } from "../../../../lib/context";
import { clubRules } from "../../../../lib/match-rules";

export const dynamic = "force-dynamic";

export default async function MatchRules() {
  const ctx = await requirePermission("competitions");
  const r = await inClub(ctx, (tx) => clubRules(tx, ctx.club.clubId));
  return (
    <PageShell back={<BackButton href="/profile" linkAs={Link} />} title="Match rules">
      <p className="rx-muted" style={{ margin: "0 0 12px" }}>How your club plays a match. New competitions start with this, and you can change it for a single competition when you create it.</p>
      <Panel><MatchRulesForm initial={{ bestOf: r.bestOf, points: r.rules.points, winBy: r.rules.winBy, cap: r.rules.cap }} /></Panel>
    </PageShell>
  );
}
