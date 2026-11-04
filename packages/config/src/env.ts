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

/* ---------- Production safety, and the one narrow exception for browser tests in CI ---------- */

function isLocalHost(url: string | undefined): boolean {
  if (!url) return false;
  try { const h = new URL(url).hostname.toLowerCase(); return h === "localhost" || h === "127.0.0.1" || h === "::1" || h === "[::1]"; } catch { return false; }
}

/**
 * Browser tests in CI run the real production build (`next start`), which refuses the development mailer, fake payments, local picture
 * storage and the console push sender. They need those. This allows it ONLY when ALL of these hold: RALLIX_CI_E2E=1, the build is not on
 * Vercel, and every database URL points at this same machine. A real deployment can never satisfy the last two, so a leaked flag changes nothing.
 */
export function ciE2eAllowed(env: Record<string, string | undefined> = process.env): boolean {
  if (env.RALLIX_CI_E2E !== "1" || env.VERCEL) return false;
  const urls = [env.DATABASE_URL_APP, env.DATABASE_URL_SERVICE, env.DATABASE_URL_OWNER].filter((u): u is string => !!u);
  return urls.length > 0 && urls.every(isLocalHost);
}

/** Is this a real production run? True for NODE_ENV=production unless the CI exception above applies. */
export function isProduction(env: Record<string, string | undefined> = process.env): boolean {
  return env.NODE_ENV === "production" && !ciE2eAllowed(env);
}

/** The environment to hand to the adapter factories (mailer, payments, pictures, push): development-like only under the CI exception. */
export function appEnv(env: Record<string, string | undefined> = process.env): Record<string, string | undefined> {
  return ciE2eAllowed(env) ? { ...env, NODE_ENV: "development" } : env;
}
