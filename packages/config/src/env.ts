/**
 * Tolerant readers for settings people type into a hosting dashboard. Typos here have caused real outages
 * ("ttps://…", a missing https://, quote marks pasted from a .env example), so accept the harmless variants.
 */
const unquote = (v: string) => v.trim().replace(/^(["'])(.*)\1$/s, "$2").trim();

/** A base URL with a scheme and no trailing slash. "console.rallix.ng" becomes "https://console.rallix.ng". Empty stays undefined. */
export function normalizeBaseUrl(v: string | undefined | null): string | undefined {
  if (!v) return undefined;
  const t = unquote(v).replace(/\/+$/, "");
  if (!t) return undefined;
  if (/^https?:\/\//i.test(t)) return t;
  // Only add a scheme to something that looks like a host (localhost and plain host names use http for local development).
  if (/^(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(t)) return `http://${t}`;
  return `https://${t.replace(/^\/+/, "")}`;
}

/** A sender such as `Rallix <no-reply@rallix.ng>` without the quote marks that some dashboards keep as part of the value. */
export function normalizeMailFrom(v: string | undefined | null): string {
  return v ? unquote(v) : "";
}
