---
name: rallix-motion
description: Motion guidelines for the Rallix PWA. Use when adding or reviewing animation, transitions, or micro-interactions (score changes, bracket reveals, leaderboard moves, page transitions).
---

# Rallix motion

1. Motion explains change: a score increments, a player moves up the leaderboard, a bracket advances. Skip decoration.
2. Use shared tokens, defined once from the designs: durations (fast 120ms, base 200ms, slow 320ms) and easings (standard, enter, exit). Never hardcode values in components.
3. Animate `transform` and `opacity` only. Avoid layout-triggering properties. Target 60fps on low-end Android phones.
4. Honor `prefers-reduced-motion`: replace movement with a fade or no animation, and keep the information visible.
5. The live scoring screen must stay instant. Feedback is at most 100ms and never blocks the next tap.
6. Use CSS transitions first, and add Framer Motion only for layout or presence animations that CSS cannot do.
7. If the user's designs include prototype motion, match it. Otherwise propose and ask before inventing.
8. Check each animation: does it help, is it accessible, does it cost performance on a slow device.
