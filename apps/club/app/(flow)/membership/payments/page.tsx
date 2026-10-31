import Link from "next/link";
import { BackButton } from "@rallix/ui";
import { inClub, requireRole } from "../../../../lib/context";
import { listDues, naira, fmtDate} from "../../../../lib/queries";
import { Payments } from "./Payments";

export default async function PaymentsPage() {
  const ctx = await requireRole("admin");
  const dues = await inClub(ctx, (tx) => listDues(tx, ctx.club.clubId));
  const map = { due: "pending", overdue: "failed", paid: "paid", waived: "refunded" } as const;
  return (
    <>
      <div style={{ marginBottom: 16 }}><BackButton href="/membership" linkAs={Link} /></div>
      <Payments rows={dues.map((d, i) => ({ rank: i + 1, name: d.name, photo: d.photo ?? undefined, detail: `${d.plan} • ${d.periodLabel} • due ${fmtDate(d.dueDate)}`, amount: naira(d.amountKobo), status: map[d.status] }))} />
    </>
  );
}
