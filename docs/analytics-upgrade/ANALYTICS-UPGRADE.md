# Zcom Analytics · Level 1 upgrade: structure, names and charts

**For:** Ayush (and Claude Code)
**From:** Mehak, Zerror Studios
**Reviewed:** 11 Nov 2026, live builds:
- Kesar & Kin store admin (Analytics: Insights, Sales, Customers, Traffic, Marketing)
- Super Admin Analytics (Revenue, Stores, AI usage, System)

**Goes with:** round 2 and round 3 files. Their rules (date picker, motion, chart animations, tooltips only where needed) still apply.

---

## 0. What this round is (and isn't)

**This is a cleanup and reorganisation of what we already have.**
- Today the analytics data is good, but it is scattered: Insights repeats almost every other page, behaviour data is hidden three clicks deep under "Traffic › Pages", and many widgets use the same plain bar list whatever the data is.
- This round:
  - restructures the menu into **6 tabs with sub-tabs**;
  - removes the duplicates;
  - gives everything clear names;
  - picks the right chart for each widget.

**Rules for this round:**
1. **Use only data and queries that already exist.** Don't add new tracking, new tables, new integrations or new calculations. If a widget needs data we don't have, leave it out and add it to the **Questions for Anand** list (§9). Anand will do the deeper analytics and AI layer later.
2. **Move, rename, merge, re-chart.** Every widget below says where it comes from today. Nothing that exists today may be lost: if a widget is dropped as a duplicate, its content must live on the page named.
3. **Every analytics page uses one template** (§4), so all six tabs feel like one product.
4. **Keep the URLs working.** Old routes redirect to the new ones (§3.8).

---

## 1. What's there today (inventory)

**Merchant Admin › Analytics** (menu: Insights, Sales, Customers, Traffic, Marketing)

| Page today | Sub-tabs today | Widgets today |
|---|---|---|
| **Insights** | Overview · Sales & profit · Customers · Products & stock · Where sales come from · Marketing return | **Overview:** In short (AI), 4 KPIs with sparklines, Net sales over time, What changed, What to do next, All sales numbers (13). **Sales & profit:** Where the money went (to what you keep), Cost prices, Average order over time, Profit by product, All profit numbers (13). **Customers:** New and returning, Kinds of customer, Do they come back? (cohort), Top customers, All customer numbers (6). **Products & stock:** Best sellers by revenue, by units, Viewed a lot rarely bought, Slowest sellers, Days of stock left, Sold out, All stock numbers (4). **Where:** Top cities, States, Sales by channel, How people paid, All numbers (5). **Marketing return:** Sales by discount code, Recent campaigns, All marketing numbers (7) |
| **Sales** | (none) | KPI panel (Gross, Discounts, Refunds, Net), Where the money went (gross to net), How people paid, Sales by category, Best hours, Products table (Top selling · Best converting · Looked, didn't buy), Sales by source, Sales by billing country |
| **Customers** | (none) | New and returning, Came back to buy again, Top customers, Where they live |
| **Traffic** | Visitors · Funnel · Pages · Events · Forms | **Visitors:** KPIs, From visit to order, Where visitors come from (Source / Category / Source·medium), Devices, Landing pages, Sessions over time, Growth insight, New vs returning visitors, Sessions by day (Day/Hour), Sessions by location. **Funnel:** Where shoppers leave (GA funnel), Why checkouts fail, Conversion by device, Conversion by channel. **Pages:** How visitors move through your store, Top pages (Visits/Clicks/Time/Exits), Top clicks, Time on site, Where visitors leave (Exit score/Exit rate), Pages list. **Events:** Events list. **Forms:** Form submissions, Leads (Traffic sources/Locations) |
| **Marketing** (route `/analytics/campaigns`) | (none) | Back for every ₹1 on marketing, Sales by where shoppers came from, Campaign results, Codes used most, Orders by UTM |

**Super Admin › Analytics** (menu: Revenue, Stores, AI usage, System)
- **Revenue:** subscription revenue, collected, monthly billing, open invoices; empty state.
- **Stores:** totals by currency, Needs a look, Stores by sales; 7/30/90 day pills.
- **AI usage**
- **System:** GMV, orders, sessions, conversion; trend; top stores by GMV and by growth; 7/30/90 day pills. Mislabelled: it's store performance, not system health.

**Main problems:**

| # | Problem | Example |
|---|---|---|
| P1 | **Duplicates.** Insights' five sub-tabs repeat the other pages, sometimes in a different version | "Where the money went" (Sales vs Insights › Sales & profit); "How people paid" (Sales vs Insights › Where); "Top customers" (Customers vs Insights › Customers); "Came back to buy again" vs "Do they come back?"; "Where they live" vs "Top cities"; "Looked, didn't buy" vs "Viewed a lot, rarely bought"; Marketing page vs Insights › Marketing return |
| P2 | **Behaviour is hidden.** Journeys, top pages, time on site, exits and clicks exist, but only on Traffic › Pages | `01-behaviour-hidden.jpg` |
| P3 | **Wrong or bare names.** "Traffic" for behaviour; Marketing lives at `/campaigns`; counts glued to titles ("Pages55", "Events20"); raw event names (`cta_click`); raw paths (`/products/aarzoo-v-neck-long-kurti`) | `01`, `02` |
| P4 | **One chart for everything.** Most widgets are the same horizontal bar list, including money flows, shares, journeys and time patterns | §5 |
| P5 | **Too long.** Top pages lists 55+ rows; Events and Pages lists have no limit | `02-pages-list.jpg` |
| P6 | **Bugs.** "How visitors move through your store" shows "No visits in this period" while the page shows 16,218 visitors. Super Admin "System" shows ₹0 and leaves out Kesar & Kin | `01`, `05` |
| P7 | **Inconsistent period controls.** Store pages use the date picker; Super Admin Stores and System use 7/30/90 pills | `05` |

---

## 2. The new structure: 6 tabs

```
Analytics
├── Insights        (the AI summary of everything; landing page)
├── Sales           Overview · Products · Profit · Payments & channels · Locations
├── Customers       Overview · Retention · Top customers · Locations
├── Behaviour       Overview · Sources · Journey · Pages · Clicks & forms
├── Marketing       Overview · Campaigns · Discount codes · UTM links
└── Inventory       (one page)
```

**Why these six:**
- **Insights** stays as the front door. It's the short AI summary across the store, so its old sub-tabs move into the tabs they repeat.
- **Sales, Customers and Marketing** keep their names: owners know them.
- **Behaviour** replaces "Traffic". It's about how people move, where they leave and how long they stay, not just how many came.
- **Inventory** gathers stock health that was buried in Insights.
- **Profit** sits inside Sales for now: we have cost prices and per-product profit, but not fixed costs (rent, salaries), so it isn't a full Profit & Loss yet. When Anand adds that later, it can become its own top-level "Profit & loss" tab.

**Menu order:** Insights, Sales, Customers, Behaviour, Marketing, Inventory. The **Analytics** menu item opens Insights.

---

## 3. Every tab, sub-tab and widget

Each widget row has these columns:
- **From today:** where the widget comes from today.
- **Chart:** the chart to use (rules in §5).
- **Notes:** anything else.

All data is existing.

### 3.1 Insights `/analytics/insights` (one page, no sub-tabs)
The AI summary for the whole store. Short: one screen and a half at most.

| Widget | From today | Chart | Notes |
|---|---|---|---|
| In short | Insights › Overview | AI card, 3 lines with links | Each line links to the tab it talks about (e.g. "→ Sales › Profit") |
| KPI row: Net sales · Orders · Average order · Repeat rate | Insights › Overview | KPI tiles + sparkline | Same as today |
| Net sales over time | Insights › Overview | Line + dashed compare line | Same; round 3 animation and chart labels |
| What changed | Insights › Overview | **Diverging bar** (up = blue right, down = red left) | Today only shows rises; show falls too if the query returns them |
| What to do next | Insights › Overview | Action cards (icon, sentence, button) | Same |
| **Explore** cards | New layout only (no new data) | 5 small cards: Sales, Customers, Behaviour, Marketing, Inventory | Each card shows one headline number that already exists on that tab and opens it |
| ~~All sales numbers (13)~~ | Insights › Overview | Moves to Sales › Overview as "All numbers" | |

### 3.2 Sales `/analytics/sales`
Page header subtitle: "What sold, how people paid and what you keep."

**Overview**

| Widget | From today | Chart | Notes |
|---|---|---|---|
| KPI panel: Gross · Discounts · Refunds · Net sales | Sales | Summary panel (4 tiles) | Same |
| Sales over time with a **Sales / Orders / Average order** switch | Insights › Overview (net sales line) + Insights › Sales & profit (average order over time) | Line + compare | One chart with a segmented switch instead of two charts |
| From gross to net | Sales "Where the money went" | **Waterfall** (Gross → − discounts → − other deductions → − refunds → Net) | Replaces the bar list |
| Best hours | Sales | Column chart, peak labelled | If the query can also group by weekday, use a **day × hour heatmap**; if not, keep columns |
| All sales numbers | Insights › Overview "All sales numbers (13)" | Compact table, collapsed under "Show all" | |

**Products**

| Widget | From today | Chart | Notes |
|---|---|---|---|
| Products table: Top selling · Best converting · Looked, didn't buy | Sales | Table with thumbnails | Merge "Viewed a lot, rarely bought" (Insights › Products) into "Looked, didn't buy". One version |
| Sales by category | Sales | **Treemap** (box size = sales, label = category + ₹ + share) | Replaces the bar list; a treemap shows share better when there are 5+ categories |
| Best sellers: by revenue / by units | Insights › Products & stock (2 lists) | One horizontal bar chart with a **Revenue / Units** switch | Fix the swapped units/revenue bug if it's still there |
| Products that sell least | Insights › Products "Slowest sellers" | Horizontal bars, top 10 | |
| **Interest vs sales** | Same data as "Looked, didn't buy" (views + orders per product) | **Scatter**: x = views, y = conversion rate, dot = product. Quadrant labels: "Stars" (high/high), "Hidden gems" (few views, converts well), "Fix the page" (many views, few orders) | Only if per-product views and orders are already in that query (they are, in the table); otherwise skip |

**Profit**

| Widget | From today | Chart | Notes |
|---|---|---|---|
| What you keep | Insights › Sales & profit "Where the money went" (to what you keep) | **Waterfall** (Net sales → − cost of goods → − shipping, packaging, fees → **Profit**) | Show the profit bar in green, costs in grey |
| Profit by product | Insights › Sales & profit | Horizontal bars (profit ₹ and margin %), loss-making in red | |
| Cost prices filled in | Insights › Sales & profit "Cost prices" | **Progress ring** ("Cost prices for 21 of 52 products") + "Add cost prices" button | |
| All profit numbers | Insights › Sales & profit (13) | Compact table under "Show all" | |

**Payments & channels**

| Widget | From today | Chart | Notes |
|---|---|---|---|
| How people paid | Sales + Insights › Where (one version) | **Donut** (≤5 parts, else top 4 + Other) | Data is by payment app today; keep the sentence "Split by UPI, card or COD coming soon" until Anand adds it |
| Sales by channel / source | Insights › Where "Sales by channel" + Sales "Sales by source" (Storefront, admin, marketplace) | Donut or 100% bar | One widget |
| Refunds | Sales KPI panel (refund total) | KPI + small line of refunds over time if the query has dates; else KPI only | |

**Locations**

| Widget | From today | Chart | Notes |
|---|---|---|---|
| Sales by city | Insights › Where "Top cities" + Overview map | **India map** with bubbles + top 10 bars beside it | Reuse the existing map component |
| States | Insights › Where "States" | Table with an inline share bar | |
| Countries | Sales "Sales by billing country" | Bars; hide the card when only one country | |

### 3.3 Customers `/analytics/customers`
Subtitle: "Who buys, who comes back and where they live."

| Sub-tab | Widgets (from today) | Chart |
|---|---|---|
| **Overview** | KPI panel: Customers · New · Returning · Worth per customer (Insights › Customers KPIs). New and returning (Customers + Insights › Customers, one version). Kinds of customer (Insights › Customers) | KPIs; **stacked bar** over time if weekly data exists, else a **donut** (2 parts); Kinds of customer as **segment cards** (count, ₹, share bar), each linking to that group in Customers |
| **Retention** | Do they come back? (Insights › Customers cohort) merged with Came back to buy again (Customers) | **Cohort heatmap** (rows = month of first order, columns = months later, cell colour = % who came back) + a one-line summary above it |
| **Top customers** | Top customers (Customers + Insights › Customers, one version) | Table: name, city, orders, spent, last order, group chip |
| **Locations** | Where they live (Customers) | Map + bars (same component as Sales › Locations) |

### 3.4 Behaviour `/analytics/behaviour` (renamed from Traffic)
Subtitle: "How people find your store, move through it, and where they leave."
- All data on this tab comes from Google Analytics. Show the GA sync banner when the data is stale (it exists).
- Every card carries a small "Google Analytics" source chip.

**Overview**

| Widget | From today | Chart | Notes |
|---|---|---|---|
| KPI panel: Visitors · Visits · Left after one page · Conversion | Traffic › Visitors | Summary panel | Same |
| Time on site | Traffic › Pages "Time on site" | KPI tile with the AI sentence | Move up here; it's a headline behaviour number |
| Visits over time | Traffic › Visitors "Sessions over time" | Line + compare | Rename "Sessions" → "Visits" everywhere in UI copy |
| New vs returning visitors | Traffic › Visitors | Donut (2 parts) or stacked bars over time | |
| Devices | Traffic › Visitors | Donut | Same |
| When people visit | Traffic › Visitors "Sessions by day" (Day / Hour) | **Day × hour heatmap** if both dimensions come together; otherwise columns with the Day / Hour switch as today | |
| Visits by location | Traffic › Visitors "Sessions by location" | Map + bars (shared component) | |

**Sources**

| Widget | From today | Chart | Notes |
|---|---|---|---|
| Where visitors come from | Traffic › Visitors (Source / Category / Source·medium) | Horizontal bars with the switch | Same data |
| Sources that sell | Marketing "Sales by where shoppers came from" (Source, Visitors, Visits, Conversions, Conv. rate, Sales) + Traffic › Funnel "Conversion by channel" | **One table**: Source · Visitors · Conversion rate · Sales, with an inline bar on Sales | Removes two near-duplicates; Marketing › Overview links here |
| Landing pages | Traffic › Visitors | Table: page title + type chip · Visits · Conversion | Top 10 + Show all |

**Journey**

| Widget | From today | Chart | Notes |
|---|---|---|---|
| From visit to order | Traffic › Visitors "From visit to order" + Traffic › Funnel "Where shoppers leave" | **Funnel** (one version: the Funnel tab's step list with "% continued" and red "left here") | Keep the segment select ("No segment"). Remove the duplicate on Overview |
| How visitors move through your store | Traffic › Pages | **Sankey / flow diagram**: entry page → 2nd page → 3rd page → exit or purchase, top paths only | **Bug:** shows "No visits in this period" though data exists; fix the query or hide the card until fixed |
| Why checkouts fail | Traffic › Funnel | Horizontal bars with reason + gateway chip | Same |
| Conversion by device | Traffic › Funnel | Small table or grouped bars | |

**Pages**

| Widget | From today | Chart | Notes |
|---|---|---|---|
| Top pages | Traffic › Pages (Visits / Clicks / Time / Exits toggles) + "Pages55" list | **One table**: Page (title + type chip) · Views · Avg time · Exit rate, with an inline bar on Views; sortable columns instead of toggles | Top 10, "Show all" opens a paginated list (25 per page). Merge the separate "Pages" list into it |
| Where visitors leave | Traffic › Pages (Exit score / Exit rate) | Horizontal bars: page title + exit rate, red bar for rates above the store average | Top 10 |
| Pages by type | Same Top pages data grouped by the type chip | **Treemap** (Product, Collection, Category, Blog, Cart, Checkout, Home) | Grouping on the front end only; no new query |

**Clicks & forms**

| Widget | From today | Chart | Notes |
|---|---|---|---|
| Top clicks | Traffic › Pages "Top clicks" | Horizontal bars with **friendly names** (§6) | |
| Events | Traffic › Events | Table with friendly names, count, change | Title without the glued count ("Events" + count chip) |
| Form submissions and leads | Traffic › Forms (Form submissions, Leads, Traffic sources, Locations) | KPI + bars by source | Hide the sub-tab content if the store has no forms |

### 3.5 Marketing `/analytics/marketing` (route renamed from `/campaigns`)
Subtitle: "What your campaigns and codes brought in."

| Sub-tab | Widgets (from today) | Chart |
|---|---|---|
| **Overview** | Back for every ₹1 on marketing (Marketing; uses the spend the owner entered). KPI panel: Marketing spend · Sales from campaigns · Orders with a code · Return per ₹1 (only figures already computed on this page or Insights › Marketing return). Link card "Which sources sell → Behaviour › Sources" | Big number + sentence; KPI tiles |
| **Campaigns** | Campaign results (Marketing) + Recent campaigns (Insights › Marketing return), one table | Table: campaign, channel icon, sent, opened, orders, sales; inline bar on sales |
| **Discount codes** | Codes used most (Marketing) + Sales by discount code (Insights › Marketing return), one widget | Horizontal bars (sales per code) with a table toggle (uses, discount given, sales) |
| **UTM links** | Orders by UTM (Marketing) | Table: campaign · orders · revenue, inline bar |

"All marketing and discount numbers (7)" from Insights goes under "Show all" on Overview.

### 3.6 Inventory `/analytics/inventory` (one page)
Subtitle: "What's selling out, what's sitting still."

| Widget | From today | Chart | Notes |
|---|---|---|---|
| KPI panel: Live products · Sold out variants · Running low · Stock numbers | Insights › Products & stock "All stock numbers (4)" + Products page summary | Summary panel | Use the 4 existing stock numbers |
| Days of stock left | Insights › Products & stock | Horizontal bars, with a vertical marker at 14 days; bars under 7 days in red | |
| Sold out | Insights › Products & stock | Table: variant, sold out since, views in the period if available | Link each row to the product |
| Not moving | Insights › Products "Slowest sellers" | Horizontal bars | The same list as Sales › Products "Products that sell least"; one query, shown in both places with a link |
| Link | | "Manage stock → Catalogue › Inventory" | |

### 3.7 Super Admin › Analytics
New menu: **Revenue · Stores · AI usage** (3 items).
- **Revenue:** as today (Zcom's own earnings). Keep the empty state.
- **Stores:**
  - Merge today's **Stores** and **System** pages, since both are store performance.
  - Sub-tabs **Overview** (KPIs: GMV, orders, visits, conversion; trend) · **Top stores** (by GMV, by growth) · **Needs a look**.
  - Keep "Totals by currency" only when there's more than one currency.
  - **Bug:** shows ₹0 and leaves out Kesar & Kin (`05-sa-system.jpg`). Check whether demo stores are excluded on purpose; if so, say so in the subtitle.
- **AI usage:** as today; use the same `<AiQuota>` styling from round 3.
- **Remove** the "System" analytics item; platform health already has its own "System health" menu item.
- **Date control:** the shared date picker replaces the 7/30/90 pills everywhere.

### 3.8 Redirects

| Old | New |
|---|---|
| `/analytics/insights?section=sales` | `/analytics/sales?tab=profit` |
| `?section=customers` | `/analytics/customers` |
| `?section=products` | `/analytics/sales?tab=products` (stock parts → `/analytics/inventory`) |
| `?section=where` | `/analytics/sales?tab=locations` |
| `?section=marketing` | `/analytics/marketing` |
| `/analytics/traffic` (any `?section`) | `/analytics/behaviour` (same sub-tab; `funnel` → `journey`, `events`/`forms` → `clicks`) |
| `/analytics/campaigns` | `/analytics/marketing` |
| SA `/analytics/performance` | SA `/analytics/store-sales` (Overview) |

Ask Zcom AI links and "In short" links must use the new URLs.

---

## 4. One page template for every analytics tab

```
┌ Title "Analytics · Sales"        [date picker] [compare] [⋯ Export]
│ Subtitle (one line)
├ [GA sync banner, only when stale]
├ AI "In short" strip: 2–3 lines about THIS tab, with links
├ Summary panel: 4 KPI tiles (the existing blue panel)
├ Sub-tabs (sticky under the title on scroll)
└ Sections: cards in a 12-column grid
```

- **In short strip on every tab:** reuse the existing Insights "In short" component, scoped to the tab's existing numbers. If the AI endpoint can only summarise the whole store today, show it only on Insights and list it for Anand (§9).
- **Card header:** title (no glued counts; counts go in a grey chip), one-line subtitle, a small source chip ("Your orders" or "Google Analytics") on the right.
- **Lists:** top 10 by default, "Show all" opens a paginated table (25 per page) in the same card or an `lg` dialog.
- **Grid:**
  - Charts that read over time: full width.
  - Comparison charts: half width.
  - Tables: full width.
  - No orphan cards on a row (round 2 G8).
- **Empty and low-data states:** use the round 3 wording ("Not enough data yet…"), never a blank card, and never "No visits" when the KPI shows visits.
- **Period:** one shared date picker and compare control on every analytics page, store and Super Admin.
- **Sub-tab memory:** the URL keeps `?tab=`; the page always opens at the top (round 3 D1).
- **Export:** the ⋯ menu offers "Download CSV" for each table, only where a CSV export already exists.

---

## 5. Which chart for which data

| Data shape | Use | Don't use | Where it's used |
|---|---|---|---|
| A number over time | **Line** (+ dashed grey compare line) | Bars for 30+ days | Sales over time, Visits over time |
| Share of a whole, 2–5 parts | **Donut** with the total in the middle | Pie with 6+ slices, 3D | Payments, devices, new vs returning |
| Share of a whole, 6+ parts | **Treemap** | Donut | Sales by category, pages by type |
| Ranking | **Horizontal bars**, sorted, top 10, label left, value right | Vertical bars with long labels | Best sellers, sources, clicks, exits |
| Money flowing from one total to another | **Waterfall** | Bar list | Gross to net, what you keep |
| Steps where people drop off | **Funnel** (step list with % continued and "left here") | Pie | Journey |
| Paths through pages | **Sankey / flow** | Long tables | How visitors move |
| Two dimensions over a grid | **Heatmap** | Many small charts | Cohort retention, day × hour |
| Places | **Map with bubbles** + top 10 bars | Map alone (hard to compare) | Cities, visits by location |
| Two measures per item | **Scatter with quadrants** | Two separate lists | Interest vs sales |
| Increase vs decrease | **Diverging bars** | Two lists | What changed |
| Progress to a goal | **Ring** | Bar | Cost prices filled in |
| Detail with 4+ columns | **Table** with inline bars on the key column | Chart | Top pages, campaigns, states |

**Chart style (one theme file):**
- **Colours:**
  - Brand blue `#1F5EFF` for the main series; grey `#C9CDD6` for compare and "other".
  - Green only for profit or good, red only for loss, drop or "left here".
  - Treemap and donut parts use the blue scale `#1F5EFF → #6E92FF → #A9C0FF → #D6E2FF`, then grey for Other.
  - The AI gradient is for AI text only.
- **Text and shapes:** gridlines `#EEF0F3`; axis labels 11px Geist Mono `#8A8F9A`; bar radius 4px.
- **Values:**
  - Values on bars instead of an axis when there are 10 or fewer bars.
  - Money in full Indian grouping (₹1,68,185), no "L"/"K" except on chart axes.
- **Interaction:** tooltips only where the exact value isn't printed (round 3 D2); hover animations elsewhere.

---

## 6. Names and copy

**Rename:**

| Today | New |
|---|---|
| Traffic | Behaviour |
| Sessions | Visits |
| Analytics · Marketing at `/campaigns` | Analytics · Marketing at `/marketing` |
| Pages55, Events20 | "Pages" + chip "55" |
| Insights › Marketing return | Marketing |
| Viewed a lot, rarely bought / Looked, didn't buy | Looked, didn't buy |
| Do they come back? / Came back to buy again | Do they come back? |
| Slowest sellers | Products that sell least (Sales) · Not moving (Inventory) |
| Super Admin "System" (analytics) | merged into "Stores" |

**Friendly labels for Google Analytics data:** a small map in code (§8.3). Unknown names fall back to a cleaned version ("hero_banner_click" → "Hero banner click").
- **Events:** `cta_click` → "Clicked a button", `lookbook_hotspot_click` → "Tapped a lookbook tag", `add_to_cart` → "Added to cart", `begin_checkout` → "Started checkout", `view_item` → "Viewed a product", `view_search_results` → "Searched the store", `generate_lead` → "Sent a form".
- **Page paths:** show the page **title** (from the catalogue or blog record when the path matches a product, collection, category or post) with a **type chip** (Product, Collection, Category, Blog, Cart, Checkout, Home, Other). The raw path goes in a smaller grey line under it, linking to the live page.

---

## 7. The AI (Ask Zcom) in this round
No new AI work this round, only two small steps that make Anand's later AI layer easier:
1. **Widget IDs:** give every analytics widget a stable `id` (e.g. `sales.profit.what_you_keep`) and register it in one `analytics-widgets.ts` list. Each entry has: title, tab, sub-tab, query name, chart type and one-line definition (§8.1).
2. **AI links:** when the AI answer mentions a widget, link to it with `?tab=` and an anchor (`#sales.profit.what_you_keep`), so "Show me" opens the right card.

---

## 8. Code to start from

### 8.1 Navigation and widget registry
```ts
// analytics-nav.ts
export const ANALYTICS_NAV = [
  { key: "insights", label: "Insights", path: "/analytics/insights", tabs: [] },
  { key: "sales", label: "Sales", path: "/analytics/sales",
    tabs: [["overview","Overview"],["products","Products"],["profit","Profit"],["payments","Payments & channels"],["locations","Locations"]] },
  { key: "customers", label: "Customers", path: "/analytics/customers",
    tabs: [["overview","Overview"],["retention","Retention"],["top","Top customers"],["locations","Locations"]] },
  { key: "behaviour", label: "Behaviour", path: "/analytics/behaviour",
    tabs: [["overview","Overview"],["sources","Sources"],["journey","Journey"],["pages","Pages"],["clicks","Clicks & forms"]] },
  { key: "marketing", label: "Marketing", path: "/analytics/marketing",
    tabs: [["overview","Overview"],["campaigns","Campaigns"],["codes","Discount codes"],["utm","UTM links"]] },
  { key: "inventory", label: "Inventory", path: "/analytics/inventory", tabs: [] },
] as const;

export const REDIRECTS: Record<string, string> = {
  "/analytics/insights?section=sales": "/analytics/sales?tab=profit",
  "/analytics/insights?section=customers": "/analytics/customers",
  "/analytics/insights?section=products": "/analytics/sales?tab=products",
  "/analytics/insights?section=where": "/analytics/sales?tab=locations",
  "/analytics/insights?section=marketing": "/analytics/marketing",
  "/analytics/traffic": "/analytics/behaviour",
  "/analytics/traffic?section=funnel": "/analytics/behaviour?tab=journey",
  "/analytics/traffic?section=pages": "/analytics/behaviour?tab=pages",
  "/analytics/traffic?section=events": "/analytics/behaviour?tab=clicks",
  "/analytics/traffic?section=forms": "/analytics/behaviour?tab=clicks",
  "/analytics/campaigns": "/analytics/marketing",
};
```
```ts
// analytics-widgets.ts: one entry per widget (fill in the existing query names)
export type ChartKind = "line"|"donut"|"treemap"|"bars"|"waterfall"|"funnel"|"sankey"|"heatmap"|"map"|"scatter"|"diverging"|"ring"|"table"|"kpi";
export type Widget = { id: string; tab: string; sub?: string; title: string; subtitle: string;
  source: "orders" | "ga"; query: string; chart: ChartKind; definition: string; span: 6 | 12 };

export const WIDGETS: Widget[] = [
  { id: "sales.overview.trend", tab: "sales", sub: "overview", title: "Sales over time", subtitle: "Each day, against the period before",
    source: "orders", query: "<existing net sales series query>", chart: "line", definition: "Net sales = gross − discounts − refunds, paid orders, store time zone", span: 12 },
  { id: "sales.overview.gross_to_net", tab: "sales", sub: "overview", title: "From gross to net", subtitle: "What discounts and refunds took",
    source: "orders", query: "<existing 'Where the money went' (Sales) query>", chart: "waterfall", definition: "…", span: 6 },
  { id: "sales.products.categories", tab: "sales", sub: "products", title: "Sales by category", subtitle: "Share of net sales",
    source: "orders", query: "<existing sales by category query>", chart: "treemap", definition: "…", span: 6 },
  { id: "sales.profit.what_you_keep", tab: "sales", sub: "profit", title: "What you keep", subtitle: "After product cost, shipping, packaging and fees",
    source: "orders", query: "<existing Insights 'Where the money went' query>", chart: "waterfall", definition: "…", span: 12 },
  { id: "behaviour.journey.funnel", tab: "behaviour", sub: "journey", title: "From visit to order", subtitle: "Where shoppers leave",
    source: "ga", query: "<existing GA funnel query>", chart: "funnel", definition: "…", span: 12 },
  { id: "behaviour.journey.paths", tab: "behaviour", sub: "journey", title: "How visitors move through your store", subtitle: "Top paths from the first page",
    source: "ga", query: "<existing path exploration query>", chart: "sankey", definition: "…", span: 12 },
  // …every widget in §3
];
```
Pages render their sections from `WIDGETS.filter(w => w.tab === key && w.sub === tab)`. Adding or moving a widget then needs no page code.

### 8.2 Page template
```tsx
export function AnalyticsPage({ navKey }: { navKey: keyof typeof byKey }) {
  const nav = byKey[navKey];
  const [tab, setTab] = useUrlTab(nav.tabs[0]?.[0]);          // ?tab=, resets scroll (round 3 D1)
  const widgets = WIDGETS.filter(w => w.tab === nav.key && (!nav.tabs.length || w.sub === tab));
  return (
    <Page title={`Analytics · ${nav.label}`} subtitle={SUBTITLES[nav.key]} actions={<><DateRangePicker /><CompareToggle /><MoreMenu /></>}>
      {widgets.some(w => w.source === "ga") && <GaSyncBanner />}
      <InShort scope={nav.key} />                               {/* existing component */}
      <SummaryPanel scope={nav.key} />                          {/* existing blue KPI panel */}
      {nav.tabs.length > 0 && <StickyTabs items={nav.tabs} value={tab} onChange={setTab} />}
      <Grid>{widgets.map(w => <WidgetCard key={w.id} widget={w} />)}</Grid>
    </Page>
  );
}
```

### 8.3 Friendly names for GA data
```ts
const EVENT_LABELS: Record<string, string> = {
  cta_click: "Clicked a button", lookbook_hotspot_click: "Tapped a lookbook tag", add_to_cart: "Added to cart",
  remove_from_cart: "Removed from cart", begin_checkout: "Started checkout", add_shipping_info: "Added shipping",
  add_payment_info: "Added payment", purchase: "Bought", view_item: "Viewed a product", view_item_list: "Viewed a list",
  view_search_results: "Searched the store", generate_lead: "Sent a form", sign_up: "Signed up", login: "Logged in",
  page_view: "Viewed a page", scroll: "Scrolled to the end", session_start: "Started a visit", first_visit: "First visit",
};
export const eventLabel = (e: string) =>
  EVENT_LABELS[e] ?? e.replace(/[_-]+/g, " ").replace(/^\w/, c => c.toUpperCase());

export function pageInfo(path: string, catalogue: { products: Map<string,string>; collections: Map<string,string>; categories: Map<string,string>; posts: Map<string,string> }) {
  const [, kind, slug] = path.split("/");
  if (path === "/" ) return { title: "Home", type: "Home" };
  if (kind === "products") return { title: catalogue.products.get(slug) ?? slug, type: "Product" };
  if (kind === "collections") return { title: catalogue.collections.get(slug) ?? slug, type: "Collection" };
  if (kind === "category") return { title: catalogue.categories.get(slug) ?? slug, type: "Category" };
  if (kind === "blogs" || kind === "blog") return { title: catalogue.posts.get(slug) ?? slug, type: "Blog" };
  if (kind === "cart") return { title: "Cart", type: "Cart" };
  if (kind === "checkout") return { title: "Checkout", type: "Checkout" };
  return { title: path, type: "Other" };
}
```
The catalogue maps come from data the admin already loads (product, collection, category and post slugs → titles). No new API needed if it's cached; otherwise use one small existing list query.

### 8.4 Chart picks (use the existing chart library)
- **Waterfall:** a bar chart with invisible base bars (`stackId`) or the library's waterfall type.
- **Treemap and Sankey:** use the library's treemap/sankey if it has them. If not, `d3-hierarchy` (treemap) and `d3-sankey` are small and well-known. Ask Anand before adding a dependency.
- **Heatmap:** a CSS grid of cells (no library).
- **Funnel:** the existing step list.
- Charts animate in per round 3 D2.

---

## 9. Questions for Anand (needs new data or logic: not in this round)
Ayush builds everything above with existing data. These are for Anand to answer and plan for the deeper analytics and AI layer later. Ayush: please copy this list into the final report with anything you found while building.

1. **Payments:** can we split payments by method (UPI, card, net banking, wallet, COD) from Cashfree/Razorpay data, not just by payment app?
2. **Behaviour depth:** GA4 gives pages, events, exits and time. Do we want heatmaps, scroll depth beyond GA4's 90% event, and session recordings (e.g. Microsoft Clarity)? Do we keep GA4 as the only source?
3. **GA4 reliability:** the sync stopped on 10 Nov on Kesar & Kin. How often does it sync, and how do we alert the store?
4. **Path exploration:** why is "How visitors move through your store" empty while visits exist?
5. **Site search:** are `view_search_results` / search terms tracked? If yes, a "What people search for" (and searches with no results) widget is easy.
6. **Profit & loss:** do we want fixed monthly costs (rent, salaries, tools) per store, so we can show a full P&L, burn rate and runway? Where would owners enter them?
7. **Unit economics:** CAC, LTV, LTV:CAC, contribution margins (CM1/CM2/CM3), payback period. Which inputs exist (marketing spend is entered manually today; ad platforms aren't connected)?
8. **Churn:** how do we define a churned customer (e.g. no order in 90 days), and should owners set it?
9. **Returns and RTO:** can Shiprocket data give RTO rate by pincode, courier and COD, and return reasons?
10. **In short per tab:** can the AI summary endpoint summarise one tab's numbers, or only the whole store?
11. **Best hours:** can the query group by weekday as well as hour (for the day × hour heatmap)?
12. **Super Admin Stores/System:** why do stores show ₹0 GMV and "Not connected", and are demo stores excluded on purpose?
13. **Metrics dictionary:** can the existing queries feed one shared definitions list that Ask Zcom also uses, so AI answers always match the charts?

---

## 10. Phases and prompts

| Phase | Scope | Done when |
|---|---|---|
| A1 · Structure | Nav (§2), routes and redirects (§3.8), page template (§4), widget registry (§8.1); move every widget to its new place with its current chart | Every old widget is reachable in its new place; no duplicates; old links redirect |
| A2 · Charts | Re-chart per §3 and §5 (waterfall, treemap, donut, heatmap, Sankey, scatter, diverging bars), chart theme, top 10 + Show all | Screenshots of every sub-tab |
| A3 · Names and copy | §6 renames, friendly GA labels, page titles with type chips, subtitles, source chips | No raw event names or raw paths as main labels |
| A4 · Super Admin | §3.7 | Revenue · Stores · AI usage; shared date picker |
| A5 · QA | Bugs P6, empty states, round 3 animation rules, phone layout (390px), §9 questions in the report | FINAL-REPORT.md |

**Kickoff:**
```
You are doing a Level 1 upgrade of Zcom Analytics: reorganise, rename and re-chart what already exists. Do NOT add new tracking, new data, new tables or new integrations.
Read docs/analytics-upgrade/ANALYTICS-UPGRADE.md fully (and docs/review-r3/ROUND-3-FIXES.md for motion and tooltip rules). Look at docs/analytics-upgrade/screenshots/.
First, map every widget listed in §1 to its file, component and query, and confirm each one has a home in §3 (write the table to docs/analytics-upgrade/progress.md).
Then work through phases A1 to A5 in §10 in order without stopping. If a widget in §3 needs data that the existing query doesn't return, keep its current chart, note it in progress.md and add it to the §9 questions. Commit after each phase.
When done, write docs/analytics-upgrade/FINAL-REPORT.md: what moved where, screenshots of every tab and sub-tab (1440px and 390px), the §9 questions with anything you learned, and anything you couldn't do.
```

**Resume:**
```
Resume the Zcom Analytics Level 1 upgrade. Read docs/analytics-upgrade/ANALYTICS-UPGRADE.md and docs/analytics-upgrade/progress.md, check the latest commits, and continue from the next unfinished item. Same rules: existing data only.
```
