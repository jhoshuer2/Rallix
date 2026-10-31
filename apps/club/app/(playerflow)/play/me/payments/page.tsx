import Link from "next/link";
import { BackButton, DueCard, PageHead, PaymentRow, SectionHeader } from "@rallix/ui";
import { PayButton } from "../../../../../components/PayButton";
import { due, me, myPayments } from "../../../../../lib/mock";

export default function PlayerPayments() {
  return (
    <>
      <PageHead back={<BackButton href="/play/me" linkAs={Link} />} title="Payments" />
      <DueCard plan={due.plan} amount={due.amount} due={due.due} status={due.status} action={<PayButton amount={due.amount} />} />
      <SectionHeader title="History" />
      <ul className="rx-pays">
        {myPayments.map((p, i) => <PaymentRow key={p.id} rank={i + 1} name={p.title} photo={me.photo} detail={`${p.date} · receipt`} amount={p.amount} status={p.status} />)}
      </ul>
    </>
  );
}
