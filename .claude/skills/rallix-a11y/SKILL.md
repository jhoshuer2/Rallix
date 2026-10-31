---
name: rallix-a11y
description: Accessibility checklist for Rallix screens (WCAG 2.1 AA, mobile PWA). Use when building or reviewing any UI.
---

# Rallix accessibility checklist

- Contrast: text 4.5:1, large text and UI components 3:1. Check both themes if dark mode exists.
- Touch targets at least 44x44px, with spacing between adjacent targets. This matters most on the scoring screen.
- Never use color alone for meaning (win/loss, live status). Add text or an icon.
- Visible focus indicator and a logical focus order. Everything is operable by keyboard.
- Semantic HTML first. Add ARIA only where needed. Live score changes use `aria-live="polite"`.
- Form inputs have labels, clear error messages, and the right `inputmode` (for example `tel` for phone OTP).
- Respect `prefers-reduced-motion` and support text zoom to 200% without breaking layout.
- Images have alt text. Charts have a text or table alternative.
- Run `design:accessibility-review` on key screens and a Lighthouse accessibility audit before each release.
