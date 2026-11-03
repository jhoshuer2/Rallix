/**
 * Support inbox and staff roles end-to-end (needs BOTH apps, club :3000 and console :3001, fresh seeded DB):
 *   CLUB_LOG=... CONSOLE_LOG=... node apps/club/e2e/support.cjs
 * A player and an admin send help requests from the club app; staff in the console see them in the club inbox, reply by email,
 * and the sender sees the new status. Roles: support can open issues but not billing, finance the reverse, only the owner sees the team,
 * the last owner cannot be demoted.
 */
const {chromium}=require('playwright');const fs=require('fs');const {execSync}=require('child_process');
const CLUB='http://localhost:3000', CON='http://localhost:3001';
const LOGS={[CLUB]:process.env.CLUB_LOG,[CON]:process.env.CONSOLE_LOG};
if(!LOGS[CLUB]||!LOGS[CON]){console.error('Set CLUB_LOG and CONSOLE_LOG');process.exit(2)}
const sql=q=>execSync(`PGPASSWORD=service_dev psql -h localhost -U rallix_service -d ${process.env.PGDB||'rallix_dev'} -Atc "${q.replace(/"/g,'\\"')}"`).toString().trim();
let pass=0,fail=0;const ok=(c,m)=>{c?pass++:fail++;console.log(c?'  ok  ':'  FAIL',m)};
const codeFor=(log,email)=>{const t=fs.readFileSync(log).toString().replace(/\0/g,'');const re=new RegExp('\\[mail:dev\\] to '+email.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+' \\|[^\\n]*\\n\\s+Your (?:Rallix|Rallix Console) sign-in code is (\\d{6})','g');const a=[...t.matchAll(re)];return a.length?a[a.length-1][1]:null};
async function signIn(p,base,email,next='/'){await p.goto(base+'/sign-in'+(base===CLUB?'?next='+encodeURIComponent(next):''));await p.getByLabel(/Email address|Work email/).fill(email);await p.getByRole('button',{name:'Email me a code'}).click();await p.getByLabel(/6-digit code/).waitFor({timeout:60000});await p.waitForTimeout(600);await p.getByLabel(/6-digit code/).fill(codeFor(LOGS[base],email));await p.getByRole('button',{name:'Sign in'}).click();await p.waitForLoadState('networkidle');await p.waitForTimeout(900)}
const mk=async(b,w,h)=>{const c=await b.newContext({viewport:{width:w,height:h}});c.setDefaultTimeout(60000);c.setDefaultNavigationTimeout(90000);const p=await c.newPage();p.errs=[];p.on('pageerror',e=>p.errs.push(e.message));return p};
const club=`(select id from clubs where name='Paris Arena')`;
const mailLines=()=>fs.readFileSync(LOGS[CON]).toString().split('\n');

(async()=>{const b=await chromium.launch();
sql(`delete from issues`);
// ---------- Club side ----------
const ade=await mk(b,440,956);await signIn(ade,CLUB,'ade@example.com');await ade.goto(CLUB+'/switch/'+sql(`select id from clubs where name='Paris Arena'`),{waitUntil:'networkidle'});
await ade.goto(CLUB+'/play/me',{waitUntil:'networkidle'});
await ade.getByRole('link',{name:/Help/}).click();await ade.waitForURL(/play\/help/);
ok(await ade.getByRole('button',{name:/Send to Rallix support/}).isDisabled(),'the send button is disabled until there is a title');
ok(!(await ade.getByText('Your requests').count()),'no "Your requests" list before anything is sent');
await ade.getByLabel('What do you need help with?').fill('Scores will not save');
await ade.getByLabel(/Details/).fill('The save button spins forever on my phone.');
await ade.getByRole('button',{name:/Send to Rallix support/}).click();await ade.getByText('Sent. We’ll reply by email.').waitFor();
ok(sql(`select source||'|'||(club_id=${club})||'|'||(reported_by=(select id from users where email='ade@example.com'))||'|'||status from issues`)==='club|true|true|open','stored as a club request from Ade, open');
await ade.getByText('Your requests').waitFor();
ok(await ade.getByText('Received').isVisible(),'Ade sees the request with the status "Received"');

// five a day
sql(`insert into issues (title, club_id, reported_by, source) select 'Filler '||g, ${club}, (select id from users where email='ade@example.com'), 'club' from generate_series(1,4) g`);
await ade.getByLabel('What do you need help with?').fill('One too many');await ade.getByRole('button',{name:/Send to Rallix support/}).click();
ok(await ade.getByText(/five requests today/).waitFor({timeout:15000}).then(()=>true).catch(()=>false),'the sixth request in a day is refused with a clear message');
sql(`delete from issues where title like 'Filler %'`);

// an admin can ask too
const adm=await mk(b,440,956);await signIn(adm,CLUB,'admin@example.com');await adm.goto(CLUB+'/switch/'+sql(`select id from clubs where name='Paris Arena'`),{waitUntil:'networkidle'});
await adm.goto(CLUB+'/profile',{waitUntil:'networkidle'});await adm.getByRole('link',{name:/Help/}).click();await adm.waitForURL(/profile\/help/);
await adm.getByLabel('What do you need help with?').fill('How do I add a second admin?');await adm.getByRole('button',{name:/Send to Rallix support/}).click();await adm.getByText('Sent. We’ll reply by email.').waitFor();
ok(sql(`select count(*) from issues where source='club'`)==='2','the admin’s request is stored too');
await ade.goto(CLUB+'/play/help',{waitUntil:'networkidle'});
ok(!(await ade.getByText('How do I add a second admin?').count()),'one person never sees another’s requests');

// ---------- Console: the owner ----------
const own=await mk(b,1280,900);await signIn(own,CON,'owner@rallix.app');
await own.goto(CON+'/issues?source=club',{waitUntil:'networkidle'});
ok(await own.getByText('Scores will not save').isVisible()&&await own.getByText('How do I add a second admin?').isVisible(),'the owner sees both requests in the club inbox');
ok(await own.getByText('From a club').first().isVisible(),'they are marked "From a club"');
await own.getByText('Scores will not save').click();await own.waitForURL(/issues\/[0-9a-f-]{36}/);
ok(await own.getByText(/Reply to the person who sent this/).isVisible(),'a club request has a reply box');
await own.getByLabel(/Reply to the person/).fill('Thanks Ade. Please update the app from your home screen and try again.');
await own.getByRole('button',{name:'Send reply'}).click();await own.getByText('Reply sent by email.').waitFor();
ok(mailLines().some(l=>l.includes('[mail:dev] to ade@example.com')&&l.includes('Re: Scores will not save')),'the reply was emailed to Ade with "Re: <title>"');
ok(sql(`select count(*) from email_log where kind='support' and to_email='ade@example.com' and status='sent'`)==='1','the email is recorded in the log as a support email');
ok(sql(`select count(*) from issue_notes where emailed_at is not null`)==='1','the reply is kept as a note marked as emailed');
await own.reload({waitUntil:'networkidle'});ok(await own.getByText(/emailed to the reporter/).isVisible(),'the issue page shows it was emailed');
ok(sql(`select status from issues where title='Scores will not save'`)==='investigating','replying moves an open issue to "investigating"');
await ade.goto(CLUB+'/play/help',{waitUntil:'networkidle'});
ok(await ade.getByText('Looking into it').isVisible(),'Ade now sees "Looking into it"');
// A staff-raised issue has no reply box
sql(`insert into issues (title, source) values ('Internal note to self','staff')`);
await own.goto(CON+'/issues',{waitUntil:'networkidle'});await own.getByText('Internal note to self').click();await own.waitForURL(/issues\/[0-9a-f-]{36}/);
ok(!(await own.getByText(/Reply to the person who sent this/).count()),'a staff-raised issue has no email reply box');

// ---------- Roles ----------
sql(`insert into platform_admins (user_id, role) select id, 'support' from users where email='nurudeen@example.com'`);
sql(`insert into platform_admins (user_id, role) select id, 'finance' from users where email='jide@example.com'`);
sql(`insert into platform_admins (user_id, role) select id, 'admin' from users where email='pastor@example.com'`);
const sup=await mk(b,1280,900);await signIn(sup,CON,'nurudeen@example.com');
await sup.goto(CON+'/issues',{waitUntil:'networkidle'});ok(/\/issues/.test(sup.url()),'support can open Issues');
ok(!(await sup.locator('.cs-nav a',{hasText:'Billing'}).count())&&!(await sup.locator('.cs-nav a',{hasText:'Team'}).count()),'support does not see Billing or Team in the menu');
ok(await sup.locator('.cs-nav a',{hasText:'Issues'}).count()===1&&await sup.locator('.cs-nav a',{hasText:'Clubs'}).count()===1,'support sees Clubs and Issues');
await sup.goto(CON+'/billing',{waitUntil:'networkidle'});ok(!/\/billing/.test(sup.url())&&/no-access=1/.test(sup.url()),'support is sent away from Billing: '+sup.url());
await sup.goto(CON+'/team',{waitUntil:'networkidle'});ok(!/\/team/.test(sup.url()),'support is sent away from Team');
await sup.goto(CON+'/clubs',{waitUntil:'networkidle'});await sup.locator('a.cs-rowlink').first().click();await sup.waitForURL(/clubs\/[0-9a-f-]{36}/);
ok(await sup.getByText('Your role can look at this club but not change its status.').isVisible(),'support can look at a club but has no status controls');
const fin=await mk(b,1280,900);await signIn(fin,CON,'jide@example.com');
await fin.goto(CON+'/billing',{waitUntil:'networkidle'});ok(/\/billing/.test(fin.url()),'finance can open Billing');
await fin.goto(CON+'/issues',{waitUntil:'networkidle'});ok(!/\/issues/.test(fin.url()),'finance is sent away from Issues');
await fin.goto(CON+'/templates',{waitUntil:'networkidle'});ok(!/\/templates/.test(fin.url()),'finance is sent away from Templates');
const adm2=await mk(b,1280,900);await signIn(adm2,CON,'pastor@example.com');
await adm2.goto(CON+'/templates',{waitUntil:'networkidle'});ok(/\/templates/.test(adm2.url()),'an admin can open Templates');
await adm2.goto(CON+'/team',{waitUntil:'networkidle'});ok(!/\/team/.test(adm2.url()),'an admin cannot open Team');

// ---------- Team page: roles and the last owner ----------
await own.goto(CON+'/team',{waitUntil:'networkidle'});
ok(await own.getByLabel('Role for Nurudeen').count()===1||await own.locator('select[aria-label^="Role for"]').count()>=4,'the owner sees a role control for each person');
const sel=own.locator('select[aria-label^="Role for"]').filter({has:own.locator('option[value="support"]:checked')}).first();
await own.locator('tr',{hasText:'nurudeen@example.com'}).locator('select').selectOption('finance');await own.getByText('Role updated.').waitFor();
ok(sql(`select role from platform_admins where user_id=(select id from users where email='nurudeen@example.com')`)==='finance','changing a role saves it');
ok(Number(sql(`select count(*) from audit_log where action='team.role'`))===1,'the change is in the audit log');
await own.locator('tr',{hasText:'owner@rallix.app'}).locator('select').selectOption('admin');
ok(await own.getByText('There must always be at least one owner.').waitFor({timeout:15000}).then(()=>true).catch(()=>false),'the only owner cannot be demoted');
ok(sql(`select role from platform_admins where user_id=(select id from users where email='owner@rallix.app')`)==='owner','and is still an owner');
// add with a role
sql(`insert into users (id, name, email) values ('newstaff','New Staff','newstaff@example.com')`);
await own.getByLabel('Email address').fill('newstaff@example.com');await own.locator('label.cs-field',{hasText:'Role'}).locator('select').selectOption('support');await own.getByRole('button',{name:'Add to team'}).click();await own.getByText('Added to the platform team.').waitFor();
ok(sql(`select role from platform_admins where user_id='newstaff'`)==='support','a new member is added with the chosen role');

ok([own,sup,fin,adm2,ade,adm].every(p=>p.errs.length===0),'no console errors '+[own,sup,fin,adm2,ade,adm].flatMap(p=>p.errs).join('|'));
console.log(`\n${pass} passed, ${fail} failed`);await b.close();process.exit(fail?1:0)})().catch(e=>{console.error('CRASH',e.message);process.exit(2)});
