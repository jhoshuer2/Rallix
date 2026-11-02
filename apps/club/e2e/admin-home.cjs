/**
 * Club admin (premium layer) end-to-end: Home, Members (search), Competition, Membership, plus empty states for a club with no data.
 * Checks: no sideways page scroll, 44px targets, text diet, reduced motion, no console errors. Screenshots go to $OUT.
 * Needs a freshly seeded DB and the club app running:  OUT=/tmp DEV_LOG=/tmp/club.log node apps/club/e2e/admin-home.cjs
 */
const {chromium}=require('playwright');const fs=require('fs');const {execSync}=require('child_process');
const SC=process.env.OUT||'/tmp', LOG=process.env.DEV_LOG, B='http://localhost:3000';
const sql=q=>execSync(`PGPASSWORD=service_dev psql -h localhost -U rallix_service -d rallix_dev -Atc "${q.replace(/"/g,'\\"')}"`).toString().trim();
let pass=0,fail=0;const ok=(c,m)=>{c?pass++:fail++;console.log(c?'  ok  ':'  FAIL',m)};
function code(email){const log=fs.readFileSync(LOG).toString().replace(/\0/g,'');const re=new RegExp('\\[mail:dev\\] to '+email.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+' \\|[^\\n]*\\n\\s+Your (?:Rallix|Rallix Console) sign-in code is (\\d{6})','g');const a=[...log.matchAll(re)];return a.length?a[a.length-1][1]:null}
async function signIn(p,email,club){await p.goto(B+'/sign-in?next=/');await p.getByLabel('Email address').fill(email);await p.getByRole('button',{name:'Email me a code'}).click();await p.getByLabel('6-digit code').waitFor({timeout:25000});await p.waitForTimeout(600);await p.getByLabel('6-digit code').fill(code(email));await p.getByRole('button',{name:'Sign in'}).click();await p.waitForURL(u=>!/sign-in/.test(u.toString()),{timeout:25000});const id=sql(`select id from clubs where name='${club}'`);await p.goto(B+'/switch/'+id)}
async function checkPage(p,name,path,{maxWords=140}={}){
  await p.goto(B+path);await p.waitForLoadState('networkidle');
  const t=await p.locator('body').innerText();const words=t.split(/\s+/).filter(Boolean).length;
  console.log(`${name}: ${words} visible words`);
  ok(words<=maxWords,`${name}: text diet (<=${maxWords} words)`);
  ok(await p.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth),`${name}: no sideways page scroll`);
  const small=await p.evaluate(()=>[...document.querySelectorAll('a,button,input')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&(r.height<44)&&!e.closest('.rx-carousel')&&!e.classList.contains('rx-btn--small')&&getComputedStyle(e).visibility!=='hidden'}).map(e=>(e.getAttribute('aria-label')||e.textContent||e.placeholder||'').trim().slice(0,24)+' '+Math.round(e.getBoundingClientRect().height)));
  ok(small.length===0,`${name}: targets at least 44px high ${JSON.stringify(small)}`);
  await p.screenshot({path:`${SC}/admin_${name}.png`,fullPage:true});
  return t;
}
(async()=>{const b=await chromium.launch();
for(const mode of ['no-preference','reduce']){
 console.log('motion:',mode);
 const c=await b.newContext({viewport:{width:440,height:956},reducedMotion:mode});const p=await c.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error'&&!/DeprecationWarning/.test(m.text()))errs.push(m.text())});
 await signIn(p,'admin@example.com','Paris Arena');
 let t=await checkPage(p,'home','/',{maxWords:200});ok(/Paris Arena/i.test(t),'home: club name shown');ok(/₦/.test(t),'home: revenue figure shown');
 t=await checkPage(p,'members','/members');ok(/Members/i.test(t),'members: title');
 await p.getByLabel('Search members').fill('zzzz');ok(/No one matches/.test(await p.locator('body').innerText()),'members: search with no match says so');
 await p.getByLabel('Search members').fill('ade');await p.waitForTimeout(200);ok(await p.locator('.rx-mcard').count()>=1,'members: search finds Ade');
 await checkPage(p,'competition','/competition');
 t=await checkPage(p,'membership','/membership');ok(/Payments/.test(t)&&/Reminders/.test(t),'membership: tiles present');
 ok(errs.length===0,'no console errors '+JSON.stringify(errs.slice(0,2)));await c.close();
}
// empty club: a brand-new admin creates a club through onboarding and has no members, matches or competitions yet
const c=await b.newContext({viewport:{width:440,height:956}});const p=await c.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto(B+'/sign-in?next=/');await p.getByLabel('Email address').fill('empty-admin@example.com');await p.getByRole('button',{name:'Email me a code'}).click();await p.getByLabel('6-digit code').waitFor({timeout:25000});await p.waitForTimeout(600);await p.getByLabel('6-digit code').fill(code('empty-admin@example.com'));await p.getByRole('button',{name:'Sign in'}).click();
await p.getByLabel('What is your club called?').waitFor({timeout:25000});await p.waitForLoadState('networkidle');await p.waitForTimeout(1500);await p.getByLabel('What is your club called?').fill('Empty Club');await p.getByLabel(/your name/i).fill('Empty Admin');await p.getByLabel('Where are you located').fill('Lagos');await p.getByRole('button',{name:'Create my club'}).click();
await p.waitForURL(u=>!/onboarding/.test(u.toString()),{timeout:25000});await p.waitForLoadState('networkidle');
let t=await checkPage(p,'empty_home','/',{maxWords:100});ok(/No competitions yet/i.test(t),'empty home: invites the admin to start a competition');
t=await checkPage(p,'empty_members','/members',{maxWords:60});ok(/invite/i.test(t),'empty members: invite action is present');
t=await checkPage(p,'empty_competition','/competition',{maxWords:60});ok(/Create a competition/i.test(t),'empty competition: one clear action');
ok(errs.length===0,'empty club: no uncaught errors');
console.log(`\n${pass} passed, ${fail} failed`);await b.close()})().catch(e=>{console.log('CRASH',e.message);process.exit(1)});
