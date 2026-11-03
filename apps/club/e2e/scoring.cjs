/**
 * Scoring screen: a visible game counter, games end by themselves at 11 (or two clear points after deuce) with a clear notice, game point and
 * deuce are announced, the umpire can end a game early (whoever leads wins it, a tie cannot be ended), undo works, and the stopped game is saved.
 *   BASE=http://localhost:3200 PGDB=rallix_2a DEV_LOG=/path/club.log node apps/club/e2e/scoring.cjs
 */
const {chromium}=require('playwright');const fs=require('fs');const {execSync}=require('child_process');
const LOG=process.env.DEV_LOG, B=process.env.BASE||'http://localhost:3000';
const sql=q=>execSync(`PGPASSWORD=service_dev psql -h localhost -U rallix_service -d ${process.env.PGDB||'rallix_dev'} -Atc "${q.replace(/"/g,'\\"')}"`).toString().trim().split('\n')[0];
let pass=0,fail=0;const ok=(c,m)=>{c?pass++:fail++;console.log(c?'  ok  ':'  FAIL',m)};
function code(email){const log=fs.readFileSync(LOG).toString().replace(/\0/g,'');const re=new RegExp('\\[mail:dev\\] to '+email.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+' \\|[^\\n]*\\n\\s+Your (?:Rallix|Rallix Console) sign-in code is (\\d{6})','g');const a=[...log.matchAll(re)];return a.length?a[a.length-1][1]:null}
async function signIn(p,email){await p.goto(B+'/sign-in?next=/');await p.getByLabel('Email address').fill(email);await p.getByRole('button',{name:'Email me a code'}).click();await p.getByLabel('6-digit code').waitFor({timeout:60000});await p.waitForTimeout(600);await p.getByLabel('6-digit code').fill(code(email));await p.getByRole('button',{name:'Sign in'}).click();await p.waitForURL(u=>!/sign-in/.test(u.toString()),{timeout:60000});const id=sql(`select id from clubs where name='Paris Arena'`);await p.goto(B+'/switch/'+id,{waitUntil:'networkidle'})}
const club=`(select id from clubs where name='Paris Arena')`;
const mid=n=>sql(`select m.id from memberships m join users u on u.id=m.user_id where u.email='${n}@example.com' and m.club_id=${club}`);

(async()=>{const b=await chromium.launch();const c=await b.newContext({viewport:{width:440,height:956}});c.setDefaultTimeout(60000);c.setDefaultNavigationTimeout(90000);const p=await c.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
await signIn(p,'admin@example.com');
const comp=sql(`insert into competitions (club_id, name, format, status, starts_on, ends_on) values (${club}, 'Scoring Cup', 'one_on_one', 'active', '2030-01-01', '2030-01-10') returning id`);
const match=sql(`insert into matches (club_id, competition_id, round, player1_id, player2_id, best_of) values (${club}, '${comp}', 'One on one', '${mid('ade')}', '${mid('jide')}', 3) returning id`);
await p.goto(B+`/competition/${comp}/score?match=${match}`,{waitUntil:'networkidle'});
const tile=i=>p.locator('button.rx-score').nth(i);
const text=async()=>p.locator('body').innerText();

ok(/Game 1 of 3/.test(await text())&&/Games 0–0/.test(await text()),'the header names the game: "Game 1 of 3 · Games 0–0"');
ok(/First to 11, win by 2 · best of 3/.test(await text()),'the rule is on screen');
ok(await p.getByRole('button',{name:/End game/}).count()===0,'no "End game" at 0–0 (nothing to end)');

// Game 1: p1 wins 11–0 by itself
for(let i=0;i<10;i++)await tile(0).click();
ok(/Game point: /.test(await text()),'at 10–0 the screen announces game point');
await tile(0).click();
ok(/Game 1 finished: .* wins 11–0\. Game 2 starts at 0–0\./.test(await text()),'the 11th point ends game 1 with a clear notice and says game 2 starts');
ok(/Game 2 of 3/.test(await text())&&/Games 1–0/.test(await text()),'the header moves on: "Game 2 of 3 · Games 1–0"');
ok(await tile(0).innerText().then(t=>/^0/.test(t.trim())||/\b0\b/.test(t)),'both tiles are back at 0');

// Game 2: the umpire stops it at 2–3
for(let i=0;i<2;i++){await tile(0).click()}
for(let i=0;i<2;i++){await tile(1).click()}
ok(await p.getByRole('button',{name:/End game/}).count()===0,'a tie (2–2) cannot be ended');
await tile(1).click();
await p.getByRole('button',{name:'End game 2'}).click();
ok(/End game 2 at 2–3\? .* wins this game\./.test(await text()),'ending a game asks first: "End game 2 at 2–3? <name> wins this game."');
await p.getByRole('button',{name:'Keep playing'}).click();
ok(/Game 2 of 3/.test(await text()),'"Keep playing" changes nothing');
await p.getByRole('button',{name:'End game 2'}).click();await p.getByRole('button',{name:'End game 2'}).last().click();
ok(/Game 2 stopped: .* wins 3–2 \(ended by the umpire\)\. Game 3 starts at 0–0\./.test(await text()),'the stopped game is announced and game 3 starts');
ok(/Game 3 of 3/.test(await text())&&/Games 1–1/.test(await text()),'the header says "Game 3 of 3 · Games 1–1"');
// Undo brings the stopped game back
await p.getByRole('button',{name:'Undo'}).click();
ok(/Game 2 of 3/.test(await text())&&/Games 1–0/.test(await text()),'Undo takes the umpire\'s decision back: Game 2 again, Games 1–0');
await p.getByRole('button',{name:'End game 2'}).click();await p.getByRole('button',{name:'End game 2'}).last().click();

// Game 3: deuce, no cap, win by two
for(let i=0;i<10;i++){await tile(0).click();await tile(1).click();}
ok(/Deuce: first to lead by two/.test(await text()),'at 10–10 the screen says Deuce: first to lead by two');
await tile(0).click();
ok(/Game point: /.test(await text())&&/Game 3 of 3/.test(await text()),'11–10 is game point, not a finished game');
await tile(1).click();await tile(1).click();
ok(/Game point: /.test(await text())&&!/Winner: /.test(await text()),'11–12 is only game point: a lead of one does not end a deuce game');
await tile(1).click();
ok(/Winner: /.test(await text()),'11–13 (two clear points after deuce) ends the game and the match; the score went past 11 because deuce has no cap');
ok(await p.getByRole('button',{name:'Save result'}).isVisible()&&await p.getByRole('button',{name:/End game/}).count()===0,'the match is finished: Save result, and no End game');
await p.getByRole('button',{name:'Save result'}).click();await p.waitForURL(/\/groups/,{timeout:40000});
ok(sql(`select count(*) from games where match_id='${match}'`)==='3','three games were saved');
ok(sql(`select game_no||':'||p1_points||'-'||p2_points||':'||stopped from games where match_id='${match}' and game_no=2`)==='2:2-3:true','game 2 is saved as 2–3 and marked stopped');
ok(sql(`select p1_points||'-'||p2_points||':'||stopped from games where match_id='${match}' and game_no=3`)==='11-13:false','game 3 is saved as a normal deuce game, 11–13: '+sql(`select p1_points||'-'||p2_points||':'||stopped from games where match_id='${match}' and game_no=3`));
ok(sql(`select status||'|'||(winner_id='${mid('jide')}')||'|'||games_p1||'-'||games_p2 from matches where id='${match}'`)==='completed|true|1-2','the match is completed: Jide wins 2–1');
ok(errs.length===0,'no console errors '+errs.join('|'));
console.log(`\n${pass} passed, ${fail} failed`);await b.close();process.exit(fail?1:0)})().catch(e=>{console.error('CRASH',e.message);process.exit(2)});
