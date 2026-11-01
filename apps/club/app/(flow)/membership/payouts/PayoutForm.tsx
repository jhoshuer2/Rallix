"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, SelectSheet, TextField } from "@rallix/ui";
import { BankBadge } from "../../../../lib/bank-badge";
import { resolvePayoutAccount, savePayoutAccount } from "../../../../lib/payment-actions";

export function PayoutForm({ banks, replacing }: { banks: Array<{ name: string; code: string }>; replacing: boolean }) {
  const router = useRouter();
  const [bank, setBank] = useState("");
  const [acct, setAcct] = useState("");
  const [name, setName] = useState<string | null>(null); // set only after the provider confirms this exact bank + number
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const reset = () => { setName(null); setError(undefined); };

  async function verify(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(undefined);
    const r = await resolvePayoutAccount({ bankCode: bank, accountNumber: acct });
    setBusy(false);
    if (r.ok) setName(r.accountName); else setError(r.error);
  }
  async function save() {
    setBusy(true); setError(undefined);
    const r = await savePayoutAccount({ bankCode: bank, accountNumber: acct, confirmedName: name! });
    if (r.ok) { router.push("/membership"); router.refresh(); } else { setBusy(false); setError(r.error); }
  }
  return (
    <form noValidate onSubmit={verify}>
      <SelectSheet label="Bank" title="Choose your bank" value={bank} onChange={(v) => { setBank(v); reset(); }} placeholder="Choose your bank" searchable searchPlaceholder="Search banks"
        options={banks.map((b) => ({ value: b.code, label: b.name, icon: <BankBadge name={b.name} /> }))} />
      <TextField label="Account number" inputMode="numeric" maxLength={10} autoComplete="off" placeholder="10 digits" value={acct} onChange={(e) => { setAcct(e.target.value.replace(/\D/g, "")); reset(); }} />
      {error ? <p role="alert" className="rx-error" style={{ marginBottom: 16 }}>{error}</p> : null}
      {name ? (
        <div className="rx-card" style={{ marginBottom: 16 }} role="status">
          <strong>Is this your club’s account?</strong>
          <p style={{ margin: "8px 0 12px", fontSize: 18 }}>{name}</p>
          <p style={{ margin: "0 0 12px", fontSize: 14 }}>Money will be paid into this account. Check the name carefully{replacing ? "; this replaces your current account" : ""}.</p>
          <Button block disabled={busy} onClick={save}>{busy ? "Saving…" : "Yes, use this account"}</Button>
        </div>
      ) : <Button type="submit" variant="surface" block disabled={busy || !bank || acct.length !== 10}>{busy ? "Checking…" : "Verify account"}</Button>}
    </form>
  );
}
