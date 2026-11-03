/**
 * Club schedule end-to-end: the Facilities admin adds a weekly session, an event and a closure; players see them on the calendar
 * (closure hides the session that day), Home shows a closure notice, a finance-only admin cannot reach the screen, bad input is refused.
 *   BASE=http://localhost:3200 PGDB=rallix_2a DEV_LOG=/path/club.log node apps/club/e2e/schedule.cjs
 */
const {chromium}=require('playwright');const fs=require('fs');const {execSync}=require('child_process');
const LOG=process.env.DEV_LOG, B=process.env.BASE||'http://localhost:3000';
const sql=q=>execSync(`PGPASSWORD=service_dev psql -h localhost -U rallix_service -d ${process.env.PGDB||'rallix_dev'} -Atc "${q.replace(/"/g,'\\"')}"`).toString().trim();
let pass=0,fail=0;const ok=(c,m)=>{c?pass++:fail++;console.log(c?'  ok  ':'  FAIL',m)};
function code(email){const log=fs.readFileSync(LOG).toString().replace(/\0/g,'');const re=new RegExp('\\[mail:dev\\] to '+email.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+' \\|[^\\n]*\\n\\s+Your (?:Rallix|Rallix Console) sign-in code is (\\d{6})','g');const a=[...log.matchAll(re)];return a.length?a[a.length-1][1]:null}
async function signIn(p,email){await p.goto(B+'/sign-in?next=/');await p.getByLabel('Email address').fill(email);await p.getByRole('button',{name:'Email me a code'}).click();await p.getByLabel('6-digit code').waitFor({timeout:60000});await p.waitForTimeout(600);await p.getByLabel('6-digit code').fill(code(email));await p.getByRole('button',{name:'Sign in'}).click();await p.waitForURL(u=>!/sign-in/.test(u.toString()),{timeout:60000});const id=sql(`select id from clubs where name='Paris Arena'`);await p.goto(B+'/switch/'+id,{waitUntil:'networkidle'})}
async function who(b,email){const c=await b.newContext({viewport:{width:440,height:956}});c.setDefaultTimeout(60000);const p=await c.newPage();p.errs=[];p.on('pageerror',e=>p.errs.push(e.message));await signIn(p,email);return {c,p}}
const iso=(n)=>{const d=new Date(Date.now()+n*864e5);return new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Lagos'}).format(d)};

(async()=>{const b=await chromium.launch();
sql(`delete from club_events`);
const admin=await who(b,'admin@example.com'), ade=await who(b,'ade@example.com');

// Empty states
await admin.p.goto(B+'/profile',{waitUntil:'networkidle'});
ok(await admin.p.getByRole('link',{name:/Schedule/}).isVisible(),'Club menu has Schedule');
await admin.p.getByRole('link',{name:/Schedule/}).click();await admin.p.waitForURL(/profile\/schedule/);
ok(await admin.p.getByText('Nothing scheduled').isVisible(),'admin: empty state');
ok(await admin.p.getByRole('button',{name:'Add to the schedule'}).count()===1,'admin: exactly one add button while empty');
await ade.p.goto(B+'/play/calendar',{waitUntil:'networkidle'});
ok(await ade.p.getByText('Tuesday night').count()===0&&await ade.p.getByText('Public holiday').count()===0,'player: no club sessions or closures on the calendar yet');

// Weekly session
await admin.p.getByRole('button',{name:'Add to the schedule'}).click();
await admin.p.getByLabel('Title').fill('Tuesday night');
await admin.p.getByLabel('First date').fill(iso(1));
await admin.p.getByLabel('Starts').fill('18:00');await admin.p.getByLabel('Ends').fill('20:00');
await admin.p.getByRole('button',{name:'Save'}).click();await admin.p.getByText('Regular playing times',{exact:true}).waitFor();
ok(sql(`select kind||'|'||repeats_weekly||'|'||start_time||'|'||end_time from club_events`)==='play|true|18:00|20:00','weekly session saved');
ok(await admin.p.getByText(/^Every \w+ · 18:00–20:00/).isVisible(),'admin sees it as "Every <weekday> · 18:00–20:00"');

// Validation
await admin.p.getByRole('button',{name:'Add to the schedule'}).click();
await admin.p.getByLabel('Title').fill('Bad');await admin.p.getByLabel('Starts').fill('20:00');await admin.p.getByLabel('Ends').fill('18:00');
await admin.p.getByRole('button',{name:'Save'}).click();
ok(await admin.p.getByText('It has to end after it starts.').waitFor({timeout:15000}).then(()=>true).catch(()=>false),'end before start is refused with a clear message');
ok(sql(`select count(*) from club_events`)==='1','nothing saved for the bad entry');
await admin.p.getByRole('button',{name:'Close'}).click().catch(()=>{});await admin.p.keyboard.press('Escape');

// Closure on the same day as the first session + an event
await admin.p.reload({waitUntil:'networkidle'});
await admin.p.getByRole('button',{name:'Add to the schedule'}).click();
await admin.p.getByRole('radio',{name:'Closed'}).click();
await admin.p.getByLabel('Title').fill('Public holiday');await admin.p.getByLabel('From').fill(iso(1));
ok(await admin.p.getByLabel('Starts').count()===0,'a closure has no start/end times');
await admin.p.getByRole('button',{name:'Save'}).click();await admin.p.getByText('Public holiday').waitFor();
await admin.p.getByRole('button',{name:'Add to the schedule'}).click();
await admin.p.getByRole('radio',{name:'Event'}).click();
await admin.p.getByLabel('Title').fill('Club social');await admin.p.getByLabel('From').fill(iso(3));await admin.p.getByLabel('Starts').fill('16:00');
await admin.p.getByRole('button',{name:'Save'}).click();await admin.p.getByText('Club social').waitFor();
ok(sql(`select count(*) from club_events`)==='3','three entries stored');

// Edit and delete
await admin.p.getByText('Club social').click();await admin.p.getByLabel('Title').fill('Club social night');await admin.p.getByRole('button',{name:'Save'}).click();
await admin.p.getByText('Club social night').waitFor();
ok(sql(`select count(*) from club_events where title='Club social night'`)==='1','edit saved');

// Player calendar
await ade.p.goto(B+'/play/calendar',{waitUntil:'networkidle'});
ok(await ade.p.getByText('Tomorrow').first().isVisible(),'player: tomorrow is labelled');
ok(await ade.p.getByText('Public holiday').isVisible(),'player: closure is shown');
ok(await ade.p.getByText('Tuesday night').count()>=1&&await ade.p.getByText('Tuesday night').count()<=5,'player: weekly session repeats across the month');
const tomorrowBlock=await ade.p.locator('.rx-block').first().innerText();
ok(!/Tuesday night/.test(tomorrowBlock)&&/Public holiday/.test(tomorrowBlock),'player: the closure hides the session on that day');
ok(await ade.p.getByText('Club social night').isVisible(),'player: event is shown');
ok(await ade.p.getByRole('button',{name:/Add to the schedule/}).count()===0,'player cannot edit');
await ade.p.goto(B+'/play',{waitUntil:'networkidle'});
ok(await ade.p.getByText('Closed tomorrow: Public holiday').isVisible(),'Home: quiet "Closed tomorrow" notice');
await ade.p.goto(B+'/play/compete',{waitUntil:'networkidle'});
ok(await ade.p.getByRole('link',{name:/Calendar/}).isVisible(),'Compete: Calendar row');

// Permissions: a finance-only admin cannot use the screen; a player cannot reach it
sql(`update memberships set permissions=ARRAY['finance']::text[] where user_id=(select id from users where email='pastor@example.com') and club_id=(select id from clubs where name='Paris Arena')`);
sql(`update memberships set roles=ARRAY['admin','player']::member_role[], permissions=ARRAY['finance']::text[] where user_id=(select id from users where email='pastor@example.com') and club_id=(select id from clubs where name='Paris Arena')`);
const fin=await who(b,'pastor@example.com');
await fin.p.goto(B+'/profile/schedule',{waitUntil:'networkidle'});
ok(!/profile\/schedule/.test(fin.p.url()),'finance-only admin is sent away from the schedule: '+fin.p.url());
await ade.p.goto(B+'/profile/schedule',{waitUntil:'networkidle'});
ok(!/profile\/schedule/.test(ade.p.url()),'a player is sent away from the schedule');
sql(`update memberships set roles=ARRAY['player']::member_role[], permissions='{}' where user_id=(select id from users where email='pastor@example.com') and club_id=(select id from clubs where name='Paris Arena')`);

// Delete
await admin.p.goto(B+'/profile/schedule',{waitUntil:'networkidle'});
await admin.p.getByText('Club social night').click();await admin.p.getByRole('button',{name:'Delete'}).click();
await admin.p.waitForTimeout(1500);
ok(sql(`select count(*) from club_events where title like 'Club social%'`)==='0','delete works');

// A11y
for(const [n,p,path] of [['admin',admin.p,'/profile/schedule'],['ade',ade.p,'/play/calendar']]){await p.goto(B+path,{waitUntil:'networkidle'});
  const bad=await p.evaluate(()=>{const o=[];document.querySelectorAll('a,button,input').forEach(e=>{const r=e.getBoundingClientRect();if(r.width&&r.height&&r.height<43)o.push((e.textContent||e.getAttribute('aria-label')||e.tagName).trim().slice(0,30)+' '+Math.round(r.height))});return o});
  ok(bad.length===0,`${n} ${path}: touch targets ok ${bad.join(', ')}`);
  ok(await p.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),`${n} ${path}: no sideways scroll`);
  ok(p.errs.length===0,`${n}: no console errors ${p.errs.join('|')}`)}
console.log(`\n${pass} passed, ${fail} failed`);await b.close();process.exit(fail?1:0)})().catch(e=>{console.error('CRASH',e.message);process.exit(2)});
