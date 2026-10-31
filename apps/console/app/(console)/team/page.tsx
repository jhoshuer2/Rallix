import { Badge, PageHead } from "../../../components/ui";
import { RunButton, TeamForm } from "../../../components/Forms";
import { removeTeamMember } from "../../../lib/actions";
import { date } from "../../../lib/format";
import { getStaff } from "../../../lib/guard";
import { listTeam } from "../../../lib/queries";

export default async function Team() {
  const [team, me] = await Promise.all([listTeam(), getStaff()]);
  return (
    <>
      <PageHead title="Team" sub="People who can sign in to this console. They have full access, so add only people you trust." />
      <div className="cs-tablewrap"><table className="cs-table">
        <thead><tr><th>Name</th><th>Phone</th><th>Added</th><th /></tr></thead>
        <tbody>{team.map((m) => (
          <tr key={m.user_id}><td>{m.name} {m.user_id === me?.id ? <Badge tone="info">You</Badge> : null}</td><td>{m.phone ?? "—"}</td><td>{date(m.created_at)}</td>
            <td>{m.user_id !== me?.id ? <RunButton tone="danger" confirmText={`Remove ${m.name} from the platform team?`} action={removeTeamMember.bind(null, m.user_id)} success="Removed.">Remove</RunButton> : null}</td></tr>
        ))}</tbody>
      </table></div>
      <h2 className="cs-h2">Add a team member</h2>
      <div className="cs-card"><TeamForm /></div>
    </>
  );
}
