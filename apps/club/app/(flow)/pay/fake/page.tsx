import { notFound, redirect } from "next/navigation";
import { EntryShell, Pill } from "@rallix/ui";
import { FakeProvider, FAKE_SECRET, signBody } from "@rallix/payments";
import { appUrl, provider } from "../../../../lib/payments";
import { naira } from "../../../../lib/queries";

export const dynamic = "force-dynamic";

/** Stand-in for Paystack's hosted checkout. Exists only when PAYMENTS_PROVIDER=fake (never in production). */
export default async function FakeCheckout({ searchParams }: { searchParams: Promise<{ reference?: string; callback?: string }> }) {
  if (provider().name !== "fake") notFound();
  const { reference = "", callback = "" } = await searchParams;
  const tx = FakeProvider.get(reference);
  if (!tx) notFound();
  const safeCallback = callback.startsWith(appUrl() + "/") ? callback : `${appUrl()}/pay/return?reference=${reference}`;

  async function settle(formData: FormData) {
    "use server";
    const outcome = formData.get("outcome") === "fail" ? "failed" : "success";
    FakeProvider.complete(reference, outcome);
    if (outcome === "success") {
      // Like Paystack, tell our webhook about it (signed with the shared secret).
      const { body } = FakeProvider.webhookBody(reference);
      await fetch(`${appUrl()}/api/webhooks/paystack`, { method: "POST", headers: { "content-type": "application/json", "x-paystack-signature": signBody(FAKE_SECRET, body) }, body });
    }
    redirect(safeCallback);
  }
  return (
    <EntryShell title={`Pay ${naira(tx.amountKobo)}`} subtitle={`Reference ${reference}`} hero={<p style={{ margin: "16px 0 0" }}><Pill>Test checkout, no real money</Pill></p>}>
      <form action={settle} style={{ display: "grid", gap: 12 }}>
        <button className="rx-btn rx-btn--block" name="outcome" value="pay">Pay now</button>
        <button className="rx-btn rx-btn--ghost rx-btn--block" name="outcome" value="fail">Simulate a failed payment</button>
      </form>
    </EntryShell>
  );
}
