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
