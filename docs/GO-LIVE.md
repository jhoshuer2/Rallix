# Go-live checklist

Work top to bottom. Each item says who does it and how to know it worked. Real-device items cannot be tested by the automated suites.

## 1. Before the first real club
- [ ] **Database passwords rotated** if any were ever pasted in a chat or ticket (Supabase, Settings, Database). Update the three Vercel variables afterwards.
- [ ] Migrations applied; the check query in `DEPLOY.md` section 8 shows the expected count and all `true`.
- [ ] Both Vercel projects deployed from the same commit; `/api/health` answers on both.
- [ ] DNS: the club app on its domain with wildcard subdomains, the console on its own address.
- [ ] Platform owner exists: `pnpm --filter @rallix/db make-platform-admin you@example.com "Your name"`, then sign in to the console.
- [ ] CI is running on GitHub (Actions enabled and not blocked by billing); the last run is green.

## 2. On real phones (about 30 minutes, two phones)
1. **Install:** iPhone: Share, Add to Home Screen. Android: Install. The app opens full screen.
2. **Sign-in email:** a new address receives the 6-digit code within a minute and not in spam. If it lands in spam, fix SPF, DKIM and DMARC (`packages/mailer/README.md`).
3. **Lock-screen alert:** phone A turns on "Alert me when players arrive"; phone B (at the court, or with the court set to your location) taps "I've arrived". Phone A shows the alert on the lock screen. iPhone needs the app added to the Home Screen first.
4. **Door card:** one phone shows the member card; an admin phone scans it (camera permission, HTTPS). The standing shows; "Let in" records the visit.
5. **Paystack TEST payment:** pay a due with a test card. The due turns paid, the receipt email arrives, the webhook shows in the console Payments page. Run `pnpm --filter @rallix/payments smoke` once with the TEST key. Only then switch to live keys.
6. **Offline scoring:** open a match as a scorer with a signal. Switch to airplane mode. Reload: the scoring screen still opens. Score a full match, tap Save: it says "Saved on this phone". Turn the signal back on: the banner clears and the match shows as completed. Try an umpire "End game" while offline too.
7. **Pictures:** upload a profile photo, the club logo and a cover; they show on the home screens.

## 3. Watching it after launch
- Vercel, Logs: an "Application error" page shows a digest; search the digest in the runtime logs for the real message.
- Console Issues inbox: club members send requests from the Help screens. Reply from the issue page; the sender gets an email.
- Console Payments page: failed or unmatched webhook events and clubs that paid but are still suspended.
- Nightly GitHub run (`CI`) runs every browser suite against a production build. A red night means something broke on `main`.

## 4. Rolling back
Vercel, Deployments: promote the previous deployment (instant). Migrations only add columns and tables, so the older code keeps working against the newer database. Never roll the database back.

## 5. Known limits (say these to clubs)
- Arrival is a tap, not background location. True background detection needs a native app later.
- Push, SMS and WhatsApp broadcasts from the console are queued but not connected; email is real.
- The offline copy keeps the scoring screen only. Everything else needs a signal.
