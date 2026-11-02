import Link from "next/link";
import { BackButton, EmptyState, IconBadge, ListGroup, ListRow, PageShell, Panel, Pill, SectionTitle } from "@rallix/ui";
import { PayButton } from "../../../../../components/PayButton";
import { inClub, requireClub } from "../../../../../lib/context";
import { payoutsEnabled } from "../../../../../lib/payment-queries";
import { ownEmailOptOut } from "../../../../../lib/contact";
import { listDues, listPayments, naira, fmtDate } from "../../../../../lib/queries";

export default async function PlayerPayments() {
  const ctx = await requireClub();
  const me = ctx.club.membershipId;
  const d = await inClub(ctx, async (tx) => ({ dues: await listDues(tx, ctx.club.clubId, me), pays: await listPayments(tx, ctx.club.clubId, me) }));
  const payOn = await payoutsEnabled(ctx);
  const optedOut = await ownEmailOptOut(ctx.user.id);
  const due = d.dues.find((x) => x.status === "due" || x.status === "overdue");
  return (
    <PageShell back={<BackButton href="/play/me" linkAs={Link} />} title="Payments">
      {due ? (
        <Panel>
          <p className="rx-muted" style={{ margin: 0 }}>{due.plan} · due {fmtDate(due.dueDate)}</p>
          <p className="rx-metric__value" style={{ margin: "4px 0 16px", fontSize: 40 }}>{naira(due.amountKobo)}</p>
          {due.status === "overdue" ? <p style={{ margin: "0 0 12px" }}><Pill tone="warning">Overdue</Pill></p> : null}
          <PayButton dueId={due.id} amount={naira(due.amountKobo)} enabled={payOn} />
        </Panel>
      ) : <EmptyState compact title={d.dues.length ? "You’re all paid up" : "No dues yet"} hint={d.dues.length ? "Nothing to pay right now." : "Dues your club bills you will show up here."} />}
      {optedOut ? <p className="rx-muted" style={{ fontSize: 14 }}>You’ve turned off reminder emails, so check here for what’s due. <Link href="/play/me" style={{ textDecoration: "underline" }}>Change this</Link></p> : null}
      {d.pays.length > 0 ? (
        <>
          <SectionTitle title="History" />
          <ListGroup label="Payment history">
            {d.pays.map((p) => {
              const notDone = p.status === "pending" && Date.now() - p.createdAt.getTime() > 3600_000;
              const date = (p.paidAt ?? p.createdAt).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
              return <ListRow key={p.id} media={<IconBadge icon="money" />} title={p.method ? `Payment · ${p.method}` : "Payment"} subtitle={`${date}${notDone ? " · not completed" : ""}`}
                trailing={<>{naira(p.amountKobo)} {p.status !== "paid" ? <Pill tone={p.status === "failed" ? "warning" : "neutral"}>{p.status}</Pill> : null}</>} tone={p.status === "paid" ? "good" : undefined} />;
            })}
          </ListGroup>
        </>
      ) : null}
    </PageShell>
  );
}
