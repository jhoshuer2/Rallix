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
