import { assertHeaderSafe, escapeHtml } from "./safe";
import { MailError } from "./types";

const PLACEHOLDER = /\{\{\s*([a-z_]+)\s*\}\}/g;

/** Names of the placeholders a template uses. */
export const placeholdersIn = (text: string): string[] => [...new Set([...text.matchAll(PLACEHOLDER)].map((m) => m[1]!))];

/**
 * Fill {{placeholders}}. A placeholder with no value is an ERROR, never silently blank: an invoice email with an empty
 * amount or pay link is worse than no email. Values are inserted as plain text; HTML escaping happens in renderHtml.
 */
export function fill(template: string, vars: Record<string, string | number>): string {
  const missing = placeholdersIn(template).filter((k) => !(k in vars));
  if (missing.length) throw new MailError(`Missing template values: ${missing.join(", ")}`);
  return template.replace(PLACEHOLDER, (_, k: string) => String(vars[k]));
}

/** Subject lines are headers: filled, then checked for line breaks. */
export const fillSubject = (subject: string, vars: Record<string, string | number>) => assertHeaderSafe(fill(subject, vars).trim(), "Subject");

const URL_RE = /(https?:\/\/[^\s<>"']+[^\s<>"'.,;:!?)])/g;

const linkify = (escaped: string) => escaped.replace(URL_RE, (u) => `<a href="${u}" style="color:#b54829">${u}</a>`);

/** Plain text to HTML: escape everything first, then turn paragraphs and bare links into markup. Never trusts the input. */
export function renderHtml(text: string): string {
  return text.split(/\n{2,}/).map((para) => {
    const safe = escapeHtml(para.trim()).replace(URL_RE, (u) => `<a href="${u}" style="color:#b54829">${u}</a>`);
    return `<p style="margin:0 0 16px;line-height:1.5">${safe.replace(/\n/g, "<br>")}</p>`;
  }).join("");
}

/** Branded wrapper. Inline CSS only and no remote images: many clients block them and they hurt deliverability. */
export function layout(opts: { title: string; bodyHtml: string; footer?: string; company?: string }): string {
  const company = escapeHtml(opts.company ?? "Rallix");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(opts.title)}</title></head>
<body style="margin:0;background:#e3dfd3;font-family:Arial,Helvetica,sans-serif;color:#141414">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#e3dfd3"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:8px;overflow:hidden">
<tr><td style="background:#3b6ca7;color:#ffffff;padding:18px 24px;font-size:20px;font-weight:bold;font-style:italic;text-transform:uppercase">${company}</td></tr>
<tr><td style="padding:24px;font-size:16px">${opts.bodyHtml}</td></tr>
<tr><td style="padding:16px 24px;background:#f4f1e8;font-size:12px;color:#555555;line-height:1.5">${linkify(escapeHtml(opts.footer ?? `Sent by ${opts.company ?? "Rallix"}.`)).replace(/\n/g, "<br>")}</td></tr>
</table></td></tr></table></body></html>`;
}

/** Fill a template and produce both text and HTML parts. */
export function compose(opts: { subject: string; body: string; vars: Record<string, string | number>; footer?: string; company?: string }) {
  const subject = fillSubject(opts.subject, opts.vars);
  const text = `${fill(opts.body, opts.vars)}${opts.footer ? `\n\n--\n${opts.footer}` : ""}`;
  const html = layout({ title: subject, bodyHtml: renderHtml(fill(opts.body, opts.vars)), footer: opts.footer, company: opts.company });
  return { subject, text, html };
}

/** The sign-in code email, shared by the club app and the console so the wording and safety notes match. */
export function otpMessage(code: string, product: "Rallix" | "Rallix Console" = "Rallix") {
  return compose({
    subject: `Your ${product} sign-in code`,
    body: `Your ${product} sign-in code is {{code}}.\n\nIt expires in 5 minutes. If you didn't ask for it, you can ignore this email: nobody can sign in without the code.`,
    vars: { code },
    footer: "Never share this code with anyone. Rallix will never ask you for it.",
  });
}
