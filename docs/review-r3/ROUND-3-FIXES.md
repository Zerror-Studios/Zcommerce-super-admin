# Zcom dashboards · Round 3: smoothness, motion and final polish

**For:** Ayush (and Claude Code)
**From:** Mehak, Zerror Studios
**Reviewed:** 9 Nov 2026, live builds:
- Super Admin: `platform.zerrorstudios.com`
- Merchant Admin: Kesar & Kin and Nahara, opened from Super Admin

**Goes with:** the round 2 file (`docs/review-r2/ROUND-2-FIXES.md`) and the v2 guide. Their rules still apply. This file wins where it differs; those places are marked **CHANGED**.

**Why this round matters:** round 2 landed well and the dashboards look great. This round is about how it **feels**: no flicker, no jumps, smooth tab switches, and charts that animate in. It also fixes the remaining small details and data mismatches. Next come the investor demo and moving every existing client store onto Zcom, so everything here must be solid.

**Screenshots:** `screenshots/`. Red numbered boxes are problems; the numbers match the list under each image. Sequence images (A1, B2, C1, D1, D2, D3) show the same moment frame by frame.

---

## 0. How to use this file

1. **Put the folder in the repo.** Unzip into the repo as `docs/review-r3/`. Keep `docs/review-r2/` and `docs/design-v2/` next to it.
2. **Start Claude Code with the Kickoff prompt** in §10. It runs all phases (§9) in order without stopping, logs each phase in `docs/review-r3/progress.md`, and writes `FINAL-REPORT.md` at the end.
3. **Fix by hand** whatever Claude can't get right, then share the final report with Mehak.
4. **Record proof.** For anything about smoothness (A, B, C, D), record a short screen capture (60 fps, Chrome) before and after. Screenshots can't show a flicker.

---

## 1. The 10 things that matter most

| # | What | Section | Pri |
|---|---|---|---|
| 1 | Super Admin → store opens on a grey splash for 2–3 s, then the page pops in (request waterfall). Replace with a fast, AI-style 3-step opening | A | P0 |
| 2 | Analytics › Traffic (and any page with a segmented control) jumps to the middle after loading: `scrollIntoView` bug | D1 | P0 |
| 3 | Orders tabs: **remove the blue loading line**; old rows stay under the new tab, columns change width, every switch refetches. Thumbnails slow down tables | C | P0 |
| 4 | Charts, bars, dots, rings and sparklines don't animate; loading shows "No sales in this period" | D2 | P1 |
| 5 | Zcom AI: first open isn't smooth, no hover feel, untidy upgrade state, two quota styles. Add the flowing bottom glow and thinking steps | B | P1 |
| 6 | Layout jumps after load (Marketing banner, Products stock column, AI quota row) | D3 | P1 |
| 7 | Same numbers differ across pages (30-day sales ₹12,10,405 / ₹12,30,930 / ₹15,42,156; "221" vs 113 orders) | E | P0 |
| 8 | Test data visible (Kit Test customers, MCP TEST product) | E | P0 (before demo) |
| 9 | Toasts cover the AI bar | F | P1 |
| 10 | Small polish: rings at 0, banner stacking, truncated text, chips wrapping, overlapping ring numbers | F | P2 |

---

## A. Super Admin → store admin: open smoothly · P0 · `A1-sa-to-store-sequence.jpg`, `A2-sa-toast.jpg`

**What happens now:**
- Clicking "Open store admin ↗" opens a new tab with a full-screen grey "Opening Kesar & Kin" splash for about 2–3 seconds. Then the whole dashboard appears in one jump.
- Measured on load:
  - The first GraphQL call takes ~1.2 s.
  - A second call only starts after it finishes (~0.8 s).
  - Then 13 more calls fire in two waves, at 2.1 s and 2.4 s.
  - Each GraphQL call takes 600–800 ms.

**Build:**
1. **Rename the button "Log in to store ↗".** Keep opening it in a new tab, so Super Admin stays open. Same button in the Stores table row ⋯ menu.
2. **Prefetch on intent.**
   - On hover or focus of the button (and on the store row), call a `PrepareStoreSession(storeId)` mutation.
   - It returns a short-lived signed handoff token (60 s, single use) and warms the store's caches.
   - The click opens `store…/admin/home?handoff=<token>`. Never put the token in logs or analytics.
3. **Replace the grey splash with a smart "AI-style" opening** (Mehak: it should feel like an AI thinking, three steps one by one, simple and professional).
   - **Layout:** a centred card, 360px wide, white, radius 22, the floating shadow, on the page background. The Zcom orb (32px, slowly spinning) and the store name sit on top. **Three steps** sit under them, each one line:
     1. "Signing you in to Kesar & Kin"
     2. "Bringing in orders, products and today's numbers"
     3. "Setting up your dashboard"
   - **Each step's states:**
     - Waiting: grey dot, text `#8A8F9A`.
     - Working: a small spinning ring, text ink, a soft shimmer sweeping across the text once.
     - Done: a green tick that draws in over 200 ms, text `#5F646E`.
   - **The steps follow real progress, not a timer:**
     - Step 1 is done when `AdminBootstrap` returns.
     - Step 2 is done when `HomeSummary` returns.
     - Step 3 is done when the first paint of Home is ready.
     - **Timing (Mehak):** the opening is a short, calm moment, so you see that you've moved from Super Admin into the store. It always shows for **at least 1.2 s and normally no more than 2 s**:
       - Each step is visible for at least 400 ms.
       - If the data is ready sooner, the steps still tick at that calm pace.
       - If loading takes longer than 2 s, the last step keeps working until it's really ready.
   - **Handover:** when step 3 ticks, the card scales to 0.98 and fades out (180 ms) while the dashboard fades in behind it (240 ms). Nothing jumps; the menu and banner are already in place under the card.
   - **Never skipped:** the card always plays, even when the data is cached, so the move from Super Admin to the store always feels the same.
   - **Errors:** if a step fails, it shows a red × with one plain sentence ("Couldn't load orders") and a **Try again** button. Never a blank page.
   - **Shell first:** behind the card, the store app renders its shell immediately (menu, admin banner, store name, initials and domain) from the handoff token payload, not from an API call. Page skeletons match the final layout.
   - **Reuse it:** the same `<AiSteps>` component is used for the AI box "thinking" state (B6) and long jobs (imports, exports). Code is in §12.
4. **One bootstrap call, not a waterfall.** Replace the first two sequential calls with one `AdminBootstrap` query: session, user, role, store, plan, feature flags, menu counts, AI usage.
5. **Home in one round trip.**
   - Fetch the Home cards in **one** query, or two at most: `HomeSummary` (hero, KPIs, where orders are, needs attention, top products).
   - Fire it in parallel with `AdminBootstrap`, not after it.
6. **Server speed.** 600–800 ms per GraphQL call is too slow. Target **< 150 ms p50, < 300 ms p95** for list and summary queries:
   - Run the API in the same region as the database.
   - Add indexes for every filter you use (store_id + status + created_at for orders).
   - Remove N+1 lookups: use DataLoader or joins.
   - Cache summary queries per store for 30–60 s (Redis).
   - Use persisted queries and HTTP compression.
7. **Fade, don't pop.** When data arrives, each card's content fades in over 160 ms (opacity only). Nothing moves after first paint.
8. **Toast:** "Opened Kesar & Kin as owner@…" must sit above the AI bar and show in full (G7 from round 2).

**Accept:**
- From click to a fully painted Home is **under 1.2 s** on office Wi-Fi.
- There is **no blank or grey frame**.
- Layout shift (CLS) stays under 0.02.
- Before/after screen recordings are attached.

---

## B. Zcom AI: hover, first open, upgrade state · P1 · `B1`–`B4`

### B1 · Hover: give it an "AI" feel
**Now:** hovering the bar changes nothing, and it blends into the page.

**Build** (all `transform`/`opacity` or GPU-cheap properties):
- **Border:** a 1.5px animated gradient border fades in over 180 ms. Use the brand AI gradient `#5B8CFF → #9D7BFF → #FF8FB8 → #FFBE73`, rotating slowly (conic gradient, 6 s loop). Build it with a masked pseudo-element.
- **Glow and orb:** a soft outer glow `0 10px 40px -10px rgba(91,140,255,.45)`. The orb spins 2× faster and brightens.
- **Placeholder:** darkens from `#8A8F9A` to `#5F646E`.
- **Page behind on hover (Mehak: 5–10%, subtle):** a fixed overlay over the content area fades to `rgba(11,12,16,.08)` in 200 ms. No blur on hover.
- **More hover detail:**
  - The bar lifts 2px with the `snappy` spring.
  - The placeholder text gets a one-time shimmer sweep, left to right, 700 ms.
  - The orb gives one soft pulse.
- **When the box is open:** the overlay goes to `rgba(11,12,16,.14)` + `backdrop-filter: blur(3px)`. The menu stays sharp. On devices that report `prefers-reduced-transparency` or low memory, skip the blur.
- **Off:** the blur is applied only while the box is open, never on scroll.

### B2 · First open must be as smooth as the second
**Now:** on the first click the bar disappears for a moment, then the box appears without growing from the bar. Later, the quota row ("2,000 of 2,000 questions left", 1.45 s request) arrives and pushes everything down. The second open is smooth because it's cached.

**Build:**
- **Preload the code:** load the AI box chunk right after first paint (`requestIdleCallback`) and again on hover. It's a `import()` prefetch, not on click.
- **Preload the data:** get the AI usage in `AdminBootstrap` (section A) and cache it for 5 minutes.
- **One element:** the bar **never unmounts**. It morphs into the box with a shared-layout (FLIP) animation, `layout` spring from round 2 §2, radius 26 → 22. The content fades in 60 ms after.
- **Quota row:** has a fixed height. While its number is unknown, show a thin skeleton line in the same spot.

**Accept:** on a hard refresh, the first open looks identical to the fifth open in a 60 fps recording.

### B3 · Locked state (Starter plan) · `B3-ai-upgrade.jpg`
**Now:** "Ask Zcom is available on Standard and above." sits on one line and "Upgrade plan" on the next. The suggestions look clickable but are grey, and the input looks active.

**Build:**
- **One row, 48px tall, same style as the quota row:** lock icon tile + "Zcom AI comes with Standard and above" on the left, **Upgrade plan** (primary, sm) on the right, vertically centred.
- **Body:** replace the greyed suggestions with "What you'd get". Show 3 short example answers in a soft card (for example, "Sales this week: ₹48,200, up 12%. Your best day was Saturday.").
- **Input:** hide it.
- **The bar itself:** on a locked store, hover shows a small "Standard" chip on the right of the bar.

### B4 · One quota component · `B4-ai-quota-sa.jpg`
**Now:** Super Admin says "AI budget: 11% of this month's 30L tokens used"; merchants see "2,000 of 2,000 questions left this week".

**Build:**
- One `<AiQuota>` component: label left, reset date right, a 3px bar under it.
- **Merchant:** "1,962 of 2,000 questions left · resets Mon".
- **Super Admin:** "11% of this month's AI budget used · resets 1 Dec".
- Never "30L"; write numbers in full Indian grouping.

---

### B5 · The AI glow at the bottom of the screen (when the AI is open)
Mehak wants talking to Zcom AI to feel alive, like Apple's Siri. Think of the glowing edge some AI tools show round the screen while they work. Here it is **only along the bottom edge**, in our blue AI colours, clearly visible and beautifully designed, while the AI box or the large view is open.

**Look (two layers):**
1. **Edge light:** a 3px line hugging the very bottom of the viewport, full width. It has a bright, iridescent gradient (blue `#5B8CFF` → cyan `#7FD3FF` → violet `#9D7BFF` → pink `#FF8FB8` → blue) that **flows sideways** continuously, like Siri's edge. Add a 1px white highlight on top at 40% opacity so it reads as light, not a coloured bar.
2. **Glow above it:**
   - A band about 180px tall made of 4 blurred colour blobs in the same colours, mostly blue.
   - `filter: blur(44px)`, opacity 0.7 at the edge, fading to transparent upwards.
   - It sits behind the AI box and above the dimmed page.
   - It should be **clearly visible, not faint**; you should notice it the moment the AI opens.

**Motion:**
- **Open:** the edge light draws outward from the centre to both corners (360 ms), then the glow rises from below (400 ms, `soft` spring).
- **Flow:** the blobs drift sideways and breathe (scale 0.95 ↔ 1.1), each on its own 6–10 s loop, so the light flows like a flame and never repeats visibly. The edge gradient moves sideways at its own speed.
- **States:**

  | State | Glow |
  |---|---|
  | Open, idle | Edge 0.8, glow 0.55, slow flow |
  | User typing | Glow brightens under the input (0.7), as if listening |
  | Thinking | Edge 1.0, glow 0.85; flow 2× faster; a bright pulse travels left → right along the edge every 1.4 s, Siri-like |
  | Answering (streaming) | Edge 0.9, glow 0.65, steady flow |
  | Closed | Glow sinks (300 ms), the edge line shrinks back to the centre, then unmounts |

**Rules:**
- Pure CSS (transforms and opacity on blurred divs, `will-change: transform`), one fixed layer, no canvas.
- Pause when the tab is hidden.
- `prefers-reduced-motion`: a static glow at 0.4 opacity.
- Code in §12.

### B6 · "Thinking" shows its steps
While the AI works on an answer, show the same `<AiSteps>` component as the store opening (A3), inside the chat, in place of a spinner. Two or three short steps that match what it's really doing, ticking one by one:
- "Reading your orders"
- "Checking stock levels"
- "Writing the answer"

When the answer starts streaming, the steps collapse into one grey line ("Checked orders and stock · 1.8 s") that can be expanded.

---

## C. Tables and tab switching · P0 · `C1-orders-tab-switch.jpg`, `C2-blue-line.jpg`

**Now (Orders):**
- Clicking a tab shows a 2px blue loading line at the top of the table card, while the **previous tab's rows stay visible** (the "Not paid" tab showed Delivered and Paid rows).
- Then the rows swap in one jump.
- Columns change width from tab to tab (`table-layout: auto`). Measured: Payment 170px → 123px, Delivery 170px → 245px, Total 120px → 104px.
- Every switch refetches (650–720 ms), even back to a tab you just saw.

**Build** in the shared `<DataTable>`, so every tabbed table gets it: Orders, Payments, Products, Inventory, Customers, Campaigns, Discounts, Blogs, Tags, Authors, and Super Admin Stores, Billing and Support.
1. **Remove the blue loading line** everywhere.
2. **Fixed columns.**
   - `table-layout: fixed` with a `<colgroup>` defined per table, **the same for every tab** of that table.
   - A column that doesn't apply on a tab shows "—"; it doesn't disappear or resize.
   - **Abandoned** keeps its own columns but the same frame: checkbox width, first-column width, row height 64px, actions column width.
   - Identifier column flexible; numbers fixed and right-aligned with `font-variant-numeric: tabular-nums`.
3. **Cache per tab.**
   - React Query/SWR key = `[table, tab, filters, sort, page]`, `staleTime` 60 s, `keepPreviousData` **only within the same tab** (paging, sorting). Never show another tab's rows.
   - Prefetch the first page of each tab after the page is idle, and on tab hover.
   - Going back to a seen tab is instant.
4. **Switch motion:**
   - The active pill slides (round 2 §2).
   - When the new tab's data is cached, rows cross-fade in 120 ms.
   - When it isn't, show **skeleton rows** that match the row layout (thumbnail, two-line text, chips). Not empty rows, and not the old rows.
   - The table body keeps its height until the new rows render, so the page doesn't jump.
5. **Counts:** tab counts come with the first query and update optimistically after actions.
6. **Progressive loading: text first, images never hold anything up.**
   - The row text, numbers and chips render as soon as the row data arrives.
   - Images (product thumbnails, order item images, collection covers, blog covers, avatars) load on their own. Each image box has a fixed size and shows a soft placeholder until the image arrives:
     - the product's dominant colour, or
     - a 16px blurred preview stored with the image.

     The image then fades in over 160 ms.
   - The same rule for every block on every page: each card shows its content the moment its own data arrives; one slow field shows "—" or a small skeleton and fills in with a fade; nothing waits for the slowest call.
7. **Optimise the thumbnails** (Products thumbnails are slow now):
   - **Create small copies on upload.** When a photo is uploaded, save small, light copies of it next to the original: 64, 128, 256 and 512px wide, WebP and AVIF, quality about 70, each a few KB. Use sharp, or the CDN's image service. Run a one-time backfill job that makes these copies for every image already uploaded. The full-size HD original is only loaded where the photo is shown big (product page, media preview, zoom).
   - **Never load the original photo in a table or grid.** Use `srcset`/`sizes`: a 40px table thumbnail loads the 128px file (for retina screens).
   - **Attributes:** `width`/`height` set, `decoding="async"`, `loading="lazy"` for everything below the first screen, `fetchpriority="high"` only for the first 6 visible rows.
   - **Caching:** serve from the CDN with long cache headers (`Cache-Control: public, max-age=31536000, immutable`, with content-hashed file names).
   - **Prefetch:** when hovering a tab or the next page button, prefetch that page's thumbnails.
   - **Where:** Products, Inventory, Orders items, Collections, Lookbooks, Choose media, Blog cards, Home top products, Analytics product tables.
   - **Accept:** on Products, the rows render in under 800 ms; each thumbnail is under 15 KB; no row moves when its image arrives.

**Accept:**
- In a 60 fps recording of clicking through all 7 Orders tabs twice: no blue line, no wrong rows, and column edges don't move.
- The second pass is instant.

---

## D. Scroll, charts and layout stability

### D1 · Pages must always start at the top · P0 · `D1-traffic-jump.jpg`
**Root cause found:** the shared segmented control (`zc-seg__item`) calls `element.scrollIntoView()` on its active item when it mounts. That scrolls every scrollable parent, including `<main>`. So Analytics › Traffic opens at the top and then jumps 2,810px down to the last segmented control ("Sessions by day: Day/Hour"). It can happen on any page with a segmented control below the fold.

**Fix:**
1. **In the segmented control:** never call `scrollIntoView`. To keep the active item visible in a horizontally scrolling control, set `container.scrollLeft` yourself:
   ```ts
   const c = containerRef.current, el = activeRef.current;
   if (c && el && c.scrollWidth > c.clientWidth) {
     c.scrollTo({ left: el.offsetLeft - (c.clientWidth - el.offsetWidth) / 2, behavior: "smooth" });
   }
   ```
2. **Search the codebase** for every other `scrollIntoView` and `focus()` that runs on mount, and give each `{ block: "nearest", inline: "nearest" }` or remove it. Use `focus({ preventScroll: true })`.
3. **Keep the round 2 rule:** `main.scrollTop = 0` on every route change **and** every in-page tab change (`?section=`, `?tab=`). Restore the position only on browser Back/Forward.
4. **Sticky sub-tabs:** analytics sub-tabs (Insights sections, Traffic tabs) stick under the title when scrolling (white with blur, 1px bottom border).

**Accept:** a Playwright test opens every route and every sub-tab after scrolling the previous page to the bottom, and asserts `main.scrollTop === 0` one second after data loads.

### D2 · Charts animate in · P1 · `D2-chart-loading.jpg`
**Now:**
- All charts appear fully drawn. Line charts, sparklines, bar lists, the dot grid on Home, "Where orders are" segments, rings and donuts never animate.
- While loading, the Insights chart shows the empty-state text "No sales in this period".

**CHANGED** (round 2 §2 said "charts draw once, numbers never count up"). Charts animate **on first view**, as below. KPI numbers get a short, subtle roll-in.

**Build one `useChartEntrance()` hook + CSS** so every chart type does this:

| Chart | Entrance (first time it is on screen) |
|---|---|
| Line / area (Net sales over time, Sessions, Sales over time) | Line draws left → right via `stroke-dashoffset`, 700 ms `--ease-out`; area fill fades in over the last 300 ms; the compare (dashed) line fades in 200 ms after |
| Sparklines (KPI cards) | Draw left → right, 500 ms, staggered 60 ms per card |
| Bars and bar lists (What changed, Sales by category, Best hours, funnel) | Grow from the baseline (`scaleY` or `scaleX` from 0, origin at the axis), `snappy` spring, stagger 25 ms, all done within 600 ms |
| Segmented progress (Where orders are, Products "sold" segments) | Segments fill one by one, 30 ms apart, 400 ms total |
| Dot grid (Home sales dots) | Dots fade + scale 0.6 → 1 in a wave column by column, 6 ms per column, all done within 600 ms |
| Rings and donuts (health, Running low, devices, new vs returning) | Stroke grows from 0 to the value, 700 ms `--ease-out`; the centre number fades in at 60% |
| Heatmaps (cohort table) | Cells fade in row by row, 20 ms apart |
| Maps (India map bubbles) | Bubbles scale 0 → 1 from the largest to the smallest, `snappy`, 40 ms stagger |
| KPI numbers | Digits roll up from 8px below with a fade, 400 ms, once. No counting up through every value |

**Rules:**
- **When it plays:**
  - Animate when the chart first enters the viewport (IntersectionObserver, threshold 0.3), **once per page visit**.
  - Charts in a newly opened tab animate when that tab first shows.
- **Data changes:** when data changes (date range, Sales/Orders toggle), **morph** from the old values to the new ones (tween 400 ms). Don't redraw from zero.
- **No replay** on refetch, on window focus or when coming back to a cached tab during the same visit.
- **Loading:** show a chart skeleton (axes, gridlines, soft shimmer block). **Never** the empty-state text while loading. The empty state only shows when the query returned and there really is no data.
- **Reduced motion:** with `prefers-reduced-motion`, show the final chart with a 120 ms fade only.
- **Performance:** animate with CSS transforms/opacity or SVG `stroke-dashoffset`, no per-frame React state. Keep total work per chart under 4 ms per frame.

**Make the charts feel fresh and "talk" to the user** (Mehak: not a boring dashboard; it should feel like an AI dashboard that communicates):
- **The chart speaks after it draws.** Once a chart finishes its entrance, 1–2 small labels fade in on the chart itself, written in plain words. For example:
  - "Best day · 22 Oct · ₹1,68,185" on the peak.
  - "No orders since 25 Oct" over a flat end.
  - "+41% · fastest growing" on a bar.

  Labels are white pills with a 1px line pointing to the point, 12px text, and the orb icon when the insight comes from Zcom AI.
- **Live end point:** the latest point on line charts has a small dot with a soft pulse ring (2.4 s loop, subtle). When the range doesn't end today, no pulse.
- **Brand colour:**
  - Lines use `#1F5EFF`, with an area fill gradient from `rgba(31,94,255,.18)` down to transparent.
  - The compare line is grey and dashed.
  - The AI gradient is used **only** for AI-written insights and labels, never for data.
- **Tooltips only where they're needed; everywhere else, a hover animation.** Mehak: no tooltips everywhere.

  | Use a tooltip | Use a hover animation instead (no tooltip) |
  |---|---|
  | Line charts with many points (daily sales, sessions), where the exact value of a day isn't printed | Bar lists and "What changed" bars: the hovered bar lifts and brightens, the others dim to 40%, and its value label slides in at the end of the bar |
  | Cohort heatmap cells and map bubbles (exact numbers aren't printed) | KPI cards and sparklines: the card lifts 2px and the sparkline redraws its last segment with a glow |
  | ⓘ icons (definitions), icon-only buttons and truncated text | Rings and donuts: the hovered segment grows 2px thicker and the centre number switches to that segment's value |
  | | Segmented bars (Where orders are) and dot grids: the hovered group brightens and the others dim |
  | | Rows and cards: background change and lift only |

  - **Tooltip behaviour, where one is used:** it follows the cursor with the `snappy` spring; a vertical guide line snaps to the nearest day; other series dim to 40%; it shows the value, the compare value and the change in words ("₹12,400 more than the same day before").
  - **Never** show a tooltip that repeats text already visible on the screen.
- **Empty and low-data states talk too:** "Not enough data yet: this fills in after 7 days of sales", with a soft illustration of the chart shape, never a blank box.
- **Consistency:** one chart theme file (colours, fonts, gridlines `#EEF0F3`, axis text 11px Geist Mono `#8A8F9A`, radius on bars 4px) used by every chart in both dashboards.

**Also fix:**
- "Last 30 days" shows "6 Oct – 4 Nov" on 9 Nov and "Updated 8 hours ago". The range must end today, and data must be fresh (see E).

### D3 · No layout jumps after load · P1 · `D3-marketing-shift.jpg`, `E5-products.jpg`, `B2`
- **Marketing:** the AI banner is inserted after load and pushes the page down ~70px. Reserve its height in the skeleton, or fade it in over space already reserved. If there's no suggestion, collapse the space with a 240 ms height animation (`grid-template-rows`), never an instant jump.
- **Skeletons must match the loaded layout.** Marketing channel cards load with one grey bar but show three stat tiles. Products' Stock column stays as grey bars for several seconds after the row has loaded.
  - Load everything a row shows in the row query.
  - If one field is slow, show "—" and fill it in with a fade.
- **Rule for every page:** measure CLS on first load with the Performance panel or a web-vitals log. Target **CLS < 0.02** on Home, Orders, Products, Customers, Marketing, Insights, Traffic and Super Admin Home/Store.

---

## E. Data must match · P0

| # | Problem | Where | Expected |
|---|---|---|---|
| E1 | 30-day sales: Super Admin ₹12,10,405 · Home ₹12,30,930 · Insights ₹15,42,156 | Home, Insights, SA Stores/Store | One metrics service, one definition (round 2 D3 not done yet) |
| E2 | "Where orders are" shows 221 but 72 + 41 + 0 = 113 | Home | The total is the sum of the rows shown, or label what 221 is |
| E3 | Insights range ends 4 Nov on 9 Nov; "Updated 8 hours ago" | Analytics | Range ends today; refresh at least hourly |
| E4 | Customers: "New 290" tab vs "New this month 7"; VIP 151 of 307 | Customers | Check the ready-made group rules (VIP = ₹15,000+ in 12 months) |
| E5 | Super Admin AI card: headline says deveshe-dreams, text says Kesar & Kin | SA Home | Both from the same store |
| E6 | Nahara shows a red "Payment for invoice is overdue · Pay now" while Super Admin says No fee and Past due 0 | Store banner | Banner from the same billing record |
| E7 | Test data: "Kit Test" customers (kit-test+…, kit-cookie+…), "MCP TEST Saffron Kurta", "MCP TEST Folder" | Kesar & Kin | Hidden from every list and count (`is_test` flag), or deleted, before the demo |
| E8 | Marketing banner says "Wedding season is on Sunday"; the date card says "MID NOV – FEB" | Marketing | Same date wording |

Write a test for each, like round 2.

---

## F. Consistency and polish · P2 · `E1`–`E7`

1. **Toasts** sit above the AI bar everywhere (Super Admin and stores), 2 lines max, never truncated.
2. **Banners:**
   - When the admin banner and another banner (overdue payment, setup) both apply, merge them into **one 40px bar**: admin text left, alert in the middle, actions right.
   - Never stack two full-width bars.
3. **Rings at 0:** no empty white rings. At 0, show a full ring in the right colour: green for "All stocked" / "No failures", grey for "No data".
   - Where seen: Products Running low, SA Checkout failures, SA Billing Paid.
4. **Store health ring** (SA › store): two numbers are drawn on top of each other ("33" and "39%"). One number, centred, tabular.
5. **Truncated text:**
   - SA Home summary sub-lines ("…collected this mo…", "…4 stores cri…").
   - The SA Stores plan chip "Kesar & Kin Sample Store".
   - Shorten the copy, or allow 2 lines; no ellipsis on key info.
6. **Inbox type chips** wrap onto three rows: keep one row that scrolls sideways with an edge fade.
7. **Hero buttons on dark gradients:** "Announce" is a faint ghost button. Use the glass style (white 14% fill, 1px white 24% border, white text) consistently for every secondary button on a gradient.
8. **SA Home action cards:** the three cards share one height and one structure: eyebrow, headline, one sentence, buttons pinned to the bottom. The Billing card is mostly empty now.
9. **Customers summary:** "All customers 307" needs a sub-line like the other three ("+7 this month").
10. **Insights sub-tabs** sticky (D1.4).
11. **Order rows:** remove the small document icon next to the order number unless it means something; if it does, give it a tooltip.
12. **Run the round 2 button and dialog audit scripts again** and attach the output. Only the 7 button variants × 2 sizes and the 4 dialog sizes may remain.

---

## G. Before the demo and the client migration

- [ ] Test data hidden (E7).
- [ ] Every number on Home, Insights and Super Admin agrees (E1–E6).
- [ ] "Log in to store" opens a new tab with the 3-step opening, in under 1.2 s, with no flicker (A).
- [ ] Every page and tab opens at the top (D1).
- [ ] Every chart animates once; nothing jumps after load (D2, D3).
- [ ] Orders tabs switch instantly with fixed columns and no blue line; thumbnails never hold up a table (C).
- [ ] AI bar has its hover; the box opens smoothly the first time with the bottom glow and thinking steps; the locked state is tidy (B).
- [ ] Lighthouse on Home and Orders (desktop): Performance ≥ 90, CLS < 0.02, no console errors.
- [ ] Tested on Chrome and Safari, desktop and phone (390px).

---

## 9. Phases (run them one after another, no stopping)

| Phase | Scope | Done when |
|---|---|---|
| **R3-1 · Data and test data** | E1–E8 | Tests pass; numbers match on every page |
| **R3-2 · Fast open** | A (handoff, bootstrap, one Home query, server speed, AI-style 3-step opening) | Under 1.2 s, steps tick with real progress; recording attached |
| **R3-3 · Scroll and stability** | D1, D3 (scrollIntoView fix, scroll reset, sticky tabs, CLS) | Playwright scroll test passes; CLS < 0.02 |
| **R3-4 · Tables, tabs and images** | C (incl. no blue line, thumbnails, progressive loading) | Recording of Orders and Products tabs ×2; thumbnail sizes listed |
| **R3-5 · Charts** | D2 | Recording of Home, Insights (all tabs), Traffic, Sales |
| **R3-6 · Zcom AI** | B1–B6 (hover, first open, locked state, quota, bottom glow, thinking steps) | First-open recording with the glow; locked state screenshot |
| **R3-7 · Polish and QA** | F, G, round 2 QA list | Checklists ticked; FINAL-REPORT.md |

---

## 10. Prompts for Claude Code

**Kickoff:**
```
You are implementing round 3 of the Zcom dashboard redesign: smoothness, motion and final polish.
Read docs/review-r3/ROUND-3-FIXES.md fully, then skim docs/review-r2/ROUND-2-FIXES.md and docs/design-v2/README.md. Round 3 wins where they differ (marked CHANGED).
Look at every image in docs/review-r3/screenshots/: red numbered boxes are problems, the list under each image explains them; sequence images show one moment frame by frame.
Rules: keep every capability; shared components and tokens only; animate only transform, opacity and SVG stroke; respect prefers-reduced-motion; no layout shift after first paint.
Work through all phases in section 9 in order (R3-1 to R3-7) without stopping for review. For each phase: implement every item, check it against its Accept line, record before/after evidence (Playwright screenshots, plus a short screen recording for anything about smoothness), commit, and add a short note to docs/review-r3/progress.md.
If something is blocked, note it in progress.md and keep going.
When all phases are done, write docs/review-r3/FINAL-REPORT.md: summary per phase, checklists from sections G and 9 with results, evidence links, open questions.
```

**Resume** (if a session ends):
```
Resume round 3 of the Zcom redesign. Read docs/review-r3/ROUND-3-FIXES.md and docs/review-r3/progress.md, check the latest commits, and continue from the next unfinished item. Same rules as the kickoff; don't redo finished work.
```

---

## 11. Decisions (confirmed by Mehak, 9 Nov 2026)

| Question | Decision |
|---|---|
| "Log in to store" | Opens in a **new tab**, with the AI-style 3-step opening (A3) |
| Hover on the Ask Zcom AI bar | Subtle: dim the page 8% (5–10%), lift 2px, shimmer, orb pulse; no blur |
| Super Admin → store opening | Always plays: a calm 1.2–2 s, three steps; never skipped |
| Tooltips | Only where an exact number isn't printed, or for definitions and icon buttons; everywhere else a hover animation |
| Bottom AI glow | Siri-like: a flowing edge light along the bottom plus a clearly visible blue glow above it |
| AI box open | Dim 14% + 3px blur + the flowing bottom glow (B5) |
| KPI numbers | Short roll-in once (400 ms), no counting |
| Orders blue loading line | Removed everywhere |
| Locked AI on Starter | One row with Upgrade plan + "What you'd get" preview; input hidden |
| Deadline | Before the investor demo on **Wed 11 Nov** (Anand checks the data, payments, stores and Claude connector; the UI is Ayush's) |

---

## 12. Code to start from

These are starting points written to the rules above. Adapt them to the codebase (Tailwind tokens, existing motion helpers), but keep the behaviour.

### 12.1 `<AiSteps>`: the store opening (A3) and AI thinking (B6)
```tsx
import { motion, AnimatePresence } from "framer-motion";
export type StepState = "wait" | "work" | "done" | "error";
export type Step = { label: string; state: StepState; error?: string };

const spring = { type: "spring", stiffness: 520, damping: 38, mass: 0.9 };

export function AiSteps({ title, steps, onRetry }: { title?: string; steps: Step[]; onRetry?: () => void }) {
  return (
    <motion.div className="ai-steps" initial={{ opacity: 0, scale: 0.98, y: 6 }}
      animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98 }} transition={spring}>
      {title && <div className="ai-steps__head"><span className="zc-orb zc-orb--sm" aria-hidden />{title}</div>}
      <ol className="ai-steps__list" aria-live="polite">
        {steps.map((s, i) => (
          <motion.li key={s.label} className={`ai-step ai-step--${s.state}`}
            initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: i * 0.06 }}>
            <span className="ai-step__icon" aria-hidden>
              <AnimatePresence mode="wait" initial={false}>
                {s.state === "work" && <motion.span key="w" className="ai-step__ring" exit={{ opacity: 0 }} />}
                {s.state === "done" && (
                  <motion.svg key="d" viewBox="0 0 16 16" width="16" height="16">
                    <motion.path d="M3.5 8.5l3 3 6-7" fill="none" stroke="#16A34A" strokeWidth="2"
                      strokeLinecap="round" strokeLinejoin="round"
                      initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.2 }} />
                  </motion.svg>
                )}
                {s.state === "wait" && <motion.span key="g" className="ai-step__dot" />}
                {s.state === "error" && <motion.span key="e" className="ai-step__x">×</motion.span>}
              </AnimatePresence>
            </span>
            <span className={s.state === "work" ? "ai-step__text zc-shimmer-once" : "ai-step__text"}>
              {s.state === "error" ? s.error ?? s.label : s.label}
            </span>
          </motion.li>
        ))}
      </ol>
      {steps.some(s => s.state === "error") && onRetry && <button className="zc-btn zc-btn--secondary zc-btn--sm" onClick={onRetry}>Try again</button>}
    </motion.div>
  );
}

/* Keep each step visible ≥ 250 ms so the sequence never flashes */
export function useMinStepTime(real: StepState[], min = 250): StepState[] { /* queue state changes per step; apply each no sooner than `min` ms after the previous one */ return real; }
```
```css
.ai-steps{width:360px;padding:22px;border-radius:22px;background:#fff;box-shadow:0 30px 70px -24px rgba(11,12,16,.35)}
.ai-steps__head{display:flex;align-items:center;gap:10px;font-weight:600;margin-bottom:14px}
.ai-steps__list{display:grid;gap:10px;margin:0;padding:0;list-style:none}
.ai-step{display:flex;align-items:center;gap:10px;font-size:14px}
.ai-step--wait .ai-step__text{color:#8A8F9A}
.ai-step--work .ai-step__text{color:#0B0C10}
.ai-step--done .ai-step__text{color:#5F646E}
.ai-step--error .ai-step__text{color:#D92D20}
.ai-step__icon{width:16px;height:16px;display:grid;place-items:center}
.ai-step__dot{width:6px;height:6px;border-radius:50%;background:#C9CDD6}
.ai-step__ring{width:14px;height:14px;border-radius:50%;border:2px solid #DCE5FF;border-top-color:#1F5EFF;animation:zc-spin .8s linear infinite}
@keyframes zc-spin{to{transform:rotate(360deg)}}
.zc-shimmer-once{background:linear-gradient(90deg,#0B0C10 0%,#0B0C10 40%,#9DB8FF 50%,#0B0C10 60%,#0B0C10 100%);background-size:250% 100%;-webkit-background-clip:text;background-clip:text;color:transparent;animation:zc-shimmer .9s var(--ease-out) 1}
@keyframes zc-shimmer{from{background-position:100% 0}to{background-position:0 0}}
@media (prefers-reduced-motion:reduce){.ai-step__ring{animation:none}.zc-shimmer-once{animation:none;color:#0B0C10;background:none}}
```

### 12.2 Ask Zcom AI bar: hover (B1)
```css
.zc-aibar{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);width:min(560px,calc(100vw - 32px));height:52px;border-radius:26px;background:#fff;
  box-shadow:0 1px 0 rgba(255,255,255,.8) inset,0 8px 24px -8px rgba(11,12,16,.18),0 0 0 1px rgba(11,12,16,.06);
  transition:transform .24s var(--ease-out),box-shadow .2s var(--ease-out)}
.zc-aibar::before{content:"";position:absolute;inset:-1.5px;border-radius:inherit;padding:1.5px;
  background:conic-gradient(from var(--a,0deg),#5B8CFF,#9D7BFF,#FF8FB8,#FFBE73,#5B8CFF);
  -webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude;
  opacity:0;transition:opacity .18s var(--ease-out);animation:zc-rotate 6s linear infinite paused}
@property --a{syntax:"<angle>";inherits:false;initial-value:0deg}
@keyframes zc-rotate{to{--a:360deg}}
.zc-aibar:hover{transform:translateX(-50%) translateY(-2px);box-shadow:0 10px 40px -10px rgba(91,140,255,.45),0 0 0 1px rgba(11,12,16,.04)}
.zc-aibar:hover::before{opacity:1;animation-play-state:running}
.zc-aibar:hover .zc-aibar__ph{animation:zc-shimmer .7s var(--ease-out) 1}
.zc-ai-scrim{position:fixed;inset:0;left:var(--menu-w);pointer-events:none;background:rgba(11,12,16,0);transition:background .2s var(--ease-out),backdrop-filter .24s var(--ease-out);z-index:40}
.zc-ai-scrim[data-state="hover"]{background:rgba(11,12,16,.08)}
.zc-ai-scrim[data-state="open"]{background:rgba(11,12,16,.14);backdrop-filter:blur(3px);pointer-events:auto}
@media (prefers-reduced-transparency:reduce){.zc-ai-scrim[data-state="open"]{backdrop-filter:none}}
```

### 12.3 The flowing bottom glow (B5)
```tsx
export function AiGlow({ state }: { state: "idle" | "typing" | "thinking" | "answering" }) {
  return (
    <>
      <div className="zc-ai-glow" data-state={state} aria-hidden>
        <span className="b b1" /><span className="b b2" /><span className="b b3" /><span className="b b4" />
        <span className="wave" />
      </div>
      <div className="zc-ai-edge" data-state={state} aria-hidden />
    </>
  );
}
```
```css
.zc-ai-glow{position:fixed;left:0;right:0;bottom:0;height:180px;pointer-events:none;z-index:45;overflow:hidden;
  -webkit-mask:linear-gradient(to top,#000 25%,transparent);mask:linear-gradient(to top,#000 25%,transparent);
  opacity:.55;transition:opacity .4s var(--ease-out)}
.zc-ai-glow[data-state="typing"]{opacity:.7}
.zc-ai-glow[data-state="thinking"]{opacity:.85}
.zc-ai-glow[data-state="answering"]{opacity:.65}
/* edge light: Siri-like line along the very bottom */
.zc-ai-edge{position:fixed;left:0;right:0;bottom:0;height:3px;z-index:46;pointer-events:none;
  background:linear-gradient(90deg,#5B8CFF,#7FD3FF,#9D7BFF,#FF8FB8,#5B8CFF,#7FD3FF);background-size:200% 100%;
  box-shadow:0 0 12px 2px rgba(91,140,255,.65),0 0 28px 6px rgba(157,123,255,.35);
  transform-origin:center;animation:zc-edge-in .36s var(--ease-out) both,zc-edge-flow 4s linear infinite;opacity:.8}
.zc-ai-edge::after{content:"";position:absolute;left:0;right:0;top:0;height:1px;background:rgba(255,255,255,.4)}
.zc-ai-edge[data-state="thinking"]{opacity:1;animation:zc-edge-in .36s var(--ease-out) both,zc-edge-flow 1.6s linear infinite}
.zc-ai-edge[data-state="thinking"]::before{content:"";position:absolute;top:-3px;bottom:-3px;width:18%;left:-18%;
  background:radial-gradient(closest-side,rgba(255,255,255,.95),transparent);filter:blur(4px);animation:zc-edge-pulse 1.4s var(--ease-in-out) infinite}
@keyframes zc-edge-in{from{transform:scaleX(0)}to{transform:scaleX(1)}}
@keyframes zc-edge-flow{to{background-position:-200% 0}}
@keyframes zc-edge-pulse{to{transform:translateX(660%)}}
.zc-ai-glow .b{position:absolute;bottom:-60px;width:42vw;height:200px;border-radius:50%;filter:blur(44px);will-change:transform;animation-play-state:running}
.b1{left:-6vw;background:#5B8CFF;animation:zc-flow1 9s ease-in-out infinite}
.b2{left:22vw;background:#9D7BFF;animation:zc-flow2 11s ease-in-out infinite}
.b3{left:48vw;background:#5B8CFF;animation:zc-flow1 8s ease-in-out infinite reverse}
.b4{left:70vw;background:#FF8FB8;opacity:.6;animation:zc-flow2 10s ease-in-out infinite}
.zc-ai-glow[data-state="thinking"] .b{animation-duration:4.5s}
.zc-ai-glow .wave{position:absolute;bottom:0;left:-30%;width:30%;height:90px;background:radial-gradient(closest-side,rgba(157,184,255,.9),transparent);filter:blur(24px);opacity:0}
.zc-ai-glow[data-state="thinking"] .wave{animation:zc-wave 1.6s var(--ease-in-out) infinite}
@keyframes zc-flow1{0%,100%{transform:translateX(0) scale(1)}50%{transform:translateX(6vw) scale(1.08)}}
@keyframes zc-flow2{0%,100%{transform:translateX(0) scale(1.02)}50%{transform:translateX(-5vw) scale(.95)}}
@keyframes zc-wave{0%{transform:translateX(0);opacity:0}20%{opacity:1}100%{transform:translateX(430%);opacity:0}}
.b2{background:#9D7BFF}.b4{background:#7FD3FF}
@media (prefers-reduced-motion:reduce){.zc-ai-glow .b,.zc-ai-glow .wave,.zc-ai-edge,.zc-ai-edge::before{animation:none}.zc-ai-glow{opacity:.45}.zc-ai-edge{transform:none}}
```
Pause the animations when `document.hidden`. Mount the glow only while the AI is open; unmount 300 ms after it fades.

### 12.4 Table and grid thumbnails (C6, C7)
```tsx
export function Thumb({ media, size = 40, priority = false }: { media: { url: string; placeholder?: string; color?: string; alt?: string }; size?: number; priority?: boolean }) {
  const [loaded, setLoaded] = React.useState(false);
  const src = (w: number, f: "webp" | "avif") => `${media.url}?w=${w}&fm=${f}&q=70`; // or the CDN's own resize URL
  return (
    <span className="zc-thumb" style={{ width: size, height: size, background: media.color ?? "#EEF0F3",
      backgroundImage: media.placeholder ? `url(${media.placeholder})` : undefined }}>
      <picture>
        <source type="image/avif" srcSet={`${src(size, "avif")} 1x, ${src(size * 2, "avif")} 2x, ${src(size * 3, "avif")} 3x`} />
        <img src={src(size * 2, "webp")} srcSet={`${src(size, "webp")} 1x, ${src(size * 2, "webp")} 2x`}
          width={size} height={size} alt={media.alt ?? ""} decoding="async"
          loading={priority ? "eager" : "lazy"} fetchPriority={priority ? "high" : "auto"}
          onLoad={() => setLoaded(true)} style={{ opacity: loaded ? 1 : 0 }} />
      </picture>
    </span>
  );
}
```
```css
.zc-thumb{display:inline-block;flex:none;border-radius:10px;overflow:hidden;background-size:cover;background-position:center}
.zc-thumb img{width:100%;height:100%;object-fit:cover;display:block;transition:opacity .16s var(--ease-out)}
```
Generate the sizes on upload (sharp: 64/128/256/512, WebP + AVIF), store a 16px blurred `placeholder` (base64, under 400 bytes) and the dominant `color` with each media record, and run a one-time backfill job for existing images.

### 12.5 Chart entrance (D2)
```tsx
export function useChartEntrance<T extends Element>() {
  const ref = React.useRef<T>(null);
  const [play, setPlay] = React.useState(false);
  React.useEffect(() => {
    const el = ref.current; if (!el) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) { setPlay(true); return; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setPlay(true); io.disconnect(); } }, { threshold: 0.3 });
    io.observe(el); return () => io.disconnect();
  }, []);
  return { ref, play }; // add data-play={play} on the chart root; CSS below does the rest
}
```
```css
/* line draw: give each line pathLength="1" */
.zc-chart .line{stroke-dasharray:1;stroke-dashoffset:1}
.zc-chart[data-play="true"] .line{stroke-dashoffset:0;transition:stroke-dashoffset .7s var(--ease-out)}
.zc-chart .area{opacity:0}
.zc-chart[data-play="true"] .area{opacity:1;transition:opacity .3s var(--ease-out) .4s}
/* bars grow from the axis; set --i per bar for the stagger */
.zc-chart .bar{transform:scaleY(0);transform-origin:bottom;transform-box:fill-box}
.zc-chart[data-play="true"] .bar{transform:scaleY(1);transition:transform .5s cubic-bezier(.22,1.2,.36,1) calc(var(--i)*25ms)}
/* dot grid wave; set --c (column index) per dot */
.zc-dots .dot{opacity:0;transform:scale(.6)}
.zc-dots[data-play="true"] .dot{opacity:1;transform:scale(1);transition:opacity .3s,transform .3s var(--ease-out);transition-delay:calc(var(--c)*6ms)}
/* rings: pathLength="100" on the circle, --v = value 0..100 */
.zc-ring .val{stroke-dasharray:100;stroke-dashoffset:100}
.zc-ring[data-play="true"] .val{stroke-dashoffset:calc(100 - var(--v));transition:stroke-dashoffset .7s var(--ease-out)}
/* chart labels speak after the draw */
.zc-chart .say{opacity:0;transform:translateY(4px)}
.zc-chart[data-play="true"] .say{opacity:1;transform:none;transition:opacity .24s,transform .24s var(--ease-out) .8s}
/* live end point */
.zc-chart .live::after{content:"";position:absolute;inset:-6px;border-radius:50%;border:2px solid rgba(31,94,255,.35);animation:zc-pulse 2.4s var(--ease-out) infinite}
@keyframes zc-pulse{0%{transform:scale(.6);opacity:1}100%{transform:scale(1.8);opacity:0}}
@media (prefers-reduced-motion:reduce){.zc-chart *,.zc-dots *,.zc-ring *{transition:opacity .12s!important;transform:none!important;stroke-dashoffset:0!important}}
```
For value changes (date range, Sales ↔ Orders), tween the numbers with one `requestAnimationFrame` loop over 400 ms and re-render the path. Don't reset `data-play`.
