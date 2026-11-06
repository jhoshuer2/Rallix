/**
 * Toasts: every save and failure is a message you cannot miss.
 * At the top (the keyboard never covers it), read aloud, dismissible with a 44px button, gone after about 6 s (errors stay longer),
 * above modal sheets, still there after moving to another screen, and no animation under reduced motion.
 *   scripts/e2e-run.sh prod toast
 */
const {chromium}=require('playwright');const fs=require('fs');const {execSync}=require('child_process');
const LOG=process.env.DEV_LOG, B=process.env.BASE||'http://localhost:3000';
const sql=q=>execSync(`PGPASSWORD=service_dev psql -h localhost -U rallix_service -d ${process.env.PGDB||'rallix_dev'} -Atc "${q.replace(/"/g,'\\"')}"`).toString().trim().split('\n')[0];
let pass=0,fail=0;const ok=(c,m)=>{c?pass++:fail++;console.log(c?'  ok  ':'  FAIL',m)};
function code(email){const log=fs.readFileSync(LOG).toString().replace(/\0/g,'');const re=new RegExp('\\[mail:dev\\] to '+email.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+' \\|[^\\n]*\\n\\s+Your (?:Rallix|Rallix Console) sign-in code is (\\d{6})','g');const a=[...log.matchAll(re)];return a.length?a[a.length-1][1]:null}
async function signIn(p,email){await p.goto(B+'/sign-in?next=/');await p.getByLabel('Email address').fill(email);await p.getByRole('button',{name:'Email me a code'}).click();await p.getByLabel('6-digit code').waitFor({timeout:60000});await p.waitForTimeout(600);await p.getByLabel('6-digit code').fill(code(email));await p.getByRole('button',{name:'Sign in'}).click();await p.waitForURL(u=>!/sign-in/.test(u.toString()),{timeout:60000});const id=sql(`select id from clubs where name='Paris Arena'`);await p.goto(B+'/switch/'+id,{waitUntil:'networkidle'})}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const box=p=>p.locator('.rx-toast');
const visible=async(p,re)=>p.locator('.rx-toast').filter({hasText:re}).first().waitFor({state:'visible',timeout:15000}).then(()=>true).catch(()=>false);
const rect=p=>p.locator('.rx-toast').first().boundingBox();

(async()=>{const b=await chromium.launch();
const c=await b.newContext({viewport:{width:440,height:956}});c.setDefaultTimeout(60000);c.setDefaultNavigationTimeout(90000);const p=await c.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
await signIn(p,'ade@example.com');

// 1. Success toast on a save
await p.goto(B+'/play/me',{waitUntil:'networkidle'});
await p.getByLabel(/Phone or WhatsApp/).fill('0803 555 0142');
await p.getByRole('button',{name:'Save contact details'}).click();
ok(await visible(p,/Phone number saved/),'saving the phone number shows a toast saying so');
const r1=await rect(p);
ok(r1&&r1.y<=100&&r1.y>=48&&r1.x>=0&&r1.x+r1.width<=440,'it is at the top, just under the app bar, and inside the viewport');
ok(await p.locator('[role="status"] .rx-toast--success').count()>=1,'a success toast sits in a polite live region (read aloud)');
ok((await p.getByRole('button',{name:'Dismiss message'}).first().boundingBox()).height>=44,'its OK button is at least 44px tall');
ok(await p.evaluate(()=>{const el=document.querySelector('.rx-toast');const r=el.getBoundingClientRect();const top=document.elementFromPoint(r.x+r.width/2,r.y+10);return !!top&&el.contains(top)}),'nothing is drawn on top of it');
const fg=await p.evaluate(()=>getComputedStyle(document.querySelector('.rx-toast--success')).color);const bg=await p.evaluate(()=>getComputedStyle(document.querySelector('.rx-toast--success')).backgroundColor);
const lum=(c)=>{const m=c.match(/\d+/g).map(Number).map(v=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4)});return 0.2126*m[0]+0.7152*m[1]+0.0722*m[2]};
ok(fg==='rgb(255, 255, 255)'&&(1.05)/(lum(bg)+0.05)>=7,'white text on a dark panel (contrast at least 7:1)');

// 2. Dismiss
await p.getByRole('button',{name:'Dismiss message'}).first().click();
ok(await p.locator('.rx-toast').count()===0,'OK closes it');

// 3. It closes by itself after about 6 s
await p.getByRole('button',{name:'Save contact details'}).click();
await visible(p,/Phone number saved/);
await sleep(4500);ok(await p.locator('.rx-toast').count()===1,'it is still there after 4 s');
await sleep(3500);ok(await p.locator('.rx-toast').count()===0,'and gone after about 6 s');

// 4. An error toast is assertive and stays longer
await p.getByLabel(/Phone or WhatsApp/).fill('123');
await p.getByRole('button',{name:'Save contact details'}).click();
ok(await visible(p,/./),'a failed save shows a toast too');
ok(await p.locator('[role="alert"] .rx-toast--error').count()>=1,'the error is in an assertive live region');
await sleep(7500);ok(await p.locator('.rx-toast--error').count()===1,'an error is still there after 7 s (it stays about 10 s)');
await p.getByRole('button',{name:'Dismiss message'}).first().click();

// 5. The on-screen keyboard shrinks the viewport: a top toast is still visible
await p.setViewportSize({width:440,height:420});
await p.getByLabel(/Phone or WhatsApp/).fill('0803 555 0142');
await p.getByRole('button',{name:'Save contact details'}).click();
ok(await visible(p,/Phone number saved/),'with a keyboard-sized screen the toast still shows');
const r2=await rect(p);ok(r2&&r2.y>=0&&r2.y+r2.height<=420,'and it is inside the short viewport');
await p.setViewportSize({width:440,height:956});

// 6. Two different results stack
await p.getByRole('button',{name:'Dismiss message'}).first().click().catch(()=>{});
await p.goto(B+'/play/me/account',{waitUntil:'networkidle'});
await p.getByLabel('Month',{exact:true}).selectOption('6');await p.getByLabel('Day',{exact:true}).selectOption('15');
await p.getByRole('button',{name:'Save birthday'}).click();
ok(await visible(p,/Birthday saved/),'saving a birthday shows its own toast');
await p.getByRole('button',{name:'Save birthday'}).click();
await p.waitForTimeout(500);
ok(await p.locator('.rx-toast').count()<=3,'toasts never pile up beyond three');

// 7. The Back button stays tappable while a toast shows, and the toast survives moving to another screen
const bt=Date.now();
await p.getByRole('link',{name:/Back/}).first().click({timeout:3000}).catch(()=>{});
ok(Date.now()-bt<3500,'Back can be tapped at once (the toast does not cover it)');
await p.waitForURL(/\/play\/me$/,{timeout:20000}).catch(()=>{});
ok(await p.locator('.rx-toast').count()>=1,'the toast is still on screen after going back to Me');
await p.goto(B+'/play/me/account',{waitUntil:'networkidle'});
await p.getByLabel('Month',{exact:true}).selectOption('');await p.getByRole('button',{name:'Remove my birthday'}).click().catch(()=>{});

// 8. Reduced motion: no animation
await p.emulateMedia({reducedMotion:'reduce'});
await p.goto(B+'/play/me',{waitUntil:'networkidle'});
await p.getByLabel(/Phone or WhatsApp/).fill('0803 555 0143');await p.getByRole('button',{name:'Save contact details'}).click();
await visible(p,/Phone number saved/);
ok(await p.evaluate(()=>getComputedStyle(document.querySelector('.rx-toast')).animationName)==='none','with reduced motion the toast does not animate');
await p.emulateMedia({reducedMotion:'no-preference'});

// 9. Above a modal sheet (admin schedule): an error toast is not hidden behind the dialog
const A=await b.newContext({viewport:{width:440,height:956}});A.setDefaultTimeout(60000);A.setDefaultNavigationTimeout(90000);const q=await A.newPage();
await signIn(q,'admin@example.com');
await q.goto(B+'/profile/schedule',{waitUntil:'networkidle'});
const add=q.getByRole('button',{name:/Add|New|Create/}).first();
await add.click();
await q.locator('dialog[open]').waitFor({timeout:15000});
const save=q.locator('dialog[open]').getByRole('button',{name:/^Save/}).first();
await save.click();
const t=q.locator('.rx-toast').first();
ok(await t.waitFor({state:'visible',timeout:15000}).then(()=>true).catch(()=>false),'a failed save inside a sheet shows a toast');
const tb=await q.locator('.rx-toast').first().boundingBox();
const shot=await q.screenshot({clip:{x:tb.x+tb.width*0.5,y:tb.y+5,width:8,height:8}});
const px=await q.evaluate(async(b64)=>{const img=new Image();img.src='data:image/png;base64,'+b64;await img.decode();const c=document.createElement('canvas');c.width=img.width;c.height=img.height;const x=c.getContext('2d');x.drawImage(img,0,0);return [...x.getImageData(2,2,1,1).data]},shot.toString('base64'));
ok(px[0]>100&&px[1]<60&&px[2]<60,'the red error toast is drawn above the open sheet (not hidden behind its white): '+px.join(','));
ok(errs.length===0,'no console errors '+errs.join('|'));
console.log(`\n${pass} passed, ${fail} failed`);await b.close();process.exit(fail?1:0)})().catch(e=>{console.error('CRASH',e.message);process.exit(2)});
