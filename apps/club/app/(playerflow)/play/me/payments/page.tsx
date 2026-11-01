import Link from "next/link";
import { BackButton, DueCard, PageHead, PaymentRow, SectionHeader } from "@rallix/ui";
import { PayButton } from "../../../../../components/PayButton";
import { inClub, requireClub } from "../../../../../lib/context";
import { payoutsEnabled } from "../../../../../lib/payment-queries";
import { listDues, listPayments, naira, fmtDate} from "../../../../../lib/queries";

export default async function PlayerPayments() {
  const ctx = await requireClub();
  const me = ctx.club.membershipId;
  const d = await inClub(ctx, async (tx) => ({ dues: await listDues(tx, ctx.club.clubId, me), pays: await listPayments(tx, ctx.club.clubId, me) }));
  const payOn = await payoutsEnabled(ctx);
  const due = d.dues.find((x) => x.status === "due" || x.status === "overdue");
  return (
    <>
      <PageHead back={<BackButton href="/play/me" linkAs={Link} />} title="Payments" />
      {due ? <DueCard plan={due.plan} amount={naira(due.amountKobo)} due={fmtDate(due.dueDate)} status={due.status === "overdue" ? "overdue" : "due"} action={<PayButton dueId={due.id} amount={naira(due.amountKobo)} enabled={payOn} />} /> : <p className="rx-muted">You’re all paid up.</p>}
      <SectionHeader title="History" />
      {d.pays.length === 0 ? <p className="rx-muted">No payments yet.</p> : (
        <ul className="rx-pays">
          {d.pays.map((p, i) => <PaymentRow key={p.id} rank={i + 1} name={p.method ? `Payment · ${p.method}` : "Payment"} detail={(p.paidAt ?? p.createdAt).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" }) + (p.status === "pending" && Date.now() - p.createdAt.getTime() > 3600_000 ? " · not completed" : "")} amount={naira(p.amountKobo)} status={p.status} />)}
        </ul>
      )}
    </>
  );
}
