import Link from "next/link";
import { BackButton, IconBadge, ListGroup, ListRow, PageShell, Pill } from "@rallix/ui";
import { describeOffset } from "@rallix/payments";
import { requireRole } from "../../../../lib/context";
import { reminderOverview, reminderSettingsFor } from "../../../../lib/reminder-queries";
import { ReminderForm } from "./ReminderForm";

export default async function Reminders() {
  const ctx = await requireRole("admin");
  const [settings, ov] = await Promise.all([reminderSettingsFor(ctx), reminderOverview(ctx)]);
  const when = (d: Date) => d.toLocaleString("en-NG", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
  return (
    <PageShell back={<BackButton href="/membership" linkAs={Link} />} title="Dues reminders">
      <p className="rx-muted" style={{ margin: "0 0 16px" }}>Email members who haven’t paid, before and after their due date. Anyone who has paid, left the club, or switched reminders off never gets one, and nobody gets the same reminder twice.</p>
      <ReminderForm enabled={settings.enabled} offsets={settings.offsets} unpaid={ov.unpaid} optedOut={ov.optedOut} />
      <h2 className="rx-panel__title" style={{ margin: "32px 0 0" }}>Recently sent</h2>
      {ov.recent.length === 0 ? <p className="rx-muted">Nothing sent yet.</p> : (
        <ListGroup label="Recently sent reminders">
          {ov.recent.map((r, i) => (
            <ListRow key={i} media={<IconBadge icon="mail" />} title={r.name} subtitle={`${describeOffset(r.offset)} the due date · ${when(r.at)}`}
              trailing={<Pill tone={r.status === "sent" ? "success" : r.status === "failed" ? "warning" : "neutral"}>{r.status === "sent" ? "Sent" : r.status === "failed" ? "Failed" : "Sending"}</Pill>} />
          ))}
        </ListGroup>
      )}
    </PageShell>
  );
}
