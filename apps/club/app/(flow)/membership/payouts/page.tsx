import Link from "next/link";
import { BackButton, PageHead } from "@rallix/ui";
import { requireRole } from "../../../../lib/context";
import { payoutDetails } from "../../../../lib/payment-queries";
import { provider } from "../../../../lib/payments";
import { PayoutForm } from "./PayoutForm";

export default async function Payouts() {
  const ctx = await requireRole("admin");
  const [details, banks] = await Promise.all([payoutDetails(ctx), provider().listBanks().catch(() => [])]);
  return (
    <>
      <PageHead back={<BackButton href="/membership" linkAs={Link} />} title="Payout account" />
      <p className="rx-muted" style={{ marginTop: 0 }}>Player dues paid in the app settle to this account. Rallix takes no share of dues; the payment provider’s processing fee is deducted from what your club receives.</p>
      {details ? <div className="rx-card" style={{ marginBottom: 24 }}><strong>Current account</strong><p style={{ margin: "8px 0 0" }}>{details.bank} ••{details.last4}<br />{details.name}</p></div> : null}
      {banks.length === 0 ? <p className="rx-error" role="alert">We couldn’t load the list of banks. Please try again in a moment.</p> : <PayoutForm banks={banks} replacing={!!details} />}
    </>
  );
}
