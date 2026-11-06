# Zcom dashboards · Round 2 fixes

**For:** Ayush (and Claude Code)
**From:** Mehak, Zerror Studios
**Reviewed:** 6 Nov 2026, live builds
- Merchant Admin: `store.zerrorstudios.com/store/kesar-kin/admin`
- Super Admin: `platform.zerrorstudios.com`

**Goes with:**
- `Zcom-dashboard-v2/README.md` (the v2 developer guide). It is still the source of truth for tokens, components and structure.
- The design boards in `Zcom-dashboard-v2/screens/`.

**Where this file wins:** where it differs from the v2 guide, this file wins. Those places are marked **CHANGED**.

**Screenshots:** every annotated screenshot is in `screenshots/`. Red numbered boxes are problems; the numbers match the list under each image.
- `G…` are global issues.
- `M…` are merchant pages.
- `S…` are Super Admin pages.
- `P…` are phone screens.
- `…b-…-vs-design` are side-by-side comparisons with the design board.
- `screenshots/raw/` holds the unmarked captures (`m…` merchant, `s…` Super Admin, `p…` phone). Short references like `m11` point there.

---

## 0. How to use this file

1. **Put the folder in the repo.** Copy it to `docs/review-r2/` (this file + `screenshots/`). Keep `docs/design-v2/` (the v2 pack) next to it.
2. **Start Claude Code with the kickoff prompt** in §11. It works through **all phases (§10) in order, without stopping** for review between phases. You don't fix anything by hand first: the data bugs (§7) are phase R2-1 and Claude fixes them before the styling work.
3. **Keep a running log.** After each phase, add a short note to `docs/review-r2/progress.md` and commit. If a Claude Code session ends, start a new one with the **Resume** prompt (§11).
4. **Share one final report with Mehak** when every phase is done. Include before/after screenshots at 1440px and 390px, and anything you decided that this file doesn't cover.
5. **Don't mark an item done until it passes** its acceptance line and the QA list in §9.

**Ground rules (same as v2):**
- Build the structure exactly.
- Keep every capability; when something moves, it must still work in its new place.
- Use shared components and tokens only, with no one-off values.

**Priority labels:**
- **P0:** broken, wrong data or blocks the demo.
- **P1:** structure, or missing parts of the design.
- **P2:** polish.

---

## 1. Summary: the 12 things that matter most

| # | What | Where | Pri |
|---|---|---|---|
| 1 | Analytics content stops at 1200px and leaves ~180px empty on the right | All analytics pages (G8) | P0 |
| 2 | A new page opens at the previous page's scroll position | Every route, desktop and phone (G9) | P0 |
| 3 | Wrong or contradictory data: swapped units/revenue, "Cancelled + Awaiting payment", 4 different 30-day sales totals, "12 uses · 0 customers", funnel going up, SEO scores fixed at 75/50/0/40 | §7 | P0 |
| 4 | Product editor marks itself unsaved on open; Discard resets Profit/Margin to 0 | Product editor | P0 |
| 5 | Zcom AI bar: new compact chat box behaviour, viewport-centred, no chip/⌘J | Shell (G3) | P1 |
| 6 | Search and Notifications as centred pop-ups | Shell (G1, G2) | P1 |
| 7 | Business insights rebuilt as sub-tabs with charts, words first, date picker | Analytics (§5.12) | P1 |
| 8 | Inbox: no page scroll, depth, better filters, Send via WhatsApp/Email/SMS | Inbox (§5.2) | P1 |
| 9 | Customers: groups as tabs, rule builder, correct filters | Customers (§5.7) | P1 |
| 10 | Marketing colours and missing sections; Payment detail; Shiprocket wallet; Help tickets | §5 | P1 |
| 11 | One button system, one pop-up size system, one hover/radius rule, one drawer header | Global (§3) | P1 |
| 12 | Blog editor: light workspace, one-row toolbar, proper block selection | Content (§5.10) | P1 |

---

## 2. Motion: subtle, Apple-like, never "loading"

**The goal:** things feel physical and quick. Nothing should feel like it is waiting or loading.

**Rules:**
- Animate only `transform` and `opacity`.
- One shared motion file; no inline durations.
- Respect `prefers-reduced-motion`: reduce everything to a 120ms opacity fade.

**Tokens:** add to `tokens.css` and use these names only.

```css
:root{
  --ease-out: cubic-bezier(.22,1,.36,1);      /* most enter motions (iOS-like) */
  --ease-in-out: cubic-bezier(.65,0,.35,1);   /* move/resize between two states */
  --ease-in: cubic-bezier(.4,0,1,1);          /* exits only */
  --dur-1: 120ms;  /* hover, press, colour, toggles */
  --dur-2: 180ms;  /* pop-ups, menus, popovers, toasts */
  --dur-3: 240ms;  /* drawers, sheets, AI chat box */
  --dur-4: 320ms;  /* AI box → large view, page-level layout change */
}
```

**Springs:** if you use Framer Motion / Motion One, use these and nothing else.

```ts
export const spring = {
  snappy: { type: "spring", stiffness: 520, damping: 38, mass: 0.9 }, // pop-ups, popovers, chips
  soft:   { type: "spring", stiffness: 340, damping: 34, mass: 1 },   // drawers, sheets, AI box
  layout: { type: "spring", stiffness: 260, damping: 32, mass: 1 },   // shared-layout morphs (AI box → large)
};
// all three settle without visible overshoot (<2%). No bounce anywhere.
```

**What moves, and how:**

| Thing | Enter | Exit |
|---|---|---|
| **Pop-up** (all sizes) | Scale .96 → 1, y 8 → 0, opacity 0 → 1, `snappy`; scrim fades over `--dur-2` | Opacity → 0, scale → .98, 120ms `--ease-in` |
| **Popover / menu** (wallet, ⋯ menus, date picker) | Scale .97 → 1 from the trigger's corner (`transform-origin` = anchor), opacity, `snappy` | 100ms fade |
| **Drawer** (filter, order preview) | x 24px → 0 + opacity, `soft`. Don't slide the full width; it looks slow | 140ms |
| **AI bar → chat box** | The box grows out of the bar: shared layout, `layout` spring, radius 27 → 22. Content fades in 60ms after | Reverse |
| **AI chat box → large view** | Shared layout morph, `layout`, 320ms | Reverse |
| **Toast** | y 12 → 0 + opacity, `snappy`. Stay 3.2s; pause on hover | 140ms |
| **Tabs / segmented control** | The active pill slides between tabs (shared layout, `snappy`). Content cross-fades 120ms; no height jump | n/a |
| **Row hover** | Background colour 120ms | n/a |
| **Press** | Buttons and cards scale .98 on `:active` (80ms) | Back with `snappy` |
| **Summary panel collapse** | Height via `grid-template-rows: 0fr ↔ 1fr` (not JS height), 240ms `--ease-in-out` | n/a |
| **Numbers** | Never count up. Show the final value immediately | n/a |
| **Charts** | Draw once on first view (bars rise 8px + fade, 240ms, stagger 12ms, max 300ms total). Never re-animate on tab switch or refetch | n/a |
| **Page change** | Content fades 0 → 1 over 120ms. No slide, no spinner. Keep the menu and title row still | n/a |

**Never feel like "loading":**
- **Skeletons:** only when data takes more than 300ms. They must match the final layout to the pixel, so nothing jumps. Shimmer once at 1.2s; it doesn't loop forever.
- **Cached data first:** show the last data immediately (React Query / SWR `staleTime`), then refresh in the background. Only show a small "Updating…" dot in the title row when it refreshes.
- **Prefetching:**
  - Prefetch a route's data on menu hover/focus, and on table row hover for detail pages.
  - Tabs inside a page (Super Admin store tabs, analytics tabs) prefetch all tabs after first paint.
- **Optimistic updates** for toggles, tag edits, status changes, mark-as-read. Roll back with a toast on error.

**Acceptance:**
- Record a 10s screen capture of: opening search, a pop-up, the filter drawer, the AI box → expand, and switching tabs.
- No element should move in two directions, overshoot visibly, or wait for data before starting its motion.

---

## 3. Global fixes (apply everywhere)

### G1 · Search: centred palette, bigger, working click · P1 · `screenshots/G01-search.jpg`
**Now:**
- Clicking the Search box in the menu does nothing; only Ctrl/⌘K opens the palette.
- The palette is about 400px wide, products only.

**Build:**
- **Opening:** click on the menu Search box, ⌘K / Ctrl K, or the search icon on phones.
- **Size and place:** the Medium pop-up size, **640px wide**, max height 560px. Centred horizontally, top at 14vh (it doesn't jump when results change height). Radius 22, the shadow token, scrim `rgba(11,12,16,.32)` with no blur.
- **Input:** 64px tall, 17px text, search icon left, "Esc" key hint right.
- **Empty state:** "Recent" (last 5 searches/opened items) + "Jump to" (Orders, Products, Customers, Settings).
- **Results:**
  - Grouped with small Mono uppercase headings: **Orders, Products, Customers, Pages, Settings**. Max 4 per group + "See all 23 orders →".
  - Row height 48px: 32px icon tile or product thumbnail, title, grey sub-line (order: customer · ₹ · status; customer: email · orders), right-aligned type hint.
  - Match highlighting in semibold.
- **Keyboard:** ↑↓ move, ↵ open, ⌘↵ open in new tab, Tab cycles groups.
- **Speed:** debounce 120ms; results from one `/search` endpoint; show cached results instantly while fetching.
- **Phone:** a full-screen sheet with the input pinned at the top.

**Accept:** click and ⌘K both open it; "saree" returns products, orders containing a saree and the Sarees collection.

### G2 · Notifications: centred pop-up · P1 · **CHANGED** (v2 said right drawer) · `G02-notifications.jpg`
**Now:**
- A right drawer whose tabs overflow and get cut.
- No visible close button.

**Build:**
- **Size and motion:** the same pop-up family as search, Medium **640px**, height up to 72vh, centred, same open motion.
- **Title row:** bell icon tile, "Notifications", unread count, "Mark all as read" (text button), close (36px).
- **Tabs:** All · Orders · Payments · System, with counts. They fit in one row; no scrolling.
- **Rows:**
  - Like Inbox rows: icon tile by type, one-line sentence ("₹4,498 paid by Fatima Qureshi"), time right, blue unread dot.
  - Click opens the record and closes the pop-up.
  - Grouped by Today / Yesterday / Earlier.
- **Empty state:** ink icon tile + "You're all caught up".
- **Menu badge:** the menu item "Notifications" shows a red count badge (see G11).
- **Phone:** a bottom sheet at 85% height.

### G3 · Zcom AI bar: new behaviour · P1 · **CHANGED** (v2 §3.3) · `G03-ai-bar.jpg`
**Closed bar:**
- **Place:** centred on the **whole viewport** (`left: 50%; transform: translateX(-50%)` on a `position: fixed` element), not the content area.
- **Size:** width `min(560px, 100vw - 32px)`, height 52, radius 26, bottom 24px (+ safe-area on phones).
- **Contents:** only the orb (28px) + placeholder "Ask Zcom AI anything…". **Remove the suggestion chip and the ⌘J hint.** ⌘J still works; the shortcut shows in the tooltip only.
- **Visibility:** subtle shadow so it is always visible on white and on grey:
  `box-shadow: 0 1px 0 rgba(255,255,255,.8) inset, 0 8px 24px -8px rgba(11,12,16,.18), 0 0 0 1px rgba(11,12,16,.06);` with a white background.
- **Page padding:** content keeps 112px bottom padding so the bar never covers the last row or the pagination.
- **Hidden on:** Inbox, the AI full view, editors (product, post, collection, lookbook), the sign-in flow, and any page with its own composer.

**Step 1 (click or ⌘J): compact chat box.**
- **Shape:** a squarish card grows out of the bar (shared-layout morph, §2). **420 × 560px**, radius 22, anchored bottom-centre at the bar's position. The page is not dimmed; clicking outside closes it.
- **Header (48px):** orb, "Zcom AI · sees ‹Page›" in 13px, and three icon buttons: history, **expand ⤢**, close.
- **Body:**
  - Empty state "How can I help?" + 3 suggestion rows for the current page (these replace the old chip).
  - Answers stream in as chat bubbles. Each answer ends with one action button and the line "Nothing is sent or changed until you say yes."
- **Input:** pinned at the bottom of the box, 16px text, send button.

**Step 2 (⤢): large view.** Morphs into the current half-height view, then to full (as built now). Shrink returns to the box; Esc steps back one level.

**Phone:** the bar is full width minus 16px with no hint. Tap opens the box as a bottom sheet at 70% height, draggable to full.

**Accept:** at 1710px the bar's centre equals the viewport centre (±1px). The box opens in under 250ms without a page dim.

### G4 · Pop-up sizes: one system · P1 · `M04-media-popup.jpg`
**Now:** sizes are inconsistent (Choose media is nearly full-screen; others vary).

**Use exactly four sizes**, as a `size` prop on one `<Dialog>` component:

| Size | Width | Use |
|---|---|---|
| `sm` | 420 | Yes/no, delete, discard, leave without saving, sign out |
| `md` | 640 | Short forms, search, notifications, new tag/category/author, wallet details on phone |
| `lg` | 960 | Builders and pickers: **Choose media**, New customer group (rule builder), app details, import |
| `full` | 100vw − 64 / 100vh − 64 | Only the AI large view and the media editor (crop) |

**The same for every size:**
- Radius 22, padding 22, scrim `rgba(11,12,16,.4)` with no blur.
- Title row: 36px icon tile, title, close.
- Footer: right-aligned Cancel then action; a secondary link on the left.
- Body scrolls inside; header and footer stay fixed. Max height 86vh.

**Audit:** list every dialog in the codebase with its current width and map it to a size. Include the list in your phase report.

### G5 · Hover and radius on lists · P1 · `G05-hover-radius.jpg`
**Now:** row hover is a square block that pokes out of rounded cards. Seen on Marketing › Ready to send (last row), and it likely affects every card list.

**Fix once in the shared `List`/`Table`:**
- Container: `overflow: hidden` + `border-radius: 22px` (cards) / 18px (small cards).
- Hover background `#F6F7F9`, 120ms.
- Sticky table headers keep the top radius (`border-top-left/right-radius` on the first header cell, or clip the scroll container).

**Check:** Orders, Payments, Products, Customers, Campaigns, Discounts, Blog posts, Tags, Categories, Authors, Settings lists, Super Admin tables, Notifications, Search.

### G6 · Drawers: one header · P0 · `G06-drawer-close.jpg`
**Now:** the close button is clipped at the top-left corner in the order preview, the customer drawer and notifications.

**Build:**
- **Header:** 64px, 20px padding. Title (and sub-line) left. On the right: prev/next arrows (when the drawer browses a list) and a 36px close.
- **Shape:** drawer width 440px, radius 22 on the open edge, the shadow token.
- **Body and footer:** body scrolls; the footer (primary action) sticks to the bottom.
- **Opening:** a click anywhere on a table row opens the drawer (not only the order number). The chevron does too. Checkbox and ⋯ clicks don't.

### G7 · Toasts · P2 · `G07-toast.jpg`
**Position:** bottom-centre, **above the AI bar** (bottom 92px), max width 420.

**Style:** ink background, white text, 14px, radius 14. Optional action ("Undo"). Stack max 3.

**Clicks:**
- A click on a row opens the record.
- Copy-to-clipboard only happens from an explicit copy icon (appears on row hover, always visible on detail pages).

### G8 · Content width · P0 · `G08-width.jpg`
**Measured:**
- The page wrapper is `zc-page max-w-content-wide` (1440px).
- Inside it, analytics pages wrap content in `flex max-w-content flex-col` (**1200px**, left-aligned).
- So at a 1710px window, the title row ends at x=1660 but cards end at x=1484.

**Fix:**
- Remove the inner `max-w-content` on all analytics pages (Overview, Sales, Customers, Traffic, Marketing, Business insights). Grep the repo for every other use.
- Every block, table and chart fills the same width as the title row.
- Tables use the full width with sensible column widths: identifier column flexible, numbers fixed and right-aligned.

**Accept:** at 1440px and 1710px the right edge of the last card equals the right edge of the title row's last button.

### G9 · Scroll reset on navigation · P0 · `G09-scroll-reset.jpg`
The app scrolls inside `<main class="zc-main … overflow-y-auto">`, so the router's scroll restoration never touches it.

**Fix:** on every route change (not on hash or query-only changes), set `main.scrollTop = 0`. On browser Back/Forward, restore the saved position for that history entry. Same on phones.

### G10 · Buttons: one system · P1
**Measured live:** heights 26/28/32/36; font sizes 12/13/14; a black primary ("Connect Claude"); white outlined secondaries ("Add cost prices", SA "Create store" ghost); tinted secondaries ("Pause", "Show all 12 videos").

**One `<Button>` component.** Delete every other button style.

| Variant | Look | Use |
|---|---|---|
| `primary` | `#1F5EFF` fill, white text, hover `#1A52E6`, press scale .98 | **One per view**: the main action (Save, Create order, Send) |
| `secondary` | `#EEF3FF` fill, `#1F4FD6` text, 1px `#DCE5FF` | Other actions next to the primary (Pause, Preview, Message owner, Show all) |
| `ghost` | Transparent, `#1F4FD6` text, hover `#F1F5FF` | Inline/text actions (Open Email →, Documentation, See all) |
| `dark` | `#0B0C10` fill, white | Only: Mark done, Log out, Connect Claude (hero on a light card) |
| `on-dark` | White fill, ink text | Buttons on gradient/AI cards and the Home/SA hero (Create store, Add cost prices) |
| `danger` | `#D92D20` fill, white | Only delete/discard confirmation buttons |
| `icon` | 36px round, white, 1px `#E3E4E9`, ink icon; active = ink fill | ⋯, filter, sort, edit, delete, close |

**Sizes:**
- `md` 36px / 14px / padding 0 16px (default).
- `sm` 32px / 13px / padding 0 12px (inside cards and tables only).
- Nothing else.

**Shape:** all pills (radius 999). Icon + label gap 6px; icon 16px.

**Disabled:** 40% opacity, no hover; Save is disabled until the form is dirty.

**Rule:** if a row or card has an edit and a delete, both are `icon` buttons (pencil, trash), with a tooltip.

**Accept:** a script that lists every `button, a[role=button]` with height/radius/background finds only these 7 variants × 2 sizes. Run it on 10 pages; include the output.

### G11 · Menu: store switcher and counts · P1
**Store switcher:**
- **Now:** shows "KE kesar-kin" (slug).
- **Build:** "KK" from the display name, **Kesar & Kin** (store name), **kesarandkin.in** (domain) under it, and the switch chevron (board 29/37).

**Counts:**
- Inbox shows the "to reply" count (grey, right).
- Notifications shows a red badge with the unread count.
- Both update live (poll every 60s or via the existing socket).

**Profile row:** "Aarav Mehta · Owner". Remove the slug from it.

### G12 · Back buttons and breadcrumbs · P1
**Remove the round back button** from every page that is in the menu: Orders, Payments, Marketing, Discounts, Help, Apps, analytics, etc.

**Detail pages** (order, payment, discount, campaign, product, post, SA store) use the text breadcrumb **"‹ Orders"** above the title (13px, `#5F646E`, hover ink), as on the boards.

### G13 · Money, dates and names · P1
**Money:**
- **Lists and cards:** whole rupees (₹2,039 not ₹2,039.15).
- **Detail pages:** exact paise only where money is settled (payment amount, fees, refunds). Never "₹0.00": write "₹0" or "Nothing due".

**Dates:** "27 Oct", "27 Oct, 1:12 AM", "Today 10:42", "Yesterday".
- Never ISO ("2026-11-05").
- Never mixed "am"/"AM": pick **AM/PM**.

**Names:**
- The brand is **Zcom** in all UI copy (not ZCOM).
- Use the store display name everywhere (not the slug).
- Plan names in Title Case (Starter, Growth, Plus, Custom), never CAPS.

### G14 · Browser tab titles · P2
**Format:** `‹Record› · ‹Section› · Zcom`. For example "Handwoven Jute Tote · Products · Zcom" or "Order #1880 · Orders · Zcom".

**Now:** the product editor shows just "Zcom".

### G15 · Test data · P0 (before any demo)
Hide or delete "MCP TEST Saffron Kurta", "MCP TEST Folder" and similar items from the demo store. If they must exist, put them in an archived/hidden state.

### G16 · Depth system (fixes "everything is white or grey") · P1
Add three surface levels and use them deliberately:

| Level | Background | Border | Shadow | Use |
|---|---|---|---|---|
| Page | `#EBECF0` | none | none | App background |
| Card | `#FFFFFF` | 1px `#E3E4E9` | none | Cards, tables |
| Inset | `#F6F7F9` | 1px `#EEF0F3` | none | Chat canvas, stat tiles inside cards, code/preview areas |
| Raised | `#FFFFFF` | 1px `rgba(11,12,16,.06)` | `0 1px 2px rgba(11,12,16,.06), 0 6px 16px -8px rgba(11,12,16,.12)` | Composer, chat bubbles, sticky toolbars, floating editor toolbar |
| Floating | `#FFFFFF` | none | `0 30px 70px -24px rgba(11,12,16,.35)` | Pop-ups, menus, AI bar/box, drawers |

### G17 · Shared date-range picker · P1
One `<DateRangePicker>` used on Analytics (all tabs), Business insights, Home period, SA Home/Analytics, Billing, and discount/campaign dates.

**Trigger:** a secondary pill with a calendar icon + label ("Last 30 days", "1 Oct – 4 Nov").

**Popover:** 640px, anchored under the trigger.
- **Left: presets.** Today, Yesterday, Last 7 days, Last 30 days, This month, Last month, This quarter, This year, Custom.
- **Right: two months side by side.** Range selection with a soft blue fill between the dates; today ringed.
- **Below:**
  - "Compare to" switch: Previous period / Same period last year.
  - Cancel / Apply.
  - Time inputs only for discount/campaign dates.

**State:** the choice is stored in the URL (`?from=&to=&cmp=`) so links keep the range. Remember the last range per section.

**Phone:** a bottom sheet with presets first and one month at a time.

### G18 · Row actions · P2
**Rows:** have only **›** at the end. **⋯** shows on row hover (desktop) and as a long-press / swipe action on phones. Never ⋯ + ⌄ + › together (Super Admin Stores).

**Clicks:** the whole row opens the record.

---

## 4. Shell details

- **Admin banner:** "You're viewing kesar-kin as Zerror admin. Changes are logged."
  - Keep it.
  - Use the store display name.
  - Make it 32px tall.
  - On phones: one line "Viewing as Zerror admin · Exit".
- **Menu order:** as v2 §3.1. Help & support gets **My tickets** and **What's new** (missing now).
- **Super Admin menu:** add **Support** (Tickets, Announcements, Guides & videos) and **System health** (missing now).

---

## 5. Merchant Admin: page by page

### 5.1 Home · P2 · `m01`, `m02`
- **Stock to watch:** the empty state is one grey line in a big card.
  - Use the empty-state recipe: small green tick tile + "Nothing runs out in the next 14 days" + a ghost link "See inventory".
  - Card height matches Sales by day.
- **Needs attention:** remove the gap when it has fewer than 4 items; the card height follows the content.
- **Phone:**
  - The TO DO card is 220px for one sentence: auto height.
  - The hero period chip is cut at the edge: the chips row scrolls with a fade mask.
  - Sales by day: the label says "8 Oct to 6 Nov" but the chart shows 14 days and is empty. Show "No sales since 25 Oct" inside the chart area when the window has no sales.

### 5.2 Inbox · P1 · `M01-inbox.jpg`, `P03-chat-mobile.jpg`
**Keep the 3-pane layout.** Fix:

1. **No page scroll.**
   - The page is `height: 100dvh` minus the banner, with `overflow: hidden`.
   - Only the conversation list, the message area and the profile body scroll. Each has its own `overflow-y: auto` and `overscroll-behavior: contain`.
   - **Now** the page scrolls 60px.
2. **Hide the floating AI bar on Inbox.** It covers the composer now. AI lives in the composer as "Draft with Zcom AI" (orb + text button).
3. **Depth** (G16):
   - **Message area:** Inset background `#F6F7F9`.
   - **Incoming bubbles:** white Raised, radius 18 (4 on the tail corner), max-width 72%, timestamp under it in 11px Mono grey.
   - **Outgoing bubbles:** ink `#0B0C10` with white text, aligned right. A channel tag under each ("via WhatsApp").
   - **Chat header:** white with a 1px bottom border that turns into a soft shadow when scrolled.
   - **Composer:** a Raised card, 16px from the edges.
   - **Selected conversation:** white with a 3px ink left bar. Others sit on `#FAFAFB`.
4. **Better filters.**
   - **Top segmented:** **To reply · Waiting on customer · Done** (with counts).
   - **Type chips row** (scrolls sideways), each with a count: Orders · Returns & exchanges · Reviews · Restock requests · Collaboration · Contact form.
   - **Filter icon** opens the drawer:
     - channel (WhatsApp, Email, SMS, Instagram, Contact form)
     - assigned to (Me, Unassigned, teammate)
     - unread only
     - has order
     - date
   - **Sort:** Newest, Oldest, Waiting longest.
5. **Send via** (sends from inside Zcom; see §5.16 for the services).
   - A segmented control in the composer footer: **WhatsApp · Email · SMS**. Unavailable channels are disabled with a tooltip ("No phone number", "Customer hasn't agreed to WhatsApp", "SMS sender not set up").
   - **Default:** the channel the customer used last.
   - **Send button:** "Send on WhatsApp" / "Send email" / "Send SMS". It sends in-app; no more opening the phone's WhatsApp or email app.
   - **WhatsApp 24-hour rule:** if the customer's last WhatsApp message is older than 24 hours, the composer switches to "Pick a template" (approved templates only) and explains why in one line.
   - **SMS:** only approved (DLT) templates can be sent in India, so SMS also uses a template picker with fill-in fields.
   - **Status ticks** under each sent message: Sent ✓, Delivered ✓✓, Read (blue ✓✓, WhatsApp only), Failed (red, with Retry).
   - **Quick replies:** a "+" menu with saved replies + "Ask for the order number".
6. **Profile panel.**
   - "customer since" → "Customer since Mar 2026".
   - "Last ordered —" is a bug: show the date or "No orders yet".
7. **Phone:** list → chat full screen → profile full screen (as now). Hide the AI bar.

**Accept:** at any window height the page never scrolls; the composer is fully visible; switching Send via changes the button label.

### 5.3 Orders · P1 · `G04-wallet.jpg`, `G06-drawer-close.jpg`, `P01-orders-mobile.jpg`
- **Shiprocket wallet** (v2 §4.7, board 11): build the capsule + 380px popover anchored under it.
  - **Capsule:** 40px pill, logo in a 32px white circle, balance, + button, coloured by health.
  - **Popover:**
    - balance and days left
    - progress bar with the run-out date
    - auto-recharge switch
    - Add money (primary)
    - Shipping costs (secondary)
    - colour key
  - **When the balance can't load:** the capsule shows "₹ —" with a small retry icon, and the popover shows the error inline with Try again and Open Shiprocket ↗. **No centred modal.**
- **Tabs:** add **Abandoned** (23) and keep Returns as a tab. Toolbar: add the **sort** icon button.
- **Table:**
  - Sticky header.
  - The whole row opens the preview (G6).
  - Whole rupees (G13).
- **Status logic (P0):** many orders show **Cancelled + Awaiting payment**. A cancelled order shows only "Cancelled" (plus "Refunded" or "Not charged" if relevant). Payment badges only show for open orders.
- **Summary panel:** "Orders this month 0" while the list has 900 orders dated 27 Oct. Check the date filter (timezone / created_at vs imported_at).

### 5.4 Order detail · P1 · `m11`, `m12`
- **Merge the payment cards:** the "Awaiting payment ₹7,597 due" card duplicates the Payments card. One **Payment** card at the top of the main column:
  - status
  - amount due
  - Send payment link (primary) with a channel choice: WhatsApp · SMS · Email (§5.16)
  - Copy link
  - Mark as paid (⋯)
- **Header:** add the next action as primary (Send payment link → Mark as packed → Ship → Mark delivered, depending on status), **Print invoice** (secondary), and ⋯ (Cancel, Refund, Duplicate, Print packing slip).
- **Side column** (board 14):
  - Customer (with orders count and lifetime ₹)
  - Shipping address
  - Delivery (courier, AWB, tracking link)
  - Order source
  - Tags (editable chips)
  - Notes (editable)
- **Money:** no "₹0.00" (G13).

### 5.5 Payments and Payment detail · P1 · `M02-payment-detail.jpg`, `M02b-payment-vs-design.jpg`
**Payments list:**
- **Customer column is "—" for every row** (P0 data bug: join the order's customer). The column is far too wide; use these widths: Amount 120, Customer flex, Method 140, Status 130, Date 140.
- Whole rupees in the list.

**Payment detail** (match board 15):
- **Top cards, in this order:**
  1. **Paid by:** name, city, "2nd order".
  2. **Paid with:** UPI app + VPA, or card ••4421.
  3. **Fees:** ₹ fee and "You get ₹X".
  4. **Reaches your bank:** expected date, bank ••4421, "in 2 days".

  Remove the Merchant and Time cards.
- **What happened:** a vertical timeline.
  - Done steps are green dots joined by a green line.
  - **Paid is a green tick (✓) in a green circle.**
  - Every step has a sub-line (method, UPI id, "Receipt emailed to …").
  - Above the list: "3 minutes from checkout to paid".
  - The future step "Reaches HDFC ••4421 · Expected Mon 26 Oct" is hollow grey.
  - A failed step is a red ×.
- **Details:** copy icons on Transaction ID, Cashfree order ID and **UPI reference** (add it).
- **Customer card:** add "2 orders · ₹8,996 lifetime".
- **Refund:** "You can refund until 22 Apr 2027".
- **Breadcrumb:** "‹ Payments".

### 5.6 Products and Product editor · P0/P1 · `M03-product-editor.jpg`, `M04-media-popup.jpg`
**List:**
- **Columns as board 16:** Product, Price, Status, Stock, **Sold · 30d**, Sells on, **Revenue · 30d**. Two are missing now, and there is a big gap after Product.
- **Sells on:** show every channel icon (Store, Instagram, WhatsApp).
- **Running low ring:** shows red at 0. Colour follows value; at 0 the ring is green "All stocked".
- **Speed:** the list and summary take about 5s. Target under 800ms for first rows. Paginate server-side, select only list fields, and add indexes for status/updated_at.

**Editor:**
- **P0 dirty-state bug:** opening a product and changing nothing marks it unsaved ("Leave without saving?" + browser "Leave site?").
  - Build the dirty check by deep-comparing the current form to the **normalised** loaded values (trim strings, normalise description HTML, numbers as numbers, sort arrays).
  - "Discard" must reset to loaded values. Now it sets Profit to ₹0 and Margin to 0%: computed fields must recompute, not reset.
- **Variants card:**
  - **Header:** title + one secondary "Edit variants" + ⋯ (Add option, Link media, Manage stock in Inventory).
  - **Option rows** (Colour: Marigold, Rose, Ivory): two **icon** buttons, edit (pencil) and delete (trash).
  - **Table columns:** thumbnail (32px, tap to pick an image), Variant, Price (shows a sale price only when On sale is on), **Stock** (new), SKU (one line, Mono, truncate in the middle with a tooltip), Barcode (truncate in the middle), Status.
- **Tags:** add a **Tags** field in Organisation. Chip input with autocomplete from existing tags, Enter creates, and the same tag store as the blog (v2 §6).
- **Search listing:** move it out of the side column into a **full-width card** in the main column, under Variants.
  - Google preview with a Desktop | Mobile switch.
  - Title (60-char counter) and Description (160-char counter), each with "Write with Zcom AI".
  - URL slug with the domain prefix.
  - Focus keyword.
  - The score ring + a checklist that explains the score: "Title has the keyword ✓", "Description 120–160 characters ✓", "Image alt text 2 of 3 ✗".
  - **Make this one shared component** used by products, collections, lookbooks, blog posts, categories and tags.
- **Reviews card:** keep (Mehak likes it).
- **Choose media pop-up:**
  - Use size `lg` (960).
  - Folder tiles show a 2×2 preview of the newest images; names left-aligned under the tile; item count as the sub-line.
  - The left panel gets a 1px divider (not a separate grey slab).
  - Footer: "3 selected" + Cancel + Add files.

### 5.7 Customers · P1 · `M05-customers.jpg`, `M06-customer-filter.jpg`, `M07-new-group.jpg`
- **Groups as tabs** next to All: **All · VIP · Loyal · New · Slipping away**, then saved groups, then "+ New group" as the last tab-like ghost button.
  - **Ready-made groups exist for every store** by default:
    - VIP = spent ₹15,000+ in 12 months
    - Loyal = 3+ orders
    - New = first order in the last 30 days
    - Slipping away = no order in 90 days and 2+ orders before
  - The rules are editable.
  - The summary panel then shows real VIP/Loyal numbers instead of "—".
- **City column:** "—" for every row. Map it from the default shipping address (city, state).
- **Filter drawer:** shows **product labels**, which is the wrong source (P0). Customer filters:
  - orders (number range)
  - amount spent (range)
  - last order (date range)
  - city / state
  - subscribed to (Email, WhatsApp, SMS)
  - customer tags
  - group
  - signed up (date range)
  - has an open order
- **New group = rule builder** (size `lg` 960):
  - **Left side:**
    - Name.
    - "Customers who match **all ▾ / any ▾** of these".
    - Rows of **field ▾ · rule ▾ · value** (for example "Amount spent · is more than · ₹15,000"; "City · is any of · Mumbai, Pune"; "Last order · is before · 90 days ago"). "+ Add condition"; groups of conditions with AND/OR.
    - Fields as in the filter list.
  - **Right side:**
    - A live **count** ("42 customers · ₹8,96,400 spent").
    - A preview list of the first 8.
    - "Updates automatically as customers change".
  - **Secondary tab:** "Pick people by hand" (the current checklist), for one-off groups.
  - **Footer:** the group shows as a tab on Customers; Cancel; **Save group**.
- **Drawer close button:** fix with G6.

### 5.8 Marketing · P1 · `M08-marketing.jpg`, `M08b-marketing-vs-design.jpg`, `G05-hover-radius.jpg`
**CHANGED:** v2 §2.1 retired channel colours, but **Marketing overview keeps the board 25 colours** (Mehak's decision). Use them only on these three cards.

- **Channel cards:**
  - **Gradients** (exact values from the board file):
    - Email `linear-gradient(150deg,#4A0F14 0%,#8E1F26 55%,#C9353C 100%)`
    - SMS `linear-gradient(150deg,#0B1F57 0%,#163FA8 55%,#2F6BF0 100%)`
    - WhatsApp `linear-gradient(150deg,#06321C 0%,#0E6E3A 55%,#1DA851 100%)`
  - White text; a status chip top-right (white 18% fill).
  - 3 stat tiles in white 14% fill with a 1px white 20% border.
  - Buttons: `on-dark` primary (Set up sender / Turn on consent / Connect WhatsApp) + white ghost link.
- **AI suggestion banner** under the cards: light blue fill `#F1F6FF`, blue edge, orb, one sentence, "Schedule it" (primary sm), "Edit first" (secondary sm).
- **Dates to plan for:** 4 cards (Diwali, Wedding season, Black Friday, Christmas & year-end). Each has a Mono date, title and one line ("1 draft ready"); the nearest date gets an amber tint. "Full calendar" link.
- **Two columns below:** Ready to send (left) and **Runs by itself** (right). Runs by itself is a list of automations with on/off toggles: Abandoned cart reminder, Back in stock, Welcome series, Win-back, Review request.
- **Rows:** sub-line "Email · all subscribers · 100 people"; channel icon in an icon tile.
- **Header:** "Plan with AI" (secondary, orb) + "New campaign" (primary). No back button.
- **Hover radius bug:** fix with G5.
- **Campaigns:** the pagination ("Rows per page") differs from Orders/Products. Use one `<Pagination>`.

### 5.9 Discounts and Discount detail · P1 · `M09-discount-detail.jpg`, `M10-discount-dates.jpg`
- **List:** a click on the code copies it instead of opening (G7). Make the counts in the title and tabs agree.
- **Detail** (board 29):
  - **Header:** "‹ Discounts" breadcrumb.
    - **Actions by status:**
      - Live: Copy link · Pause · Save.
      - Ended: Duplicate · Restart.
      - Scheduled: Start now · Save.
    - Save stays disabled until the form changes.
  - **Subtitle dates must agree** with the side card. Now it says "since 27 Oct" against "26 Mar – 15 May".
  - **What the shopper sees:** the coloured ticket card (red gradient for live, grey for ended), code in Geist Mono 22px, the line under it, a perforated edge (two half-circles cut out).
  - **How it's doing:**
    - Used
    - Sales with this code (₹)
    - Discount given (₹)
    - Came back for a 2nd order
    - "See the 12 orders →"

    **P0:** "Customers who used it 0" with 12 uses is wrong.
  - **Form order and layout** (2-column grid):
    1. **Type** (4 cards).
    2. **Value:** Code | Amount off; Applies to | Minimum order.
    3. **Who can use it:** Everyone / New customers only / A customer group (picks a group from 5.7). Visible, not hidden in More options.
    4. **Limits and dates:** toggles + Starts | Ends with the shared date picker (G17). Replace the browser's native date-time inputs.
  - **Radio buttons:** unselected radios must show a `#C9CDD6` ring.

### 5.10 Content (blogs) · P1 · `M11-post-editor.jpg`, `M12-post-editor-align.jpg`, `M13-tags.jpg`, `M14-authors.jpg`
**Blog posts list** (board 37):
- **Default view:** cards, with the switch remembered.
  - Cover image 16:9 with the status pill on the image.
  - Category, title (2 lines), one-line excerpt.
  - Footer: author left; "412 reads · 2 orders" or "Goes live Sat, 10 AM" right.
- **Table view:** add **Reads · 30d** and **Orders** columns.
- **SEO:** every post shows 75 "Add 1 keyword". Compute it per post with the shared SEO component.
- **Header subtitle:** an insight ("Your journal brought 1,212 visits this month · 4 led to an order").
- **Post ideas:** the AI card at the bottom (3 idea chips + "Write with AI").

**Post editor:** make it tasteful and calm.
- **Layout:**
  - Three columns on the page background `#EBECF0`.
  - **Left panel:** 240px, white, 1px right border. **No black.**
  - **Canvas:** a white sheet, max 760px reading width, centred, 48px top padding, radius 22, 1px border.
  - **Right panel:** 320px, white, toggled by the sliders icon (tooltip "Post settings").
- **Toolbar:** one row only.
  - Sticky at the top of the canvas column, Raised (G16), radius 14, height 44.
  - Groups:
    - Block type ▾ (Paragraph, Heading 2, Heading 3, Quote, Small)
    - B I U Link
    - Bulleted, Numbered
    - Align ▾
    - Text colour ▾
    - Undo Redo
    - ⋯ (Code, Indent, Clear formatting)
  - Remove the font-size dropdown; size comes from the block type.
  - When the toolbar is stuck, the canvas text scrolls under it **behind a white background**, never through it.
- **Block selection:**
  - **Text blocks:** no box when focused. On hover a **6-dot handle + "+"** appears in the left gutter (24px outside the text column, `#8A8F9A`). Drag reorders; "+" opens the insert menu.
  - **Images, galleries, embeds:** a 2px `#1F5EFF` ring (radius = image radius) plus a small floating toolbar above: Replace, Alt text, Size (Inline / Wide / Full), Caption, Delete.
  - **Selected text:** the standard bubble menu (B I Link · Heading).
- **Alignment:** title, dek, author row and body all start on **one left edge**. Now the body is indented 32px.
- **Title:** 40px/48 semibold, no outline. Dek: 19px `#5F646E`.
- **Tags:** only in the right panel. Remove the chips + "Edit tags" above the title. The right panel shows **selected** tags as chips + a search-or-create input with suggestions, not every tag in the store.
- **Category:** a select with search + "New category".
- **Outline (left panel):** highlights the section in view; click scrolls to it with the 320ms ease.
- **Search & social:** the shared search-listing component (5.6) as a right-panel section or an `md` pop-up.
- **Keep:** autosave line "All changes saved · 414 words · 2 min read", Preview, Save draft (secondary) + Publish ▾ (primary).

**Tags** (board 39):
- Add **Products** and **Reads · 30d** columns.
- "Used most in" from data (top 1–2 categories).
- Summary cards: Tags in use · Most used · **Brings most readers** · **Idea** (AI-suggested tag).
- SEO ring computed and coloured by score. **0 must show a red stub, not an empty circle.**
- A tag with 0 posts gets an amber chip + amber 0.

**Authors** (board 40):
- Sub-line = role (Founder, Content, Guest writers), not "Kesar & Kin Journal".
- "Writes about" (top category) and "Last post" from data.
- Add Reads · 30d.
- Summary "Average read 3 min 40 s · readers finish 68%".
- Profile SEO computed, showing the next fix.

**Categories:**
- Banner thumbnails are empty placeholders: show the banner or a tinted tile with initials.
- SEO is 50 on every row: compute it.
- "Needs a new post: None · No published posts yet" contradicts 18 posts.

### 5.11 Analytics (Overview, Sales, Customers, Traffic, Marketing) · P0/P1 · `G08-width.jpg`, `M15-traffic.jpg`, `M15b-traffic-vs-design.jpg`
- **Width (G8) and scroll reset (G9)** on every analytics page.
- **Route:** `/analytics/traffic` redirects to Overview, and the real route is `/analytics/behaviour`. Make **/analytics/traffic** the route; 301 `/behaviour` → `/traffic`.
- **Date control:** the shared date picker (G17) + Compare, on every tab, **including phones** (it disappears on phones now; put it under the title, full width).
- **Data warning:** the amber banner card from board 33: "Visitor numbers stop at 27 Oct because Google Analytics hasn't synced since then." + "Reconnect" (secondary). **Not** a thin text line with "Fix ›".
- **One metrics service** (P0): the same 30 days shows 4 different sales totals (₹6,01,428 SA Home · ₹14,42,952 Overview · ₹15,01,004 SA Stores · ₹15,42,156 Business insights).
  - Define each metric once (net sales = gross − discounts − refunds, paid orders only, store timezone).
  - Expose it from one place.
  - Put the definition in the ⓘ tooltip.
- **Overview:**
  - The 5th tile (Sold out) sits alone on a row: 5 equal columns, or move it into Needs attention.
  - Sales over time drops to ₹0 after 25 Oct. If true, write "No orders since 25 Oct" on the chart; if not, fix the query (this is orders data, not GA).
- **Sales:**
  - "How people paid" shows the gateway (Cashfree 100%). Show the **method**: UPI, Cards, Net banking, Wallets, COD.
  - Products table: real thumbnails.
- **Customers:** the New vs returning donut floats alone in a full-width card. Pair it with "Came back within 90 days" + a small cohort strip (board 32).
- **Traffic, behaviour overview missing:** the Visitors tab opens with the board 33 overview:
  1. **Funnel:** "From visit to order", amber bars stepping down, green final bar, the red drop % under each step, a "Biggest drop" chip.
  2. **Where visitors come from** with "% buy" per source.
  3. **Devices** donut.
  4. **Top landing pages** with share who bought.

  Then the deeper tabs (Funnel, Pages, Events, Forms) as now.

  **P0 funnel bug:** "Looked at a product 8,786" > "Visited 5,389". Count **people/sessions** per step, not events.

  The "Live" toggle needs a tooltip ("Updates every 30 seconds").

### 5.12 Business insights: rebuild · P1 · `M16-insights.jpg`, `M17-insights-bug.jpg`
**Now:** one 5,660px scroll of number tiles and ranked lists, with period buttons and "Refresh now".

**Build:**
- **Header:** title, the shared date picker (G17) with Compare, ⋯ (Export, Schedule email report). Remove "Refresh now"; show "Updated 1 h ago" with a small refresh icon.
- **Sub-tabs** (underline tabs, sticky under the title): **Overview · Sales & profit · Customers · Products & stock · Where sales come from · Marketing return.** Each tab is one screen-and-a-half at most. Each tab answers one question a store owner actually asks:
  - Overview: "How is my business doing?"
  - Sales & profit: "Am I making money?"
  - Customers: "Who buys, and do they come back?"
  - Products & stock: "What should I push, fix or restock?"
  - Where sales come from: "Which cities, channels and payment methods matter?"
  - Marketing return: "Are my campaigns and discounts worth it?"
- **Each tab starts with "In short":**
  - An AI card (orb, light blue) with **3 plain-language sentences**, each with a link.
  - For example: "Hyderabad brought 18% of sales; it grew fastest this month (+41%)." "Your average order fell 9% because more people bought single kurtas." "Add cost prices for 31 products to see real profit."
  - Then charts, then the details table (collapsed "Show all").

| Tab | Charts (from the dataviz rules: one idea per chart) | Words |
|---|---|---|
| **Overview** | 4 KPI tiles (Net sales, Orders, Average order, Repeat rate) with sparklines; a line chart of net sales vs the compare period; a "What changed" bar chart of the 5 biggest movers (cities, products, channels) | 3-line In short + "What to do next" action cards (2–3, with buttons) |
| **Sales & profit** | Net sales and profit lines over time; a waterfall: Gross sales → Discounts → Refunds → Shipping → Cost of goods → **Profit**; margin by category bars; average order value trend. If cost prices are missing: a progress ring "Cost prices for 21 of 52 products" + Add cost prices | "You kept ₹38 of every ₹100 sold"; "Discounts took 1.6% of sales; FLASH500 alone cost ₹6,000" |
| **Customers** | New vs returning stacked bars per week; repeat rate trend; a cohort heatmap (month of first order × months later); the 5 ready-made groups (VIP, Loyal, New, Slipping away) with counts and ₹, each linking to Customers; top customers list | "64% came back to buy again within 12 months"; "18 VIPs haven't ordered in 60 days: send them a note" |
| **Products & stock** | Best sellers by revenue and by units (two small bar charts side by side; **fix the swapped units/revenue bug**); "viewed a lot, rarely bought" list (views vs orders); slowest sellers; days of stock left for the top 10; sold-out variants still getting views | "Bandhani Georgette Saree is your top earner"; "Chanderi A-line Kurta runs out in 6 days at this pace" |
| **Where sales come from** | India map with bubbles (reuse the Overview map) + ranked bars for the top 10 cities; a state table (sales, orders, share, growth); sales by channel (Store, Instagram, WhatsApp); payment methods donut; prepaid vs COD; cancellation and return rates by city | "3 cities bring half your sales; Pune is growing fastest (+41%)"; "All orders are prepaid; COD isn't on yet" |
| **Marketing return** | Sales from each campaign and discount code (bars), cost (discount given + message cost) and return per ₹1 spent; email/WhatsApp/SMS sent → opened → ordered; blog posts that led to orders; abandoned-cart recoveries | "Your WhatsApp campaigns earned ₹14 for every ₹1 spent; email earned ₹6"; "WELCOME200 brought 82 first orders" |

**Copy rules:**
- Write like a person: "190 orders, 67% more than the 30 days before". Not "Orders is 190, up 66.67% on the previous period (good)".
- One decimal at most.
- Hide growth when the base period has fewer than 10 orders; say "Not enough history yet". "Growth vs last year 2,029%" must not appear.
- The brand is Zcom (not ZCOM).

**Accept:**
- Each tab loads in under 1s from cache.
- No tab is longer than 2 screens at 1440×900.
- Every number has an ⓘ definition.
- The In short sentences come from the same numbers shown below them.

### 5.13 Help & support · P1 · `M18-help.jpg`, `M18b-tickets-design.jpg`
- **Menu:** Tutorial videos · Guides · **My tickets** · **What's new** (the last two are missing).
- **Header** (board 43): Mono eyebrow "HELP & SUPPORT · TUTORIAL VIDEOS", title "How can we help, Aarav?" (36px), search (pill, 360px), **Raise a ticket** (primary). No back button.
- **Videos:**
  - Until videos exist, **hide the inline "Video coming soon" player** (it takes half the page).
  - Cards follow v2 §4.8 (4 rotating looks, duration chip only when the video exists).
  - A card without a video opens the matching guide.
  - Remove the blue outline on the first card.
- **Categories:** 5–6 (Getting started, Orders, Payments, Marketing, Store design), with counts.
- **Popular guides:** a doc icon tile, title, "Orders · 4 min read" sub-line, and **›** on the right that opens the guide page. Not an accordion with a left-pointing ‹.
- **My tickets** (board 44):
  - **Tabs:** All · Open · Waiting on you · Solved.
  - **Table:** Ticket (title + Mono "ZC-2041 · raised 4 Nov"), Topic, Status, Updated.
  - **Right drawer:**
    - Mono id + topic.
    - Title.
    - **4-step tracker:** Received → Looking into it → Fix ready → Solved.
    - "Usually solved within 1 working day · priority High".
    - Chat thread with attachments.
    - Quick-reply buttons from support ("Yes, switch at 4 pm").
    - Composer with attach and send.
  - **Raise a ticket** (`md` pop-up): topic, title, description, attachments, priority (auto, editable), and which order/product it is about (optional search).
  - **The same tickets appear in Super Admin › Support** (board 45).
- **What's new:** a dated list of releases (version, date, 3 bullets, screenshot).

### 5.14 Apps & channels · P2 · `M19-apps.jpg`
- App names are truncated: allow 2 lines, or use short names (MSG91, Nimbbl, Shiprocket).
- **Nimbbl** shows "Primary" while it is retiring: amber **Retiring 30 Nov** chip + "Switch to Cashfree" (primary sm) on the card.
- **Card footer:** "Manage" (secondary sm) + ⋯ (Documentation ↗, Disconnect). Remove the unclear "+".
- **One grid:** 4 columns at ≥1440, 3 at ≥1100, 2 on tablet, 1 on phone. Now "Connected" is 3 columns and "More apps" is 4.

### 5.15 Settings · P2 · `m50`
- The Store setup checklist shows twice (main column and sidebar card). Keep the sidebar progress card; the main list only on Store details.
- **One status icon set:** empty ring = to do; amber ! = needs attention; green ✓ = done.
- **Phone:** the settings sub-menu becomes a select at the top.

---

### 5.16 WhatsApp and SMS sending (connect the services) · P1
Some things must reach customers on WhatsApp or SMS, not only email. Connect both services this round and build **one messaging service** that every part of Zcom uses.

**Providers:**
- **SMS:** MSG91 (already connected as the store's messaging app). India requires a DLT-registered sender ID and DLT-approved templates; store the template IDs per store.
- **WhatsApp:** the WhatsApp Business Platform (Meta Cloud API, or MSG91's WhatsApp product if that is simpler with the existing MSG91 account; pick one and keep it behind the same interface). Messages outside the 24-hour window must use Meta-approved templates.
- **Email:** keep the current sender.
- **Code:** one `MessagingService.send({ channel, to, template | text, variables, orderId?, customerId? })` with a provider adapter per channel. No page calls a provider directly.

**Where it is used:**

| Place | What gets sent | Channels |
|---|---|---|
| Inbox (§5.2) | Replies; WhatsApp messages come **into** the Inbox too (incoming webhook) | WhatsApp, SMS, Email |
| Order detail (§5.4) | Payment link, order confirmed, shipped with tracking link, delivered, review request | WhatsApp, SMS, Email |
| Orders › Abandoned | Checkout reminder with the cart link | WhatsApp, SMS, Email |
| Marketing › Runs by itself (§5.8) | Abandoned cart, back in stock, welcome series, win-back, review request | WhatsApp, SMS, Email |
| Campaigns | The existing SMS and WhatsApp channels send through the same service | WhatsApp, SMS |

**Settings › Notifications:**
- A table of events (Order confirmed, Payment link, Shipped, Delivered, Abandoned cart, Back in stock, Review request) × channels (Email, WhatsApp, SMS) with on/off switches.
- Each cell opens the template: preview, variables, approval status (Approved / Pending / Rejected).

**Settings › Apps (setup):**
- **WhatsApp:** connect the business number, sync the approved templates, show the quality rating.
- **SMS:** sender ID, DLT entity ID, template list with DLT IDs.
- A "Send a test" button for each channel, which sends only to the owner's own number.

**Consent and safety:**
- Track opt-in per customer per channel (checkbox at checkout, imported consent with source and date).
- Honour STOP / opt-out replies automatically.
- Never send marketing to someone without consent; transactional messages (payment link, shipped) are allowed for customers who gave a number.
- Rate-limit bulk sends.
- In the demo store, only send to a whitelisted list of test numbers.

**Status and costs:**
- Delivery webhooks update every message: sent, delivered, read, failed (with reason).
- Show the status in the Inbox, on the order timeline ("Payment link sent on WhatsApp · Read 2:14 PM") and in campaign results.
- Show the provider's per-message rate before a bulk send ("About ₹88 for 100 WhatsApp messages").

**Accept:**
- From the demo store, a payment link sends on WhatsApp and SMS to a test number.
- Delivery ticks update.
- A WhatsApp reply from the test number appears in the Inbox within 10 seconds.
- An opted-out number can't be messaged.

**Account setup Zerror handles (build with sandbox/test numbers until these are ready):** Meta business verification and the WhatsApp business number, template approvals, MSG91 DLT sender ID and template registration. List exactly what you need in `progress.md` as soon as you know it.

---

## 6. Super Admin: page by page

### 6.1 Home (board 02) · P1 · `S01-sa-home.jpg`, `S01b-sa-home-vs-design.jpg`, `S02-sa-activity.jpg`
- **Brand block:** Z tile + "Zcom" + "Platform admin" (purple `#A78BFA`, 12px). Greeting "Good morning, **Zerror Studios**".
- **Hero line from the attention engine:** for example "2 stores need you this week: a past-due payment and the Nimbbl shutdown."
- **Hero buttons:** **Announce** (glass) + **Create store** (`on-dark`). The ghost button now is too faint.
- **Attention engine (P0 logic):** the AI card says "Nothing needs attention today" while:
  - 0 stores are live;
  - Nimbbl is retiring with 110 unpaid orders;
  - Nahara's payment is due 15 Nov;
  - 3 stores are in setup with no go-live date.

  Rules, at minimum:
  - payment provider retiring/failing
  - payment due/past due
  - store in setup more than 7 days
  - checkout failures
  - GA/sync stale more than 3 days
  - trial ending in 10 days or less
- **Three equal action cards** (board 02): eyebrow with a coloured dot (ZCOM AI · URGENT / BILLING / ONBOARDING), bold headline, one sentence, 1–2 buttons (Book the call · Plan for all stores / Send reminder / Book a setup call).
- **Recent activity:**
  - **Now:** raw event keys ("tenant.staff_viewed · by admin@zerrorstudios.com").
  - **Build:** map every event type to a sentence + icon ("Mehak opened Kesar & Kin as admin", "Aarav invited Dev Agarwal as Viewer", "Nahara's card was declined for the Starter plan").
  - Group repeats within 10 minutes ("Mehak opened 2 stores as admin").
  - Times: "10:42", "Yesterday", "2 Nov".
- **Raw dates:** "Written 5 Nov, 10:36 am · from 2026-11-05" must use G13 formats.

### 6.2 Stores (board 59) · P1 · `S03-sa-stores.jpg`
- **Plans card** truncates and runs under the ring ("2 STARTER · 1 Kesar & K…"). Show "3 stores · 2 Starter · 1 Custom" with a mini bar.
- **Status (P0):** Kesar & Kin shows **In setup** with 182 orders and ₹15 lakh sales; the header chip says "Set up". A store with paid orders is **Live**. Derive status from go-live, and fix the chip copy ("In setup").
- **Due vs past due:** Nahara shows "Due 15 Nov" while the summary says Past due 0. That is correct, but label it amber "Due 15 Nov" and count it under **Due soon**. Make the summary card "Past due 0 · 1 due soon".
- **Owner:** "—" for 2 stores. Show the invited owner's email if they haven't joined ("Invited · rhea@…").
- **Row actions:** › only + ⋯ on hover (G18). Drop ⌄.

### 6.3 Store detail (board 60) · P1 · `S04-sa-store.jpg`, `S04b-sa-store-vs-design.jpg`
**Now:** the overview opens with an 11-row Setup checklist filling the first screen.

**Layout** (board 60):
1. Breadcrumb "Stores / Kesar & Kin".
2. Title with chips: Live / In setup, plan.
3. Sub-line: legal name · domain · city · "on Zcom since".
4. Actions: Message owner · Open store admin ↗ · ⋯.
5. **Underline tabs:** Overview, Billing, Team, Apps, AI usage, Activity log, Settings.
6. **AI banner:** the one thing to do, with "Schedule a call".
7. **Summary panel:** Sales 30d · Orders · Products live · Customers.
8. **Left:**
   - Store health card: ring + 5 rows (Setup complete, Selling regularly, Team signs in, Payments, Google Analytics) with Good / Failing / Stale chips.
   - Connected apps (chips with status).
   - Activity.
   - **Setup** as a collapsible card ("Setup 4 of 11 · Show steps").
9. **Right:**
   - Plan & billing.
   - Owner (Email / WhatsApp buttons).
   - Notes for the team.

**Fixes:**
- **Health contradicts reality** (P0): 93 "Healthy, all Good" while setup is 4/11, the payment app is retiring and 22 unpaid orders expired. Health must include setup and payments.
- **One plan name:** Overview says "Plus · monthly", Billing says "Kesar & Kin sample store v1 · ₹0", the header says "Kesar & Kin sample store" + "No fee".
- **Tabs:** the first click did nothing and a tab took about 5s. Prefetch all tabs after first paint; show the tab instantly with a skeleton.
- **Billing › Adjust:** five stacked tinted buttons.
  - Use a list of rows (icon, label, ›): Record payment, Issue credit, Record refund, Mark past due.
  - Then a separated red text row: Cancel subscription (opens an `sm` confirm).

### 6.4 Billing, Analytics, Support, System health · P1/P2 · `s07`, `s08`
- **Billing:** "Paid 0" shows an empty ring (G-rule: no empty rings, use a grey full ring at 0). "To collect ₹0" while Nahara owes the Starter fee: check.
- **Analytics:**
  - When every value is ₹0, show an empty state ("No paid plans yet. Revenue shows here once a store pays."), not flat lines on ₹0–₹4 axes.
  - Remove the duplicate sub-tabs (Platform revenue / Money / AI cost) that repeat the menu (Revenue, Stores, AI usage, System). One level only.
- **Support** (new, board 45): every store's tickets.
  - Tabs: Open · Waiting on store · Solved.
  - Columns: SLA timer, store, priority.
  - The same drawer as the merchant side, plus internal notes and assign-to.
- **System health** (new, board 70): uptime, queue lag, failed webhooks, GA sync per store, payment provider status.

---

## 7. Data and logic bugs (P0): fix before any styling work

| # | Bug | Where | Expected |
|---|---|---|---|
| D1 | Units and revenue swapped ("86,295 units · ₹19") | Business insights › Best sellers (revenue) | Units then ₹ revenue; add a unit test |
| D2 | Order shows Cancelled + Awaiting payment | Orders list, preview, phone | Cancelled orders show only Cancelled (+ Refunded / Not charged) |
| D3 | 30-day sales differ: ₹6,01,428 / ₹14,42,952 / ₹15,01,004 / ₹15,42,156 | SA Home, Analytics, SA Stores, Insights | One metrics service and definition |
| D4 | "Customers who used it 0" with 12 uses | Discount detail | Distinct customers from orders with the code |
| D5 | Funnel step 2 bigger than step 1 | Traffic | People/sessions per step |
| D6 | SEO scores fixed (posts 75, categories 50, tags 0, authors 40) | Content | Computed per item with the shared checks |
| D7 | "Writes about", "Last post", "Used most in" empty | Authors, Tags | From posts |
| D8 | Customer column "—" on every payment | Payments | Join order → customer |
| D9 | City "—" on every customer | Customers | From the default address |
| D10 | Product editor dirty on load; Discard zeroes Profit/Margin | Product editor | Normalised deep compare; recompute |
| D11 | Store "In setup" with 182 orders; health 93 with setup 4/11 | SA Stores, Store detail | Status from go-live; health includes setup + payments |
| D12 | Discount subtitle "since 27 Oct" vs "26 Mar – 15 May" | Discount detail | One date source |
| D13 | "Orders this month 0" with 900 orders | Orders summary | Check the date filter and timezone |
| D14 | Inbox profile "Last ordered —" | Inbox | Date or "No orders yet" |
| D15 | Attention engine says nothing needs attention | SA Home | Rules in §6.1 |
| D16 | Plan name differs across Overview / Billing / chips | SA Store | One plan record |
| D17 | Customer filter shows product labels | Customers | Customer fields |

Write a short test for each (unit or e2e) so they don't come back.

---

## 8. Phone: make it feel like an app

Test in Chrome DevTools at **390×844 and 360×800**, and on a real phone. The v2 §10 rules still apply; these are the gaps found.

1. **Scroll reset** (G9) on every route.
2. **Header stack is too tall** (about 200px before content).
   - Only the 56px top bar is sticky (`position: sticky`, with a white 92% background + 1px bottom border on scroll).
   - Admin banner: one 32px line.
   - Page title row isn't sticky.
   - **No back button on top-level pages** (`P01`).
3. **AI bar on phones:** no ⌘J. Hidden on chat, editors and the AI view (`P03`). Lift it above the iOS home indicator (`bottom: calc(16px + env(safe-area-inset-bottom))`).
4. **Order cards** (`P01`): remove the 44px ⋯ circle; tap opens; long-press or swipe left for actions. Fix "Cancelled + Awaiting payment" (D2).
5. **Bottom sheets for previews and pop-ups** (`P02`):
   - grab handle;
   - 44px close in the title row on the right;
   - prev/next in the title row;
   - drag down to close, with the `soft` spring and a velocity threshold;
   - the sticky primary button stays.
6. **Analytics:** the date picker shows under the title (full width). "Fix ›" stays on the warning line (`P04`). The map is centred, max height 280px.
7. **Home:** auto-height TO DO card; the chips row scrolls with a fade; the chart empty state.
8. **Touch:**
   - Every target is at least 44×44.
   - Inputs are 16px (no iOS zoom).
   - `touch-action: manipulation` on buttons (no 300ms delay).
   - `-webkit-tap-highlight-color: transparent` + our own pressed state (scale .98).
9. **App feel:**
   - `overscroll-behavior: contain` on scroll areas (no page bounce behind sheets).
   - `100dvh` for full-height screens.
   - Safe-area padding on the top bar and bottom sheets.
   - Add a web app manifest (name "Zcom", ink theme colour, icons) and `apple-mobile-web-app-capable`, so the admin can be added to the home screen and opens without browser chrome.
10. **Performance on phones:** stop the drifting lights in panels under 768px; lazy-load charts and images below the fold.

---

## 9. Code quality, performance and QA

### Performance budgets (merchant, mid-range Android, 4G)
- First page of any list: **< 800ms** from click to rows (now Products takes ~5s).
- Route JS **< 170 KB gz** per page. Code-split each page; charts and the editor load on demand.
- **No layout shift** (CLS < 0.02): skeletons match the final layout, images have width/height, fonts use `font-display: swap` with metric overrides.
- Interaction to next paint **< 150ms** on table filter/sort/tab switch.

### How to get there
- **Data fetching:** React Query/SWR with `staleTime` 30–60s, prefetch on hover (§2), and server-side pagination + field selection on list endpoints.
- **Long lists:** virtualise the Inbox list, Notifications and the Choose media grid when over 100 items.
- **Rendering:** memoise table rows; no inline object/array props in row components; derive data with `useMemo`.
- **Images:** responsive `srcset` and `loading="lazy"`; thumbnails at 2× their CSS size only.
- **Tokens and code:**
  - All colours, radii, shadows, durations and z-index come from tokens.
  - Remove dead styles (old button and dialog variants) after migrating.
  - Run the "one-off value" check: grep for hex colours and `px` radii outside the tokens file. Report the count before/after.

### QA checklist (attach the results to each phase report)
- [ ] 1440, 1710, 1280, 1024, 768, 390, 360 widths: no horizontal scroll; right edges line up (G8).
- [ ] Every route opens at the top (G9).
- [ ] Only the 7 button variants × 2 sizes (G10 script output attached).
- [ ] Only the 4 pop-up sizes (dialog audit list attached).
- [ ] No square hover on a rounded card (G5): checked on the pages listed there.
- [ ] Every drawer has the same header with a working close (G6).
- [ ] Toasts never sit under the AI bar.
- [ ] Every data bug D1–D17 has a test, and the test passes.
- [ ] Money/date formats per G13 (spot-check 10 pages).
- [ ] `prefers-reduced-motion` on: no looping animation.
- [ ] Keyboard: Tab order, visible focus ring (2px `#1F5EFF` at 2px offset), Esc closes the top layer only.
- [ ] Contrast AA on every text over gradients (Marketing cards, hero, AI cards).
- [ ] Phone: §8 items 1–10.
- [ ] Before/after screenshots for every annotated screenshot in `screenshots/`, same names with `-after`.

---

## 10. Build phases

Do them in this order, one after another, without waiting for review between phases. One PR (or commit series) per phase, with a short note in `docs/review-r2/progress.md`. When all phases are done, send Mehak one final report.

| Phase | Scope | Done when |
|---|---|---|
| **R2-0 · Audit** | List every button style, dialog width, list container, drawer, date input and `max-w-content` use; map each to G4/G5/G6/G10/G17. Reproduce D1–D17. **No UI changes.** | Audit table + failing tests for D1–D17 |
| **R2-1 · Data** | Fix D1–D17, the metrics service, the attention engine rules, ready-made customer groups, SEO computation | All D-tests pass; numbers match across pages |
| **R2-2 · Foundations** | Motion tokens + springs (§2), depth levels (G16), `<Button>` (G10), `<Dialog>` sizes (G4), list/table radius + hover (G5), `<Drawer>` header (G6), toasts (G7), `<DateRangePicker>` (G17), width (G8), scroll reset (G9), formats (G13), tab titles (G14) | QA items for G1–G18 pass |
| **R2-3 · Shell** | Search (G1), Notifications (G2), AI bar + chat box (G3), menu store block + counts (G11), back buttons → breadcrumbs (G12), SA menu items | Video of search, notifications and AI box |
| **R2-4 · Inbox, Orders, Payments, messaging** | 5.2–5.5 and 5.16 (WhatsApp and SMS sending) | Board-by-board screenshots |
| **R2-5 · Catalogue and Customers** | 5.6–5.7 | Same |
| **R2-6 · Marketing and Content** | 5.8–5.10 | Same |
| **R2-7 · Analytics and Insights** | 5.11–5.12 | Same; each insights tab under 2 screens |
| **R2-8 · Help, Apps, Settings** | 5.13–5.15 (incl. My tickets + SA Support) | Same |
| **R2-9 · Super Admin** | §6 | Same |
| **R2-10 · Phone + polish** | §8, motion review, performance budgets, full QA list | QA list fully ticked; video at 390px |

---

## 11. Prompts for Claude Code

**Kickoff** (paste once, at the start of the round):
```
You are implementing round 2 of the Zcom dashboard redesign.
Read docs/review-r2/ROUND-2-FIXES.md fully, then docs/design-v2/README.md (the v2 guide).
ROUND-2-FIXES.md wins where they differ (marked CHANGED).
Look at every image in docs/review-r2/screenshots/: red numbered boxes are problems, the list under each image explains them; "-vs-design" images show the live page next to the target board.
Rules: keep every capability; shared components and tokens only; transform/opacity animations only, using the motion tokens in §2; no new colours; no page may scroll horizontally.
Work through all phases in §10 in order (R2-0 to R2-10) without stopping for review between them.
For each phase: work through every item in its sections, in order; check each against its "Accept" line; take before/after screenshots at 1440px and 390px (Playwright), saved as docs/review-r2/after/<screenshot-name>-after.png; run the QA items (§9) that apply; commit; and add a short note to docs/review-r2/progress.md (what changed, decisions the file doesn't cover, anything blocked and why).
R2-0 is an audit only (no UI changes). R2-1 fixes the data bugs D1–D17 before any styling.
If something is blocked (for example a WhatsApp/SMS account step Zerror must do), note it in progress.md, use sandbox/test numbers, and keep going.
When every phase is done, write docs/review-r2/FINAL-REPORT.md: a summary per phase, the QA checklist with results, before/after screenshots, open questions.
```

**Resume** (if a session ends or the context fills up):
```
Resume round 2 of the Zcom redesign. Read docs/review-r2/ROUND-2-FIXES.md and docs/review-r2/progress.md, check the latest commits, and continue from the next unfinished item. Same rules as the kickoff; don't redo finished work.
```

**For a page not covered here:**
```
This page isn't covered in ROUND-2-FIXES.md. Apply the global fixes G1–G18 and the v2 recipes (README §10A) to it: nearest designed board for structure, shared components only, motion tokens from §2. List the decisions you made in progress.md.
```

**Line to add to `CLAUDE.md`:**
```
Zcom UI work follows docs/review-r2/ROUND-2-FIXES.md (wins) and docs/design-v2/README.md. One Button, one Dialog (sm/md/lg/full), one Drawer, one DateRangePicker; motion tokens only; fix data bugs before styling; never drop a capability.
```

---

## 12. Decisions (confirmed by Mehak, 6 Nov 2026)

| Question | Decision |
|---|---|
| Inbox "Send via" | WhatsApp · Email · SMS in the composer, sending in-app through connected services (§5.16) |
| WhatsApp and SMS services | Connect both this round (§5.16) and use them across Inbox, orders, abandoned carts, automations and campaigns |
| Ready-made customer groups | VIP ₹15,000+ spent in 12 months, Loyal 3+ orders, New first order in 30 days, Slipping away no order in 90 days; editable per store |
| Business insights tabs | Overview · Sales & profit · Customers · Products & stock · Where sales come from · Marketing return |
| Notifications size | `md` 640, same as search |
| AI chat box size | 420 × 560 |
| Review flow | Ayush runs all phases, then shares one final report; Mehak reviews manually, then asks Claude to review |
