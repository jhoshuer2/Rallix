"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import * as A from "../lib/actions";

type Res = { ok: boolean; error?: string } & Record<string, unknown>;

/** Runs a server action, shows its error or success message, and refreshes the page data. */
function useRun() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const run = (fn: () => Promise<Res>, success: string | ((r: Res) => string), after?: (r: Res) => void) =>
    start(async () => {
      let r: Res;
      try { r = await fn(); } catch { r = { ok: false, error: "Something went wrong. Please try again." }; }
      setMsg({ ok: r.ok, text: r.ok ? (typeof success === "function" ? success(r) : success) : (r.error ?? "Something went wrong.") });
      if (r.ok) { router.refresh(); after?.(r); }
    });
  const note = msg ? <p role={msg.ok ? "status" : "alert"} className={msg.ok ? "cs-ok" : "cs-error"}>{msg.text}</p> : <span role="status" />;
  return { run, pending, note };
}

/** One-click action with an optional confirm prompt. Pass a bound server action. */
export function RunButton({ action, children, tone, confirmText, success = "Done." }: { action: () => Promise<Res>; children: ReactNode; tone?: "ghost" | "danger"; confirmText?: string; success?: string }) {
  const { run, pending, note } = useRun();
  return (
    <span>
      <button type="button" className={`cs-btn cs-btn--small${tone ? ` cs-btn--${tone}` : ""}`} disabled={pending}
        onClick={() => { if (!confirmText || window.confirm(confirmText)) run(action, success); }}>{pending ? "Working…" : children}</button>
      {note}
    </span>
  );
}

const Field = ({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) => (
  <label className="cs-field"><span>{label}</span>{children}{hint ? <span className="cs-hint">{hint}</span> : null}</label>
);

export function ClubStatusForm({ clubId, status }: { clubId: string; status: string }) {
  const { run, pending, note } = useRun();
  const [reason, setReason] = useState("");
  const next = status === "active" ? "suspended" : "active";
  return (
    <form onSubmit={(e) => { e.preventDefault(); run(() => A.setClubStatus(clubId, next, reason), next === "active" ? "Club reactivated." : "Club suspended. Members lose access immediately.", () => setReason("")); }}>
      {next === "suspended" ? <Field label="Reason" hint="Recorded in the audit log. Members cannot open the club while it is suspended."><input value={reason} onChange={(e) => setReason(e.target.value)} required minLength={3} /></Field> : null}
      <button className={`cs-btn${next === "suspended" ? " cs-btn--danger" : ""}`} disabled={pending}>{next === "suspended" ? "Suspend club" : "Reactivate club"}</button>
      {note}
    </form>
  );
}

export function NewSubscriptionForm({ clubs }: { clubs: Array<{ id: string; name: string }> }) {
  const { run, pending, note } = useRun();
  const [clubId, setClubId] = useState(clubs[0]?.id ?? "");
  const [period, setPeriod] = useState<"monthly" | "yearly">("monthly");
  const [amount, setAmount] = useState("");
  if (!clubs.length) return <p className="cs-muted">Every active club already has a subscription.</p>;
  return (
    <form onSubmit={(e) => { e.preventDefault(); run(() => A.createSubscription({ clubId, period, naira: Number(amount) }), "Subscription created.", () => setAmount("")); }} className="cs-filters">
      <Field label="Club"><select value={clubId} onChange={(e) => setClubId(e.target.value)}>{clubs.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
      <Field label="Billing"><select value={period} onChange={(e) => setPeriod(e.target.value as "monthly" | "yearly")}><option value="monthly">Monthly</option><option value="yearly">Yearly</option></select></Field>
      <Field label="Amount (₦)"><input inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))} required /></Field>
      <button className="cs-btn" disabled={pending || !amount}>Add subscription</button>{note}
    </form>
  );
}

export function NewInvoiceForm({ clubs, defaultClubId }: { clubs: Array<{ id: string; name: string }>; defaultClubId?: string }) {
  const { run, pending, note } = useRun();
  const router = useRouter();
  const [clubId, setClubId] = useState(defaultClubId ?? clubs[0]?.id ?? "");
  const [label, setLabel] = useState(new Date().toISOString().slice(0, 7));
  const [amount, setAmount] = useState("");
  const [desc, setDesc] = useState("");
  const [issueNow, setIssueNow] = useState(true);
  return (
    <form onSubmit={(e) => { e.preventDefault(); run(() => A.createInvoice({ clubId, periodLabel: label, naira: Number(amount), description: desc, issueNow }), "Invoice created.", (r) => router.push(`/invoices/${r.id as string}`)); }}>
      <div className="cs-grid cs-grid--2">
        <Field label="Club"><select value={clubId} onChange={(e) => setClubId(e.target.value)}>{clubs.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
        <Field label="Period" hint="For example 2026-11. One invoice per club per period."><input value={label} onChange={(e) => setLabel(e.target.value)} required /></Field>
        <Field label="Total (₦)" hint="VAT, if set in Templates, is shown as included."><input inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))} required /></Field>
        <Field label="Description"><input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Rallix monthly subscription" /></Field>
      </div>
      <label style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 14, minHeight: 44 }}><input type="checkbox" checked={issueNow} onChange={(e) => setIssueNow(e.target.checked)} style={{ width: 20, height: 20 }} /> Issue now (otherwise save as a draft)</label>
      <button className="cs-btn" disabled={pending || !amount || !clubId}>Create invoice</button>{note}
    </form>
  );
}

export function MarkPaidForm({ invoiceId }: { invoiceId: string }) {
  const { run, pending, note } = useRun();
  const [ref, setRef] = useState("");
  return (
    <form onSubmit={(e) => { e.preventDefault(); run(() => A.setInvoiceStatus(invoiceId, "paid", ref), "Marked as paid."); }} className="cs-filters">
      <Field label="Payment reference"><input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="Bank transfer or Paystack reference" required minLength={2} /></Field>
      <button className="cs-btn" disabled={pending}>Mark as paid</button>{note}
    </form>
  );
}

export function TemplateForm({ id, name, kind, subject, body, placeholders }: { id: string; name: string; kind: string; subject: string | null; body: string; placeholders: string[] }) {
  const { run, pending, note } = useRun();
  const [s, setS] = useState(subject ?? "");
  const [b, setB] = useState(body);
  const sms = kind === "sms";
  return (
    <form onSubmit={(e) => { e.preventDefault(); run(() => A.saveTemplate({ id, subject: s, body: b }), "Template saved."); }} className="cs-card">
      <h3 className="cs-h2" style={{ marginTop: 0 }}>{name} <span className="cs-badge cs-badge--info">{kind}</span></h3>
      {kind === "email" ? <Field label="Subject"><input value={s} onChange={(e) => setS(e.target.value)} /></Field> : null}
      <Field label="Message" hint={`Placeholders: ${placeholders.map((p) => `{{${p}}}`).join(", ")}${sms ? ` · ${b.length} characters (160 fits one SMS)` : ""}`}><textarea value={b} onChange={(e) => setB(e.target.value)} required minLength={5} maxLength={2000} /></Field>
      <button className="cs-btn" disabled={pending}>Save template</button>{note}
    </form>
  );
}

type SettingsProps = { companyName: string; address: string; email: string; phone: string; invoicePrefix: string; vatPercent: number; footerNote: string; paymentInstructions: string };
export function SettingsForm(p: SettingsProps) {
  const { run, pending, note } = useRun();
  const [v, setV] = useState(p);
  const set = <K extends keyof SettingsProps>(k: K, val: SettingsProps[K]) => setV({ ...v, [k]: val });
  return (
    <form onSubmit={(e) => { e.preventDefault(); run(() => A.saveSettings(v), "Invoice branding saved."); }} className="cs-card">
      <div className="cs-grid cs-grid--2">
        <Field label="Company name"><input value={v.companyName} onChange={(e) => set("companyName", e.target.value)} required /></Field>
        <Field label="Invoice prefix" hint="2 to 6 capital letters or digits, e.g. RLX → RLX-2026-0001"><input value={v.invoicePrefix} onChange={(e) => set("invoicePrefix", e.target.value.toUpperCase())} required /></Field>
        <Field label="Email"><input type="email" value={v.email} onChange={(e) => set("email", e.target.value)} /></Field>
        <Field label="Phone"><input value={v.phone} onChange={(e) => set("phone", e.target.value)} /></Field>
        <Field label="VAT (%)" hint="Shown on invoices as included in the total. Use 0 for none."><input inputMode="numeric" value={v.vatPercent} onChange={(e) => set("vatPercent", Number(e.target.value.replace(/\D/g, "")) || 0)} /></Field>
        <Field label="Address"><textarea style={{ minHeight: 60 }} value={v.address} onChange={(e) => set("address", e.target.value)} /></Field>
      </div>
      <Field label="Payment instructions" hint="Printed on every invoice, e.g. bank name and account number."><textarea style={{ minHeight: 80 }} value={v.paymentInstructions} onChange={(e) => set("paymentInstructions", e.target.value)} /></Field>
      <Field label="Footer note"><input value={v.footerNote} onChange={(e) => set("footerNote", e.target.value)} /></Field>
      <button className="cs-btn" disabled={pending}>Save branding</button>{note}
    </form>
  );
}

export function NotificationForm({ clubs }: { clubs: Array<{ id: string; name: string }> }) {
  const { run, pending, note } = useRun();
  const [title, setTitle] = useState(""); const [body, setBody] = useState("");
  const [channel, setChannel] = useState<"push" | "email" | "sms" | "whatsapp">("push");
  const [audience, setAudience] = useState<"all_admins" | "all_players" | "clubs">("all_admins");
  const [picked, setPicked] = useState<string[]>([]);
  return (
    <form onSubmit={(e) => { e.preventDefault(); run(() => A.sendNotification({ title, body, channel, audience, clubIds: picked }), (r) => `Queued for ${r.recipients as number} recipient${r.recipients === 1 ? "" : "s"}.`, () => { setTitle(""); setBody(""); }); }} className="cs-card">
      <Field label="Title"><input value={title} onChange={(e) => setTitle(e.target.value)} required minLength={3} /></Field>
      <Field label="Message"><textarea value={body} onChange={(e) => setBody(e.target.value)} required minLength={5} /></Field>
      <div className="cs-grid cs-grid--2">
        <Field label="Channel"><select value={channel} onChange={(e) => setChannel(e.target.value as typeof channel)}><option value="push">Push</option><option value="email">Email</option><option value="sms">SMS</option><option value="whatsapp">WhatsApp</option></select></Field>
        <Field label="Audience"><select value={audience} onChange={(e) => setAudience(e.target.value as typeof audience)}><option value="all_admins">All club admins</option><option value="all_players">All players</option><option value="clubs">Everyone in specific clubs</option></select></Field>
      </div>
      {audience === "clubs" ? (
        <fieldset style={{ border: "1px solid #bdb8a8", borderRadius: 6, margin: "0 0 14px", padding: 12 }}>
          <legend style={{ fontWeight: 600, padding: "0 6px" }}>Clubs</legend>
          {clubs.map((c) => (
            <label key={c.id} style={{ display: "flex", gap: 8, alignItems: "center", minHeight: 40 }}>
              <input type="checkbox" style={{ width: 20, height: 20 }} checked={picked.includes(c.id)} onChange={(e) => setPicked(e.target.checked ? [...picked, c.id] : picked.filter((x) => x !== c.id))} />{c.name}
            </label>
          ))}
        </fieldset>
      ) : null}
      <button className="cs-btn" disabled={pending}>Queue notification</button>{note}
      <p className="cs-hint" style={{ marginTop: 12 }}>Delivery providers are not connected yet. Notifications are recorded as queued, with the number of people they would reach.</p>
    </form>
  );
}

export function NewIssueForm({ clubs }: { clubs: Array<{ id: string; name: string }> }) {
  const { run, pending, note } = useRun();
  const router = useRouter();
  const [title, setTitle] = useState(""); const [body, setBody] = useState("");
  const [sev, setSev] = useState<"low" | "normal" | "high" | "critical">("normal"); const [clubId, setClubId] = useState("");
  return (
    <form onSubmit={(e) => { e.preventDefault(); run(() => A.createIssue({ title, body, severity: sev, clubId: clubId || null }), "Issue created.", (r) => router.push(`/issues/${r.id as string}`)); }} className="cs-card">
      <Field label="Title"><input value={title} onChange={(e) => setTitle(e.target.value)} required minLength={3} /></Field>
      <Field label="Details"><textarea value={body} onChange={(e) => setBody(e.target.value)} /></Field>
      <div className="cs-grid cs-grid--2">
        <Field label="Severity"><select value={sev} onChange={(e) => setSev(e.target.value as typeof sev)}><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="critical">Critical</option></select></Field>
        <Field label="Club (optional)"><select value={clubId} onChange={(e) => setClubId(e.target.value)}><option value="">No specific club</option>{clubs.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
      </div>
      <button className="cs-btn" disabled={pending}>Create issue</button>{note}
    </form>
  );
}

export function IssueControls({ id, status, severity }: { id: string; status: string; severity: string }) {
  const { run, pending, note } = useRun();
  return (
    <div className="cs-actions">
      <label className="cs-field" style={{ margin: 0 }}><span>Status</span>
        <select value={status} disabled={pending} onChange={(e) => run(() => A.updateIssue(id, { status: e.target.value as "open" }), "Status updated.")}>
          <option value="open">Open</option><option value="investigating">Investigating</option><option value="resolved">Resolved</option><option value="closed">Closed</option></select></label>
      <label className="cs-field" style={{ margin: 0 }}><span>Severity</span>
        <select value={severity} disabled={pending} onChange={(e) => run(() => A.updateIssue(id, { severity: e.target.value as "low" }), "Severity updated.")}>
          <option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="critical">Critical</option></select></label>
      <button className="cs-btn cs-btn--ghost" disabled={pending} onClick={() => run(() => A.updateIssue(id, { assignToMe: true }), "Assigned to you.")}>Assign to me</button>
      {note}
    </div>
  );
}

export function IssueNoteForm({ id }: { id: string }) {
  const { run, pending, note } = useRun();
  const [body, setBody] = useState("");
  return (
    <form onSubmit={(e) => { e.preventDefault(); run(() => A.addIssueNote(id, body), "Note added.", () => setBody("")); }}>
      <Field label="Add a note"><textarea value={body} onChange={(e) => setBody(e.target.value)} required minLength={2} /></Field>
      <button className="cs-btn" disabled={pending}>Add note</button>{note}
    </form>
  );
}

export function TeamForm() {
  const { run, pending, note } = useRun();
  const [phone, setPhone] = useState("");
  return (
    <form onSubmit={(e) => { e.preventDefault(); run(() => A.addTeamMember(phone), "Added to the platform team.", () => setPhone("")); }} className="cs-filters">
      <Field label="Phone number" hint="They must have signed in to a Rallix app once."><input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0803 000 0000" required /></Field>
      <button className="cs-btn" disabled={pending}>Add to team</button>{note}
    </form>
  );
}

export const PrintButton = () => <button type="button" className="cs-btn cs-btn--ghost cs-noprint" onClick={() => window.print()}>Print or save as PDF</button>;
