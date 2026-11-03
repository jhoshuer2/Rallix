import Link from "next/link";
import { BackButton, PageShell } from "@rallix/ui";
import { inClub, requirePermission } from "../../../../lib/context";
import { listDues, naira, fmtDate } from "../../../../lib/queries";
import { reminderCounts } from "../../../../lib/reminder-queries";
import { Payments } from "./Payments";

export default async function PaymentsPage() {
  const ctx = await requirePermission("finance");
  const dues = await inClub(ctx, (tx) => listDues(tx, ctx.club.clubId));
  const reminded = await reminderCounts(ctx.club.clubId, dues.map((d) => d.id));
  const map = { due: "pending", overdue: "failed", paid: "paid", waived: "refunded" } as const;
  return (
    <PageShell back={<BackButton href="/membership" linkAs={Link} />} title="Payments">
      <Payments rows={dues.map((d, i) => ({ rank: i + 1, name: d.name, photo: d.photo ?? undefined, detail: `${d.plan} • ${d.periodLabel} • due ${fmtDate(d.dueDate)}${reminded.get(d.id) ? ` • reminded ${reminded.get(d.id)}×` : ""}`, amount: naira(d.amountKobo), status: map[d.status as keyof typeof map] ?? "pending", dueId: d.id, unpaid: d.status === "due" || d.status === "overdue" }))} />
    </PageShell>
  );
}
