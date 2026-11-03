import { requireAdmin } from "../../../lib/guard";
import { Badge, Empty, PageHead } from "../../../components/ui";
import { PlanForm } from "../../../components/Forms";
import { naira } from "../../../lib/format";
import { listPlans } from "../../../lib/queries";

/** What Rallix sells. A plan sets the prices and, optionally, how many players a club can have. */
export default async function Plans() {
  await requireAdmin("billing");
  const plans = await listPlans();
  return (
    <>
      <PageHead title="Plans" sub="The plans clubs subscribe to. A member limit is enforced in the database: a club on the plan can’t add players past it." />
      {plans.length === 0 ? <Empty>No plans yet. Add the first one below.</Empty> : (
        <div className="cs-tablewrap"><table className="cs-table">
          <thead><tr><th>Plan</th><th className="num">Monthly</th><th className="num">Yearly</th><th className="num">Member limit</th><th className="num">Clubs</th><th>Edit</th></tr></thead>
          <tbody>{plans.map((p) => (
            <tr key={p.id}>
              <td>{p.name} {p.active ? null : <Badge>Not offered</Badge>}</td>
              <td className="num">{naira(p.monthly_kobo)}</td><td className="num">{naira(p.yearly_kobo)}</td>
              <td className="num">{p.member_limit ?? "No limit"}</td><td className="num">{p.clubs}</td>
              <td><details><summary>Edit</summary><PlanForm plan={p} /></details></td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
      <h2 className="cs-h2">Add a plan</h2>
      <div className="cs-card"><PlanForm /></div>
    </>
  );
}
