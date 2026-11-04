/**
 * Offline scoring, against a PRODUCTION build (the service worker keeps files only in production).
 * A scorer opens a match with a signal, loses it, scores the whole match (including an umpire "End game"), reloads with no signal,
 * closes and reopens the browser, then gets signal back: the result is sent once and the match is completed once.
 * Also: a retried send is a no-op, a match recorded meanwhile is a conflict (the recorded result stays), and no other page is served from cache.
 *   scripts/e2e-run.sh prod offline
 */
const {chromium}=require('playwright');const fs=require('fs');const os=require('os');const path=require('path');const {execSync}=require('child_process');
const LOG=process.env.DEV_LOG, B=process.env.BASE||'http://localhost:3000';
const sql=q=>execSync(`PGPASSWORD=service_dev psql -h localhost -U rallix_service -d ${process.env.PGDB||'rallix_dev'} -Atc "${q.replace(/"/g,'\\"')}"`).toString().trim().split('\n')[0];
let pass=0,fail=0;const ok=(c,m)=>{c?pass++:fail++;console.log(c?'  ok  ':'  FAIL',m)};
function code(email){const log=fs.readFileSync(LOG).toString().replace(/\0/g,'');const re=new RegExp('\\[mail:dev\\] to '+email.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+' \\|[^\\n]*\\n\\s+Your (?:Rallix|Rallix Console) sign-in code is (\\d{6})','g');const a=[...log.matchAll(re)];return a.length?a[a.length-1][1]:null}
async function signIn(p,email){await p.goto(B+'/sign-in?next=/');await p.getByLabel('Email address').fill(email);await p.getByRole('button',{name:'Email me a code'}).click();await p.getByLabel('6-digit code').waitFor({timeout:60000});await p.waitForTimeout(600);await p.getByLabel('6-digit code').fill(code(email));await p.getByRole('button',{name:'Sign in'}).click();await p.waitForURL(u=>!/sign-in/.test(u.toString()),{timeout:60000});const id=sql(`select id from clubs where name='Paris Arena'`);await p.goto(B+'/switch/'+id,{waitUntil:'networkidle'})}
const club=`(select id from clubs where name='Paris Arena')`;
const mid=n=>sql(`select m.id from memberships m join users u on u.id=m.user_id where u.email='${n}@example.com' and m.club_id=${club}`);
const until=async(fn,ms=40000)=>{const t=Date.now();while(Date.now()-t<ms){try{if(await fn())return true}catch{}await new Promise(r=>setTimeout(r,500))}return false};
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'rallix-offline-'));
const launch=()=>chromium.launchPersistentContext(dir,{viewport:{width:440,height:956},serviceWorkers:'allow'});

(async()=>{
let c=await launch();c.setDefaultTimeout(60000);c.setDefaultNavigationTimeout(90000);let p=c.pages()[0]||await c.newPage();
const errs=[];p.on('pageerror',e=>errs.push(e.message));
await signIn(p,'admin@example.com');
const comp=sql(`insert into competitions (club_id, name, format, status, starts_on, ends_on) values (${club}, 'Offline Cup', 'one_on_one', 'active', '2030-01-01', '2030-01-10') returning id`);
const mk=()=>sql(`insert into matches (club_id, competition_id, round, player1_id, player2_id, best_of) values (${club}, '${comp}', 'One on one', '${mid('ade')}', '${mid('jide')}', 3) returning id`);
const m1=mk(), m2=mk();
const url=m=>B+`/competition/${comp}/score?match=${m}`;
const text=()=>p.locator('body').innerText();
const tile=i=>p.locator('button.rx-score').nth(i);
const shellCached=()=>p.evaluate(async()=>{const c=await caches.open('rallix-shell-v1');return !!(await c.match('/score-offline'))});

// 1. With a signal: the service worker takes control, the scoring screens are opened once so the phone keeps what it needs.
await p.goto(B+'/',{waitUntil:'networkidle'});
await p.evaluate(()=>navigator.serviceWorker.ready);
await p.goto(B+'/',{waitUntil:'networkidle'}); // now controlled
const prod=await p.evaluate(()=>navigator.serviceWorker.controller&&navigator.serviceWorker.controller.scriptURL);
ok(!!prod&&/offline=1/.test(prod),'a production build registers the offline-aware service worker '+prod);
await p.goto(url(m1),{waitUntil:'networkidle'});
ok(await until(shellCached,30000),'opening a scoring screen saves the offline shell');
await p.goto(url(m2),{waitUntil:'networkidle'});await p.waitForTimeout(1500); // second match context saved
ok(/Game 1 of 3/.test(await text()),'online, the scoring screen works as before');
await p.goto(url(m1),{waitUntil:'networkidle'});await p.waitForTimeout(1500);

// 2. Signal lost: reload the scoring screen.
await c.setOffline(true);
await p.goto(url(m1)).catch(()=>{});
ok(await until(async()=>/Game 1 of 3/.test(await text())),'with no signal, reloading the scoring screen still opens it (from this phone)');
ok(/\/score-offline/.test(p.url()),'it opened the offline copy of the same match');
ok(/Ade/.test(await text())&&/Jide/.test(await text()),'the player names are there');

// 3. Score: game 1 ended early by the umpire at 3-0, game 2 won 11-0.
for(let i=0;i<3;i++)await tile(0).click();
await p.getByRole('button',{name:'End game 1'}).click();await p.getByRole('button',{name:'End game 1'}).last().click();
ok(/Game 1 stopped/.test(await text()),'the umpire can end a game with no signal');
for(let i=0;i<11;i++)await tile(0).click();
ok(/Winner: /.test(await text()),'the match finishes offline');
// a half-played second match survives a reload: score two points on match 2 first
await p.getByRole('button',{name:'Save result'}).click();
ok(await until(async()=>/Saved on this phone/.test(await text())),'saving with no signal says "Saved on this phone"');
ok(sql(`select status from matches where id='${m1}'`)==='scheduled','nothing reached the server yet');
ok(await until(async()=>/1 result waiting to send/.test(await text())),'the banner says "1 result waiting to send"');

// 4. No other page is served from the phone: the app is never stale.
const home=await p.goto(B+'/play').then(()=>'loaded').catch(()=>'failed');
ok(home==='failed','with no signal, an ordinary page (Home) is NOT served from a saved copy');
const cached=await (async()=>{await c.setOffline(false);await p.goto(B+'/score-offline?match='+m1,{waitUntil:'networkidle'});return p.evaluate(async()=>{const out=[];for(const k of await caches.keys()){const ch=await caches.open(k);for(const r of await ch.keys())out.push(k+' '+new URL(r.url).pathname)}return out})})();
ok(cached.length>0&&cached.every(x=>/^rallix-static-v1 \/_next\/static\//.test(x)||x==='rallix-shell-v1 /score-offline'),'the phone keeps only build files and the one shell page ('+cached.length+' entries)');
await c.setOffline(true);

// 5. Browser closed and reopened with no signal: the queue is still there.
await c.close();
c=await launch();c.setDefaultTimeout(60000);c.setDefaultNavigationTimeout(90000);p=c.pages()[0]||await c.newPage();await c.setOffline(true);
await p.goto(B+'/score-offline?match='+m1).catch(()=>{});
ok(await until(async()=>/1 result waiting to send/.test(await text())),'after closing and reopening the browser, the result is still waiting');
ok(sql(`select status from matches where id='${m1}'`)==='scheduled','still nothing on the server');

// 6. A conflict: match 2 is scored here with no signal, but meanwhile someone records it.
await c.setOffline(false);await p.goto(url(m2),{waitUntil:'networkidle'});await p.waitForTimeout(1500);await c.setOffline(true);
await p.goto(url(m2)).catch(()=>{});
ok(await until(async()=>/Game 1 of 3/.test(await text())&&/score-offline/.test(p.url())),'match 2 opens offline too');
for(let i=0;i<11;i++)await tile(1).click();
for(let i=0;i<11;i++)await tile(1).click();
await p.getByRole('button',{name:'Save result'}).click();
ok(await until(async()=>/Saved on this phone/.test(await text())),'match 2 is saved on this phone too');
ok(await until(async()=>/2 results waiting to send/.test(await text())),'the banner counts two');
sql(`update matches set status='completed', winner_id='${mid('ade')}', games_p1=2, games_p2=0, confirmed_at=now() where id='${m2}'`);

// 7. Signal back: both are sent, the first is saved once, the second is a conflict and the recorded result stays.
await c.setOffline(false);
await p.evaluate(()=>window.dispatchEvent(new Event('online')));
ok(await until(()=>sql(`select status from matches where id='${m1}'`)==='completed',60000),'when the signal returns the result is sent and the match is completed');
ok(sql(`select count(*) from games where match_id='${m1}'`)==='2','two games were saved');
ok(sql(`select game_no||':'||p1_points||'-'||p2_points||':'||stopped from games where match_id='${m1}' and game_no=1`)==='1:3-0:true','game 1 keeps its umpire stop (3–0)');
ok(sql(`select winner_id='${mid('ade')}' from matches where id='${m1}'`)==='t','Ade is the winner');
ok(sql(`select count(*) from rating_events where match_id='${m1}'`)==='2','ratings moved once');
ok(await until(async()=>/The recorded result stays/.test(await text()),30000),'the second result is shown as a conflict and says the recorded result stays');
ok(sql(`select winner_id='${mid('ade')}' from matches where id='${m2}'`)==='t'&&sql(`select count(*) from games where match_id='${m2}'`)==='0','the recorded result of match 2 was not changed');
ok(!/waiting to send/.test(await text()),'nothing is left waiting');

// Discard the conflict first so the next check starts clean.
const disc=p.getByRole('button',{name:'Discard'});
if(await disc.count())await disc.first().click();
ok(await until(async()=>!/need.? your attention/.test(await text())),'a conflict can be discarded');
// 8. A retry of the same result (reply lost) is a no-op, not a conflict. Put the already-sent item back in the outbox.
const ref=sql(`select client_ref from matches where id='${m1}'`);
ok(/^[\w-]{8,64}$/.test(ref),'the match remembers the reference from the phone');
await p.evaluate(async({ref,m1,comp,clubId})=>{await new Promise((res,rej)=>{const r=indexedDB.open('rallix-offline',1);r.onsuccess=()=>{const tx=r.result.transaction('outbox','readwrite');tx.objectStore('outbox').put({clientRef:ref,matchId:m1,competitionId:comp,clubId,label:'Ade v Jide',games:[{p1:3,p2:0,stopped:true},{p1:11,p2:0}],state:'waiting',attempts:0,createdAt:Date.now(),nextTryAt:Date.now()});tx.oncomplete=()=>res();tx.onerror=()=>rej()};r.onerror=()=>rej()});window.dispatchEvent(new Event('online'))},{ref,m1,comp,clubId:sql(`select id from clubs where name='Paris Arena'`)});
await p.getByRole('button',{name:'Send now'}).click({timeout:5000}).catch(()=>{});
await p.waitForTimeout(6000);
ok(sql(`select count(*) from games where match_id='${m1}'`)==='2'&&sql(`select count(*) from rating_events where match_id='${m1}'`)==='2','sending the same result again changes nothing');
ok(!/need.? your attention/.test(await text().catch(()=>'')),'and it is not reported as a conflict');
ok(errs.filter(e=>!/Failed to fetch|NetworkError|Load failed/i.test(e)).length===0,'no console errors '+errs.join('|'));
console.log(`\n${pass} passed, ${fail} failed`);await c.close();fs.rmSync(dir,{recursive:true,force:true});process.exit(fail?1:0)})().catch(e=>{console.error('CRASH',e.message);process.exit(2)});
