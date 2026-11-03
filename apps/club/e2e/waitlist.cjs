/**
 * Waitlist, sticky bar, spots and faces, share: a two-spot competition fills, the next players queue in order, a spot that opens goes to
 * the first in line, raising the limit fills from the queue, the admin sees the waitlist, the sticky bar stays at the bottom,
 * the Compete list shows spots left, and the Share row copies a link.
 *   BASE=http://localhost:3200 PGDB=rallix_2a DEV_LOG=/path/club.log node apps/club/e2e/waitlist.cjs
 */
const {chromium}=require('playwright');const fs=require('fs');const {execSync}=require('child_process');
const LOG=process.env.DEV_LOG, B=process.env.BASE||'http://localhost:3000';
const sql=q=>execSync(`PGPASSWORD=service_dev psql -h localhost -U rallix_service -d ${process.env.PGDB||'rallix_dev'} -Atc "${q.replace(/"/g,'\\"')}"`).toString().trim();
let pass=0,fail=0;const ok=(c,m)=>{c?pass++:fail++;console.log(c?'  ok  ':'  FAIL',m)};
function code(email){const log=fs.readFileSync(LOG).toString().replace(/\0/g,'');const re=new RegExp('\\[mail:dev\\] to '+email.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+' \\|[^\\n]*\\n\\s+Your (?:Rallix|Rallix Console) sign-in code is (\\d{6})','g');const a=[...log.matchAll(re)];return a.length?a[a.length-1][1]:null}
async function signIn(p,email){await p.goto(B+'/sign-in?next=/');await p.getByLabel('Email address').fill(email);await p.getByRole('button',{name:'Email me a code'}).click();await p.getByLabel('6-digit code').waitFor({timeout:60000});await p.waitForTimeout(600);await p.getByLabel('6-digit code').fill(code(email));await p.getByRole('button',{name:'Sign in'}).click();await p.waitForURL(u=>!/sign-in/.test(u.toString()),{timeout:60000});const id=sql(`select id from clubs where name='Paris Arena'`);await p.goto(B+'/switch/'+id,{waitUntil:'networkidle'})}
async function who(b,email){const c=await b.newContext({viewport:{width:440,height:956},permissions:['clipboard-read','clipboard-write']});c.setDefaultTimeout(60000);c.setDefaultNavigationTimeout(90000);const p=await c.newPage();p.errs=[];p.on('pageerror',e=>p.errs.push(e.message));await signIn(p,email);return p}
const iso=n=>new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Lagos'}).format(new Date(Date.now()+n*864e5));
const club=`(select id from clubs where name='Paris Arena')`;
let comp='';
const entries=()=>sql(`select string_agg(u.email, ',' order by e.created_at, u.email) from competition_entries e join memberships m on m.id=e.membership_id join users u on u.id=m.user_id where e.competition_id='${comp}'`).replace(/@example\.com/g,'');
const queue=()=>sql(`select coalesce(string_agg(u.email, ',' order by w.created_at, w.id),'') from competition_waitlist w join memberships m on m.id=w.membership_id join users u on u.id=m.user_id where w.competition_id='${comp}'`).replace(/@example\.com/g,'');
const open=async(p)=>{await p.goto(B+`/play/compete/${comp}`,{waitUntil:'networkidle'})};

(async()=>{const b=await chromium.launch();
comp=sql(`insert into competitions (club_id, name, format, status, open_registration, max_players, starts_on, ends_on) values (${club}, 'E2E Waitlist Cup', 'group_stage', 'draft', true, 2, '${iso(10)}', '${iso(20)}') returning id`);
const ade=await who(b,'ade@example.com'), pastor=await who(b,'pastor@example.com'), jide=await who(b,'jide@example.com'), sule=await who(b,'sule@example.com'), adm=await who(b,'admin@example.com');

// Spots left on the Compete list, then fill the competition
await pastor.goto(B+'/play/compete',{waitUntil:'networkidle'});await pastor.getByRole('radio',{name:'Upcoming'}).click();
ok(await pastor.getByText('2 spots left').isVisible(),'Compete list: "2 spots left" on an open competition');
await open(ade);
const bar=await ade.locator('.rx-stickybar').boundingBox();
ok(!!bar&&Math.abs(bar.y+bar.height-956)<2,'the action bar is fixed to the bottom of the screen');
ok(await ade.getByRole('button',{name:'Join',exact:true}).isVisible()&&await ade.locator('.rx-stickybar').getByText('2 spots left').isVisible(),'the bar has one Join button and the spots left');
await ade.getByRole('button',{name:'Join',exact:true}).click();await ade.getByText('Registered ✓').waitFor();
await open(pastor);await pastor.getByRole('button',{name:'Join',exact:true}).click();await pastor.getByText('Registered ✓').waitFor();
ok(entries()==='ade,pastor','two players are in');

// Full: queue
await open(jide);
ok(await jide.locator('.rx-stickybar').getByText('Full',{exact:true}).first().isVisible(),'the bar says Full');
ok(await jide.getByRole('button',{name:'Join waitlist'}).isVisible()&&!(await jide.getByRole('button',{name:'Join',exact:true}).count()),'the one main button is now "Join waitlist"');
await jide.getByRole('button',{name:'Join waitlist'}).click();await jide.getByText('You’re 1st in line').waitFor();
ok(queue()==='jide','Jide is first in line');
ok(await jide.getByText('On the waitlist').isVisible()&&await jide.getByRole('button',{name:'Leave waitlist'}).isVisible(),'the button shows "On the waitlist" and a quiet Leave waitlist');
await open(sule);await sule.getByRole('button',{name:'Join waitlist'}).click();await sule.getByText('You’re 2nd in line').waitFor();
ok(queue()==='jide,sule','Sule is second');
await jide.goto(B+'/play/compete',{waitUntil:'networkidle'});await jide.getByRole('radio',{name:'Upcoming'}).click();
ok(await jide.getByText('Full',{exact:true}).first().isVisible()&&await jide.getByText('Waitlist',{exact:true}).first().isVisible(),'Compete list shows Full, and tags Jide’s card "Waitlist"');

// Admin sees the queue
await adm.goto(B+`/competition/${comp}/groups`,{waitUntil:'networkidle'});
ok(await adm.getByText('Waitlist (2)').isVisible()&&await adm.getByText('Next in line').isVisible(),'the admin sees the waitlist and who is next');

// A spot opens: first in line gets it, the second moves up
await open(ade);await ade.getByRole('button',{name:'Leave competition'}).click();await ade.getByRole('button',{name:'Join waitlist'}).waitFor();
ok(entries()==='pastor,jide'&&queue()==='sule','Ade left: Jide was moved in, Sule moves to first in line');
ok(await ade.getByRole('button',{name:'Join waitlist'}).isVisible(),'Ade, who left, is now offered the waitlist (it is full again)');
await open(jide);ok(await jide.getByText('Registered ✓').isVisible(),'Jide now sees Registered');
await open(sule);ok(await sule.getByText('You’re 1st in line').isVisible(),'Sule now sees 1st in line');

// Raising the limit fills from the queue
await adm.goto(B+`/competition/${comp}/details`,{waitUntil:'networkidle'});
await adm.getByLabel('Spot limit (optional)').fill('3');await adm.getByRole('button',{name:'Save details'}).click();await adm.getByText('Saved.').waitFor();
ok(entries()==='pastor,jide,sule'&&queue()==='','raising the limit to 3 moved Sule in');
await open(sule);ok(await sule.getByText('Registered ✓').isVisible(),'Sule sees Registered');

// Leaving the waitlist
await open(ade);await ade.getByRole('button',{name:'Join waitlist'}).click();await ade.getByText('You’re 1st in line').waitFor();
await ade.getByRole('button',{name:'Leave waitlist'}).click();await ade.getByRole('button',{name:'Join waitlist'}).waitFor();
ok(queue()==='','leaving the waitlist removes you');

// Share
await open(pastor);
await pastor.getByRole('button',{name:/Share/}).click();
ok(await pastor.getByText('Link copied.').waitFor({timeout:10000}).then(()=>true).catch(()=>false),'Share copies a link when the phone has no share sheet');
const clip=await pastor.evaluate(()=>navigator.clipboard.readText()).catch(()=>'');
ok(/E2E Waitlist Cup at Paris Arena/.test(clip)&&/\/club\/[a-z0-9-]+$/.test(clip),'the copied text names the competition and links to the public club page: '+clip.slice(0,100));

// A started competition has no queue
sql(`update competitions set status='active', open_registration=false where id='${comp}'`);
await open(ade);
ok(!(await ade.getByRole('button',{name:'Join waitlist'}).count()),'no waitlist once the competition has started');

// A11y
await open(jide);
const bad=await jide.evaluate(()=>{const o=[];document.querySelectorAll('a,button,input').forEach(e=>{const r=e.getBoundingClientRect();if(r.width&&r.height&&r.height<43&&!/rx-linkbtn/.test(e.className))o.push((e.textContent||e.tagName).trim().slice(0,30)+' '+Math.round(r.height))});return o});
ok(bad.length===0,'touch targets ok '+bad.join(', '));
ok(await jide.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),'no sideways scroll');
ok([ade,pastor,jide,sule,adm].every(p=>p.errs.length===0),'no console errors '+[ade,pastor,jide,sule,adm].flatMap(p=>p.errs).join('|'));
console.log(`\n${pass} passed, ${fail} failed`);await b.close();process.exit(fail?1:0)})().catch(e=>{console.error('CRASH',e.message);process.exit(2)});
