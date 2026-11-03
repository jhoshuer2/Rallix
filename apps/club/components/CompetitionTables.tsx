import { ListGroup, ListRow, Photo, SectionTitle } from "@rallix/ui";
import { PLACE_LABEL } from "@rallix/stats";
import type { AwardView, TableView } from "../lib/standings-queries";

/** League tables (one per group). Shows only players who have played, so it appears once there is a result. */
export function Standings({ tables, meId }: { tables: TableView[]; meId?: string }) {
  if (!tables.length) return null;
  return (
    <>
      {tables.map((t) => (
        <div key={t.table || "table"}>
          <SectionTitle title={t.table ? `${t.table} table` : "Table"} />
          <ListGroup label={t.table ? `${t.table} table` : "League table"}>
            {t.rows.map((r) => <ListRow key={r.person.id} media={<Photo src={r.person.photo} name={r.person.name} alt="" />} title={`${r.rank}. ${r.person.name}`}
              subtitle={`${r.played} played · ${r.won} won · ${r.lost} lost`} trailing={`${r.points} pts`} current={r.person.id === meId} />)}
          </ListGroup>
        </div>
      ))}
    </>
  );
}

/** Champion, runner-up and third place, once a competition is finished. */
export function Podium({ awards }: { awards: AwardView[] }) {
  if (!awards.length) return null;
  return (
    <>
      <SectionTitle title="Podium" />
      <ListGroup label="Podium">
        {awards.map((a) => <ListRow key={`${a.place}-${a.person.id}`} media={<Photo src={a.person.photo} name={a.person.name} alt="" />} title={a.person.name} subtitle={PLACE_LABEL[a.place]} trailing={["🥇", "🥈", "🥉"][a.place - 1]} />)}
      </ListGroup>
    </>
  );
}
