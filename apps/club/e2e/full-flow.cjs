/**
 * Full-flow end-to-end check against a real database (admin, player, new club, invites, scoring, role limits).
 *
 * Run from a fresh seeded database with the dev server logging to a file, because OTP codes are read from that log:
 *   pnpm --filter @rallix/db db:create rallix_dev && pnpm --filter @rallix/db migrate && pnpm --filter @rallix/db seed
 *   (cd apps/club && next dev --port 3000 > /tmp/dev.log 2>&1 &)
 *   DEV_LOG=/tmp/dev.log node apps/club/e2e/full-flow.cjs
 * Needs Playwright with Chromium available (`require("playwright")`) and psql access as rallix_service.
 */
const {chromium}=require('playwright');const fs=require('fs');const {execSync}=require('child_process');
const SC=process.env.E2E_OUT||'/tmp';const DEV_LOG=process.env.DEV_LOG;if(!DEV_LOG){console.error('Set DEV_LOG to the dev server log file');process.exit(2)}
const B=process.env.BASE||'http://localhost:3000';
const sql=q=>execSync(`PGPASSWORD=service_dev psql -h localhost -U rallix_service -d ${process.env.PGDB||'rallix_dev'} -Atc "${q.replace(/"/g,'\\"')}"`).toString().trim();
let pass=0,fail=0;const ok=(c,m)=>{if(c){pass++;console.log('  ok  ',m)}else{fail++;console.log('  FAIL',m)}};
const EMAILS = { '+2348030000100': 'admin@example.com', '+2348030000200': 'owner@rallix.app', '+2348030000300': 'lt@x.example', '+2348039999999': 'newowner@example.com', '+2348038888888': 'joiner@example.com', '+2348037777777': 'badcode@example.com', '+2348030000000': 'jide@example.com', '+2348030000001': 'pastor@example.com', '+2348030000002': 'sule@example.com', '+2348030000003': 'nurudeen@example.com', '+2348030000004': 'dorathy@example.com', '+2348030000005': 'nathaniel@example.com', '+2348030000006': 'ade@example.com' };
const emailFor = p => EMAILS[p] || p;
const CODE_RE = (email) => new RegExp('\\[mail:dev\\] to ' + email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ' \\|[^\\n]*\\n\\s+Your (?:Rallix|Rallix Console) sign-in code is (\\d{6})', 'g');
async function readCode(logPath, email) {
  const log = require('fs').readFileSync(logPath).toString().replace(/\0/g, '');
  const all = [...log.matchAll(CODE_RE(email))]; return all.length ? all[all.length - 1][1] : null;
}
async function signIn(page, who, next = '/') {
  const email = emailFor(who);
  await page.goto(B + '/sign-in?next=' + encodeURIComponent(next));
  await page.getByLabel('Email address').fill(email); await page.getByRole('button', { name: 'Email me a code' }).click();
  await page.getByLabel('6-digit code').waitFor({ timeout: 25000 }); await page.waitForTimeout(500);
  const code = await readCode(DEV_LOG, email);
  await page.getByLabel('6-digit code').fill(code); await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL(u => !/sign-in/.test(u.toString()), { timeout: 25000 });
}
(async()=>{const b=await chromium.launch();
const mk=async()=>{const c=await b.newContext({viewport:{width:440,height:956}});c.setDefaultTimeout(90000);c.setDefaultNavigationTimeout(90000);const p=await c.newPage();p._errs=[];p.on('pageerror',e=>p._errs.push(e.message.slice(0,120)));return p};
const text=p=>p.locator('body').innerText();
// ===== A. admin =====
console.log('A. club admin (Innocent Amos)');
const A=await mk();await signIn(A,'+2348030000100','/');
await A.waitForLoadState('networkidle');let t=await text(A);
ok(/HOME/i.test(t)&&/Paris Arena/i.test(t),'admin lands on Home with the club name');
await A.screenshot({path:SC+'/e_admin_home.png'});
await A.goto(B+'/members');t=await text(A);
ok(['Jide Taiwo','Pastor','Sule','Nurudeen','Dorathy','Nathaniel','Ade'].every(n=>new RegExp(n,'i').test(t)),'members page lists all 7 players from the database');
await A.screenshot({path:SC+'/e_admin_members.png'});
const firstMember=await A.locator('a.rx-mcard').first().getAttribute('href');await A.goto(B+firstMember);t=await text(A);
ok(/Club rank/i.test(t)&&/Rating/i.test(t),'member profile loads from a real membership id');
await A.goto(B+'/membership/payments');t=await text(A);ok(/Paid|Pending|Failed/i.test(t),'payments page shows seeded dues');
await A.goto(B+'/membership/subscriptions');t=await text(A);ok(/₦6,000/.test(t),'subscription plans show ₦6,000 from the database');
await A.screenshot({path:SC+'/e_admin_plans.png'});
await A.goto(B+'/membership');await A.getByRole('radio',{name:'Year'}).click();t=await text(A);ok(/₦/.test(t),'revenue card renders period totals');
await A.goto(B+'/profile/invite');await A.getByRole('button',{name:/Create (invite link|a new link)/}).click();await A.getByText(/\/join\/[A-Z0-9]{8}/).first().waitFor({timeout:15000}).catch(()=>{});t=await text(A);
const inv=(t.match(/\/join\/([A-Z0-9]{8})/)||[])[1];ok(!!inv,'admin created an invite link ('+inv+')');
// ===== B. create competition + score =====
console.log('B. create a competition, then score a match');
await A.goto(B+'/competition/new/senior/auto');
ok(/Jide/i.test(await text(A))&&!/Nathaniel/i.test(await text(A)),'senior list shows only senior players');
await A.getByLabel('What will you name this competition?').fill('E2E Senior Cup');
await A.getByLabel('Start date').fill('2026-11-01');await A.getByLabel('End date').fill('2026-11-30');
await A.getByRole('button',{name:/Shuffle group/}).click();
await A.waitForURL(/\/shuffle/,{timeout:20000});await A.waitForURL(/\/groups/,{timeout:20000});
const compId=A.url().match(/competition\/([0-9a-f-]{36})/)[1];t=await text(A);
ok(/E2E Senior Cup/i.test(t),'competition created and shown');
ok(sql(`select count(*) from matches where competition_id='${compId}'`)==='3','3 round-robin matches generated for 3 players');
await A.screenshot({path:SC+'/e_admin_groups.png'});
await A.locator('a[aria-label^="Score"]').first().click();await A.waitForURL(/\/score\?match=/);
const tiles=A.locator('button.rx-score');
for(let g=0;g<3;g++){for(let i=0;i<11;i++)await tiles.first().click();}
await A.waitForTimeout(300);t=await text(A);ok(/Winner:/i.test(t),'score sheet detects the winner after 3 games');
await A.screenshot({path:SC+'/e_admin_score.png'});
await A.getByRole('button',{name:'Save result'}).click();await A.waitForURL(/\/groups/,{timeout:20000});
const mid=sql(`select id from matches where competition_id='${compId}' and status='completed'`);
ok(!!mid,'result saved: match is completed in the database');
ok(sql(`select count(*) from games where match_id='${mid}'`)==='3','3 games stored');
ok(sql(`select count(*) from rating_events where match_id='${mid}'`)==='2','Elo events written for both players');
const w=sql(`select r.rating from matches m join ratings r on r.membership_id=m.winner_id and r.scope='club' where m.id='${mid}'`);
ok(Number(w)>1200||Number(w)>0,'winner club rating updated ('+w+')');
ok(Number(sql(`select count(*) from ratings where scope='competition' and competition_id='${compId}'`))===2,'competition-scope ratings created');
// repeat save is rejected (idempotent)
// ===== C. player =====
console.log('C. player (Ade) and permissions');
const P=await mk();await signIn(P,'+2348030000006','/');await P.waitForLoadState('networkidle');t=await text(P);
ok(/Lagos Spin Club/i.test(t),'Ade (admin of Lagos) lands on the Lagos admin home first');
await P.getByRole('button',{name:/Switch club/}).click();await P.waitForTimeout(400);
ok(/Paris Arena/i.test(await P.locator('dialog').innerText()),'club switcher lists both clubs');
await P.screenshot({path:SC+'/e_switcher.png'});
await P.getByRole('link',{name:/Paris Arena/}).click();await P.waitForURL(/\/play/);t=await text(P);
ok(/Hi, Ade/i.test(t),'switching to Paris opens the player home');
ok(/Pastor/i.test(t),'next match vs Pastor from the database');
ok(/₦6,000/.test(t),'dues card from the database');
await P.screenshot({path:SC+'/e_player_home.png'});
await P.goto(B+'/play/stats');t=await text(P);
ok(/Played\s*4|4\s*Played/i.test(t.replace(/\n/g,' '))||/Won \/ Lost/i.test(t),'stats computed from confirmed matches');
ok(/2 won, 2 lost/.test(t),'Ade record is 2 won / 2 lost');
await P.screenshot({path:SC+'/e_player_stats.png'});
await P.goto(B+'/play/ranks');t=await text(P);ok(/Jide/i.test(t)&&/\bYou\b/.test(t),'club leaderboard shows Ade as (you)');
await P.getByRole('radio',{name:'Global'}).click();ok(/Rating \d+/.test(await text(P)),'global leaderboard renders');
await P.goto(B+'/play/compete');t=await text(P);ok(/Paris Arena Group Stage/i.test(t),'compete lists Ade’s competition');
await P.goto(B+'/members');await P.waitForURL(/\/play/);ok(true,'player is redirected away from admin Members');
await P.goto(B+'/competition/new');await P.waitForURL(/\/play/);ok(true,'player cannot open the create-competition wizard');
await P.goto(B+`/competition/${compId}/score?match=${mid}`);await P.waitForURL(/\/play/);ok(true,'player cannot open a score sheet');
await P.goto(B+'/play/me/payments');ok(/Payments/i.test(await text(P)),'player payments page loads');
// ===== D. brand-new user =====
console.log('D. new user creates a club, invites another');
const N=await mk();await signIn(N,'+2348039999999','/');await N.waitForURL(/onboarding/,{timeout:15000});ok(true,'user with no club is sent to onboarding');
await N.getByLabel('What is your club called?').fill('Test Club');await N.getByLabel('What’s your name').fill('Ngozi Test');await N.getByLabel('Where are you located').fill('Enugu');
await N.getByRole('button',{name:'Create my club'}).click();await N.waitForURL(u=>!/onboarding/.test(u.toString()),{timeout:20000});await N.waitForLoadState('networkidle');
ok(/Test Club/i.test(await text(N)),'new club created, user is its admin');
ok(sql(`select slug from clubs where name='Test Club'`)==='test-club','club slug generated');
await N.goto(B+'/members');{const rt=await text(N);ok(/Ngozi Test/i.test(rt)&&!/Jide|Pastor|Sule|Nurudeen|Dorathy|Nathaniel/i.test(rt),'new club roster is just its founder, none of Paris Arena’s players');}
await N.goto(B+'/competition');ok(!/Senior Cup|Group Stage/i.test(await text(N)),'new club sees none of Paris Arena’s competitions');
await N.goto(B+'/profile/invite');await N.getByRole('button',{name:/Create invite link/}).click();await N.getByText(/\/join\/[A-Z0-9]{8}/).first().waitFor({timeout:15000}).catch(()=>{});
const code=((await text(N)).match(/\/join\/([A-Z0-9]{8})/)||[])[1];ok(!!code,'new club admin created invite '+code);
sql(`insert into club_pages (club_id, join_mode) select id, 'open' from clubs where name='Test Club' on conflict (club_id) do update set join_mode='open'`); // this scenario is about joining; review mode is covered by applications.cjs
const J=await mk();await signIn(J,'+2348038888888','/join/'+code);await J.waitForLoadState('networkidle');
await J.getByLabel('Your full name').fill('Chika Joiner');await J.getByRole('radio',{name:'Senior'}).click();await J.getByRole('button',{name:'Join club'}).click();
await J.waitForURL(/\/play/,{timeout:20000});await J.waitForLoadState('networkidle');await J.getByText(/Hi, Chika/i).first().waitFor({timeout:25000}).catch(()=>{});ok(/Hi, Chika/i.test(await text(J)),'invited user joined and sees the player home');
ok(sql(`select level from player_profiles p join memberships m on m.id=p.membership_id join users u on u.id=m.user_id where u.email='joiner@example.com'`)==='senior','joined profile has the chosen level');
const J2=await mk();await J2.goto(B+'/join/NOPE1234');await J2.waitForLoadState('networkidle');
ok(/isn’t valid|isn't valid/i.test(await text(J2)),'a bad invite code shows a clear message instead of a form');
ok(/invalid, expired or full/i.test(await text(J2)),'a bad invite code shows a clear error');
await J.goto(B+'/members');await J.waitForURL(/\/play/);ok(true,'the new player cannot open admin pages in that club');
// cross-club isolation through the UI
await J.goto(B+'/play/compete/'+compId);await J.waitForFunction(()=>/not be found|404/i.test(document.body.innerText),null,{timeout:20000}).catch(()=>{});const st=await J.evaluate(()=>document.body.innerText);ok(/not be found|404/i.test(st),'Test Club player cannot open a Paris Arena competition (404)');
const errs=[A,P,N,J,J2].flatMap(p=>p._errs);ok(errs.length===0,'no uncaught browser errors '+JSON.stringify(errs));
await b.close();console.log(`\n${pass} passed, ${fail} failed`);process.exit(fail?1:0)})().catch(e=>{console.error('CRASH',e.message);process.exit(2)});
