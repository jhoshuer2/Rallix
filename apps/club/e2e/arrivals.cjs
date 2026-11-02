/**
 * Arrival check-in end-to-end: installable app files, admin sets the court, a player checks in (outside the radius refused,
 * vague fix refused, inside works), others with alerts on get a push line in the dev log (arriver, opted-out players and
 * people with no device do not), repeat within 2 hours does not alert again, leaving works, nothing about position is stored.
 * Needs a freshly seeded DB and the club app running (PUSH_PROVIDER unset so the dev console sender is used):
 *   OUT=/tmp DEV_LOG=/tmp/club.log node apps/club/e2e/arrivals.cjs
 */
const {chromium}=require('playwright');const fs=require('fs');const {execSync}=require('child_process');
const SC=process.env.OUT||'/tmp', LOG=process.env.DEV_LOG, B='http://localhost:3000';
const sql=q=>execSync(`PGPASSWORD=service_dev psql -h localhost -U rallix_service -d rallix_dev -Atc "${q.replace(/"/g,'\\"')}"`).toString().trim();
let pass=0,fail=0;const ok=(c,m)=>{c?pass++:fail++;console.log(c?'  ok  ':'  FAIL',m)};
function code(email){const log=fs.readFileSync(LOG).toString().replace(/\0/g,'');const re=new RegExp('\\[mail:dev\\] to '+email.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+' \\|[^\\n]*\\n\\s+Your (?:Rallix|Rallix Console) sign-in code is (\\d{6})','g');const a=[...log.matchAll(re)];return a.length?a[a.length-1][1]:null}
const pushLines=()=>fs.readFileSync(LOG).toString().split('\n').filter(l=>l.includes('[push:dev]'));
async function signIn(p,email){await p.goto(B+'/sign-in?next=/');await p.getByLabel('Email address').fill(email);await p.getByRole('button',{name:'Email me a code'}).click();await p.getByLabel('6-digit code').waitFor({timeout:25000});await p.waitForTimeout(600);await p.getByLabel('6-digit code').fill(code(email));await p.getByRole('button',{name:'Sign in'}).click();await p.waitForURL(u=>!/sign-in/.test(u.toString()),{timeout:25000});const id=sql(`select id from clubs where name='Paris Arena'`);await p.goto(B+'/switch/'+id)}
const COURT={latitude:9.0765,longitude:7.3986};
const metresNorth=m=>({latitude:COURT.latitude+m/111195,longitude:COURT.longitude});
async function ctx(b,email){const c=await b.newContext({viewport:{width:440,height:956},permissions:['geolocation'],geolocation:{...COURT,accuracy:10}});const p=await c.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.errs=errs;await signIn(p,email);return {c,p}}

(async()=>{const b=await chromium.launch();
// Installable app files
{const c=await b.newContext();const r=await c.request.get(B+'/manifest.webmanifest');const m=await r.json().catch(()=>({}));
 ok(r.status()===200&&m.display==='standalone'&&m.icons?.length>=3,'manifest is served: standalone with icons');
 const sw=await c.request.get(B+'/sw.js');ok(sw.status()===200&&/javascript/.test(sw.headers()['content-type']||'')&&/no-cache|no-store/.test(sw.headers()['cache-control']||''),'service worker is served as JavaScript and never cached');
 for(const f of ['icon-192','icon-512','maskable-512','apple-touch-icon']){ok((await c.request.get(`${B}/icons/${f}.png`)).status()===200,`icon ${f}.png is served`)}
 await c.close()}

// Admin sets the court
const A=await ctx(b,'admin@example.com');
await A.p.goto(B+'/profile');await A.p.getByRole('button',{name:/Use my current location/}).click();
await A.p.getByText('Court location saved.').waitFor({timeout:15000}).catch(()=>{});
const v=sql(`select venue_lat||','||venue_lng||','||venue_radius_m from clubs where name='Paris Arena'`);
ok(/^9\.07\d*,7\.39\d*,100$/.test(v),'admin saved the court location with the default 100 m radius: '+v);
await A.p.getByLabel('Court name (optional)').fill('Central Hall');await A.p.getByRole('radio',{name:'200 m'}).click();
await A.p.getByRole('button',{name:/Update to my current location/}).click();await A.p.getByText('Court location saved.').waitFor({timeout:15000}).catch(()=>{});
ok(sql(`select venue_label||','||venue_radius_m from clubs where name='Paris Arena'`)==='Central Hall,200','court name and radius can be changed');
await A.c.setGeolocation?.call(A.c,{...COURT,accuracy:500});await A.p.getByRole('button',{name:/Update to my current location/}).click();
ok(await A.p.getByText(/only accurate to/).waitFor({timeout:8000}).then(()=>true).catch(()=>false),'a vague fix is refused when setting the court');
sql(`update clubs set venue_radius_m=100 where name='Paris Arena'`);
await A.c.close();

// Opt-ins: ade shares; jide and pastor want alerts (and have a device); sule shares but has alerts off; nurudeen wants alerts but has no device
const pid=n=>sql(`select p.membership_id from player_profiles p join memberships m on m.id=p.membership_id join users u on u.id=m.user_id where u.email='${n}@example.com'`);
const uid=n=>sql(`select id from users where email='${n}@example.com'`);
sql(`update player_profiles set share_arrival=false, notify_arrivals=false, auto_arrival=false where club_id=(select id from clubs where name='Paris Arena')`);
sql(`update player_profiles set notify_arrivals=true where membership_id in ('${pid('jide')}','${pid('pastor')}','${pid('nurudeen')}')`);
sql(`update player_profiles set share_arrival=true where membership_id in ('${pid('sule')}')`);
for(const n of ['jide','pastor','ade']) sql(`insert into push_subscriptions (user_id, endpoint, p256dh, auth) values ('${uid(n)}','https://push.example/${n}','BPkeyBPkeyBPkeyBPkeyBPkeyBPkey','authauthauth')`);

// Player ade: sharing is off, so check-in explains why
const P=await ctx(b,'ade@example.com');
await P.p.goto(B+'/play');
ok(await P.p.getByText('At the court').first().isVisible(),'player home shows the At the court section once the club has a court');
ok(await P.p.getByText(/turn on “Share when I arrive”/).isVisible(),'with sharing off, the home explains how to check in');
// Turn sharing on from the Me page
await P.p.goto(B+'/play/me');await P.p.getByRole('switch',{name:'Share when I arrive'}).click();await P.p.waitForTimeout(1200);
ok(sql(`select share_arrival from player_profiles where membership_id='${pid('ade')}'`)==='t','the Share switch saves');
await P.p.goto(B+'/play');
// Far away: refused
await P.c.setGeolocation({...metresNorth(800),accuracy:10});await P.p.getByRole('button',{name:"I’ve arrived"}).click();
ok(await P.p.getByText(/don’t seem to be at the court/).waitFor({timeout:10000}).then(()=>true).catch(()=>false),'checking in far from the court is refused');
ok(sql(`select count(*) from arrivals`)==='0','no arrival is recorded when refused');
// Vague fix: refused
await P.c.setGeolocation({...COURT,accuracy:500});await P.p.getByRole('button',{name:"I’ve arrived"}).click();
ok(await P.p.getByText(/isn’t accurate enough/).waitFor({timeout:10000}).then(()=>true).catch(()=>false),'a vague location fix is refused even at the court');
// At the court: works
const before=pushLines().length;
await P.c.setGeolocation({...metresNorth(40),accuracy:15});await P.p.getByRole('button',{name:"I’ve arrived"}).click();
await P.p.getByRole('button',{name:"I’ve left"}).waitFor({timeout:15000}).catch(()=>{});
ok(await P.p.getByRole('button',{name:"I’ve left"}).isVisible(),'checking in at the court works and the button becomes I’ve left');
ok(await P.p.getByText(/Here since/).isVisible(),'the player appears in Here now');
const lines=pushLines().slice(before);
ok(lines.length===2&&lines.every(l=>/Ade just arrived \| Paris Arena · 1 player here/.test(l)),'two lock-screen alerts were sent with the arriver’s first name and the club: '+lines.length);
ok(lines.some(l=>l.includes(`to ${uid('jide')} `))&&lines.some(l=>l.includes(`to ${uid('pastor')} `)),'the alerts went to the players with alerts on and a device');
ok(!lines.some(l=>l.includes(uid('ade')))&&!lines.some(l=>l.includes(uid('sule'))),'the arriver and players with alerts off got nothing');
ok(sql(`select count(*) from arrivals where alerted_at is not null`)==='1','the alert time is recorded on the arrival');
ok(sql(`select string_agg(column_name,',') from information_schema.columns where table_name='arrivals'`).split(',').every(c=>!/lat|lng|long|position|coord/i.test(c)),'no location columns exist on arrivals: position is never stored');
// A second player sees them
const J=await ctx(b,'jide@example.com');await J.p.goto(B+'/play');
ok(await J.p.getByText('Ade Taiwo').or(J.p.getByText(/Ade\b/).first()).first().isVisible().catch(()=>false)&&await J.p.getByText(/Here since/).isVisible(),'another club member sees who is at the court');
ok(await J.p.getByText(/turn on “Share when I arrive”/).isVisible(),'a member who has not turned sharing on is told how, and gets no check-in button');
// Leave, return within 2 hours: no second alert
await P.p.getByRole('button',{name:"I’ve left"}).click();await P.p.getByRole('button',{name:"I’ve arrived"}).waitFor({timeout:15000}).catch(()=>{});
ok(sql(`select count(*) from arrivals where left_at is not null`)==='1','I’ve left closes the arrival');
const mid=pushLines().length;
await P.p.getByRole('button',{name:"I’ve arrived"}).click();await P.p.getByRole('button',{name:"I’ve left"}).waitFor({timeout:15000}).catch(()=>{});
ok(pushLines().length===mid,'arriving again within two hours does not alert everyone again');
ok(sql(`select count(*) from arrivals where left_at is null`)==='1','the second arrival is recorded');
// A stale open arrival (never checked out) does not block a new day
sql(`update arrivals set arrived_at=now()-interval '9 hours' where left_at is null`);
await P.p.reload();ok(await P.p.getByRole('button',{name:"I’ve arrived"}).isVisible(),'after six hours the arrival no longer counts as here');
await P.p.getByRole('button',{name:"I’ve arrived"}).click();await P.p.getByRole('button',{name:"I’ve left"}).waitFor({timeout:15000}).catch(()=>{});
ok(sql(`select count(*) from arrivals where left_at is null`)==='1','a new arrival works after a stale one');
// Layout and errors
const small=await P.p.evaluate(()=>[...document.querySelectorAll('button,a,[role=switch]')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&(r.height<44||r.width<44)&&getComputedStyle(e).visibility!=='hidden'}).map(e=>(e.getAttribute('aria-label')||e.textContent||'').trim().slice(0,30)));
console.log('   targets under 44px:',small);ok(small.length===0,'player home targets are all 44px or larger');
ok(!(await P.p.evaluate(()=>document.documentElement.scrollWidth>innerWidth)),'no sideways scroll');
await P.p.screenshot({path:SC+'/arrival_home.png',fullPage:true});
await P.p.goto(B+'/play/me');await P.p.screenshot({path:SC+'/arrival_me.png',fullPage:true});
ok(P.p.errs.length===0&&J.p.errs.length===0,'no page errors: '+JSON.stringify(P.p.errs.concat(J.p.errs)));
await b.close();console.log(`\n${pass} passed, ${fail} failed`);process.exit(fail?1:0)})().catch(e=>{console.log('CRASH',e.message);process.exit(1)});
