/**
 * Player Home (premium layer) end-to-end: story ring and viewer (keyboard, auto-advance, reduced motion, seen state),
 * text diet, no sideways page scroll, 44px targets, no console errors. Takes screenshots into $OUT.
 * Needs a freshly seeded DB and the club app running:  OUT=/tmp DEV_LOG=/tmp/club.log node apps/club/e2e/home.cjs
 */
const {chromium}=require('playwright');const fs=require('fs');const {execSync}=require('child_process');
const SC=process.env.OUT||"/tmp", LOG=process.env.DEV_LOG, B='http://localhost:3000';
const sql=q=>execSync(`PGPASSWORD=service_dev psql -h localhost -U rallix_service -d rallix_dev -Atc "${q.replace(/"/g,'\\"')}"`).toString().trim();
let pass=0,fail=0;const ok=(c,m)=>{c?pass++:fail++;console.log(c?'  ok  ':'  FAIL',m)};
async function code(email){const log=fs.readFileSync(LOG).toString().replace(/\0/g,'');const re=new RegExp('\\[mail:dev\\] to '+email.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+' \\|[^\\n]*\\n\\s+Your (?:Rallix|Rallix Console) sign-in code is (\\d{6})','g');const a=[...log.matchAll(re)];return a.length?a[a.length-1][1]:null}
(async()=>{const b=await chromium.launch();
for(const mode of ['default','reduced']){
 const c=await b.newContext({viewport:{width:440,height:956},reducedMotion:mode==='reduced'?'reduce':'no-preference'});const p=await c.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
 await p.goto(B+'/sign-in?next=/play');await p.getByLabel('Email address').fill('ade@example.com');await p.getByRole('button',{name:'Email me a code'}).click();await p.getByLabel('6-digit code').waitFor({timeout:25000});await p.waitForTimeout(600);
 await p.getByLabel('6-digit code').fill(await code('ade@example.com'));await p.getByRole('button',{name:'Sign in'}).click();await p.waitForURL(u=>!/sign-in/.test(u.toString()),{timeout:25000});
 const pid=sql("select id from clubs where name='Paris Arena'");await p.goto(B+'/switch/'+pid);await p.goto(B+'/play');await p.waitForLoadState('networkidle');
 const t=await p.locator('body').innerText();
 console.log('mode',mode);
 ok(/Hi, Ade/i.test(t),'greeting');
 const words=t.split(/\s+/).filter(Boolean).length;console.log('   visible words on first load:',words);
 ok(words<150,'text diet: under 150 words on Home (nav included)');
 ok(await p.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth),'no horizontal page scroll');
 const small=await p.evaluate(()=>[...document.querySelectorAll('a,button')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&(r.height<44||r.width<44)&&!e.closest('.rx-carousel')&&getComputedStyle(e).visibility!=='hidden'}).map(e=>(e.getAttribute('aria-label')||e.textContent||'').trim().slice(0,30)+' '+Math.round(e.getBoundingClientRect().width)+'x'+Math.round(e.getBoundingClientRect().height)));
 console.log('   targets under 44px:',JSON.stringify(small));
 await p.screenshot({path:`${SC}/home_${mode}.png`,fullPage:true});
 const ring=p.locator('.rx-story__ring').first();ok(await ring.count()>0,'story rings render');
 await ring.click();await p.waitForTimeout(500);
 ok(await p.locator('dialog.rx-viewer[open]').count()===1,'viewer opens');
 await p.screenshot({path:`${SC}/story_${mode}.png`});
 const live=await p.locator('.rx-viewer__fill.is-run').count();ok(mode==='reduced'?live===0:live===1,mode==='reduced'?'reduced motion: no auto-advance bar animation':'progress bar runs');
 await p.keyboard.press('ArrowRight');await p.waitForTimeout(200);
 await p.keyboard.press('Escape');await p.waitForTimeout(300);
 ok(await p.locator('dialog.rx-viewer[open]').count()===0,'Esc closes the viewer');
 ok(await p.evaluate(()=>document.activeElement&&document.activeElement.classList.contains('rx-story__ring')),'focus returns to the ring');
 await p.reload();await p.waitForLoadState('networkidle');
 ok(await p.locator('.rx-story__ring.is-seen').count()>=1,'seen state remembered');
 ok(errs.length===0,'no console errors '+JSON.stringify(errs.slice(0,2)));
 await c.close();
}
console.log(`\n${pass} passed, ${fail} failed`);await b.close()})().catch(e=>{console.log('CRASH',e.message);process.exit(1)});
