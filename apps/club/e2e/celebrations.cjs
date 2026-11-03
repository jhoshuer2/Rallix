/**
 * Club updates at scale: 40 members join today and 12 players have a birthday today. The strip must stay short (at most 9 tiles),
 * keep the birthdays, fold the joiners into one "40 new players" tile, never overlap tiles, and "See all" must list everyone.
 * The admin activity feed shows one "players joined" row next to payments and results. Needs a freshly seeded DB:
 *   OUT=/tmp DEV_LOG=/tmp/club.log node apps/club/e2e/celebrations.cjs
 */
const {chromium}=require('playwright');const fs=require('fs');const {execSync}=require('child_process');
const SC=process.env.OUT||'/tmp', LOG=process.env.DEV_LOG, B=process.env.BASE||'http://localhost:3000';
const sql=q=>execSync(`PGPASSWORD=service_dev psql -h localhost -U rallix_service -d ${process.env.PGDB||'rallix_dev'} -Atc "${q.replace(/"/g,'\\"')}"`).toString().trim();
let pass=0,fail=0;const ok=(c,m)=>{c?pass++:fail++;console.log(c?'  ok  ':'  FAIL',m)};
function code(email){const log=fs.readFileSync(LOG).toString().replace(/\0/g,'');const re=new RegExp('\\[mail:dev\\] to '+email.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+' \\|[^\\n]*\\n\\s+Your (?:Rallix|Rallix Console) sign-in code is (\\d{6})','g');const a=[...log.matchAll(re)];return a.length?a[a.length-1][1]:null}
async function who(b,email,w=390){const c=await b.newContext({viewport:{width:w,height:900}});const p=await c.newPage();p.setDefaultTimeout(60000);p.errs=[];p.on('pageerror',e=>p.errs.push(e.message));p.on('console',m=>{if(m.type()==='error'&&!/DeprecationWarning|Failed to load resource/.test(m.text()))p.errs.push(m.text())});
 await p.goto(B+'/sign-in?next=/');await p.getByLabel('Email address').fill(email);await p.getByRole('button',{name:'Email me a code'}).click();await p.getByLabel('6-digit code').waitFor();await p.waitForTimeout(600);await p.getByLabel('6-digit code').fill(code(email));await p.getByRole('button',{name:'Sign in'}).click();await p.waitForURL(u=>!/sign-in/.test(u.toString()));
 await p.goto(B+'/switch/'+sql(`select id from clubs where name='Paris Arena'`));return p}
const overlaps=p=>p.evaluate(()=>{const t=[...document.querySelectorAll('.rx-celebs .rx-celeb')].map(e=>e.getBoundingClientRect());const bub=[...document.querySelectorAll('.rx-celebs .rx-celeb__bubble')].map(e=>e.getBoundingClientRect());let n=0;for(let i=1;i<bub.length;i++){if(bub[i].left<bub[i-1].right-0.5)n++}for(let i=1;i<t.length;i++){if(t[i].left<t[i-1].right-0.5)n++}return n});

(async()=>{
  const club=sql(`select id from clubs where name='Paris Arena'`);
  // 40 new members (joined today) with no birthday, and 12 existing-style players with a birthday today
  sql(`insert into users (id,name,email) select 'u_new'||g, 'Newcomer '||g, 'newcomer'||g||'@example.com' from generate_series(1,40) g`);
  sql(`insert into memberships (club_id,user_id) select '${club}','u_new'||g from generate_series(1,40) g`);
  sql(`insert into player_profiles (membership_id,club_id) select m.id,'${club}' from memberships m where m.user_id like 'u_new%'`);
  sql(`insert into users (id,name,email) select 'u_bd'||g, 'Birthday '||g, 'bday'||g||'@example.com' from generate_series(1,12) g`);
  sql(`insert into memberships (club_id,user_id,joined_at) select '${club}','u_bd'||g, now() - interval '400 days' from generate_series(1,12) g`);
  sql(`insert into player_profiles (membership_id,club_id,date_of_birth) select m.id,'${club}',(now() at time zone 'Africa/Lagos')::date - interval '25 years' from memberships m where m.user_id like 'u_bd%'`);
  const b=await chromium.launch();
  for(const w of [320,390,440]){
    const P=await who(b,'ade@example.com',w);await P.goto(B+'/play');await P.locator('.rx-celebs').waitFor();
    const tiles=await P.locator('.rx-celebs .rx-celeb').count();
    ok(tiles<=8,`${w}px: the strip has at most 8 tiles (${tiles}) even with 52 people to celebrate`);
    const txt=await P.locator('.rx-celebs').innerText();
    ok(/\d{2} new players/i.test(txt)&&(txt.match(/new players/gi)||[]).length===1,`${w}px: the joiners fold into ONE "N new players" tile`);
    ok(/Birthday today/i.test(txt),`${w}px: birthdays stay visible`);
    ok(/\+\d+ more/.test(txt),`${w}px: the overflow is a "+N more" tile`);
    ok((await overlaps(P))===0,`${w}px: no tile or bubble overlaps another`);
    ok(!(await P.evaluate(()=>document.documentElement.scrollWidth>innerWidth)),`${w}px: no sideways page scroll`);
    if(w===390)await P.locator('.rx-celebs').screenshot({path:SC+'/celebs_strip.png'});
    if(w===390){
      await P.locator('.rx-celebs').getByRole('link').first().click();await P.waitForURL(/play\/updates/);
      const rows=await P.locator('.rx-lrow').count();
      ok(rows>=52,`See all lists everyone (${rows} rows)`);
      ok(/Today \(\d+\)/i.test(await P.locator('body').innerText()),'See all groups people under Today');
      ok(!(await P.evaluate(()=>document.documentElement.scrollWidth>innerWidth)),'See all has no sideways scroll');
      const small=await P.evaluate(()=>[...document.querySelectorAll('button,a')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&r.height<44&&e.closest('.rx-lrow')===null&&getComputedStyle(e).visibility!=='hidden'}).map(e=>(e.textContent||'').trim().slice(0,20)));
      ok(small.length===0,'targets on See all are 44px or larger '+JSON.stringify(small));
      await P.screenshot({path:SC+'/celebs_all.png'});
    }
    ok(P.errs.length===0,`${w}px: no page errors`);
    await P.context().close();
  }
  // Admin activity: one grouped row, payments and results still visible
  const A=await who(b,'admin@example.com');await A.goto(B+'/');
  const home=await A.locator('body').innerText();
  ok(/40 players joined|\d+ players joined/i.test(home),'admin home shows one grouped "players joined" row');
  ok((home.match(/ joined/gi)||[]).length<=3,'admin home is not flooded with individual joins');
  ok(/paid ₦/i.test(home),'payments are still visible next to the registrations');
  await A.goto(B+'/activity');const act=await A.locator('body').innerText();
  ok(/players joined/i.test(act)&&(act.match(/ joined/gi)||[]).length<=4,'the activity page groups joins too');
  ok(/paid ₦/i.test(act),'and still lists payments');
  ok(A.errs.length===0,'no admin page errors');
  await b.close();console.log(`\n${pass} passed, ${fail} failed`);process.exit(fail?1:0)
})().catch(e=>{console.log('CRASH',e.message.split('\n')[0]);process.exit(1)});
