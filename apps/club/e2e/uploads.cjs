/**
 * Picture uploads end-to-end (local storage adapter): player photo with GPS EXIF in, clean WebP out; replace deletes the old file;
 * bad files are refused; daily limit; admin sets club logo and cover and a member's photo, and removes pictures.
 * Needs a freshly seeded DB and the club app running:  OUT=/tmp DEV_LOG=/tmp/club.log node apps/club/e2e/uploads.cjs
 */
const {chromium}=require('playwright');const fs=require('fs');const path=require('path');const {execSync}=require('child_process');
const sharp=require(require.resolve('sharp',{paths:[path.join(process.cwd(),'packages/media')]}));
const SC=process.env.OUT||'/tmp', LOG=process.env.DEV_LOG, B='http://localhost:3000', DATA=path.join(process.cwd(),'apps/club/.data/media');
const sql=q=>execSync(`PGPASSWORD=service_dev psql -h localhost -U rallix_service -d rallix_dev -Atc "${q.replace(/"/g,'\\"')}"`).toString().trim();
let pass=0,fail=0;const ok=(c,m)=>{c?pass++:fail++;console.log(c?'  ok  ':'  FAIL',m)};
function code(email){const log=fs.readFileSync(LOG).toString().replace(/\0/g,'');const re=new RegExp('\\[mail:dev\\] to '+email.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+' \\|[^\\n]*\\n\\s+Your (?:Rallix|Rallix Console) sign-in code is (\\d{6})','g');const a=[...log.matchAll(re)];return a.length?a[a.length-1][1]:null}
async function signIn(p,email){await p.goto(B+'/sign-in?next=/');await p.getByLabel('Email address').fill(email);await p.getByRole('button',{name:'Email me a code'}).click();await p.getByLabel('6-digit code').waitFor({timeout:25000});await p.waitForTimeout(600);await p.getByLabel('6-digit code').fill(code(email));await p.getByRole('button',{name:'Sign in'}).click();await p.waitForURL(u=>!/sign-in/.test(u.toString()),{timeout:25000});await p.goto(B+'/switch/'+sql("select id from clubs where name='Paris Arena'"))}
const files=()=>{const out=[];const walk=d=>{if(!fs.existsSync(d))return;for(const f of fs.readdirSync(d)){const p=path.join(d,f);fs.statSync(p).isDirectory()?walk(p):out.push(p)}};walk(DATA);return out};
const tmp=fs.mkdtempSync('/tmp/rallix-up-');
async function mkjpeg(name,w,h,color){const p=path.join(tmp,name);await sharp({create:{width:w,height:h,channels:3,background:color}}).withExif({IFD0:{ImageDescription:'GPS 6.5244N 3.3792E secret',Make:'TestCam'}}).jpeg().toFile(p);return p}
async function pick(p,file){await p.locator('dialog[open] input[type=file]:not([capture])').first().setInputFiles(file)}

(async()=>{
  fs.rmSync(DATA,{recursive:true,force:true});
  const b=await chromium.launch();const c=await b.newContext({viewport:{width:440,height:956}});const p=await c.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error'&&!/DeprecationWarning|Failed to load resource/.test(m.text()))errs.push(m.text())});p.on('response',r=>{if(r.status()>=500||(r.status()===404&&!r.url().includes('/media/')))errs.push(r.status()+' '+r.url())});
  const jpg1=await mkjpeg('a.jpg',1600,1200,{r:20,g:80,b:200}), jpg2=await mkjpeg('b.jpg',900,1400,{r:200,g:60,b:30});
  const input=await sharp(jpg1).metadata();ok(!!input.exif,'test photo really carries EXIF (camera and description)');

  console.log('Player (Ade)');
  await signIn(p,'ade@example.com');
  await p.goto(B+'/play/me');await p.waitForLoadState('networkidle');
  await p.getByRole('button',{name:/Change picture|Add a picture/}).click();
  ok(await p.getByRole('button',{name:'Take a photo'}).isVisible()&&await p.getByRole('button',{name:'Choose from library'}).isVisible(),'sheet offers camera and library');
  await pick(p,jpg1);
  await p.getByRole('button',{name:'Use picture'}).waitFor();ok(await p.getByLabel('Zoom').isVisible(),'crop step shows with a zoom control');
  await p.screenshot({path:`${SC}/upload_crop.png`});
  await p.getByRole('button',{name:'Use picture'}).click();
  await p.getByText('Picture updated.').waitFor({timeout:20000});ok(true,'upload succeeds and says so');
  await p.waitForLoadState('networkidle');
  const src1=await p.locator('.rx-uploader__pic').first().getAttribute('src');ok(/^\/media\/clubs\/[0-9a-f-]{36}\/people\/[0-9a-f-]{36}\.webp$/.test(src1||''),'photo now served from our store: '+src1);
  let stored=files();ok(stored.length===1,'exactly one file stored');
  const meta=await sharp(stored[0]).metadata();ok(meta.format==='webp'&&meta.width===640&&meta.height===640,`stored file is a 640x640 WebP (${meta.format} ${meta.width}x${meta.height})`);
  ok(!meta.exif&&!meta.icc&&!meta.xmp,'stored file has no EXIF, ICC or XMP');
  ok(!fs.readFileSync(stored[0]).toString('latin1').includes('secret'),'stored bytes contain none of the original metadata text');
  const r=await p.request.get(B+src1);ok(r.status()===200&&/image\/webp/.test(r.headers()['content-type']||'')&&r.headers()['x-content-type-options']==='nosniff','file route serves WebP with nosniff');
  ok((await p.request.get(B+'/media/clubs/../../../etc/passwd')).status()===404,'path traversal is refused');
  ok((await p.request.get(B+'/media/anything.webp')).status()===404,'unknown key is a 404');
  ok(sql("select photo_url from player_profiles where membership_id=(select m.id from memberships m join users u on u.id=m.user_id where u.email='ade@example.com' and m.club_id=(select id from clubs where name='Paris Arena'))")===src1,'database holds the new address');
  await p.goto(B+'/play/ranks');await p.waitForLoadState('networkidle');ok(await p.locator(`img[src="${src1}"]`).count()>=1,'Ranks shows the new photo');
  await p.goto(B+'/play');await p.waitForLoadState('networkidle');ok(await p.locator(`.rx-header img[src="${src1}"], .rx-header .rx-avatar[src="${src1}"]`).count()>=1,'header avatar uses the new photo');

  console.log('Replace and remove');
  await p.goto(B+'/play/me');await p.waitForLoadState('networkidle');
  await p.getByRole('button',{name:/Change picture/}).click();await pick(p,jpg2);await p.getByRole('button',{name:'Use picture'}).click();await p.getByText('Picture updated.').waitFor({timeout:20000});await p.waitForLoadState('networkidle');
  const src2=await p.locator('.rx-uploader__pic').first().getAttribute('src');ok(src2!==src1,'a replacement gets a new address');
  stored=files();ok(stored.length===1&&!stored[0].includes(src1.split('/').pop()),'the old file was deleted');
  await p.getByRole('button',{name:/Change picture/}).click();await p.getByRole('button',{name:'Remove picture'}).click();await p.getByText('Picture removed.').waitFor({timeout:20000});await p.waitForLoadState('networkidle');
  ok(files().length===0,'removing deletes the file');ok(sql("select count(*) from player_profiles where photo_url like '/media/%'")==='0','database address cleared');

  console.log('Bad files');
  await p.goto(B+'/play/me');await p.waitForLoadState('networkidle');
  const txt=path.join(tmp,'fake.jpg');fs.writeFileSync(txt,'this is not a picture');
  await p.getByRole('button',{name:/Add a picture|Change picture/}).click();await pick(p,txt);
  await p.getByText(/couldn.t open that picture/i).waitFor({timeout:10000});ok(true,'a text file renamed .jpg is refused with a clear message');
  ok(files().length===0,'nothing was stored');
  await p.keyboard.press('Escape');

  console.log('Daily limit');
  const mid=sql("select m.id from memberships m join users u on u.id=m.user_id where u.email='ade@example.com' and m.club_id=(select id from clubs where name='Paris Arena')");
  sql(`insert into upload_log (user_id, club_id, kind, bytes) select u.id, (select id from clubs where name='Paris Arena'), 'person', 100 from users u cross join generate_series(1,20) where u.email='ade@example.com'`);
  await p.goto(B+'/play/me');await p.waitForLoadState('networkidle');
  await p.getByRole('button',{name:/Add a picture/}).click();await pick(p,jpg1);await p.getByRole('button',{name:'Use picture'}).click();
  await p.getByText(/uploaded a lot of pictures today/i).waitFor({timeout:15000});ok(true,'the 21st upload in a day is blocked with a friendly message');ok(files().length===0,'and nothing was stored');
  sql("delete from upload_log");

  console.log('Player cannot reach admin pictures');
  await p.goto(B+'/profile');await p.waitForLoadState('networkidle');ok(/\/play/.test(p.url()),'players are sent away from the admin Profile');
  await p.goto(B+'/members/'+mid);await p.waitForLoadState('networkidle');ok(/\/play/.test(p.url()),'players cannot open the admin member screen');
  ok(errs.length===0,'player: no console errors '+JSON.stringify(errs.slice(0,2)));await c.close();

  console.log('Admin');
  const a=await b.newContext({viewport:{width:440,height:956}});const q=await a.newPage();const aerrs=[];q.on('pageerror',e=>aerrs.push(e.message));q.on('console',m=>{if(m.type()==='error'&&!/DeprecationWarning|Failed to load resource/.test(m.text()))aerrs.push(m.text())});q.on('response',r=>{if(r.status()>=500||(r.status()===404&&!r.url().includes('/media/')))aerrs.push(r.status()+' '+r.url())});
  await signIn(q,'admin@example.com');
  await q.goto(B+'/profile/pictures');await q.waitForLoadState('networkidle');
  ok(await q.getByText('Club pictures').first().isVisible(),'admin sees the Club pictures screen');
  const logoBtn=q.locator('.rx-uploader').filter({hasText:'Club logo'}).getByRole('button',{name:/Add a picture|Change picture/});
  await logoBtn.click();await pick(q,jpg1);await q.getByRole('button',{name:'Use picture'}).click();await q.locator('.rx-uploader').filter({hasText:'Club logo'}).getByText('Picture updated.').waitFor({timeout:20000});await q.waitForLoadState('networkidle');
  const coverBtn=q.locator('.rx-uploader').filter({hasText:'Club cover'}).getByRole('button',{name:/Add a picture|Change picture/});
  await coverBtn.click();await pick(q,jpg2);await q.screenshot({path:`${SC}/upload_cover_crop.png`});await q.getByRole('button',{name:'Use picture'}).click();await q.locator('.rx-uploader').filter({hasText:'Club cover'}).getByText('Picture updated.').waitFor({timeout:20000});await q.waitForLoadState('networkidle');
  const logo=sql("select logo_url from clubs where name='Paris Arena'"),cover=sql("select cover_url from clubs where name='Paris Arena'");
  ok(/\/logo\/[0-9a-f-]{36}\.webp$/.test(logo)&&/\/cover\/[0-9a-f-]{36}\.webp$/.test(cover),'club logo and cover addresses saved');
  const sizes=await Promise.all(files().map(async f=>{const m=await sharp(f).metadata();return `${m.width}x${m.height}`}));ok(sizes.includes('512x512')&&sizes.includes('1600x1000'),'logo is 512x512 and cover 1600x1000: '+sizes.join(', '));
  await q.goto(B+'/');await q.waitForLoadState('networkidle');
  ok(await q.locator(`.rx-header img[src="${logo}"]`).count()>=1,'header switcher shows the club logo');
  ok(((await q.locator('.rx-cb--cover').first().getAttribute('style'))||'').includes(cover),'admin Home shows the cover behind the club');
  await q.screenshot({path:`${SC}/upload_admin_home.png`,fullPage:true});

  const sule=sql("select m.id from memberships m join users u on u.id=m.user_id where u.email='sule@example.com' and m.club_id=(select id from clubs where name='Paris Arena')");
  await q.goto(B+'/members/'+sule);await q.waitForLoadState('networkidle');
  const before=sql(`select photo_url from player_profiles where membership_id='${sule}'`);
  await q.getByRole('button',{name:/Change picture/}).click();await pick(q,jpg2);await q.getByRole('button',{name:'Use picture'}).click();await q.getByText('Picture updated.').waitFor({timeout:20000});await q.waitForLoadState('networkidle');
  const after=sql(`select photo_url from player_profiles where membership_id='${sule}'`);ok(/^\/media\//.test(after)&&after!==before,"admin replaced Sule's photo");
  ok(sql("select count(*) from player_profiles where photo_url like '/media/%'")==='1','only that one member photo changed');
  await q.getByRole('button',{name:/Change picture/}).click();await q.getByRole('button',{name:'Remove picture'}).click();await q.getByText('Picture removed.').waitFor({timeout:20000});await q.waitForLoadState('networkidle');
  ok(sql(`select photo_url from player_profiles where membership_id='${sule}'`)==='','admin removed it again (Sule shows initials)');
  await q.goto(B+'/profile/pictures');await q.waitForLoadState('networkidle');
  await q.locator('.rx-uploader').filter({hasText:'Club cover'}).getByRole('button',{name:/Change picture/}).click();await q.getByRole('button',{name:'Remove picture'}).click();await q.locator('.rx-uploader').filter({hasText:'Club cover'}).getByText('Picture removed.').waitFor({timeout:20000});
  ok(sql("select coalesce(cover_url,'') from clubs where name='Paris Arena'")==='','admin removed the cover');ok(files().length===1,'only the logo file remains on disk');
  ok(aerrs.length===0,'admin: no console errors '+JSON.stringify(aerrs.slice(0,2)));
  console.log(`\n${pass} passed, ${fail} failed`);await b.close();fs.rmSync(tmp,{recursive:true,force:true});
})().catch(e=>{console.log('CRASH',e.message);process.exit(1)});
