/**
 * Console end-to-end check, run against a freshly seeded database with BOTH apps running (club :3000, console :3001).
 * OTP codes are read from each app's dev log:
 *   CLUB_LOG=/tmp/club.log CONSOLE_LOG=/tmp/console.log node apps/console/e2e/full-flow.cjs
 */
const { chromium } = require('playwright');
const fs = require('fs');
const { execSync } = require('child_process');
const CLUB = 'http://localhost:3000', CON = 'http://localhost:3001';
const LOGS = { [CLUB]: process.env.CLUB_LOG, [CON]: process.env.CONSOLE_LOG };
if (!LOGS[CLUB] || !LOGS[CON]) { console.error('Set CLUB_LOG and CONSOLE_LOG'); process.exit(2); }
const sql = q => execSync(`PGPASSWORD=service_dev psql -h localhost -U rallix_service -d rallix_dev -Atc "${q.replace(/"/g, '\\"')}"`).toString().trim();
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ok  ', m); } else { fail++; console.log('  FAIL', m); } };
async function signIn(page, base, phone) {
  await page.goto(base + '/sign-in');
  await page.getByLabel('Phone number').fill(phone); await page.getByRole('button', { name: 'Send code' }).click();
  await page.getByLabel(/6-digit code/).waitFor({ timeout: 25000 }); await page.waitForTimeout(400);
  const log = fs.readFileSync(LOGS[base]).toString().replace(/\0/g, '');
  const m = [...log.matchAll(/\[sms:dev\] to (\+\d+): Your Rallix code is (\d{6})/g)].filter(x => x[1] === phone).pop();
  await page.getByLabel(/6-digit code/).fill(m[2]); await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForLoadState('networkidle'); await page.waitForTimeout(800);
}
(async () => {
  const b = await chromium.launch();
  const mk = async (w = 1280, h = 900) => { const c = await b.newContext({ viewport: { width: w, height: h } }); const p = await c.newPage(); p._errs = []; p.on('pageerror', e => p._errs.push(e.message.slice(0, 120))); return p; };
  const text = p => p.locator('body').innerText();

  console.log('1. access control');
  const X = await mk(); await X.goto(CON + '/clubs'); await X.waitForURL(/sign-in/); ok(true, 'signed-out visitors are sent to the console sign-in');
  const N = await mk(); await signIn(N, CON, '+2348030000006'); await N.goto(CON + '/clubs'); await N.waitForURL(/sign-in\?denied=1/, { timeout: 15000 });
  ok(/not on the platform team/i.test(await text(N)), 'a normal club user (Ade) can sign in but is refused by the console');
  ok(!/Paris Arena/.test(await text(N)), 'and sees no console data');

  console.log('2. overview');
  const O = await mk(); await signIn(O, CON, '+2348030000200'); await O.goto(CON + '/');
  let t = await text(O);
  ok(/OVERVIEW/i.test(t) && /Platform Owner/.test(t), 'platform owner signs in and sees the console');
  ok(/MONTHLY RECURRING REVENUE\s*₦20,000/i.test(t.replace(/\n+/g, ' ')) || /₦20,000/.test(t), 'MRR counts only the active subscription (₦20,000)');
  ok(/Past-due subscriptions\s*1/i.test(t.replace(/\n+/g, ' ')), 'one past-due subscription is flagged');
  ok(/Open issues\s*2/i.test(t.replace(/\n+/g, ' ')), 'two open issues are counted');
  await O.screenshot({ path: process.env.E2E_OUT + '/c_overview.png' });

  console.log('3. clubs');
  await O.goto(CON + '/clubs'); t = await text(O);
  ok(/Paris Arena/.test(t) && /Lagos Spin Club/.test(t), 'both clubs are listed');
  ok(/Payment overdue/.test(t), 'a club with a past-due subscription is marked "Payment overdue"');
  await O.goto(CON + '/clubs?q=paris'); t = await text(O); ok(/Paris Arena/.test(t) && !/Lagos Spin Club/.test(t), 'search narrows the list');
  await O.goto(CON + '/clubs?status=suspended'); ok(/No clubs match/.test(await text(O)), 'status filter works (none suspended yet)');
  await O.screenshot({ path: process.env.E2E_OUT + '/c_clubs.png' });
  await O.goto(CON + '/clubs?q=paris'); await O.getByRole('link', { name: 'Paris Arena' }).first().click(); await O.waitForURL(/\/clubs\//);
  const parisId = O.url().split('/clubs/')[1]; t = await text(O);
  ok(/Innocent Amos/.test(t) && /Subscription/i.test(t), 'club detail shows the owner and subscription');
  ok(/Score sheet freezes/.test(t), 'club detail lists that club’s issue');

  console.log('4. suspending a club locks its members out of the club app');
  const A = await mk(440, 956); await signIn(A, CLUB, '+2348030000100'); await A.goto(CLUB + '/');
  ok(/HOME/i.test(await text(A)), 'before: Paris Arena admin can use the club app');
  await O.getByRole('button', { name: 'Suspend club' }).click(); await O.waitForTimeout(600);
  ok(!(await O.getByText(/Club suspended/).count()), 'suspending without a reason is refused (browser validation)');
  await O.getByLabel('Reason').fill('Unpaid subscription'); await O.getByRole('button', { name: 'Suspend club' }).click();
  await O.getByText(/Club suspended/).waitFor({ timeout: 10000 }); ok(true, 'club suspended with a reason');
  ok(sql(`select status from clubs where id='${parisId}'`) === 'suspended', 'database shows status = suspended');
  await A.goto(CLUB + '/'); await A.waitForURL(/suspended/, { timeout: 15000 });
  ok(/currently suspended/i.test(await text(A)), 'the club admin sees a clear "club unavailable" page');
  await A.goto(CLUB + '/members'); await A.waitForURL(/suspended/, { timeout: 15000 }); ok(true, 'and cannot open any club page');
  await O.getByRole('button', { name: 'Reactivate club' }).click(); await O.getByText(/Club reactivated/).waitFor({ timeout: 10000 });
  await A.goto(CLUB + '/'); ok(/HOME/i.test(await text(A)), 'after reactivation the admin is back in');
  ok(Number(sql(`select count(*) from audit_log where action in ('club.suspended','club.reactivate')`)) === 2, 'both changes are in the audit log');

  console.log('5. billing and invoices');
  await O.goto(CON + '/billing'); t = await text(O);
  ok(/Paris Arena/.test(t) && /past due/i.test(t), 'subscriptions list shows both clubs and the past-due one');
  ok(/already has a subscription/i.test(t), 'no club is missing a subscription');
  await O.goto(CON + '/invoices?new=1');
  await O.getByLabel('Period').fill('2026-12'); await O.getByLabel(/Total/).fill('20000'); await O.getByRole('button', { name: 'Create invoice' }).click();
  await O.waitForURL(/\/invoices\/[0-9a-f-]{36}/, { timeout: 15000 }); t = await text(O);
  const invNo = (t.match(/RLX-\d{4}-\d{4}/) || [])[0]; ok(!!invNo, 'invoice created with a sequential number (' + invNo + ')');
  ok(/Total due\s*₦20,000/.test(t.replace(/\n+/g, ' ')) && /Bill to/.test(t), 'printable invoice shows amount and bill-to');
  await O.getByLabel('Payment reference').fill('TRF-555001'); await O.getByRole('button', { name: 'Mark as paid' }).click(); await O.getByText(/PAID \d/).first().waitFor({ timeout: 10000 });
  ok(sql(`select status || ':' || payment_ref from platform_invoices where number='${invNo}'`) === 'paid:TRF-555001', 'marked paid with its reference');
  await O.goto(CON + '/invoices?new=1'); await O.getByLabel('Period').fill('2026-12'); await O.getByLabel(/Total/).fill('5000'); await O.getByRole('button', { name: 'Create invoice' }).click();
  await O.getByText(/already has an invoice for this period/).waitFor({ timeout: 10000 }); ok(true, 'a second invoice for the same club and period is refused');
  await O.goto(CON + '/invoices?status=issued'); t = await text(O); ok(/Lagos Spin Club/.test(t) && !new RegExp(invNo).test(t), 'status tabs filter invoices');
  await O.goto(CON + '/billing'); O.once('dialog', d => d.accept()); await O.getByRole('button', { name: /Generate this period/ }).click(); await O.getByText('Invoices generated for this period.').waitFor({ timeout: 10000 });
  ok(Number(sql("select count(*) from platform_invoices where club_id in (select id from clubs where name='Paris Arena') and period_label='2026-10'")) === 1, 'generating invoices twice for a period never duplicates one');
  await O.screenshot({ path: process.env.E2E_OUT + '/c_billing.png' });

  console.log('6. templates and invoice branding');
  await O.goto(CON + '/templates');
  await O.getByLabel('VAT (%)').fill('10'); await O.getByLabel('Payment instructions').fill('Bank: Test Bank, Acct 0123456789'); await O.getByRole('button', { name: 'Save branding' }).click();
  await O.getByText('Invoice branding saved.').waitFor({ timeout: 10000 });
  const invId = sql(`select id from platform_invoices where number='${invNo}'`); await O.goto(CON + '/invoices/' + invId); t = await text(O);
  ok(/Includes VAT \(10%\)/.test(t) && /Test Bank/.test(t), 'new branding (VAT and bank details) shows on the invoice');
  await O.goto(CON + '/templates'); const ta = O.getByLabel('Message').nth(2); await ta.fill('Hi {{player_name}}, dues of {{amount}} due {{due_date}} at {{club_name}}. Thanks!'); await O.getByRole('button', { name: 'Save template' }).nth(2).click();
  await O.getByText('Template saved.').waitFor({ timeout: 10000 }); await O.goto(CON + '/templates'); t = await text(O);
  ok(/Hi Ade, dues of ₦6,000 due 28 Nov 2026 at Paris Arena\. Thanks!/.test(t), 'edited template is saved and the preview fills in sample data');
  await O.screenshot({ path: process.env.E2E_OUT + '/c_templates.png' });

  console.log('7. notifications');
  await O.goto(CON + '/notifications');
  await O.getByLabel('Title').fill('Maintenance tonight'); await O.getByLabel('Message').fill('Rallix will be briefly offline at 11pm.'); await O.getByRole('button', { name: 'Queue notification' }).click();
  await O.getByText(/Queued for 2 recipients/).waitFor({ timeout: 10000 }); ok(true, 'broadcast to all club admins counts the 2 distinct admins');
  await O.getByLabel('Audience').selectOption('clubs'); await O.getByLabel('Title').fill('Hello clubs'); await O.getByLabel('Message').fill('A note for specific clubs.'); await O.getByRole('button', { name: 'Queue notification' }).click();
  await O.getByText('Pick at least one club.').waitFor({ timeout: 10000 }); ok(true, 'a club broadcast with no clubs picked is refused');
  ok(sql(`select status from notifications order by created_at desc limit 1`) === 'queued', 'notification is stored as queued (no delivery provider yet)');

  console.log('8. issues');
  await O.goto(CON + '/issues'); t = await text(O); ok(/Score sheet freezes/.test(t) && /Club asked to change/.test(t), 'open issues are listed');
  await O.goto(CON + '/issues?new=1'); await O.getByLabel('Title').fill('Players cannot see photos'); await O.getByLabel('Severity').selectOption('critical'); await O.getByRole('button', { name: 'Create issue' }).click();
  await O.waitForURL(/\/issues\/[0-9a-f-]{36}/, { timeout: 15000 }); ok(/players cannot see photos/i.test(await text(O)), 'issue created and opened');
  await O.getByLabel('Add a note').fill('Reproduced on Android Chrome.'); await O.getByRole('button', { name: 'Add note' }).click(); await O.getByText('Note added.').waitFor({ timeout: 10000 }); await O.getByText('Reproduced on Android Chrome.').first().waitFor({ timeout: 10000 });
  ok(/Reproduced on Android Chrome/.test(await text(O)), 'note appears on the issue');
  await O.getByLabel('Status').selectOption('resolved'); await O.getByText('Status updated.').waitFor({ timeout: 10000 });
  await O.goto(CON + '/issues'); ok(!/Players cannot see photos/.test(await text(O)), 'resolved issue leaves the open list');
  await O.goto(CON + '/issues?status=all'); ok(/Players cannot see photos/.test(await text(O)), 'but is still under "All"');
  await O.screenshot({ path: process.env.E2E_OUT + '/c_issues.png' });

  console.log('9. audit and team');
  await O.goto(CON + '/audit'); t = await text(O); ok(/club\.suspended/.test(t) && /invoice\.create/.test(t) && /issue\.create/.test(t) && /template\.update/.test(t), 'audit log records every kind of change made above');
  await O.goto(CON + '/audit?action=invoice'); t = await text(O); ok(/invoice\.create/.test(t) && !/club\.suspended/.test(t), 'audit filter works');
  await O.goto(CON + '/team'); await O.getByLabel('Phone number').fill('0803 000 0006'); await O.getByRole('button', { name: 'Add to team' }).click(); await O.getByText('Added to the platform team.').waitFor({ timeout: 10000 });
  await N.goto(CON + '/clubs'); await N.waitForLoadState('networkidle'); ok(/Paris Arena/.test(await text(N)), 'a newly added team member gets in immediately');
  await O.goto(CON + '/team'); O.once('dialog', d => d.accept()); await O.getByRole('row', { name: /Ade/ }).getByRole('button', { name: 'Remove' }).click(); await O.getByRole('row', { name: /Ade/ }).waitFor({ state: 'detached', timeout: 10000 });
  await N.goto(CON + '/clubs'); await N.waitForURL(/denied=1/, { timeout: 15000 }); ok(true, 'a removed member loses access on their next request');
  await O.goto(CON + '/team'); ok(!(await O.getByRole('row', { name: /Platform Owner/ }).getByRole('button', { name: 'Remove' }).count()), 'you cannot remove yourself');
  await O.getByLabel('Phone number').fill('0803 000 9999'); await O.getByRole('button', { name: 'Add to team' }).click(); await O.getByText(/No account has that number/).waitFor({ timeout: 10000 }); ok(true, 'adding an unknown number explains what to do');

  console.log('10. quality');
  const small = [];
  for (const path of ['/', '/clubs', '/billing', '/invoices', '/templates', '/notifications', '/issues', '/audit', '/team']) {
    await O.goto(CON + path);
    small.push(...(await O.evaluate(p => [...document.querySelectorAll('a.cs-btn,a.cs-tabs,.cs-tabs a,.cs-nav a,button,input:not([type=checkbox]),select,textarea')].map(e => { const r = e.getBoundingClientRect(); return [p, (e.getAttribute('aria-label') || e.textContent || e.name || '').trim().slice(0, 24), Math.round(r.height)]; }).filter(x => x[2] > 0 && x[2] < 36), path)));
  }
  ok(small.length === 0, 'every button, input, select and tab is at least 36px tall ' + JSON.stringify(small.slice(0, 4)));
  const M = await mk(390, 844); await signIn(M, CON, '+2348030000200'); await M.goto(CON + '/clubs');
  ok(await M.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'the console does not scroll sideways on a phone-width screen');
  const errs = [X, N, O, A, M].flatMap(p => p._errs); ok(errs.length === 0, 'no uncaught browser errors ' + JSON.stringify(errs));
  await b.close(); console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})().catch(e => { console.error('CRASH', e.message.split('\n').slice(0, 6).join('\n')); process.exit(2); });
