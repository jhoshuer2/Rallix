import { Badge, Empty, PageHead } from "../../../components/ui";
import { NotificationForm, NotificationProgress } from "../../../components/Forms";
import { dateTime } from "../../../lib/format";
import { clubOptions, listNotifications } from "../../../lib/queries";

export default async function Notifications() {
  const [clubs, history] = await Promise.all([clubOptions(), listNotifications()]);
  const names = new Map(clubs.map((c) => [c.id, c.name]));
  const audience = (a: { type?: string; clubIds?: string[] }) => a.type === "all_admins" ? "All club admins" : a.type === "all_players" ? "All players" : `Clubs: ${(a.clubIds ?? []).map((i) => names.get(i) ?? "?").join(", ")}`;
  return (
    <>
      <PageHead title="Notifications" sub="Send an announcement to club admins or players." />
      <div className="cs-grid cs-grid--2" style={{ alignItems: "start" }}>
        <NotificationForm clubs={clubs} />
        <div>
          <h2 className="cs-h2" style={{ marginTop: 0 }}>History</h2>
          {history.length === 0 ? <Empty>Nothing sent yet.</Empty> : (
            <div className="cs-tablewrap"><table className="cs-table"><tbody>
              {history.map((n) => (
                <tr key={n.id}>
                  <td><strong>{n.title}</strong><br /><span className="cs-hint">{audience(n.audience)} · {n.channel} · {n.recipient_count} recipient{n.recipient_count === 1 ? "" : "s"}</span><br /><NotificationProgress id={n.id} channel={n.channel} status={n.status} recipients={n.recipient_count} sent={n.sent_count} failed={n.failed_count} pending={n.pending} failures={n.failures} /></td>
                  <td><Badge tone={n.status === "sent" ? "ok" : n.status === "failed" ? "bad" : "warn"}>{n.status}</Badge></td>
                  <td className="num">{dateTime(n.created_at)}</td>
                </tr>
              ))}
            </tbody></table></div>
          )}
        </div>
      </div>
    </>
  );
}
