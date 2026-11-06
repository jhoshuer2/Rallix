/**
 * Birthday and club anniversary spotlight, and where people give their details.
 * A player and an admin set a birthday (month and day only) on "Your account"; it shows to the club by default and can be hidden;
 * the club's own anniversary comes from the day it was created.
 *   scripts/e2e-run.sh prod birthdays
 */
const {chromium}=require('playwright');const fs=require('fs');const {execSync}=require('child_process');
const LOG=process.env.DEV_LOG, B=process.env.BASE||'http://localhost:3000';
const sql=q=>execSync(`PGPASSWORD=service_dev psql -h localhost -U rallix_service -d ${process.env.PGDB||'rallix_dev'} -Atc "${q.replace(/"/g,'\\"')}"`).toString().trim().split('\n')[0];
let pass=0,fail=0;const ok=(c,m)=>{c?pass++:fail++;console.log(c?'  ok  ':'  FAIL',m)};
function code(email){const log=fs.readFileSync(LOG).toString().replace(/\0/g,'');const re=new RegExp('\\[mail:dev\\] to '+email.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+' \\|[^\\n]*\\n\\s+Your (?:Rallix|Rallix Console) sign-in code is (\\d{6})','g');const a=[...log.matchAll(re)];return a.length?a[a.length-1][1]:null}
async function signIn(p,email){await p.goto(B+'/sign-in?next=/');await p.getByLabel('Email address').fill(email);await p.getByRole('button',{name:'Email me a code'}).click();await p.getByLabel('6-digit code').waitFor({timeout:60000});await p.waitForTimeout(600);await p.getByLabel('6-digit code').fill(code(email));await p.getByRole('button',{name:'Sign in'}).click();await p.waitForURL(u=>!/sign-in/.test(u.toString()),{timeout:60000});const id=sql(`select id from clubs where name='Paris Arena'`);await p.goto(B+'/switch/'+id,{waitUntil:'networkidle'})}
const body=async p=>{await p.locator('.rx-skel').first().waitFor({state:'detached',timeout:20000}).catch(()=>{});return p.locator('body').innerText()};
const club=`(select id from clubs where name='Paris Arena')`;
const todayParts=sql(`select to_char((now() at time zone 'Africa/Lagos')::date,'FMMM-FMDD')`).split('-').map(Number); // [month, day]
const [TM,TD]=todayParts;
const nameOf=e=>sql(`select name from users where email='${e}'`);
const strip=async p=>{await p.goto(B+'/play',{waitUntil:'networkidle'});await body(p);return p.locator('.rx-celebs').count().then(async n=>n?p.locator('.rx-celebs').innerText():'')};

(async()=>{const b=await chromium.launch();
const mk=async()=>{const c=await b.newContext({viewport:{width:440,height:956}});c.setDefaultTimeout(60000);c.setDefaultNavigationTimeout(90000);return {c,p:await c.newPage()}};
const A=await mk(), J=await mk(), AD=await mk();const errs=[];A.p.on('pageerror',e=>errs.push(e.message));
await signIn(A.p,'ade@example.com');await signIn(J.p,'jide@example.com');
const ade=nameOf('ade@example.com'), adminName=nameOf('admin@example.com');
sql(`update player_profiles set date_of_birth=null, show_birthday=true where club_id=${club}`);
sql(`update clubs set created_at = now() - interval '200 days' where id=${club}`);

// Nothing yet
ok(!/Birthday today/.test(await strip(J.p)),'with no birthdays set, the strip has no birthday');

// Player gives a birthday
await A.p.goto(B+'/play/me',{waitUntil:'networkidle'});
ok(/Your account/.test(await body(A.p)),'Me has a "Your account" row');
await A.p.goto(B+'/play/me/account',{waitUntil:'networkidle'});
ok(await A.p.getByRole('heading',{name:'Birthday'}).isVisible()||/Birthday/.test(await body(A.p)),'the account page has a Birthday section');
ok(await A.p.getByRole('switch',{name:'Show my birthday to the club'}).getAttribute('aria-checked')==='true','"Show my birthday to the club" is on by default');
await A.p.getByRole('button',{name:'Save birthday'}).click();
ok(/Choose a month and a day/.test(await body(A.p)),'saving with nothing chosen asks for a month and a day');
await A.p.getByLabel('Month').selectOption('2');await A.p.getByLabel('Day').selectOption('30');
await A.p.getByRole('button',{name:'Save birthday'}).click();
ok(await A.p.getByText(/doesn.t exist/).waitFor({timeout:20000}).then(()=>true).catch(()=>false),'30 February is refused in plain words');
await A.p.getByLabel('Month').selectOption(String(TM));await A.p.getByLabel('Day').selectOption(String(TD));
await A.p.getByRole('button',{name:'Save birthday'}).click();
await A.p.getByRole('status').filter({hasText:/Birthday saved/}).waitFor({timeout:20000});
ok(/Carry on with what you were doing/.test(await A.p.getByRole('status').filter({hasText:/Birthday saved/}).innerText()),'a message says it is saved and to carry on');
const dob=sql(`select date_of_birth::text||'|'||show_birthday from player_profiles p join memberships m on m.id=p.membership_id join users u on u.id=m.user_id where u.email='ade@example.com' and m.club_id=${club}`);
ok(dob===`1904-${String(TM).padStart(2,'0')}-${String(TD).padStart(2,'0')}|true`,'saved as month and day only (no year), shown: '+dob);

// The club sees it
const s1=await strip(J.p);
ok(/Birthday today/.test(s1)&&s1.includes(ade.split(' ')[0]),'another member sees "Birthday today" for them in the club updates');
ok(!/\b(19|20)\d\d\b/.test(s1)&&!/\b\d{2} years old\b/i.test(s1),'no year or age is shown');

// Hide it
await A.p.goto(B+'/play/me/account',{waitUntil:'networkidle'});
await A.p.getByRole('switch',{name:'Show my birthday to the club'}).click();
await A.p.getByRole('button',{name:'Save birthday'}).click();
await A.p.getByRole('status').filter({hasText:/hidden from the club/}).waitFor({timeout:20000});
ok(!/Birthday today/.test(await strip(J.p)),'switched off: the club no longer sees it');
ok(sql(`select show_birthday from player_profiles p join memberships m on m.id=p.membership_id join users u on u.id=m.user_id where u.email='ade@example.com' and m.club_id=${club}`)==='f','the birthday is kept but hidden');

// Remove it
await A.p.goto(B+'/play/me/account',{waitUntil:'networkidle'});
await A.p.getByRole('button',{name:'Remove my birthday'}).click();
await A.p.getByRole('status').filter({hasText:/Birthday removed/}).waitFor({timeout:20000});
ok(sql(`select date_of_birth is null from player_profiles p join memberships m on m.id=p.membership_id join users u on u.id=m.user_id where u.email='ade@example.com' and m.club_id=${club}`)==='t','"Remove my birthday" clears it');

// The admin gives theirs
await signIn(AD.p,'admin@example.com');
await AD.p.goto(B+'/profile',{waitUntil:'networkidle'});
ok(/Your account/.test(await body(AD.p)),'the admin Club page has "Your account"');
await AD.p.goto(B+'/profile/account',{waitUntil:'networkidle'});
await AD.p.getByLabel('Month').selectOption(String(TM));await AD.p.getByLabel('Day').selectOption(String(TD));
await AD.p.getByRole('button',{name:'Save birthday'}).click();
await AD.p.getByRole('status').filter({hasText:/Birthday saved/}).waitFor({timeout:20000});
const s2=await strip(J.p);
ok(/Birthday today/.test(s2)&&s2.includes(adminName.split(' ')[0]),'the admin\'s birthday shows to the club too');
ok(!/Joined today|New in the club/.test(s2.split(adminName.split(' ')[0])[1]||''),'an admin gets a birthday tile but not a "new member" tile');

// Club anniversary from the creation date
sql(`update clubs set created_at = (now() at time zone 'Africa/Lagos')::date - interval '3 years' + interval '10 hours' where id=${club}`);
const s3=await strip(J.p);
ok(/Paris Arena/.test(s3)&&/3-year anniversary today/.test(s3),'on the club\'s creation day the strip says "3-year anniversary today"');
await J.p.goto(B+'/play/updates',{waitUntil:'networkidle'});
const up=await body(J.p);
ok(/Today/.test(up)&&/Paris Arena/.test(up)&&/3-year anniversary today/.test(up),'"See all" lists it under Today');
sql(`update clubs set created_at = now() - interval '200 days' where id=${club}`);
ok(!/anniversary/.test(await strip(J.p)),'a club under a year old has no anniversary');

// Getting started (a player with no matches)
const fresh=sql(`select u.email from users u join memberships m on m.user_id=u.id where m.club_id=${club} and 'player'=ANY(m.roles) and not exists (select 1 from matches x where x.player1_id=m.id or x.player2_id=m.id) limit 1`);
if(fresh){const F=await mk();await signIn(F.p,fresh);await F.p.goto(B+'/play',{waitUntil:'networkidle'});ok(/Add your birthday/.test(await body(F.p)),'a new player\'s Getting started list includes "Add your birthday"')}

// Tap targets and layout
await A.p.goto(B+'/play/me/account',{waitUntil:'networkidle'});
const small=await A.p.evaluate(()=>[...document.querySelectorAll('button,a,select,input')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&r.height<44}).map(e=>e.tagName+':'+(e.getAttribute('aria-label')||e.textContent||'').slice(0,20)));
ok(small.length===0,'every control on the account page is at least 44px tall '+small.join(','));
ok(!(await A.p.evaluate(()=>document.documentElement.scrollWidth>innerWidth)),'no sideways scroll');
ok(errs.length===0,'no console errors '+errs.join('|'));
console.log(`\n${pass} passed, ${fail} failed`);await b.close();process.exit(fail?1:0)})().catch(e=>{console.error('CRASH',e.message);process.exit(2)});
