# 02 · Shell, layout, components, AI and login

All values come from `tokens.css`. Build each item once as a shared component used by both apps.

---

## 1. App shell — dark sidebar (ref 01, 05, 07)

```
┌──────────────┬──────────────────────────────────────────────┐
│ SIDEBAR 248  │ MAIN (--bg-canvas, scrolls)                  │
│ --nav-bg     │  centred container, padding 28px 32px        │
│              │  Page header → sections                      │
│ wordmark     │                                              │
│ search ⌘K    │                                              │
│ navigation   │                                              │
│ …            │                                              │
│ Notifications│            [ Ask bar — floating, bottom ]    │
│ Settings     │                                              │
│ user         │                                              │
└──────────────┴──────────────────────────────────────────────┘
```

- **Delete the navy top bar completely**, with its centred search, mail icon and "Owner O" button. The page gets the full height.
- Sidebar: `position: sticky; top: 0; height: 100vh;` scrolls internally if needed. Width 248px.
- **Collapse** to a 64px icon rail via a small button at the bottom of the sidebar or `⌘\` / `Ctrl+\`. Collapsed: icons only, tooltips on hover, count pill becomes a dot. Remember in localStorage. Animate width 220ms. Remove the floating « button at the content edge.
- **< 1024px:** sidebar becomes an off-canvas drawer. Show a 52px light header with a menu button, the page title and the bell.

### Sidebar contents, top to bottom

1. **Wordmark** (padding 6px 10px 14px): 22px white rounded square with a black "Z" (radius 6) + "zcommerce" 15px/600 white. Super Admin: add "Super admin" 12px/500 `--nav-text-muted` after it (plain text, no pill).
2. **Search field**: 32px, `--nav-surface` bg, 1px `--nav-border`, radius 8, search icon, placeholder "Search" (Super Admin: "Search stores"), `⌘K` key hint on the right. Click or ⌘K opens the command palette (§13).
3. **Navigation** — 13px/500, 32px rows, radius 8, 16px stroke icons (1.75 stroke).
   - Inactive: text `--nav-text`, icon `--nav-icon`. Hover: bg `--nav-hover-bg`, text white. Active: bg `--nav-active-bg`, text and icon white. **No blue in the sidebar** except the unread count pill.
   - Counts that need action (e.g. orders to fulfil) right-aligned 12px `--nav-text-muted`.
   - Sections with children: the active section shows its children underneath (28px rows, 13px/400, indented 36px, no dots, no tinted group block). Active child: bg `--nav-active-bg`, white text. Only the current section is open; no chevrons pointing left.
4. Divider (`--nav-divider`), then secondary items (Merchant: Apps & channels).
5. Spacer.
6. **Notifications**: bell icon + "Notifications" + **count pill** (18px tall, `--nav-count-bg`, white 11px/600) when unread; nothing when zero. Opens the notifications panel (§12).
7. **Settings**.
8. **User row** (top border `--nav-divider`): 26px avatar with initials, name 13/500 white, email 12px muted. Click → menu: Account · Login history · Keyboard shortcuts · Help · Log out.

**Removed from the sidebar:** the store name/plan switcher ("Nahara · Starter plan"), the "Ready to go beyond basic plan / View Plans" box, "Developed by Zerror Studios © 2026 | Version 1.01.000". Plan and upgrade live in **Settings › Plan & billing**. App version lives in **user menu › Help** (small footer line).

---

## 2. Page layout

```
Page header
 ├─ Left:  H1 (22/600) + muted count ("Products  248")
 │         optional one-line description (14px secondary), only if it tells the user something
 └─ Right: ghost secondary actions … ONE primary button
[Main content: one table card, or sections in a grid with 16px gaps]
```

- **Breadcrumbs:** remove from top-level pages. On detail/edit pages, show one back link above the title: `← Products` (13px secondary).
- **Counts:** never in brackets inside the title ("Products (0)"). Show as muted text after the title; hide when 0.
- **Descriptions:** remove generic ones ("Create, manage, and organize your product listings"). Keep only useful ones.
- **Date range:** one secondary button "📅 Last 30 days ⌄" with presets (Today, Yesterday, Last 7 days, Last 30 days, This month, Last month, This year, Custom) and a "Compare to previous period" toggle inside. Show comparisons inside KPI deltas, not as a sentence beside the picker.
- **Detail pages** (order, product, customer, store): back link + title + status badge(s) + actions; two columns: main (flex 2) and side (320–360px) for status, metadata, notes, timeline.
- **Forms/settings:** 720px column; sticky bar appears when dirty: "Unsaved changes · Discard · Save".
- Bottom padding 96px on pages where the AI Ask bar floats.

### Nearest pattern (for anything not described)
- A list of records → **Table card** (§6).
- A summary or dashboard → **KPI strip + cards** (§5, §4).
- A single record → **Detail page** (above).
- A configuration screen → **Settings form** (above).
- A yes/no change → **Switch** in a settings row; destructive → **Confirm modal**.
- Something AI produced → **AI edge** (§14).

---

## 3. Buttons

| Variant | Look | Use |
|---|---|---|
| Primary | `--accent` bg, white text, hover `--accent-hover` | One per view |
| Secondary | white, 1px `--border-strong`, `--text`; hover `--bg-subtle` | Other important actions, date picker |
| Ghost | transparent, `--text-secondary`/`#454A54`; hover `--bg-muted` | Low emphasis: Import, Export, Cancel, Filter, Sort, Columns, row "Log in" |
| Destructive | white, 1px `--critical-border`, `--critical-fg`; filled `--critical-fg` inside confirm modals | Delete, Suspend, Refund |
| Link | `--accent` text, underline on hover | "View all", inline links |

- Sizes: **36px** default (padding 0 14px, 14/500), **32px** small (in tables/cards, 13px), icon-only 36×36 / 32×32.
- Radius 8. **No pill buttons.** Icons 16px left of label, gap 6px. No arrow "→" icons on buttons.
- **Cancel is never red.**
- Loading: keep width, show 14px spinner, disable.
- Replace every outlined-blue pill (Columns ⌄, Filters ▼, Manage Rates →, Edit Profile, View All Templates, Packages) with ghost or secondary buttons.

## 4. Cards and sections

- White, 1px `--border`, radius 12, **no shadow**. Header 16px 20px: title 14/600 + optional link/ghost action on the right. Body padding 20px.
- **No nested cards.** Separate groups inside a card with a 1px `--divider` or spacing.
- **No icon tiles** in card headers, KPI cells or settings rows.

## 5. KPI strip

- One card, equal cells, 1px vertical dividers. Max 4 cells (5 only if essential).
- Cell: label 13/500 secondary → value 26/600 tabular → one line 12px: green/red arrow + change, then tertiary context ("vs previous 30 days", "3 of 7 stores paid").
- No icons. Negative/alert values may use `--critical-fg` for the value (e.g. Outstanding).

## 6. Table (the most-used component) — ref 05, 07

Structure inside one card:

```
Row 1 (52px):  [All · Active · Draft · Archived]            [🔍 Search products] Filter  Sort  Columns
(Row 1b, only when filters are applied): [Status: Active ×] [Collection: Kurtas ×]  Clear all
Row 2 (40px):  ☐  Product            Status   Inventory   Category        Price   
Rows (56px):   ☐  [img] Name / SKU   ● Active 24 in stock Kurta sets   ₹2,450  ···
Footer:        1–20 of 248                                       Previous  Next
```

- **Row 1 toolbar**: status tabs on the left (underline style §8, stretched to the full 52px so the underline sits on the bottom border). On the right: search input (240–260px, 34px tall, page-specific placeholder), then ghost buttons **Filter**, **Sort**, **Columns** with 15px icons. If a table has no tabs, the search goes on the left and tools stay right.
- **Filters**: "Filter" opens a popover listing the filterable fields that already exist today (status, collection, stock, date, payment, etc.). Applied filters show as removable chips in Row 1b; Row 1b is hidden when nothing is applied.
- **Header row**: 40px, `--bg-subtle`, 13/500 `--text-secondary`, sentence case, bottom border `--border`. Sort arrows on hover/active. **No light-blue header.**
- **Rows**: 56px, 1px `--divider`, hover `--bg-subtle`, selected `--accent-subtle`. Clicking a row opens its detail page; checkboxes and row actions don't.
- **Primary cell**: 36px thumbnail or initials avatar (radius 8) + name 14/500 + secondary line 12px tertiary (SKU, email).
- **Numbers and money right-aligned**, tabular. Empty value: "—" in tertiary.
- **Row actions**: one "···" ghost icon button opening a menu with all existing row actions. Exception: Super Admin stores keep a visible ghost **"Log in"** button (see `04-super-admin.md`).
- **Bulk actions**: when rows are selected, Row 1 is replaced by "3 selected · Actions ⌄ · Clear selection".
- **Footer**: "1–20 of 248" left; Previous/Next small secondary buttons right; rows-per-page (20/50/100) in the Columns menu.
- Sticky header when scrolling inside a long table (`--shadow-sm` appears).
- **Loading**: 8 skeleton rows shaped like the columns. **Empty**: §9 inside the card. **Error**: inline "Couldn't load products. Retry".
- Keep every column that exists today; use Columns to hide less important ones by default if the table is too wide.

## 7. Forms

- Inputs/selects: 36px, radius 8, 1px `--border-strong`, white, 14px, padding 0 12px, placeholder `--text-placeholder`. Focus: 1px `--accent` + `--focus-ring`.
- Label above (13/500, 6px gap); helper text below (12px secondary); error below (12px `--critical-fg`) + red border.
- **No red asterisks.** Mark optional fields "(optional)".
- Checkbox 16px radius 4; radio 16px; **switch** 32×18 for instant settings.
- Search inputs: 15px icon, placeholder specific to the page ("Search orders").

## 8. Tabs

- Underline tabs: 14/500, inactive `--text-secondary`, active `--text` with a 2px `--text` underline, 20px gap, optional muted count ("Live 3").
- Small toggles inside a card (e.g. chart metric) use a 28px segmented control on a `--bg-muted` track.

## 9. Empty states (replace every cactus illustration)

- **Delete the cactus/desert illustration everywhere**, including the 404.
- Pattern (ref 06): 40px `--bg-muted` rounded tile with the section's 20px icon in `--text-secondary` → title 14/600 → one sentence 14px secondary (max 320px wide) → one button.
- Inside small dashboard cards: just one secondary line of text, no icon, no button.
- Copy per page is in `05-wording.md`.

## 10. Badges (status)

- 22px tall, radius 6, padding 0 8px, 12/500, 6px dot before the label, sentence case.

| Tone | Use for |
|---|---|
| success | Paid, Active, Live, Delivered, Fulfilled, Published, Healthy |
| warning | Payment due, Pending, At risk, Low stock, Partially fulfilled, Expiring soon |
| critical | Failed, Overdue, Suspended, Out of stock, Critical, Cancelled, RTO |
| info | Building, Trial, In transit, Scheduled, New |
| neutral | Draft, Archived, Refunded, Inactive, Ended, System |

- Role names (Owner, Admin) and plan names are **plain text**, not badges.
- Map every existing status value in both apps to one of these tones in a single `statusTone()` helper.

## 11. Menus, popovers, tooltips, modals, drawers

- **Popover/menu**: white, 1px `--border`, radius 12, `--shadow-md`, padding 4px; items 32px, radius 8, hover `--bg-muted`; destructive items last, after a divider, in `--critical-fg`.
- **Tooltip**: `--text` bg, white 12px, radius 6, 400ms delay.
- **Modal**: 480/640px, radius 16, `--shadow-lg`, backdrop rgba(17,19,24,.4). Title 16/600 + close; footer right: ghost Cancel + one primary/destructive. Fade + 4px rise, 220ms.
- **Drawer** (right, 420–560px): quick view/edit and the AI assistant. Slide 220ms.
- **Destructive confirm**: title "Delete Aura Apparel?", one sentence of consequence, button "Delete store".

## 12. Toasts and notifications panel

- **Toasts**: bottom-centre, `--text` background, white 14px, radius 12, `--shadow-md`, max 420px, auto-dismiss 4s, optional action ("Undo", "View"). Errors show a red dot and stay until closed. **No coloured full-background toasts at top-right, no exclamation marks.**
- **Notifications panel** (ref 05): opens to the right of the sidebar, anchored to the bell row; 380px wide, radius 12, `--shadow-lg`.
  - Header: "Notifications" 14/600 + "Mark all as read" link.
  - Underline tabs: All · Orders · Shipping · Payments (Super Admin: All · Payments · Stores · Health).
  - Groups "Today" / "Earlier" (12/500 tertiary).
  - Item: 28px icon tile (`--bg-muted`; `--critical-bg` + red icon for failures), title 14/500, one-line detail 13px secondary, relative time right ("2m", "1h", "Mon"), 6px blue unread dot. Click opens the related record and marks read.
  - Footer link "View all notifications" (full page with the same list + filters).
  - Urgent events (payment failed, store suspended) also show a toast with "View".

## 13. Command palette (⌘K / Ctrl+K)

- Centred modal 640px, radius 16. Search input 48px (16px text).
- Sections: Pages · Orders · Products · Customers · Actions (e.g. "Add product", "Create discount") — Super Admin: Pages · Stores · Actions ("Add store", "Send payment reminder").
- Arrow keys + Enter, Esc closes. Last row: "✦ Ask AI: ‹query›" (opens the assistant).

## 14. Charts

- Trends: main series 2px `--chart-1` + soft vertical gradient fill (14% → 0%); previous period 1.5px dashed `--chart-compare`; gridlines 1px `--chart-grid`, horizontal only; axis labels 12px tertiary; ₹ axis abbreviated (₹25k, ₹1.2L, ₹3.4Cr). Projected values: dashed `--chart-projected` outline bars.
- Ranked categories: thin neutral bars (`--text` on `--bg-muted` track) with value on the right.
- Donuts only for ≤4 parts; otherwise a list or stacked bar. Categorical palette in token order.
- Legend top-right, inline 12px. Tooltip uses the popover style.

## 15. Skeleton loading

- Only on first load; shaped like the real content; `--bg-muted` with a soft 1.6s sheen; fade content in over 140ms.
- No giant grey blocks for charts — draw the axes with a flat skeleton line.
- After 8s: inline "Still loading… Retry". After an error: inline message + Retry, not only a toast.

---

## 16. AI layer (ref 01, 03, 04)

One visual language everywhere: the **sparkle icon** + the **spectrum colours**. All AI components behind a feature flag `ai`.

### Sparkle icon
Define the gradient once at app root (`<linearGradient id="ai-spectrum">` with `--ai-1 → --ai-2 → --ai-3`) and use:
```html
<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
  <path fill="url(#ai-spectrum)" d="M12 2.5l2.1 5.6 5.6 2.1-5.6 2.1L12 17.9l-2.1-5.6-5.6-2.1 5.6-2.1z"/>
  <path fill="url(#ai-spectrum)" d="M19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9z"/>
</svg>
```
The spectrum is **reserved for AI**. Never on upgrade prompts, marketing banners, charts or decoration.

### Three states (every AI surface supports all three)

| State | Look | Rule |
|---|---|---|
| Ready (default) | `.ai-edge`: 1px static spectrum hairline + sparkle | Any AI-made content once ready |
| Thinking | `.ai-live`: 1.5px rotating spectrum edge + soft halo, `.ai-shimmer` status text ("Analysing the last 30 days…"), skeleton lines, optional ✓ step list | Only while a request is running; stops the moment the answer renders; after 10s show steps/progress |
| Suggestion | Suggested text in a `--ai-tint` box with dashed `--ai-tint-border`, then Accept · Try again · Discard | Never overwrites user content until Accept |

Thinking → ready: fade the halo out (320ms), swap `.ai-live` → `.ai-edge`, reveal the answer with an 8px rise + fade (320ms). Static under reduced motion.

### AI surfaces

1. **Today's brief** (Home of both apps): one-line `.ai-edge` strip: sparkle · **"Today's brief."** + one sentence · one secondary button · dismiss. Hidden when there's nothing useful. Replaces today's "Insights / Conversion Opportunity" card.
2. **Insight card** (Analytics pages, store detail): sparkle + "Insight · just now" (12px tertiary) → title 14/600 → 2–3 sentences → one primary action + ghost Dismiss → footer: data used + date range, "Helpful · Not helpful". Max one per page.
3. **Ask bar** (Merchant Admin, all pages): floating bottom-centre of the main area, 560px (100% − 32px on mobile), 48px, radius 14, white 92% + 12px backdrop blur, `--shadow-md`, `.ai-edge`. Sparkle · "Ask anything about your store…" · `⌘J` · 32px dark send button. Hides on scroll down, returns on scroll up. Never covers save bars or table footers.
4. **Assistant panel** (ref 04): Ask bar / ⌘K "Ask AI" opens a right drawer 420px: header (sparkle, "Assistant", new chat, close) → conversation → suggestion chips → input (`.ai-edge`) → footer "AI can make mistakes. Check numbers before acting." Answers can include small data cards and action buttons that open or prefill something (never auto-run), plus a "Used: orders, sessions · 8–14 Oct" line.
5. **Write with AI** (product description, SEO fields, blog posts, campaign text, collection description): small secondary button with sparkle next to the field label → Suggestion state → chips ("Shorter", "More premium", "Add care notes").
6. **Super Admin**: Today's brief and Insight cards on Home and Store detail (payment risk, health drops).

AI copy: say what it looked at and how sure it is ("usually", "likely"). Never "magic", "smart", "AI-powered" as labels — the sparkle says it.

---

## 17. Login (ref 02) — both apps

- Remove the split layout and the right-hand marketing panel with the dashboard screenshot.
- Page `#08090C` with a faint dot grid (`radial-gradient(rgba(255,255,255,.07) 1px, transparent 1px)` at 22px) fading into solid at the edges (radial vignette).
- Centre column 380px: wordmark ("Z" tile 26px + "zcommerce" 16/600 white; Super Admin adds "Super admin" muted) → 22px gap → card.
- Card: `#0C0D11`, radius 16, padding 28px, **rotating spectrum edge** (same technique as `.ai-live`, 6s per turn, conic with transparent gaps so a soft arc travels; halo blur 28px, opacity .6). Static under reduced motion.
- Content: "Log in" 18/600 white → "Use the email linked to your store." 14px `#8A8F99` (Super Admin: "Zerror team access only.") → Email → Password ("Forgot?" link right of the label, eye toggle inside the field) → 40px full-width **white** button "Log in" (black text, 600).
- Fields: 40px, `#0F1115`, 1px `#262930`, radius 8, white text; focus border `#7C9BFF` + 3px ring rgba(124,155,255,.22). Keep autofill dark (`-webkit-box-shadow: 0 0 0 40px #0F1115 inset; -webkit-text-fill-color: #fff`).
- Below the card (Merchant only): "New to Zcommerce? **Start your store**".
- Footer: "© 2026 Zcommerce · Privacy · Terms" 12px `#7A7F89`.
- States: wrong credentials → inline error under password, keep email; spinner on submit; lock-out message after repeated failures (keep existing rules). No red asterisks. Keep existing 2FA/SSO flows if any, restyled.
- After logout: land here + bottom toast "You've been logged out."

---

## 18. Micro-interactions

- Hover: background only, 80ms. Press: buttons `scale(0.98)`.
- Menus: fade + 4px slide from anchor, 140ms.
- Save: spinner in the button → toast → save bar slides away.
- Copyable IDs (Geist Mono): click → icon becomes ✓ for 1.2s + tooltip "Copied".
- Live indicators: a 6px green dot that pulses once every 2s. Nothing else animates on its own.
