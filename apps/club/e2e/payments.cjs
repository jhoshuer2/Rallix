/**
 * Payments end-to-end (fake provider). Needs a freshly seeded database and BOTH apps running (club :3000, console :3001).
 *   CLUB_LOG=/tmp/club.log CONSOLE_LOG=/tmp/console.log node apps/club/e2e/payments.cjs
 */
const { chromium } = require('playwright');
const fs = require('fs'); const crypto = require('crypto'); const { execSync } = require('child_process');
const CLUB = 'http://localhost:3000', CON = 'http://localhost:3001';
const LOGS = { [CLUB]: process.env.CLUB_LOG, [CON]: process.env.CONSOLE_LOG };
if (!LOGS[CLUB] || !LOGS[CON]) { console.error('Set CLUB_LOG and CONSOLE_LOG'); process.exit(2); }
const sql = q => execSync(`PGPASSWORD=service_dev psql -h localhost -U rallix_service -d rallix_dev -Atc "${q.replace(/"/g, '\\"')}"`).toString().trim();
const sign = body => crypto.createHmac('sha512', 'fake_webhook_secret').update(body).digest('hex');
const hook = async (body, sig) => { const r = await fetch(CLUB + '/api/webhooks/paystack', { method: 'POST', headers: { 'content-type': 'application/json', 'x-paystack-signature': sig ?? sign(body) }, body }); return { status: r.status, json: await r.json().catch(() => null) }; };
const evt = (reference, amount = 600000) => JSON.stringify({ event: 'charge.success', data: { id: 1, reference, status: 'success', amount, currency: 'NGN' } });
let pass = 0, fail = 0, skipped = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ok  ', m); } else { fail++; console.log('  FAIL', m); } };
const EMAILS = { '+2348030000100': 'admin@example.com', '+2348030000200': 'owner@rallix.app', '+2348030000300': 'lt@x.example', '+2348039999999': 'newowner@example.com', '+2348038888888': 'joiner@example.com', '+2348037777777': 'badcode@example.com', '+2348030000000': 'jide@example.com', '+2348030000001': 'pastor@example.com', '+2348030000002': 'sule@example.com', '+2348030000003': 'nurudeen@example.com', '+2348030000004': 'dorathy@example.com', '+2348030000005': 'nathaniel@example.com', '+2348030000006': 'ade@example.com' };
const emailFor = p => EMAILS[p] || p;
const CODE_RE = (email) => new RegExp('\\[mail:dev\\] to ' + email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ' \\|[^\\n]*\\n\\s+Your (?:Rallix|Rallix Console) sign-in code is (\\d{6})', 'g');
async function readCode(logPath, email) {
  const log = require('fs').readFileSync(logPath).toString().replace(/\0/g, '');
  const all = [...log.matchAll(CODE_RE(email))]; return all.length ? all[all.length - 1][1] : null;
}
async function signIn(page, base, who) {
  const email = emailFor(who);
  await page.goto(base + '/sign-in'); await page.getByLabel(/Email address|Work email/).fill(email); await page.getByRole('button', { name: 'Email me a code' }).click();
  await page.getByLabel(/6-digit code/).waitFor({ timeout: 25000 }); await page.waitForTimeout(500);
  const code = await readCode(LOGS[base], email);
  await page.getByLabel(/6-digit code/).fill(code); await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForLoadState('networkidle'); await page.waitForTimeout(700);
}
const refFor = who => sql(`select p.provider_ref from payments p join memberships m on m.id=p.membership_id join users u on u.id=m.user_id where u.phone_number='${who}' and p.provider='fake' order by p.created_at desc limit 1`);
(async () => {
  const b = await chromium.launch();
  const mk = async (w = 440, h = 956) => { const c = await b.newContext({ viewport: { width: w, height: h } }); const p = await c.newPage(); p._errs = []; p.on('pageerror', e => p._errs.push(e.message.slice(0, 120))); return p; };
  const text = p => p.locator('body').innerText();
  const SULE = '+2348030000002', NURU = '+2348030000003', NATH = '+2348030000005', ADE = '+2348030000006', JIDE = '+2348030000000', ADMIN = '+2348030000100';

  console.log('1. before the club has set up payouts');
  const S = await mk(); await signIn(S, CLUB, SULE); await S.goto(CLUB + '/play/me/payments'); let t = await text(S);
  ok(/hasn.t set up online payments/i.test(t) && !(await S.getByRole('button', { name: /^Pay ₦/ }).count()), 'a player sees a clear message instead of a Pay button');

  console.log('2. admin sets up the payout account');
  const A = await mk(); await signIn(A, CLUB, ADMIN); await A.goto(CLUB + '/membership');
  ok(/Online payments are off/.test(await text(A)), 'membership page says online payments are not set up');
  await A.goto(CLUB + '/membership/payouts'); await A.getByRole('button', { name: /^Bank/ }).click(); await A.screenshot({ path: process.env.SHOT || '/tmp/bank_sheet.png' }); await A.getByLabel('Search banks').fill('access'); await A.getByRole('radio', { name: /Access/ }).first().click(); await A.getByRole('button', { name: /^Bank Access Bank/ }).waitFor(); await A.getByLabel('Account number').fill('0123450000'); await A.getByRole('button', { name: 'Verify account' }).click();
  await A.getByText(/could not find that account/i).waitFor({ timeout: 10000 }); ok(true, 'an account the bank cannot find is refused with a clear message');
  await A.getByLabel('Account number').fill('0123456789'); await A.getByRole('button', { name: 'Verify account' }).click();
  await A.getByText('TEST ACCOUNT 6789').waitFor({ timeout: 10000 }); ok(true, 'the account holder name is shown for the admin to confirm');
  ok(sql(`select payouts_enabled_at is null from clubs where slug='paris-arena'`) === 't', 'nothing is saved until the admin confirms');
  await A.getByRole('button', { name: 'Yes, use this account' }).click(); await A.waitForURL(/\/membership$/, { timeout: 15000 }); await A.waitForLoadState('networkidle');
  ok(/Access Bank ••6789/.test(await text(A)), 'membership page now shows the active payout account');
  ok(sql(`select payouts_enabled_at is not null and paystack_subaccount_code like 'ACCT_%' and payout_account_last4='6789' from clubs where slug='paris-arena'`) === 't', 'subaccount stored server-side; only the last 4 digits of the account are kept');
  ok(Number(sql(`select count(*) from audit_log where action='club.payout_setup'`)) === 1, 'payout setup is audited');

  console.log('3. a player pays a due');
  await S.goto(CLUB + '/play/me/payments'); ok(await S.getByRole('button', { name: /^Pay ₦6,000/ }).count() === 1, 'the Pay button now appears');
  await S.getByRole('button', { name: /^Pay ₦6,000/ }).click(); await S.waitForURL(/\/pay\/fake/, { timeout: 20000 });
  const ref = refFor(SULE); ok(/^RLX-D-[A-Z2-9]{20}$/.test(ref), 'a pending payment with an unguessable reference was recorded first (' + ref + ')');
  ok(sql(`select status || ':' || amount_kobo from payments where provider_ref='${ref}'`) === 'pending:600000', 'amount recorded from the database (₦6,000), status pending');
  ok(/₦6,000/.test(await text(S)), 'checkout shows the amount');
  await S.getByRole('button', { name: 'Pay now' }).click(); await S.waitForURL(/\/pay\/return/, { timeout: 20000 }); await S.waitForLoadState('networkidle'); t = await text(S);
  ok(/Payment received/i.test(t), 'return page confirms the payment');
  ok(sql(`select status || ':' || coalesce(method,'') from payments where provider_ref='${ref}'`) === 'paid:fake', 'payment is marked paid');
  ok(sql(`select d.status from dues d join payments p on p.due_id=d.id where p.provider_ref='${ref}'`) === 'paid', 'the due is marked paid');
  ok(Number(sql(`select count(*) from payment_events where reference='${ref}' and outcome='credited'`)) === 1, 'exactly one credit is logged (webhook)');
  await S.goto(CLUB + '/play/me/payments'); ok(/all paid up/i.test(await text(S)), 'the player now sees they are paid up');
  await S.screenshot({ path: process.env.E2E_OUT + '/p_paid.png' });

  console.log('4. replays, forgeries and mismatches');
  let r = await hook(evt(ref)); ok(r.status === 200 && r.json.outcome === 'already_processed', 'replaying the same webhook changes nothing');
  ok(Number(sql(`select count(*) from payments where provider_ref='${ref}'`)) === 1 && sql(`select status from payments where provider_ref='${ref}'`) === 'paid', 'still one payment, still paid');
  r = await hook(evt(ref), 'a'.repeat(128)); ok(r.status === 401, 'a webhook with a wrong signature is rejected (401)');
  r = await hook(evt(ref, 100), sign(evt(ref))); ok(r.status === 401, 'a valid signature on a TAMPERED body is rejected (401)');
  r = await fetch(CLUB + '/api/webhooks/paystack', { method: 'POST', body: evt(ref) }); ok(r.status === 401, 'a webhook with no signature is rejected (401)');
  r = await hook(evt('RLX-D-AAAAAAAAAAAAAAAAAAAA')); ok(r.status === 200 && r.json.outcome === 'unknown_reference', 'a signed webhook for a reference we never issued is logged, not credited');
  r = await hook(JSON.stringify({ event: 'transfer.success', data: {} })); ok(r.status === 200, 'unrelated events are acknowledged and ignored');
  ok(Number(sql(`select count(*) from payment_events where outcome='rejected_signature'`)) >= 3, 'rejected forgeries are logged for review');

  const N = await mk(); await signIn(N, CLUB, NURU); await N.goto(CLUB + '/play/me/payments');
  await N.getByRole('button', { name: /^Pay ₦6,000/ }).click(); await N.waitForURL(/\/pay\/fake/, { timeout: 20000 });
  const nref = refFor(NURU); sql(`update payments set amount_kobo=100 where provider_ref='${nref}'`);
  await N.getByRole('button', { name: 'Pay now' }).click(); await N.waitForURL(/\/pay\/return/, { timeout: 20000 }); await N.waitForLoadState('networkidle');
  ok(/couldn.t confirm this payment/i.test(await text(N)), 'if the provider amount differs from what we recorded, the customer is told we could not confirm it');
  ok(sql(`select status from payments where provider_ref='${nref}'`) === 'pending' && sql(`select d.status from dues d join payments p on p.due_id=d.id where p.provider_ref='${nref}'`) === 'overdue', 'and nothing is credited: payment pending, due still overdue');
  ok(Number(sql(`select count(*) from payment_events where reference='${nref}' and outcome='rejected_mismatch'`)) >= 1, 'the mismatch is logged for staff');

  const H = await mk(); await signIn(H, CLUB, NATH); await H.goto(CLUB + '/play/me/payments');
  await H.getByRole('button', { name: /^Pay ₦6,000/ }).click(); await H.waitForURL(/\/pay\/fake/, { timeout: 20000 });
  await H.getByRole('button', { name: /Simulate a failed payment/ }).click(); await H.waitForURL(/\/pay\/return/, { timeout: 20000 }); await H.waitForLoadState('networkidle');
  ok(/didn.t go through/i.test(await text(H)), 'a failed payment shows a clear message');
  ok(sql(`select status from payments where provider_ref='${refFor(NATH)}'`) === 'failed', 'recorded as failed');
  await H.goto(CLUB + '/play/me/payments'); ok(await H.getByRole('button', { name: /^Pay ₦6,000/ }).count() === 1, 'and the player can try again');

  console.log('5. one player cannot pay for another, or pay twice');
  const pageJs = async (p, url) => { await p.goto(url); return await p.evaluate(async () => (await Promise.all([...document.scripts].filter(s => s.src).map(s => fetch(s.src).then(r => r.text()).catch(() => '')))).join('\n')); };
  const js = await pageJs(S, CLUB + '/play/me/payments'); void js;
  const js2 = await pageJs(H, CLUB + '/play/me/payments');
  const m = js2.match(/([0-9a-f]{40,})\\*"\s*:\s*\\*"startDuePayment/);
  if (!m) { skipped++; console.log('  SKIP could not locate the startDuePayment action id in the page bundle, so the cross-player check was not run'); }
  else {
    const call = async (page, dueId) => page.evaluate(async ([id, due]) => { const r = await fetch(location.pathname, { method: 'POST', headers: { 'Next-Action': id, 'Content-Type': 'text/plain;charset=UTF-8', Accept: 'text/x-component' }, body: JSON.stringify([due]) }); return await r.text(); }, [m[1], dueId]);
    const sulesDue = sql(`select d.id from dues d join memberships m on m.id=d.membership_id join users u on u.id=m.user_id where u.phone_number='${SULE}'`);
    const jidesDue = sql(`select d.id from dues d join memberships m on m.id=d.membership_id join users u on u.id=m.user_id where u.phone_number='${JIDE}'`);
    const before = Number(sql(`select count(*) from payments`));
    let out = await call(H, sulesDue); ok(/"ok":false/.test(out) && /not found|already paid/i.test(out), 'Nathaniel cannot start a payment for Sule’s due');
    out = await call(H, jidesDue); ok(/"ok":false/.test(out), 'Nathaniel cannot start a payment for Jide’s (already paid) due');
    out = await call(H, 'not-a-uuid'); ok(/"ok":false/.test(out), 'a malformed id is refused');
    ok(Number(sql(`select count(*) from payments`)) === before, 'none of those attempts created a payment record');
  }

  console.log('6. admin records cash');
  await A.goto(CLUB + '/membership/payments'); const adeRow = A.getByRole('button', { name: /Record cash payment from Ade/ });
  ok(await adeRow.count() === 1, 'unpaid dues offer "Paid cash" and "Paid by transfer"');
  await adeRow.click(); await A.waitForTimeout(1500);
  ok(sql(`select p.provider || ':' || p.method || ':' || d.status from payments p join dues d on d.id=p.due_id join memberships m on m.id=p.membership_id join users u on u.id=m.user_id where u.phone_number='${ADE}'`) === 'manual:cash:paid', 'recorded as a manual cash payment and the due is paid');
  ok(await A.getByRole('button', { name: /Record cash payment from Ade/ }).count() === 0, 'the buttons disappear once paid');

  console.log('7. club pays its Rallix invoice (Lagos was past due)');
  const lagosInv = sql(`select i.id from platform_invoices i join clubs c on c.id=i.club_id where c.slug='lagos-spin' and i.status='issued'`);
  const L = await mk(); await signIn(L, CLUB, ADE); await L.goto(CLUB + '/membership/rallix'); t = await text(L);
  ok(/Lagos Spin Club/i.test(t) || /Rallix subscription/i.test(t), 'admin sees the Rallix billing page');
  ok(/past due/i.test(t) && await L.getByRole('button', { name: /^Pay ₦20,000/ }).count() === 1, 'a past-due club sees its subscription state and a Pay button on the issued invoice');
  await L.getByRole('button', { name: /^Pay ₦20,000/ }).click(); await L.waitForURL(/\/pay\/fake/, { timeout: 20000 });
  const iref = sql(`select reference from invoice_payments where invoice_id='${lagosInv}'`); ok(/^RLX-I-/.test(iref), 'an invoice payment attempt was recorded first');
  await L.getByRole('button', { name: 'Pay now' }).click(); await L.waitForURL(/\/pay\/return/, { timeout: 20000 }); await L.waitForLoadState('networkidle');
  ok(/Payment received/i.test(await text(L)), 'return page confirms');
  ok(sql(`select status || ':' || payment_ref from platform_invoices where id='${lagosInv}'`) === 'paid:' + iref, 'invoice marked paid with the provider reference');
  ok(sql(`select s.status from club_subscriptions s join clubs c on c.id=s.club_id where c.slug='lagos-spin'`) === 'active', 'the past-due subscription is reactivated');
  ok(Number(sql(`select count(*) from audit_log where action='invoice.paid_online'`)) === 1, 'an audit entry is written');
  r = await hook(evt(iref, 2000000)); ok(r.json.outcome === 'already_processed' && Number(sql(`select count(*) from audit_log where action='invoice.paid_online'`)) === 1, 'replaying the invoice webhook does not double-credit or double-audit');
  await L.goto(CLUB + '/membership/rallix'); ok(await L.getByRole('button', { name: /^Pay ₦/ }).count() === 0, 'a paid invoice no longer offers Pay');

  console.log('8. a normal player cannot reach club billing or someone else’s payment');
  await S.goto(CLUB + '/membership/rallix'); await S.waitForURL(/\/play/, { timeout: 15000 }); ok(true, 'players are redirected away from Rallix billing');
  await S.goto(CLUB + '/membership/payouts'); await S.waitForURL(/\/play/, { timeout: 15000 }); ok(true, 'and from payout setup');
  const res = await S.goto(CLUB + '/pay/return?reference=' + nref); ok(res.status() === 404, 'a player cannot view another player’s payment status (404)');
  const res2 = await S.goto(CLUB + '/pay/return?reference=' + iref); ok(res2.status() === 404, 'nor a club’s invoice payment');
  const res3 = await S.goto(CLUB + '/pay/return?reference=garbage'); ok(res3.status() === 404, 'nor a malformed reference');

  console.log('9. console visibility');
  const O = await mk(1280, 900); await signIn(O, CON, '+2348030000200'); await O.goto(CON + '/payments'); t = await text(O);
  ok(/rejected signature/i.test(t) && /rejected mismatch/i.test(t) && /unknown reference/i.test(t), 'staff see the forged, mismatched and unknown-reference events that need attention');
  ok(/credited/i.test(t), 'and the normal credited events');
  await O.goto(CON + '/invoices/' + lagosInv); ok(/Paid online via Paystack/.test(await text(O)), 'the invoice shows it was paid online, with the reference');
  const parisId = sql(`select id from clubs where slug='paris-arena'`); await O.goto(CON + '/clubs/' + parisId); ok(/Access Bank ••6789/.test(await text(O)), 'club detail shows the payout account status');
  await O.screenshot({ path: process.env.E2E_OUT + '/p_console.png' });

  const errs = [S, A, N, H, L, O].flatMap(p => p._errs); ok(errs.length === 0, 'no uncaught browser errors ' + JSON.stringify(errs));
  await b.close(); console.log(`\n${pass} passed, ${fail} failed${skipped ? `, ${skipped} skipped` : ''}`); process.exit(fail ? 1 : 0);
})().catch(e => { console.error('CRASH', e.message.split('\n').slice(0, 6).join('\n')); process.exit(2); });
