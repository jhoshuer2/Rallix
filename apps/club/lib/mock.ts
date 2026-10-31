/** Sample data from the design frames. Replaced by the database in Phase 1 backend work. */
export type Player = { id: string; name: string; rank: number; points: number; photo: string; level: "Junior" | "Intermediate" | "Senior"; country: string; age: number; height: string; won: number; lost: number; titles: number; earned: string };

const base = { country: "NGR", age: 35, height: `5'10" (1.778m)`, titles: 2, earned: "₦200,000" };
export const players: Player[] = [
  { id: "jide", name: "Jide Taiwo", rank: 1, points: 100, photo: "/players/jide.png", level: "Senior", ...base, won: 40, lost: 12 },
  { id: "pastor", name: "Pastor", rank: 2, points: 80, photo: "/players/pastor.png", level: "Senior", ...base, won: 36, lost: 14 },
  { id: "sule", name: "Sule", rank: 3, points: 60, photo: "/players/sule.png", level: "Senior", ...base, won: 40, lost: 12 },
  { id: "nurudeen", name: "Nurudeen", rank: 4, points: 50, photo: "/players/nurudeen.png", level: "Intermediate", ...base, won: 30, lost: 18 },
  { id: "dorathy", name: "Dorathy", rank: 5, points: 40, photo: "/players/dorathy.png", level: "Intermediate", ...base, won: 28, lost: 20 },
  { id: "nathaniel", name: "Nathaniel", rank: 6, points: 30, photo: "/players/nathaniel.png", level: "Junior", ...base, won: 22, lost: 19 },
  { id: "ade", name: "Ade", rank: 7, points: 25, photo: "/players/ade.png", level: "Junior", ...base, won: 18, lost: 21 },
];
export const byId = (id: string) => players.find((p) => p.id === id);

export const club = { name: "Paris Arena", logo: "/club/logo.jpg" };
export const admin = { name: "Innocent Amos", photo: "/club/admin.png" };

export type Pay = { rank: number; name: string; photo: string; detail: string; amount: string; status: "paid" | "pending" | "failed" | "refunded" };
const statuses: Pay["status"][] = ["paid", "paid", "pending", "failed", "paid", "pending", "paid", "failed", "paid", "paid", "pending", "failed"];
export const payments: Pay[] = statuses.map((status, i) => {
  const p = players[i % players.length]!;
  return { rank: i + 1, name: p.name, photo: p.photo, detail: "monthly • card • 28 Aug 26", amount: "₦10,000", status };
});
export const plans = [
  { id: "monthly", name: "Monthly", price: "₦6,000", perks: ["unlimited open play", "competition entry"], period: "monthly", on: true },
  { id: "monthly-pro", name: "Monthly with Pro", price: "₦10,000", perks: ["unlimited open play", "competition entry"], period: "monthly", on: true },
  { id: "yearly", name: "Yearly", price: "₦60,000", perks: ["unlimited open play", "competition entry", "2 months free"], period: "yearly", on: false },
];
export const competitions = [
  { id: "demo", title: "Paris Arena Group Stage", dates: "28th of August - 16th of October 2026", status: "Active", level: "Senior" },
  { id: "demo2", title: "Paris Arena Open", dates: "28th of August - 16th of October 2026", status: "Active", level: "Intermediate" },
];

/* ---------- Player side ---------- */
export const me = players.find((p) => p.id === "ade")!;
export const myClubs = [
  { id: "paris", name: "Paris Arena", logo: "/club/logo.jpg", role: "Admin", href: "/" },
  { id: "lagos", name: "Lagos Spin Club", logo: undefined as string | undefined, role: "Player", href: "/play" },
  { id: "abuja", name: "Abuja Rally TTC", logo: undefined as string | undefined, role: "Player", href: "/play" },
];
export const due = { plan: "Monthly", amount: "₦6,000", due: "28 Nov 2026", status: "due" as "due" | "paid" | "overdue" };
export type MyMatch = { id: string; comp: string; when: string; oppId: string; result?: { won: boolean; score: string; games: Array<[number, number]> } };
export const myMatches: MyMatch[] = [
  { id: "m5", comp: "Paris Arena Group Stage", when: "Sat 7 Nov, 4:00 pm", oppId: "pastor" },
  { id: "m4", comp: "Paris Arena Group Stage", when: "28 Oct", oppId: "sule", result: { won: true, score: "3–1", games: [[11, 7], [9, 11], [11, 8], [11, 6]] } },
  { id: "m3", comp: "Paris Arena Group Stage", when: "21 Oct", oppId: "nurudeen", result: { won: true, score: "3–2", games: [[11, 9], [8, 11], [11, 7], [9, 11], [11, 8]] } },
  { id: "m2", comp: "Paris Arena Open", when: "10 Oct", oppId: "jide", result: { won: false, score: "0–3", games: [[5, 11], [7, 11], [9, 11]] } },
  { id: "m1", comp: "Paris Arena Open", when: "3 Oct", oppId: "dorathy", result: { won: false, score: "2–3", games: [[11, 9], [9, 11], [11, 8], [7, 11], [8, 11]] } },
];
export const myComps = [
  { id: "demo", title: "Paris Arena Group Stage", dates: "28 Aug – 16 Oct 2026", status: "Active", level: "Junior" },
  { id: "demo2", title: "Paris Arena Open", dates: "3 Oct – 30 Nov 2026", status: "Active", level: "Junior" },
  { id: "past1", title: "Founders Cup", dates: "1 Jun – 20 Jun 2026", status: "Past", level: "Junior" },
];
export const myStats = {
  played: 38, won: 18, lost: 20, streak: "2 wins", titles: 0, form: ["W", "W", "L", "L", "W"] as Array<"W" | "L">,
  gamesFor: 71, gamesAgainst: 78, pointsFor: 1480, pointsAgainst: 1536, elo: 1186,
  eloYears: ["2022", "2023", "2024", "2025", "2026"], eloSeries: [1100, 1150, 1170, 1160, 1186],
  rankSeries: [60, 44, 30, 18, 7],
};
export const h2h = [
  { oppId: "pastor", won: 3, lost: 4 }, { oppId: "sule", won: 5, lost: 2 }, { oppId: "jide", won: 1, lost: 6 },
  { oppId: "nurudeen", won: 4, lost: 3 }, { oppId: "dorathy", won: 2, lost: 3 },
];
export const globalRanks = [
  { id: "g1", name: "Chidi Okeke", points: 340, photo: "" }, { id: "g2", name: "Femi Adeyemi", points: 312, photo: "" },
  { id: "g3", name: "Jide Taiwo", points: 100, photo: "/players/jide.png" }, { id: "g4", name: "Amaka Obi", points: 96, photo: "" },
  { id: "g5", name: "Ade", points: 25, photo: "/players/ade.png" },
];
export const myPayments = [
  { id: "p1", title: "Monthly · October", date: "28 Oct 2026", amount: "₦6,000", status: "paid" as const },
  { id: "p2", title: "Monthly · September", date: "28 Sep 2026", amount: "₦6,000", status: "paid" as const },
  { id: "p3", title: "Registration", date: "3 Sep 2026", amount: "₦5,000", status: "paid" as const },
];
export const oppName = (id: string) => byId(id)?.name ?? "Opponent";
export const oppPhoto = (id: string) => byId(id)?.photo;
