import { MailError } from "./types";

/** CR, LF, NEL, line/paragraph separator and NUL, built from code points so editors can't corrupt the pattern. */
const LINE_BREAKS = new RegExp("[" + [0x0d, 0x0a, 0x85, 0x2028, 0x2029, 0].map((c) => String.fromCharCode(c)).join("") + "]");

/** Header values must never contain line breaks: that is how attackers inject extra headers (Bcc:) or a second message. */
export function assertHeaderSafe(value: string, what: string): string {
  if (LINE_BREAKS.test(value)) throw new MailError(`${what} contains a line break`);
  return value;
}

const EMAIL = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]{1,64}@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;

/** One plain address only: no display name, no commas or semicolons (which would mean several recipients). */
export function assertEmail(value: string): string {
  const v = assertHeaderSafe(value.trim(), "Email address");
  if (v.length > 254 || !EMAIL.test(v)) throw new MailError("That email address is not valid");
  return v;
}
export const isEmail = (v: unknown): v is string => { try { return typeof v === "string" && !!assertEmail(v); } catch { return false; } };

export const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
