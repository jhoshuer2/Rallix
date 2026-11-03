/**
 * Pay-by-link end-to-end (fake provider). Needs a freshly seeded database and BOTH apps running (club :3000, console :3001).
 *   CLUB_LOG=/tmp/club.log CONSOLE_LOG=/tmp/console.log node apps/club/e2e/pay-link.cjs
 */
const { chromium } = require('playwright');
const fs = require('fs'); const crypto = require('crypto'); const { execSync } = require('child_process');
const CLUB = 'http://localhost:3000', CON = 'http://localhost:3001';
const LOGS = { [CLUB]: process.env.CLUB_LOG, [CON]: process.env.CONSOLE_LOG };
if (!LOGS[CLUB] || !LOGS[CON]) { console.error('Set CLUB_LOG and CONSOLE_LOG'); process.exit(2); }
const sql = q => execSync(`PGPASSWORD=service_dev psql -h localhost -U rallix_service -d ${process.env.PGDB||'rallix_dev'} -Atc "${q.replace(/"/g, '\\"')}"`).toString().trim();
const sign = body => crypto.createHmac('sha512', 'fake_webhook_secret').update(body).digest('hex');
const hook = async body => { const r = await fetch(CLUB + '/api/webhooks/paystack', { method: 'POST', headers: { 'content-type': 'application/json', 'x-paystack-signature': sign(body) }, body }); return r.json(); };
let pass = 0, fail = 0;
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
const clubId = slug => sql(`select id from clubs where slug='${slug}'`);
const tokenOf = id => sql(`select coalesce(pay_token,'') from platform_invoices where id='${id}'`);
(async () => {
  const b = await chromium.launch();
  const mk = async (w = 440, h = 956) => { const c = await b.newContext({ viewport: { width: w, height: h } }); const p = await c.newPage(); p._errs = []; p.on('pageerror', e => p._errs.push(e.message.slice(0, 120))); return p; };
  const text = p => p.locator('body').innerText();
  const LAGOS = clubId('lagos-spin'), PARIS = clubId('paris-arena');
  const lagosInv = sql(`select id from platform_invoices where club_id='${LAGOS}' and status='issued'`);

  console.log('1. staff manage the link');
  const O = await mk(1280, 900); await signIn(O, CON, '+2348030000200'); await O.goto(CON + '/invoices/' + lagosInv);
  ok(await O.getByRole('button', { name: 'Copy link' }).count() === 1, 'an issued invoice shows its pay link with Copy, WhatsApp, Replace and Turn off');
  const oldTok = tokenOf(lagosInv); ok(/^[A-Za-z0-9]{24,}$/.test(oldTok), 'the link has a long unguessable token');
  const wa = await O.getByRole('link', { name: 'Share on WhatsApp' }).getAttribute('href'); ok(/wa\.me\/\?text=/.test(wa) && decodeURIComponent(wa).includes('/pay/invoice/' + oldTok) && /Lagos Spin Club/.test(decodeURIComponent(wa)), 'WhatsApp share pre-fills club, invoice number, amount and the link');
  O.once('dialog', d => d.accept()); await O.getByRole('button', { name: 'Replace link' }).click(); await O.getByText(/old one no longer works/i).waitFor({ timeout: 10000 });
  const tok = tokenOf(lagosInv); ok(tok !== oldTok && tok.length >= 24, 'replacing the link issues a new token');
  const V = await mk(); let res = await V.goto(CLUB + '/pay/invoice/' + oldTok);
  ok(/Link not valid/i.test(await text(V)), 'the OLD link stops working immediately');
  res = await V.goto(CLUB + '/pay/invoice/' + tok);
  ok(/Lagos Spin Club/.test(await text(V)) && /₦20,000/.test(await text(V)), 'the new link shows the club and amount to a signed-out visitor');
  const t0 = await text(V);
  ok(!/Ade|\+234|@|Innocent|owner/i.test(t0.replace(/Rallix invoice|Lagos Spin Club/g, '')), 'the public page shows no owner name, phone or email');
  const h = res.headers(); ok(/no-store/.test(h['cache-control'] || '') && /no-referrer/.test(h['referrer-policy'] || '') && /noindex/.test(h['x-robots-tag'] || ''), 'page is no-store, no-referrer and noindex');
  ok(Number(sql(`select count(*) from audit_log where action='invoice.paylink_replace'`)) === 1, 'replacing the link is audited');

  console.log('2. a club suspended for non-payment pays its way back');
  await O.goto(CON + '/clubs/' + LAGOS); await O.getByLabel('Details').fill('Overdue October invoice'); await O.getByRole('button', { name: 'Suspend club' }).click(); await O.getByText(/Club suspended/).waitFor({ timeout: 10000 });
  ok(sql(`select status || ':' || suspension_reason from clubs where id='${LAGOS}'`) === 'suspended:non_payment', 'suspended with reason type "non-payment" by default');
  sql(`insert into users (id, name, email, phone_number, phone_number_verified) values ('only_lagos','Lagos Treasurer','lt@x.example','+2348030000300',true)`);
  sql(`insert into memberships (club_id, user_id, roles) values ('${LAGOS}','only_lagos', ARRAY['admin']::member_role[])`);
  const A = await mk(); await signIn(A, CLUB, '+2348030000300'); await A.goto(CLUB + '/'); await A.waitForURL(/suspended/, { timeout: 15000 }); ok(/currently suspended/i.test(await text(A)), 'an admin who only belongs to that club is locked out and sees "Club unavailable"');
  const AD = await mk(); await signIn(AD, CLUB, '+2348030000006'); await AD.goto(CLUB + '/play'); await AD.getByRole('button', { name: /Switch club/ }).click(); await AD.waitForTimeout(400);
  ok(/Unavailable/.test(await AD.locator('dialog').innerText()) && /Lagos Spin Club is suspended/.test(await AD.locator('dialog').innerText()), 'a member of several clubs sees the suspended one explained in the club switcher');
  await V.goto(CLUB + '/pay/invoice/' + tok); await V.getByLabel(/Email for your receipt/).fill('not-an-email'); await V.getByRole('button', { name: /^Pay ₦20,000/ }).click();
  await V.getByText(/doesn.t look right/i).waitFor({ timeout: 10000 }); ok(true, 'an invalid receipt email is refused');
  await V.getByLabel(/Email for your receipt/).fill('treasurer@lagosspin.example'); await V.getByRole('button', { name: /^Pay ₦20,000/ }).click(); await V.waitForURL(/\/pay\/fake/, { timeout: 20000 });
  const ref = sql(`select reference from invoice_payments where invoice_id='${lagosInv}' and via_link order by created_at desc limit 1`);
  ok(/^RLX-I-/.test(ref) && sql(`select amount_kobo || ':' || payer_email from invoice_payments where reference='${ref}'`) === '2000000:treasurer@lagosspin.example', 'attempt recorded first, amount from the database, receipt email kept');
  await V.getByRole('button', { name: 'Pay now' }).click(); await V.waitForURL(/\/pay\/invoice\/.*\/return/, { timeout: 20000 }); await V.waitForLoadState('networkidle');
  ok(/Payment received/i.test(await text(V)), 'the visitor sees the payment confirmed');
  ok(sql(`select status from platform_invoices where id='${lagosInv}'`) === 'paid', 'invoice marked paid');
  ok(sql(`select status || ':' || coalesce(suspension_reason::text,'none') from clubs where id='${LAGOS}'`) === 'active:none', 'the club is reactivated and the reason cleared');
  ok(Number(sql(`select count(*) from audit_log where action='club.reactivated_on_payment'`)) === 1, 'automatic reactivation is audited');
  await A.goto(CLUB + '/'); await A.waitForLoadState('networkidle'); ok(/HOME/i.test(await text(A)), 'the admin can use the club app again');
  const r = await hook(JSON.stringify({ event: 'charge.success', data: { reference: ref, amount: 2000000, currency: 'NGN' } }));
  ok(r.outcome === 'already_processed' && Number(sql(`select count(*) from audit_log where action='club.reactivated_on_payment'`)) === 1, 'replaying the webhook changes nothing');
  await V.goto(CLUB + '/pay/invoice/' + tok); ok(/Invoice paid/i.test(await text(V)) && !(await V.getByRole('button', { name: /^Pay/ }).count()), 'the link now says the invoice is paid and offers no Pay button');

  console.log('3. a suspension for another reason is never lifted by payment');
  await O.goto(CON + '/invoices?new=1'); await O.locator('form select').first().selectOption(PARIS); await O.getByLabel('Period').fill('2026-12'); await O.getByLabel(/Total/).fill('20000'); await O.getByRole('button', { name: 'Create invoice' }).click(); await O.waitForURL(/\/invoices\/[0-9a-f-]{36}/, { timeout: 15000 });
  const parisInv = sql(`select id from platform_invoices where club_id='${PARIS}' and period_label='2026-12'`);
  await O.goto(CON + '/clubs/' + PARIS); await O.getByText('Something else').click(); await O.getByLabel('Details').fill('Conduct complaint under review'); await O.getByRole('button', { name: 'Suspend club' }).click(); await O.getByText(/Club suspended/).waitFor({ timeout: 10000 });
  ok(sql(`select suspension_reason from clubs where id='${PARIS}'`) === 'other', 'suspended with reason type "other"');
  const P = await mk(); await P.goto(CLUB + '/pay/invoice/' + tokenOf(parisInv)); await P.getByRole('button', { name: /^Pay ₦20,000/ }).click(); await P.waitForURL(/\/pay\/fake/, { timeout: 20000 });
  await P.getByRole('button', { name: 'Pay now' }).click(); await P.waitForURL(/\/return/, { timeout: 20000 }); await P.waitForLoadState('networkidle');
  ok(sql(`select status from platform_invoices where id='${parisInv}'`) === 'paid', 'the invoice is paid');
  ok(sql(`select status from clubs where id='${PARIS}'`) === 'suspended', 'but the club stays suspended: only staff can lift an "other" suspension');
  await O.goto(CON + "/payments"); let t = await text(O); ok(/Paid but still locked out/i.test(t) && /Paris Arena/.test(t) && /only staff can reactivate/i.test(t), 'the console flags it for a human');

  console.log('4. other overdue invoices block automatic reactivation');
  sql(`update clubs set status='suspended', suspension_reason='non_payment' where id='${LAGOS}'`);
  sql(`insert into platform_invoices (club_id, number, status, amount_kobo, period_label, issued_at, due_at, pay_token) values ('${LAGOS}','T-A','issued',100000,'t-a', now()-interval '30 days', now()-interval '16 days','OverdueTokenAAAAAAAAAAAAAA'), ('${LAGOS}','T-B','issued',100000,'t-b', now()-interval '20 days', now()-interval '6 days','OverdueTokenBBBBBBBBBBBBBB')`);
  const pay = async tokenStr => { const p = await mk(); await p.goto(CLUB + '/pay/invoice/' + tokenStr); await p.getByRole('button', { name: /^Pay ₦1,000/ }).click(); await p.waitForURL(/\/pay\/fake/, { timeout: 20000 }); await p.getByRole('button', { name: 'Pay now' }).click(); await p.waitForURL(/\/return/, { timeout: 20000 }); await p.waitForLoadState('networkidle'); return p; };
  await pay('OverdueTokenAAAAAAAAAAAAAA'); ok(sql(`select status from clubs where id='${LAGOS}'`) === 'suspended', 'paying one of two overdue invoices does NOT reactivate the club');
  await pay('OverdueTokenBBBBBBBBBBBBBB'); ok(sql(`select status from clubs where id='${LAGOS}'`) === 'active', 'paying the last overdue invoice does');

  console.log('5. link states and hostile input');
  const voidInv = sql(`insert into platform_invoices (club_id, number, status, amount_kobo, period_label, pay_token) values ('${PARIS}','T-V','void',100,'t-v','VoidTokenVVVVVVVVVVVVVVVV') returning id`);
  const draftTok = 'DraftTokenDDDDDDDDDDDDDDDD'; sql(`insert into platform_invoices (club_id, number, status, amount_kobo, period_label, pay_token) values ('${PARIS}','T-D','draft',100,'t-d','${draftTok}')`);
  const G = await mk(); void voidInv;
  await G.goto(CLUB + '/pay/invoice/VoidTokenVVVVVVVVVVVVVVVV'); ok(/Invoice cancelled/i.test(await text(G)) && !(await G.getByRole('button', { name: /^Pay/ }).count()), 'a void invoice says it is cancelled and cannot be paid');
  const gen = async u => { await G.goto(CLUB + u); await G.waitForLoadState('networkidle'); return (await text(G)).replace(/\s+/g, ' '); };
  const a = await gen('/pay/invoice/ZZZZZZZZZZZZZZZZZZZZZZZZ'), c = await gen('/pay/invoice/' + draftTok), d = await gen('/pay/invoice/short'), e = await gen("/pay/invoice/'%20OR%201=1%20--aaaaaaaaaaaaaaaaaaaa"), f = await gen('/pay/invoice/' + oldTok);
  const generic = [a, c, d, e, f]; if (new Set(generic).size !== 1) console.log('    DIFFERING PAGES:', JSON.stringify(generic.map(x => x.slice(0, 90))));
  ok(generic.every(x => /Link not valid/i.test(x)) && new Set(generic).size === 1, 'unknown, draft, malformed, injection and replaced tokens all show the SAME generic page');
  await O.goto(CON + '/invoices/' + lagosInv); void 0;

  console.log('6. attempt limit and token isolation');
  await O.goto(CON + '/invoices?new=1'); await O.locator('form select').first().selectOption(PARIS); await O.getByLabel('Period').fill('2027-01'); await O.getByLabel(/Total/).fill('20000'); await O.getByRole('button', { name: 'Create invoice' }).click(); await O.waitForURL(/\/invoices\/[0-9a-f-]{36}/, { timeout: 15000 });
  const limInv = sql(`select id from platform_invoices where club_id='${PARIS}' and period_label='2027-01'`), limTok = tokenOf(limInv);
  const L = await mk(); let blocked = false;
  for (let i = 1; i <= 6; i++) { await L.goto(CLUB + '/pay/invoice/' + limTok); await L.getByRole('button', { name: /^Pay ₦20,000/ }).click(); await L.waitForTimeout(1500); if (/Too many attempts for this invoice/i.test(await text(L))) { blocked = i === 6; break; } }
  ok(blocked && Number(sql(`select count(*) from invoice_payments where invoice_id='${limInv}'`)) === 5, 'the sixth attempt in an hour is refused, and only five were recorded');
  const otherRef = sql(`select reference from invoice_payments where invoice_id='${limInv}' limit 1`);
  const X = await mk(); await X.goto(CLUB + `/pay/invoice/${tok}/return?reference=${otherRef}`); ok(/Link not valid/i.test(await text(X)), 'a token cannot be used to look at a different invoice’s payment');
  await X.goto(CLUB + `/pay/invoice/${tok}/return?reference=garbage`); ok(/Link not valid/i.test(await text(X)), 'nor a malformed reference');

  console.log('7. turning a link off');
  await O.goto(CON + '/invoices/' + limInv); O.once('dialog', dd => dd.accept()); await O.getByRole('button', { name: 'Turn off' }).click(); await O.getByText('Link turned off.').waitFor({ timeout: 10000 });
  ok(tokenOf(limInv) === '', 'the token is removed'); await G.goto(CLUB + '/pay/invoice/' + limTok); ok(/Link not valid/i.test(await text(G)), 'the old link is dead');
  await O.getByRole('button', { name: 'Create pay link' }).click(); await O.getByText('Link created.').waitFor({ timeout: 10000 }); ok(tokenOf(limInv) !== '' && tokenOf(limInv) !== limTok, 'staff can create a fresh link afterwards');
  ok(Number(sql(`select count(*) from audit_log where action like 'invoice.paylink_%'`)) >= 3, 'link changes are audited');
  await O.screenshot({ path: process.env.E2E_OUT + '/l_console.png' }); await V.goto(CLUB + '/pay/invoice/' + tokenOf(limInv)); await V.screenshot({ path: process.env.E2E_OUT + '/l_public.png' });

  const errs = [O, V, A, AD, P, G, L, X].flatMap(p => p._errs); ok(errs.length === 0, 'no uncaught browser errors ' + JSON.stringify(errs));
  await b.close(); console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})().catch(e => { console.error('CRASH', e.message.split('\n').slice(0, 6).join('\n')); process.exit(2); });
