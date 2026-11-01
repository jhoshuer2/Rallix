import Link from "next/link";
import { BackButton, ListGroup, ListRow, IconBadge, PageShell, Panel } from "@rallix/ui";
import { requireRole } from "../../../../lib/context";
import { payoutDetails } from "../../../../lib/payment-queries";
import { provider } from "../../../../lib/payments";
import { PayoutForm } from "./PayoutForm";

export default async function Payouts() {
  const ctx = await requireRole("admin");
  const [details, banks] = await Promise.all([payoutDetails(ctx), provider().listBanks().catch(() => [])]);
  return (
    <PageShell back={<BackButton href="/membership" linkAs={Link} />} title="Payout account">
      {details ? <ListGroup label="Current account"><ListRow media={<IconBadge icon="wallet" />} title={`${details.bank} ••${details.last4}`} subtitle={details.name ?? undefined} /></ListGroup> : null}
      <p className="rx-muted" style={{ margin: "16px 0 0", fontSize: 14 }}>Player dues paid in the app settle to this account. Rallix takes no share of dues; the payment provider’s processing fee is deducted from what your club receives.</p>
      {banks.length === 0 ? <p className="rx-error" role="alert">We couldn’t load the list of banks. Please try again in a moment.</p> : <Panel title={details ? "Change account" : "Add your bank account"}><PayoutForm banks={banks} replacing={!!details} /></Panel>}
    </PageShell>
  );
}
