"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import * as A from "../lib/actions";
import { ROLE_HINT, ROLE_LABEL, STAFF_ROLES, type StaffRole } from "@rallix/config/staff";

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
  const [type, setType] = useState<"non_payment" | "other">("non_payment");
  const next = status === "active" ? "suspended" : "active";
  return (
    <form onSubmit={(e) => { e.preventDefault(); run(() => A.setClubStatus(clubId, next, reason, type), next === "active" ? "Club reactivated." : "Club suspended. Members lose access immediately.", () => setReason("")); }}>
      {next === "suspended" ? (
        <>
          <fieldset style={{ border: 0, padding: 0, margin: "0 0 14px" }}>
            <legend style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>Why is it being suspended?</legend>
            <label style={{ display: "flex", gap: 8, minHeight: 44, alignItems: "center" }}><input type="radio" name="reasonType" checked={type === "non_payment"} onChange={() => setType("non_payment")} style={{ width: 20, height: 20 }} /> Non-payment <span className="cs-hint">(comes back automatically when overdue invoices are paid)</span></label>
            <label style={{ display: "flex", gap: 8, minHeight: 44, alignItems: "center" }}><input type="radio" name="reasonType" checked={type === "other"} onChange={() => setType("other")} style={{ width: 20, height: 20 }} /> Something else <span className="cs-hint">(only staff can reactivate)</span></label>
          </fieldset>
          <Field label="Details" hint="Recorded in the audit log. Members cannot open the club while it is suspended."><input value={reason} onChange={(e) => setReason(e.target.value)} required minLength={3} /></Field>
        </>
      ) : null}
      <button className={`cs-btn${next === "suspended" ? " cs-btn--danger" : ""}`} disabled={pending}>{next === "suspended" ? "Suspend club" : "Reactivate club"}</button>
      {note}
    </form>
  );
}

export function NewSubscriptionForm({ clubs, plans = [] }: { clubs: Array<{ id: string; name: string }>; plans?: Array<{ id: string; name: string; monthly_kobo: number; yearly_kobo: number; member_limit: number | null }> }) {
  const { run, pending, note } = useRun();
  const [clubId, setClubId] = useState(clubs[0]?.id ?? "");
  const [period, setPeriod] = useState<"monthly" | "yearly">("monthly");
  const [planId, setPlanId] = useState("");
  const [amount, setAmount] = useState("");
  if (!clubs.length) return <p className="cs-muted">Every active club already has a subscription.</p>;
  const plan = plans.find((p) => p.id === planId);
  const price = plan ? (period === "monthly" ? plan.monthly_kobo : plan.yearly_kobo) / 100 : null;
  return (
    <form onSubmit={(e) => { e.preventDefault(); run(() => A.createSubscription({ clubId, period, naira: Number(amount || 0), planId: planId || null }), "Subscription created.", () => setAmount("")); }} className="cs-filters">
      <Field label="Club"><select value={clubId} onChange={(e) => setClubId(e.target.value)}>{clubs.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
      <Field label="Billing"><select value={period} onChange={(e) => setPeriod(e.target.value as "monthly" | "yearly")}><option value="monthly">Monthly</option><option value="yearly">Yearly</option></select></Field>
      {plans.length ? <Field label="Plan" hint={plan ? `${plan.member_limit ? `Up to ${plan.member_limit} members` : "No member limit"}. The price comes from the plan.` : "Pick a plan, or none for a custom amount."}><select value={planId} onChange={(e) => setPlanId(e.target.value)}><option value="">No plan, custom amount</option>{plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field> : null}
      {plan ? <Field label="Amount (₦)"><input value={String(price)} readOnly aria-readonly="true" /></Field> : <Field label="Amount (₦)"><input inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))} required /></Field>}
      <button className="cs-btn" disabled={pending || (!plan && !amount)}>Add subscription</button>{note}
    </form>
  );
}

/** Switch club approval on or off. New clubs wait for staff when it is on. */
export function ClubApprovalForm({ on }: { on: boolean }) {
  const { run, pending, note } = useRun();
  return (
    <div className="cs-card" style={{ marginBottom: 20 }}>
      <label style={{ display: "flex", gap: 10, alignItems: "center", minHeight: 44 }}>
        <input type="checkbox" checked={on} disabled={pending} onChange={(e) => run(() => A.setClubApproval(e.target.checked), e.target.checked ? "New clubs now wait for approval." : "New clubs go live straight away.")} />
        <span><strong>New clubs need approval</strong><br /><span className="cs-hint">When on, a club created from now on can’t be used until you approve it here. Existing clubs are not affected.</span></span>
      </label>{note}
    </div>
  );
}

/** One club waiting for approval: approve, or decline with a reason the owner is told. */
export function PendingClubActions({ clubId, name }: { clubId: string; name: string }) {
  const { run, pending, note } = useRun();
  const [reason, setReason] = useState("");
  const [declining, setDeclining] = useState(false);
  return (
    <div>
      {declining ? (
        <form onSubmit={(e) => { e.preventDefault(); run(() => A.declineClub(clubId, reason), "Declined. The owner has been emailed."); }} className="cs-filters">
          <Field label={`Why is ${name} declined?`} hint="The owner reads this."><input value={reason} onChange={(e) => setReason(e.target.value)} required minLength={3} /></Field>
          <button className="cs-btn cs-btn--danger" disabled={pending}>Decline</button>
          <button type="button" className="cs-btn cs-btn--ghost" onClick={() => setDeclining(false)}>Cancel</button>
        </form>
      ) : (
        <span className="cs-actions">
          <button type="button" className="cs-btn cs-btn--small" disabled={pending} onClick={() => run(() => A.approveClub(clubId), "Approved. The owner has been emailed.")}>Approve</button>
          <button type="button" className="cs-btn cs-btn--small cs-btn--ghost" disabled={pending} onClick={() => setDeclining(true)}>Decline</button>
        </span>
      )}
      {note}
    </div>
  );
}

/** Add or edit a plan. */
export function PlanForm({ plan, onDone }: { plan?: { id: string; name: string; monthly_kobo: number; yearly_kobo: number; member_limit: number | null; active: boolean }; onDone?: () => void }) {
  const { run, pending, note } = useRun();
  const [name, setName] = useState(plan?.name ?? "");
  const [monthly, setMonthly] = useState(plan ? String(plan.monthly_kobo / 100) : "");
  const [yearly, setYearly] = useState(plan ? String(plan.yearly_kobo / 100) : "");
  const [limit, setLimit] = useState(plan?.member_limit ? String(plan.member_limit) : "");
  const [active, setActive] = useState(plan?.active ?? true);
  return (
    <form onSubmit={(e) => { e.preventDefault(); run(() => A.savePlan({ id: plan?.id ?? null, name, monthlyNaira: Number(monthly), yearlyNaira: Number(yearly), memberLimit: limit === "" ? null : Number(limit), active }), plan ? "Plan saved." : "Plan added.", () => { if (!plan) { setName(""); setMonthly(""); setYearly(""); setLimit(""); } onDone?.(); }); }} className="cs-filters">
      <Field label="Name"><input value={name} onChange={(e) => setName(e.target.value)} required maxLength={60} placeholder="Club of 50" /></Field>
      <Field label="Monthly (₦)"><input inputMode="numeric" value={monthly} onChange={(e) => setMonthly(e.target.value.replace(/\D/g, ""))} required /></Field>
      <Field label="Yearly (₦)"><input inputMode="numeric" value={yearly} onChange={(e) => setYearly(e.target.value.replace(/\D/g, ""))} required /></Field>
      <Field label="Member limit" hint="Empty means no limit."><input inputMode="numeric" value={limit} onChange={(e) => setLimit(e.target.value.replace(/\D/g, ""))} /></Field>
      <label style={{ display: "flex", gap: 8, alignItems: "center", minHeight: 44 }}><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Offered to clubs</label>
      <button className="cs-btn" disabled={pending}>{plan ? "Save plan" : "Add plan"}</button>{note}
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
  const [emailNow, setEmailNow] = useState(true);
  return (
    <form onSubmit={(e) => { e.preventDefault(); run(() => A.createInvoice({ clubId, periodLabel: label, naira: Number(amount), description: desc, issueNow, emailNow: issueNow && emailNow }), "Invoice created.", (r) => { const m = r.emailed as { sent?: number; failed?: number; error?: string } | undefined; router.push(`/invoices/${r.id as string}${m ? `?emailed=${m.error ? "err" : m.sent}&failed=${m.failed ?? 0}` : ""}`); }); }}>
      <div className="cs-grid cs-grid--2">
        <Field label="Club"><select value={clubId} onChange={(e) => setClubId(e.target.value)}>{clubs.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
        <Field label="Period" hint="For example 2026-11. One invoice per club per period."><input value={label} onChange={(e) => setLabel(e.target.value)} required /></Field>
        <Field label="Total (₦)" hint="VAT, if set in Templates, is shown as included."><input inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))} required /></Field>
        <Field label="Description"><input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Rallix monthly subscription" /></Field>
      </div>
      <label style={{ display: "flex", gap: 8, alignItems: "center", minHeight: 44 }}><input type="checkbox" checked={issueNow} onChange={(e) => setIssueNow(e.target.checked)} style={{ width: 20, height: 20 }} /> Issue now (otherwise save as a draft)</label>
      <label style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 14, minHeight: 44, opacity: issueNow ? 1 : 0.5 }}><input type="checkbox" checked={issueNow && emailNow} disabled={!issueNow} onChange={(e) => setEmailNow(e.target.checked)} style={{ width: 20, height: 20 }} /> Email the club’s admins the invoice and pay link now</label>
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
    <form onSubmit={(e) => { e.preventDefault(); run(() => A.sendNotification({ title, body, channel, audience, clubIds: picked }), (r) => channel === "email" ? `Email sent to ${r.sent as number} of ${r.recipients as number}${(r.failed as number) ? `. ${r.failed} failed` : ""}${(r.remaining as number) ? `. ${r.remaining} still waiting: use Continue sending below.` : "."}` : `Queued for ${r.recipients as number} recipient${r.recipients === 1 ? "" : "s"}.`, () => { setTitle(""); setBody(""); }); }} className="cs-card">
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
      <p className="cs-hint" style={{ marginTop: 12 }}>Email is sent for real, up to 100 at a time. Push, SMS and WhatsApp are not connected yet, so those stay queued.</p>
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
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<StaffRole>("support");
  return (
    <form onSubmit={(e) => { e.preventDefault(); run(() => A.addTeamMember(email, role), "Added to the platform team.", () => setEmail("")); }} className="cs-filters">
      <Field label="Email address" hint="They must have signed in to the Rallix club app once."><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" required /></Field>
      <Field label="Role" hint={ROLE_HINT[role]}><select value={role} onChange={(e) => setRole(e.target.value as StaffRole)}>{STAFF_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select></Field>
      <button className="cs-btn" disabled={pending}>Add to team</button>{note}
    </form>
  );
}

/** Change a team member's role. The database refuses to demote the last owner, and the message says so. */
export function RoleSelect({ userId, role, name }: { userId: string; role: string; name: string }) {
  const { run, pending, note } = useRun();
  return (
    <span>
      <select aria-label={`Role for ${name}`} defaultValue={role} disabled={pending} onChange={(e) => run(() => A.setTeamRole(userId, e.target.value), "Role updated.")}>{STAFF_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select>
      {note}
    </span>
  );
}

/** Reply to a request that came from the club app. The reply is emailed to the person who sent it. */
export function IssueReplyForm({ id }: { id: string }) {
  const { run, pending, note } = useRun();
  const [body, setBody] = useState("");
  return (
    <form onSubmit={(e) => { e.preventDefault(); run(() => A.replyToIssue(id, body), "Reply sent by email.", () => setBody("")); }}>
      <Field label="Reply to the person who sent this" hint="Sent by email. They can answer from their inbox."><textarea value={body} onChange={(e) => setBody(e.target.value)} required minLength={2} maxLength={4000} /></Field>
      <button className="cs-btn" disabled={pending}>Send reply</button>{note}
    </form>
  );
}

export function PayLinkCard({ invoiceId, url, club, number, amount }: { invoiceId: string; url: string | null; club: string; number: string; amount: string }) {
  const { run, pending, note } = useRun();
  const [link, setLink] = useState<string | null>(url);
  const [copied, setCopied] = useState(false);
  const message = (l: string) => `Hello, this is Rallix. Invoice ${number} for ${club} (${amount}) is ready. You can pay securely online here: ${l}`;
  const need = async (fn: () => Promise<Res>) => { const r = await fn(); if (r.ok && typeof r.url === "string") setLink(r.url); return r; };
  return (
    <section className="cs-card cs-noprint" style={{ marginBottom: 20 }} aria-label="Pay link">
      <h2 className="cs-h2" style={{ marginTop: 0 }}>Pay link</h2>
      <p className="cs-muted">Anyone with this link can pay this invoice, even a club that is suspended or can’t sign in. It shows only the club name, invoice number and amount.</p>
      {link ? <p style={{ wordBreak: "break-all", fontFamily: "monospace", fontSize: 13 }}>{link}</p> : null}
      <div className="cs-actions">
        {!link ? <button className="cs-btn" disabled={pending} onClick={() => run(() => need(() => A.ensurePayLink(invoiceId)), "Link created.")}>Create pay link</button> : (
          <>
            <button className="cs-btn" onClick={async () => { try { await navigator.clipboard.writeText(link); setCopied(true); } catch { setCopied(false); } }}>{copied ? "Copied" : "Copy link"}</button>
            <a className="cs-btn cs-btn--ghost" href={`https://wa.me/?text=${encodeURIComponent(message(link))}`} target="_blank" rel="noreferrer">Share on WhatsApp</a>
            <button className="cs-btn cs-btn--ghost" disabled={pending} onClick={() => { if (window.confirm("Replace the link? The old one stops working immediately.")) run(() => need(() => A.replacePayLink(invoiceId)), "Link replaced. The old one no longer works."); }}>Replace link</button>
            <button className="cs-btn cs-btn--danger" disabled={pending} onClick={() => { if (window.confirm("Turn this link off? Nobody will be able to pay with it.")) run(async () => { const r = await A.disablePayLink(invoiceId); if (r.ok) { setLink(null); setCopied(false); } return r; }, "Link turned off."); }}>Turn off</button>
          </>
        )}
      </div>
      {note}
    </section>
  );
}

type MailRes = { ok: boolean; error?: string; needsConfirm?: boolean; sent?: number; failed?: number; recipients?: number };
export function InvoiceEmailCard({ invoiceId, history, flash }: { invoiceId: string; history: Array<{ to: string; kind: string; status: string; error: string | null; at: string }>; flash?: string }) {
  const { run, pending, note } = useRun();
  const send = (kind: "invoice" | "reminder") => {
    const go = (force: boolean) => run(async () => {
      const r = (await A.emailInvoice(invoiceId, kind, force)) as MailRes;
      if (!r.ok && r.needsConfirm && window.confirm(r.error)) return (await A.emailInvoice(invoiceId, kind, true)) as MailRes;
      return r;
    }, (r) => { const m = r as MailRes; return `Emailed ${m.sent} of ${m.recipients} admin${m.recipients === 1 ? "" : "s"}${m.failed ? `. ${m.failed} failed, see the list below` : "."}`; });
    go(false);
  };
  return (
    <section className="cs-card cs-noprint" style={{ marginBottom: 20 }} aria-label="Email this invoice">
      <h2 className="cs-h2" style={{ marginTop: 0 }}>Email</h2>
      <p className="cs-muted">Sends the invoice and pay link to everyone who is an admin of this club, even if the club is suspended.</p>
      {flash ? <p role="status" className="cs-ok">{flash}</p> : null}
      <div className="cs-actions">
        <button className="cs-btn" disabled={pending} onClick={() => send("invoice")}>Email invoice to club admins</button>
        <button className="cs-btn cs-btn--ghost" disabled={pending} onClick={() => send("reminder")}>Send past-due reminder</button>
      </div>
      {note}
      {history.length ? (
        <details style={{ marginTop: 12 }}><summary style={{ cursor: "pointer", minHeight: 36 }}>Sent so far ({history.length})</summary>
          <ul style={{ margin: "8px 0 0", paddingLeft: 18, fontSize: 14 }}>{history.map((h, i) => <li key={i}>{h.at} · {h.kind === "invoice" ? "Invoice" : "Reminder"} · {h.to} · {h.status === "sent" ? "sent" : `failed (${h.error})`}</li>)}</ul></details>
      ) : null}
    </section>
  );
}

type NotifProps = { id: string; channel: string; status: string; recipients: number; sent: number; failed: number; pending: number; failures: string[] };
export function NotificationProgress(n: NotifProps) {
  const { run, pending, note } = useRun();
  if (n.channel !== "email") return <span className="cs-hint">Queued. {n.channel} delivery is not connected yet.</span>;
  return (
    <div>
      <span className="cs-hint">Sent {n.sent} of {n.recipients}{n.failed ? ` · ${n.failed} failed` : ""}{n.pending ? ` · ${n.pending} waiting` : ""}</span>
      <div className="cs-actions" style={{ marginTop: 6 }}>
        {n.pending > 0 ? <button className="cs-btn cs-btn--small" disabled={pending} onClick={() => run(() => A.continueNotification(n.id), (r) => `Sent ${r.sent as number} more. ${r.remaining as number} left.`)}>{pending ? "Sending…" : `Continue sending (${Math.min(100, n.pending)} next)`}</button> : null}
        {n.failed > 0 ? <button className="cs-btn cs-btn--small cs-btn--ghost" disabled={pending} onClick={() => run(() => A.retryFailedDeliveries(n.id), (r) => `${r.requeued as number} put back in the queue. Press Continue sending.`)}>Retry failed</button> : null}
      </div>
      {n.failures.length ? <details style={{ marginTop: 6 }}><summary style={{ cursor: "pointer", minHeight: 32 }}>Why some failed</summary><ul style={{ margin: "6px 0 0", paddingLeft: 18, fontSize: 13 }}>{n.failures.map((f, i) => <li key={i}>{f}</li>)}</ul></details> : null}
      {note}
    </div>
  );
}

export const PrintButton = () => <button type="button" className="cs-btn cs-btn--ghost cs-noprint" onClick={() => window.print()}>Print or save as PDF</button>;
