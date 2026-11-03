# Rallix: what the product is

Rallix is a table tennis club management app. It is **multi-club**: many clubs use the same platform, and every club runs its own way (its own rules, guidelines, fees and schedule). A player can belong to several clubs. Each club's data is separate.

Read this before building or changing anything. If a screen does not serve someone below, it should not exist.

## Who uses it

### Club admins (one or several per club)
One person may run a club, or two, three, four. Several admins can share the work: one looks after the courts and players, one runs competitions, one looks after fees. (Responsibilities are switched on per admin; the owner has all of them.)

The admin's job is **player welfare and community management**:
- Know who belongs to the club. A roll of members and a check-in record, so that random people do not simply turn up and play.
- Set the club's rules and guidelines, and make them easy to read before someone joins.
- Run membership: join fee or subscription, renewals, making sure fees are paid on time.
- Run what happens in the club: events, holidays and closures, regular playing times, competitions.
- Look after the facilities: tables, bats, balls, their condition and upkeep.
- See at a glance how the club is doing: members, who is active, money, what needs attention.

### Prospective members
Open the club's link and see everything before applying: the club's guidelines, schedule, meeting and playing times, joining fee or subscription, dress code, whether to bring your own racket and how to get one, prizes. Then apply. The admin reviews (each club chooses to review applications or let people join straight away).

### Players
- Play friendly one-on-one matches any time: challenge the best player, or the one who has been bragging. Not a competition, just a match.
- Take part in competitions when the club runs them: season, mid-season, end of year, one-off; one-on-one, groups or a raffle draw; points and awards.
- See their own schedule and the club schedule, including holidays and closures.
- See who is at the club now, and challenge someone even if they are not in the club (later).
- See their scores, every competition they played and how far they got, and move from level to level.
- Pay or renew their subscription when the club has one.

### Platform team (the console)
Runs the multi-club product: clubs and their health, subscriptions and invoices, payments, notifications, support issues, staff and audit.

## Principles for every screen
1. **Calm and clear.** Few things compete for attention. One main action per screen.
2. **Show a section only when it has something to show.** No empty cards, no zeros pretending to be data. An empty club shows what to do next, not blank panels.
3. **A stranger must understand it.** Someone handed the app without the creator must know what each section is and what to do. Plain words, short labels.
4. **Type is quiet.** Sizes come from the type scale in `packages/ui/src/tokens.css`. Only page titles, scores and one hero figure use the big condensed capitals.
5. **Each club is different.** Rules, fees, schedule and responsibilities are the club's to define, not hard-coded.
6. **Never claim what the data cannot support.** Stats come from recorded matches. Locations are never stored.

## Glossary
- **Club admin / owner**: owner created the club and has every responsibility; other admins get chosen responsibilities.
- **Responsibility**: Members, Competitions, Finance, Facilities. An admin only sees the areas they handle.
- **Friendly**: a match outside any competition. Unrated unless both players agree to count it.
- **Competition**: an organised event with a format, dates, entrants, points and awards.
- **Check-in / arrival**: a player says they are at the club (a tap, or automatic while the app is open). It builds the club's attendance record.
- **Setup checklist**: the short list shown to a new admin until the club is ready.

## Status
Built: clubs, invites, players, dues and payments, competitions with open sign-up and preview, scoring, ratings, check-in with alerts, reminders, pictures, console.
Rounds 1 to 3 done: calm type scale and hide-until-data homes, club page with apply-to-join, admin team responsibilities, friendly challenges (rated only when both players agree).
Next: club schedule and holidays, facilities, admin attendance, more competition formats, console club approval.
