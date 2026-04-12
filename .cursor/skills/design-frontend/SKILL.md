---
name: design-frontend
description: >-
  Delivers polished, accessible UI in React and Tailwind by following layout,
  typography, color, and component patterns. Use when building or refining
  screens, styling, spacing, responsive behavior, icons, or visual hierarchy;
  when the user mentions frontend design, UI polish, mockups, or layout.
---

# Design Frontend

## When this applies

Use for new pages, component styling, responsive fixes, empty/loading/error states, forms, dashboards, and any request to make the UI clearer or more cohesive—not for backend-only work.

## Stack defaults (this project)

- **UI**: React 19 + TypeScript in `design/`
- **Styling**: Tailwind CSS 4.x utility classes; extend tokens in existing config/theme, do not invent one-off magic numbers when a scale exists
- **Icons**: Lucide React; match size and stroke weight used nearby
- **Routing**: React Router 7

If another stack appears in the repo, mirror its existing components and tokens first.

## Workflow

1. **Survey** — Open similar screens and shared components (layout shell, cards, tables, buttons, inputs). Copy spacing, radius, shadow, and type patterns from them.
2. **Structure** — Define regions (header, main, aside, footer). Use a consistent max-width and vertical rhythm; avoid arbitrary `px` gaps when the codebase uses a spacing scale.
3. **Hierarchy** — One primary action per view; secondary actions visually quieter. Titles, subtitles, and body text should differ by size/weight/color—not only by bolding everything.
4. **States** — Plan default, hover/focus, active, disabled, loading, and error for interactive elements. Focus rings must remain visible (do not `outline-none` without an accessible replacement).
5. **Responsive** — Mobile-first breakpoints; no horizontal scroll on small widths unless intentional (e.g. tables with overflow wrapper).
6. **Accessibility** — Semantic HTML (`button` vs `div` with click), labels for inputs, sufficient contrast, keyboard navigation, meaningful `aria-*` only where needed.

## Visual checklist

- [ ] Alignment: grid/flex used consistently; baselines and edges line up with siblings
- [ ] Spacing: consistent padding in cards and sections; related items grouped closer than unrelated
- [ ] Typography: limited scale (e.g. 3–4 levels); line length readable (~60–75 characters where applicable)
- [ ] Color: neutrals for chrome; accent for actions and highlights; semantic colors for success/warning/error if the app uses them
- [ ] Density: appropriate for the audience (admin/dense vs student/calm); whitespace is intentional
- [ ] Dark mode: if the app supports it, verify both themes

## Implementation habits

- Prefer composition over huge JSX blobs; extract repeated UI into small components when it clarifies layout.
- Reuse existing primitives (Button, Input, Card, Modal) before adding new variants.
- Avoid inline styles except for one-off dynamic values; prefer Tailwind classes aligned with the rest of `design/`.
- Images: appropriate `alt` text; lazy-load heavy media where patterns already exist.

## Anti-patterns

- Random colors or font sizes not used elsewhere on the same surface
- Clickable `div`s without keyboard support
- Tiny touch targets on mobile (aim for ~44px minimum where the design system does not specify otherwise)
- Disabling focus outlines without a visible focus style
- Copy-pasting large blocks of markup instead of reusing shared components

## Output expectations

Ship UI that feels native to the app: same corners, shadows, borders, and motion as neighboring views. If requirements are ambiguous, implement a sensible default and keep the structure easy to adjust (tokens, shared classes, small components).
