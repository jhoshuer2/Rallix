/**
 * Admin team and responsibilities end to end. The owner makes a member an admin who looks after Finance only: that admin sees only
 * the Fees area (tabs, pages, home items, Club panels), cannot open Competitions or Members, and cannot change the team. The owner then
 * adds Members, sees the change take effect, and finally removes the admin. Needs a freshly seeded DB and the club app (env: BASE, PGDB, DEV_LOG):
 *   OUT=/tmp DEV_LOG=/tmp/club.log node apps/club/e2e/team.cjs
 */
const {chromium}=require('playwright');const fs=require('fs');const {execSync}=require('child_process');
const SC=process.env.OUT||'/tmp', LOG=process.env.DEV_LOG, B=process.env.BASE||'http://localhost:3000', DB=process.env.PGDB||'rallix_dev';
const sql=q=>execSync(`PGPASSWORD=service_dev psql -h localhost -U rallix_service -d ${DB} -Atc "${q.replace(/"/g,'\\"')}"`).toString().trim();
let pass=0,fail=0;const ok=(c,m)=>{c?pass++:fail++;console.log(c?'  ok  ':'  FAIL',m)};
function code(email){const log=fs.readFileSync(LOG).toString().replace(/\0/g,'');const re=new RegExp('\\[mail:dev\\] to '+email.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+' \\|[^\\n]*\\n\\s+Your (?:Rallix|Rallix Console) sign-in code is (\\d{6})','g');const a=[...log.matchAll(re)];return a.length?a[a.length-1][1]:null}
async function who(b,email){const c=await b.newContext({viewport:{width:390,height:900}});const p=await c.newPage();p.setDefaultTimeout(60000);p.errs=[];p.on('pageerror',e=>p.errs.push(e.message));p.on('console',m=>{if(m.type()==='error'&&!/DeprecationWarning|Failed to load resource/.test(m.text()))p.errs.push(m.text().slice(0,200))});
 await p.goto(B+'/sign-in?next=/');await p.getByLabel('Email address').fill(email);await p.getByRole('button',{name:'Email me a code'}).click();await p.getByLabel('6-digit code').waitFor();await p.waitForTimeout(600);await p.getByLabel('6-digit code').fill(code(email));await p.getByRole('button',{name:'Sign in'}).click();await p.waitForURL(u=>!/sign-in/.test(u.toString()));
 await p.goto(B+'/switch/'+sql(`select id from clubs where name='Paris Arena'`));return p}
const text=async p => { await p.locator('.rx-skel').first().waitFor({ state: 'detached', timeout: 20000 }).catch(() => {}); return p.locator('body').innerText(); };
const closed=p=>p.waitForFunction(()=>!document.querySelector('dialog[open]'),null,{timeout:20000}).then(()=>p.waitForLoadState('networkidle'));
const at=async p=>{await p.waitForLoadState('networkidle');await p.waitForTimeout(500);return new URL(p.url()).pathname}; /* redirects after streaming start are client-side, so let the page settle */
const tabs=p=>p.locator('.rx-nav__item').allInnerTexts().then(a=>a.map(x=>x.trim()));
const small=async p=>p.evaluate(()=>[...document.querySelectorAll('button,a,[role=switch]')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&r.height<44&&getComputedStyle(e).visibility!=='hidden'&&!e.classList.contains('rx-btn--small')&&!e.closest('dialog:not([open])')}).map(e=>(e.getAttribute('aria-label')||e.textContent||'').trim().slice(0,28)));
const adePerms=()=>sql(`select m.roles::text||'|'||array_to_string(m.permissions,',') from memberships m join users u on u.id=m.user_id join clubs c on c.id=m.club_id where u.email='ade@example.com' and c.name='Paris Arena'`);

(async()=>{
  const b=await chromium.launch();
  const O=await who(b,'admin@example.com');
  await O.goto(B+'/profile/team');
  let t=await text(O);
  ok(/Owner/.test(t)&&/looks after everything/i.test(t),'the owner is listed with every responsibility');
  ok(await O.getByRole('button',{name:'Add an admin'}).isVisible(),'the owner can add an admin');
  // Make Ade a finance-only admin
  await O.getByRole('button',{name:'Add an admin'}).click();
  const sheet=O.locator('dialog[open]');await sheet.getByText('Ade').first().click();
  await sheet.getByRole('switch',{name:'Finance'}).click();await sheet.getByRole('button',{name:'Make admin'}).click();await closed(O);
  ok(/admin/.test(adePerms())&&/\|finance$/.test(adePerms()),'Ade is now an admin who looks after Finance only: '+adePerms());
  const smO=await small(O);ok(smO.length===0,'team page targets are 44px or larger '+JSON.stringify(smO));
  await O.screenshot({path:SC+'/team_owner.png',fullPage:true});

  // Ade sees only the Fees area
  const A=await who(b,'ade@example.com');await A.goto(B+'/');
  ok((await at(A))==='/','Ade, now an admin, lands on the admin home');
  const tb=await tabs(A);ok(tb.join(',').includes('Fees')&&!tb.join(',').includes('Members')&&!tb.join(',').includes('Competitions'),'the tabs show Home, Fees and Club only: '+tb.join(' | '));
  t=await text(A);ok(/unpaid fee/i.test(t),'home lists unpaid fees');
  ok(!/to score|wants to join|want to join|ready to start/i.test(t),'home hides other areas');
  await A.goto(B+'/competition');ok((await at(A))==='/','/competition sends a finance admin back home');
  await A.goto(B+'/competition/new');ok((await at(A))==='/','creating a competition is closed to them');
  await A.goto(B+'/members');ok((await at(A))==='/','/members is closed to them');
  await A.goto(B+'/profile/club-page');ok((await at(A))==='/','the club page editor is closed to them');
  await A.goto(B+'/membership/subscriptions');ok((await at(A))==='/membership/subscriptions','fee plans are open to them');
  await A.goto(B+'/membership/payments');ok((await at(A))==='/membership/payments','payments are open to them');
  await A.goto(B+'/profile');t=await text(A);
  ok(/Admin team/.test(t)&&!/Invite players|Court and check-in|Club pictures/.test(t)&&!/Club page/.test(t.replace(/Admin team/g,'')),'the Club menu shows only what they may do (no invite, court, pictures or club page)');
  await A.goto(B+'/profile/team');ok(!(await A.getByRole('button',{name:'Add an admin'}).count()),'they can see the team but not change it');
  ok(/Owner/.test(await text(A)),'and the team lists the owner');

  // Owner adds Members
  await O.goto(B+'/profile/team');await O.getByText('Ade').first().click();
  const s2=O.locator('dialog[open]');await s2.getByRole('switch',{name:'Members'}).click();await s2.getByRole('button',{name:'Save'}).click();await closed(O);
  ok(/finance/.test(adePerms())&&/members/.test(adePerms()),'the owner added Members: '+adePerms());
  await A.goto(B+'/members');ok((await at(A))==='/members','Ade can now open Members');
  ok((await tabs(A)).join(',').includes('Members'),'and the Members tab appears');

  // No responsibilities at all
  await O.goto(B+'/profile/team');await O.getByText('Ade').first().click();
  const s3=O.locator('dialog[open]');await s3.getByRole('switch',{name:'Members'}).click();await s3.getByRole('switch',{name:'Finance'}).click();await s3.getByRole('button',{name:'Save'}).click();await closed(O);await O.getByText(/No responsibilities yet/).waitFor({timeout:20000});
  await A.goto(B+'/');t=await text(A);ok(/Ask them to give you a responsibility|owner chooses/i.test(t),'an admin with nothing to look after is told to ask the owner');
  await A.goto(B+'/membership');ok((await at(A))==='/','and cannot open Fees either');

  // Remove
  await O.goto(B+'/profile/team');await O.getByText('Ade').first().click();await O.locator('dialog[open]').getByRole('button',{name:'Remove as admin'}).click();await closed(O);
  ok(!/admin/.test(adePerms().split('|')[0]),'removing takes the admin role away: '+adePerms());
  await A.goto(B+'/');await A.waitForURL(/\/play/,{timeout:20000});ok((await at(A))==='/play','Ade is back to the player app');
  // the owner row cannot be edited
  await O.goto(B+'/profile/team');ok((await O.locator('button.rx-lrow').count())===0||!(await O.locator('button.rx-lrow',{hasText:'Owner'}).count()),'the owner row is not editable');

  const errs=[O,A].flatMap(p=>p.errs);ok(errs.length===0,'no page errors: '+JSON.stringify(errs).slice(0,500));
  await b.close();console.log(`\n${pass} passed, ${fail} failed`);process.exit(fail?1:0)
})().catch(e=>{console.log('CRASH',e.message.split('\n')[0]);process.exit(1)});
