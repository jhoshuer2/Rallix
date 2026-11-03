/**
 * Facilities end-to-end: the Facilities admin lists tables, bats and balls, changes stock (logged, never negative), logs upkeep,
 * flags a table out of service; Home shows "needs attention" only to that admin; other admins and players cannot reach it.
 *   BASE=http://localhost:3200 PGDB=rallix_2a DEV_LOG=/path/club.log node apps/club/e2e/facilities.cjs
 */
const {chromium}=require('playwright');const fs=require('fs');const {execSync}=require('child_process');
const LOG=process.env.DEV_LOG, B=process.env.BASE||'http://localhost:3000';
const sql=q=>execSync(`PGPASSWORD=service_dev psql -h localhost -U rallix_service -d ${process.env.PGDB||'rallix_dev'} -Atc "${q.replace(/"/g,'\\"')}"`).toString().trim();
let pass=0,fail=0;const ok=(c,m)=>{c?pass++:fail++;console.log(c?'  ok  ':'  FAIL',m)};
function code(email){const log=fs.readFileSync(LOG).toString().replace(/\0/g,'');const re=new RegExp('\\[mail:dev\\] to '+email.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+' \\|[^\\n]*\\n\\s+Your (?:Rallix|Rallix Console) sign-in code is (\\d{6})','g');const a=[...log.matchAll(re)];return a.length?a[a.length-1][1]:null}
async function signIn(p,email){await p.goto(B+'/sign-in?next=/');await p.getByLabel('Email address').fill(email);await p.getByRole('button',{name:'Email me a code'}).click();await p.getByLabel('6-digit code').waitFor({timeout:60000});await p.waitForTimeout(600);await p.getByLabel('6-digit code').fill(code(email));await p.getByRole('button',{name:'Sign in'}).click();await p.waitForURL(u=>!/sign-in/.test(u.toString()),{timeout:60000});const id=sql(`select id from clubs where name='Paris Arena'`);await p.goto(B+'/switch/'+id,{waitUntil:'networkidle'})}
async function who(b,email){const c=await b.newContext({viewport:{width:440,height:956}});c.setDefaultTimeout(60000);const p=await c.newPage();p.errs=[];p.on('pageerror',e=>p.errs.push(e.message));await signIn(p,email);return {c,p}}
const club=`(select id from clubs where name='Paris Arena')`;

(async()=>{const b=await chromium.launch();
sql(`delete from facility_items where club_id=${club}`);
const admin=await who(b,'admin@example.com'), ade=await who(b,'ade@example.com');

await admin.p.goto(B+'/profile',{waitUntil:'networkidle'});
await admin.p.getByRole('link',{name:/Facilities/}).click();await admin.p.waitForURL(/profile\/facilities/);
ok(await admin.p.getByText('Nothing added yet').isVisible(),'empty state');
ok(await admin.p.getByRole('button',{name:'Add an item'}).count()===1,'one add button while empty');

// A table, and balls with a warning level
await admin.p.getByRole('button',{name:'Add an item'}).click();
await admin.p.getByLabel('Name').fill('Table 1');await admin.p.getByRole('button',{name:'Save'}).click();await admin.p.getByText('Table 1').waitFor();
await admin.p.getByRole('button',{name:'Add an item'}).click();
await admin.p.getByRole('radio',{name:'Ball'}).click();
await admin.p.getByLabel('Name').fill('Training balls');await admin.p.getByLabel('How many').fill('6');await admin.p.getByLabel('Warn me below (optional)').fill('5');
await admin.p.getByRole('button',{name:'Save'}).click();await admin.p.getByText('Training balls').waitFor();
ok(sql(`select count(*) from facility_items where club_id=${club}`)==='2','two items saved');
ok(!(await admin.p.getByText('Running low').count()),'6 in stock with a warning at 5: no alert yet');

// Stock down: logged, then below the warning level
await admin.p.getByText('Training balls').click();await admin.p.getByText('In stock: 6').waitFor();
await admin.p.getByRole('button',{name:'Take one out'}).click();await admin.p.getByText('In stock: 5').waitFor();
await admin.p.getByRole('button',{name:'Take one out'}).click();await admin.p.getByText('In stock: 4').waitFor();
ok(sql(`select quantity from facility_items where name='Training balls'`)==='4','stock is 4 in the database');
ok(sql(`select count(*)||'|'||sum(delta) from facility_log where kind='stock'`)==='2|-2','each change is logged');
ok(await admin.p.getByText('-1 in stock').first().isVisible(),'history shows the change');
// Upkeep line
await admin.p.getByLabel('Log upkeep').fill('Ordered a new box');await admin.p.getByRole('button',{name:'Add to history'}).click();await admin.p.getByText('Ordered a new box').waitFor();
ok(sql(`select count(*) from facility_log where kind='maintenance' and created_by is not null`)==='1','upkeep line saved with the admin as author');
await admin.p.keyboard.press('Escape');await admin.p.reload({waitUntil:'networkidle'});
ok(await admin.p.getByText('Running low').isVisible(),'Balls show "Running low" below the warning level');

// Never below zero
sql(`update facility_items set quantity=0 where name='Training balls'`);
await admin.p.reload({waitUntil:'networkidle'});await admin.p.getByText('Training balls').click();
ok(await admin.p.getByRole('button',{name:'Take one out'}).isDisabled(),'cannot take one out at zero');
await admin.p.keyboard.press('Escape');

// Table out of service
await admin.p.getByText('Table 1').click();await admin.p.getByRole('radio',{name:'Out of service'}).click();await admin.p.getByRole('button',{name:'Save'}).click();
for(let k=0;k<40&&sql(`select status from facility_items where name='Table 1'`)!=='out';k++)await admin.p.waitForTimeout(250);
ok(sql(`select status from facility_items where name='Table 1'`)==='out','table is out of service');

// Home: needs attention (admin only)
await admin.p.goto(B+'/',{waitUntil:'networkidle'});
ok(await admin.p.getByText(/2 items need attention/).isVisible(),'admin Home: "2 items need attention"');
await admin.p.getByText(/2 items need attention/).click();await admin.p.waitForURL(/profile\/facilities/);

// Access
sql(`update memberships set roles=ARRAY['admin','player']::member_role[], permissions=ARRAY['finance']::text[] where user_id=(select id from users where email='pastor@example.com') and club_id=${club}`);
const fin=await who(b,'pastor@example.com');
await fin.p.goto(B+'/profile/facilities',{waitUntil:'networkidle'});
ok(!/profile\/facilities/.test(fin.p.url()),'finance-only admin is sent away: '+fin.p.url());
await fin.p.goto(B+'/',{waitUntil:'networkidle'});
ok(!(await fin.p.getByText(/items? needs? attention/).count()),'finance-only admin does not see facility alerts');
await ade.p.goto(B+'/profile/facilities',{waitUntil:'networkidle'});
ok(!/profile\/facilities/.test(ade.p.url()),'a player is sent away');
sql(`update memberships set roles=ARRAY['player']::member_role[], permissions='{}' where user_id=(select id from users where email='pastor@example.com') and club_id=${club}`);

// Delete
await admin.p.goto(B+'/profile/facilities',{waitUntil:'networkidle'});
await admin.p.getByText('Table 1').click();await admin.p.getByRole('button',{name:'Delete item'}).click();await admin.p.waitForTimeout(1500);
ok(sql(`select count(*) from facility_items where name='Table 1'`)==='0','delete works');

// A11y
await admin.p.goto(B+'/profile/facilities',{waitUntil:'networkidle'});
const bad=await admin.p.evaluate(()=>{const o=[];document.querySelectorAll('a,button,input').forEach(e=>{const r=e.getBoundingClientRect();if(r.width&&r.height&&r.height<43)o.push((e.textContent||e.tagName).trim().slice(0,30)+' '+Math.round(r.height))});return o});
ok(bad.length===0,'touch targets ok '+bad.join(', '));
ok(await admin.p.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),'no sideways scroll');
ok(admin.p.errs.length===0&&fin.p.errs.length===0,'no console errors '+admin.p.errs.concat(fin.p.errs).join('|'));
console.log(`\n${pass} passed, ${fail} failed`);await b.close();process.exit(fail?1:0)})().catch(e=>{console.error('CRASH',e.message);process.exit(2)});
