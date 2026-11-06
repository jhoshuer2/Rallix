/**
 * Username and password sign-in, next to the emailed code.
 * Welcome has a "Sign in with password" link; the Getting started card (player) and the setup checklist (admin) offer "Set a username and password";
 * the account page validates and saves; then the person signs in with username OR email + password; wrong details give one plain message;
 * usernames are unique; a password can never create an account; the emailed code keeps working.
 *   scripts/e2e-run.sh prod password
 */
const {chromium}=require('playwright');const fs=require('fs');const {execSync}=require('child_process');
const LOG=process.env.DEV_LOG, B=process.env.BASE||'http://localhost:3000';
const sql=q=>execSync(`PGPASSWORD=service_dev psql -h localhost -U rallix_service -d ${process.env.PGDB||'rallix_dev'} -Atc "${q.replace(/"/g,'\\"')}"`).toString().trim().split('\n')[0];
let pass=0,fail=0;const ok=(c,m)=>{c?pass++:fail++;console.log(c?'  ok  ':'  FAIL',m)};
function code(email){const log=fs.readFileSync(LOG).toString().replace(/\0/g,'');const re=new RegExp('\\[mail:dev\\] to '+email.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+' \\|[^\\n]*\\n\\s+Your (?:Rallix|Rallix Console) sign-in code is (\\d{6})','g');const a=[...log.matchAll(re)];return a.length?a[a.length-1][1]:null}
async function signInCode(p,email){await p.goto(B+'/sign-in?next=/');await p.getByLabel('Email address').fill(email);await p.getByRole('button',{name:'Email me a code'}).click();await p.getByLabel('6-digit code').waitFor({timeout:60000});await p.waitForTimeout(600);await p.getByLabel('6-digit code').fill(code(email));await p.getByRole('button',{name:'Sign in'}).click();await p.waitForURL(u=>!/sign-in/.test(u.toString()),{timeout:60000});const id=sql(`select id from clubs where name='Paris Arena'`);await p.goto(B+'/switch/'+id,{waitUntil:'networkidle'})}
async function signInPassword(p,who,pw){await p.goto(B+'/sign-in?method=password');await p.getByLabel('Username or email').fill(who);await p.getByLabel('Password').fill(pw);await p.getByRole('button',{name:'Sign in'}).click()}
const body=async p=>{await p.locator('.rx-skel').first().waitFor({state:'detached',timeout:20000}).catch(()=>{});return p.locator('body').innerText()};
const left=async p=>p.waitForURL(u=>!/sign-in/.test(u.toString()),{timeout:30000}).then(()=>true).catch(()=>false);

(async()=>{const b=await chromium.launch();
const ctx=()=>b.newContext({viewport:{width:440,height:956}}).then(async c=>{c.setDefaultTimeout(60000);c.setDefaultNavigationTimeout(90000);return {c,p:await c.newPage()}});
let {c,p}=await ctx();const errs=[];p.on('pageerror',e=>errs.push(e.message));

// Welcome link
await p.goto(B+'/welcome',{waitUntil:'networkidle'});
const link=p.getByRole('link',{name:/Returning member\? Sign in with password/});
ok(await link.isVisible(),'Welcome shows "Returning member? Sign in with password" under Get started');
ok((await link.getAttribute('href'))==='/sign-in?method=password','it is a link to the password sign-in');
ok((await link.boundingBox()).height>=44,'the link is at least 44px tall');
await link.click();await p.waitForURL(/sign-in/);
ok(await p.getByLabel('Username or email').isVisible()&&await p.getByLabel('Password').isVisible(),'the link opens one field for username or email, and a password');
ok(await p.getByRole('button',{name:'Email me a code instead'}).isVisible(),'with a way back to the emailed code');
await p.getByRole('button',{name:'Email me a code instead'}).click();
ok(await p.getByRole('button',{name:'Sign in with a password'}).isVisible()&&await p.getByRole('button',{name:'Email me a code'}).isVisible(),'the code page offers "Sign in with a password"');

// A player with no matches yet sees the item on Getting started
const fresh=sql(`select u.email from users u join memberships m on m.user_id=u.id where m.club_id=(select id from clubs where name='Paris Arena') and 'player'=ANY(m.roles) and not exists (select 1 from matches x where x.player1_id=m.id or x.player2_id=m.id) limit 1`);
const player=fresh||'ade@example.com';
await signInCode(p,player);
await p.goto(B+'/play',{waitUntil:'networkidle'});
const home=await body(p);
if(fresh)ok(/Set a username and password/.test(home),'a new player\'s Getting started list includes "Set a username and password"');
await p.goto(B+'/play/me',{waitUntil:'networkidle'});
ok(/Username and password/.test(await body(p)),'Me has a Username and password row');
await p.goto(B+'/play/me/account',{waitUntil:'networkidle'});

// Validation
await p.getByLabel('Username').fill('ab');await p.getByLabel('Password',{exact:true}).fill('T4bleTennis!');await p.getByLabel('Type the password again').fill('T4bleTennis!');
await p.getByRole('button',{name:'Save username and password'}).click();
ok(/3 to 20/.test(await body(p)),'a 2-letter username is refused with the rule');
await p.getByLabel('Username').fill('Bad Name');await p.getByRole('button',{name:'Save username and password'}).click();
ok(/letters, numbers and underscores/.test(await body(p)),'spaces in a username are refused');
await p.getByLabel('Username').fill('pat_player');await p.getByLabel('Password',{exact:true}).fill('short');await p.getByLabel('Type the password again').fill('short');
await p.getByRole('button',{name:'Save username and password'}).click();
ok(/at least 8/.test(await body(p)),'a short password is refused');
await p.getByLabel('Password',{exact:true}).fill('T4bleTennis!');await p.getByLabel('Type the password again').fill('Different123');
await p.getByRole('button',{name:'Save username and password'}).click();
ok(/don.t match/.test(await body(p)),'two different passwords are refused');
ok(sql(`select count(*) from users where username='pat_player'`)==='0','nothing was saved by the refused attempts');

// Save
await p.getByLabel('Type the password again').fill('T4bleTennis!');
await p.getByRole('button',{name:'Save username and password'}).click();
await p.getByText(/^Saved\./).waitFor();
ok(sql(`select username from users where email='${player}'`)==='pat_player','the username is saved (lowercase)');
const hash=sql(`select password from accounts a join users u on u.id=a.user_id where u.email='${player}' and a.provider_id='credential'`);
ok(!!hash&&!hash.includes('T4bleTennis!'),'the password is stored hashed, not as typed');
ok(await p.getByLabel('Current password').count()===1,'the form now asks for the current password to change it');

// Sign out, sign in with username, then with email
await p.goto(B+'/sign-out');await p.waitForURL(/sign-in|welcome/,{timeout:30000}).catch(()=>{});
await signInPassword(p,'pat_player','T4bleTennis!');
ok(await left(p),'sign in with username and password works');
await p.goto(B+'/sign-out');await p.waitForURL(/sign-in|welcome/,{timeout:30000}).catch(()=>{});
await signInPassword(p,player.toUpperCase(),'T4bleTennis!');
ok(await left(p),'sign in with email and password works (any capitals)');
await p.goto(B+'/sign-out');await p.waitForURL(/sign-in|welcome/,{timeout:30000}).catch(()=>{});

// Wrong details: one plain message each, same words
const msgs=[];
for(const [who,pw] of [['pat_player','Wrong-password1'],['nobody_here','T4bleTennis!'],[player,'Wrong-password1']]){
  await signInPassword(p,who,pw);await p.getByText(/didn.t work/).waitFor({timeout:30000});msgs.push(await p.getByText(/didn.t work/).innerText());
}
ok(msgs.length===3&&new Set(msgs).size===1,'a wrong password, an unknown username and a wrong email give the same plain message');

// Password cannot create an account
const before=sql(`select count(*) from users`);
const r=await p.request.post(B+'/api/auth/sign-up/email',{headers:{Origin:B},data:{email:'new.person@example.com',password:'T4bleTennis!',name:'New'}});
ok(r.status()>=400&&sql(`select count(*) from users`)===before&&sql(`select count(*) from users where email='new.person@example.com'`)==='0','a password can never create an account');

// The emailed code still works
await signInCode(p,player);
ok(!/sign-in/.test(p.url()),'the emailed code still signs in');

// Usernames are unique
await p.goto(B+'/sign-out');await p.waitForURL(/sign-in|welcome/,{timeout:30000}).catch(()=>{});
await signInCode(p,'jide@example.com');
await p.goto(B+'/play/me/account',{waitUntil:'networkidle'});
await p.getByLabel('Username').fill('PAT_PLAYER');await p.getByLabel('Password',{exact:true}).fill('Another-Pass9');await p.getByLabel('Type the password again').fill('Another-Pass9');
await p.getByRole('button',{name:'Save username and password'}).click();
ok(await p.getByText(/username is taken/i).isVisible({timeout:20000}).catch(()=>false),'a username someone else has is refused, whatever the capitals');
ok(sql(`select username from users where email='jide@example.com'`)==='','and nothing was saved for the second person');

// Admin checklist
await p.goto(B+'/sign-out');await p.waitForURL(/sign-in|welcome/,{timeout:30000}).catch(()=>{});
await signInCode(p,'admin@example.com');
await p.goto(B+'/',{waitUntil:'networkidle'});
const adm=await body(p);
ok(/Set a username and password/.test(adm),'the admin\'s setup checklist includes "Set a username and password"');
await p.goto(B+'/profile/account',{waitUntil:'networkidle'});
ok(await p.getByLabel('Username').isVisible(),'the admin account page opens');

// A button for each tap target is 44px
const small=await p.evaluate(()=>[...document.querySelectorAll('button,a,input')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&r.height<44}).map(e=>e.tagName+':'+(e.textContent||e.getAttribute('aria-label')||'').slice(0,20)));
ok(small.length===0,'every control on the account page is at least 44px tall '+small.join(','));
ok(!(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth)),'no sideways scroll');
ok(errs.length===0,'no console errors '+errs.join('|'));
console.log(`\n${pass} passed, ${fail} failed`);await b.close();process.exit(fail?1:0)})().catch(e=>{console.error('CRASH',e.message);process.exit(2)});
