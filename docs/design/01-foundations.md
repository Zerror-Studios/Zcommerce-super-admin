# 01 · Foundations

## 1. Goal

Zcom is heading into a funding round. Both dashboards must read as a **serious, premium SaaS product**: as easy as Wix, as consistent and dense as Shopify's 2026 admin, with Apple-level calm and polish, and an AI layer that feels native rather than bolted on.

Today's problems (from the screen recordings): Wix-like decoration (pill buttons, light-blue table headers, a navy top bar, 30px bold titles, icon tiles on every card, the same cactus illustration on every empty page), too many outlined blue buttons competing, inconsistent wording and formatting, and visible "under development" states.

## 2. Principles (use these to decide anything not covered)

| # | Principle | In practice |
|---|---|---|
| 1 | **Content first, chrome recedes** | Dark, quiet sidebar; light, calm content. Nothing in the shell competes with data. |
| 2 | **One primary action per view** | One filled blue button per page header or dialog. Everything else is secondary (outlined) or ghost (text). |
| 3 | **Fewer containers** | No cards inside cards. No icon tiles. Use spacing, a divider or a heading before adding a box. |
| 4 | **Colour means something** | Greys do the work. Blue = action, selection, focus. Green/amber/red = status only. AI spectrum = AI only. |
| 5 | **One rhythm** | 4px grid, one type scale, one radius scale. The same element looks identical on every page. |
| 6 | **AI is visible but polite** | A small sparkle and a thin spectrum edge mark AI. Motion only while AI is working. AI never blocks. |
| 7 | **Every screen says what to do next** | Empty states and alerts carry one clear action. No dead ends, no "No data available". |
| 8 | **Respect what exists** | It's a restyle. Keep all functionality; improve how it looks and reads. |

## 3. Locked decisions

| Area | Decision |
|---|---|
| App shell | **Dark sidebar, no top bar.** Sidebar holds: wordmark → search → navigation → (spacer) → notifications → settings → user. **No store switcher / plan box.** (ref 01, 05, 07) |
| Notifications & search | **Both live in the sidebar** on every page. Search also opens anywhere with ⌘K / Ctrl+K. Unread notifications show as a blue count pill on the bell row; the bell opens a panel beside the sidebar. (ref 05) |
| Tables | Tabs and tools share **one row**: status tabs left; search, Filter, Sort, Columns right. Column headings are the second row. (ref 05) |
| Login | Dark page, faint dot grid, small centred card with a slowly rotating spectrum edge. (ref 02) |
| AI colour | **Spectrum**: blue → violet → pink → amber, on the sparkle icon and AI edges. (ref 03, 04) |
| Density | **Comfortable**: 14px body, 56px table rows, 36px controls. |
| Typeface | **Geist** for UI, **Geist Mono** only for IDs, codes and shortcuts. |
| Corners | 8px buttons/inputs, 12px cards/tables/popovers, 16px modals/login card. **No pill buttons.** |
| Primary colour | **Zcom Blue `#1F5EFF`**. |
| Product name | "Zcom" in sentences; text-only "Zcom" logotype (no "Z" tile) in the sidebar and login (02-components §1, §17). Never ZCOM / Zcommerce / ZCommerce in the UI. |
| Language | Indian English spelling (colour, behaviour, analyse), sentence case everywhere. |

## 4. Colour rules

All values are in `tokens.css`. Rules:

- Page background `--bg-canvas`; cards and tables `--bg-surface` with 1px `--border`; **no shadows on cards**.
- Text: `--text` for primary, `--text-secondary` for descriptions/labels, `--text-tertiary` only on white for meta. Never use lighter greys for text that must be read (placeholders excepted).
- `--accent` only for: primary buttons, links, selected states (`--accent-subtle` bg), focus rings, the main chart series, unread count pills.
- Status colours only inside badges, status dots, delta numbers and inline status text (e.g. "Out of stock").
- The AI spectrum only on AI surfaces (see `02-components.md` §AI).
- **Remove from the codebase:** the navy top bar colour, the light-blue table header (`#E5F1FF`-ish), Bootstrap blue `#0D6EFD`, orange/purple/cyan donut colours, any one-off greys. After Phase 1, `grep` for hex values in component/page files should return (almost) nothing.

## 5. Typography rules

- Load Geist 400/500/600 and Geist Mono 400 (npm `geist` package or Google Fonts). Geist includes ₹.
- **Only these sizes:** 12 (caption), 13 (sidebar, table header, secondary rows), 14 (default body, cells, inputs, buttons, card titles), 16 (modal/settings group titles), 22 (page H1), 26 (KPI values). Nothing larger in the app (login uses 18).
- Weights: 400 text, 500 labels/buttons/nav, 600 headings/KPIs. **Never 700.**
- `font-variant-numeric: tabular-nums` on every number in tables, KPIs, charts, prices.
- **No ALL CAPS** anywhere ("TOTAL REVENUE", "OWNER", "SUPER ADMIN", "LIVE" → sentence case).
- Geist Mono only for order numbers, SKUs, transaction IDs, discount codes, keyboard shortcuts.

## 6. Spacing and layout

- 4px grid. Common gaps: 4/8 inside controls, 12/16 inside cards, 16 between cards, 20 header → content, 32 page side padding (16 on mobile).
- Content max-width: 1200px (dashboards, detail pages), 1440px (wide tables). Centred. Merchant settings and form pages use the full content width (owner change 2026-10-17; was a 720px column).
- Card padding: 16px 20px header, 20px body. Table cells: 14–16px side padding.
- Breakpoints: ≥1280 full; 1024–1279 sidebar collapsible; <1024 sidebar becomes a drawer; <640 single column, tables scroll horizontally inside their card. No horizontal page scroll ever.

## 7. Motion

- Durations: 80ms (hover/press), 140ms (menus, tooltips, tab switch, skeleton fade), 220ms (drawers, modals, sidebar collapse), 320ms (AI answer reveal). Easing `--ease-standard`.
- No page-transition animations, no bouncing, no count-up numbers, no animated charts beyond one 300ms fade.
- Motion is reserved for (a) things that open/close and (b) AI that is working.
- Respect `prefers-reduced-motion` (already in `tokens.css`).

## 8. Accessibility (non-negotiable)

- All text meets WCAG AA (tokens are pre-checked).
- Every interactive element is a real `<button>`, `<a>` or form control, reachable by keyboard, with a visible focus ring.
- Icon-only buttons have `aria-label` and a tooltip.
- Status is never colour-only: badges carry a word; deltas carry an arrow.
- Minimum target size 32px (36px default).
