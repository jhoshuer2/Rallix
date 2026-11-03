import Link from "next/link";
import { ListGroup, ListRow, Photo, Pill, SectionTitle } from "@rallix/ui";
import type { MatchView } from "../lib/queries";

const day = (d: Date | null) => (d ? d.toLocaleDateString("en-NG", { weekday: "short", day: "numeric", month: "short" }) : "Date to be confirmed");

/** Every match of a competition, grouped by round, as result rows. `hrefFor` decides where a row goes (match page, or the score sheet for scorers). */
export function RoundResults({ matches, hrefFor, actionFor }: { matches: MatchView[]; hrefFor?: (m: MatchView) => string | undefined; actionFor?: (m: MatchView) => string | undefined }) {
  const rounds = [...new Set(matches.map((m) => m.round))];
  return (
    <>
      {rounds.map((round) => (
        <div key={round}>
          <SectionTitle title={round} />
          <ListGroup label={`${round} matches`}>
            {matches.filter((m) => m.round === round).map((m) => {
              const done = m.status === "completed" || m.status === "walkover";
              const action = actionFor?.(m);
              const bye = m.status === "walkover" && (!m.p1 || !m.p2);
              const lone = m.p1 ?? m.p2;
              if (bye) return <ListRow key={m.id} media={<Photo src={lone?.photo} name={lone?.name ?? "TBD"} alt="" />} title={`${lone?.name ?? "TBD"} has a bye`} subtitle="Goes straight to the next round" trailing={<Pill>Bye</Pill>} />;
              return <ListRow key={m.id} media={<Photo src={m.p1?.photo} name={m.p1?.name ?? "TBD"} alt="" />} title={`${m.p1?.name ?? "To be decided"} vs ${m.p2?.name ?? "To be decided"}`} subtitle={done ? day(m.confirmedAt) : day(m.scheduledAt)}
                trailing={done ? `${m.gamesP1}–${m.gamesP2}` : action ? <Pill tone="success">{action}</Pill> : <Pill tone={m.status === "live" ? "live" : "neutral"}>{m.status === "live" ? "Live" : "Upcoming"}</Pill>}
                href={hrefFor?.(m)} linkAs={Link} ariaLabel={action && m.p1 && m.p2 ? `${action} ${m.p1.name} versus ${m.p2.name}` : undefined} />;
            })}
          </ListGroup>
        </div>
      ))}
    </>
  );
}
