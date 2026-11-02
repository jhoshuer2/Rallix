/**
 * Competition preview and self sign-up end to end: admin creates an open competition (2 spots, closing date), edits the details
 * (cover upload, summary, prize, rules); players see the preview, join, fill the last spot, leave and rejoin; a hidden draft stays hidden;
 * the admin adds a player and starts the competition (fixtures appear, joining closes). Checks 44px targets, no sideways scroll, no console errors.
 * Needs a freshly seeded DB and the club app running:  OUT=/tmp DEV_LOG=/tmp/club.log node apps/club/e2e/competition-preview.cjs
 */
const {chromium}=require('playwright');const fs=require('fs');const path=require('path');const {execSync}=require('child_process');
const sharp=require(require.resolve('sharp',{paths:[path.join(process.cwd(),'packages/media')]}));
const SC=process.env.OUT||'/tmp', LOG=process.env.DEV_LOG, B='http://localhost:3000', DATA=path.join(process.cwd(),'apps/club/.data/media');
const sql=q=>execSync(`PGPASSWORD=service_dev psql -h localhost -U rallix_service -d rallix_dev -Atc "${q.replace(/"/g,'\\"')}"`).toString().trim();
let pass=0,fail=0;const ok=(c,m)=>{c?pass++:fail++;console.log(c?'  ok  ':'  FAIL',m)};
function code(email){const log=fs.readFileSync(LOG).toString().replace(/\0/g,'');const re=new RegExp('\\[mail:dev\\] to '+email.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+' \\|[^\\n]*\\n\\s+Your (?:Rallix|Rallix Console) sign-in code is (\\d{6})','g');const a=[...log.matchAll(re)];return a.length?a[a.length-1][1]:null}
async function signIn(p,email){await p.goto(B+'/sign-in?next=/');await p.getByLabel('Email address').fill(email);await p.getByRole('button',{name:'Email me a code'}).click();await p.getByLabel('6-digit code').waitFor({timeout:25000});await p.waitForTimeout(600);await p.getByLabel('6-digit code').fill(code(email));await p.getByRole('button',{name:'Sign in'}).click();await p.waitForURL(u=>!/sign-in/.test(u.toString()),{timeout:25000});const id=sql(`select id from clubs where name='Paris Arena'`);await p.goto(B+'/switch/'+id)}
async function who(b,email){const c=await b.newContext({viewport:{width:440,height:956}});const p=await c.newPage();p.errs=[];p.on('pageerror',e=>p.errs.push(e.message));p.on('console',m=>{if(m.type()==='error'&&!/DeprecationWarning|Failed to load resource/.test(m.text()))p.errs.push(m.text())});await signIn(p,email);return p}
const text=async p=>(await p.locator('body').innerText());
const iso=d=>{const x=new Date(Date.now()+d*86400000);return x.toISOString().slice(0,10)};
const small=async p=>p.evaluate(()=>[...document.querySelectorAll('button,a,[role=switch]')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&(r.height<44||r.width<44)&&getComputedStyle(e).visibility!=='hidden'&&!e.closest('dialog:not([open])')}).map(e=>(e.getAttribute('aria-label')||e.textContent||'').trim().slice(0,30)));
const stateOf=id=>sql(`select status||','||open_registration||','||coalesce(max_players::text,'-') from competitions where id='${id}'`);

(async()=>{
  fs.rmSync(DATA,{recursive:true,force:true});
  const tmp=fs.mkdtempSync('/tmp/rallix-cp-');const cover=path.join(tmp,'cover.jpg');await sharp({create:{width:1600,height:1000,channels:3,background:{r:20,g:90,b:210}}}).jpeg().toFile(cover);
  const b=await chromium.launch();

  // ---------- Admin creates an open competition ----------
  const A=await who(b,'admin@example.com');
  await A.goto(B+'/competition/new/combined/auto');
  await A.getByLabel('What will you name this competition?').fill('Spring Open');
  await A.getByLabel('Start date').fill(iso(10));await A.getByLabel('End date').fill(iso(20));
  await A.getByRole('switch',{name:'Players can join themselves'}).click();
  await A.getByLabel('Spot limit (optional)').fill('2');await A.getByLabel('Sign-up closes (optional)').fill(iso(5));
  ok(await A.getByText(/Players already in \(0\)/).isVisible(),'turning on open sign-up clears the pre-selected players');
  await A.getByRole('button',{name:'Open sign-up'}).click();await A.waitForURL(/\/competition\/[0-9a-f-]{36}\/groups/,{timeout:25000});
  const id=A.url().match(/competition\/([0-9a-f-]{36})/)[1];
  ok(stateOf(id)==='draft,true,2','created as an open draft with 2 spots: '+stateOf(id));
  ok(sql(`select count(*) from matches where competition_id='${id}'`)==='0','no fixtures exist before the competition starts');
  ok(await A.getByText('Sign-up open').first().isVisible()&&await A.getByText('0 of 2 spots').isVisible(),'admin page shows sign-up open and 0 of 2 spots');
  ok(await A.getByRole('button',{name:'Start competition'}).isDisabled(),'Start is disabled with fewer than two players');

  // ---------- Admin edits the details ----------
  await A.getByRole('link',{name:'Edit details'}).click();await A.waitForURL(/details/);
  await A.getByRole('button',{name:/Add a picture/}).click();await A.locator('dialog[open] input[type=file]:not([capture])').first().setInputFiles(cover);await A.getByRole('button',{name:'Use picture'}).click();await A.getByText('Picture updated.').waitFor({timeout:20000});
  const url=sql(`select coalesce(cover_url,'') from competitions where id='${id}'`);ok(/^\/media\/clubs\/[0-9a-f-]{36}\/competition\/[0-9a-f-]{36}\.webp$/.test(url),'cover stored as WebP under the competition folder: '+url);
  ok(fs.readdirSync(path.join(DATA,'clubs',sql(`select id from clubs where name='Paris Arena'`),'competition')).length===1,'exactly one cover file on disk');
  await A.waitForLoadState('networkidle');
  await A.getByLabel(/One-line summary/).fill('Our season opener. Everyone welcome.');await A.getByLabel('Prize (optional)').fill('Trophy and ₦50,000');
  await A.getByLabel('Rules (optional)').fill('Best of five games.\nMatches start on time.');
  await A.getByRole('button',{name:'Save details'}).click();await A.getByText('Saved.').waitFor({timeout:15000});
  ok(sql(`select summary||'|'||prize from competitions where id='${id}'`)==='Our season opener. Everyone welcome.|Trophy and ₦50,000','details saved');
  await A.getByLabel('Spot limit (optional)').fill('1');await A.getByRole('button',{name:'Save details'}).click();
  ok(await A.getByText('Spot limit').first().isVisible(),'details form stays usable');
  await A.getByLabel('Spot limit (optional)').fill('2');await A.getByRole('button',{name:'Save details'}).click();await A.getByText('Saved.').waitFor({timeout:15000});

  // ---------- Players see the preview and join ----------
  const ade=await who(b,'ade@example.com');
  await ade.goto(B+'/play/compete');await ade.getByRole('radio',{name:'Upcoming'}).click();
  ok(await ade.getByText('Spring Open').isVisible()&&await ade.getByText(/0 of 2 spots/).isVisible(),'the open competition is listed for a player who is not in it');
  ok(await ade.getByText('Open',{exact:true}).first().isVisible(),'it is tagged Open');
  await ade.goto(B+'/play');ok(await ade.getByText('Spring Open').first().isVisible(),'it also appears on the player home');
  await ade.goto(B+'/play/compete');await ade.getByRole('radio',{name:'Upcoming'}).click();await ade.getByText('Spring Open').first().click();await ade.waitForURL(/play\/compete\/[0-9a-f-]{36}/);
  let t=await text(ade);
  ok(/Spring Open/i.test(t)&&/Our season opener/.test(t),'preview hero shows the name and the one-line summary');
  ok(/Starts in \d+d/.test(t),'the start date has a live countdown');
  ok(/Trophy and ₦50,000/.test(t)&&/Prize/.test(t),'the prize row is shown');
  ok(/0 of 2 spots/.test(t)&&/Sign-up closes/.test(t),'spots and the closing date are shown');
  ok(await ade.getByRole('button',{name:'Join competition'}).isVisible(),'one main button: Join competition');
  ok((await ade.getByRole('button',{name:/Join|Registered|Leave/}).count())===1,'only one action is visible before joining');
  await ade.getByRole('button',{name:/Rules/}).click();const dlg=ade.locator('dialog[open]');await dlg.waitFor();
  ok(/Matches start on time/.test(await dlg.innerText()),'Rules open in a sheet');
  const head0=await dlg.locator('.rx-sheetdlg__head').boundingBox();await dlg.locator('.rx-sheetdlg__body').evaluate(e=>e.scrollTop=50);const head1=await dlg.locator('.rx-sheetdlg__head').boundingBox();ok(head0.y===head1.y,'the rules sheet header stays fixed');
  await ade.keyboard.press('Escape');
  await ade.getByRole('button',{name:'Join competition'}).click();await ade.getByText('Registered ✓').waitFor({timeout:15000});
  ok(sql(`select count(*) from competition_entries where competition_id='${id}'`)==='1','Ade joined: one entry');
  ok(/1 of 2 spots/.test(await text(ade)),'the count updates to 1 of 2 spots');
  ok(await ade.getByRole('button',{name:'Leave competition'}).isVisible(),'a quiet Leave action appears once registered');
  const sm=await small(ade);console.log('   preview targets under 44px:',sm);ok(sm.length===0,'preview targets are 44px or larger');
  ok(!(await ade.evaluate(()=>document.documentElement.scrollWidth>innerWidth)),'no sideways scroll on the preview');
  await ade.screenshot({path:SC+'/preview_player.png',fullPage:true});

  const pastor=await who(b,'pastor@example.com');await pastor.goto(B+'/play/compete/'+id);
  await pastor.getByRole('button',{name:'Join competition'}).click();await pastor.getByText('Registered ✓').waitFor({timeout:15000});
  ok(/2 of 2 spots/.test(await text(pastor)),'the second player fills the last spot');
  const jide=await who(b,'jide@example.com');await jide.goto(B+'/play/compete/'+id);
  ok(await jide.getByRole('button',{name:'Full'}).isDisabled()&&(await jide.getByRole('button',{name:'Join competition'}).count())===0,'a third player sees Full and cannot join');
  // Ade leaves, Jide takes the spot
  await ade.getByRole('button',{name:'Leave competition'}).click();await ade.getByRole('button',{name:'Join competition'}).waitFor({timeout:15000});
  ok(sql(`select count(*) from competition_entries where competition_id='${id}'`)==='1','leaving frees the spot');
  await jide.reload();await jide.getByRole('button',{name:'Join competition'}).click();await jide.getByText('Registered ✓').waitFor({timeout:15000});
  ok(sql(`select count(*) from competition_entries where competition_id='${id}'`)==='2','the freed spot can be taken');

  // ---------- Hidden draft ----------
  const club=sql(`select id from clubs where name='Paris Arena'`);
  const hidden=sql(`insert into competitions (club_id,name,format,status,open_registration) values ('${club}','Secret Draft','group_stage','draft',false) returning id`).split('\n')[0];
  await ade.goto(B+'/play/compete');await ade.getByRole('radio',{name:'Upcoming'}).click();
  ok(!(await text(ade)).includes('Secret Draft'),'a draft with sign-up off is not listed for players');
  await ade.goto(B+'/play/compete/'+hidden);ok(/could not be found|404/i.test(await text(ade)),'its link shows not found for a player');
  await A.goto(B+'/competition');ok((await text(A)).includes('Secret Draft'),'the admin still sees it');

  // ---------- Admin adds a player and starts ----------
  await A.goto(B+'/competition/'+id+'/groups');
  ok(await A.getByText('Pastor').isVisible()&&await A.getByText('Jide Taiwo').isVisible(),'the admin sees who registered');
  await A.getByRole('button',{name:'Remove Jide Taiwo'}).click();await A.getByText('1 of 2 spots').waitFor({timeout:15000});
  ok(sql(`select count(*) from competition_entries where competition_id='${id}'`)==='1','the admin can remove a player');
  await A.getByRole('button',{name:'Add players'}).click();const sheet=A.locator('dialog[open]');await sheet.getByText('Sule').click();await sheet.getByRole('button',{name:'Add 1'}).click();await A.getByText('2 of 2 spots').waitFor({timeout:15000});
  ok(sql(`select count(*) from competition_entries where competition_id='${id}'`)==='2','the admin can add a player');
  const sa=await small(A);console.log('   admin page targets under 44px:',sa);ok(sa.length===0,'admin page targets are 44px or larger');
  await A.getByRole('button',{name:'Start competition'}).click();await A.getByText('Results').first().waitFor({timeout:20000});
  ok(stateOf(id)==='active,false,2','the competition is now active with sign-up closed: '+stateOf(id));
  ok(sql(`select count(*) from matches where competition_id='${id}'`)==='1','fixtures were generated for the two players');
  ok(sql(`select string_agg(seed::text,',' order by seed) from competition_entries where competition_id='${id}'`)==='1,2','entrants were seeded');

  // ---------- After the start ----------
  const sule=await who(b,'sule@example.com');await sule.goto(B+'/play/compete/'+id);t=await text(sule);
  ok(/Running/i.test(t)&&/Fixtures and results/i.test(t),'a player sees Running and the fixtures');
  ok(/Pastor|Sule/.test(t),'the fixture names the players');
  const dave=await who(b,'dorathy@example.com');await dave.goto(B+'/play/compete/'+id);
  ok((await dave.getByRole('button',{name:'Join competition'}).count())===0,'nobody can join once it has started');
  // ---------- Level rule ----------
  const lvl=sql(`insert into competitions (club_id,name,format,status,open_registration,level) values ('${club}','Seniors Only','group_stage','draft',true,'senior') returning id`).split('\n')[0];
  sql(`update player_profiles set level='junior' where membership_id=(select m.id from memberships m join users u on u.id=m.user_id where u.email='ade@example.com' and m.club_id='${club}')`);
  await ade.goto(B+'/play/compete/'+lvl);ok(await ade.getByRole('button',{name:/For Senior players/}).isDisabled(),'a junior player cannot join a senior competition');

  const errs=[A,ade,pastor,jide,sule,dave].flatMap(p=>p.errs);ok(errs.length===0,'no page errors: '+JSON.stringify(errs).slice(0,300));
  await b.close();console.log(`\n${pass} passed, ${fail} failed`);process.exit(fail?1:0)
})().catch(e=>{console.log('CRASH',e.message.split('\n')[0]);process.exit(1)});
