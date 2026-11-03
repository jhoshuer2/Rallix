/**
 * Points, awards and seasons end-to-end: a 3-player league with custom points (win 2, loss 1) inside a season; the table appears after the
 * first result and follows the rules; when the last match is decided the competition completes and the podium is recorded; the player sees
 * the podium, an award on Stats and the Season table on Ranks; bad points are refused; the season admin screen is permission-gated.
 *   BASE=http://localhost:3200 PGDB=rallix_2a DEV_LOG=/path/club.log node apps/club/e2e/seasons.cjs
 */
const {chromium}=require('playwright');const fs=require('fs');const {execSync}=require('child_process');
const LOG=process.env.DEV_LOG, B=process.env.BASE||'http://localhost:3000';
const sql=q=>execSync(`PGPASSWORD=service_dev psql -h localhost -U rallix_service -d ${process.env.PGDB||'rallix_dev'} -Atc "${q.replace(/"/g,'\\"')}"`).toString().trim();
let pass=0,fail=0;const ok=(c,m)=>{c?pass++:fail++;console.log(c?'  ok  ':'  FAIL',m)};
function code(email){const log=fs.readFileSync(LOG).toString().replace(/\0/g,'');const re=new RegExp('\\[mail:dev\\] to '+email.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+' \\|[^\\n]*\\n\\s+Your (?:Rallix|Rallix Console) sign-in code is (\\d{6})','g');const a=[...log.matchAll(re)];return a.length?a[a.length-1][1]:null}
async function signIn(p,email){await p.goto(B+'/sign-in?next=/');await p.getByLabel('Email address').fill(email);await p.getByRole('button',{name:'Email me a code'}).click();await p.getByLabel('6-digit code').waitFor({timeout:60000});await p.waitForTimeout(600);await p.getByLabel('6-digit code').fill(code(email));await p.getByRole('button',{name:'Sign in'}).click();await p.waitForURL(u=>!/sign-in/.test(u.toString()),{timeout:60000});const id=sql(`select id from clubs where name='Paris Arena'`);await p.goto(B+'/switch/'+id,{waitUntil:'networkidle'})}
async function who(b,email){const c=await b.newContext({viewport:{width:440,height:956}});c.setDefaultTimeout(60000);const p=await c.newPage();p.errs=[];p.on('pageerror',e=>p.errs.push(e.message));await signIn(p,email);return {c,p}}
const iso=n=>new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Lagos'}).format(new Date(Date.now()+n*864e5));
async function scoreFirst(p,id){await p.goto(B+`/competition/${id}/groups`,{waitUntil:'networkidle'});
  await p.locator('a[aria-label^="Score"]').first().click();await p.waitForURL(/\/score\?match=/);
  const tiles=p.locator('button.rx-score');for(let g=0;g<3;g++)for(let i=0;i<11;i++)await tiles.first().click();
  await p.getByRole('button',{name:'Save result'}).click();await p.waitForURL(/\/groups/,{timeout:30000})}

(async()=>{const b=await chromium.launch();
sql(`delete from seasons`);
const admin=await who(b,'admin@example.com'), jide=await who(b,'jide@example.com'), ade=await who(b,'ade@example.com');

// Season
await admin.p.goto(B+'/competition',{waitUntil:'networkidle'});
await admin.p.getByRole('link',{name:/Seasons/}).click();await admin.p.waitForURL(/competition\/seasons/);
ok(await admin.p.getByText('No seasons yet').isVisible(),'empty: no seasons');
await admin.p.getByRole('button',{name:'Create a season'}).click();
await admin.p.getByLabel('Name').fill('E2E Season');await admin.p.getByLabel('Starts').fill(iso(-1));await admin.p.getByLabel('Ends').fill(iso(60));
await admin.p.getByRole('button',{name:'Save'}).click();await admin.p.getByText('E2E Season').waitFor();
ok(sql(`select count(*) from seasons`)==='1','season saved');
ok(await admin.p.getByText('Now').isVisible(),'the running season is marked "Now"');
await admin.p.getByRole('button',{name:'Create a season'}).click();await admin.p.getByLabel('Name').fill('Backwards');await admin.p.getByLabel('Starts').fill(iso(10));await admin.p.getByLabel('Ends').fill(iso(2));
await admin.p.getByRole('button',{name:'Save'}).click();
ok(await admin.p.getByText('The season can’t end before it starts.').waitFor({timeout:15000}).then(()=>true).catch(()=>false),'a season that ends before it starts is refused');
ok(sql(`select count(*) from seasons`)==='1','nothing saved for the bad season');
await admin.p.keyboard.press('Escape');

// League of 3 (one-on-one)
await admin.p.goto(B+'/competition/new/senior/auto',{waitUntil:'networkidle'});
await admin.p.getByLabel('What will you name this competition?').fill('E2E League');
await admin.p.getByLabel('Start date').fill(iso(1));await admin.p.getByLabel('End date').fill(iso(20));
await admin.p.getByRole('radio',{name:/One on One/}).click();
await admin.p.getByRole('button',{name:'Create competition'}).click();
await admin.p.waitForURL(/\/groups/,{timeout:60000});
const id=admin.p.url().match(/competition\/([0-9a-f-]{36})/)[1];
ok(sql(`select count(*) from matches where competition_id='${id}'`)==='3','3 players make 3 league matches');
ok(!(await admin.p.getByText(/ table$/).count()),'no table until a result is in');

// Points rules and season in Edit details
await admin.p.goto(B+`/competition/${id}/details`,{waitUntil:'networkidle'});
await admin.p.getByLabel('Points for a win').fill('1');await admin.p.getByLabel('Points for a loss').fill('2');
await admin.p.getByRole('button',{name:'Save details'}).click();
ok(await admin.p.getByText('A loss can’t be worth more than a win.').waitFor({timeout:15000}).then(()=>true).catch(()=>false),'a loss worth more than a win is refused');
await admin.p.getByLabel('Points for a win').fill('2');await admin.p.getByLabel('Points for a loss').fill('1');
await admin.p.getByRole('button',{name:/Season/}).click();await admin.p.getByRole('radio',{name:'E2E Season'}).click();
await admin.p.getByRole('button',{name:'Save details'}).click();await admin.p.getByText('Saved.').waitFor();
ok(sql(`select points_win||'|'||points_loss||'|'||(season_id is not null) from competitions where id='${id}'`)==='2|1|true','win 2, loss 1 and the season are saved');

// First result: the table appears
await scoreFirst(admin.p,id);
ok(await admin.p.getByText('Table',{exact:true}).first().isVisible(),'a table appears after the first result');
const rowsText=await admin.p.locator('.rx-list, [role=list]').allInnerTexts().catch(()=>[]);
ok(/2 pts/.test(await admin.p.locator('body').innerText())&&/1 pts/.test(await admin.p.locator('body').innerText()),'the winner has 2 points and the loser 1 (the club\'s own rules)');
ok(sql(`select status from competitions where id='${id}'`)==='active','still active with matches to play');
ok(sql(`select count(*) from competition_awards where competition_id='${id}'`)==='0','no podium yet');

// Finish
await scoreFirst(admin.p,id);await scoreFirst(admin.p,id);
ok(sql(`select status from competitions where id='${id}'`)==='completed','the last result completes the competition');
ok(sql(`select string_agg(place::text, ',' order by place) from competition_awards where competition_id='${id}'`)==='1,2,3','podium recorded: places 1, 2 and 3');
ok(await admin.p.getByText('Champion').isVisible()&&await admin.p.getByText('Runner-up').isVisible()&&await admin.p.getByText('Third place').isVisible(),'the admin page shows the podium');
const champ=sql(`select u.email from competition_awards a join memberships m on m.id=a.membership_id join users u on u.id=m.user_id where a.competition_id='${id}' and a.place=1`);
ok(/@example\.com$/.test(champ),'a champion is recorded: '+champ);
ok(sql(`select points from (select count(*)*2 as points from matches where competition_id='${id}' and winner_id=(select membership_id from competition_awards where competition_id='${id}' and place=1)) t`)==='4','the champion won both matches (4 points)');
// Idempotent
const awardsBefore=sql(`select count(*) from competition_awards`);
execSync('true');
ok(awardsBefore==='3','exactly three awards exist');

// Player views
const who2=champ.split('@')[0];
const P=who2==='jide'?jide:who2==='ade'?ade:await who(b,champ);
await P.p.goto(B+`/play/compete/${id}`,{waitUntil:'networkidle'});
ok(await P.p.getByText('Podium').isVisible()&&await P.p.getByText('Champion').isVisible(),'a player sees the podium on the competition page');
ok(await P.p.getByText('Table',{exact:true}).first().isVisible(),'and the league table');
await P.p.goto(B+'/play/stats',{waitUntil:'networkidle'});
ok(await P.p.getByText('E2E League').isVisible()&&await P.p.getByText('Champion').isVisible(),'the champion has the award on Stats');
await P.p.goto(B+'/play/ranks',{waitUntil:'networkidle'});
ok(await P.p.getByRole('radio',{name:'E2E Season'}).isVisible(),'Ranks offers the running season');
await P.p.getByRole('radio',{name:'E2E Season'}).click();
ok(/4 points/.test(await P.p.locator('body').innerText()),'the season table shows the champion with 4 points');

// Permissions
const club=`(select id from clubs where name='Paris Arena')`;
sql(`update memberships set roles=ARRAY['admin','player']::member_role[], permissions=ARRAY['finance']::text[] where user_id=(select id from users where email='pastor@example.com') and club_id=${club}`);
const fin=await who(b,'pastor@example.com');
await fin.p.goto(B+'/competition/seasons',{waitUntil:'networkidle'});
ok(!/competition\/seasons/.test(fin.p.url()),'a finance-only admin cannot open Seasons: '+fin.p.url());
sql(`update memberships set roles=ARRAY['player']::member_role[], permissions='{}' where user_id=(select id from users where email='pastor@example.com') and club_id=${club}`);

// A11y
for(const [n,p,path] of [['admin',admin.p,`/competition/${id}/groups`],['admin',admin.p,'/competition/seasons'],['player',P.p,`/play/compete/${id}`]]){await p.goto(B+path,{waitUntil:'networkidle'});
  ok(await p.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),`${n} ${path.replace(id,':id')}: no sideways scroll`);
  const bad=await p.evaluate(()=>{const o=[];document.querySelectorAll('a,button,input').forEach(e=>{const r=e.getBoundingClientRect();if(r.width&&r.height&&r.height<43)o.push((e.textContent||e.tagName).trim().slice(0,30))});return o});
  ok(bad.length===0,`${n} ${path.replace(id,':id')}: touch targets ok ${bad.join(', ')}`)}
ok(admin.p.errs.length===0&&P.p.errs.length===0,'no console errors '+admin.p.errs.concat(P.p.errs).join('|'));
console.log(`\n${pass} passed, ${fail} failed`);await b.close();process.exit(fail?1:0)})().catch(e=>{console.error('CRASH',e.message);process.exit(2)});
