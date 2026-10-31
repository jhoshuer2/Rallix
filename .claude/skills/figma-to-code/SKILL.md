---
name: figma-to-code
description: Turn the Rallix designs (Figma link, exported frames, or screenshots) into design tokens and React components. Use when implementing any screen from the designs.
---

# Designs to code

1. Intake: list every screen and flow in the designs. If the Figma connector is unavailable, work from exported PNG/PDF frames or screenshots the user provides. Never guess screens that were not shown. Ask.
2. Extract tokens first: color (light and dark if shown), type scale, spacing, radius, elevation, motion. Put them in `styles/tokens.css` (CSS variables) and map them in the Tailwind config.
3. Inventory components (buttons, inputs, cards, tabs, score tile, bracket, leaderboard row). Build the shared ones in `components/ui/` before the screens.
4. Build mobile first (about 360px), then enhance for wider screens.
5. Include every state: loading, empty, error, offline, and disabled.
6. Compare against the design at the same viewport. List any intentional deviations to the user.
7. Run `design:design-critique` and `design:accessibility-review` on finished screens, and `design:design-handoff` if a spec is needed.
