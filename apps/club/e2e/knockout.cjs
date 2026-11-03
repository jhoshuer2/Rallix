/**
 * Knockout end-to-end: create a knockout with 3 players (one bye), play through to a champion (winner moves up, final completes the
 * competition), a raffle draw is stored once with a permutation of seeds, a player cannot score.
 *   BASE=http://localhost:3200 PGDB=rallix_2a DEV_LOG=/path/club.log node apps/club/e2e/knockout.cjs
 */
const {chromium}=require('playwright');const fs=require('fs');const {execSync}=require('child_process');
const LOG=process.env.DEV_LOG, B=process.env.BASE||'http://localhost:3000';
const sql=q=>execSync(`PGPASSWORD=service_dev psql -h localhost -U rallix_service -d ${process.env.PGDB||'rallix_dev'} -Atc "${q.replace(/"/g,'\\"')}"`).toString().trim();
let pass=0,fail=0;const ok=(c,m)=>{c?pass++:fail++;console.log(c?'  ok  ':'  FAIL',m)};
function code(email){const log=fs.readFileSync(LOG).toString().replace(/\0/g,'');const re=new RegExp('\\[mail:dev\\] to '+email.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+' \\|[^\\n]*\\n\\s+Your (?:Rallix|Rallix Console) sign-in code is (\\d{6})','g');const a=[...log.matchAll(re)];return a.length?a[a.length-1][1]:null}
async function signIn(p,email){await p.goto(B+'/sign-in?next=/');await p.getByLabel('Email address').fill(email);await p.getByRole('button',{name:'Email me a code'}).click();await p.getByLabel('6-digit code').waitFor({timeout:60000});await p.waitForTimeout(600);await p.getByLabel('6-digit code').fill(code(email));await p.getByRole('button',{name:'Sign in'}).click();await p.waitForURL(u=>!/sign-in/.test(u.toString()),{timeout:60000});const id=sql(`select id from clubs where name='Paris Arena'`);await p.goto(B+'/switch/'+id,{waitUntil:'networkidle'})}
async function who(b,email){const c=await b.newContext({viewport:{width:440,height:956}});c.setDefaultTimeout(60000);const p=await c.newPage();p.errs=[];p.on('pageerror',e=>p.errs.push(e.message));await signIn(p,email);return {c,p}}
const iso=n=>new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Lagos'}).format(new Date(Date.now()+n*864e5));
async function create(p,level,name,{raffle=false}={}){
  await p.goto(B+`/competition/new/${level}/auto`,{waitUntil:'networkidle'});
  await p.getByLabel('What will you name this competition?').fill(name);
  await p.getByLabel('Start date').fill(iso(1));await p.getByLabel('End date').fill(iso(20));
  await p.getByRole('radio',{name:/Knockout/}).click();
  if(raffle)await p.getByRole('switch',{name:'Draw by raffle'}).click();
  await p.getByRole('button',{name:'Create bracket'}).click();
  await p.waitForURL(/\/groups/,{timeout:60000});
  return p.url().match(/competition\/([0-9a-f-]{36})/)[1]}
async function scoreFirst(p,id){await p.goto(B+`/competition/${id}/groups`,{waitUntil:'networkidle'});
  await p.locator('a[aria-label^="Score"]').first().click();await p.waitForURL(/\/score\?match=/);
  const tiles=p.locator('button.rx-score');for(let g=0;g<3;g++)for(let i=0;i<11;i++)await tiles.first().click();
  await p.getByRole('button',{name:'Save result'}).click();await p.waitForURL(/\/groups/,{timeout:30000})}

(async()=>{const b=await chromium.launch();
const admin=await who(b,'admin@example.com'), ade=await who(b,'ade@example.com');

// 1. A three-player knockout: one bye
const id=await create(admin.p,'senior','E2E Knockout');
ok(sql(`select format||'|'||draw_method||'|'||(drawn_at is not null) from competitions where id='${id}'`)==='knockout|seeded|true','created as a seeded knockout with the draw recorded');
ok(sql(`select count(*) from matches where competition_id='${id}'`)==='3','3 players make 3 matches (two semi-final slots and the final)');
ok(sql(`select count(*) from matches where competition_id='${id}' and status='walkover' and player2_id is null and winner_id=player1_id`)==='1','one bye, recorded as a walkover for the top seed');
ok(sql(`select round from matches where competition_id='${id}' and feeds_match_id is null`)==='Final','the last match is the Final');
ok(sql(`select count(*) from matches where competition_id='${id}' and round_order=1 and feeds_match_id is not null`)==='2','both first-round matches feed the final');
const top=sql(`select m.player1_id from matches m where competition_id='${id}' and status='walkover'`);
ok(sql(`select player1_id from matches where competition_id='${id}' and feeds_match_id is null`)===top,'the top seed is already waiting in the final');
ok(await admin.p.getByText(/has a bye/).isVisible(),'the bye is shown as "<name> has a bye"');
ok(await admin.p.getByText('Semi-final').first().isVisible(),'rounds are named (Semi-final)');

// 2. Play the semi-final: the winner moves into the final
await scoreFirst(admin.p,id);
const semiWinner=sql(`select winner_id from matches where competition_id='${id}' and status='completed'`);
ok(!!semiWinner&&sql(`select player2_id from matches where competition_id='${id}' and feeds_match_id is null`)===semiWinner,'the semi-final winner moved into the final');
ok(sql(`select status from competitions where id='${id}'`)==='active','still active until the final is played');

// 3. Play the final: champion, competition completed
await scoreFirst(admin.p,id);
ok(sql(`select count(*) from matches where competition_id='${id}' and status in ('completed','walkover')`)==='3','all three matches are decided');
ok(sql(`select status from competitions where id='${id}'`)==='completed','deciding the final completes the competition');

// 4. A player cannot score
const mid=sql(`select id from matches where competition_id='${id}' and status='completed' limit 1`);
await ade.p.goto(B+`/competition/${id}/score?match=${mid}`,{waitUntil:'networkidle'});
ok(/\/play/.test(ade.p.url()),'a player cannot open a score sheet');

// 5. A raffle draw
const rid=await create(admin.p,'combined','E2E Raffle',{raffle:true});
ok(sql(`select draw_method||'|'||(drawn_at is not null) from competitions where id='${rid}'`)==='raffle|true','raffle recorded with the time of the draw');
const n=Number(sql(`select count(*) from competition_entries where competition_id='${rid}'`));
ok(n>=4&&sql(`select string_agg(seed::text, ',' order by seed) from competition_entries where competition_id='${rid}'`)===Array.from({length:n},(_,i)=>i+1).join(','),`the ${n} entrants hold seeds 1 to ${n} exactly once`);
ok(await admin.p.getByText('The draw').isVisible(),'the admin sees "The draw" in draw order');
const before=sql(`select drawn_at from competitions where id='${rid}'`);
await admin.p.reload({waitUntil:'networkidle'});
ok(sql(`select drawn_at from competitions where id='${rid}'`)===before,'viewing the page does not draw again');
ok(sql(`select count(*) from matches where competition_id='${rid}' and status='walkover'`)===String(Math.pow(2,Math.ceil(Math.log2(n)))-n),'the right number of byes for '+n+' players');

// A11y / errors
for(const [name,p] of [['admin',admin.p]]){await p.goto(B+`/competition/${id}/groups`,{waitUntil:'networkidle'});
  ok(await p.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),name+': no sideways scroll');
  const bad=await p.evaluate(()=>{const o=[];document.querySelectorAll('a,button,input').forEach(e=>{const r=e.getBoundingClientRect();if(r.width&&r.height&&r.height<43)o.push((e.textContent||e.tagName).trim().slice(0,30))});return o});
  ok(bad.length===0,name+': touch targets ok '+bad.join(', '))}
ok(admin.p.errs.length===0&&ade.p.errs.length===0,'no console errors '+admin.p.errs.concat(ade.p.errs).join('|'));
console.log(`\n${pass} passed, ${fail} failed`);await b.close();process.exit(fail?1:0)})().catch(e=>{console.error('CRASH',e.message);process.exit(2)});
