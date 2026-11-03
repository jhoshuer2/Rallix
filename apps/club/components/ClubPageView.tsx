import { CompetitionBanner, EmptyState, Panel } from "@rallix/ui";
import type { PublicClub } from "../lib/club-public";

const naira = (kobo: number) => `₦${(kobo / 100).toLocaleString("en-NG", { maximumFractionDigits: 0 })}`;

/** What people read about a club before joining. A section appears only when the club wrote something for it. */
export function ClubPageSections({ club }: { club: PublicClub }) {
  const text: Array<[string, string | null]> = [["About", club.about], ["When we play", club.schedule]];
  const after: Array<[string, string | null]> = [["Dress code", club.dressCode], ["Equipment", club.equipment], ["Rules and guidelines", club.rules], ["Contact", club.contact]];
  const nothing = ![...text, ...after].some(([, v]) => v) && club.fees.length === 0;
  return (
    <>
      {text.map(([t, v]) => (v ? <Panel key={t} title={t}><p className="rx-rules" style={{ paddingBottom: 0 }}>{v}</p></Panel> : null))}
      {club.fees.length ? (
        <Panel title="Fees">
          <ul className="rx-feelist">
            {club.fees.map((f) => <li key={`${f.name}-${f.period}`}><span>{f.name}</span><b>{naira(f.priceKobo)} <small>per {f.period === "monthly" ? "month" : "year"}</small></b></li>)}
          </ul>
        </Panel>
      ) : null}
      {after.map(([t, v]) => (v ? <Panel key={t} title={t}><p className="rx-rules" style={{ paddingBottom: 0 }}>{v}</p></Panel> : null))}
      {nothing ? <EmptyState compact title="No details yet" hint="This club has not added its rules, schedule or fees yet." /> : null}
    </>
  );
}

export function ClubHero({ club }: { club: PublicClub }) {
  return <CompetitionBanner name={club.name} summary={club.location} cover={club.coverUrl} />;
}
