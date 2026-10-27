# 09 · Settings layout, header consistency, and designing for lots of data

**Version 1.3 · 24 Oct 2026.** Also holds the AI chat pattern (§2A) and the two-pane rule (§2B). Applies to Merchant Admin and Super Admin. Overrides `08` §2.9 and anything earlier that conflicts.

---

## 0. Read this first (Claude)

Same rules as `README.md`: keep every feature, field, route and setting that exists today; change layout, components and wording only. Where this file names a settings section or a column the code does not have, **skip it and list it** in your phase report — do not build it.

---

## 1. Settings — left panel + content pane (ref 17)

Replace today's settings (many cards / tabs on one page) with the Shopify pattern: **one card, two panes**. The left pane lists every settings section, grouped; clicking a section loads its content in the right pane. The URL changes (`/settings/shipping`), so sections are deep-linkable and the browser back button works.

### 1.1 Page header
Standard page header (`08` §1.5): 44px blue icon tile (sliders icon) → **H1 "Settings"** → one muted line `{Store name} · {domain} · {Plan} plan` → right: **Search settings** field (260px, same search component as everywhere else). The header sits in the same tinted card as every top-level page (blue).

### 1.2 The card
- One `card` (radius 14, 1px border) that fills the width, min-height 900px, `overflow:hidden`.
- **Left pane** 260px, background `#FAFAFB`, 1px right border, padding 12px 10px. Scrolls on its own if taller than the viewport; sticky at `top: 24px`.
- **Right pane** fills the rest, padding 24px 28px 32px.
- Below 1024px the left pane becomes the whole page (a list); tapping a section pushes the content as a full page with a "← Settings" back link. No side-by-side on mobile.

### 1.3 Left pane items
- Group label: 12/600 `#6F747E`, margin 14px 0 4px 10px (4px top for the first).
- Item: 36px row, radius 9, 16px stroke icon `#8D919A`, label 13/500 `#454A54`, gap 10px, padding 0 10px.
- Hover `#F2F3F5`. **Active** `#EEF1F5`, label `#111318`, icon `#475569`. No left border, no colour fill — slate only (settings is the slate section).
- Right-aligned meta where useful: a count (`Members 3`, 12px faint) or a small status badge (`SMS notifications · Off`, 18px neutral badge). Never more than one meta per row.
- Keyboard: ↑↓ move, Enter opens, `/` focuses Search settings.

### 1.4 Section list (map to what exists; keep the order)
| Group | Sections |
|---|---|
| Store | Store details · Domain · Plan & billing |
| Store & checkout | Shipping & delivery · Tax · Receipts · Locations (payment apps live in Apps & channels) |
| Team | Members (count) · Roles |
| Notifications | Email notifications · SMS notifications (Off badge when disabled) |
| Account | Login history · Keyboard shortcuts · About Zcom |

Anything the code has that is not in this list (e.g. Integrations, Legal pages, Checkout fields, Languages, Policies): add it to the most sensible group above, keep its existing content, and note it in the report. Nothing is dropped.

### 1.5 Right pane content
- Section header: **H2 18/600** → one muted sentence of what the section does → **one primary button** on the right if the section has a main "add" action (`+ Add shipping profile`). No second primary.
- Then stacked cards, 16px apart, each with the standard card header (title 14/600, muted subtitle 13, ghost small action on the right — `Edit`, `Edit rates`, `+ Add package`).
- Inside cards use the existing patterns: key–value rows (12px vertical padding, 1px `#F1F1F4` dividers, first row no divider), small bordered tables (38px header on `#FAFAFB`, 48px rows), toggles (36×20 switch) for on/off items, 36px icon tiles in soft section colours for named entities (locations, profiles).
- Forms open **inline in place of the card body** (Edit → fields → Cancel/Save right-aligned inside that card), not a modal, unless the form is a destructive or multi-step one that already uses a modal.
- Save behaviour: the sticky **Save bar** from `02-components.md` (appears at the bottom when the pane has unsaved changes: "Unsaved changes · Discard · Save"). Switching sections with unsaved changes asks first.
- Empty sections use the illustrated empty state from `07` (e.g. no custom profiles yet → one line + "+ Add shipping profile").

### 1.6 Search settings
Typing filters the left pane to matching sections **and** shows a flat result list in the right pane ("Shipping & delivery › Packaging", "Payments › Razorpay") when there are hits inside sections. Esc clears. If the code has no field-level index yet, filter the section list only and list the deeper search as a suggestion.

### 1.7 Super Admin settings
Same two-pane card. Groups: **Platform** (General, Plans & pricing, Domains) · **Billing** (Payment gateway, Invoices & receipts, Dunning) · **Team** (Admins, Roles) · **Notifications** · **System** (Audit log, API keys, About). Map to what exists; skip what doesn't.

---

## 2. One header on every page — final rule

Every page in both apps uses exactly one of these three headers. Nothing else.

| Type | Where | Structure (left → right) |
|---|---|---|
| **A · Tinted list header** | Top-level list pages: Products, Collections, Orders, Payments, Contacts, Campaigns, Blogs, Apps, Stores (Super Admin) | Tinted card in the section colour (`07` §3): 44px icon tile → H1 22/600 + muted count → one live summary line → actions right (one blue primary, ghost secondaries). Then the table card with tabs left, **search 240px + Filter · Sort · Columns** right in the same row. |
| **B · Page header** | Dashboards and utilities: Home, Analytics (all tabs), Settings, Help & learn, Notifications | The same tinted card as A (owner, 2026-10-27: every top-level header looks alike): 44px icon tile (section colour; blue for Settings, slate for Help) → H1 22/600 → one muted line → right: the page's control (date range button with 15px calendar stroke icon on Home/Analytics; search field on Settings/Help). Home alone adds the hero strip below (`07` §2). |
| **C · Detail / editor header** | Anything with a parent: product, order, payment, collection, template, blog post, store (Super Admin) | "← Parent" 13px link → H1 22/600 + status badge + one-line meta → right: Preview ↗ / secondary ghost / **Save** blue. No tile, no tint. Sticky at top when scrolling with a 1px bottom border. |

Fixed numbers: H1 22/30/600 letter-spacing −0.01em; icon tile 44px radius 12; header-to-content gap 16px; the search component is identical everywhere (36px tall in headers, 34px in table toolbars, radius 8, 15px icon, placeholder `#9599A2`). Segmented tabs (All · Mobile · Desktop, Day · Week · Month) are the same 32px pill group everywhere, never underlined tabs mixed with pills on one page.

Consistency pass to run (Phase 9 below): open every route in both apps at 1440 and 390 and confirm the header is one of A/B/C with these numbers. List any page that needed a fourth variant instead of inventing it.

### 2A · The AI suggestion — one card everywhere (ref 13)
People already know how Claude and ChatGPT look; the AI layer copies that instead of inventing controls. Wherever AI writes or rewrites something (product description, blog paragraph, template text, email subject, meta title, Super Admin summaries):
- The card (`.ai-edge`, radius 14, padding 16/18, 12px gap between rows) appears **below** the field it is helping, never inside it, 12px under the editor. Everything inside is **left-aligned to one edge**; nothing is indented under the avatar.
- Row 1 — header: 28px **spectrum avatar** with white sparkle · "AI suggestion" 14/600 · muted "· a more premium version of your description" · a ghost **×** at the far right.
- Row 2 — the suggested text, full width, **15/23**.
- Row 3 — **`Use this`** (blue, small) · **`Keep mine`** (secondary, small) · far right a 12px faint note "Replaces the text above · you can undo". Exactly these two buttons; no Try again / Discard / Regenerate, no chips.
- Row 4 — the **ask input**, full width: 40px, radius 10, white, 1px border, pencil icon, placeholder "Ask for changes — shorter, add care notes, add sizing…", dark square send button (28px, radius 8) on the right. Typing replaces the suggestion in place; the previous one is one `↶` away from the × menu.
- While generating: `.ai-live` on the card edge + three-dot shimmer where the text will be. Errors read as a line in the card ("I couldn't reach the AI service. Try again.") with one retry button.
- **Today's brief** on Home uses the same card without the ask input (see `08` §2.1). Longer conversations (the Ask AI panel from `02`) are the same card stretched to a panel: messages alternate, user bubbles right in `#F2F3F5`, AI messages plain with the avatar; the ask input stays pinned at the bottom.

### 2B · The two-pane card — one pattern for "list of things + the selected one"
Settings (§1) and the campaign channel pages (`08` §2.10) use it; so does anything else shaped like *pick one on the left, work on it on the right*: Roles, Notification types, Locations, Super Admin plans, API keys, Sales-channel setup. Left pane 260px on `#FAFAFB` with optional search, group labels 12/600, 36px rows, active `#EEF1F5`; right pane H2 18/600 + one muted line + at most one primary, then stacked cards. The left list is virtualised past 200 rows and filtered by the search. On narrow screens it stacks into list → page with a back link.

---

## 3. Designing for lots of data

Stores will have thousands of products, orders, customers and media files; Super Admin will have hundreds of stores. Everything below is about staying fast and calm at that size. Apply it to every list, table, grid and chart.

### 3.1 Tables and lists
- **Server-side pagination by default**, 50 rows per page (options 25 / 50 / 100). Pagination bar sits in the table footer: "1–50 of 12,480" left, page controls right, 44px tall. Never load everything.
- **Virtualise** any list that renders more than ~200 rows at once (media grid, infinite timelines, Super Admin stores when "show all" is chosen). Row height is fixed (56px comfortable) so virtualisation is simple and scrolling never jumps.
- **Sticky header row** and sticky first column (name) on horizontal scroll. Checkbox column 32px (no right padding), actions column 96px with a visible "Actions" header, both pinned.
- **Column control** (`Columns` button) remembers the user's choice per table in local storage. Default visible columns are the 5–7 named in `03`/`04`; extra columns exist but are hidden, never removed.
- **Sorting** is server-side, one column at a time, arrow in the header; default sort is "newest first" for anything with a date.
- **Filters** apply as chips under the toolbar only when active; "Clear all" at the end. Filters are in the URL (`?status=paid&from=…`) so views are shareable and survive refresh.
- **Bulk select**: selecting rows swaps the toolbar for a bulk bar ("12 selected · Export · Archive · ···"). Selection across pages shows "Select all 12,480".
- **Truncation**: one line per cell, ellipsis, full text in a tooltip; names never wrap. Numbers right-aligned, tabular figures, `₹1,24,500` Indian grouping; IDs in Geist Mono.
- **Counts**: totals in headers and tabs come from the API, formatted compactly above 9,999 ("12.4k") with the exact number in a tooltip.

### 3.2 Loading, empty, error — at scale
- First load: **skeleton rows** (same height as real rows, 8 of them) — never a spinner in the middle of a blank card.
- Page change / sort / filter: keep the current rows visible at 60% opacity with a thin progress line at the top of the table; swap when ready. No full-table flash.
- Empty **because of a filter** → small inline message "No orders match these filters · Clear filters" (no illustration). Empty **because there is nothing yet** → the illustrated empty state (`07` §5).
- Failed load → inline error row with "Try again"; the rest of the page stays usable.
- Slow searches: debounce 300ms, show results count, keep the field focused.

### 3.3 Search
- ⌘K and page search hit the server; results grouped by type (Products, Orders, Customers, Pages, Settings) with the first 5 of each and "Show all N".
- Recent searches and recent items shown before typing. Keyboard-first.

### 3.4 Grids (media, products, collections)
- Virtualised grid, 5–6 tiles per row at 1440 (`08` §1.9), lazy-loaded thumbnails with the blurred placeholder colour, fixed aspect ratio so the grid never reflows while loading.
- Grid/list toggle on every grid; list view is the same data as a table and follows §3.1.
- Media library: infinite scroll in blocks of 60, "Load more" fallback if auto-load fails; folder/tag filter in the toolbar.

### 3.5 Detail pages with long histories
- Timelines, notes and activity logs show the latest 20 with "Show earlier"; never the whole history.
- Order with 50+ items: items table inside the card scrolls after 10 rows (max-height 560px) with a sticky header and the totals always visible below.

### 3.6 Charts and dashboards
- One query per card; cards load independently with their own skeleton. The page never waits for the slowest chart.
- Ranges above 90 days aggregate by week, above 1 year by month — chosen by the API, labelled on the chart ("by week").
- Big numbers in stat tiles never wrap: compact format past 7 digits, exact value in tooltip.

### 3.7 Super Admin specifics
- Stores table: 50 per page, default sorted by health then billing due date; sticky store name; `Log in` stays visible on every row width.
- Earnings charts and store list load separately; store list first.
- Filters for plan, status, health and "payment overdue" in the URL; saved views ("Overdue", "Trials ending this week") as tabs.

### 3.8 Performance budget
- Any route interactive under 2s on a mid-range laptop with the production dataset; list pages render first 50 rows under 300ms after data arrives.
- No table renders more than 100 DOM rows without virtualisation.
- Images via the CDN's resize params (thumbnails ≤ 400px wide), `loading="lazy"`, width/height set.
- Code-split by route; charts and the rich-text editor load only on pages that use them.

---

## 4. QA additions (append to `06`/`08` lists)
- [ ] Settings is one card with left section list + right content; URL changes per section; mobile stacks; unsaved changes prompt on section switch
- [ ] Every settings section that existed before is reachable from the left pane
- [ ] Every AI suggestion is the chat card (avatar, one line, text, Use this / Keep mine, ask input); nothing AI is inside an editor box
- [ ] Every "list + selected item" page (Settings, Templates, Roles…) is the two-pane card
- [ ] Every money detail page: summary strip → status stepper → ids → related order
- [ ] Every route uses header A, B or C with the fixed sizes; search component identical everywhere; one segmented-tab style per app
- [ ] Every table: server pagination (50), sticky header, column control persists, filters in URL, bulk bar, ellipsis truncation, tabular numbers
- [ ] Skeleton rows on first load; faded rows + progress line on page/sort change; filter-empty vs truly-empty states distinct
- [ ] Lists > 200 rows and all image grids are virtualised; no table has > 100 DOM rows
- [ ] Load a store with 5,000+ products and 10,000+ orders in staging: every list page interactive < 2s, no layout jump while thumbnails load
- [ ] Super Admin stores table paginated and sorted by health/billing; `Log in` visible on every row
