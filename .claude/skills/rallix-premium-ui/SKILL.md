---
name: rallix-premium-ui
description: Rules for making Rallix screens feel premium and low on text: photo-led cards, one hero per screen, Instagram-style story highlights, carousels, skeleton loading, and placeholders for player and club pictures. Use when designing or reviewing any club-app screen, and before shipping UI.
---

# Rallix premium UI: the design system

Goal: every screen in the club app looks like it came from one premium product: a blue band with the title and highlights, a clean light canvas, photos where there are people, one family of cards. Reference: high-end sports club apps. What makes them feel expensive is restraint: big images, few words, one focus per screen, calm motion. Keep Rallix's own colours and fonts. Never copy another brand's look.

Living style guide: open `/kit` in the club app. Source: `packages/ui/src` (`tokens.css`, `components.css`, `premium.tsx`, `stories.tsx`).

## Page anatomy (every content screen)
Use `PageShell`. Do not build your own page structure. Three layouts, chosen by what you pass:

| Layout | You pass | You get |
|---|---|---|
| Home | `home` (or `lead`), `title` greeting, `band` = story highlights | Flat blue block with the club header, greeting and the hero (`lead`), then highlights on white |
| Tab | `title`, `action?` | White app bar with the club header, big serif title, light canvas |
| Detail | `back`, `title` | White app bar with a back button and centred title. With `lead` too: blue hero block with a back button (member profile) |

- Layouts use `<Screen tone="canvas">` (tab screens get the bottom bar, detail screens do not: route groups `(admin)`, `(player)` have tabs; `(adminflow)`, `(playerflow)` do not).
- Entry and public screens (sign-in, onboarding, join, suspended, unsubscribe, pay pages) use `EntryShell`: blue top with the Rallix mark and a serif title, white sheet with the form. Pass `hero` for a pill under the title.
- The live scoring screen is the one exception: `Screen className="rx-darkscreen"` (night background), instant feedback, no motion.
- Loading: a `loading.tsx` with `Skeleton` blocks in the same shape. Never a spinner.

## The six card kinds. Nothing else.
All share: white surface, 16px radius, one soft shadow, 16px padding, 44px touch targets, the same title (16px, 600) and subtitle (14px, `--rx-ink-3`) styles.

| You are showing | Use | Notes |
|---|---|---|
| A competition, anything with a cover picture | `MediaCard` | Wide picture, one title line, one detail line, optional tag. Carousel size by default; `className="rx-ccard--wide"` for stacks |
| A finished match | `ResultCard` | Both faces, the score, "X won 3–1" |
| A person, payment, fixture, setting, club | `ListRow` inside `ListGroup` | Photo or `IconBadge`, title, one subtitle, value or chevron on the right. `eyebrow` adds a blue category label, `size="lg"` a big picture. Use `CheckRow` to pick people and `ListActions` for buttons that belong to the row above |
| One number that matters | `MetricCard` inside `MetricGrid` | Max 4 per screen |
| A shortcut to another screen | `TileLink` (2 columns) or `ActionButton` (round, 3 in a row) | Icon plus 1 or 2 words |
| A form, free text, a chart, anything else | `Panel` | Optional `title`. Use `className="rx-panel--night"` for dark media bands |

Hero pieces (one per screen): `HeroMatch` (player), `ClubBanner` (admin), the revenue card (membership), a `MediaCard` (competition). Status pills use `Pill` (neutral, success, warning, live) and nothing else.

### Forbidden in pages
- Raw `rx-card`, `rx-promo`, `rx-format`, `rx-rank`, `rx-stats`, `rx-match`, `rx-pays` classes, or inline-styled boxes that look like cards.
- The deleted legacy components (`Card`, `Chip`, `FormatCard`, `PromoCard`, `PaymentRow`, `PlayerRow`, `RankRow`, `RankCard`, `DueCard`, `MatchCard`, `StatGrid`, `ClubRow`, `PageHead`, `SectionHeader`, `ProfileHero`, `Bracket`, `MatchPair`). A test fails on any use in `apps/club`.
- More than two lines of text on a card, stacked chips, or a paragraph inside a list row.
- A second hero, or two primary buttons.
- Local helper components that style a card inside a page file. Add it to `packages/ui` and to `/kit` first.

## Type
- **Barlow Condensed** (700, uppercase titles): page titles, section titles, hero names, big numbers and scores. Body stays General Sans.
- Numbers use tabular figures; scores use `--rx-font-score` (also Barlow Condensed).
- **General Sans**: everything else, sentence case. Card titles 17px 600. Body 16px minimum, captions 13px, never below 12. Small category labels (`eyebrow`) are 12px bold uppercase blue.
- No all-caps paragraphs.

## Colour
- Blue `#1B6FE0` (table-tennis-table blue: hero block, buttons, active tab, section titles), night `#081235` (dark bands, scoring), canvas `#F1F3F8`, white surface, line `#DFE3EE`, ink navy `#0B1B4D` (never pure black), secondary text `--rx-ink-3`. Rust is only an accent on old blue-screen pieces. Primary buttons are blue (`--rx-action`).
- Green, orange, red only to say good, warning, bad or live. Never colour alone: add text or an icon.

## Pictures and placeholders
Where a person or club can change a picture, use `PhotoUploader` (`apps/club/components`): current picture + "Change picture" button, a light sheet with Take a photo / Choose from library / Remove, then a drag-and-zoom crop. Never build a custom file input.

Every picture slot uses `Photo` (`kind` person, club, cover). With no upload it shows a designed placeholder: brand gradient from the name, initials or the ball motif. Never a grey box, a broken image or empty space. Pass `alt=""` when the name is written next to it.

## Icons
Hugeicons free set (MIT), always through `<Icon name="..." />` in `packages/ui/src/icons.tsx`. Add a name there, never import the library in a page. Outline style, 1.8 stroke, active tab 2.2.

## Celebrations
Birthdays and club anniversaries use `Celebrations` (bubble above a round photo, like LinkedIn) fed by `celebrations()` in `@rallix/stats`. Month and day only, never age.

## Story highlights (on the white strip under the blue hero)
Live match first, then the latest results. Ring means unseen, muted ring means seen, red LIVE tag for live. Viewer is a native `<dialog>`: progress bars, 5 s auto-advance, hold to pause, tap left or right, Esc closes and focus returns to the ring. With reduced motion there is no auto-advance. Seen state lives in `localStorage` inside try/catch.

## Empty states
`EmptyState` (rackets and ball, 144x96 art, one line, optional hint, at most one button). Static under reduced motion. Use for fully empty lists; inline hints in a populated screen stay plain text.

## Screen recipes
- **Dashboard (Home):** band with stories, one hero, one attention strip or due notice, 2 metrics, 1 to 2 carousels.
- **List (Members, Ranks):** `flat` page, search or segmented control, `ListGroup` or photo grid.
- **Detail (competition, match):** `back` + title in the band, a hero or a `ListGroup`, sections with `SectionTitle`.
- **Form (profile, payouts):** `Panel` per group, one primary button at the bottom.
- **Settings and menus:** `TileLink` grid or `ListGroup` with chevrons.
- **Empty:** one sentence and one button. **Error:** what happened, what to do, one button. **Loading:** skeleton in the same shape.
- **Live scoring** stays a dark, high-contrast scoreboard: instant feedback, no motion, targets 44px or larger.

## Text diet
Under about 150 visible words per screen, including the tab bar. Prefer "Sat 3 Nov, 4:00 pm". Hide empty sections instead of showing "No X yet", unless the empty state is the main content. One primary action per screen.

## Motion
Transform and opacity only, 120 to 320 ms (`--rx-dur-*`). Skeleton shimmer, LIVE pulse and story progress stop under `prefers-reduced-motion`.

## Browser-only code
Never read `window` or `localStorage` while rendering. Do it in an effect so server rendering cannot crash. Active-tab matching is exact or with a trailing slash.

## Before shipping
- [ ] Uses `PageShell` and only the six card kinds. `/kit` updated if you added a component.
- [ ] One hero, one primary action, under about 150 words.
- [ ] No redundant controls: one visible entry point per action per screen. An empty-state button replaces the header action (omit `action` when the list is empty); never show both.
- [ ] Every image slot looks finished with no uploads.
- [ ] Contrast 4.5:1 (3:1 for large text and icons); the contrast test passes.
- [ ] 44px targets, visible focus, Esc closes viewers and sheets.
- [ ] Reduced motion tested; skeleton, empty, error states exist.
- [ ] No sideways page scroll at 360 to 440px; `apps/club/e2e/screens.cjs` passes.
- [ ] Run `rallix-a11y` and `design:design-critique`.
