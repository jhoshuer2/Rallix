/**
 * Dues reminders end-to-end. Needs a freshly seeded DB and BOTH apps running (club :3000, console :3001),
 * the club app with MAIL_FAIL_ADDRESSES=fail@example.com and CRON_SECRET=dev-cron-secret-shared-0001.
 *   CLUB_LOG=/tmp/club.log CONSOLE_LOG=/tmp/console.log node apps/club/e2e/reminders.cjs
 */
const { chromium } = require('playwright');
const fs = require('fs'); const { execSync } = require('child_process');
const CLUB = 'http://localhost:3000', CON = 'http://localhost:3001';
const LOGS = { [CLUB]: process.env.CLUB_LOG, [CON]: process.env.CONSOLE_LOG };
if (!LOGS[CLUB] || !LOGS[CON]) { console.error('Set CLUB_LOG and CONSOLE_LOG'); process.exit(2); }
const SECRET = 'dev-cron-secret-shared-0001';
const sql = q => execSync(`PGPASSWORD=service_dev psql -h localhost -U rallix_service -d rallix_dev -Atc "${q.replace(/"/g, '\\"')}"`).toString().trim();
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ok  ', m); } else { fail++; console.log('  FAIL', m); } };
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const readLog = base => fs.readFileSync(LOGS[base]).toString().replace(/\0/g, '');
const mailsTo = (base, email) => [...readLog(base).matchAll(new RegExp('\\[mail:dev\\] to ' + esc(email) + ' \\| ([^\\n]*)\\n((?:    [^\\n]*\\n?)*)', 'g'))].map(m => ({ subject: m[1], body: m[2] }));
const reminders = (email) => mailsTo(CLUB, email).filter(m => /Reminder: your/.test(m.subject));
const codeFor = (base, email) => mailsTo(base, email).map(m => (m.body.match(/sign-in code is (\d{6})/) || [])[1]).filter(Boolean).at(-1);
async function signIn(page, base, email) {
  await page.goto(base + '/sign-in'); await page.getByLabel(/Email address|Work email/).fill(email); await page.getByRole('button', { name: 'Email me a code' }).click();
  await page.getByLabel('6-digit code').waitFor({ timeout: 25000 }); await sleep(600);
  await page.getByLabel('6-digit code').fill(codeFor(base, email)); await page.getByRole('button', { name: 'Sign in' }).click(); await page.waitForLoadState('networkidle'); await sleep(700);
}
const job = async (today, extra = '') => { const r = await fetch(`${CLUB}/api/jobs/dues-reminders?today=${today}${extra}`, { method: 'POST', headers: { Authorization: `Bearer ${SECRET}` } }); return { status: r.status, ...(await r.json()) }; };
const PARIS = () => sql(`select id from clubs where slug='paris-arena'`);
const userId = email => sql(`select id from users where email='${email}'`);

(async () => {
  const b = await chromium.launch();
  const mk = async (w = 440, h = 956) => { const c = await b.newContext({ viewport: { width: w, height: h } }); const p = await c.newPage(); p._errs = []; p.on('pageerror', e => p._errs.push(e.message.slice(0, 120))); return p; };
  const text = p => p.locator('body').innerText();

  console.log('1. the job is protected, and reminders are OFF by default');
  let r = await fetch(`${CLUB}/api/jobs/dues-reminders`, { method: 'POST' }); ok(r.status === 401, 'no secret: 401');
  r = await fetch(`${CLUB}/api/jobs/dues-reminders`, { method: 'POST', headers: { Authorization: 'Bearer wrong-secret-wrong-secret' } }); ok(r.status === 401, 'wrong secret: 401');
  r = await fetch(`${CLUB}/api/jobs/dues-reminders`, { method: 'POST', headers: { Authorization: SECRET } }); ok(r.status === 401, 'secret without "Bearer ": 401');
  r = await fetch(`${CLUB}/api/jobs/dues-reminders?club=not-a-uuid`, { headers: { Authorization: `Bearer ${SECRET}` } }); ok(r.status === 400, 'a malformed club id: 400');
  let j = await job('2026-11-25'); ok(j.status === 200 && j.ok && j.sent === 0 && j.clubs.length === 0, 'with no club having turned reminders on, nothing is sent and no club is even touched');
  ok(Number(sql(`select count(*) from reminder_settings`)) === 0, 'no club has any reminder settings until its admin creates them');

  console.log('2. a club admin turns them on');
  const A = await mk(); await signIn(A, CLUB, 'admin@example.com'); await A.goto(CLUB + '/membership/reminders'); await A.waitForLoadState('networkidle');
  ok(/4 members currently have unpaid dues/.test(await text(A)), 'the page says how many members have unpaid dues');
  ok(await A.getByRole('switch', { name: 'Send dues reminders automatically' }).getAttribute('aria-checked') === 'false', 'the switch starts off');
  ok(await A.getByRole('button', { name: /Send today.s reminders now/ }).isDisabled(), '"send now" is disabled until reminders are saved as on');
  await A.getByRole('switch', { name: 'Send dues reminders automatically' }).click(); await A.waitForTimeout(0);
  for (const lbl of ['3 days before', 'On the due date', '3 days after', '7 days after']) if (!(await A.getByRole('checkbox', { name: lbl }).isChecked())) await A.getByRole('checkbox', { name: lbl }).check();
  await A.getByRole('button', { name: 'Save changes' }).click(); await A.getByText('Saved.').waitFor({ timeout: 10000 });
  ok(sql(`select enabled || ':' || offsets::text from reminder_settings`) === 'true:{-3,0,3,7}', 'saved: on, with days -3, 0, 3 and 7');
  ok(Number(sql(`select count(*) from audit_log where action='club.reminders_on'`)) === 1, 'turning them on is audited');
  for (const lbl of ['3 days before', 'On the due date', '3 days after', '7 days after']) await A.getByRole('checkbox', { name: lbl }).uncheck(); ok(await A.getByText('Choose at least one day.').count() === 1 && await A.getByRole('button', { name: /Save changes|Saved/ }).isDisabled(), 'with no day selected the admin cannot save');
  await A.reload(); await A.waitForLoadState('networkidle');

  console.log('3. the test email');
  await A.getByRole('button', { name: 'Email me a test reminder' }).click(); await A.getByText(/Test sent to your email/).waitFor({ timeout: 15000 });
  const t = mailsTo(CLUB, 'admin@example.com').filter(m => /^\[Test\] Reminder/.test(m.subject));
  ok(t.length === 1 && /Paris Arena dues are due in 3 days/.test(t[0].subject), 'the admin gets a clearly labelled test with real wording');
  ok(/₦6,000/.test(t[0].body) && /\/play\/me\/payments/.test(t[0].body) && /Unsubscribe: http/.test(t[0].body) && /\[List-Unsubscribe: http/.test(t[0].body), 'it shows the amount, the pay page and both unsubscribe routes, exactly as members will see them');
  for (let i = 0; i < 5; i++) { await A.getByRole('button', { name: 'Email me a test reminder' }).click(); await sleep(900); }
  ok(/several test emails already/i.test(await text(A)), 'test emails are rate limited');

  console.log('4. the schedule: who gets what, and when');
  j = await job('2026-11-25'); ok(j.sent === 4 && j.failed === 0, '3 days before: 4 reminders sent');
  const sule = reminders('sule@example.com');
  ok(sule.length === 1 && sule[0].subject === 'Reminder: your Paris Arena dues are due in 3 days', 'the subject names the club and timing');
  ok(/Hi Sule,/.test(sule[0].body) && /₦6,000/.test(sule[0].body) && /28 Nov 2026/.test(sule[0].body) && /If you have already paid/.test(sule[0].body), 'the body has the first name, amount, due date and a "already paid" line');
  ok(/because you are a member of Paris Arena/.test(sule[0].body), 'the footer says why they are getting it');
  const unsubPage = sule[0].body.match(/Unsubscribe: (http\S+)/)[1], unsubApi = sule[0].body.match(/\[List-Unsubscribe: (http\S+)\]/)[1];
  ok(/\/unsubscribe\//.test(unsubPage) && /\/api\/unsubscribe\//.test(unsubApi) && unsubPage.split('/').pop() === unsubApi.split('/').pop(), 'a personal unsubscribe page link and one-click header URL, from the same signed token');
  for (const who of ['jide', 'pastor', 'dorathy']) ok(reminders(`${who}@example.com`).length === 0, `${who} has paid: no reminder`);
  for (const who of ['nurudeen', 'nathaniel', 'ade']) ok(reminders(`${who}@example.com`).length === 1, `${who} has unpaid dues: one reminder`);
  ok(mailsTo(CLUB, 'admin@example.com').filter(m => /Reminder: your/.test(m.subject) && !/Test/.test(m.subject)).length === 0, 'the admin (not a member with dues) is not reminded');
  j = await job('2026-11-25'); ok(j.sent === 0, 'running the job again the same day sends nothing');
  j = await job('2026-11-26'); ok(j.sent === 0, 'a day later it still does not repeat the "3 days before" reminder');
  ok(Number(sql(`select count(*) from reminder_log where status='sent'`)) === 4 && Number(sql(`select count(*) from (select due_id, offset_days from reminder_log group by 1,2 having count(*)>1) x`)) === 0, 'exactly 4 log rows, one per due and day');
  sql(`update dues set status='paid' where membership_id in (select m.id from memberships m join users u on u.id=m.user_id where u.email='sule@example.com')`);
  j = await job('2026-11-28'); ok(j.sent === 3, 'on the due date: Sule has since paid, so only the other 3 are reminded');
  ok(reminders('sule@example.com').length === 1 && reminders('nurudeen@example.com').length === 2 && /are due today/.test(reminders('nurudeen@example.com')[1].subject), 'Sule gets nothing more; the others get "are due today"');
  const hits = await Promise.all([job('2026-12-01'), job('2026-12-01'), job('2026-12-01')]);
  ok(hits.reduce((n, h) => n + h.sent, 0) === 3, 'three overlapping runs of the same day send each reminder exactly once (3 in total)');
  ok(/were due 3 days ago/.test(reminders('ade@example.com').at(-1).subject), 'after the date the wording becomes "were due 3 days ago"');
  await A.goto(CLUB + '/membership/payments'); ok(/reminded 3×/.test(await text(A)), 'the dues list shows how many times each member was reminded');

  console.log('5. players can unsubscribe');
  const U = await mk(); await U.goto(unsubPage.replace(/^https?:\/\/[^/]+/, CLUB)); // Sule's link
  ok(/s•+@example\.com/.test(await text(U)) && !/Sule/.test(await text(U)) && !/Paris/.test(await text(U)), 'the page shows only a masked address, no name or club');
  ok(sql(`select email_opt_out from users where email='sule@example.com'`) === 'f', 'merely opening the link unsubscribes nobody (so email scanners cannot do it)');
  await U.getByRole('button', { name: 'Unsubscribe' }).click(); await U.getByText(/You are unsubscribed/).waitFor({ timeout: 10000 });
  ok(sql(`select email_opt_out from users where email='sule@example.com'`) === 't', 'pressing the button unsubscribes');
  await U.getByRole('button', { name: 'Turn emails back on' }).click(); await U.getByText(/currently receive/).waitFor({ timeout: 10000 }); ok(sql(`select email_opt_out from users where email='sule@example.com'`) === 'f', 'and the same page turns them back on');
  const nathApi = reminders('nathaniel@example.com')[0].body.match(/\[List-Unsubscribe: (http\S+)\]/)[1].replace(/^https?:\/\/[^/]+/, CLUB);
  let g = await fetch(nathApi, { redirect: 'manual' }); ok(g.status === 303 && sql(`select email_opt_out from users where email='nathaniel@example.com'`) === 'f', 'a GET of the one-click URL redirects to the page and changes nothing');
  let p = await fetch(nathApi, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'List-Unsubscribe=One-Click' }); ok(p.status === 200 && sql(`select email_opt_out from users where email='nathaniel@example.com'`) === 't', 'a POST (what Gmail and Outlook send) unsubscribes immediately');
  p = await fetch(nathApi.slice(0, -3) + 'abc', { method: 'POST' }); ok(p.status === 400, 'a tampered token is refused');
  const tokNath = nathApi.split('/').pop(); const forged = Buffer.from(userId('ade@example.com')).toString('base64url') + '.' + tokNath.split('.')[1];
  p = await fetch(`${CLUB}/api/unsubscribe/${forged}`, { method: 'POST' }); ok(p.status === 400 && sql(`select email_opt_out from users where email='ade@example.com'`) === 'f', 'a token cannot be re-used for a different person');
  await U.goto(`${CLUB}/unsubscribe/${forged}`); await U.waitForLoadState('networkidle'); ok(/Link not valid/i.test(await text(U)), 'the page also rejects a forged token');
  j = await job('2026-12-05'); ok(j.sent === 2 && reminders('nathaniel@example.com').length === 3 && !reminders('nathaniel@example.com').some(m => /7 days ago/.test(m.subject)) && reminders('ade@example.com').some(m => /7 days ago/.test(m.subject)), 'Nathaniel (opted out) gets no more after unsubscribing; the other two still get the 7-day reminder');
  const O1 = await mk(); await signIn(O1, CLUB, 'nurudeen@example.com'); await O1.goto(CLUB + '/play/me'); await O1.waitForLoadState('networkidle');
  await O1.getByRole('switch', { name: 'Email me dues reminders and club announcements' }).click(); await sleep(1200);
  ok(sql(`select email_opt_out from users where email='nurudeen@example.com'`) === 't', 'the switch on the Me page turns reminders off for a signed-in player');
  await O1.goto(CLUB + '/play/me/payments'); ok(/turned off reminder emails/.test(await text(O1)), 'and the payments page reminds them they will not be emailed');
  ok(mailsTo(CLUB, 'nurudeen@example.com').filter(m => /sign-in code/.test(m.subject)).length >= 1, 'sign-in codes still reach people who opted out');
  await O1.goto(CLUB + '/play/me'); await O1.getByRole('switch', { name: 'Email me dues reminders and club announcements' }).click(); await sleep(1200);
  ok(sql(`select email_opt_out from users where email='nurudeen@example.com'`) === 'f', 'turning it back on works');

  console.log('6. who is never emailed');
  const paris = PARIS();
  const mkDue = (email, due, label) => sql(`insert into dues (club_id, membership_id, plan_id, amount_kobo, period_label, due_date, status) select '${paris}', m.id, (select id from plans where club_id='${paris}' limit 1), 600000, '${label}', '${due}', 'due' from memberships m join users u on u.id=m.user_id where m.club_id='${paris}' and u.email='${email}'`);
  sql(`insert into users (id, name, email) values ('u_left','Lefty Gone','lefty@example.com'),('failer','Fail Er','fail@example.com')`);
  sql(`insert into memberships (club_id, user_id, roles, status) values ('${paris}','u_left',ARRAY['player']::member_role[],'left'),('${paris}','failer',ARRAY['player']::member_role[],'active')`);
  mkDue('lefty@example.com', '2026-12-20', 'x1'); mkDue('fail@example.com', '2026-12-20', 'x2'); mkDue('ade@example.com', '2026-12-20', 'x3'); mkDue('jide@example.com', '2026-12-20', 'x4');
  sql(`update dues set status='paid' where period_label='x4'`);
  await A.goto(CLUB + '/membership/reminders'); await A.waitForLoadState('networkidle'); await A.getByRole('switch', { name: 'Send dues reminders automatically' }).click(); await A.getByRole('button', { name: 'Save changes' }).click(); await A.getByText('Saved.').waitFor({ timeout: 10000 });
  ok(Number(sql(`select count(*) from audit_log where action='club.reminders_off'`)) === 1, 'turning reminders off is audited');
  j = await job('2026-12-17'); ok(j.sent === 0, 'a club that switched reminders off sends nothing, even with reminders due');
  await A.getByRole('switch', { name: 'Send dues reminders automatically' }).click(); await A.getByRole('button', { name: 'Save changes' }).click(); await A.getByText('Saved.').waitFor({ timeout: 10000 });
  sql(`update clubs set status='suspended', suspension_reason='other' where id='${paris}'`); j = await job('2026-12-17'); ok(j.sent === 0, 'a suspended club is skipped entirely');
  sql(`update clubs set status='active', suspension_reason=null where id='${paris}'`);
  j = await job('2026-12-17');
  ok(reminders('lefty@example.com').length === 0, 'a member who has left is never emailed');
  ok(reminders('jide@example.com').length === 0, 'a member whose due is paid is not emailed');
  ok(reminders('ade@example.com').filter(m => /Dec 2026|20 Dec/.test(m.body)).length === 1, 'a valid unpaid member still is');
  ok(j.failed === 1 && j.sent >= 1, 'one address that bounces fails, while the others in the same run are still sent');

  console.log('7. failures are retried a limited number of times');
  const failRow = () => sql(`select status || ':' || attempts from reminder_log where email='fail@example.com' and offset_days=-3`);
  ok(failRow() === 'failed:1', 'first attempt recorded as failed');
  await job('2026-12-17'); ok(failRow() === 'failed:2', 'the next run retries it (attempt 2)');
  await job('2026-12-17'); ok(failRow() === 'failed:3', 'and once more (attempt 3)');
  await job('2026-12-17'); await job('2026-12-18'); ok(failRow() === 'failed:3', 'then it gives up: no fourth attempt');
  ok(mailsTo(CLUB, 'ade@example.com').filter(m => /Reminder/.test(m.subject) && /20 Dec/.test(m.body)).length === 1, 'the retries never re-sent anyone else');
  ok(/Simulated delivery failure/.test(sql(`select error from reminder_log where email='fail@example.com'`)), 'the reason is recorded');
  await A.goto(CLUB + '/membership/reminders'); await A.waitForLoadState('networkidle'); ok(/failed/i.test(await text(A)) && /fail er/i.test(await text(A)), 'the admin can see the failure in "Recently sent"');

  console.log('8. a broken template stops everything before sending');
  sql(`update templates set body = body || ' {{bogus}}' where key='dues_reminder'`);
  sql(`update dues set due_date='2026-12-30' where period_label='x3'`); const before = Number(sql(`select count(*) from reminder_log`));
  j = await job('2027-01-02'); ok(j.status === 500 && j.ok === false && /unknown placeholders.*bogus/i.test(j.error), 'the job refuses with a clear message');
  ok(Number(sql(`select count(*) from reminder_log`)) === before, 'and creates no log rows and sends nothing');
  sql(`update templates set body = replace(body, ' {{bogus}}', '') where key='dues_reminder'`);
  const CC = await mk(1280, 900);

  console.log('9. admin "send now"');
  await A.goto(CLUB + '/membership/reminders'); await A.waitForLoadState('networkidle'); await A.getByRole('button', { name: /Send today.s reminders now/ }).click(); await A.getByText(/^Done: \d+ sent/).waitFor({ timeout: 20000 }); ok(true, 'the admin can run the schedule on demand and sees the result');

  console.log('10. console: stats, run-now, and respect for opt-outs in broadcasts');
  await signIn(CC, CON, 'owner@rallix.app'); await CC.goto(CON + '/payments'); await CC.waitForLoadState('networkidle'); let ct = await text(CC);
  ok(/dues reminders/i.test(ct) && /Clubs with reminders on\s*1 of 2/i.test(ct.replace(/\n+/g, ' ')), 'the console shows reminder stats and that 1 of 2 clubs has them on');
  const logsBefore = Number(sql(`select count(*) from audit_log where action='reminders.run_manual'`));
  await CC.getByRole('button', { name: 'Run the reminder job now' }).click(); await CC.getByText('Reminder job ran.').waitFor({ timeout: 30000 });
  ok(Number(sql(`select count(*) from audit_log where action='reminders.run_manual'`)) === logsBefore + 1, 'staff can run the job from the console, and it is audited');
  sql(`update users set email_opt_out = true where email = 'ade@example.com'`);
  const optedOut = Number(sql(`select count(*) from users where email_opt_out`)); ok(optedOut === 2, `two people are opted out (Nathaniel and Ade, who is also a club admin)`);
  await CC.goto(CON + '/notifications'); await CC.getByLabel('Title').fill('League night'); await CC.getByLabel('Message').fill('League night is on Friday.'); await CC.getByLabel('Channel').selectOption('email'); await CC.getByLabel('Audience').selectOption('all_players'); await CC.getByRole('button', { name: 'Queue notification' }).click();
  await CC.getByText(/Email sent to \d+ of \d+/).waitFor({ timeout: 60000 });
  const nid = sql(`select id from notifications order by created_at desc limit 1`);
  ok(Number(sql(`select count(*) from notification_deliveries d join users u on u.id=d.user_id where d.notification_id='${nid}' and u.email_opt_out`)) === 0, 'an announcement to players skips everyone who opted out');
  ok(sql(`select recipient_count from notifications where id='${nid}'`) === sql(`select count(*) from notification_deliveries where notification_id='${nid}'`), 'and the recipient count staff see matches who was actually emailed');
  const ann = mailsTo(CON, 'jide@example.com').filter(m => /League night/.test(m.subject));
  ok(ann.length === 1 && /Unsubscribe: http/.test(ann[0].body) && /\[List-Unsubscribe: http/.test(ann[0].body), 'players get the announcement with both unsubscribe routes');
  ok(mailsTo(CON, 'nathaniel@example.com').filter(m => /League night/.test(m.subject)).length === 0 && mailsTo(CON, 'ade@example.com').filter(m => /League night/.test(m.subject)).length === 0, 'Nathaniel and Ade (opted out) did not get it');
  await CC.getByLabel('Title').fill('Platform maintenance'); await CC.getByLabel('Message').fill('Rallix will be briefly offline tonight.'); await CC.getByLabel('Channel').selectOption('email'); await CC.getByLabel('Audience').selectOption('all_admins'); await CC.getByRole('button', { name: 'Queue notification' }).click();
  for (let i = 0; i < 60 && !mailsTo(CON, 'ade@example.com').some(m => /Platform maintenance/.test(m.subject)); i++) await sleep(500);
  const adm = mailsTo(CON, 'ade@example.com').filter(m => /Platform maintenance/.test(m.subject)); ok(adm.length === 1, 'platform notices to club admins still reach an admin who opted out of optional mail');
  ok(!/Unsubscribe: http/.test(adm[0].body), 'and carry no unsubscribe link (they are operational, not optional)');

  const errs = [A, U, O1, CC].flatMap(p => p._errs); ok(errs.length === 0, 'no uncaught browser errors ' + JSON.stringify(errs));
  await b.close(); console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})().catch(e => { console.error('CRASH', e.message.split('\n').slice(0, 6).join('\n')); process.exit(2); });
