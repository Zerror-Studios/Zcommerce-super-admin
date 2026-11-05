# Zcom dashboard v2 — developer guide

**Version 2.0 · 5 Nov 2026 · Zerror Studios**
Covers both apps: **Merchant Admin**, used by store owners (the demo store is Kesar & Kin), and **Super Admin**, used by the Zerror team.

This guide explains how to turn the current Zcom dashboard into the v2 design, both the new look and the new structure (menu order, page layouts, columns, tabs): what changes, why it changes, and the exact rules to follow. It was written so you, or Claude Code working in the repo, can apply it directly.

**How it relates to the existing design docs:** v2 sits on top of the v1.4 design system (`docs/design/`, "Zcom UI System"). Where the two disagree, **this file wins**. Where this file says nothing, keep doing what v1.4 says. Where the text and a screen disagree, **the text wins**.

---

## 0. Read this first

**This is more than a new look.** v2 changes the visual design *and* the structure: the order of pages in the menu, where things sit on each page, which columns a table has and in what order, which tabs a list has, and what was removed or merged. **The structure changes are part of the spec and must be built exactly as designed**; §1A lists every one of them. It is still not a rebuild: the backend, data and business rules stay.

1. **Build the new structure exactly.** New columns, new column order, new tabs, moved buttons, merged cards and removed blocks are deliberate decisions from the design reviews. Don't keep the old layout because it "already works". Follow §1A and the boards.
2. **Keep every capability.** Nothing the merchant can do today may be lost. When something is removed from a page, it is either a duplicate (for example a second Export button or a second AI button) or it has **moved** (for example Export into the ⋯ menu, Refunds into a switch on Payments, Returns into a tab on Orders). Every moved item must still exist and work in its new place. If you find a capability with no place in the new design, list it in your report and ask; don't drop it.
3. **No backend logic changes, except the ones in §9 (New behaviour).** Those need small backend or data work, and are marked **NEW**. New columns that show data the app already has (for example Price or Revenue in a different order) are front-end only.
4. **Build it as a system, not page by page.** Work in this order: tokens, then shared components, then the shell, then pages. Pages only assemble shared components. Never put a one-off colour, size, radius or margin in a page file.
5. **One of each.** One table, one toolbar, one summary panel, one pop-up, one drawer, one search, one AI entry point. If two pages solve the same problem in different ways, that is a bug.
6. **The design boards are the reference.** `screens/` has a picture of every board; `boards/` has the same boards as HTML files you can open in a browser and inspect for exact values. All numbers in them are **sample data** (see §11).

---

## 1. What changed and why (the short story)

Seven review rounds with Mehak (Operations Manager, design lead on this project) led to these decisions. The reasons matter, because they decide the cases this guide doesn't cover.

| Change | Why |
|---|---|
| **Fewer colours.** Black, white and grey everywhere; blue for actions; one blue gradient for highlights and AI; red or amber only when something needs attention. | Too many colours (orange avatars, pink categories, green or black cards, rainbow borders) made the product look unserious. Colour must *mean* something. |
| **One blue summary panel** at the top of every list page, holding four numbers, and collapsible. | Four differently coloured cards looked random. One calm panel reads as one unit, and then the eye moves to the table. |
| **Tables are identical everywhere.** Tabs, search, filter and sort sit *above* the table, never inside it. Export and import live in the ⋯ menu. | Some tables had tabs in the header and others outside; buttons differed page to page. Consistency makes the product feel engineered. |
| **No top bar. The page uses the full height.** Search sits at the top of the left menu. | The extra bar wasted space and duplicated the menu. |
| **Zcom AI lives in one place:** a bar at the bottom centre of every page. It opens as a half-height sheet, then expands to full. | "Ask AI" buttons were in four places (top right, the search box, the menu, the hero). One place is easier to learn and looks deliberate. |
| **An animated orb glyph replaces the static AI sparkle**, wherever AI suggests something. | It signals "AI is live here" without labels, and its states (idle, listening, thinking, done) give feedback. |
| **A simpler menu:** one flat list, no group headings, new names. | Grouped headings (Sell, Grow, Store) felt cluttered. |
| **Calmer, more Apple-like AI and sign-in.** Deep blue gradient, no glassmorphism, animation on transform and opacity only. | Premium but serious. Heavy blur and glass make dashboards slow on older laptops. |
| **The details people asked for:** amount before method in Payments, price before revenue in Products, "+1" instead of stacked product photos, an icon for each order step, a Shiprocket wallet with health colours, SEO scores on blog content, a Shopify-style customer group builder, a WhatsApp-style customer profile in Inbox. | Each comes from real merchant use: the most important number comes first, and things that make rows jump around are removed. |

---

## 1A. Structure changes (build these exactly)

The checklist of every layout and content change from the current dashboard. Pages not listed keep their current structure, restyled with v2. Details and reasons are in §3–§7.

### Shell (both apps)
| Change | From → to |
|---|---|
| Top bar | **Removed.** Pages start with their own title row and use the full height |
| Search | Moves to the top of the left menu (⌘K), search only |
| Ask AI | All "Ask AI / Ask Zcom AI" buttons removed (top right, hero, search box, menu). **New:** one Zcom AI bar at the bottom centre of every page → half sheet → full view |
| Menu groups | Group headings (Sell, Grow, Store) **removed**; one flat list |
| Menu order (merchant) | Home, Inbox, Sales ▸ (Orders, Payments), Catalogue ▸ (Products, Inventory, Collections, Lookbooks), Customers, Marketing ▸ (Overview, Campaigns, Discounts), Content ▸ (Blog posts, Categories, Tags, Authors), Analytics ▸ (Overview, Sales, Customers, Traffic, Marketing), Apps & channels, Help & support ▸ (Tutorial videos, Guides, My tickets, What's new) · bottom: Notifications, Settings, profile |
| Removed menu items | Returns (now a tab in Orders), Refunds (now a switch in Payments), Abandoned carts (now a tab in Orders), Drafts (removed; if draft orders are used today, they show as a filter in Orders), Customer groups (now tabs in Customers), Onboarding in Super Admin (now the "In setup" filter on Stores) |
| Settings | No dropdown in the menu; keeps its own two-pane menu inside the page |
| Profile menu | Shows the Zcom version with a What's new link |
| Menu (Super Admin) | Home, Stores, Billing ▸, Support ▸ (Tickets, Announcements, Guides & videos), Analytics ▸ (Revenue, Stores, AI usage, System), System health, Settings, profile |

### Every list page
| Change | From → to |
|---|---|
| Summary | Different number strips and coloured cards → **one blue summary panel with exactly 4 numbers**, collapsible |
| Tabs, search, filter, sort | Sometimes inside the table header → **always above the table**, in one toolbar |
| Dropdown filters ("Channel: All", "Method: All", "Category") | → the filter icon, which opens the right-hand filter drawer |
| Export / Import buttons | → the **⋯ menu** in the title row |
| Multi-product rows | Two stacked photos → **one photo with "+N"** |
| Row end | Arrow with a line → small chevron (plus the ⋯ row menu where actions exist) |
| Avatars and icon tiles | Coloured → neutral grey; page-title icon tiles black |

### Page by page
| Page | Structure changes |
|---|---|
| **Home** | Hero band with greeting, AI line, chips and period tabs (no AI button). Row 1: Sales this month, Where orders are, AI card. Row 2: Needs attention (to-dos + 1 insight) and Top products / Latest orders (one card with a switch). Row 3: Sales by day + **Stock to watch (new)**. Learn Zcom videos. **Removed:** Sales by category, the separate Insights card, the live orders map (moved to Analytics overview) |
| **Orders** | Title row: Shiprocket wallet (new), Create order, ⋯ (Export, Import, Print labels, Choose columns). Summary: Orders this month, To pack, On the way, Waiting for payment (the Returns & RTO card is removed; it's a tab). Tabs: All, To pack, On the way, Delivered, Not paid, Returns & RTO, **Abandoned (new)**. Order column shows the date under the number. Row click opens the preview drawer over the full table |
| **Order detail** | Step tracker with a different icon per step (Placed, Paid, Packed, Shipped, Delivered) |
| **Payments** | **Payments \| Refunds switch** in the title row (Refunds page and tab removed). Column order: **Payment # (date under it), Customer, Amount, Status, Paid with** (the separate Date column is removed). Method dropdown → filter. Rows open the detail page; no dropdown rows |
| **Products** | Column order: **Product, Price, Status, Stock, Sold · 30d, Sells on, Revenue · 30d**. Sells on shows icons (online store, Instagram shop, WhatsApp catalogue). **New** summary panel (Live products, Sold · 30d, Running low, Opened no sales). Toolbar outside the table with a table / cards switch. Import and Export → ⋯ |
| **Inventory** | Tabs and search moved above the table; Export → ⋯; sold out in red |
| **Collections** | New page: summary panel, table view **and** card view |
| **Lookbooks** | New page: summary panel, card view **and** table view (Lookbook, Looks, Products, Views · 30d, Shop taps, Status) |
| **Customers** | Title row: **New group** + **New customer** + ⋯ (Import, Export). Groups become **tabs above the table** (the "Saved segments" row is removed). **New** summary panel. New group opens the rule builder pop-up |
| **Inbox** | Three columns → **two** (list + chat). The customer panel is removed from the side; tapping the name turns the chat into the profile. List filters: To reply, Mine, All, Done + filter for channel and type. Reply box gains a WhatsApp / Email / SMS switch |
| **Campaigns, Discounts** | Summary panel; tabs above the table; channel filter → filter drawer |
| **Analytics overview** | **New layout:** live India map with cities, 4 coloured tiles, then two rows of 4 extra cards (Visitors, Visitors who buy, New customers, Orders with a discount, Returns & RTO, Cancelled, Blog visits, Sold out). "Ask Zcom AI" button → "Ask why" |
| **Analytics sub-pages** | Number strips → summary panel. Marketing adds a weekly "Back for every ₹1 on ads" chart and bars on sources and campaigns |
| **Blog posts** | Columns: **Post (title, with category · author under it), Status, SEO score (new), Reads, Updated**. The separate Category and Author columns and the author photos are removed. Category dropdown → filter drawer. Summary panel |
| **Categories** | Banner image in each row; **SEO score column (new)**; summary panel |
| **Tags** | **SEO score column (new)**; summary panel |
| **Authors** | **Profile SEO column (new)**; author photos neutral; summary panel |
| **Help & support** | Dropdown in the menu (Tutorial videos, Guides, My tickets, What's new); the in-page tabs are removed; video thumbnails 16:9 |
| **Sign in** | Black, one question at a time (email → password → loading → retry). Google and Apple buttons and the marketing panel are removed |
| **Pop-ups** | Three sizes; icon in the title row; delete shows the product; **customer group rule builder (new)** |
| **SA Home** | Same hero as merchant Home; summary panel (GMV, Subscriptions, Store health, Uptime); Needs you cards; Recent activity |
| **SA Stores** | **Table only** (the cards view is removed); filters All, Live, In setup, At risk, Paused; rows open in place |
| **SA Store › Apps** | Grid table (App, Type, Status, Last sync, Note, Action) + summary panel + "Suggested for this store" |
| **SA Support tickets** | Summary panel and the standard toolbar |

---

## 2. Foundations (tokens)

Put these in the shared tokens file (`tokens.css` / theme) and map them into Tailwind or the component library. Exact values are also in `zcom-v2-styles.css`.

### 2.1 Colour

| Token | Value | Use |
|---|---|---|
| `--ink` | `#0B0C10` | Text, sidebar, black buttons, active tab, icon tiles |
| `--page` | `#EBECF0` | Page background (slightly darker than before, so white tables stand out) |
| `--surface` | `#FFFFFF` | Cards, tables, pop-ups |
| `--line` | `#E3E4E9` | Card borders; table row lines `#F1F1F4`; table header background `#FAFAFB` |
| `--muted` | `#5F646E` (labels), `#6F747E` (secondary), `#8A8F9A` (faint) | Text levels |
| `--blue` | `#1F5EFF` | Primary button, links. Secondary button: background `#EEF3FF`, text `#1F4FD6`, border `#DCE5FF` |
| `--ai-gradient` | `radial-gradient(120% 120% at 100% 0%, #60A5FA 0%, #1D4ED8 38%, #0B1A4F 78%, #070E2B 100%)` | **The only gradient.** Summary panel, AI cards, AI sheet header, sign-in light, Home hero (its own variant, §6.1) |
| `--red` | `#D92D20` (tint `#FDECEC`) | Failed, sold out, delete, overdue. Only when something is wrong |
| `--amber` | `#F59E0B` (text `#A15C07`, tint `#FFF4E0`) | Warnings: running low, needs a look soon |
| `--green` | `#16A34A` (tint `#E8F6EE`) | Paid, delivered, healthy |
| Avatars | Background `#E8EAEF`, text `#1F2430` | No coloured or gradient avatars anywhere. The store badge in the menu is `#23262E` |

**Rules**
- Section colours from v1.1 (pink blog, orange analytics, purple) are **retired**. Every page-title icon tile is ink `#0B0C10` with a white icon.
- Channel and category colours (email red, WhatsApp green, category pink) are **retired**. Use grey dots and ink icons.
- Status badges keep green, amber and red, because there the colour carries meaning.
- No rainbow or multicolour borders. The AI suggestion banner uses a light blue fill `#F1F6FF` with a blue edge.

### 2.2 Type
- **Geist** for the UI, **Geist Mono** for small uppercase labels, codes and timestamps.
- Page title 22px/30 semibold (list pages); hero greeting 44–46px, weight 300 with the name in 600.
- Body 14px/20. Table header 12px/500 `#5F646E`. Summary panel value 26px/32 semibold.
- Rupees: always the ₹ sign with full Indian grouping (₹1,84,792). Never lakh shorthand, never "Rs".

### 2.3 Shape, space and shadow
- Radius: cards, tables and the summary panel **22px**; small cards and stat tiles 18px; inputs 11–12px; buttons, tabs and chips **999px** (pills); icon tiles 12px; pop-ups 22px; drawers 22px on the open edge.
- Page padding 28px 32px; gap between blocks 16px; table cell padding 0 18px.
- Shadows only on floating things (pop-ups, menus, the AI bar, drawers): `0 30px 70px -24px rgba(11,12,16,.35)`. Cards on the page have a border and no shadow.

### 2.4 Motion
- Animate **transform and opacity only**. No animated `filter: blur`, box-shadow or layout properties. No `backdrop-filter`, except optionally on the Home hero buttons.
- The summary panel and AI cards have one slow drifting light (10–12s, ease-in-out, alternate).
- The orb glyph rotates its colour layer (5s idle, 1.1s thinking) and breathes its core (2.8s).
- Pop-ups fade in and rise 8px in 160ms. The AI sheet rises in 220ms.
- Respect `prefers-reduced-motion`: stop every looping animation.

---

## 3. The shell

Screen refs: `08-V4-Menu`, any page.

### 3.1 Left menu (240px, ink)
Top to bottom:
1. **Store switcher:** a neutral badge with initials, the store name and the domain.
2. **Search** box with the ⌘K hint. It is search only: products, orders, customers, pages and settings, grouped by type. It doesn't ask AI.
3. The items, as **one flat list with no group headings**:
   - Home
   - Inbox (count)
   - **Sales ▸** Orders, Payments
   - **Catalogue ▸** Products, Inventory, Collections, Lookbooks
   - Customers
   - **Marketing ▸** Overview, Campaigns, Discounts
   - **Content ▸** Blog posts, Categories, Tags, Authors
   - **Analytics ▸** Overview, Sales, Customers, Traffic, Marketing
   - Apps & channels
   - **Help & support ▸** Tutorial videos, Guides, My tickets, What's new
4. A spacer, then **Notifications** (red count), **Settings**, and the **profile row**. The profile menu holds Your account, Switch store, Keyboard shortcuts, Log out, and the **Zcom version** with a What's new link.

**Menu rules**
- A chevron opens a section in place; its pages appear as sub-items. Only the open section shows sub-items. The menu never goes deeper than one level.
- Things that are a *slice* of one list are **tabs inside the page**, not menu items:
  - Orders: Returns and Abandoned.
  - Payments: Refunds, through the Payments | Refunds switch.
  - Customers: the customer groups.
- **Settings has no dropdown.** It opens its own two-pane page with its own left menu (as in v1.4).
- Super Admin menu: Home, Stores, Billing ▸, Support ▸ (Tickets, Announcements, Guides & videos), Analytics ▸ (Revenue, Stores, AI usage, System), System health, Settings, then the profile row. There is no Onboarding page: new stores show in the Stores table under the "In setup" filter.

**Why:** the menu was too cluttered and nested. Slices of a list belong with the list.

### 3.2 No top bar
Remove the global top bar. Each page starts with its own title row (§4.1). Search lives in the menu, notifications at the bottom of the menu, and AI in the bottom bar.

### 3.3 Zcom AI bar — the only AI entry point
Screen refs: `05-V4-AI`, `46-AI-Full`.
- **Closed:** a white pill (54px tall, 600px wide max, radius 27px) centred at the bottom of the content area, 26px from the bottom. It holds the orb glyph, the placeholder "Ask Zcom AI anything…", one suggestion chip for the current page and the ⌘J hint. It floats above the content (fixed to the viewport, z-index above tables). Content gets 120px of bottom padding so the bar never hides the last row or the pagination.
- **Open (click or ⌘J):** a **bottom sheet covering about 50% of the viewport height**, the full width of the content area, with a 24px radius on the top corners.
  - Header strip in `--ai-gradient` with a grab handle, "Zcom AI · sees ‹page›", expand and close.
  - Body: "How can I help today?" with 3 suggestions for the current page. The bar becomes the input.
  - The rest of the page stays visible above, dimmed at 28%.
- **Expanded (expand button or drag up):** the sheet grows to the full height, with chat history on the left. Shrink returns to half; Esc or close returns to the bar.
- Answers end in one clear next step (button) and the line "Nothing is sent or changed until you say yes".
- Super Admin uses the same bar: "Ask Zcom AI about any store…".
- **Remove** every other "Ask AI" or "Ask Zcom AI" button: the top right, the hero, the search box and the menu. Contextual AI *actions* stay (for example "Write one with AI" on Campaigns, "Draft by Zcom AI" in the Inbox reply box), because they do one job on one thing.

### 3.4 The orb glyph
- An 18px circle (28px large; 30px in the bar). A deep blue base with a rotating layer of soft blue, cyan and periwinkle light, and a breathing white core (see `.glyph` in the styles file). The white variant `.glyph.w` is for dark backgrounds.
- It goes in front of every AI suggestion: suggestion lines, insight cards, draft replies, the AI bar.
- States: **idle** (slow), **listening** (core pulses, ring ripples), **thinking** (fast spin and ring), **done** (still, with a tick). Shown on `05-V4-AI`.

---

## 4. Shared components

### 4.1 Page title row
Left: a 44px ink icon tile, the title with its count (22px), and one line of plain-language status under it. Right: page actions. **At most one primary (blue) button and one secondary**, then a **⋯ button** that holds Export, Import, Print and Choose columns (whatever applies to that page). No Export or Import buttons anywhere else.

### 4.2 Summary panel (the "blue bar")
Screen refs: `16-Products`, `22-Customers`, `13-Payments`; collapsed on `26-Campaigns`.
- One panel, radius 22, filled with `--ai-gradient` and a slow drifting light. It is split into **four equal cells** by 1px dividers (`rgba(255,255,255,.12)`).
- Each cell has a label with a small dot, a 26px value, a one-line note (72% white) and a small chart in the bottom right corner: bars, dot area, ring or segments, in white.
- **Meaning only:** a cell that needs attention tints its dot, note and chart red (`#FCA5A5`) or amber (`#FCD34D`). Nothing else changes colour.
- **Collapsible:** a 28px round arrow at the top right. Collapsed, the panel becomes one slim 48px line: label and value for each cell, no notes, no charts. **Remember the choice per user, per page.**
- Every list page has exactly one, directly under the title row: Orders, Payments, Products, Customers, Collections, Lookbooks, Campaigns, Discounts, Blog posts, Categories, Tags, Authors, Super Admin Stores, Tickets, store detail, and the analytics sub-pages.
- Exception: **Analytics overview** keeps its own hero cards (map and coloured tiles). Its two rows of extra cards use the white "lite" version.
- The small charts are decorative until real series are wired. Use real 8–10 point series when they are available.

### 4.3 Table toolbar (above every table)
- Left: **segmented tabs** (pill group, background `#DFE1E7`, active tab white). Each tab has a count.
- Right, in this order: **search** (pill, 36px, white), the **filter** icon button, the **sort** icon button, and a **view switch** (table | cards) where both views exist.
- Never inside the table card. Never as dropdown buttons like "Channel: All" or "Method: All"; those go into the filter.
- **Filter** opens a **drawer from the right**: 420px wide, a scrim, checkbox and chip groups, "Clear all", "Cancel" and "Show N results". Screen: `36-Blogs-Filter`.

### 4.4 Data table
- White card, radius 22. Header row 40px, background `#FAFAFB`, 12px/500 grey text.
- Rows 60–64px, separated by `#F1F1F4` lines.
- The first column is the identifier, with any date or secondary line **under it** (for example "#1880 / 4 Nov, 10:12").
- **The most important number comes right after the customer or product**, before method, status or date (§6).
- **More than one product in a row:** show **one** thumbnail with a small ink "+N" badge on its corner. Never stack two images, because it makes the names jump around between rows.
- **Row end:** a ⋯ row menu (where actions exist), then a **small chevron**: 30px circle, no arrow line. The row opens a detail page, or a **preview drawer over the full table** (Orders).
- No coloured avatars. Neutral icon tiles. Status badges are the only colour.
- Pagination: "Showing 1–8 of 300", Previous, page numbers, Next. Keep server pagination and virtualisation from v1.4 §09.

### 4.5 Buttons
- Pills, 36px (32px small). The primary is blue. Secondary: light blue. Dark: ink (Log out, Mark done). Destructive: red, **only** for delete or discard.
- Icon buttons are 36px round, white with a border. When active (open menu or filter), the icon button is ink.

### 4.6 Pop-ups
Screen refs: `09-V4-Dialogs`.
- **Three sizes only:** small 420 (yes/no), medium 640 (short forms), large 960 (builders, AI, app details). White, radius 22, padding 20–22px, and a plain dark scrim (`rgba(11,12,16,.4)`) **with no blur**.
- **Title row:** a 36px icon tile (grey, red for delete), the title, and a close button.
- **The title names the thing and asks one question:** "Delete this product?", "Log out of Kesar & Kin?", "Leave without saving?". Never "Are you sure?".
- **Show the object:** delete shows the product with its photo, name, price, stock and collections.
- **Buttons are right-aligned pills, Cancel first and the action last.** The label is the action ("Delete product", "Discard changes"). A secondary link (for example "Archive instead") sits on the left.
- Focus starts on Cancel for anything destructive. Esc closes, except during a delete in progress.
- **Signed out (session expired):** keep the version with the blue header and orb: "Welcome back, Aarav". Password field, "Not you?", "Log out" and "Sign in".

### 4.7 Wallet capsule (Shiprocket)
Screen refs: `11-Orders-A`.
- A 40px pill holding the **Shiprocket logo** (a 32px white circle; use the official logo, the board shows a placeholder rocket), the **balance** and a **+** button. No "Shiprocket" word and no dot.
- **The whole capsule is coloured by health:** green when the balance lasts 7 or more days, orange for 3 to 7 days, red below ₹2,000.
- Click opens a 380px card with:
  - the balance, and "You spend about ₹X a day … lasts about N days, add money before ‹date›";
  - a progress bar with the run-out date;
  - an auto-recharge switch on one line: "Add ₹5,000 when it drops below ₹2,000";
  - Add money and Shipping costs buttons, and a key to the three colours.

### 4.8 Other components
- **Insight line** (`.ai-line`): light blue fill, the orb, one sentence and one link.
- **AI card** (`.ai-card`): `--ai-gradient` with white text, the white orb, a headline, one line and two buttons.
- **SEO score:** a 26px ring coloured by score (green 80+, amber 60–79, red under 60), the number, and Great, Good or Needs work.
- **Video thumbnail:** 16:9, radius 20, the title top left, a **real screenshot** of the relevant screen, a play button with the length bottom left, and nothing else. Four looks rotate so a row never repeats: a tilted window on a light blue gradient, a zoomed detail on grey, a phone frame on soft lilac, and a dark gradient with a straight screenshot.
- **View switch:** table | cards (Collections and Lookbooks have both views).

---

## 5. Sign in

Screen refs: `06-Login`, `07-Login-Steps`.
- Pure black, full screen. "Zcom" as a bold 24px wordmark (no Z box) at the top left. "Welcome to the new era of e-commerce." small at the bottom right. A soft blue halo with the orb character in the centre.
- **One question at a time:**
  1. "Hi. What's your email?" The orb's eyes follow the typing.
  2. The password field slides in under the email: "Thanks, Aarav. Now your password. I'm not looking." The eyes close and turn away.
  3. "Getting your store ready…" The orb spins fast, with three dots.
  4. On failure: "That didn't match. Let's try again." A red field edge. Never say whether the email or the password was wrong.
- No Google or Apple buttons and no marketing panel. "New to Zcom? Start a store" (step 1) and "Forgot password?" (step 2) are small grey links. The 2-step code follows as in v1.4.
- The same screen is used for Super Admin; its wordmark gets the label "Platform".

---

## 6. Page by page (Merchant Admin)

For each page: **what to change from the current dashboard**, then the reference screen.

### 6.1 Home — `01-V4-Home`
- **Hero band:** radius 28, about 300px tall.
  - Background: a deep-blue linear gradient with 4 large soft radial lights drifting slowly (transform only) and a faint noise overlay at 18%.
  - Content: the date in mono at the top left and "View store ↗" at the top right; "Good morning, **Aarav**"; the orb with a one-line AI summary.
  - Bottom row: three chips (Sales, Orders, Visitors with a green or red dot), and period tabs on the right (Today, 7 days, **30 days**, This year).
  - No buttons that ask AI.
- **Row 1, under the hero (no overlap):** Sales this month (dot chart), Where orders are (segment bars), and an AI card ("Checkout has failed for 11 days", Fix checkout).
- **Row 2 (two cards):**
  - Needs attention: 4 to-dos, then one insight line.
  - **Top products | Latest orders**, a switch in one card.
- **Row 3:** Sales by day (30 hatched bars, the best day solid blue, empty days light red) and **Stock to watch** (3 rows, each with a Restock button).
- **Learn Zcom:** 4 video thumbnails (§4.8).
- **Removed:** Sales by category, the separate Insights card, and the live orders map (it moved to Analytics overview).

### 6.2 Orders — `11-Orders-A`, `12-Orders-Peek`
- Title row: wallet capsule (§4.7), Create order, and ⋯ (Export orders, Import, Print shipping labels, Choose columns).
- Summary panel: Orders this month, To pack, On the way, Waiting for payment (amber).
- Tabs: All, To pack, On the way, Delivered, Not paid, Returns & RTO, **Abandoned** (NEW, abandoned checkouts).
- Columns: Order (# and date), Items (one photo + "+N"), Customer, Payment, Delivery, Total, then the row ⋯ and chevron.
- Clicking a row opens the **preview drawer over the full table** (460px). The table keeps every column.

### 6.3 Order detail — `14-Order-Detail`
- Step tracker: **a different small icon for each step**: Placed (bag), Paid (card), Packed (box), Shipped (truck), Delivered (house with tick). Done steps are 34px ink tiles joined by an ink line; Delivered turns green when complete.
- The rest is as in v1.4: items, payment, customer, timeline, profit.

### 6.4 Payments — `13-Payments`
- Title row: a **Payments | Refunds switch**, then ⋯ (Export payments, Download settlement report, Payment settings). There is no separate Refunds page.
- Columns, in this order: **Payment # (date under it), Customer, Amount, Status, Paid with.**
- A row opens the payment detail page (no dropdown). Payment detail is unchanged (`15-Payment-Detail`).

### 6.5 Products — `16-Products`
- Columns: Product, **Price**, Status, Stock, Sold · 30d, **Sells on** (icons: online store, Instagram shop, WhatsApp catalogue), **Revenue · 30d** last.
- Toolbar above the table, with the table | cards switch. The AI banner stays (blue edge, not rainbow).

### 6.6 Inventory — `17-Inventory`
- Sizes open in place (as before). **Sold out is red, not pink.** Tabs and search move above the table.

### 6.7 Collections and Lookbooks — `18`–`21`
- Both have a **table view and a card view**. The summary panel is on top.
- Collection cards show 3 photos, name, status, how it's filled, product count, visits and conversion.
- Lookbook table columns: Lookbook, Looks, Products, Views · 30d, Shop taps, Status.

### 6.8 Customers — `22-Customers`, pop-up on `09-V4-Dialogs`
- Title row: **New group** (secondary), **New customer** (primary), ⋯ (Import, Export).
- **Groups are the tabs above the table:** All, VIP, Loyal, New, Slipping away, plus any saved groups.
- Filter and sort are icons. Avatars are grey. VIP is a small ink tag. "Can reach on" icons are neutral, faded when not available.
- **New group (large pop-up, NEW logic):**
  - "Customers who match **all / any** of these conditions".
  - Each condition is **field ▾ / rule ▾ / value**, with AND or OR shown between rows.
  - Fields: number of orders, amount spent, last order date, bought a product, bought from a collection, city or state, subscribed to WhatsApp or email, customer tag.
  - A **live preview** on the right: count, total spend, the first 5 customers and "See all".
  - One AI suggestion. "Save group" creates a tab that updates itself.

### 6.9 Inbox — `23-V4-Inbox`, `24-V4-Inbox-Profile`
- **Two columns only.**
  - **List (380px):** search with a filter icon (the filter holds type: orders, returns, reviews, restock, questions, and channel); tabs To reply, Mine, All, Done.
  - Each row: grey avatar with a small channel badge, name, time, a one-line preview, at most one small label (red only for payment problems) and an unread dot.
- **Chat:**
  - Header: avatar, name, VIP, "WhatsApp · Pune · tap for profile", then Assign, Mark done and ⋯.
  - Messages: received on white, sent on ink; order cards inline; system notes centred.
  - **Reply box:** the Zcom AI draft with the orb, a **send-on switch (WhatsApp | Email | SMS)**, a quick-action chip (for example "Exchange M → L"), Edit and Send.
- **Tap the customer's name:** the chat pane turns into their **profile**, like WhatsApp.
  - A back arrow, a large avatar, name, VIP, city, customer since, phone and email.
  - Buttons: Message on WhatsApp, Email, Call.
  - Four stats (orders, spent, average order, returns) and one AI line.
  - Tabs: Orders (full order history with photo, #, date, status and amount), Messages, Notes.
  - "Open full page" goes to the customer page.

### 6.10 Marketing — `25`–`29`
- The summary panel on Campaigns and Discounts; tabs above the table; channel icons neutral. Overview, campaign detail and discount detail are as approved.

### 6.11 Analytics — `03-V4-Analytics` (overview), `31`–`34`
- **Overview (new):**
  - The live map with India drawn **to the official boundaries** (the full outline as published by the Survey of India); city dots placed by real latitude and longitude; a slow moving light and pulsing city dots.
  - Coloured tiles kept to blue and navy.
  - **Two extra rows of 4 cards** covering everything else: Visitors, Visitors who buy, New customers, Orders with a discount, Returns & RTO, Cancelled, Blog visits, Sold out.
- **Sales, Customers, Traffic:** as approved, plus the summary panel.
- **Marketing:** adds a weekly "Back for every ₹1 on ads" chart, share bars on sales by source, and bars on campaign results. Source dots are neutral.

### 6.12 Content (blogs) — `35`–`40`
- **Blog posts table:**
  - Columns: Post (title, then **category · author** under it, with no author photo), Status, **SEO score**, Reads, Updated.
  - The **Filter drawer** replaces the Category dropdown: status, category, author, SEO band, updated, reads.
- **Categories:** a banner image in each row and an **SEO score** ("Add 2 keywords", "No description yet").
- **Tags:** an SEO score.
- **Authors:** a **Profile SEO** score ("Add a bio and photo").
- **SEO score (NEW):** 0–100 from the completeness of title, meta description, keywords, slug, image alt text, internal links and length (posts); description, keywords and banner (categories and tags); bio, photo and links (authors). The score rises as the profile is filled.

### 6.13 Apps & channels — `41`, `42`
- The promo band uses the blue style (a light blue gradient and a soft blue light). The rest is unchanged.

### 6.14 Help & support — `43`, `44`
- It's in the menu with a dropdown: Tutorial videos, Guides, My tickets, What's new.
- The videos page has topic tabs, 8 thumbnails (§4.8) and Popular guides. My tickets uses the summary panel and the standard toolbar.

### 6.15 Settings — `48`–`57`
- Unchanged two-pane Settings (v1.4 §09), with its own inner menu. The page background is the new darker grey.

---

## 7. Page by page (Super Admin)

- **Home — `02-V4-SA-Home`:**
  - The same hero band as merchant Home ("Good morning, Zerror Studios", chips, period tabs, Announce and Create store).
  - The summary panel: GMV, Subscriptions (past due shown in red text), Store health, Uptime.
  - Three "Needs you" cards: the AI one in light blue, the others white with a small red or amber dot.
  - Recent activity with grey icon tiles.
- **Stores — `59-SA-Stores-Table`:**
  - **Table only, no cards view** (it scales to hundreds of stores).
  - Filters: All, Live, In setup, At risk, Paused.
  - The row chevron **opens the row in place** (sales, store numbers, apps, what to do); the store name goes into the store.
- **Store detail — `60`–`66`:**
  - Tabs: Overview, Billing, Team, Apps, AI usage, Activity log, Settings.
  - **Apps** is an aligned grid table (App, Type, Status, Last sync, Note, Action) with the summary panel and a "Suggested for this store" row.
- **Support tickets — `45-V4-SA-Tickets`:** the summary panel (Open, Waiting on a store, First reply, Solved this week) and the standard toolbar.
- **Analytics — `67`–`70`:** the summary panel replaces the old number strips. The charts are unchanged.

---

## 8. Which boards are final

- **Final:** every board in `screens/` except the three below.
- **Superseded (do not build):**
  - `10-Main` (old Home): use `01`.
  - `30-Analytics` (old overview): use `03`.
  - `58-SA-Home` (old Super Admin home): use `02`.
- **Optional:** `04-V4-Analytics-Sales` is a new-style alternative to `31-Analytics-Sales`. Build `31` unless Mehak says otherwise.
- `46-AI-Full` is the layout of the expanded AI view (§3.3). `47-Loading` shows the skeleton pattern.

---

## 9. New behaviour (needs small backend or data work)

| Feature | What it needs |
|---|---|
| Shiprocket wallet | The wallet balance from the Shiprocket API. The average daily shipping spend over the last 14 days, and days left = balance ÷ daily spend. Health: green 7+ days, orange 3–7, red under ₹2,000. An optional auto-recharge setting (threshold and amount). |
| Abandoned tab in Orders | Abandoned checkouts with contact details (if not already stored), shown as an Orders tab with a "Send reminder" action. |
| Customer groups | A rule engine (AND/OR over the listed fields), a live count, and saved groups shown as tabs that refresh on a schedule. |
| SEO score | A scoring function per post, category, tag and author (§6.12), stored and recalculated on save. |
| Inbox profile | The customer's order history and stats in the inbox (an existing endpoint, probably), and a send channel per reply (WhatsApp, Email, SMS) if the integrations exist. |
| Summary panel collapse | A per-user, per-page preference. |
| AI bar and sheet | UI on top of the existing AI layer. The suggestions per page can start as a static list. |
| Order step icons | UI only. |
| India map | An India outline that follows the official boundaries (see §6.11), stored as an SVG path, with city coordinates. |

---

## 10. Mobile and tablet (not designed yet: follow these rules)

There are no mobile boards yet. Build mobile from these rules so it feels like the same product; Mehak will review the screenshots.

**Breakpoints:** desktop 1280px and up (as designed) · laptop 1024–1279 · tablet 768–1023 · phone under 768 (test at 390px and 360px).

| Part | Laptop / tablet | Phone |
|---|---|---|
| Menu | Collapses to a 72px icon rail; hover or tap opens the full menu as an overlay | A top row with the store switcher, search icon and menu icon; the menu opens as a full-height drawer from the left |
| Page title row | Unchanged; secondary buttons move into ⋯ under 1024 | Title and count on one line, status line under it; only the primary button stays (icon + short label), everything else goes into ⋯ |
| Summary panel | 4 cells in one row; under 900px it becomes 2 × 2 | **Collapsed by default** (the slim line, scrolling sideways); tap the arrow to open it as 2 × 2 |
| Toolbar | Tabs scroll sideways if they don't fit; search shrinks to 200px | Tabs scroll sideways in their own row; search becomes an icon that opens a full-width search field; filter and sort stay as icons |
| Tables | Hide low-priority columns first (keep identifier, key number, status, chevron); the hidden ones stay in Choose columns | **Each row becomes a card:** line 1 is the identifier and the key number (right-aligned); line 2 is the name or customer and the date; line 3 is the status badges. Tap opens the detail. Bulk select through a long press |
| Detail pages | Two columns become one; the side column moves under the main one | One column; the step tracker scrolls sideways; sticky bottom bar for the main action (for example Refund, Save) |
| Drawers (filter, order preview) | 420px from the right | Full screen, with a back arrow |
| Pop-ups | Unchanged | **Bottom sheets** with a grab handle; buttons full width and stacked, the action on top and Cancel below |
| Zcom AI | The bar at bottom centre; the half sheet as designed | The bar spans the full width minus 16px, sitting above the safe area; it opens at 70% height and drags to full |
| Inbox | List and chat side by side down to 900px | The list is one screen; tapping a conversation opens the chat full screen; tapping the name opens the profile full screen |
| Home | 3 cards per row become 2, then 1 | Hero 220px with the greeting and AI line only (chips scroll sideways); then one card per row in this order: AI card, Needs attention, Sales, Where orders are, Top products, Stock, Learn |
| Charts | Keep | Keep the shape, show fewer bars (last 14 days instead of 30), labels at the start and end only |

**Touch:** every tap target at least 44 × 44px. No hover-only actions: anything shown on hover on desktop must have a tap or ⋯ equivalent. Inputs at 16px or more so phones don't zoom.

**Performance on phones:** turn off the drifting lights in the summary panel and hero under 768px (a still gradient is fine). Keep the orb glyph animation. Lazy-load images and charts below the fold.

---

## 10A. Pages we haven't designed yet

Several pages exist in the app but have no v2 board, for example: add or edit product, the customer page, the notifications panel, abandoned checkouts, the refunds view, new store setup, empty and error states, and some Super Admin pages. **Don't leave them in the old style, and don't invent a new look.** Redesign them using the rules below, which are the thinking behind every decision on the boards.

### The thinking (apply it to every new screen)
1. **Start from the job.** Ask "what does the merchant come here to do or check?" Put that first: the most important number or action at the top left, the next most important beside it. Example: in Payments the amount comes before the method, because that's what the merchant checks.
2. **Fewer, calmer things.** Remove anything that repeats elsewhere (a second Export button, a second AI button, a heading that restates the menu). Move rare actions into ⋯. Never remove a capability, only its clutter.
3. **Colour means something.** Black, white and grey by default; blue for the main action and links; the AI gradient for the summary panel and AI only; red, amber and green only for status. If you're about to add a colour to make something "pop", use size, weight or position instead.
4. **The same answer to the same problem.** A list is always: title row → summary panel → toolbar → table. A record is always: back link → title with status badges → main column + side column. A choice is always a pop-up from §4.6. A filter is always the right drawer. Look for the nearest designed page and copy its structure.
5. **Slices are tabs, not pages.** If something is a subset of a list (returns, refunds, groups, drafts), make it a tab or a switch on that list. Add a menu item only for a genuinely different job.
6. **Plain words.** "Waiting for payment", not "Pending (payment)". Say what happened and what to do next. ₹ with Indian grouping.
7. **AI helps in place.** Where AI can save a step, put one insight line or one drafted value right where the merchant works, with the orb. Never a separate "Ask AI" button; the bar at the bottom is the one place to ask.
8. **Nothing jumps.** Fixed row heights, one thumbnail with "+N", skeletons while loading (same size as the content), numbers in tabular figures.
9. **Light motion.** Transform and opacity only, short (160–220ms), one slow light at most per screen.

### Page recipes
- **List page:** title row (icon tile, title, count, status line; primary + ⋯) → summary panel with 4 numbers that answer "how is this going?" → toolbar (tabs by status, search, filter, sort) → table (identifier + date, key number, people, status, chevron) → pagination.
- **Record / detail page:** back link → title, badges and actions (primary, secondary, ⋯) → a step tracker if the record moves through stages (one icon per step) → main column (items, content) + side column (person, address, notes, tags) → timeline at the bottom.
- **Editor (product, post, collection):** v1.4 editor layout, restyled with v2 tokens. Sticky Save in the title row. SEO card with the score ring. AI drafts appear inside the field with the orb, never in a separate panel.
- **Settings page:** the v1.4 two-pane layout, v2 tokens.
- **Empty state:** one ink icon tile, one sentence that says what goes here, one primary button, and (if useful) one AI suggestion line. No illustrations in colour.
- **Error state:** what happened in plain words, what the merchant can do, and a Try again button. Red only on the icon tile.
- **Notifications panel:** a right drawer (420px) with tabs (All, Orders, Payments, System), rows like the Inbox list, and "Mark all as read".

### Before you call a new page done
- It uses only shared components and tokens, with no one-off values.
- Put its desktop screenshot next to the nearest v2 board: they look like the same product.
- It passes the QA checklist in §13, and the mobile rules in §10 at 390px.
- In your phase report, list every decision you made that this guide didn't cover, so Mehak can review them.

---

## 11. Sample data in the boards

All numbers are sample data for the demo store, so replace them with real data. These ones were invented during the redesign:
- Shiprocket wallet ₹4,820, about ₹690 a day.
- 23 abandoned orders.
- SEO scores.
- Rahul Agarwal's six orders.
- The inbox messages and counts.
- The group preview: 42 customers, ₹8,96,400.
- The 45 / 35 order split.
- The best day, ₹1,41,200.
- 14 orders worth ₹4,96,300.
- Zcom version 3.4.0.
- App sync times.
- Ticket details.
- The small charts in the summary panel, which are shapes only.

---

## 12. Build plan (one phase at a time)

On a branch per phase. Each phase ends with a green build and tests, screenshots at 1440px and 390px of every changed page, and a short report. Wait for approval before the next phase.

| Phase | Scope |
|---|---|
| **0 · Audit** | Map every current page and component to this guide, and to the structure changes in §1A (for each page: current columns, tabs and blocks vs the new ones, and where every moved item will live). List every place that has: a top bar, an "Ask AI" button, colours outside §2.1, tabs or search inside a table, Export or Import buttons, coloured avatars, stacked thumbnails. No code changes. |
| **1 · Tokens** | §2 into the shared theme; retire the section colours; the new page background; lint against raw hex values. |
| **2 · Components** | Title row, summary panel (with collapse), toolbar, filter drawer, data table rules, ⋯ menus, pop-up (3 sizes, icon title row), orb glyph and its states, AI card and line, SEO ring, video thumbnail, wallet capsule, view switch. All on `/dev/ui`. |
| **3 · Shell** | The new menu order and names, no top bar, search only in the menu, the AI bar with its half sheet and full view, removing all other Ask AI buttons. |
| **4 · Sign in** | §5 for both apps. |
| **5 · Merchant pages** | In this order: Home, Orders (+ detail), Payments, Products, Inventory, Collections, Lookbooks, Customers (+ group builder), Inbox, Marketing, Analytics, Content, Apps, Help, Settings check. |
| **6 · Super Admin pages** | §7. |
| **7 · New behaviour** | §9 items, each behind a feature flag. |
| **8 · Pages without a board** | Every remaining page in both apps, redesigned with §10A. Group them in batches of 5 with screenshots. |
| **9 · Mobile and tablet** | §10 across both apps, starting with the shell, then list pages, detail pages, Inbox, Home, sign in. Screenshots at 1024, 768, 390 and 360px. |
| **10 · Consistency pass** | Open every route in both apps and check: one title row pattern; one summary panel; toolbar above every table; ⋯ for export and import; no colour without meaning; one AI entry point; the same pill buttons; pop-ups in 3 sizes. Fix everything found. |

### Kickoff prompt for Claude Code
```
Read docs/design-v2/README.md fully and look at every image in docs/design-v2/screens/. Open the matching files in docs/design-v2/boards/ when you need exact values. This guide sits on top of docs/design/ (v1.4); where they differ, v2 wins.

This is a redesign of our existing, working Merchant Admin and Super Admin apps: new visual design AND new structure (menu order, page layouts, table columns and their order, tabs, moved and removed blocks), listed in section 1A, which must be built exactly. Keep every capability: anything that moved must still work in its new place, and nothing a merchant can do today may be lost. The backend stays as it is, except the New behaviour items in section 9, which go behind feature flags.

Work strictly in the phases in section 12, one phase at a time, on a branch per phase, build and tests green before every report. Start with Phase 0 (audit, no code changes) and stop for my OK.
```

### Prompt for pages without a board (Phase 8)
```
Phases 1–7 are done and approved. Now list every page and screen in both apps that has no board in docs/design-v2/screens/. For each one, write one line: which designed page it is closest to and which recipe in section 10A it will use. Stop and wait for my OK.

Then redesign them in batches of 5, following section 10A (the thinking, the recipes and the done checks) and reusing only the shared components from Phase 2. Keep every feature. For each batch send desktop screenshots next to the nearest v2 board, and list every decision the guide didn't cover.
```

### Prompt for mobile and tablet (Phase 9)
```
Make both apps responsive following section 10 of docs/design-v2/README.md. Build it into the shared components first (menu, title row, summary panel, toolbar, table-to-cards, drawers, pop-ups as bottom sheets, the Zcom AI bar), then check every page. Keep every feature reachable on a phone. Send screenshots at 1024, 768, 390 and 360px for the shell, Home, Orders, Order detail, Products, Customers, Inbox and Sign in, then stop.
```

### Prompt for any new page or feature later
```
Build <feature> following docs/design-v2/README.md: use the nearest page recipe in section 10A, only shared components and tokens, the rules in section 10 for mobile, and the QA list in section 13. Show me desktop and 390px screenshots next to the nearest v2 board, and list anything the guide didn't cover.
```

Add this line to the repo's `CLAUDE.md`, so every future session follows it:
```
## UI
All UI in the Merchant Admin and Super Admin apps follows docs/design-v2/README.md (v2), on top of docs/design/ (v1.4). New pages use the recipes and thinking in section 10A and the mobile rules in section 10. Use shared components and tokens only; never hard-code colours, sizes or radii. Keep every existing feature.
```

### Continue prompt
```
Approved. Start Phase N of docs/design-v2/README.md. Keep every feature, end with build and tests green, screenshots of every changed page at 1440px and 390px, and a short report of changes, decisions where the guide was silent, and anything skipped. Then stop.
```

---

## 13. QA checklist (tick every item for every page)

- [ ] The page's structure matches §1A and its board: same blocks in the same order, same columns in the same order, same tabs; everything moved still works.
- [ ] No top bar; the page uses the full height.
- [ ] The menu matches §3.1 (order, names, no group headings, Help dropdown, Notifications and Settings at the bottom).
- [ ] Exactly one AI entry point: the bottom bar. No other "Ask AI" buttons.
- [ ] The orb glyph in front of every AI suggestion.
- [ ] One summary panel, collapsible, with colour only on cells that need attention.
- [ ] Tabs, search, filter and sort above the table; filter opens the right drawer.
- [ ] Export and import only in the ⋯ menu.
- [ ] Table identifiers with the date under them; the key number before method, status and date; one photo with "+N"; a chevron at the row end.
- [ ] No coloured avatars, category colours or channel colours; status badges only.
- [ ] Pop-ups: 3 sizes, icon title row, the object shown, Cancel then action, red only for destructive.
- [ ] Rupees as ₹ with Indian grouping, never lakh shorthand.
- [ ] Animations on transform and opacity only; reduced motion respected; no backdrop blur.
- [ ] 1440px and 390px screenshots attached.

---

## 14. What is in this pack

- `README.md`: this guide.
- `screens/`: a picture of every board (numbered like the references above).
- `boards/`: every board as an HTML file. Open one in a browser to inspect sizes, colours and spacing; product photos are placeholders.
- `zcom-v2-styles.css`: every style used on the boards, as the source of exact values. Rebuild them as tokens and components; don't paste the file in.
- **The live design link** (already shared by Mehak) has every board with her comments. When this pack and the link differ, the link is newer.
