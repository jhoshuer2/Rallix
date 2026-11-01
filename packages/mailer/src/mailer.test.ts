import { SMTPServer } from "smtp-server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ConsoleMailer, MailError, SmtpMailer, assertEmail, assertHeaderSafe, compose, createMailer, escapeHtml, fill, fillSubject, isEmail, layout, placeholdersIn, renderHtml, sendBatch, type Mailer, type Message } from "./index";

describe("email addresses", () => {
  it("accepts ordinary addresses and trims them", () => {
    for (const a of ["ade@example.com", "  ade@example.com ", "first.last+tag@sub.example.co.ng", "a_b-c@ex-ample.org"]) expect(assertEmail(a)).toBe(a.trim());
  });
  it("rejects anything that could mean more than one recipient or a header injection", () => {
    for (const bad of ["", "no-at-sign", "a@b", "a@b.", "@example.com", "a b@example.com", "a@example.com, b@example.com", "a@example.com;b@example.com", "<a@example.com>", "Ade <a@example.com>", "a@example.com\r\nBcc: x@evil.com", "a@example.com\nBcc: x@evil.com", "a@@example.com", `${"x".repeat(65)}@example.com`, `a@${"x".repeat(250)}.com`]) expect(() => assertEmail(bad), bad).toThrow(MailError);
    expect(isEmail("a@example.com")).toBe(true); expect(isEmail("nope")).toBe(false); expect(isEmail(42)).toBe(false);
  });
  it("rejects every kind of line break in header values", () => {
    for (const v of ["a\nb", "a\rb", "a\r\nb", "a\u0085b", "a b", "a b", "a\0b"]) expect(() => assertHeaderSafe(v, "Subject")).toThrow(/line break/);
    expect(assertHeaderSafe("Your Rallix code", "Subject")).toBe("Your Rallix code");
  });
});

describe("templates", () => {
  it("fills placeholders, tolerating spaces inside the braces", () => {
    expect(fill("Hi {{name}}, pay {{ amount }} by {{due_date}}.", { name: "Ade", amount: "₦6,000", due_date: "28 Nov" })).toBe("Hi Ade, pay ₦6,000 by 28 Nov.");
    expect(placeholdersIn("{{a}} {{b}} {{a}}")).toEqual(["a", "b"]);
  });
  it("treats a missing value as an error, never a blank", () => {
    expect(() => fill("Pay {{amount}} at {{pay_link}}", { amount: "₦1" })).toThrow(/pay_link/);
  });
  it("does not re-expand placeholders found inside values (no template injection)", () => {
    expect(fill("Hello {{name}}", { name: "{{secret}}" })).toBe("Hello {{secret}}");
  });
  it("refuses a subject that would contain a line break after filling", () => {
    expect(() => fillSubject("Invoice {{n}}", { n: "1\r\nBcc: evil@x.com" })).toThrow(/line break/);
    expect(fillSubject("  Invoice {{n}}  ", { n: "RLX-1" })).toBe("Invoice RLX-1");
  });
  it("escapes HTML in values and links only real URLs", () => {
    const html = renderHtml("Hi <script>alert(1)</script> & co\n\nPay: https://app.rallix.app/pay/invoice/Abc123.");
    expect(html).not.toContain("<script>"); expect(html).toContain("&lt;script&gt;");
    expect(html).toContain('<a href="https://app.rallix.app/pay/invoice/Abc123"'); expect(html).toMatch(/Abc123<\/a>\.<\/p>/);
    expect(renderHtml('x " onmouseover="alert(1) https://a.co/"b')).not.toMatch(/onmouseover="/);
    expect(escapeHtml(`<>&"'`)).toBe("&lt;&gt;&amp;&quot;&#39;");
  });
  it("javascript: and data: URLs are never turned into links", () => {
    const html = renderHtml("click javascript:alert(1) or data:text/html,hi");
    expect(html).not.toMatch(/<a /);
  });
  it("wraps in a layout with no remote images or scripts, and escapes the footer and title", () => {
    const html = layout({ title: "A <b>title</b>", bodyHtml: "<p>x</p>", footer: "You get this because <you> joined." });
    expect(html).not.toMatch(/<img|<script|https?:\/\/[^"' ]+\.(png|jpg|gif)/i); expect(html).toContain("&lt;b&gt;title"); expect(html).toContain("&lt;you&gt;");
  });
  it("compose returns subject, text and html together", () => {
    const m = compose({ subject: "Invoice {{n}}", body: "Hello {{name}}\n\nPay {{amount}}", vars: { n: "RLX-1", name: "Ade", amount: "₦20,000" }, footer: "Rallix, Abuja" });
    expect(m.subject).toBe("Invoice RLX-1"); expect(m.text).toContain("Hello Ade"); expect(m.text).toContain("--\nRallix, Abuja"); expect(m.html).toContain("₦20,000");
  });
});

describe("provider selection", () => {
  it("defaults to the console mailer in development", () => { expect(createMailer({ NODE_ENV: "development" }).name).toBe("console"); });
  it("refuses the console mailer in production, however it is requested", () => {
    expect(() => createMailer({ NODE_ENV: "production", MAIL_PROVIDER: "console" })).toThrow(/not allowed in production/);
  });
  it("production defaults to SMTP and needs both the URL and a sender", () => {
    expect(() => createMailer({ NODE_ENV: "production" })).toThrow(/MAIL_FROM/);
    expect(() => createMailer({ NODE_ENV: "production", MAIL_FROM: "Rallix <no-reply@x.com>", SMTP_URL: "https://x" })).toThrow(/smtp/);
    expect(createMailer({ NODE_ENV: "production", MAIL_FROM: "Rallix <no-reply@x.com>", SMTP_URL: "smtps://u:p@smtp.x.com:465" }).name).toBe("smtp");
  });
  it("rejects unknown providers and a sender containing a line break", () => {
    expect(() => createMailer({ MAIL_PROVIDER: "carrier-pigeon" })).toThrow(/Unknown/);
    expect(() => createMailer({ MAIL_PROVIDER: "smtp", SMTP_URL: "smtp://h", MAIL_FROM: "a@x.com\r\nBcc: e@x.com" })).toThrow(/line break/);
  });
});

describe("ConsoleMailer", () => {
  it("sends, fails on purpose for chosen addresses, and validates", async () => {
    const m = new ConsoleMailer(["bad@example.com"]);
    expect((await m.send({ to: "ok@example.com", subject: "s", text: "t" })).ok).toBe(true);
    expect(await m.send({ to: "BAD@example.com", subject: "s", text: "t" })).toEqual({ ok: false, error: "Simulated delivery failure" });
    expect((await m.send({ to: "x@example.com\nBcc: y@z.com", subject: "s", text: "t" })).ok).toBe(false);
  });
});

describe("SmtpMailer against a real local SMTP server", () => {
  let server: SMTPServer; let port = 0; let user = "rallix", pass = "secret";
  const received: Array<{ from: string; to: string[]; raw: string }> = [];
  beforeAll(async () => {
    server = new SMTPServer({
      authOptional: false, disabledCommands: ["STARTTLS"], allowInsecureAuth: true,
      onAuth(auth, _s, cb) { auth.username === user && auth.password === pass ? cb(null, { user: auth.username }) : cb(new Error("Invalid login")); },
      onRcptTo(addr, _s, cb) { addr.address.startsWith("reject@") ? cb(Object.assign(new Error("Mailbox unavailable"), { responseCode: 550 })) : cb(); },
      onData(stream, session, cb) { const chunks: Buffer[] = []; stream.on("data", (c) => chunks.push(c)); stream.on("end", () => { received.push({ from: session.envelope.mailFrom ? session.envelope.mailFrom.address : "", to: session.envelope.rcptTo.map((r) => r.address), raw: Buffer.concat(chunks).toString() }); cb(); }); },
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r)); port = (server.server.address() as { port: number }).port;
  });
  afterAll(() => new Promise<void>((r) => server.close(() => r())));
  const mailer = (u = user, p = pass) => new SmtpMailer({ url: `smtp://${u}:${p}@127.0.0.1:${port}`, from: "Rallix <no-reply@rallix.test>", replyTo: "support@rallix.test" });
  const msg = (o: Partial<Message> = {}): Message => ({ to: "ade@example.com", subject: "Invoice RLX-1", text: "Hello Ade\n\nPay ₦20,000", html: "<p>Hello Ade</p>", ...o });

  it("delivers a multipart message with correct envelope, headers and UTF-8", async () => {
    const r = await mailer().send(msg()); expect(r.ok).toBe(true);
    const got = received.at(-1)!;
    expect(got.to).toEqual(["ade@example.com"]); expect(got.from).toBe("no-reply@rallix.test");
    expect(got.raw).toMatch(/^From: Rallix <no-reply@rallix\.test>/mi); expect(got.raw).toMatch(/^Reply-To: support@rallix\.test/mi); expect(got.raw).toMatch(/^Subject: Invoice RLX-1/mi);
    expect(got.raw).toMatch(/multipart\/alternative/i); expect(got.raw).toMatch(/text\/plain/i); expect(got.raw).toMatch(/text\/html/i);
    expect(got.raw).toMatch(/^X-Auto-Response-Suppress/mi);
    expect(got.raw).toMatch(/charset=utf-8/i);
  });
  it("cannot be tricked into adding recipients or headers", async () => {
    const before = received.length;
    for (const bad of [msg({ to: "a@example.com, b@example.com" }), msg({ to: "a@example.com\r\nBcc: e@x.com" }), msg({ subject: "Hi\r\nBcc: e@x.com" })]) expect((await mailer().send(bad)).ok).toBe(false);
    expect(received.length).toBe(before);
  });
  it("reports a login failure without leaking details", async () => {
    const r = await mailer("rallix", "wrong").send(msg()); expect(r).toEqual({ ok: false, error: "The mail server rejected our login" });
  });
  it("reports a rejected recipient as a failure, not a crash", async () => {
    const r = await mailer().send(msg({ to: "reject@example.com" })); expect(r.ok).toBe(false);
  });
  it("reports an unreachable server as a failure", async () => {
    const r = await new SmtpMailer({ url: "smtp://u:p@127.0.0.1:1", from: "a@x.com" }).send(msg()); expect(r.ok).toBe(false);
  });
});

describe("sendBatch", () => {
  const flaky: Mailer = { name: "console", async send(m) { if (m.to.startsWith("boom@")) throw new Error("kaboom"); return m.to.startsWith("fail@") ? { ok: false, error: "nope" } : { ok: true, messageId: "id" }; } };
  const items = ["a@x.com", "fail@x.com", "b@x.com", "boom@x.com", "c@x.com"].map((to) => ({ key: to, message: { to, subject: "s", text: "t" } }));
  it("keeps going after failures and thrown errors, reporting each recipient", async () => {
    const out = await sendBatch(flaky, items, { concurrency: 2 });
    expect(out.map((o) => [o.key, o.result.ok])).toEqual([["a@x.com", true], ["fail@x.com", false], ["b@x.com", true], ["boom@x.com", false], ["c@x.com", true]]);
    expect((out[3]!.result as { error: string }).error).toBe("kaboom");
  });
  it("respects the limit so a caller can resume with the rest", async () => {
    const out = await sendBatch(flaky, items, { limit: 2 }); expect(out.map((o) => o.key)).toEqual(["a@x.com", "fail@x.com"]);
  });
  it("never runs more than the allowed concurrency", async () => {
    let active = 0, peak = 0;
    const slow: Mailer = { name: "console", async send() { active++; peak = Math.max(peak, active); await new Promise((r) => setTimeout(r, 15)); active--; return { ok: true, messageId: null }; } };
    await sendBatch(slow, Array.from({ length: 20 }, (_, i) => ({ key: String(i), message: { to: "a@x.com", subject: "s", text: "t" } })), { concurrency: 4 });
    expect(peak).toBeLessThanOrEqual(4); expect(peak).toBeGreaterThan(1);
  });
  it("handles an empty list", async () => { expect(await sendBatch(flaky, [])).toEqual([]); });
});
