/** Where to go after sign-in. Only a path on this site: anything a browser could read as another host is replaced by "/". */
export function safeNext(next: unknown): string {
  if (typeof next !== "string" || next.length === 0 || next.length > 500) return "/";
  // Browsers drop tabs and newlines inside URLs and treat "\" like "/", so "/\evil.com" and "/<TAB>/evil.com" mean "//evil.com".
  if (/[\\\u0000-\u001f\u007f]/.test(next)) return "/";
  if (!next.startsWith("/") || next.startsWith("//")) return "/";
  try {
    const u = new URL(next, "https://rallix.invalid");
    if (u.origin !== "https://rallix.invalid") return "/";
  } catch { return "/"; }
  return next;
}

/** Hosts of the real browser push services. A subscription pointing anywhere else would make our server call that address. */
const PUSH_HOSTS = [
  /^fcm\.googleapis\.com$/,
  /^android\.googleapis\.com$/,
  /^updates\.push\.services\.mozilla\.com$/,
  /^[a-z0-9-]+\.push\.services\.mozilla\.com$/,
  /^[a-z0-9.-]+\.notify\.windows\.com$/,
  /^web\.push\.apple\.com$/,
  /^[a-z0-9-]+\.push\.apple\.com$/,
];

export function isPushEndpoint(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 1000) return false;
  let u: URL;
  try { u = new URL(value); } catch { return false; }
  if (u.protocol !== "https:" || u.username || u.password) return false;
  if (u.port && u.port !== "443") return false;
  return PUSH_HOSTS.some((r) => r.test(u.hostname));
}

/** Sign-in names: 3 to 20 lowercase letters, digits or underscores. Returns the cleaned name or a plain-words problem. */
export function checkUsername(raw: unknown): { ok: true; username: string } | { ok: false; error: string } {
  const u = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (u.length < 3 || u.length > 20) return { ok: false, error: "Use 3 to 20 characters." };
  if (!/^[a-z0-9_]+$/.test(u)) return { ok: false, error: "Use only letters, numbers and underscores." };
  return { ok: true, username: u };
}

/** Passwords: 8 to 128 characters, not the same as the username or email. Spaces are allowed (passphrases). */
export function checkPassword(raw: unknown, also: { username?: string; email?: string } = {}): { ok: true } | { ok: false; error: string } {
  const p = typeof raw === "string" ? raw : "";
  if (p.length < 8) return { ok: false, error: "Use at least 8 characters." };
  if (p.length > 128) return { ok: false, error: "That password is too long (128 characters at most)." };
  const low = p.toLowerCase();
  if ((also.username && low === also.username.toLowerCase()) || (also.email && low === also.email.toLowerCase())) return { ok: false, error: "Your password can’t be the same as your username or email." };
  if (/^(.)\1+$/.test(p) || ["password", "12345678", "123456789", "qwertyuiop"].includes(low)) return { ok: false, error: "Choose something harder to guess." };
  return { ok: true };
}
