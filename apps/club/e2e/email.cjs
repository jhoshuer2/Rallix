/**
 * Email end-to-end: sign-in codes, console access, invoice emails, broadcasts, optional phone.
 * Needs a freshly seeded DB and BOTH apps running (club :3000, console :3001). The console must run with MAIL_FAIL_ADDRESSES=fail@example.com.
 *   CLUB_LOG=/tmp/club.log CONSOLE_LOG=/tmp/console.log node apps/club/e2e/email.cjs
 */
const { chromium } = require('playwright');
const fs = require('fs'); const { execSync } = require('child_process');
const CLUB = 'http://localhost:3000', CON = 'http://localhost:3001';
const LOGS = { [CLUB]: process.env.CLUB_LOG, [CON]: process.env.CONSOLE_LOG };
if (!LOGS[CLUB] || !LOGS[CON]) { console.error('Set CLUB_LOG and CONSOLE_LOG'); process.exit(2); }
const sql = q => execSync(`PGPASSWORD=service_dev psql -h localhost -U rallix_service -d ${process.env.PGDB||'rallix_dev'} -Atc "${q.replace(/"/g, '\\"')}"`).toString().trim();
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ok  ', m); } else { fail++; console.log('  FAIL', m); } };
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const readLog = base => fs.readFileSync(LOGS[base]).toString().replace(/\0/g, '');
const mailsTo = (base, email) => [...readLog(base).matchAll(new RegExp('\\[mail:dev\\] to ' + esc(email) + ' \\| ([^\\n]*)\\n((?:    [^\\n]*\\n?)*)', 'g'))].map(m => ({ subject: m[1], body: m[2] }));
const codeFor = (base, email) => { const all = mailsTo(base, email).map(m => (m.body.match(/sign-in code is (\d{6})/) || [])[1]).filter(Boolean); return all.at(-1) || null; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function requestCode(page, base, email) {
  await page.goto(base + '/sign-in'); await page.getByLabel(/Email address|Work email/).fill(email); await page.getByRole('button', { name: 'Email me a code' }).click();
  await page.getByLabel('6-digit code').waitFor({ timeout: 25000 }); await sleep(600);
}
async function signIn(page, base, email) {
  await requestCode(page, base, email); await page.getByLabel('6-digit code').fill(codeFor(base, email)); await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL(u => !/\/sign-in/.test(u.toString()), { timeout: 60000 }).catch(() => {});
  await page.waitForLoadState('networkidle'); await sleep(700);
}
(async () => {
  const b = await chromium.launch();
  const mk = async (w = 440, h = 956) => { const c = await b.newContext({ viewport: { width: w, height: h } }); const p = await c.newPage(); p._errs = []; p.on('pageerror', e => p._errs.push(e.message.slice(0, 120))); return p; };
  const text = async p => { await p.locator('.rx-skel').first().waitFor({ state: 'detached', timeout: 20000 }).catch(() => {}); return p.locator('body').innerText(); };

  console.log('1. sign-in codes (club app)');
  const P = await mk(); await P.goto(CLUB + '/sign-in');
  await P.getByLabel('Email address').fill('not an email'); await P.getByRole('button', { name: 'Email me a code' }).click();
  ok(/valid email/i.test(await text(P)), 'an invalid email is refused before anything is sent');
  await requestCode(P, CLUB, 'ADE@Example.com');
  ok(mailsTo(CLUB, 'ade@example.com').length === 1 && mailsTo(CLUB, 'ade@example.com')[0].subject === 'Your Rallix sign-in code', 'the code email goes to the lower-cased address with a clear subject');
  ok(!/sign-in code is/.test(mailsTo(CLUB, 'ade@example.com')[0].subject), 'the code is not in the subject line');
  ok(/expires in 5 minutes/i.test(mailsTo(CLUB, 'ade@example.com')[0].body) && /ignore this email/i.test(mailsTo(CLUB, 'ade@example.com')[0].body), 'the email says it expires and can be ignored');
  ok(await P.getByRole('button', { name: /Send a new code in \d+s/ }).isDisabled(), 'resend is on a cooldown');
  const good = codeFor(CLUB, 'ade@example.com'), wrong = good === '000000' ? '111111' : '000000';
  await P.getByLabel('6-digit code').fill(wrong); await P.getByRole('button', { name: 'Sign in' }).click(); await P.getByText(/didn.t work/i).waitFor({ timeout: 10000 }); ok(true, 'a wrong code is rejected with a clear message');
  for (let i = 0; i < 2; i++) { await P.getByLabel('6-digit code').fill(wrong); await P.getByRole('button', { name: 'Sign in' }).click(); await sleep(700); }
  await P.getByLabel('6-digit code').fill(good); await P.getByRole('button', { name: 'Sign in' }).click(); await sleep(1200);
  ok(/sign-in/.test(P.url()) && /didn.t work/i.test(await text(P)), 'after three wrong tries even the real code no longer works');
  ok(Number(sql(`select count(*) from sessions s join users u on u.id=s.user_id where u.email='ade@example.com'`)) === 0, 'and no session was created');
  sql(`delete from email_log`); await requestCode(P, CLUB, 'ade@example.com');
  const fresh = codeFor(CLUB, 'ade@example.com'); await P.getByLabel('6-digit code').fill(fresh); await P.getByRole('button', { name: 'Sign in' }).click(); await P.waitForURL(u => !/sign-in/.test(u.toString()), { timeout: 20000 }); ok(true, 'a freshly requested code signs in (email case does not matter)');
  ok(Number(sql(`select count(*) from users where lower(email)='ade@example.com'`)) === 1, 'still exactly one account for that email');
  ok(sql(`select status from email_log where kind='otp' order by created_at desc limit 1`) === 'sent' && !/\d{6}/.test(sql(`select coalesce(string_agg(coalesce(error,'') || coalesce(template_key,'') || coalesce(related_id,''), ' '),'') from email_log`)), 'the email log records the send but never the code');
  ok(!/\$argon|^\d{6}$/.test(sql(`select coalesce(string_agg(value, ','),'') from verifications`)), 'codes are not stored in plain text');

  console.log('2. a brand-new email creates an account');
  const N = await mk(); await signIn(N, CLUB, 'brandnew@example.com'); await N.waitForURL(/onboarding/, { timeout: 15000 }); ok(true, 'first sign-in creates the account and starts onboarding');
  ok(sql(`select count(*) from users where email='brandnew@example.com'`) === '1', 'the account exists with that email');
  ok(await N.getByLabel('What’s your name').inputValue() === '', 'the name field is empty (not "New player" or the email)');
  await N.getByLabel('What is your club called?').fill('Email Club'); await N.getByLabel('What’s your name').fill('Bola New'); await N.getByLabel('Where are you located').fill('Enugu');
  await N.getByLabel('Phone or WhatsApp (optional)').fill('12345'); await N.getByRole('button', { name: 'Create my club' }).click(); await N.getByText(/valid Nigerian phone/i).waitFor({ timeout: 10000 }); ok(true, 'a bad optional phone number is refused with a clear message');
  ok(sql(`select count(*) from clubs where name='Email Club'`) === '0', 'and the club was not created half-way');
  await N.getByLabel('Phone or WhatsApp (optional)').fill('0803 555 0101'); await N.getByRole('button', { name: 'Create my club' }).click(); await N.waitForURL(u => !/onboarding/.test(u.toString()), { timeout: 20000 });
  ok(sql(`select phone_number from users where email='brandnew@example.com'`) === '+2348035550101', 'the phone is saved in +234 format');

  console.log('3. phone is optional, editable, and unique');
  const M = await mk(); await signIn(M, CLUB, 'sule@example.com'); await M.goto(CLUB + '/play/me'); await M.waitForLoadState('networkidle');
  ok(/sule@example\.com/.test(await text(M)), 'the Me page shows the sign-in email');
  await M.getByLabel('Phone or WhatsApp (optional)').fill('0803 555 0101'); await M.getByRole('button', { name: 'Save contact details' }).click(); await M.getByText(/already used by another account/i).waitFor({ timeout: 10000 }); ok(true, 'a phone number already used by someone else is refused');
  await M.getByLabel('Phone or WhatsApp (optional)').fill('+234 802 555 0202'); await M.getByRole('button', { name: 'Save contact details' }).click(); await M.getByText('Saved.').waitFor({ timeout: 10000 });
  ok(sql(`select phone_number from users where email='sule@example.com'`) === '+2348025550202', 'a valid number is normalised and saved');
  await M.getByLabel('Phone or WhatsApp (optional)').fill(''); await M.getByRole('button', { name: 'Save contact details' }).click(); await M.getByText('Saved.').waitFor({ timeout: 10000 });
  ok(sql(`select coalesce(phone_number,'none') from users where email='sule@example.com'`) === 'none', 'clearing it removes the number');

  console.log('4. a code request cannot be used to flood someone’s inbox');
  const F = await mk(); await F.goto(CLUB + '/sign-in');
  const sendCode = () => F.evaluate(async () => (await fetch('/api/auth/email-otp/send-verification-otp', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'flood@example.com', type: 'sign-in' }) })).status);
  const statuses = []; for (let i = 0; i < 8; i++) { statuses.push(await sendCode()); await sleep(250); }
  await sleep(800); const delivered = mailsTo(CLUB, 'flood@example.com').length;
  ok(delivered === 5, `only 5 emails are sent to one address in 10 minutes (sent ${delivered} of 8 requests)`);
  ok(Number(sql(`select count(*) from email_log where to_email='flood@example.com' and error='rate_limited'`)) === 3, 'the extra requests are recorded as rate-limited');

  console.log('5. console sign-in never reveals or creates accounts');
  const U = await mk(1280, 900); await requestCode(U, CON, 'nobody-at-all@example.com');
  ok(/on its way/i.test(await text(U)), 'an unknown email sees the same "code is on its way" screen as a real one');
  ok(mailsTo(CON, 'nobody-at-all@example.com').length === 0, 'but no email is sent to it');
  ok(sql(`select count(*) from users where email='nobody-at-all@example.com'`) === '0', 'and no account is created');
  const C = await mk(1280, 900); await requestCode(C, CON, 'ade@example.com');
  ok(mailsTo(CON, 'ade@example.com').length === 1 && /Rallix Console/.test(mailsTo(CON, 'ade@example.com')[0].subject), 'a real non-staff user does get a code, labelled as the console');
  await C.getByLabel('6-digit code').fill(codeFor(CON, 'ade@example.com')); await C.getByRole('button', { name: 'Sign in' }).click(); await C.waitForURL(/denied=1/, { timeout: 20000 }); ok(/not on the platform team/i.test(await text(C)), 'but they are refused: signing in is not enough, they are not on the team');
  const O = await mk(1280, 900); await signIn(O, CON, 'owner@rallix.app'); await O.goto(CON + '/'); ok(/Platform Owner/.test(await text(O)), 'a platform admin signs in with an emailed code');

  console.log('6. invoice emails');
  const parisId = sql(`select id from clubs where slug='paris-arena'`), lagosId = sql(`select id from clubs where slug='lagos-spin'`);
  await O.goto(CON + '/invoices?new=1'); await O.locator('form select').first().selectOption(parisId); await O.getByLabel('Period').fill('2027-02'); await O.getByLabel(/Total/).fill('20000');
  ok(await O.getByLabel(/Email the club.s admins/).isChecked(), 'creating an invoice emails the club’s admins by default');
  await O.getByRole('button', { name: 'Create invoice' }).click(); await O.waitForURL(/\/invoices\/[0-9a-f-]{36}/, { timeout: 20000 });
  const invId = O.url().match(/invoices\/([0-9a-f-]{36})/)[1]; const invNo = sql(`select number from platform_invoices where id='${invId}'`), tok = sql(`select pay_token from platform_invoices where id='${invId}'`);
  ok(/emailed to 1 admin/i.test(await text(O)), 'the invoice page confirms it was emailed');
  const inv = mailsTo(CON, 'admin@example.com').filter(m => m.body.includes(invNo));
  ok(inv.length === 1, 'exactly one email went to Paris Arena’s admin');
  ok(inv[0] && inv[0].body.includes('₦20,000') && inv[0].body.includes(`/pay/invoice/${tok}`) && /Hello Innocent/.test(inv[0].body) && inv[0].subject.includes(invNo), 'it has the invoice number, ₦20,000, the personal greeting and the correct pay link');
  ok(inv[0] && /because you are an admin of Paris Arena/.test(inv[0].body), 'the footer says why they are receiving it');
  ok(sql(`select status || ':' || kind || ':' || template_key from email_log where related_id='${invId}'`) === 'sent:invoice:invoice_issued', 'the send is recorded in the log');
  const club = await mk(); await club.goto(CLUB + `/pay/invoice/${tok}`); ok(/₦20,000/.test(await text(club)), 'the emailed link opens the public payment page');
  let dialogs = 0; O.on('dialog', d => { dialogs++; d.dismiss(); });
  await O.getByRole('button', { name: 'Email invoice to club admins' }).click(); await sleep(1500);
  ok(dialogs === 1 && mailsTo(CON, 'admin@example.com').filter(m => m.body.includes(invNo)).length === 1, 'emailing again within 24 hours asks first, and declining sends nothing');
  O.removeAllListeners('dialog'); O.on('dialog', d => d.accept()); await O.getByRole('button', { name: 'Email invoice to club admins' }).click(); await O.getByText(/Emailed 1 of 1 admin/).waitFor({ timeout: 15000 });
  ok(mailsTo(CON, 'admin@example.com').filter(m => m.body.includes(invNo)).length === 2, 'confirming sends it again');
  await O.getByRole('button', { name: 'Send past-due reminder' }).click();
  for (let i = 0; i < 40 && !mailsTo(CON, 'admin@example.com').some(m => /past due/i.test(m.subject)); i++) await sleep(250);
  const rem = mailsTo(CON, 'admin@example.com').filter(m => /past due/i.test(m.subject) && m.body.includes(`/pay/invoice/${tok}`));
  ok(rem.length === 1, 'the past-due reminder uses its own template and includes the pay link');
  ok(Number(sql(`select count(*) from audit_log where action like 'invoice.email%'`)) >= 3, 'every email action is in the audit log');
  sql(`update templates set body = body || ' {{bogus}}' where key = 'invoice_issued'`);
  const before = mailsTo(CON, 'admin@example.com').length; await O.reload(); await O.getByRole('button', { name: 'Email invoice to club admins' }).click(); await O.getByText(/template can.t be filled in.*bogus/i).waitFor({ timeout: 15000 });
  ok(mailsTo(CON, 'admin@example.com').length === before, 'a broken template fails BEFORE any email goes out, with a clear message');
  sql(`update templates set body = replace(body, ' {{bogus}}', '') where key = 'invoice_issued'`);
  await O.goto(CON + '/templates'); const form = O.locator('form', { hasText: 'Invoice issued' }).first(); await form.getByLabel('Message').fill('Hello {{admin_name}} {{made_up}}'); await form.getByRole('button', { name: 'Save template' }).click();
  await O.getByText(/Unknown placeholder.*made_up/i).waitFor({ timeout: 10000 }); ok(true, 'saving a template with an unknown placeholder is refused, listing the allowed ones');
  await O.goto(CON + '/invoices/' + sql(`select id from platform_invoices where club_id='${lagosId}' and status='issued' limit 1`)); await O.getByRole('button', { name: 'Email invoice to club admins' }).click(); await O.getByText(/Emailed 1 of 1/).waitFor({ timeout: 15000 });
  ok(mailsTo(CON, 'ade@example.com').some(m => /Lagos Spin Club/.test(m.body)), 'a suspended-or-not club’s admins get their own club’s invoice (Lagos → Ade)');

  console.log('7. broadcasts: large, resumable, with a failing address');
  const paris = parisId;
  sql(`insert into users (id, name, email) select 'bulk_'||g, 'Bulk '||g, 'bulk'||g||'@example.com' from generate_series(1,130) g`);
  sql(`insert into memberships (club_id, user_id, roles) select '${paris}', 'bulk_'||g, ARRAY['player']::member_role[] from generate_series(1,130) g`);
  sql(`insert into users (id, name, email) values ('failer','Fail Er','fail@example.com')`); sql(`insert into memberships (club_id, user_id, roles) values ('${paris}','failer', ARRAY['player']::member_role[])`);
  const expected = Number(sql(`select count(distinct m.user_id) from memberships m join clubs c on c.id=m.club_id where m.status='active' and c.status='active'`));
  await O.goto(CON + '/notifications'); await O.getByLabel('Title').fill('League night moved'); await O.getByLabel('Message').fill('Hello <b>everyone</b>,\n\nThis week’s league night is on Friday.');
  await O.getByLabel('Channel').selectOption('email'); await O.getByLabel('Audience').selectOption('all_players'); await O.getByRole('button', { name: 'Queue notification' }).click();
  await O.getByText(new RegExp(`Email sent to \\d+ of ${expected}`)).waitFor({ timeout: 90000 });
  const nid = sql(`select id from notifications order by created_at desc limit 1`);
  ok(Number(sql(`select count(*) from notification_deliveries where notification_id='${nid}'`)) === expected, `one delivery row per person (${expected}), no duplicates`);
  ok(Number(sql(`select count(*) from notification_deliveries where notification_id='${nid}' and status='pending'`)) === expected - 100, 'only 100 are attempted per request, the rest wait');
  ok(sql(`select status from notifications where id='${nid}'`) === 'queued', 'the notification stays "queued" until everyone has been tried');
  await O.reload(); ok(/Sent 99 of/.test(await text(O)) || /Sent 100 of/.test(await text(O)), 'the page shows progress');
  const btn = O.getByRole('button', { name: /Continue sending/ }); ok(await btn.count() === 1, 'a "Continue sending" button is shown');
  const O2 = await mk(1280, 900); await signIn(O2, CON, 'owner@rallix.app'); await O2.goto(CON + '/notifications');
  await Promise.all([btn.click(), O2.getByRole('button', { name: /Continue sending/ }).click()]); await sleep(6000);
  ok(Number(sql(`select count(*) from notification_deliveries where notification_id='${nid}' and status='pending'`)) === 0, 'both clicks together finished the queue');
  const dupes = Number(sql(`select count(*) from (select to_email from email_log where kind='broadcast' and related_id='${nid}' group by to_email having count(*) > 1) x`));
  ok(dupes === 0, 'nobody was emailed twice even though two staff pressed Continue at the same moment');
  ok(Number(sql(`select count(*) from email_log where kind='broadcast' and related_id='${nid}'`)) === expected, 'the log has exactly one attempt per person');
  ok(sql(`select sent_count || '/' || failed_count || '/' || status from notifications where id='${nid}'`) === `${expected - 1}/1/sent`, 'one failure, everyone else sent, and the notification is marked done');
  await O.reload(); ok(/fail@example\.com: Simulated delivery failure/.test(await O.locator('body').innerText()) || (await O.getByText('Why some failed').count()) === 1, 'the failure and its reason are listed');
  ok(mailsTo(CON, 'bulk77@example.com').length === 1 && /Hello <b>everyone<\/b>/.test(mailsTo(CON, 'bulk77@example.com')[0].body), 'a recipient got the message (shown as plain text, never as markup)');
  ok(/because you are a member of a club on Rallix/.test(mailsTo(CON, 'bulk77@example.com')[0].body), 'with a footer explaining why they got it');
  await O.getByRole('button', { name: 'Retry failed' }).click(); await O.getByText(/put back in the queue/i).waitFor({ timeout: 10000 });
  await O.reload(); await O.getByRole('button', { name: /Continue sending/ }).click(); await sleep(2500);
  ok(sql(`select sent_count || '/' || failed_count from notifications where id='${nid}'`) === `${expected - 1}/1`, 'retrying a still-failing address leaves everyone else untouched');
  ok(Number(sql(`select count(*) from (select to_email from email_log where kind='broadcast' and related_id='${nid}' group by to_email having count(*) > 1) x`)) === 1, 'only the failing address was attempted again');
  await O.getByLabel('Channel').selectOption('sms'); await O.getByLabel('Title').fill('Texts'); await O.getByLabel('Message').fill('This one is a text.'); await O.getByRole('button', { name: 'Queue notification' }).click(); await O.getByText(/Queued for \d+ recipient/).waitFor({ timeout: 15000 });
  ok(sql(`select status from notifications where channel='sms' order by created_at desc limit 1`) === 'queued' && Number(sql(`select count(*) from notification_deliveries d join notifications n on n.id=d.notification_id where n.channel='sms'`)) === 0, 'channels without a provider stay queued and send nothing');

  const errs = [P, N, M, F, U, C, O, O2, club].flatMap(p => p._errs); ok(errs.length === 0, 'no uncaught browser errors ' + JSON.stringify(errs));
  await b.close(); console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})().catch(e => { console.error('CRASH', e.message.split('\n').slice(0, 6).join('\n')); process.exit(2); });
