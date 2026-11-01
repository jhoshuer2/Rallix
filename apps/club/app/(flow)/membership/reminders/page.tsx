import Link from "next/link";
import { BackButton, PageHead } from "@rallix/ui";
import { describeOffset } from "@rallix/payments";
import { requireRole } from "../../../../lib/context";
import { reminderOverview, reminderSettingsFor } from "../../../../lib/reminder-queries";
import { ReminderForm } from "./ReminderForm";

export default async function Reminders() {
  const ctx = await requireRole("admin");
  const [settings, ov] = await Promise.all([reminderSettingsFor(ctx), reminderOverview(ctx)]);
  const when = (d: Date) => d.toLocaleString("en-NG", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
  return (
    <>
      <PageHead back={<BackButton href="/membership" linkAs={Link} />} title="Dues reminders" />
      <p className="rx-muted" style={{ marginTop: 0 }}>Email members who haven’t paid, before and after their due date. Anyone who has paid, left the club, or switched reminders off never gets one, and nobody gets the same reminder twice.</p>
      <ReminderForm enabled={settings.enabled} offsets={settings.offsets} unpaid={ov.unpaid} optedOut={ov.optedOut} />
      <h2 className="rx-section__title" style={{ margin: "28px 0 12px" }}>Recently sent</h2>
      {ov.recent.length === 0 ? <p className="rx-muted">Nothing sent yet.</p> : (
        <ul className="rx-pays">
          {ov.recent.map((r, i) => (
            <li key={i} className="rx-pay" style={{ minHeight: 52, padding: "6px 12px" }}>
              <span className="rx-pay__who"><span className="rx-pay__name">{r.name}</span><span className="rx-pay__detail">{describeOffset(r.offset)} the due date · {when(r.at)}</span></span>
              <span className="rx-pay__amt"><span className={`rx-pay__status rx-pay__status--${r.status === "sent" ? "paid" : r.status === "failed" ? "failed" : "pending"}`}>{r.status === "sent" ? "Sent" : r.status === "failed" ? "Failed" : "Sending"}</span></span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
