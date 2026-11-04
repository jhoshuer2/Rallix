/**
 * Attendance end-to-end: member card QR (decoded from a screenshot, carries this club and member, rotates), door check-in by name,
 * here-now list, check-out, history, scanner opens, permissions (finance-only admin and players are kept out).
 * The camera scan itself is not exercised (headless has no real camera); token verification is covered by unit tests.
 *   BASE=http://localhost:3200 PGDB=rallix_2a DEV_LOG=/path/club.log node apps/club/e2e/attendance.cjs
 */
const {chromium}=require('playwright');const fs=require('fs');const path=require('path');const {execSync}=require('child_process');
const root=path.resolve(__dirname,'../../..');
const sharp=require(require.resolve('sharp',{paths:[root+'/packages/media',root+'/apps/club']}));
const jsQR=require(require.resolve('jsqr',{paths:[root+'/apps/club']}));
const LOG=process.env.DEV_LOG, B=process.env.BASE||'http://localhost:3000';
const sql=q=>execSync(`PGPASSWORD=service_dev psql -h localhost -U rallix_service -d ${process.env.PGDB||'rallix_dev'} -Atc "${q.replace(/"/g,'\\"')}"`).toString().trim();
let pass=0,fail=0;const ok=(c,m)=>{c?pass++:fail++;console.log(c?'  ok  ':'  FAIL',m)};
function code(email){const log=fs.readFileSync(LOG).toString().replace(/\0/g,'');const re=new RegExp('\\[mail:dev\\] to '+email.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+' \\|[^\\n]*\\n\\s+Your (?:Rallix|Rallix Console) sign-in code is (\\d{6})','g');const a=[...log.matchAll(re)];return a.length?a[a.length-1][1]:null}
async function signIn(p,email){await p.goto(B+'/sign-in?next=/');await p.getByLabel('Email address').fill(email);await p.getByRole('button',{name:'Email me a code'}).click();await p.getByLabel('6-digit code').waitFor({timeout:60000});await p.waitForTimeout(600);await p.getByLabel('6-digit code').fill(code(email));await p.getByRole('button',{name:'Sign in'}).click();await p.waitForURL(u=>!/sign-in/.test(u.toString()),{timeout:60000});const id=sql(`select id from clubs where name='Paris Arena'`);await p.goto(B+'/switch/'+id,{waitUntil:'networkidle'})}
async function who(b,email){const c=await b.newContext({viewport:{width:440,height:956},permissions:['camera']});c.setDefaultTimeout(60000);const p=await c.newPage();p.errs=[];p.on('pageerror',e=>p.errs.push(e.message));await signIn(p,email);return {c,p}}
const club=`(select id from clubs where name='Paris Arena')`;
const mid=n=>sql(`select m.id from memberships m join users u on u.id=m.user_id where u.email='${n}@example.com' and m.club_id=${club}`);
async function decodeQr(p){const png=await p.locator('svg[aria-label="Your member card QR code"]').screenshot();const {data,info}=await sharp(png).ensureAlpha().raw().toBuffer({resolveWithObject:true});const r=jsQR(new Uint8ClampedArray(data),info.width,info.height);return r?r.data:null}

(async()=>{const b=await chromium.launch({args:['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream']});
sql(`delete from arrivals where club_id=${club}`);
const admin=await who(b,'admin@example.com'), ade=await who(b,'ade@example.com'), jide=await who(b,'jide@example.com');

// Member card
await ade.p.goto(B+'/play/me',{waitUntil:'networkidle'});
await ade.p.getByRole('link',{name:/Member card/}).click();await ade.p.waitForURL(/play\/card/);
await ade.p.locator('svg[aria-label="Your member card QR code"]').waitFor();
ok(await ade.p.getByText(/Paris Arena · /).isVisible(),'card shows the club and standing');
const t1=await decodeQr(ade.p);
ok(!!t1&&t1.startsWith('rx1.'),'the QR decodes to a card token');
ok(t1&&t1.includes(sql(`select id from clubs where name='Paris Arena'`))&&t1.includes(mid('ade')),'the token names this club and this member');
ok(await ade.p.getByText('Show this at the door. It refreshes every minute.').isVisible(),'honest caption about refreshing');
await ade.p.waitForTimeout((60-new Date().getSeconds())*1000+10000); // cross the next minute boundary: the token is tied to the clock minute
const t2=await decodeQr(ade.p);
ok(!!t2&&t2!==t1&&t2.startsWith('rx1.'),'the QR changed once the minute changed');

// Admin: attendance
await admin.p.goto(B+'/members',{waitUntil:'networkidle'});
await admin.p.getByRole('link',{name:/Attendance/}).click();await admin.p.waitForURL(/members\/attendance/);
ok(await admin.p.getByText('Nobody checked in').isVisible(),'empty: nobody is here');
ok(await admin.p.getByRole('button',{name:'Scan a card'}).isVisible()&&await admin.p.getByRole('button',{name:'Check in by name'}).isVisible(),'two clear ways to check someone in');

// Check in by name
await admin.p.getByRole('button',{name:'Check in by name'}).click();
await admin.p.getByLabel('Search members').fill('Ade');
await admin.p.getByRole('button',{name:/^Ade/}).first().click();
await admin.p.getByText('Here now · 1').waitFor();
ok(sql(`select method||'|'||(left_at is null) from arrivals where membership_id='${mid('ade')}'`)==='door|true','Ade is checked in at the door');
ok(await admin.p.getByText(/at the door/).isVisible(),'the list says it was at the door');
// Repeat is harmless
await admin.p.getByRole('button',{name:'Check in by name'}).click();await admin.p.getByLabel('Search members').fill('Ade');
ok(await admin.p.getByText('Already here').isVisible(),'the picker marks Ade as already here');
await admin.p.keyboard.press('Escape');
ok(sql(`select count(*) from arrivals where membership_id='${mid('ade')}'`)==='1','still one arrival');

// Player home shows them (existing "here now" data)
sql(`insert into arrivals (club_id, membership_id, method, arrived_at) values (${club}, '${mid('jide')}', 'manual', now() - interval '1 day')`);
sql(`update arrivals set left_at = arrived_at + interval '2 hours' where membership_id='${mid('jide')}'`);
await admin.p.reload({waitUntil:'networkidle'});
ok(await admin.p.getByText('Last 14 days').isVisible(),'history appears once there are visits');
ok(await admin.p.getByText('Most regular').isVisible(),'most regular list appears');

// Check out
await admin.p.getByRole('button',{name:/Check out Ade/}).click();await admin.p.getByText('Nobody checked in').waitFor();
ok(sql(`select count(*) from arrivals where membership_id='${mid('ade')}' and left_at is not null`)==='1','Ade is checked out');

// Scanner opens (fake camera) and has a fallback message path
await admin.p.getByRole('button',{name:'Scan a card'}).click();
ok(await admin.p.locator('video[aria-label="Camera view for scanning a member card"]').waitFor({timeout:15000}).then(()=>true).catch(()=>false),'the scanner opens the camera view');
await admin.p.keyboard.press('Escape');

// Permissions
sql(`update memberships set roles=ARRAY['admin','player']::member_role[], permissions=ARRAY['finance']::text[] where user_id=(select id from users where email='pastor@example.com') and club_id=${club}`);
const fin=await who(b,'pastor@example.com');
await fin.p.goto(B+'/members/attendance',{waitUntil:'networkidle'});
ok(!/members\/attendance/.test(fin.p.url()),'finance-only admin cannot open attendance: '+fin.p.url());
await jide.p.goto(B+'/members/attendance',{waitUntil:'networkidle'});
ok(!/members\/attendance/.test(jide.p.url()),'a player cannot open attendance');
sql(`update memberships set roles=ARRAY['player']::member_role[], permissions='{}' where user_id=(select id from users where email='pastor@example.com') and club_id=${club}`);

// A11y
await admin.p.goto(B+'/members/attendance',{waitUntil:'networkidle'});
for(const [n,p] of [['admin',admin.p],['ade card',ade.p]]){ if(n==='ade card')await p.goto(B+'/play/card',{waitUntil:'networkidle'});
  const bad=await p.evaluate(()=>{const o=[];document.querySelectorAll('a,button,input').forEach(e=>{const r=e.getBoundingClientRect();if(r.width&&r.height&&r.height<43&&!/rx-linkbtn/.test(e.className))o.push((e.textContent||e.tagName).trim().slice(0,30)+' '+Math.round(r.height))});return o});
  ok(bad.length===0,`${n}: touch targets ok ${bad.join(', ')}`);
  ok(await p.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),`${n}: no sideways scroll`)}
ok(admin.p.errs.length===0&&ade.p.errs.length===0,'no console errors '+admin.p.errs.concat(ade.p.errs).join('|'));
console.log(`\n${pass} passed, ${fail} failed`);await b.close();process.exit(fail?1:0)})().catch(e=>{console.error('CRASH',e.message);process.exit(2)});
