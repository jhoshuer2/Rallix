# @rallix/mailer

Email for sign-in codes, invoices and broadcasts. One interface, two senders: `SmtpMailer` (real) and `ConsoleMailer` (development, prints to the server log).

## Configure (`.env.local` of both apps)
```
MAIL_PROVIDER=smtp                      # defaults to console in development, smtp in production
SMTP_URL=smtps://user:pass@host:465     # any provider that offers SMTP
MAIL_FROM="Rallix <no-reply@yourdomain.com>"
MAIL_REPLY_TO=support@yourdomain.com    # optional
```
Production refuses `MAIL_PROVIDER=console`, because it would silently drop sign-in codes.

## Before launch (deliverability)
1. Use a **domain you own** and verify it with your email provider. Email from an unverified domain, or from a free address like Gmail, is often put in spam or rejected.
2. Add the DNS records the provider gives you: **SPF**, **DKIM**, and a **DMARC** policy. Without them, Gmail and Yahoo may reject bulk mail.
3. `MAIL_FROM` must be an address on that verified domain.
4. Run `pnpm --filter @rallix/mailer send-test you@example.com` with your real settings. Open the message, choose "Show original", and confirm SPF, DKIM and DMARC all say PASS, and that it landed in the inbox.
5. Check your provider's free-tier limits (daily and monthly sends) against: one code per sign-in, one email per invoice per club admin, and broadcasts to the audience size you expect. Gmail SMTP with an app password is fine for a quick test but is not for production.
6. Provider free plans and limits change often. Verify them on the provider's site; they were not checked when this was written.

## Safety built in
- Recipients are validated as a single plain address; line breaks and commas are rejected everywhere (header injection).
- Template placeholders with no value are an error (an invoice with a blank amount never goes out).
- HTML is built from escaped text; no remote images or scripts.
- Failures are reported per recipient and never stop a batch.
