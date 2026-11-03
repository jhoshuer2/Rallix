/**
 * Design-system crawler: signs in as a player and as the admin of the seeded club, visits every listed route at phone width,
 * and checks the rules from .claude/skills/rallix-premium-ui: no sideways page scroll, 44px targets, text diet, no console errors.
 * Screenshots go to $OUT/screen_<role>_<name>.png.
 * Needs a freshly seeded DB and the club app running:  OUT=/tmp DEV_LOG=/tmp/club.log node apps/club/e2e/screens.cjs
 */
const {chromium}=require('playwright');const fs=require('fs');const {execSync}=require('child_process');
const SC=process.env.OUT||'/tmp', LOG=process.env.DEV_LOG, B=process.env.BASE||'http://localhost:3000';
const sql=q=>execSync(`PGPASSWORD=service_dev psql -h localhost -U rallix_service -d ${process.env.PGDB||'rallix_dev'} -Atc "${q.replace(/"/g,'\\"')}"`).toString().trim();
let pass=0,fail=0;const ok=(c,m)=>{c?pass++:fail++;console.log(c?'  ok  ':'  FAIL',m)};
function code(email){const log=fs.readFileSync(LOG).toString().replace(/\0/g,'');const re=new RegExp('\\[mail:dev\\] to '+email.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+' \\|[^\\n]*\\n\\s+Your (?:Rallix|Rallix Console) sign-in code is (\\d{6})','g');const a=[...log.matchAll(re)];return a.length?a[a.length-1][1]:null}
async function signIn(p,email){await p.goto(B+'/sign-in?next=/');await p.getByLabel('Email address').fill(email);await p.getByRole('button',{name:'Email me a code'}).click();await p.getByLabel('6-digit code').waitFor({timeout:25000});await p.waitForTimeout(600);await p.getByLabel('6-digit code').fill(code(email));await p.getByRole('button',{name:'Sign in'}).click();await p.waitForURL(u=>!/sign-in/.test(u.toString()),{timeout:25000});await p.goto(B+'/switch/'+sql("select id from clubs where name='Paris Arena'"))}
const ids={comp:()=>sql("select id from competitions limit 1"),match:()=>sql("select id from matches where status='completed' limit 1"),member:()=>sql("select m.id from memberships m join users u on u.id=m.user_id where u.email='sule@example.com' and m.club_id=(select id from clubs where name='Paris Arena')")};
const PLAYER=[['home','/play'],['compete','/play/compete'],['ranks','/play/ranks'],['stats','/play/stats'],['me','/play/me'],['payments','/play/me/payments'],['friendlies','/play/friendlies'],['comp','/play/compete/{comp}'],['match','/play/compete/{comp}/match/{match}']];
const ADMIN=[['home','/'],['members','/members'],['competition','/competition'],['membership','/membership'],['profile','/profile'],['club-page','/profile/club-page'],['team','/profile/team'],['invite','/profile/invite'],['pictures','/profile/pictures'],['court','/profile/court'],['me','/profile/me'],
 ['member','/members/{member}'],['payments','/membership/payments'],['plans','/membership/subscriptions'],['payouts','/membership/payouts'],['rallix','/membership/rallix'],['reminders','/membership/reminders'],
 ['new-level','/competition/new'],['new-pick','/competition/new/junior'],['new-form','/competition/new/junior/auto?manual=1'],['groups','/competition/{comp}/groups'],['results','/competition/{comp}/bracket']];
const PUBLIC=[['sign-in','/sign-in'],['welcome','/welcome'],['pay-link','/pay/invoice/{token}'],['pay-link-bad','/pay/invoice/not-a-real-token'],['unsubscribe-bad','/unsubscribe/nope']];
async function crawl(p,role,routes,errs,max){
  for(const [name,path0] of routes){
    const path=path0.replace('{token}',PAYTOKEN).replace('{comp}',ids.comp()).replace('{match}',ids.match()).replace('{member}',ids.member());
    await p.goto(B+path);await p.waitForLoadState('networkidle');await p.waitForTimeout(250);
    const words=(await p.locator('body').innerText()).split(/\s+/).filter(Boolean).length;
    const noscroll=await p.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth);
    const small=await p.evaluate(()=>[...document.querySelectorAll('a,button,input,select')].filter(e=>{const r=e.getBoundingClientRect();const cs=getComputedStyle(e);return r.width>0&&r.height>0&&r.height<44&&!e.closest('.rx-carousel')&&!e.classList.contains('rx-btn--small')&&cs.visibility!=='hidden'&&e.type!=='checkbox'&&e.type!=='hidden'}).map(e=>(e.getAttribute('aria-label')||e.textContent||'').trim().slice(0,22)+' '+Math.round(e.getBoundingClientRect().height)));
    const legacy=await p.evaluate(()=>['rx-card','rx-format','rx-promo','rx-rank','rx-stats','rx-match','rx-pays','rx-pay'].filter(c=>document.querySelector('.'+c+':not(.rx-lgroup)')));
    if(name==='home'){const t=await p.locator('body').innerText();if(role==='player')ok(/Birthday today/.test(t)&&/Birthday yesterday/.test(t)&&/2-year anniversary tomorrow/.test(t),`${role}/home: celebrations show birthdays and the anniversary`);ok(!/1994|\b3[0-9] years\b/.test(t),`${role}/home: no birth year or age shown`)}
    ok(noscroll,`${role}/${name}: no sideways scroll`);ok(small.length===0,`${role}/${name}: 44px targets ${JSON.stringify(small)}`);const cap=({"player/me":190,"player/comp":240})[`${role}/${name}`]||max; ok(words<=cap,`${role}/${name}: ${words} words (max ${cap})`);ok(legacy.length===0,`${role}/${name}: no legacy card classes ${JSON.stringify(legacy)}`);
    await p.screenshot({path:`${SC}/screen_${role}_${name}.png`,fullPage:true});
  }
}
let PAYTOKEN='ABCDEFGHJKMNPQRSTUVWXYZ2';
function seedCelebrations(){ // give a few seeded players birthdays and a club anniversary around today so the strip has something to show
  const day=(off)=>{const d=new Date(Date.now()+off*86400000);return new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Lagos',year:'numeric',month:'2-digit',day:'2-digit'}).format(d)};
  const dob=(off,yr)=>yr+day(off).slice(4);
  const upd=(email,off)=>sql(`update player_profiles set date_of_birth='${dob(off,'1994')}' where membership_id=(select m.id from memberships m join users u on u.id=m.user_id where u.email='${email}' and m.club_id=(select id from clubs where name='Paris Arena'))`);
  upd('sule@example.com',0);upd('pastor@example.com',-1);upd('dorathy@example.com',3);
  sql(`update platform_invoices set pay_token='${PAYTOKEN}' where id=(select id from platform_invoices where status='issued' limit 1)`);
  sql(`update memberships set joined_at='${day(1).replace(/^\d{4}/,String(new Date().getFullYear()-2))}' where user_id=(select id from users where email='nathaniel@example.com') and club_id=(select id from clubs where name='Paris Arena')`);
}
(async()=>{seedCelebrations();const b=await chromium.launch();
for(const [role,email,routes,max] of [['player','ade@example.com',PLAYER,170],['admin','admin@example.com',ADMIN,170]]){
  const c=await b.newContext({viewport:{width:440,height:956}});c.setDefaultNavigationTimeout(90000);c.setDefaultTimeout(90000);const p=await c.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error'&&!/DeprecationWarning/.test(m.text()))errs.push(m.text())});
  await signIn(p,email);await crawl(p,role,routes,errs,max);ok(errs.length===0,`${role}: no console errors ${JSON.stringify(errs.slice(0,2))}`);await c.close();
}
{ // public pages, signed out
  const c=await b.newContext({viewport:{width:440,height:956}});const p=await c.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error'&&!/DeprecationWarning|401|404/.test(m.text()))errs.push(m.text())});
  await crawl(p,'public',PUBLIC,errs,120);ok(errs.length===0,`public: no console errors ${JSON.stringify(errs.slice(0,2))}`);
  await p.goto(B+'/pay/invoice/'+PAYTOKEN);const t=await p.locator('body').innerText();ok(/Pay your Rallix invoice/i.test(t)&&/₦/.test(t),'public: pay link shows the invoice and amount');
  await c.close();
}
console.log(`\n${pass} passed, ${fail} failed`);await b.close()})().catch(e=>{console.log('CRASH',e.message);process.exit(1)});
