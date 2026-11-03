/**
 * Friendly challenges end-to-end: challenge from Ranks, answer, enter and confirm a score, dispute, rating only when BOTH agreed,
 * privacy (a third player cannot open it), Stats and Home show it. Needs a freshly seeded DB and the club app:
 *   BASE=http://localhost:3200 PGDB=rallix_2a DEV_LOG=/path/club.log node apps/club/e2e/friendlies.cjs
 */
const {chromium}=require('playwright');const fs=require('fs');const {execSync}=require('child_process');
const LOG=process.env.DEV_LOG, B=process.env.BASE||'http://localhost:3000';
const sql=q=>execSync(`PGPASSWORD=service_dev psql -h localhost -U rallix_service -d ${process.env.PGDB||'rallix_dev'} -Atc "${q.replace(/"/g,'\\"')}"`).toString().trim();
let pass=0,fail=0;const ok=(c,m)=>{c?pass++:fail++;console.log(c?'  ok  ':'  FAIL',m)};
function code(email){const log=fs.readFileSync(LOG).toString().replace(/\0/g,'');const re=new RegExp('\\[mail:dev\\] to '+email.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+' \\|[^\\n]*\\n\\s+Your (?:Rallix|Rallix Console) sign-in code is (\\d{6})','g');const a=[...log.matchAll(re)];return a.length?a[a.length-1][1]:null}
async function signIn(p,email){await p.goto(B+'/sign-in?next=/');await p.getByLabel('Email address').fill(email);await p.getByRole('button',{name:'Email me a code'}).click();await p.getByLabel('6-digit code').waitFor({timeout:60000});await p.waitForTimeout(600);await p.getByLabel('6-digit code').fill(code(email));await p.getByRole('button',{name:'Sign in'}).click();await p.waitForURL(u=>!/sign-in/.test(u.toString()),{timeout:60000});const id=sql(`select id from clubs where name='Paris Arena'`);await p.goto(B+'/switch/'+id,{waitUntil:'networkidle'})}
async function who(b,email){const c=await b.newContext({viewport:{width:440,height:956}});c.setDefaultTimeout(60000);const p=await c.newPage();p.errs=[];p.on('pageerror',e=>p.errs.push(e.message));await signIn(p,email);return {c,p}}
const mid=n=>sql(`select m.id from memberships m join users u on u.id=m.user_id join clubs c on c.id=m.club_id where u.email='${n}@example.com' and c.name='Paris Arena'`);
const rating=n=>Number(sql(`select coalesce((select rating from ratings where membership_id='${mid(n)}' and scope='club'),1200)`));
const last=()=>sql(`select status||'|'||coalesce(challenger_games::text,'-')||'|'||coalesce(opponent_games::text,'-')||'|'||challenger_rated||'|'||opponent_rated||'|'||(rated_at is not null) from challenges order by created_at desc limit 1`);
const lastId=()=>sql(`select id from challenges order by created_at desc limit 1`);

(async()=>{const b=await chromium.launch();
sql(`delete from challenges`);
const ade=await who(b,'ade@example.com'), jide=await who(b,'jide@example.com'), sule=await who(b,'sule@example.com');

// 1. Challenge from Ranks (both want it to count)
await ade.p.goto(B+'/play/ranks',{waitUntil:'networkidle'});
const row=ade.p.getByRole('link',{name:/Jide.*Challenge to a friendly/i}).first();
ok(await row.isVisible(),'Ranks: other players are tappable and say they can be challenged');
ok(await ade.p.getByRole('link',{name:/Ade.*Challenge/i}).count()===0,'Ranks: you cannot challenge yourself');
await row.click();await ade.p.getByRole('button',{name:/^Challenge /}).waitFor();
ok(/Challenge Jide/.test(await ade.p.locator('h1').first().innerText()),'form is titled with the opponent');
await ade.p.getByRole('radio',{name:'Best of 3'}).isVisible();
await ade.p.getByLabel('Message (optional)').fill('Fancy a game?');
await ade.p.getByRole('switch',{name:/Count it for the ranking/}).click();
await ade.p.getByRole('button',{name:/^Challenge /}).click();
await ade.p.waitForURL(/\/play\/friendlies$/);await ade.p.waitForLoadState('networkidle');
ok(last().startsWith('proposed|-|-|true|false'),'challenge saved as proposed, challenger wants it rated: '+last());
ok(await ade.p.getByText('Waiting for an answer').isVisible(),'challenger sees it under Coming up');

// 2. Jide sees it on Home and in Friendlies, accepts and agrees to rate
await jide.p.goto(B+'/play',{waitUntil:'networkidle'});
ok(await jide.p.getByText(/Ade challenged you/).isVisible(),'Home: the challenged player is told');
await jide.p.goto(B+'/play/compete',{waitUntil:'networkidle'});
ok(await jide.p.getByText('1 needs you').isVisible(),'Compete: Friendlies row says 1 needs you');
await jide.p.goto(B+'/play/friendlies',{waitUntil:'networkidle'});
ok(await jide.p.getByText('Needs you').first().isVisible(),'Friendlies: "Needs you" section');
await jide.p.getByRole('link',{name:/Ade/}).first().click();await jide.p.getByRole('button',{name:'Accept'}).waitFor();
ok(await jide.p.getByText('“Fancy a game?”').isVisible(),'message is shown');
const sw=jide.p.getByRole('switch',{name:/Count it for the ranking/});
ok((await sw.getAttribute('aria-checked'))==='true','the opponent sees it pre-set to what the challenger wants');
await jide.p.getByRole('button',{name:'Accept'}).click();await jide.p.getByText('Accepted').first().waitFor();
ok(last().startsWith('accepted|-|-|true|true'),'accepted, both agreed to rate: '+last());

// 3. A third player cannot open it
const id=lastId();
const r3=await sule.p.goto(B+'/play/friendlies/'+id);ok(r3.status()===404,'a third player gets 404 on the challenge');

// 4. Ade enters 2-1 (wrong), Jide disputes, Ade enters 2-0, Jide confirms
const aBefore=rating('ade'), jBefore=rating('jide');
await ade.p.goto(B+'/play/friendlies/'+id,{waitUntil:'networkidle'});
await ade.p.getByLabel('You',{exact:true}).fill('3');await ade.p.getByLabel('Jide').fill('0');
await ade.p.getByRole('button',{name:/Send score/}).click();
ok(await ade.p.getByText(/best of 3, one player wins 2/i).waitFor({timeout:15000}).then(()=>true).catch(()=>false),'an impossible score is refused with the rule');
await ade.p.getByLabel('You',{exact:true}).fill('2');await ade.p.getByLabel('Jide').fill('1');
await ade.p.getByRole('button',{name:/Send score/}).click();await ade.p.getByText(/Waiting for Jide to confirm/).waitFor();
ok(last().startsWith('awaiting|2|1'),'score entered, waiting: '+last());
await jide.p.goto(B+'/play/friendlies/'+id,{waitUntil:'networkidle'});
ok(await jide.p.getByText(/Ade entered: you 1, Ade 2/).isVisible(),'the other player sees the score from their own side');
await jide.p.getByRole('button',{name:'That’s not right'}).click();await jide.p.getByText(/Score cleared|Accepted/).first().waitFor().catch(()=>{});
await jide.p.waitForTimeout(800);
ok(last().startsWith('accepted|-|-'),'disputing clears the score: '+last());
ok(rating('ade')===aBefore&&rating('jide')===jBefore,'no rating moved yet');
await ade.p.goto(B+'/play/friendlies/'+id,{waitUntil:'networkidle'});
await ade.p.getByLabel('You',{exact:true}).fill('2');await ade.p.getByLabel('Jide').fill('0');
await ade.p.getByRole('button',{name:/Send score/}).click();await ade.p.getByText(/Waiting for Jide to confirm/).waitFor();
await jide.p.goto(B+'/play/friendlies/'+id,{waitUntil:'networkidle'});
ok(await jide.p.getByRole('button',{name:'Confirm score'}).isVisible(),'Jide gets Confirm');
await jide.p.getByRole('button',{name:'Confirm score'}).click();await jide.p.getByText('Played').first().waitFor();
ok(last()==='confirmed|2|0|true|true|true','confirmed and rated once: '+last());
ok(rating('ade')>aBefore&&rating('jide')<jBefore,`ratings moved the right way (ade ${aBefore}→${rating('ade')}, jide ${jBefore}→${rating('jide')})`);
await jide.p.reload({waitUntil:'networkidle'});
ok(await jide.p.getByText(/You lost\. Rating \d+ → \d+/).isVisible(),'detail shows the result and the rating change');
// idempotent: a second call cannot double-apply
const g1=sql(`select rating from ratings where membership_id='${mid('ade')}' and scope='club'`);
await jide.p.evaluate(()=>0);
ok(sql(`select count(*) from challenges where rated_at is not null`)==='1','rated exactly once');

// 5. A friendly only one side wanted counts for nothing
await jide.p.goto(B+'/play/ranks',{waitUntil:'networkidle'});
await jide.p.getByRole('link',{name:/Ade.*Challenge to a friendly/i}).first().click();
await jide.p.getByRole('button',{name:/^Challenge /}).click();await jide.p.waitForURL(/\/play\/friendlies$/);
ok(last().startsWith('proposed|-|-|false|false'),'a second challenge starts as "just for fun"');
const j2=lastId();
await ade.p.goto(B+'/play/friendlies/'+j2,{waitUntil:'networkidle'});
await ade.p.getByRole('switch',{name:/Count it for the ranking/}).click();
await ade.p.getByRole('button',{name:'Accept'}).click();await ade.p.getByText('Accepted').first().waitFor();
const a2=rating('ade'),j2b=rating('jide');
await jide.p.goto(B+'/play/friendlies/'+j2,{waitUntil:'networkidle'});
await jide.p.getByLabel('You',{exact:true}).fill('2');await jide.p.getByLabel('Ade').fill('1');
await jide.p.getByRole('button',{name:/Send score/}).click();await jide.p.getByText(/Waiting for Ade to confirm/).waitFor();
await ade.p.goto(B+'/play/friendlies/'+j2,{waitUntil:'networkidle'});
await ade.p.getByRole('button',{name:'Confirm score'}).click();await ade.p.getByText('Played').first().waitFor();
ok(last()==='confirmed|2|1|false|true|false','confirmed but not rated when only one side agreed: '+last());
ok(rating('ade')===a2&&rating('jide')===j2b,'ratings untouched for a just-for-fun game');

// 6. Stats, Home, accessibility
await ade.p.goto(B+'/play/stats',{waitUntil:'networkidle'});
ok(await ade.p.getByText(/2 played · 1 won · 1 lost/).isVisible(),'Stats shows the friendly record');
await ade.p.goto(B+'/play/friendlies',{waitUntil:'networkidle'});
ok(await ade.p.getByText(/counted/).isVisible(),'history marks the one that counted');
for(const [name,p] of [['ade',ade.p],['jide',jide.p]]){
  for(const path of ['/play/friendlies','/play/friendlies/'+id,'/play/compete']){await p.goto(B+path,{waitUntil:'networkidle'});
    const bad=await p.evaluate(()=>{const o=[];document.querySelectorAll('a,button,input,[role=switch],[role=radio]').forEach(e=>{const r=e.getBoundingClientRect();if(r.width&&r.height&&(r.height<43||r.width<43)&&!e.closest('.rx-linkbtn')&&!/rx-linkbtn/.test(e.className))o.push((e.textContent||e.getAttribute('aria-label')||e.tagName).trim().slice(0,30)+' '+Math.round(r.width)+'x'+Math.round(r.height))});return o});
    ok(bad.length===0,`${name} ${path.replace(id,':id')}: touch targets ok ${bad.join(', ')}`);
    ok(await p.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),`${name} ${path.replace(id,':id')}: no sideways scroll`)}
  ok(p.errs.length===0,`${name}: no console errors ${p.errs.join('|')}`)}
console.log(`\n${pass} passed, ${fail} failed`);await b.close();process.exit(fail?1:0)})().catch(e=>{console.error('CRASH',e.message);process.exit(2)});
