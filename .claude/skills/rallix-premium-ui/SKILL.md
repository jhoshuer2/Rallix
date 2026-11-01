---
name: rallix-premium-ui
description: Rules for making Rallix screens feel premium and low on text: photo-led cards, one hero per screen, Instagram-style story highlights, carousels, skeleton loading, and placeholders for player and club pictures. Use when designing or reviewing any club-app screen, and before shipping UI.
---

# Rallix premium UI

Reference: high-end sports club apps. What makes them feel expensive is **not decoration**. It is restraint: big images, few words, one clear focus per screen, calm motion. Keep Rallix's own colours and fonts (`packages/ui/src/tokens.css`). Never copy another brand's look.

## The seven rules
1. **One hero per screen.** A single large element (live or next match, the player's rank, a competition cover) owns the top. Everything else is quieter and smaller.
2. **Image first, words second.** A card is a picture plus at most two short lines (a title of up to about 6 words, and one detail). No paragraphs, no stacked chips. If a card needs a third line, the information belongs on a detail screen.
3. **Every picture slot uses `<Photo>`.** Real upload when present; otherwise a generated brand placeholder (colour from a hash of the name, monogram or ball motif). Never a grey box, a broken image, or empty space. Players and clubs upload pictures later; the layout must already look finished without them.
4. **Stories row for what is happening now.** Round highlights at the top of Home: the live match first, then recent results. Ring = unseen, muted ring = seen, red LIVE tag for live. Tapping opens the full-screen viewer.
5. **Sections are swipe rows, not lists.** A section is an editorial title with a small arrow ("Latest results →") over a horizontal scroll-snap carousel with the next card peeking. Use a vertical list only for dense, scannable data (the rankings table).
6. **Type hierarchy.** Spotlight (display, italic, uppercase) only for the hero number or name and for section titles, kept short. All other text is General Sans in sentence case, 16px minimum for body. No all-caps paragraphs. Numbers that matter (rank, score, countdown) are big.
7. **Calm, intentional motion.** Transform and opacity only, 120 to 320 ms from the motion tokens. Skeleton placeholders that match the final layout instead of spinners. Honour `prefers-reduced-motion`: no auto-advance, no pulse, fades only.

## Text diet (check every screen)
- Count the words visible on first load. If the screen shows more than about 40, cut or move detail one tap deeper.
- Replace labels with icons or pictures where the meaning is obvious, but keep an accessible name.
- Prefer "Sun 3 Nov, 4:00 pm" over "Scheduled for Sunday the 3rd of November at 4:00 pm".
- Hide empty sections instead of showing "No X yet" lines, unless the empty state is the main content (then use a friendly picture and one action).
- One primary action per screen.

## Story highlights pattern
- Row: horizontal scroll, 72px circles, 12px gap, caption under each (max 2 short lines, truncated).
- Ring: gradient from existing rust to yellow when unseen; 2px muted ring when seen. Seen state is saved per viewer in `localStorage` inside try/catch (private windows throw), and the row must work without it.
- Content for now: the live match first, then the last results. The circle shows the two players' faces (placeholders allowed) or the score.
- Viewer: native `<dialog>`, progress bars on top, auto-advance after 5 s, hold to pause, tap right or left edge for next or previous, swipe or button to close, Esc closes. The caption is in an `aria-live="polite"` region. With reduced motion there is no auto-advance.
- Never blocks the app: closing returns focus to the ring that opened it.

## Placeholders for uploaded pictures
- `Photo` has `kind="person" | "club" | "cover"`. The same name always produces the same placeholder colour. Person: circle with initials. Club: rounded square with monogram. Cover: wide gradient with the ball motif.
- Always pass `alt` or mark the image decorative. Do not stretch: `object-fit: cover`.
- Do not claim a picture exists. Uploading comes later (needs storage); design as if it will arrive.

## Spacing and rhythm
- Page gutter 16px. Section gap 32px. Card gap 12px. Hero gets 24px of air above.
- Alternate surfaces for rhythm: blue app background, a cream band for data sections, a dark band for media. Never more than three surface colours on one screen.
- Corner radius from tokens; cards in carousels are about 75% of the screen width so the next one peeks.

## Before shipping
- [ ] One hero, one primary action, under about 40 visible words.
- [ ] Every image slot shows a good placeholder with no uploads.
- [ ] Contrast 4.5:1 for text, 3:1 for large text and icons; never colour alone for meaning (LIVE has text).
- [ ] 44px minimum touch targets, including rings and carousel cards.
- [ ] Keyboard: everything reachable, visible focus, Esc closes viewers and sheets.
- [ ] Reduced motion tested; skeleton, empty, error and offline states exist.
- [ ] No horizontal page scroll (only inside carousels); phone width 360 to 440px checked.
- [ ] Run `rallix-a11y` and `design:design-critique`.

## Admin screens
The admin's job is "what needs attention, and how is the club doing". Same rules, different hero.
- **Home hero:** `ClubBanner` (cover and logo placeholders from the club name, one big revenue figure, member count).
- **Needs attention:** up to three `AttentionTile`s (a count and 2 to 3 words, e.g. "4 unpaid dues"), shown only when there is something to do. With nothing to do, show nothing, not "all good" text.
- **Quick actions:** a row of three round `ActionButton`s with one-word labels. Never a stack of full-width ghost buttons.
- **Lists of people:** `MemberCard` photo grid (rank badge, name, rating) with a sticky search box; never a text table on a phone.
- **Settings and menus:** `TileLink` 2-column tiles with an icon and one or two words, not promo banners with sentences.
- **Status rows:** one slim row with a coloured edge (green on, orange off) and one action button.
- **Empty states:** one sentence and one button. Never an empty grid or a blank screen.
- **Active tab:** match routes exactly or with a trailing slash (`/members` must not light up on `/membership`).
- **Browser-only code:** never read `window` or `localStorage` while rendering; do it in an effect so server rendering cannot crash.
