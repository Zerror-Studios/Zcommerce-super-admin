# Zcom UI System — START HERE (final, consolidated)

**Version 1.4 · 24 Oct 2026 · Owner: Zerror Studios**
Applies to both apps: **Merchant Admin** (store owners) and **Super Admin** (Zerror team).

This folder is the single source of truth. It consolidates v1.0 (system), v1.1 (expression), v1.2 (fixes + real screens) and v1.3 (Settings, header rule, data at scale) and v1.4 (final Home, Order, Payment, Campaigns, Help, AI card). If two files disagree, **the higher-numbered file wins**, and the text always wins over an image.


> **v2 (30 Oct 2026):** Rohit's final build pack in `../../Zcom-dashboard-handover/` (01 design system, 02 shell, 03 admin pages, 04 super admin pages) supersedes this folder wherever they disagree. Tokens are in `src/styles/tokens.css` (v2 block). The spec's `text-small` / `text-small-strong` are `text-label` / `text-label-strong` in code (HeroUI owns `text-small`).

---

## ⚠️ Read this first (Claude)

**This is a restyle of an existing, mature product, not a rebuild.**

Zcom already has a robust, working dashboard with many pages, forms, tables, flows, permissions and integrations. This folder defines a **design system** (look, layout, components, wording) and how it is applied. Your job is to apply it **sensibly across everything that already exists**, in the phases below, without breaking anything.

Hard rules:

1. **Keep every feature.** Do not remove, merge away or hide any existing field, column, filter, action, setting, page, route, permission, API call or business rule. "Remove" in these files only ever means visual clutter. When unsure, keep it and restyle it.
2. **Do not invent features.** If a page or element described here does not exist in the code, do not build it unless a file says "new". List it as a suggestion in your phase report instead.
3. **No logic changes.** Keep data fetching, state, validation, API contracts and calculations as they are. Exceptions: the display bugs listed in `03`/`04`/`08`, the formatting rules in `05`, and the pagination/virtualisation rules in `09` §3 (those change *how much* is fetched and rendered, not what).
4. **Systematic, not page-by-page hacks.** Tokens → shared components → shell → pages. Pages only compose shared components. No one-off hex values, font sizes, radii or margins in page files. A lint script flags raw values.
5. **Reuse before you add.** Before creating a component, search for an existing one that does the same job and extend it. One search component, one table, one header, one badge, one empty state.
6. **When something isn't covered,** use the nearest pattern (`02-components.md` § "Nearest pattern"), apply it, and list the decision in your phase report.
7. **Ask before** deleting files, adding heavy dependencies, changing routes without redirects, or touching anything billing- or auth-related beyond its UI.
8. **Every phase ends green.** Build passes, type-check passes, existing tests pass, no console errors on any route, and the QA items for that phase are ticked. Never start the next phase on a red build.

---

## Files (read in this order)

| File | What it covers |
|---|---|
| `README.md` | This file: rules, the phase plan, prompts |
| `01-foundations.md` | Goal, principles, locked decisions, colour/type/spacing/motion |
| `tokens.css` | Design tokens (CSS variables + AI utilities). Import in both apps. |
| `tokens-expression.css` | Section colours, hero mesh, gradient avatars, chart gradient (v1.1). Import after `tokens.css`. |
| `02-components.md` | Shell (dark sidebar), page layout, every component, AI layer, login |
| `03-merchant-admin.md` | Every Merchant Admin section and page |
| `04-super-admin.md` | Every Super Admin section and page, metric definitions, one-click store login |
| `05-wording.md` | Voice, formatting, renames, buttons, empty states, toasts, errors |
| `06-qa-checklist.md` | Acceptance checklist |
| `07-expression.md` | Colour and warmth: hero, section colours, active chip only, tinted headers, illustrated empty states, celebrations |
| `08-fixes-and-screens.md` | Every problem found in the 23 Oct review and its fix; page-by-page specs with real screens (ref 11–23) |
| `09-settings-and-scale.md` | **Settings two-pane layout**, the final one-header rule (A/B/C), the **AI chat pattern** (§2A), the **two-pane rule** for list+detail pages (§2B), and the rules for lots of data (pagination, virtualisation, skeletons, search, performance budget) |
| `reference/` | 25 approved screens (PNG). Match spacing, sizes and colours; data in them is sample data. |

Reference index: 01 admin home · 02 login · 03 AI states · 04 AI panel · 05 list + notifications · 06 type/buttons/badges/empty (chosen: Geist, 8px, blue) · 07 super admin home · 08 home final · 09 inner-page tinted header · 10 expression kit · 11 home · 12 orders list · **13 product editor (AI chat card, Google preview)** · 14 image detail panel · 15 choose media · **16 payment detail (four cards)** · **17 settings (two-pane)** · 18 collection editor · 19 (retired — see 25/26) · 20 analytics behaviour · 21 blog editor · 22 blog insert image · **23 help & learn (final)** · **24 order detail (classic)** · **25 campaigns hub** · **26 campaign channel page**.

Earlier images (01–10) were drawn before later fixes; where they differ from 11–23 or from the text, follow 11–23 and the text.

---

## The plan (one phase at a time)

Work one phase at a time, on a branch per phase (`design/p1-foundations`, …). At the end of each phase: build + tests green, commit, screenshots of every changed page at **1440px** and **390px**, run that phase's QA items, and send a short report: what changed, decisions you made where the docs were silent, anything you could not do or skipped. **Wait for approval before the next phase.**

| Phase | Scope | Done when |
|---|---|---|
| **0 · Audit (no code)** | Detect stack (framework, styling, component lib, charts, icons, router, data layer). List every route/page and shared component in both apps. Grep for hard-coded colours/fonts/sizes. Map existing pages → navigation in `03`/`04`, existing settings → `09` §1.4, existing headers → A/B/C in `09` §2. Note every list that loads everything at once (for `09` §3). Report risks and the order you propose for Phase 5. | Audit report approved |
| **1 · Foundations** | `tokens.css` + `tokens-expression.css` + Geist in a shared package used by both apps. Map tokens into the Tailwind/library theme. Override library defaults so nothing renders with library styling. Lint script that flags raw hex/px in components. | Both apps render unchanged but on tokens; lint runs |
| **2 · Components** | Build/restyle the shared primitives in `02` with the fixes from `08` §1 (buttons, AI spectrum, stroke icon set, search component, cards, badges, segmented tabs, grid/list toggle, image controls ≤22px). The **data table** gets its scale features now (`09` §3.1–3.2): server pagination, sticky header, column control, skeleton rows, faded reload, bulk bar, truncation. Hidden `/dev/ui` route shows every component in every state incl. loading/empty/error and a 10,000-row table. | `/dev/ui` approved |
| **3 · Shell** | Dark sidebar (search, nav, notifications & settings at bottom, user row name + store·role, red Log out), active chip colour only, collapse, mobile drawer, ⌘K server search grouped by type, notifications panel, support banner as full-width top strip, 404 inside the shell, renamed routes with redirects. | Shell approved on 1440/390 |
| **4 · Login** | Glow-card login, both apps (Super Admin adds its label). | Approved |
| **5 · Merchant Admin pages** | In this order, each a sub-step with its own screenshots: (a) Home — final layout in `08` §2.1 (overrides `07` §2 hero) · (b) Products list + Product editor + Image detail panel + Choose media (`08` §2.2–2.5) · (c) Collections (`08` §2.6) · (d) Orders list + detail, Payments list + Payment detail (`08` §2.7–2.8) · (e) **Settings two-pane** (`09` §1) · (f) Contacts, Marketing (Campaigns hub + channel pages `08` §2.10) · (g) Analytics incl. Behaviour (`08` §2.11) · (h) Blogs + editor + insert popovers (`08` §2.12) · (i) Apps & channels, Help & learn (`08` §2.13), Notifications page. Each page uses header A/B/C only. | Every page matches its reference and QA items |
| **6 · Super Admin pages** | `04` + `08` §2.14 + `09` §1.7 and §3.7: Home with earnings (month/year/projected), Stores table with health, paid/unpaid, one-click **Log in**; store detail; billing; settings two-pane. | Approved |
| **7 · AI layer** | The one AI chat card (`09` §2A) behind feature flag `ai`, spectrum styling (`08` §1.3), applied to every place AI writes; Ask AI panel; mocked responses if backend not ready. | Approved |
| **8 · Expression** | Celebration moments, illustrated empty states, tinted headers verified everywhere (`07`). | Approved |
| **9 · Consistency + scale pass** | Open every route in both apps: header is A/B/C with the fixed numbers; search component identical; one segmented-tab style; no emoji/mixed icons; no stray card space. Load staging with 5,000+ products / 10,000+ orders / 200+ stores: every list paginated or virtualised, skeletons, no layout jump, routes interactive < 2s (`09` §3.8). Fix everything found. | `09` §4 all ticked |
| **10 · Wording + final QA** | Apply `05` everywhere; run `06` + `08` §4 + `09` §4 in full; fix; remove `/dev/ui` from production builds (keep in dev); final report. | Everything green |

Why this order: tokens and components first means every later page is assembled from finished parts, so pages never need re-touching when a component changes; the table gets its scale features before any list page is built on it; Settings is in Phase 5 because it reuses cards and forms from Phase 2 and the shell from Phase 3.

---

## For the developer (how to hand this to Claude Code)

1. Copy this whole folder into the repo at `docs/design/` (keep `reference/` inside it). If an older `docs/design/` exists from v1.0–v1.2, **replace it** with this one — this folder contains everything.
2. Add this to the repo's `CLAUDE.md` (create it if missing):
   ```
   ## UI
   All UI work in the Merchant Admin and Super Admin apps must follow docs/design/README.md and the files it lists, in phase order. Use tokens from docs/design/tokens.css and tokens-expression.css; never hard-code colours, sizes or radii. Keep every existing feature. Higher-numbered design files override lower ones.
   ```
3. Create a staging dataset with at least 5,000 products, 10,000 orders, 2,000 customers, 1,000 media files and (Super Admin) 200 stores before Phase 9. Fake data is fine.
4. Open Claude Code in the repo and send the **kickoff prompt**. Review each phase report and screenshots against the reference images before replying with the **continue prompt**.
5. If the app is already partly restyled from v1.0–v1.2: start at Phase 0 anyway — the audit tells Claude what is done and what is left, and nothing already correct gets rebuilt.

### Kickoff prompt
```
Read docs/design/README.md fully, then every file it lists in order (01 to 09, tokens.css, tokens-expression.css), and look at every image in docs/design/reference/. Higher-numbered files override lower ones; text overrides images.

This is a restyle of our existing, working Merchant Admin and Super Admin apps, not a rebuild. Keep every feature, field, route, setting, permission and API call exactly as it works today; only layout, components, wording and how much data a list fetches/renders change. Work strictly in the phases in README.md, one phase at a time, on a branch per phase, build and tests green before every report.

Start with Phase 0 (audit, no code changes). Report: stack, every route and shared component in both apps, where hard-coded styles live, how existing pages map to the navigation, how existing settings map to 09 §1.4, which header type (A/B/C) each page gets, which lists currently load everything at once, risks, and your proposed order for Phase 5. Then stop and wait for my OK.
```

### Continue prompt
```
Approved. Start Phase N. Follow the files for that phase, keep every feature, end with build + tests green, screenshots of every changed page at 1440px and 390px, that phase's QA items ticked, and a short report of changes, decisions where the docs were silent, and anything skipped. Then stop.
```

### If a phase report shows something wrong
```
Before continuing, fix these in Phase N: <list>. Re-send the screenshots for those pages only.
```

### Later sessions (after the whole plan is done)
Any new page or component follows `docs/design/`; the `CLAUDE.md` line above makes Claude read it. For a new feature, say: "Build X following docs/design — use header type A/B/C, the shared table, and the nearest existing pattern; list anything the system doesn't cover."
