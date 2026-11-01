# @rallix/payments

Payment provider layer. The app talks to `PaymentProvider`; `PaystackProvider` is the real one, `FakeProvider` is for development and tests.

## How money flows
- **Player dues** go to the club. The club's bank account is registered as a Paystack *subaccount* with `percentage_charge: 0` and payments use `bearer: "subaccount"`, so Rallix takes nothing and Paystack's fee comes out of the club's side.
- **Club subscriptions** are Rallix invoices paid on Rallix's own Paystack account (no subaccount).
- Amounts are integer **kobo**, always read from our database, never from the browser.

## Why crediting is safe (`apps/club/lib/payments-core.ts`)
1. We record the expected payment (reference + amount) *before* the customer leaves.
2. Webhooks must carry a valid HMAC-SHA512 signature of the exact raw body.
3. Even then we never credit from the webhook body: we ask the provider to verify the reference, then `reconcile()` reference, status, currency and amount against our own record.
4. Crediting happens in one transaction under a row lock, and replays change nothing.
5. Every webhook is logged in `payment_events` (visible in the console under Payments).

## Before you point this at real money (go-live checklist)
1. **Confirm the Paystack request shapes with a TEST key.** They were written from memory of Paystack's docs:
   `PAYSTACK_SECRET_KEY=sk_test_xxx pnpm --filter @rallix/payments smoke` (refuses live keys). Paste any FAIL lines back so they can be fixed.
2. In the club app environment set `PAYMENTS_PROVIDER=paystack`, `PAYSTACK_SECRET_KEY` (server-only, never `NEXT_PUBLIC_`), and `APP_URL` to the public URL.
3. In the Paystack dashboard set the webhook URL to `https://<your domain>/api/webhooks/paystack` (test and live are configured separately).
4. Test end to end in test mode with Paystack's test cards: pay a due, then replay the webhook from the dashboard and confirm nothing is double-credited.
5. Complete Paystack business verification before switching to live keys. Settlement to subaccounts uses the bank details clubs enter, so double-check the account-name confirmation screen with a real account.
6. Replace the placeholder-email behaviour if you want receipts: players without an email use `<phone>@phone.rallix.app`, which cannot receive mail.

## Pay by link (Rallix invoices)
Staff can copy or WhatsApp-share a public link for any issued invoice (`/pay/invoice/<token>`). Anyone holding it can pay that one invoice, even a club that is suspended and cannot sign in. The page shows only the club name, invoice number, period and amount. A club suspended for **non-payment** is reactivated automatically once nothing else is overdue; any other suspension stays until staff lift it. Replace or turn off a link from the invoice page in the console. Tokens are 24 characters (about 138 bits), never readable by the app database role, and unknown, malformed, draft or replaced tokens all show the same generic page.

## Not handled yet
- Refunds and failed-charge webhooks (only `charge.success` is acted on; failures are detected when the customer returns).
- Recurring card charges (invoices are paid one at a time).
