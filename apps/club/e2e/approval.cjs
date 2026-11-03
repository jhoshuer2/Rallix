/**
 * Club approval, plan catalogue and the member limit (needs BOTH apps, club :3000 and console :3001, fresh seeded DB):
 *   CLUB_LOG=... CONSOLE_LOG=... node apps/club/e2e/approval.cjs
 * Staff switch approval on; a new club waits (the owner sees "We're reviewing your club"); staff approve (owner emailed) or decline with a reason;
 * a plan with a member limit is created and assigned (price from the plan); the club is nudged when nearly full, and a full club
 * refuses the next player in the club app, however they try to join.
 */
const {chromium}=require('playwright');const fs=require('fs');const {execSync}=require('child_process');
const CLUB='http://localhost:3000', CON='http://localhost:3001';
const LOGS={[CLUB]:process.env.CLUB_LOG,[CON]:process.env.CONSOLE_LOG};
if(!LOGS[CLUB]||!LOGS[CON]){console.error('Set CLUB_LOG and CONSOLE_LOG');process.exit(2)}
const sql=q=>execSync(`PGPASSWORD=service_dev psql -h localhost -U rallix_service -d ${process.env.PGDB||'rallix_dev'} -Atc "${q.replace(/"/g,'\\"')}"`).toString().trim().split('\n')[0];
let pass=0,fail=0;const ok=(c,m)=>{c?pass++:fail++;console.log(c?'  ok  ':'  FAIL',m)};
const codeFor=(log,email)=>{const t=fs.readFileSync(log).toString().replace(/\0/g,'');const re=new RegExp('\\[mail:dev\\] to '+email.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+' \\|[^\\n]*\\n\\s+Your (?:Rallix|Rallix Console) sign-in code is (\\d{6})','g');const a=[...t.matchAll(re)];return a.length?a[a.length-1][1]:null};
async function signIn(p,base,email,next='/'){await p.goto(base+'/sign-in'+(base===CLUB?'?next='+encodeURIComponent(next):''));await p.getByLabel(/Email address|Work email/).fill(email);await p.getByRole('button',{name:'Email me a code'}).click();await p.getByLabel(/6-digit code/).waitFor({timeout:60000});await p.waitForTimeout(600);await p.getByLabel(/6-digit code/).fill(codeFor(LOGS[base],email));await p.getByRole('button',{name:'Sign in'}).click();await p.waitForLoadState('networkidle');await p.waitForTimeout(900)}
const mk=async(b,w,h)=>{const c=await b.newContext({viewport:{width:w,height:h}});c.setDefaultTimeout(60000);c.setDefaultNavigationTimeout(90000);const p=await c.newPage();p.errs=[];p.on('pageerror',e=>p.errs.push(e.message));return p};
const mails=()=>fs.readFileSync(LOGS[CON]).toString().split('\n').filter(l=>l.includes('[mail:dev]'));
async function createClub(p,email,club){await signIn(p,CLUB,email);await p.waitForURL(/onboarding/,{timeout:30000});
  await p.getByLabel('What is your club called?').fill(club);await p.getByLabel('What’s your name').fill(club+' Owner');await p.getByLabel('Where are you located').fill('Enugu');
  await p.getByRole('button',{name:'Create my club'}).click();await p.waitForLoadState('networkidle');await p.waitForTimeout(1500)}

(async()=>{const b=await chromium.launch();
sql(`update platform_settings set club_approval=false where id=1`);
const own=await mk(b,1280,900);await signIn(own,CON,'owner@rallix.app');

// ---------- Approval on ----------
await own.goto(CON+'/clubs',{waitUntil:'networkidle'});
ok(!(await own.getByText(/Waiting for approval \(/).count()),'no queue while nothing is waiting');
await own.getByRole('checkbox',{name:/New clubs need approval/}).check();await own.getByText('New clubs now wait for approval.').waitFor();
ok(sql(`select club_approval from platform_settings where id=1`)==='t','approval is switched on');

// A new club waits
const n1=await mk(b,440,956);await createClub(n1,'owner1@example.com','Pending FC');
ok(sql(`select status from clubs where name='Pending FC'`)==='pending','the new club is pending');
ok(await n1.getByText('We’re reviewing your club').isVisible(),'its owner sees "We’re reviewing your club"');
ok(await n1.getByText(/Pending FC is waiting for approval from Rallix/).isVisible(),'and which club is waiting');

// Console queue
await own.goto(CON+'/clubs',{waitUntil:'networkidle'});
ok(await own.getByText('Waiting for approval (1)').isVisible(),'the console shows "Waiting for approval (1)"');
ok(await own.getByText('owner1@example.com').isVisible(),'with the owner\'s email');
// Support cannot approve
sql(`insert into platform_admins (user_id, role) select id, 'support' from users where email='nurudeen@example.com'`);
const sup=await mk(b,1280,900);await signIn(sup,CON,'nurudeen@example.com');await sup.goto(CON+'/clubs',{waitUntil:'networkidle'});
ok(await sup.getByText('Waiting for approval (1)').isVisible()&&!(await sup.getByRole('button',{name:'Approve'}).count()),'support sees the queue but has no Approve button');
ok(!(await sup.getByRole('checkbox',{name:/New clubs need approval/}).count()),'and no approval switch');
// A pending club cannot be suspended from the club page
await own.getByRole('link',{name:'Pending FC'}).first().click();await own.waitForURL(/clubs\/[0-9a-f-]{36}/);
ok(await own.getByText('This club is waiting for approval.').isVisible(),'the club page says it is waiting and has no status form');

// Approve
await own.goto(CON+'/clubs',{waitUntil:'networkidle'});
await own.getByRole('button',{name:'Approve'}).click();await own.getByText('Approved. The owner has been emailed.').waitFor();
ok(sql(`select status from clubs where name='Pending FC'`)==='active','approved: the club is active');
ok(mails().some(l=>l.includes('to owner1@example.com')&&/Pending FC is approved on Rallix/.test(l)),'the owner was emailed "Pending FC is approved on Rallix"');
ok(sql(`select count(*) from email_log where kind='club_review' and to_email='owner1@example.com' and status='sent'`)==='1','the email is logged as a club review');
ok(sql(`select count(*) from audit_log where action='club.approve'`)==='1','approval is in the audit log');
await n1.goto(CLUB+'/',{waitUntil:'networkidle'});
ok(!/suspended/.test(n1.url()),'the owner now gets into the club: '+n1.url());

// Decline another
const n2=await mk(b,440,956);await createClub(n2,'owner2@example.com','Declined FC');
ok(sql(`select status from clubs where name='Declined FC'`)==='pending','a second club is pending');
await own.goto(CON+'/clubs',{waitUntil:'networkidle'});
await own.getByRole('button',{name:'Decline'}).click();
await own.getByLabel(/Why is Declined FC declined/).fill('x');await own.getByRole('button',{name:'Decline'}).last().click();
ok(sql(`select status from clubs where name='Declined FC'`)==='pending','a decline without a real reason does nothing');
await own.getByLabel(/Why is Declined FC declined/).fill('We could not verify this club.');await own.getByRole('button',{name:'Decline'}).last().click();await own.getByText('Declined. The owner has been emailed.').waitFor();
ok(sql(`select status from clubs where name='Declined FC'`)==='closed','declined: the club is closed');
ok(mails().some(l=>l.includes('to owner2@example.com')&&/About your Rallix club Declined FC/.test(l)),'the owner was emailed with the reason');
ok(sql(`select count(*) from audit_log where action='club.decline' and meta->>'reason' like '%verify%'`)==='1','the reason is in the audit log');
await own.goto(CON+'/clubs',{waitUntil:'networkidle'});
ok(!(await own.getByText(/Waiting for approval \(/).count()),'the queue is empty again');

// Approval off: a new club is live at once
await own.getByRole('checkbox',{name:/New clubs need approval/}).uncheck();await own.getByText('New clubs go live straight away.').waitFor();
const n3=await mk(b,440,956);await createClub(n3,'owner3@example.com','Live FC');
ok(sql(`select status from clubs where name='Live FC'`)==='active','with approval off a new club is active at once');

// ---------- Plans and the member limit ----------
await own.goto(CON+'/plans',{waitUntil:'networkidle'});
ok(await own.getByText('No plans yet.').isVisible(),'Plans starts empty');
await own.getByLabel('Name').fill('Tiny');await own.getByLabel('Monthly (₦)').fill('5000');await own.getByLabel('Yearly (₦)').fill('50000');await own.getByLabel('Member limit').fill('2');
await own.getByRole('button',{name:'Add plan'}).click();await own.getByText('Plan added.').waitFor();
ok(sql(`select monthly_kobo||'|'||yearly_kobo||'|'||member_limit from platform_plans where name='Tiny'`)==='500000|5000000|2','the plan is saved in kobo with its limit');
await own.getByLabel('Name').fill('Tiny');await own.getByLabel('Monthly (₦)').fill('1');await own.getByLabel('Yearly (₦)').fill('1');await own.getByRole('button',{name:'Add plan'}).click();
ok(await own.getByText('There is already a plan with that name.').waitFor({timeout:15000}).then(()=>true).catch(()=>false),'a duplicate plan name is refused');
// Assign to Live FC
await own.goto(CON+'/billing',{waitUntil:'networkidle'});
await own.locator('label.cs-field',{hasText:'Club'}).first().locator('select').selectOption({label:'Live FC'});
await own.locator('label.cs-field',{hasText:'Plan'}).locator('select').selectOption({label:'Tiny'});
ok(await own.locator('label.cs-field',{hasText:'Amount'}).locator('input').inputValue()==='5000','the amount comes from the plan (₦5,000 monthly)');
await own.getByRole('button',{name:'Add subscription'}).click();await own.getByText('Subscription created.').waitFor();
ok(sql(`select amount_kobo||'|'||(plan_id is not null) from club_subscriptions s join clubs c on c.id=s.club_id where c.name='Live FC'`)==='500000|true','the subscription stores the plan and the plan price');
await own.goto(CON+'/clubs',{waitUntil:'networkidle'});await own.getByRole('link',{name:'Live FC'}).first().click();await own.waitForURL(/clubs\/[0-9a-f-]{36}/);
ok(await own.getByText(/Plan: Tiny · 1 of 2 players/).isVisible(),'the club page shows "Plan: Tiny · 1 of 2 players"');

// The club admin is nudged: 1 place left
await n3.goto(CLUB+'/',{waitUntil:'networkidle'});
ok(await n3.getByText('1 place left').isVisible(),'the owner sees "1 place left" on Home');
// A player joins an open club with one place left
const club=`(select id from clubs where name='Live FC')`;
sql(`insert into club_pages (club_id, join_mode) select id,'open' from clubs where name='Live FC' on conflict (club_id) do update set join_mode='open'`);
sql(`insert into invites (club_id, code, role, created_by) select c.id,'LIVEFC01','player',m.id from clubs c join memberships m on m.club_id=c.id where c.name='Live FC' limit 1`);
const j1=await mk(b,440,956);await signIn(j1,CLUB,'joiner1@example.com','/join/LIVEFC01');await j1.waitForLoadState('networkidle');
await j1.getByLabel('Your full name').fill('First Joiner');await j1.getByRole('radio',{name:'Senior'}).click();await j1.getByRole('button',{name:'Join club'}).click();
await j1.waitForURL(/\/play/,{timeout:40000});
ok(sql(`select count(*) from memberships m join clubs c on c.id=m.club_id where c.name='Live FC' and m.status='active' and 'player'=ANY(m.roles)`)==='2','the second player joined (2 of 2)');
await n3.goto(CLUB+'/',{waitUntil:'networkidle'});
ok(await n3.getByText('Your club is full').isVisible(),'the owner now sees "Your club is full"');
// The next player is refused
const j2=await mk(b,440,956);await signIn(j2,CLUB,'joiner2@example.com','/join/LIVEFC01');await j2.waitForLoadState('networkidle');
await j2.getByLabel('Your full name').fill('Second Joiner');await j2.getByRole('radio',{name:'Senior'}).click();await j2.getByRole('button',{name:'Join club'}).click();
ok(await j2.getByText(/This club is full right now/).waitFor({timeout:30000}).then(()=>true).catch(()=>false),'a third player is told "This club is full right now"');
ok(sql(`select count(*) from memberships m join clubs c on c.id=m.club_id where c.name='Live FC' and m.status='active' and 'player'=ANY(m.roles)`)==='2','and was not added');
// Leaving frees a place
sql(`update memberships set status='left' where user_id=(select id from users where email='joiner1@example.com') and club_id=${club}`);
await j2.getByRole('button',{name:'Join club'}).click();await j2.waitForURL(/\/play/,{timeout:40000});
ok(sql(`select count(*) from memberships m join clubs c on c.id=m.club_id where c.name='Live FC' and m.status='active' and 'player'=ANY(m.roles)`)==='2','after someone left, the next player could join');

ok([own,sup,n1,n2,n3,j1,j2].every(p=>p.errs.length===0),'no console errors '+[own,sup,n1,n2,n3,j1,j2].flatMap(p=>p.errs).join('|'));
console.log(`\n${pass} passed, ${fail} failed`);await b.close();process.exit(fail?1:0)})().catch(e=>{console.error('CRASH',e.message);process.exit(2)});
