/**
 * Calendar chips, doors open and "I'm coming": the admin adds a session with a doors-open time (bad times refused), players see the doors line and
 * say they are coming, the chips narrow the list, Home shows today's session at the court, and the admin sees who is expected, who has arrived and walk-ins.
 *   BASE=http://localhost:3200 PGDB=rallix_2a DEV_LOG=/path/club.log node apps/club/e2e/rsvp.cjs
 */
const {chromium}=require('playwright');const fs=require('fs');const {execSync}=require('child_process');
const LOG=process.env.DEV_LOG, B=process.env.BASE||'http://localhost:3000';
const sql=q=>execSync(`PGPASSWORD=service_dev psql -h localhost -U rallix_service -d ${process.env.PGDB||'rallix_dev'} -Atc "${q.replace(/"/g,'\\"')}"`).toString().trim();
let pass=0,fail=0;const ok=(c,m)=>{c?pass++:fail++;console.log(c?'  ok  ':'  FAIL',m)};
function code(email){const log=fs.readFileSync(LOG).toString().replace(/\0/g,'');const re=new RegExp('\\[mail:dev\\] to '+email.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+' \\|[^\\n]*\\n\\s+Your (?:Rallix|Rallix Console) sign-in code is (\\d{6})','g');const a=[...log.matchAll(re)];return a.length?a[a.length-1][1]:null}
async function signIn(p,email){await p.goto(B+'/sign-in?next=/');await p.getByLabel('Email address').fill(email);await p.getByRole('button',{name:'Email me a code'}).click();await p.getByLabel('6-digit code').waitFor({timeout:60000});await p.waitForTimeout(600);await p.getByLabel('6-digit code').fill(code(email));await p.getByRole('button',{name:'Sign in'}).click();await p.waitForURL(u=>!/sign-in/.test(u.toString()),{timeout:60000});const id=sql(`select id from clubs where name='Paris Arena'`);await p.goto(B+'/switch/'+id,{waitUntil:'networkidle'})}
async function who(b,email){const c=await b.newContext({viewport:{width:440,height:956}});c.setDefaultTimeout(60000);c.setDefaultNavigationTimeout(90000);const p=await c.newPage();p.errs=[];p.on('pageerror',e=>p.errs.push(e.message));await signIn(p,email);return p}
const iso=n=>new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Lagos'}).format(new Date(Date.now()+n*864e5));
const club=`(select id from clubs where name='Paris Arena')`;
const mid=n=>sql(`select m.id from memberships m join users u on u.id=m.user_id where u.email='${n}@example.com' and m.club_id=${club}`);

(async()=>{const b=await chromium.launch();
sql(`delete from club_events where club_id=${club}`);sql(`delete from arrivals where club_id=${club}`);
sql(`update clubs set venue_lat=9.0765, venue_lng=7.3986, venue_radius_m=100, venue_label='Central Hall' where id=${club}`);
const adm=await who(b,'admin@example.com'), ade=await who(b,'ade@example.com'), jide=await who(b,'jide@example.com');

// Admin: a session with doors open
await adm.goto(B+'/profile/schedule',{waitUntil:'networkidle'});
await adm.getByRole('button',{name:'Add to the schedule'}).click();
await adm.getByLabel('Title').fill('Doors night');await adm.getByLabel('First date').fill(iso(0));await adm.getByLabel('Starts').fill('18:00');
ok(await adm.getByLabel('Doors open (optional)').isVisible(),'the doors-open field appears once there is a start time');
await adm.getByLabel('Doors open (optional)').fill('18:30');await adm.getByRole('button',{name:'Save'}).click();
ok(await adm.getByText('Doors can’t open after the start.').waitFor({timeout:15000}).then(()=>true).catch(()=>false),'doors opening after the start is refused');
await adm.getByLabel('Doors open (optional)').fill('17:45');await adm.getByRole('button',{name:'Save'}).click();await adm.getByText('Doors night').first().waitFor();
ok(sql(`select doors_open||'|'||start_time from club_events where title='Doors night'`)==='17:45|18:00','session saved with doors open 17:45, start 18:00');
ok(await adm.getByText(/doors 17:45/).isVisible(),'the schedule list shows the doors time');
// A later one-off event and a far one
sql(`insert into club_events (club_id, kind, title, starts_on, start_time) values (${club}, 'event', 'Tomorrow social', '${iso(1)}', '16:00'), (${club}, 'event', 'Month-end cup', '${iso(20)}', '10:00')`);

// Player: calendar chips and I'm coming
await ade.goto(B+'/play/calendar',{waitUntil:'networkidle'});
ok(await ade.getByRole('radio',{name:'This week'}).getAttribute('aria-checked')==='true','"This week" is the default range');
ok(await ade.getByText('Doors open 17:45 · from 18:00').first().isVisible(),'today\'s session shows "Doors open 17:45 · from 18:00"');
ok(await ade.getByText('Tomorrow social').isVisible()&&!(await ade.getByText('Month-end cup').count()),'this week shows tomorrow\'s event but not the one 20 days away');
await ade.getByRole('radio',{name:'This month'}).click();
ok(await ade.getByText('Month-end cup').isVisible(),'"This month" adds the later event');
await ade.getByRole('radio',{name:'Today'}).click();
ok(await ade.getByText('Doors night').first().isVisible()&&!(await ade.getByText('Tomorrow social').count()),'"Today" shows only today');
await ade.getByRole('button',{name:/I’m coming to Doors night/}).click();await ade.getByRole('button',{name:/Not coming to Doors night/}).waitFor();
ok(await ade.getByText('Coming ✓').isVisible(),'the button now says "Coming ✓"');
ok(sql(`select count(*) from event_rsvps where membership_id='${mid('ade')}' and on_date='${iso(0)}'`)==='1','the RSVP is stored for today');
await ade.reload({waitUntil:'networkidle'});await ade.getByRole('radio',{name:'Today'}).click();
ok(await ade.getByText('Coming ✓').isVisible(),'it is still there after a reload');
// Home shows today's session at the court
await ade.goto(B+'/play',{waitUntil:'networkidle'});
ok(await ade.getByText('Today: Doors night · Doors open 17:45').isVisible(),'Home: "At the court" shows today\'s session and its doors time');

// Jide also says he is coming; Ade checks in at the door; Sule walks in without saying
await jide.goto(B+'/play/calendar',{waitUntil:'networkidle'});await jide.getByRole('radio',{name:'Today'}).click();
await jide.getByRole('button',{name:/I’m coming to Doors night/}).click();await jide.getByText('Coming ✓').waitFor();
ok(sql(`select count(*) from event_rsvps where on_date='${iso(0)}'`)==='2','two people are coming');
sql(`insert into arrivals (club_id, membership_id, method) values (${club}, '${mid('ade')}', 'door'), (${club}, '${mid('sule')}', 'door')`);
await adm.goto(B+'/members/attendance',{waitUntil:'networkidle'});
ok(await adm.getByText('Expected today').isVisible(),'the admin sees "Expected today"');
ok(await adm.getByText('1 of 2 here').isVisible(),'"1 of 2 here": Ade arrived, Jide has not');
ok(await adm.getByText(/Still to come: Jide/).isVisible(),'and names who is still to come');
ok(await adm.getByText('1 person here didn’t say they were coming.').isVisible(),'one walk-in (Sule) is counted');

// Not coming any more
await ade.goto(B+'/play/calendar',{waitUntil:'networkidle'});await ade.getByRole('radio',{name:'Today'}).click();
await ade.getByRole('button',{name:/Not coming to Doors night/}).click();await ade.getByRole('button',{name:/I’m coming to Doors night/}).waitFor();
ok(sql(`select count(*) from event_rsvps where membership_id='${mid('ade')}'`)==='0','"Not coming" removes the RSVP');
// Closures cannot be RSVPed to
sql(`insert into club_events (club_id, kind, title, starts_on) values (${club}, 'closed', 'Holiday', '${iso(2)}')`);
await ade.reload({waitUntil:'networkidle'});await ade.getByRole('radio',{name:'This week'}).click();
ok(await ade.getByText('Holiday').isVisible()&&!(await ade.getByRole('button',{name:/Holiday/}).count()),'a closure has a "Closed" tag and no "I\'m coming" button');

// A11y
for(const [n,p,path] of [['player',ade,'/play/calendar'],['admin',adm,'/members/attendance']]){await p.goto(B+path,{waitUntil:'networkidle'});
  const bad=await p.evaluate(()=>{const o=[];document.querySelectorAll('a,button,input').forEach(e=>{const r=e.getBoundingClientRect();if(r.width&&r.height&&r.height<43&&!/rx-linkbtn/.test(e.className))o.push((e.textContent||e.tagName).trim().slice(0,30)+' '+Math.round(r.height))});return o});
  ok(bad.length===0,`${n} ${path}: touch targets ok ${bad.join(', ')}`);
  ok(await p.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),`${n} ${path}: no sideways scroll`)}
ok([adm,ade,jide].every(p=>p.errs.length===0),'no console errors '+[adm,ade,jide].flatMap(p=>p.errs).join('|'));
console.log(`\n${pass} passed, ${fail} failed`);await b.close();process.exit(fail?1:0)})().catch(e=>{console.error('CRASH',e.message);process.exit(2)});
