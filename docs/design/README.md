# Zcommerce UI System — START HERE

**Version 1.0 · 15 Oct 2026 · Owner: Zerror Studios**
Applies to both apps: **Merchant Admin** (store owners) and **Super Admin** (Zerror team).

---

## ⚠️ Read this first (Claude)

**This is a restyle of an existing, mature product, not a rebuild.**

Zcommerce already has a robust, working dashboard with many pages, forms, tables, flows, permissions and integrations. This folder defines a **design system** (look, layout, components, wording) and how it should be applied. Your job is to apply it **sensibly across everything that already exists**.

Hard rules:

1. **Keep every feature.** Do not remove, merge away or hide any existing field, column, filter, action, setting, page, route, permission, API call or business rule. If this folder says "remove", it only means visual clutter (decoration, duplicate controls, wrong copy), never functionality. When unsure, keep it and restyle it.
2. **Do not invent features.** If a page or element described here does not exist in the code, do not build it unless the file explicitly says "new". Instead, list it as a suggestion in your phase report.
3. **No logic changes.** Keep data fetching, state, validation, API contracts and calculations as they are. The only exceptions are the display bugs listed in `03-merchant-admin.md` and `04-super-admin.md`, plus the formatting rules in `05-wording.md`.
4. **Systematic, not page-by-page hacks.** Build tokens → shared components → shell → pages. Pages should only compose shared components. No one-off hex values, font sizes or margins in page files.
5. **When something isn't covered,** use the closest pattern in this folder (§ "Nearest pattern" in `02-components.md`), apply it, and list the decision in your phase report.
6. **Ask before** deleting files, adding heavy dependencies, changing routes without redirects, or touching anything billing- or auth-related beyond its UI.

---

## Files in this folder (read in this order)

| File | What it covers |
|---|---|
| `README.md` | This file: rules, how to work, phases |
| `01-foundations.md` | Product goal, principles, locked design decisions, colour/type/spacing/motion rules |
| `tokens.css` | The actual design tokens (CSS variables + AI utilities). Import in both apps. |
| `02-components.md` | App shell (dark sidebar), page layout, every component (buttons, tables, forms, empty states, toasts, notifications, ⌘K search, charts), the AI layer, and login |
| `03-merchant-admin.md` | Every Merchant Admin section and page: what changes, layout, columns, actions |
| `04-super-admin.md` | Every Super Admin section and page: metrics definitions, stores table, one-click store login, billing, health |
| `05-wording.md` | Voice, number/date/currency formatting, every label rename, buttons, empty states, toasts, errors for both apps |
| `06-qa-checklist.md` | Acceptance checklist to run at the end of every phase |
| `reference/` | Approved screens (PNG). Match spacing, sizes and colours. Data in them is sample data. |

Reference images:
- `01-admin-home.png` — Merchant home in the dark-sidebar shell
- `02-login.png` — Login (both apps; Super Admin adds a "Super admin" label)
- `03-ai-states.png` — AI thinking / answer / inline suggestion
- `04-ai-assistant-panel.png` — AI assistant side panel
- `05-products-list-and-notifications.png` — list page pattern + notifications panel opened from the sidebar
- `06-type-buttons-badges-empty-state.png` — options we compared. **Chosen: Geist (a), 8px corners (b), blue primary (a).** Badges and empty state are final.
- `07-super-admin-home.png` — Super Admin home with stores table and one-click "Log in"

If an image and the text differ, **the text wins** (some images were drawn before final tweaks).

---

## How to work (phases)

Work one phase at a time. At the end of each phase: commit, take screenshots of every changed page at **1440px** and **390px** wide, run the relevant part of `06-qa-checklist.md`, and send a short report: what changed, decisions you made where the docs were silent, anything you could not do. **Wait for approval before the next phase.**

| Phase | Scope |
|---|---|
| **0 · Audit (no code changes)** | Detect the stack (framework, styling approach, component library, chart library, icon set, router). List every route/page in both apps, every shared component, and where hard-coded colours/fonts live (grep). Map existing pages to the new navigation in `03`/`04`. Report risks. |
| **1 · Foundations** | Add `tokens.css` + Geist fonts to both apps (shared package/folder). Map tokens into Tailwind/library theme if used. Override library defaults so nothing renders with library styling. Add a lint/script that flags raw hex values in components. |
| **2 · Components** | Build/restyle shared primitives per `02-components.md`. Add a hidden `/dev/ui` route that shows every component in every state. |
| **3 · Shell** | Dark sidebar, collapse, mobile drawer, ⌘K search, notifications panel, user menu, navigation labels + redirects for renamed routes, 404 inside the shell. |
| **4 · Login** | Both apps. |
| **5 · Merchant Admin pages** | In the order listed in `03-merchant-admin.md`. |
| **6 · Super Admin pages** | Per `04-super-admin.md`. |
| **7 · AI layer** | Components behind a feature flag `ai`; mocked responses if the backend isn't ready. |
| **8 · Wording + QA** | Apply `05-wording.md` everywhere; run the full checklist; fix. |

---

## For the developer (how to hand this to Claude Code)

1. Copy this whole folder into the repo at `docs/design/` (keep `reference/` inside it).
2. Add this line to the repo's `CLAUDE.md` (create it if missing) so every future session follows the system:
   ```
   ## UI
   All UI work in the Merchant Admin and Super Admin apps must follow docs/design/README.md and the files it lists. Use tokens from docs/design/tokens.css; never hard-code colours, sizes or radii.
   ```
3. Open Claude Code in the repo and send the kickoff prompt below.
4. Review each phase report and screenshots before saying "continue".

**Kickoff prompt:**
```
Read docs/design/README.md first, then every file it lists and every image in docs/design/reference/, fully.

This is a restyle of our existing, working Merchant Admin and Super Admin dashboards, not a rebuild. Keep every feature, field, column, route, API call and permission exactly as it works today. Only change look, layout, spacing, components and wording, using this design system.

Start with Phase 0 (audit). Do not change any code until I approve your plan. Then work one phase at a time; after each phase send screenshots at 1440px and 390px and a short report, and wait for my OK.

Where the docs don't cover something, apply the nearest pattern sensibly and list those decisions in your report.
```

**Prompt to continue each phase:** `Approved. Continue with Phase N. Follow docs/design/ exactly and report back the same way.`

**If something looks wrong:** describe it and point to the rule, e.g. `The Orders table header is light blue. 02-components.md §Table says header uses --bg-subtle. Fix it everywhere, not just on Orders.`
