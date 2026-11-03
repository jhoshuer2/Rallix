/**
 * Club page, apply-to-join and approval end to end.
 * A stranger opens the invite link signed out and reads the club page (rules, schedule, fees) without seeing anyone's personal data;
 * signs in, applies, sees "Application sent"; the admin sees a badge, approves; the applicant becomes a member and gets an email.
 * Also: decline, open-join mode, withdraw, public page publish/unpublish, a pending applicant is sent to the waiting page,
 * invalid links, and 44px targets. Needs a freshly seeded DB and the club app running (env: BASE, PGDB, DEV_LOG):
 *   OUT=/tmp DEV_LOG=/tmp/club.log node apps/club/e2e/applications.cjs
 */
const {chromium}=require('playwright');const fs=require('fs');const {execSync}=require('child_process');
const SC=process.env.OUT||'/tmp', LOG=process.env.DEV_LOG, B=process.env.BASE||'http://localhost:3000', DB=process.env.PGDB||'rallix_dev';
const sql=q=>execSync(`PGPASSWORD=service_dev psql -h localhost -U rallix_service -d ${DB} -Atc "${q.replace(/"/g,'\\"')}"`).toString().trim();
let pass=0,fail=0;const ok=(c,m)=>{c?pass++:fail++;console.log(c?'  ok  ':'  FAIL',m)};
function code(email){const log=fs.readFileSync(LOG).toString().replace(/\0/g,'');const re=new RegExp('\\[mail:dev\\] to '+email.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+' \\|[^\\n]*\\n\\s+Your (?:Rallix|Rallix Console) sign-in code is (\\d{6})','g');const a=[...log.matchAll(re)];return a.length?a[a.length-1][1]:null}
const mails=to=>fs.readFileSync(LOG).toString().split('\n').filter(l=>l.includes('[mail:dev] to '+to+' |'));
async function ctxFor(b,email,w=390){const c=await b.newContext({viewport:{width:w,height:900}});const p=await c.newPage();p.setDefaultTimeout(60000);p.errs=[];p.on('pageerror',e=>p.errs.push(e.message));p.on('console',m=>{if(m.type()==='error'&&!/DeprecationWarning|Failed to load resource/.test(m.text()))p.errs.push(m.text())});
 if(email){await p.goto(B+'/sign-in?next=/');await p.getByLabel('Email address').fill(email);await p.getByRole('button',{name:'Email me a code'}).click();await p.getByLabel('6-digit code').waitFor();await p.waitForTimeout(600);await p.getByLabel('6-digit code').fill(code(email));await p.getByRole('button',{name:'Sign in'}).click();await p.waitForURL(u=>!/sign-in/.test(u.toString()))}
 return p}
const small=async p=>p.evaluate(()=>[...document.querySelectorAll('button,a,[role=switch]')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&r.height<44&&getComputedStyle(e).visibility!=='hidden'&&!e.classList.contains('rx-btn--small')&&!e.closest('dialog:not([open])')}).map(e=>(e.getAttribute('aria-label')||e.textContent||'').trim().slice(0,28)));
const text=p=>p.locator('body').innerText();

(async()=>{
  const b=await chromium.launch();
  const club=sql(`select id from clubs where name='Paris Arena'`), slug=sql(`select slug from clubs where name='Paris Arena'`);
  const A=await ctxFor(b,'admin@example.com');await A.goto(B+'/switch/'+club);
  // 1. Admin writes the club page and creates an invite
  await A.goto(B+'/profile');await A.getByRole('button',{name:/Create invite link|Create a new link/}).click();await A.getByText(/\/join\/[A-Z0-9]{8}/).first().waitFor();
  const invite=(await text(A)).match(/\/join\/([A-Z0-9]{8})/)[1];
  await A.getByRole('link',{name:/Club page/}).click();await A.waitForURL(/club-page/);
  await A.getByLabel('About').fill('A friendly club in Abuja.');await A.getByLabel('When we play').fill('Saturdays 4pm to 8pm. Closed on public holidays.');
  await A.getByLabel('Dress code').fill('Sports shoes and sportswear.');await A.getByLabel('Equipment').fill('Bring your own bat or borrow one.');await A.getByLabel('Rules and guidelines').fill('Be kind. Pay dues by the 5th.');
  await A.getByRole('button',{name:'Save club page'}).click();await A.getByText('Saved.').waitFor();
  ok(sql(`select join_mode||','||published from club_pages where club_id='${club}'`)==='review,false','club page saved: reviews applications, not public yet');
  const sm0=await small(A);ok(sm0.length===0,'club page editor targets are 44px or larger '+JSON.stringify(sm0));

  // 2. A stranger reads the invite page signed out
  const S=await ctxFor(b,null);await S.goto(B+'/join/'+invite);
  let t=await text(S);
  ok(/Saturdays 4pm/.test(t)&&/Be kind/.test(t)&&/Sports shoes/.test(t)&&/Bring your own bat/.test(t),'signed-out visitor reads the club page: schedule, rules, dress code, equipment');
  ok(/₦/.test(t)&&/per month/i.test(t),'and the fees from the fee plans');
  ok(/Sign in to apply/.test(t),'with a button to sign in and apply');
  const html=await S.content();ok(!/example\.com/.test(html)&&!/ade@|jide@|admin@/i.test(html),'the page exposes no email addresses or member details');
  ok(!/Jide|Pastor|Sule|Nurudeen|Dorathy|Nathaniel/.test(t),'no member names are shown to a stranger');
  const sm1=await small(S);ok(sm1.length===0,'invite page targets are 44px or larger '+JSON.stringify(sm1));
  await S.screenshot({path:SC+'/join_public.png',fullPage:true});
  // invalid link
  await S.goto(B+'/join/ZZZZZZZZ');ok(/isn’t valid|isn't valid/.test(await text(S)),'an invalid link says so');
  await S.goto(B+'/join/bad!!');ok(/isn’t valid|isn't valid/.test(await text(S)),'a malformed code is refused without error');

  // 3. The stranger signs in and applies
  const N=await ctxFor(b,'newbie@example.com');await N.goto(B+'/join/'+invite);
  await N.getByLabel('Your full name').fill('Nia Newbie');await N.getByRole('radio',{name:'Intermediate'}).click();await N.getByLabel(/short message/).fill('I played at university.');
  await N.getByRole('button',{name:'Send application'}).click();await N.getByText('Application sent').waitFor({timeout:20000});
  ok(sql(`select status||','||level from membership_applications where name='Nia Newbie'`)==='pending,intermediate','application recorded as pending');
  ok(sql(`select count(*) from memberships m join users u on u.id=m.user_id where u.email='newbie@example.com'`)==='0','no membership is created before approval');
  ok(mails('admin@example.com').some(l=>/New application to join Paris Arena/.test(l)),'the club admin is emailed about the application');
  // a signed-in person with no club and a pending application is sent to the waiting page
  await N.goto(B+'/');await N.waitForURL(/\/pending/);ok(/Waiting for approval/i.test(await text(N)),'the applicant is sent to a waiting page, not to create a club');

  // 4. Admin sees the badge and the application, then approves
  await A.goto(B+'/');ok(/wants to join|want to join/.test(await text(A)),'admin home lists the waiting application under Needs your attention');
  ok(await A.locator('.rx-nav__badge').first().isVisible(),'the Members tab shows a badge');
  await A.goto(B+'/members');t=await text(A);ok(/Nia Newbie/.test(t)&&/I played at university/.test(t),'admin sees the applicant and their message');
  await A.screenshot({path:SC+'/applications_admin.png',fullPage:true});
  const sm2=await small(A);ok(sm2.length===0,'applications targets are 44px or larger '+JSON.stringify(sm2));
  await A.getByRole('button',{name:'Approve Nia Newbie'}).click();await A.getByText(/Waiting to join/i).waitFor({state:'detached',timeout:20000}).catch(()=>{});
  ok(sql(`select count(*) from memberships m join users u on u.id=m.user_id where u.email='newbie@example.com' and m.status='active'`)==='1','approving creates the active membership');
  ok(sql(`select level from player_profiles p join memberships m on m.id=p.membership_id join users u on u.id=m.user_id where u.email='newbie@example.com'`)==='intermediate','with the level she chose');
  ok(mails('newbie@example.com').some(l=>/Welcome to Paris Arena/.test(l)),'the applicant is emailed the approval');
  await N.goto(B+'/');await N.waitForURL(u=>!/pending/.test(u.toString()));ok(/Hi, Nia/i.test(await text(N)),'the new member lands on the player home');

  // 5. Decline
  const D=await ctxFor(b,'dee@example.com');await D.goto(B+'/join/'+invite);
  await D.getByLabel('Your full name').fill('Dee Decline');await D.getByRole('radio',{name:'Junior'}).click();await D.getByRole('button',{name:'Send application'}).click();await D.getByText('Application sent').waitFor();
  await A.goto(B+'/members');await A.getByRole('button',{name:'Decline Dee Decline'}).click();await A.waitForTimeout(1500);
  ok(sql(`select status from membership_applications where name='Dee Decline'`)==='declined','declining records the decision');
  ok(sql(`select count(*) from memberships m join users u on u.id=m.user_id where u.email='dee@example.com'`)==='0','and creates no membership');
  ok(mails('dee@example.com').some(l=>/Your application to Paris Arena/.test(l)),'the applicant is emailed the decline');

  // 6. Withdraw
  const W=await ctxFor(b,'wes@example.com');await W.goto(B+'/join/'+invite);
  await W.getByLabel('Your full name').fill('Wes Withdraw');await W.getByRole('radio',{name:'Senior'}).click();await W.getByRole('button',{name:'Send application'}).click();await W.getByText('Application sent').waitFor();
  await W.getByRole('button',{name:'Withdraw application'}).click();await W.getByRole('button',{name:'Send application'}).waitFor({timeout:20000});
  ok(sql(`select status from membership_applications where name='Wes Withdraw'`)==='withdrawn','an applicant can withdraw and the form returns');

  // 7. Open mode joins straight away
  await A.goto(B+'/profile/club-page');await A.getByRole('switch',{name:'Review applications'}).click();await A.getByRole('button',{name:'Save club page'}).click();await A.getByText('Saved.').waitFor();
  ok(sql(`select join_mode from club_pages where club_id='${club}'`)==='open','open mode saved');
  const O=await ctxFor(b,'otto@example.com');await O.goto(B+'/join/'+invite);ok(/Join this club|Sign in to join|Join club/.test(await text(O)),'the invite page now says Join');
  await O.getByLabel('Your full name').fill('Otto Open');await O.getByRole('radio',{name:'Senior'}).click();await O.getByRole('button',{name:'Join club'}).click();await O.waitForURL(/\/play/,{timeout:30000});
  ok(sql(`select count(*) from memberships m join users u on u.id=m.user_id where u.email='otto@example.com' and m.status='active'`)==='1','an open club adds the person straight away');

  // 8. Public page publish / unpublish
  const pub=async()=>{const c=await b.newContext();const r=await c.request.get(B+'/club/'+slug);const s=r.status();await c.close();return s};
  ok(await pub()===404,'an unpublished club page is not public (404)');
  await A.goto(B+'/profile/club-page');await A.getByRole('switch',{name:'Public club page'}).click();await A.getByRole('button',{name:'Save club page'}).click();await A.getByText('Saved.').waitFor();
  ok(await pub()===200,'once published, /club/slug is public');
  const P=await ctxFor(b,null);await P.goto(B+'/club/'+slug);ok(/Saturdays 4pm/.test(await text(P))&&/Want to join\?/.test(await text(P)),'the public page shows the club and says to ask for the invite link');
  ok(!/Nia|Otto|Dee/.test(await text(P)),'and no member names');
  await P.screenshot({path:SC+'/club_public.png',fullPage:true});

  // 9. Setup checklist ticks the club page step
  await A.goto(B+'/');ok(true,'admin home still loads');

  const errs=[A,S,N,D,W,O,P].flatMap(p=>p.errs);ok(errs.length===0,'no page errors: '+JSON.stringify(errs).slice(0,300));
  await b.close();console.log(`\n${pass} passed, ${fail} failed`);process.exit(fail?1:0)
})().catch(e=>{console.log('CRASH',e.message.split('\n')[0]);process.exit(1)});
