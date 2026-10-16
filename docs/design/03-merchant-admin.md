# 03 · Merchant Admin (store owners)

Applies to the merchant app (today on `localhost:5173`). Uses the shell, components and wording from `02` and `05`.

> **Mapping rule:** the structure below is the target navigation. Map every page that exists today into it. If an item below does not exist in the code, **do not build it** — note it in your report. If a page exists today that isn't listed, keep it, put it in the closest section, and apply the nearest pattern.

---

## 1. Navigation

| Sidebar item | Children (shown when active) | Today's pages that move here |
|---|---|---|
| Home | — | Home |
| Orders | All orders · Abandoned checkouts* · Returns* | Orders |
| Products | All products · Inventory · Collections · Lookbooks | Store › Products, Inventory, Collections, LookBooks |
| Customers | All customers · Segments* · Form responses | Contact Book (all its sub-pages), Form Submissions |
| Marketing | Campaigns · Discounts · Templates | SMS Campaigns, Email Campaigns, Discount Coupons, View All Templates |
| Content | Blog posts · Categories · Tags · Authors | Blogs › Posts, Categories, Tags, Writers |
| Analytics | Overview · Live view · Sales · Behaviour | Traffic Overview, Real-Time Overview, Sales Overview, Behavior Overview |
| Finance | Payments · Payouts* · Invoices* | Payments |
| — divider — | | |
| Apps & channels | — | Apps & Channels |
| (bottom) Notifications | panel | bell in the old top bar |
| (bottom) Settings | index page | Settings |

\* only if it exists today.

- Old URLs redirect to new ones.
- Campaigns: if SMS and Email are separate pages today, keep both pages working but present them as one "Campaigns" list with a Channel tab/filter (All · Email · SMS). If merging is risky, keep two child items "Email campaigns" and "SMS campaigns".
- Pages that aren't finished: hide the nav item behind a feature flag. **No "This page is under development" banners.** Fix `/admin/marketing/coupons`, which currently 404s.

---

## 2. Pages, in build order

### 2.1 Home (ref 01)
- Header: "Good morning/afternoon/evening, {first name}" + date line ("Wednesday, 14 October"). Right: date range (secondary), "View store" (secondary, opens the live site in a new tab). Remove "Live Site" pill and "Last updated" chip (put "Updated 2 min ago" in the date picker tooltip).
- Today's brief (AI) strip.
- KPI strip: Revenue · Orders · Sessions · Conversion rate (keep whichever metrics exist today; max 4–5). No icons.
- Row: Revenue chart (flex 2) + **Needs attention** (flex 1): clickable rows with a 6px status dot and chevron — orders to fulfil, failed payments, low stock, returns to review (only those the data supports) — ending with "You're caught up on everything else."
- Row: Top products (mini table: product, units, revenue) + Traffic sources (neutral bars).
- Sales by location: keep; show the map only when there is data, otherwise one compact line.
- Live feed moves to Analytics › Live view (or stays as a compact card at the bottom if removing it is risky).
- Replace the "Insights / Conversion Opportunity" card with Today's brief.

### 2.2 Orders
- Header: "Orders" + count. Right: ghost "Export", primary "Create order". The three unlabelled icon buttons next to "Add New Order" today go into a ghost "More ⌄" menu with text labels.
- Table toolbar Row 1: tabs **New · Ready to ship · Pickup & manifests · In transit · Delivered · RTO · All** (keep today's tabs and their logic) + search "Search orders" + Filter · Sort · Columns.
- Columns: Order (`#1042` mono + date below) · Customer · Payment (badge) · Fulfilment/Shipping (badge) · Items · Total (right). Keep all existing columns.
- Order detail: back link "← Orders"; title "#1042" + payment and fulfilment badges + actions (primary depends on state, e.g. "Mark as shipped"); main column: items, payment summary, shipping; side column: customer, addresses, notes, timeline.

### 2.3 Products · Inventory · Collections · Lookbooks (ref 05)
- **All products:** header "Products 248" · ghost Import · ghost Export · primary "Add product". Tabs All · Active · Draft · Archived + search "Search products" + Filter · Sort · Columns. Columns: Product (thumb, name, SKU) · Status · Inventory ("24 in stock"; "8 left" in warning; "Out of stock" in critical) · Category · Price — plus any existing columns.
- **Product editor:** back link; two columns. Main: title, description (with Write with AI), media, pricing, inventory, variants, SEO (Write with AI). Side: status, organisation (category, collections, tags), shipping profile. Sticky save bar.
- **Inventory:** same table; quantity cells editable inline (number input on click); save bar on change.
- **Collections / Lookbooks:** same table pattern; editors follow the product editor layout. "Failed to load lookbooks" → inline error with Retry.

### 2.4 Customers · Form responses
- All customers: Customer (initials avatar, name, email) · Location · Orders · Total spent (right) · Last order · Tags. Search "Search customers".
- Customer detail: KPI mini-strip (Total spent, Orders, Average order, Customer since), orders table, addresses, notes, marketing consent.
- Form responses (was Form Submissions): table with form name filter tabs; response opens in a drawer.

### 2.5 Marketing
- Campaigns: tabs All · Email · SMS (+ WhatsApp if it exists) or per-channel pages; columns Campaign · Channel · Status · Sent · Opened/Clicked (if available) · Revenue (right) · Sent date. Header: ghost "Templates", primary "Create campaign". Campaign text fields get Write with AI.
- Discounts: Code (mono, copyable) · Type/value · Applies to · Used ("48 / 100") · Ends · Status. Primary "Create discount".

### 2.6 Content
- Blog posts: Post (title + one-line excerpt) · Category · Author · Status · Published (date). Primary "Write a post". Editor gets Write with AI.
- Categories, Tags, Authors (was Writers): simple tables; add/edit in a modal.

### 2.7 Analytics (Overview · Live view · Sales · Behaviour)
- Same layout on each: header + date range; KPI strip (no icons); main chart; side column with one Insight card (AI) and one ranked list.
- Source labels human-readable: "(direct) / (none)" → "Direct", "google / organic" → "Google · organic", "ig / social" → "Instagram".
- Remove "View Report" links unless a report page exists.
- Live view: title "Live view" + green "● Live" text; remove "Learn more" and "Last updated" chip.
- "Top pages by ⌄" style dropdown titles → title + segmented control.
- Skeletons that never resolve (Real-time, Behaviour in the recording) must time out into an empty state or error.

### 2.8 Finance
- Payments: Date · Customer · Order · Method (UPI / Card / COD …) · Gateway · Status · Amount (right, with paise). Search "Search payments". Fix the "Search for product details…" placeholder.
- Payouts / Invoices: same pattern if they exist.

### 2.9 Apps & channels
- Grid of installed apps as a list (icon 32px, name, one line, status badge, "Manage"); available apps below. No coloured icon tiles beyond the app's own logo.

### 2.10 Settings
- **Index:** replace the grid of icon cards with a **grouped list**: group title (13/600 secondary) → card with 52px rows: 16px icon in `--text-secondary` (no tile), title 14/500, description 13px secondary, chevron. Hover `--bg-subtle` only (today Receipts looks permanently selected — fix).
  - Groups (map existing pages): **Store** (Store details, Plan & billing, Domains) · **Store & checkout** (Receipts, Tax, Locations, Shipping & delivery, Payments) · **Team** (Members, Roles) · **Notifications** · **Advanced** (Login history, About).
- **Settings pages:** 720px column, section cards, sticky save bar.
- **Shipping & delivery:** flatten (no cards in cards). Sections: Shipping origin (one row: address + "Default" neutral badge + ghost Edit) · General rates (simple table Zone · Countries · Method · Rate) · Custom profiles (list rows; secondary "Add shipping profile") · Packaging. Remove mono "1 country" chips and arrow buttons. "Cancel" on Create profile becomes ghost, not red.
- **Tax:** radio card ("Prices include tax" / "Add tax at checkout") then Tax rules table with empty state.
- **Members** (was Users): Member (avatar, name, email) · Role (plain text) · Status · Last active. Owner row: lock icon with tooltip. Primary "Invite member". "My Login History" moves to user menu › Login history.
- **Roles:** Role · Description · Permissions ("78 permissions") · Type (System/Custom neutral badge). Primary "Add role".
- **Plan & billing (new home for the old sidebar upsell):** current plan, monthly fee, next payment date, payment method, invoices table, "Change plan" secondary.

### 2.11 Notifications page, 404, errors
- "View all notifications" page: same items as the panel, tabs + date filter.
- 404 renders **inside the app shell**: empty-state pattern, "Page not found", "Go to Home".

---

## 3. Display bugs to fix (seen in the recordings)

1. Comparison label "compared to previous period (Dec 11, 2025)" for 15 Sep – 14 Oct 2026: previous period must be the same length directly before (16 Aug – 14 Sep).
2. "Search for product details…" placeholder on Payments, Users, Roles, SMS/Email campaigns, Posts, Lookbooks.
3. `/admin/marketing/coupons` renders a 404 outside the shell.
4. Notifications grouped under "24 December" with today's times — fix grouping/dates.
5. Toasts show developer wording; "You have logged out!" (see `05-wording.md`).
6. Browser tab title "ZCommerce | Powerful Ecommer…" → "{Page} · {Store name} · Zcommerce".
7. Skeletons that never resolve to empty/error states.
