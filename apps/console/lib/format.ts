export const naira = (kobo: number | string | null | undefined) => `₦${(Number(kobo ?? 0) / 100).toLocaleString("en-NG", { maximumFractionDigits: 0 })}`;
export const date = (d: Date | string | null | undefined) => (d ? new Date(d).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" }) : "—");
export const dateTime = (d: Date | string | null | undefined) => (d ? new Date(d).toLocaleString("en-NG", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "—");
export const ago = (d: Date | string | null | undefined) => {
  if (!d) return "never";
  const s = Math.max(0, (Date.now() - new Date(d).getTime()) / 1000);
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} d ago`;
};
export const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
