/**
 * Match rules the club chooses: how many games make a match, how many points decide a game, and what happens one short of the target.
 * The admin sets the club's usual rules; a new competition starts with them (and can change them); matches are made with them;
 * the scoring screen follows them (game to 21, "next point wins" at 10-10, a hard limit at 15); a played competition's rules are locked.
 *   scripts/e2e-run.sh prod match-rules
 */
const {chromium}=require('playwright');const fs=require('fs');const {execSync}=require('child_process');
const LOG=process.env.DEV_LOG, B=process.env.BASE||'http://localhost:3000';
const sql=q=>execSync(`PGPASSWORD=service_dev psql -h localhost -U rallix_service -d ${process.env.PGDB||'rallix_dev'} -Atc "${q.replace(/"/g,'\\"')}"`).toString().trim().split('\n')[0];
let pass=0,fail=0;const ok=(c,m)=>{c?pass++:fail++;console.log(c?'  ok  ':'  FAIL',m)};
function code(email){const log=fs.readFileSync(LOG).toString().replace(/\0/g,'');const re=new RegExp('\\[mail:dev\\] to '+email.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+' \\|[^\\n]*\\n\\s+Your (?:Rallix|Rallix Console) sign-in code is (\\d{6})','g');const a=[...log.matchAll(re)];return a.length?a[a.length-1][1]:null}
async function signIn(p,email){await p.goto(B+'/sign-in?next=/');await p.getByLabel('Email address').fill(email);await p.getByRole('button',{name:'Email me a code'}).click();await p.getByLabel('6-digit code').waitFor({timeout:60000});await p.waitForTimeout(600);await p.getByLabel('6-digit code').fill(code(email));await p.getByRole('button',{name:'Sign in'}).click();await p.waitForURL(u=>!/sign-in/.test(u.toString()),{timeout:60000});const id=sql(`select id from clubs where name='Paris Arena'`);await p.goto(B+'/switch/'+id,{waitUntil:'networkidle'})}
const club=`(select id from clubs where name='Paris Arena')`;
const mid=n=>sql(`select m.id from memberships m join users u on u.id=m.user_id where u.email='${n}@example.com' and m.club_id=${club}`);
const body=async p=>{await p.locator('.rx-skel').first().waitFor({state:'detached',timeout:20000}).catch(()=>{});return p.locator('body').innerText()};
const closeToasts=async p=>{for(let i=0;i<4;i++){const b=p.getByRole('button',{name:'Close notification'}).first();if(await b.count())await b.click().catch(()=>{});else break}};
const tile=(p,i)=>p.locator('button.rx-score').nth(i);
const click=async(p,i,n)=>{for(let k=0;k<n;k++)await tile(p,i).click()};

(async()=>{const b=await chromium.launch();const c=await b.newContext({viewport:{width:440,height:956}});c.setDefaultTimeout(60000);c.setDefaultNavigationTimeout(90000);const p=await c.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
await signIn(p,'admin@example.com');

// 1. The club's usual rules
ok(sql(`select default_best_of||'|'||default_game_points||'|'||default_win_by from clubs where id=${club}`)==='5|11|2','a club starts with best of 5, first to 11, win by two (what it always was)');
await p.goto(B+'/profile',{waitUntil:'networkidle'});
ok(/Match rules/.test(await body(p)),'the Club menu has a Match rules row');
await p.goto(B+'/profile/match-rules',{waitUntil:'networkidle'});
ok(await p.getByRole('radio',{name:'Best of 5, to 11'}).getAttribute('aria-checked')==='true','the current rules are selected');
ok(/A match is won by the first to win 3 games\. A game goes to 11\. At 10–10 a lead of two wins, with no limit\./.test(await body(p)),'a plain sentence says how it works, including what happens at 10–10');
await p.getByRole('radio',{name:'1 game, to 21'}).click();
ok(/A match is one game\. A game goes to 21\. At 20–20 a lead of two wins/.test(await body(p)),'choosing "1 game, to 21" updates the sentence');
await p.getByRole('button',{name:'Save match rules'}).click();
await p.getByRole('status').filter({hasText:/Match rules saved/}).waitFor({timeout:20000});
ok(sql(`select default_best_of||'|'||default_game_points||'|'||default_win_by from clubs where id=${club}`)==='1|21|2','the club default is saved');
await closeToasts(p);
// Custom: "next point wins"
await p.getByRole('radio',{name:'Custom'}).click();
await p.getByRole('radio',{name:'Next point wins'}).click();
ok(/At 20–20 the next point wins the game\./.test(await body(p)),'"Next point wins" says what happens at the tie');
await p.getByLabel('Points to win a game').fill('4');
await p.getByRole('button',{name:'Save match rules'}).click();
ok(await p.getByRole('alert').filter({hasText:/between 5 and 30/}).waitFor({timeout:20000}).then(()=>true).catch(()=>false),'4 points is refused in plain words');
await closeToasts(p);
await p.getByRole('radio',{name:'Win by two points'}).click();
await p.getByLabel('Points to win a game').fill('11');await p.getByLabel('Stop at (optional)').fill('11');
await p.getByRole('button',{name:'Save match rules'}).click();
ok(await p.getByRole('alert').filter({hasText:/limit must be above 11/}).waitFor({timeout:20000}).then(()=>true).catch(()=>false),'a limit at or below the target is refused');
await closeToasts(p);
// back to the 21 preset
await p.getByRole('radio',{name:'1 game, to 21'}).click();await p.getByRole('button',{name:'Save match rules'}).click();await p.getByRole('status').filter({hasText:/Match rules saved/}).waitFor({timeout:20000});await closeToasts(p);

// 2. A new competition starts with the club's rules and its matches are made with them
await p.goto(B+'/competition/new/senior/auto',{waitUntil:'networkidle'});
await p.getByLabel('What will you name this competition?').fill('Rules Cup');
await p.getByLabel('Start date').fill('2026-11-01');await p.getByLabel('End date').fill('2026-11-30');
ok(await p.getByRole('radio',{name:'1 game, to 21'}).getAttribute('aria-checked')==='true','the new competition form starts with the club\'s rules');
await p.getByRole('button',{name:'Create competition'}).click();await p.waitForURL(/\/groups/,{timeout:40000});
const cup=p.url().match(/competition\/([0-9a-f-]{36})/)[1];
ok(sql(`select best_of||'|'||game_points||'|'||win_by from competitions where id='${cup}'`)==='1|21|2','the competition stores the rules');
ok(sql(`select count(*) from matches where competition_id='${cup}' and best_of=1 and game_points=21 and win_by=2`)==='3','every match was made with them (1 game, to 21)');

// 3. Scoring follows the rules
const comp=sql(`insert into competitions (club_id, name, format, status, starts_on, ends_on, best_of, game_points, win_by) values (${club}, 'Scoring rules', 'one_on_one', 'active', '2030-01-01', '2030-01-10', 1, 21, 2) returning id`);
const mk=(bestOf,pts,winBy,cap)=>sql(`insert into matches (club_id, competition_id, round, player1_id, player2_id, best_of, game_points, win_by, point_cap) values (${club}, '${comp}', 'One on one', '${mid('ade')}', '${mid('jide')}', ${bestOf}, ${pts}, ${winBy}, ${cap===null?'null':cap}) returning id`);
const m21=mk(1,21,2,null), mNext=mk(1,11,1,null), mCap=mk(1,11,2,15), m7=mk(7,11,2,null);
const open=async(m)=>{await p.goto(B+`/competition/${comp}/score?match=${m}`,{waitUntil:'networkidle'});await body(p)};
await open(m21);
ok(/1 game · first to 21, win by 2/.test(await body(p)),'the scoring screen shows the rule: 1 game · first to 21, win by 2');
ok(/Game 1 of 1/.test(await body(p)),'and "Game 1 of 1"');
await click(p,0,11);
ok(!/Winner:/.test(await body(p)),'11 points does not end a game to 21');
await click(p,0,9);
ok(/Game point/.test(await body(p)),'at 20 the screen announces game point');
await click(p,0,1);
ok(/Winner: /.test(await body(p)),'21 points ends the game and the one-game match');
const ctxRules=await p.evaluate(async()=>new Promise(res=>{const r=indexedDB.open('rallix-offline',1);r.onsuccess=()=>{const g=r.result.transaction('matches').objectStore('matches').getAll();g.onsuccess=()=>res(g.result.map(x=>x.rules&&x.rules.points));g.onerror=()=>res(null)};r.onerror=()=>res(null)}));
ok(Array.isArray(ctxRules)&&ctxRules.includes(21),'the rules are saved on the phone with the match, so offline scoring uses them');
await p.getByRole('button',{name:'Save result'}).click();await p.waitForURL(/\/groups/,{timeout:40000});
ok(sql(`select status||'|'||games_p1||'-'||games_p2 from matches where id='${m21}'`)==='completed|1-0','the result is saved: the server accepted 21-0 under the 21 rule');

// "next point wins": 10-10 gives both players game point, 11-10 ends it
await open(mNext);
ok(/next point wins at 10–10/.test(await body(p)),'the rule line says "next point wins at 10–10"');
for(let i=0;i<10;i++){await click(p,0,1);await click(p,1,1)}
ok(/Game point for both: the next point wins the game/.test(await body(p)),'at 10–10 the screen says "Game point for both: the next point wins the game"');
ok(!/Winner:/.test(await body(p))&&!/Deuce/.test(await body(p)),'it is not a deuce, and the game is not over');
await click(p,1,1);
ok(/Winner: /.test(await body(p)),'the next point (11–10) ends the game');

// a hard limit
await open(mCap);
ok(/stop at 15/.test(await body(p)),'the rule line says "stop at 15"');
for(let i=0;i<14;i++){await click(p,0,1);await click(p,1,1)}
ok(/Game point for both/.test(await body(p)),'at 14–14 both players have game point');
await click(p,0,1);
ok(/Winner: /.test(await body(p)),'15–14 ends the game (the limit)');

// best of 7
await open(m7);
ok(/Best of 7 · first to 11, win by 2/.test(await body(p))&&/Game 1 of 7/.test(await body(p)),'best of 7 reads "Game 1 of 7"');
await p.goto(B+'/',{waitUntil:'networkidle'});

// 4. Rules of a competition can be edited until a match is played
const comp2=sql(`insert into competitions (club_id, name, format, status, starts_on, ends_on, best_of, game_points, win_by) values (${club}, 'Editable rules', 'one_on_one', 'active', '2030-01-01', '2030-01-10', 5, 11, 2) returning id`);
const e1=sql(`insert into matches (club_id, competition_id, round, player1_id, player2_id) values (${club}, '${comp2}', 'One on one', '${mid('ade')}', '${mid('jide')}') returning id`);
await p.goto(B+`/competition/${comp2}/details`,{waitUntil:'networkidle'});
ok(await p.getByRole('radio',{name:'Best of 5, to 11'}).getAttribute('aria-checked')==='true','the competition details show its rules');
await p.getByRole('radio',{name:'Best of 7, to 11'}).click();
await p.getByRole('button',{name:/^Save/}).last().click();
await p.getByRole('status').filter({hasText:/Saved/}).first().waitFor({timeout:20000});
ok(sql(`select best_of from competitions where id='${comp2}'`)==='7'&&sql(`select best_of from matches where id='${e1}'`)==='7','changing it updates the competition and its unplayed matches');
sql(`update matches set status='completed', winner_id='${mid('ade')}', games_p1=4, games_p2=0, confirmed_at=now() where id='${e1}'`);
await closeToasts(p);
await p.goto(B+`/competition/${comp2}/details`,{waitUntil:'networkidle'});
ok(/A match has already been played, so this can no longer change/.test(await body(p))&&await p.getByRole('radio',{name:'Best of 5, to 11'}).count()===0,'once a match is played the rules are shown but locked');
ok(sql(`select best_of from matches where id='${e1}'`)==='7','the played match keeps its rules');

// 5. Layout: separate pills that wrap (not a scrolling tab strip)
await p.goto(B+'/profile/match-rules',{waitUntil:'networkidle'});await p.getByRole('radio',{name:'Custom'}).click();
for(const w of [440,320]){
  await p.setViewportSize({width:w,height:956});await p.waitForTimeout(300);
  const g=await p.evaluate(()=>{const panel=document.querySelector('.rx-panel');const pr=panel.getBoundingClientRect();const pr0=getComputedStyle(panel).borderRadius;
    const groups=[...document.querySelectorAll('.rx-chips')].map(c=>{const chips=[...c.querySelectorAll('.rx-chip')];const rows=new Set(chips.map(x=>Math.round(x.getBoundingClientRect().top)));
      const cs=getComputedStyle(c);return {n:chips.length,rows:rows.size,noScroll:c.scrollWidth<=c.clientWidth+1&&cs.overflowX!=='auto'&&cs.overflowX!=='scroll',inside:chips.every(x=>{const r=x.getBoundingClientRect();return r.left>=pr.left-1&&r.right<=pr.right+1}),tall:chips.every(x=>x.getBoundingClientRect().height>=44),
        sep:chips.every(x=>{const s=getComputedStyle(x);return parseFloat(s.borderTopWidth)>=1&&s.borderRadius===pr0}),notTrack:getComputedStyle(c).backgroundColor==='rgba(0, 0, 0, 0)'}});
    return {pr0,groups,segs:document.querySelectorAll('.rx-seg').length}});
  ok(g.groups.length>=3,`${w}px: the picker has separate pill groups (${g.groups.length}): format, games, tie`);
  ok(g.segs===0,`${w}px: no tab strip (Segmented) on the page`);
  ok(g.groups.every(x=>x.noScroll),`${w}px: nothing scrolls sideways`);
  ok(g.groups.every(x=>x.inside),`${w}px: every pill stays inside the panel`);
  ok(g.groups.every(x=>x.tall),`${w}px: every pill is at least 44px tall`);
  ok(g.groups.every(x=>x.sep),`${w}px: every pill has its own border and the panel's corner roundness (${g.pr0})`);
  ok(g.groups.every(x=>x.notTrack),`${w}px: the pills do not sit on a shared track`);
  ok(g.groups[0].rows>=2,`${w}px: the format pills wrap onto ${g.groups[0].rows} rows`);
}
await p.setViewportSize({width:440,height:956});await p.waitForTimeout(300);
await p.screenshot({path:(process.env.OUT||'/tmp')+'/match_rules_pills.png',fullPage:true});
// the selected pill shows a check, and the arrow keys move the choice
const sel=p.getByRole('radio',{name:/^Custom$/});ok(await sel.locator('svg').count()===1&&(await sel.getAttribute('aria-checked'))==='true','the selected pill shows a check and aria-checked');
await p.getByRole('radio',{name:'Best of 7, to 11'}).click();await p.getByRole('radio',{name:'Best of 7, to 11'}).focus();await p.keyboard.press('ArrowRight');
ok((await p.getByRole('radio',{name:'1 game, to 21'}).getAttribute('aria-checked'))==='true','the arrow keys move the choice to the next pill');
await p.getByRole('radio',{name:'Custom'}).click();
const small=await p.evaluate(()=>[...document.querySelectorAll('button,a,input,select,[role=radio]')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&r.height<44}).map(e=>e.tagName+':'+(e.getAttribute('aria-label')||e.textContent||'').slice(0,24)));
ok(small.length===0,'every control on the rules page is at least 44px tall '+small.join(','));
ok(!(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth)),'no sideways scroll');
ok(errs.length===0,'no console errors '+errs.join('|'));
sql(`update clubs set default_best_of=5, default_game_points=11, default_win_by=2, default_point_cap=null where id=${club}`);
console.log(`\n${pass} passed, ${fail} failed`);await b.close();process.exit(fail?1:0)})().catch(e=>{console.error('CRASH',e.message);process.exit(2)});
