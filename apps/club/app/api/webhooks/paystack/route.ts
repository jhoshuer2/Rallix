import { NextResponse } from "next/server";
import { finalizeByReference, logEvent } from "../../../../lib/payments-core";
import { provider } from "../../../../lib/payments";

export const dynamic = "force-dynamic";

/**
 * Payment provider webhook. Safe to call repeatedly (Paystack retries):
 *  - the signature must match the exact raw body, otherwise 401 and nothing is read from it
 *  - we never credit from the payload: we re-verify with the provider and reconcile against our own record
 *  - a processing failure returns 500 so the provider retries; unknown or irrelevant events return 200
 */
export async function POST(req: Request) {
  const raw = await req.text();
  if (raw.length > 100_000) return NextResponse.json({ error: "too large" }, { status: 413 });
  let p; try { p = provider(); } catch { return NextResponse.json({ error: "payments not configured" }, { status: 503 }); }

  if (!p.verifyWebhookSignature(raw, req.headers.get("x-paystack-signature"))) {
    await logEvent({ event: "unknown", reference: null, signatureValid: false, outcome: "rejected_signature", detail: `from ${req.headers.get("x-forwarded-for") ?? "unknown"}` });
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }
  let evt; try { evt = p.parseWebhook(raw); } catch {
    await logEvent({ event: "unparseable", reference: null, signatureValid: true, outcome: "error", detail: "invalid JSON" });
    return NextResponse.json({ ok: true });
  }
  if (evt.event !== "charge.success" || !evt.reference) {
    await logEvent({ event: evt.event, reference: evt.reference, signatureValid: true, outcome: "ignored" });
    return NextResponse.json({ ok: true });
  }
  try {
    const r = await finalizeByReference(evt.reference);
    await logEvent({ event: evt.event, reference: evt.reference, signatureValid: true, outcome: r.outcome, detail: r.detail, raw: evt.raw });
    return NextResponse.json({ ok: true, outcome: r.outcome });
  } catch (e) {
    await logEvent({ event: evt.event, reference: evt.reference, signatureValid: true, outcome: "error", detail: (e as Error).message });
    return NextResponse.json({ error: "processing failed" }, { status: 500 });
  }
}
