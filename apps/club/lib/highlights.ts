import type { StoryItem } from "@rallix/ui";
import type { MatchView } from "./queries";

const first = (n: string) => n.split(/\s+/)[0] ?? n;
export const isDone = (m: MatchView) => (m.status === "completed" || m.status === "walkover") && !!m.p1 && !!m.p2;
export const dayLabel = (d: Date | null) => (d ? d.toLocaleDateString("en-NG", { day: "numeric", month: "short" }) : "");
export const winnerSide = (m: MatchView) => (m.winnerId ? (m.winnerId === m.p1?.id ? ("a" as const) : ("b" as const)) : null);
export const byRecent = (a: MatchView, b: MatchView) => (b.confirmedAt?.getTime() ?? 0) - (a.confirmedAt?.getTime() ?? 0);

/** Live matches first, then the latest results, as story items. `hrefFor` decides where the viewer's button goes (player vs admin). */
export function buildStories(all: MatchView[], hrefFor: (m: MatchView) => string, cta: string, max = 8): StoryItem[] {
  const live = all.filter((m) => m.status === "live" && m.p1 && m.p2);
  const done = all.filter(isDone).sort(byRecent).slice(0, max);
  return [...live, ...done].map((m) => ({
    id: m.id, live: m.status === "live",
    caption: m.status === "live" ? `${first(m.p1!.name)} v ${first(m.p2!.name)}` : `${first(m.p1!.name)} ${m.gamesP1}–${m.gamesP2} ${first(m.p2!.name)}`,
    title: m.competitionName, subtitle: m.status === "live" ? m.round : `${m.round} · ${dayLabel(m.confirmedAt)}`,
    a: m.p1!, b: m.p2!, score: `${m.gamesP1}–${m.gamesP2}`, href: hrefFor(m), cta,
  }));
}

/** Today as YYYY-MM-DD in the club's usual timezone (Nigeria), so a birthday flips at local midnight and not at UTC midnight. */
export const todayInClub = (now: Date = new Date(), tz = "Africa/Lagos") => new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
