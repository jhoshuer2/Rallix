import { notFound, redirect } from "next/navigation";
import { FakeProvider, FAKE_SECRET, signBody } from "@rallix/payments";
import { getCtx } from "../../../../lib/context";
import { appUrl, provider } from "../../../../lib/payments";
import { naira } from "../../../../lib/queries";

export const dynamic = "force-dynamic";

/** Stand-in for Paystack's hosted checkout. Exists only when PAYMENTS_PROVIDER=fake (never in production). */
export default async function FakeCheckout({ searchParams }: { searchParams: Promise<{ reference?: string; callback?: string }> }) {
  if (provider().name !== "fake") notFound();
  const { reference = "", callback = "" } = await searchParams;
  if (!(await getCtx())) redirect("/sign-in");
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
    <main style={{ paddingTop: 48 }}>
      <p className="rx-chip rx-chip--light" style={{ marginBottom: 12 }}>Test checkout, no real money</p>
      <h1 className="rx-title" style={{ marginBottom: 8 }}>Pay {naira(tx.amountKobo)}</h1>
      <p className="rx-muted" style={{ marginBottom: 24 }}>Reference {reference}</p>
      <form action={settle} style={{ display: "grid", gap: 12 }}>
        <button className="rx-btn rx-btn--surface rx-btn--block" name="outcome" value="pay">Pay now</button>
        <button className="rx-btn rx-btn--ghost rx-btn--block" name="outcome" value="fail">Simulate a failed payment</button>
      </form>
    </main>
  );
}
