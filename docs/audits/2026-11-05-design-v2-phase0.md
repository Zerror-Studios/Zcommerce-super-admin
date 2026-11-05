# Design v2, Phase 0 audit (both apps)

Date: 5 Nov 2026. Spec: `docs/design-v2/README.md`. Read-only audit: no code was changed. Part A covers the Merchant Admin (`Zcomm-frontend`) and Part B the Super Admin (`zcommerce-super-admin`). This file is identical in both repos.

## Summary

**Where we start.** Both apps already carry the 30 Oct handover pass, so these v2 rules are already true: no desktop top bar, pill buttons and segmented tabs, a flat menu with no group headings, one floating Ask bar with ⌘J, and a filter drawer on list pages. The work is therefore mostly:

1. **Tokens (Phase 1).**
   - Font back to Geist (the Geist Sans files are missing today; the app runs on Inter).
   - Page background #EBECF0, ink #0B0C10.
   - Radius 22 / 18 for cards, small cards and the summary panel.
   - Pop-ups 420/640/960, sidebar 240, table header #FAFAFB.
   - One blue AI gradient replaces the blue-violet-pink-orange spectrum.
   - Retire the section colours, channel colours, gradient avatars and glass blur.
   - Red notification count.
2. **Shared components (Phase 2).**
   - The shared `DataTable` draws its tabs and search inside the table card on about 29 merchant and 14 Super Admin tables. Moving the toolbar above the card in the shared component fixes all of them.
   - New pieces: the summary panel with collapse, the orb glyph and its states, the AI card and AI line, the SEO ring, the wallet capsule, the view switch and the ⋯ title menu.
3. **Shell (Phase 3).**
   - New menu order and names in both apps.
   - Remove the ⌘K "Ask Zcom AI" row and the `TodaysBrief` "Ask AI" button.
   - The Ask bar becomes the half-height sheet, then the full view.
   - Below 1024px the black top bar becomes the 72px icon rail (Phase 9).
4. **Pages (Phases 5–6).**
   - Export/Import move into ⋯ on Orders, Payments, Products, Inventory, Customers, Reviews, Subscribers, Analytics and the Super Admin Subscriptions, Analytics, ZCOM AI and Stores pages.
   - Column order and tab changes as listed in §1A.
5. **Biggest structural gaps.**
   - **Merchant Inbox:** today it is three tables (form messages, reviews, restock), not a chat. The backend has a conversations API that the frontend doesn't use yet.
   - **Super Admin Support and System health:** no route, page or data exists for either.
   - **Super Admin store page:** an 11-section two-pane card today vs 7 tabs in v2.

**Backend gaps (§9 and data the boards show; nothing started, needs the go-ahead):**
- Shiprocket daily spend, days left and auto-recharge (only the balance exists).
- An abandoned checkouts list (sessions are auto-deleted today).
- Rule-based customer groups (segments are fixed ID lists today).
- A stored SEO score (only computed in the browser on Categories, Tags and Authors).
- The official India map asset.
- Products Sold · 30d, Revenue · 30d and Sells on; Lookbook views and shop taps; Collection visits; Blog reads; item photos on the Orders list.
- In the Super Admin: uptime and incidents, tickets and announcements, store team, per-store apps and suggestions, AI action ratings.

Until a backend exists, these pieces are built in the UI behind feature flags and stay hidden.

**Tooling found.**
- `lint:hex` reports 0 in both apps but skips the token files.
- `lint:px` reports 61 of the 99 allowed in the merchant app.
- The SYNCED-file check points at old folder names (`../zcom-frontend`, `../zcom-super-admin`), so it silently passes. Two files already differ (`RankedBars.tsx`, `SupportBanner.tsx`). This is fixed in Phase 1.

## Decisions (5 Nov 2026)

Ayush asked for the recommended answers, so every proposal below (questions 1–18) is now the decision, as built in Phases 5–8. Mehak can still change any of them; each one is a small UI change.
- **India map:** no official file was supplied. The outline was made from the DataMeet India community's `india-composite` boundaries, which follow the Survey of India (CC BY 4.0, credited on the map). It is at `Zcomm-frontend/public/maps/india-official.svg` and is on by default.
- **"Run your store from Claude" band on Apps:** kept. The board has a promo band slot, and the band links to the existing Claude & MCP setup.
- **"New to Zcom? Start a store" on sign in:** left out; there is no sign-up page.

## Questions for Mehak (capabilities with no clear place in v2)

The guide says to list these and never drop them. Until Mehak answers, the build keeps each one where it is, or in the nearest tab or ⋯ menu.

**Merchant Admin**
1. **Menu items with no v2 slot:** Subscribers, Templates, Reviews, Restock requests, Inventory Transfers. Proposal:
   - Reviews and Restock become Inbox types (the filter already lists "reviews, restock").
   - Subscribers becomes a Customers tab.
   - Templates goes under Marketing ▸ Campaigns ⋯.
   - Transfers becomes an Inventory tab.
2. **Home:** the setup checklist and the widget customisation (add, remove, reorder). Proposal: keep them, with customisation in the hero ⋯.
3. **Orders:** "Pickup & manifests", and New vs Ready to ship. Proposal: Pickups goes into the ⋯ menu; Returns keeps its 7 sub-statuses as a filter inside the Returns & RTO tab.
4. **Dropped columns:** Payments Order #, Products SKUs, Lookbooks Issues and Updated, Blog categories and tags Parent, In search and URL slug. Proposal: move them into Choose columns, hidden by default.
5. **Analytics:** today's Behaviour (funnel, pages, events, forms) and Business insights tabs. Proposal: Behaviour goes to Traffic and Business insights to Overview. Customers is a new page.
6. **Customer groups:** the backend's default segments differ from v2's VIP, Loyal, New and Slipping away. Existing manual segments stay as tabs. Duplicate and Delete go in the tab ⋯.
7. **Inbox:** should the chat use the existing `services/customer` conversations? Do Reviews moderation (approve, hide, pin, bulk) and Restock stay as list types?
8. **Discount detail:** board 29 is a page, but today it is an edit pop-up. Proposal: a new route.
9. **"Exactly 4" summary numbers:** Analytics Sales has 6 KPIs today and Overview has 5. Which 4?
10. **Profile menu:** v2 puts Your account, Switch store and Keyboard shortcuts back in it, but the owner moved them to Settings on 4 Nov. There is also no real version number or What's new data.
11. **⌘K "Actions" group** (Add product, Create order): v2 says search only. Keep or remove?
12. **Status text colours:** v2 red #D92D20 and green #16A34A on their tints are marginal for AA contrast. Proposal: keep the darker #B42318 / #18794E for text and use v2 values for dots and fills.

**Super Admin**
13. **Stores tabs:** "Deleted" and "Trial / Unpaid / Suspended" have no slot in v2's All, Live, In setup, At risk, Paused. Proposal: Trial and Unpaid go into At risk, Suspended into Paused, and Deleted becomes a filter-drawer option.
14. **Store page:** Profile, Go live, History, Usage history and the Performance chart aren't on boards 60–66. Proposal:
    - Profile and Go live go to Overview.
    - History goes to Activity log.
    - Usage history goes to AI usage.
    - Performance goes to Overview.
15. **ZCOM AI page:** Top-up requests (with the menu count), Data health, Benchmarks and Spend by model aren't on board 69. Proposal: keep them as sections of Analytics › AI usage, with the Top-up count on the Analytics menu item.
16. **Billing ▸:** what are its sub-items (Subscriptions, Invoices, Plans?).
17. **System health vs Analytics › System:** one page or two?
18. **Boards vs text:** several Super Admin boards still show gradient avatars, coloured app tiles and multicolour charts, and Store › Activity log has an Export button in the title row. The build follows the text.

---

# Part A

## Phase 0 audit: Merchant Admin (Zcomm-frontend) vs design v2

Date: 5 Nov 2026. Repo: `D:\zcom\Zcomm-frontend`. This is a read-only audit; no repo file was changed.
Spec: `docs/design-v2/README.md` (v2.0). Paths below are relative to the repo; `L` means line.

**Key context.** The app is already on a design pass that sits between v1.4 and this v2, Rohit's "v2 handover" (30 Oct). Because of that, several v2 rules are already true:
- no desktop top bar;
- pill buttons and pill segmented tabs;
- a flat menu with no group headings;
- a floating Ask bar at the bottom centre;
- a FilterDrawer on every list.

Other things conflict with v2 and must change:
- the Inter font;
- 16px cards;
- the multicolour AI spectrum;
- section colours;
- gradient avatars;
- toolbars rendered inside the table card.

Tools used: `npm run lint:hex` gives 0 raw hex (but it excludes the token files); `npm run lint:px` gives 61 raw px in 36 files (the ratchet allows 99).

---

### 1. Route inventory → v2 board

All admin routes are children of `/admin` (`src/main.tsx` L183-527, plus `src/routes/{marketing,analytics,apps}Routes.tsx`). "Recipe" means there is no board, so the §10A recipe applies.

| Route | Page file | v2 board / recipe |
|---|---|---|
| `/`, `/login`, `/sign-in` | `pages/Signin.tsx` | 06-Login, 07-Login-Steps |
| `/login` without a store handle | `pages/StoreChooser.tsx` | 06/07 (store choice step: recipe) |
| `/forgot-password`, `/reset-password`, `/set-password` | `pages/ForgotPassword.tsx`, `pages/ResetPassword.tsx` | recipe (sign-in style, §5) |
| `home` | `pages/Home.tsx` | **01-V4-Home** |
| `store/products` | `pages/Store/Products.tsx` | **16-Products** |
| `store/products/bulk-edit` | `pages/Store/BulkEditCosts.tsx` | recipe: editor |
| `store/add-product`, `store/edit-product/:id` | `pages/Store/AddEditProductsV3.tsx` | recipe: editor |
| `store/collections` | `pages/Store/Collections.tsx` | **18-V4-Collections**, **19-…-Cards** |
| `store/add-collection`, `store/edit-collection/:id` | `pages/Store/AddEditCollections.tsx` | recipe: editor |
| `store/lookbooks` | `pages/Store/LookBook.tsx` | **20-V4-Lookbooks** (cards), **21-…-Table** |
| `store/add-lookbook`, `store/edit-lookbook/:id` | `pages/Store/AddEditLookBook.tsx` | recipe: editor |
| `store/inventory` | `pages/Store/Inventory.tsx` | **17-Inventory** |
| `store/inventory/:productId/:variantId?` | `pages/Store/InventoryVariant.tsx` | recipe: record |
| `inventory/transfers`, `/new`, `/:id` | `pages/Inventory/Transfers.tsx`, `CreateTransfer.tsx`, `TransferDetail.tsx` | recipe: list / editor / record. **Not in the §3.1 menu** (see §3) |
| `sales/orders` | `pages/Orders/Orders.tsx` | **11-Orders-A**, **12-Orders-Peek** |
| `sales/add-order`, `sales/edit-order/:id` | `pages/Orders/AddEditOrders.tsx` | recipe: editor |
| `sales/orders/:id` | `pages/Orders/OrderDetails.tsx` | **14-Order-Detail** |
| `sales/returns` | `pages/Orders/Returns.tsx` | becomes the "Returns & RTO" tab on 11 (route to redirect) |
| `sales/payments` | `pages/Payments/Payments.tsx` | **13-Payments** |
| `sales/payments/:id` | `pages/Payments/ViewPayments.tsx` | **15-Payment-Detail** |
| `customers` | `pages/ContactBook/Customers.tsx` | **22-Customers** (+ group builder on 09) |
| `customers/:customerId` | `pages/ContactBook/CustomerProfile.tsx` | recipe: record ("customer page" is named in §10A) |
| `customers/segments` | `pages/ContactBook/Segments.tsx` | becomes the group tabs on 22 (route to redirect) |
| `customers/subscribers` | `pages/FormSubmissions/Newsletters.tsx` | recipe: list. **No v2 menu place** (Q-3) |
| `inbox/messages` | `pages/FormSubmissions/Contacts.tsx` | **23-V4-Inbox**, **24-V4-Inbox-Profile** (different product: see §2 Inbox) |
| `inbox/reviews`, `inbox/reviews/:id` | `pages/FormSubmissions/Reviews.tsx`, `ViewReview.tsx` | recipe: list / record (the v2 inbox filter has "reviews" as a type) |
| `inbox/restock-requests` | `pages/FormSubmissions/BackInStock.tsx` | recipe: list (the v2 inbox type "restock") |
| `marketing/overview` | `pages/Marketing/MarketingOverview.tsx` | **25-Marketing** |
| `marketing/campaigns` | `pages/Marketing/CampaignList.tsx` | **26-Campaigns** |
| `marketing/campaigns/:id` | `pages/Marketing/CampaignDetail.tsx` | **27-Campaign-Detail** |
| `marketing/campaigns/new`, `/:id/edit` | `pages/Marketing/CampaignEditor.tsx` | recipe: editor |
| `marketing/templates`, `/:id` | `pages/Marketing/Templates.tsx`, `TemplateDetail.tsx` | recipe: list (cards) / record. **Not in the §3.1 menu** (Q-3) |
| `marketing/discounts` | `pages/Marketing/Promotions.tsx` | **28-Discounts**; the edit dialog maps to **29-Discount-Detail** (today a pop-up, not a page) |
| `blogs/posts` | `pages/Blogs/Posts.tsx` | **35-Blogs-List**, **36-Blogs-Filter** |
| `/admin/blogs/posts/create-post`, `/edit/:id` (full screen) | `pages/Blogs/AddEditBlog.tsx` | **37-Blogs** (editor) |
| `blogs/categories` (+ `/new`, `/edit/:id`) | `Categories.tsx`, `AddEditCategory.tsx` | **38-Blog-Categories**; editor: recipe |
| `blogs/tags` (+ `/new`, `/edit/:id`) | `Tags.tsx`, `AddEditTag.tsx` | **39-Blog-Tags**; editor: recipe |
| `blogs/authors` (+ `/new`, `/edit/:id`) | `Writers.tsx`, `AddEditWriter.tsx` | **40-Blog-Authors**; editor: recipe |
| `analytics/overview` | `pages/Analytics/TrafficOverview.tsx` (via `AnalyticsPage.tsx`) | **03-V4-Analytics** |
| `analytics/sales` | `pages/Analytics/SalesOverview.tsx` | **31-Analytics-Sales** (04 optional) |
| `analytics/behaviour` | `pages/Analytics/BehaviorOverview.tsx` | ≈ **33-Analytics-Traffic**? (unclear: Q-6) |
| `analytics/campaigns` | `pages/Analytics/CampaignsOverview.tsx` | ≈ **34-Analytics-Marketing** |
| `analytics/insights` | `pages/Analytics/BusinessInsights.tsx` | no board (Q-6) |
| (none) | (none) | **32-Analytics-Customers**: no page exists today |
| `analytics/products/:itemId` | `pages/Analytics/ProductInsight.tsx` | recipe: record |
| `apps/:appKey?` | `pages/Marketplace/MarketplaceHub.tsx` | **41-Apps**; the app pop-up is **42-App-Detail** |
| `apps/connections/:id` | `pages/Marketplace/ConnectionDetails.tsx` | recipe: record |
| `help` | `pages/Help/HelpLearn.tsx` | **43-V4-Help**; **44-V4-Tickets** (no page today) |
| `settings` + 13 children | `pages/Settings/*` via `SettingsLayout.tsx` | **48–57** (store, domain, shipping, taxes, checkout, team, notifications, security, billing, developers) |
| `settings/mcp` | `pages/Settings/McpSetup.tsx` | ≈ 57-Settings-Developers |
| `unauthorized`, `*` | `Unauthorized.tsx`, `NotFound.tsx`, `ServerError.tsx` | recipe: error/empty |
| `dev/ui` (DEV only) | `components/ui/DevUiPage.tsx` (+ `DevUiV14.tsx`) | Phase 2 showcase |
| Legacy redirects | `main.tsx` L396-411, the routes files | keep |

Pop-ups and panels with no route:
- **Ask ZCOM panel**: 05-V4-AI, 46-AI-Full.
- **Notifications panel** (`components/notifications/StoreNotificationsPanel.tsx`): recipe "Notifications panel".
- **Command palette**: 08-V4-Menu.
- **Confirm/Delete dialogs**: 09-V4-Dialogs.
- **Session-expired `ReLoginModal.tsx`**: 09 ("Welcome back").
- **Loading**: 47-Loading.

---

### 2. Page by page: current vs v2

Shared facts that hold for every list page today:
- **The toolbar is inside the table card.** `components/ui/DataTable.tsx` L284-299 renders `toolbar` → `chips` → table → footer inside one bordered card. So every page that passes `toolbar=` has its tabs, search, filter and columns *inside* the table (full list in §4d).
- **Row end:**
  - desktop rows have a ⋯ `RowMenu` column only (L238-258), with no chevron;
  - phone rows have a chevron plus the ⋯ (L348-356).
- **Avatars:** `components/ui/Media.tsx` L141-156 draws gradient initials (`--zc-avatar-1..6`).
- **Title row:**
  - The wrapper is `components/common/PageHeader.tsx` (not synced) around `components/layout/PageHeader.tsx` (synced).
  - The section-coloured icon tile comes from the `SECTION` map at L31-44 (store violet, blogs pink, marketing coral, customers/inbox teal, analytics amber, orders blue, payments green).
- **Summary panel:** no page has one today. Some pages have a `KpiStrip` of `StatCard`s; most have only a subtitle line.

#### Home (`pages/Home.tsx`), board 01

| | Current (render order) | v2 |
|---|---|---|
| Hero | `WelcomeBanner` → `VideoBanner` (L410). Greeting, "View store" glass button (L417), 4 glass tiles (Orders today, To ship, Sales today, In the store now). No AI button | A blue-gradient band about 300px tall (radius 28) with 4 drifting lights. Date (mono), "View store ↗", greeting (44px, 300/600), **orb + AI summary line**, 3 chips (Sales, Orders, Visitors with dots), **period tabs** (Today, 7 days, 30 days, This year) |
| Setup | `SetupChecklist` (L425) | Not on the board. **Keep** (capability); place it under the hero (Q-1) |
| Row | "Overview" h2 + DateRangeDropdown (L430); KpiStrip: Revenue, Orders, Sessions, Unique visitors, Conversion rate (L441-467) | The period tabs move into the hero. The KPI numbers are partly covered by the hero chips (Sales, Orders, Visitors) |
| Row | Card "Revenue" with 30d/90d/Year + area chart (L480-509); NeedsAttention: Awaiting payment, Out of stock, Reviews to reply, "Zcom AI checked…" (L479) | **Row 1:** Sales this month (dot chart), Where orders are (segment bars), **AI card** ("Checkout has failed…", Fix checkout). **Row 2:** Needs attention (4 to-dos + 1 insight line) and **Top products \| Latest orders** in one card with a switch |
| Widgets | User-arranged widgets (localStorage, L92-100): Recent orders, Top products, Learn (default); optional Sales by location (GeoMap), Traffic sources. Each has ⋯ Move up/down/Remove. "Add a widget to Home" (L533) | **Row 3:** Sales by day (30 hatched bars) + **Stock to watch (NEW)**. **Learn Zcom:** 4 video thumbnails (16:9) |
| Removed in v2 | "Sales by category", the separate Insights card and the live orders map are **not on the current Home** (the Insights card is only in the orphan `components/home/HomeAnalyticsBody.tsx`) | Nothing to move |

Moved items and open points:
- **Widget customisation** (add, remove, reorder widgets) has no place in v2 (Q-1).
- **Sales by location** and **Traffic sources** widgets go to Analytics overview (the map moves there anyway).
- **Recent orders** maps to the "Latest orders" switch.
- **Stock to watch has no data source.** CLAUDE.md §3 says "There is no low-stock operation". The Products and Inventory filters do have "Stock level", so a `getProducts` call with a stock filter may serve (unverified).

#### Orders (`pages/Orders/Orders.tsx`), boards 11 and 12

| | Current | v2 |
|---|---|---|
| Title actions | "Shipping wallet" secondary (dot + balance, L1417) → **Export** secondary (L1429) → Create order (L1437). On phone: ⋯ with Export and Wallet (L1398-1412) | **Wallet capsule** (logo, balance, +, coloured by health) → Create order → ⋯ (Export orders, Import, Print shipping labels, Choose columns) |
| Summary | None. The subtitle reads "N to ship · N awaiting payment" (L1115-1121) | Panel: Orders this month, To pack, On the way, Waiting for payment (amber) |
| Tabs | Inside the card (`components/orders/ListToolbar.tsx`, `helpers/constants.ts` L57-100): New · Ready to ship · Pickup & manifests · In transit · Delivered · RTO · All | Above the table: All · To pack · On the way · Delivered · Not paid · Returns & RTO · **Abandoned (NEW)** |
| Search/filter | Inside the card: search, Filter (Payment status, Source, Sold via, Sales channel, Tags, Order date), Columns | Above: search, filter icon, sort icon. Columns move to ⋯ "Choose columns" |
| Columns | Order (#, invoice icon, date under it, marketplace badge) · Customer (gradient avatar, name, email) · Payment (amount + chip + extra chips) · Shipping (courier, AWB) · Status · ⋯ | Order (# / date) · **Items (1 photo + "+N")** · Customer (name / city) · Payment · Delivery · Total · ⋯ · chevron |
| Row click | Navigates to `sales/orders/:id` (L1462) | **Preview drawer (460px)** over the full table; detail page from the drawer |
| Bulk | Export selected, Assign tags | Not on the board (keep: Q-4) |

Where moved or unplaced items go:
- **Tab mapping:**
  - New and Ready to ship → To pack (or a filter);
  - In transit → On the way;
  - RTO → Returns & RTO (merged with `sales/returns`).
  - **"Pickup & manifests" has no place** (Q-2). Proposal: a filter, or a ⋯ action "Pickups & manifests".
- **Not paid:** a new tab built from the payment-status filter.
- **Returns page** (`Returns.tsx`, its own tabs Needs action, Requested, Approved, Received, Refunded, Closed, All, and columns Order, Status, Items, Refund, Opened, By) becomes the "Returns & RTO" tab. Its 7 sub-statuses need a home: proposal is the filter drawer inside that tab (Q-2).
- **Shipping columns:** the Shipping column (courier/AWB) maps to "Delivery". Courier and AWB go under it.
- **Items column:** the list query `FETCH_ORDERS` (`graphql/orders.ts` L4-70) only has `itemcount`, with no product names or images. It needs extra fields; the order detail has them, so the schema probably allows it (unverified).
- **Draft orders and abandoned checkouts:** not found anywhere in the frontend.

#### Order detail (`pages/Orders/OrderDetails.tsx`), board 14
- **Current:**
  - status chips in the header (L325-337);
  - Card "Timeline" (`components/orders/TrackDetail.tsx`: a vertical list with 10px dots);
  - Card "Activity" (L561);
  - customer card with a gradient avatar (L578).
- **There is no horizontal step tracker.**
- **v2:** a new 5-step tracker (Placed bag, Paid card, Packed box, Shipped truck, Delivered house) with 34px ink tiles. Everything else is kept.

#### Payments (`pages/Payments/Payments.tsx`), board 13

| | Current | v2 |
|---|---|---|
| Title actions | **Export** secondary (L547) only | **Payments \| Refunds switch**, ⋯ (Export payments, Download settlement report, Payment settings) |
| Summary | None | Panel (4 cells, see board 13) |
| Tabs | Inside the card (L407-433): All · Paid · Pending · Failed | Above the table (the tabs on the board: verify on 13) |
| Filter | Payment app, Date (L112-116) | Filter drawer (Method moves here) |
| Columns | **Date** · Customer (gradient avatar) · Order · Paid with · Status · Amount · ⋯ | **Payment # (date under it)** · Customer · **Amount** · Status · Paid with |
| Row | Navigates to the detail page; ⋯ View payment, View order, Copy transaction ID, Refund | Same (no dropdown rows) |

- **Refunds:** no route, tab or page exists today. Refunded and Partially refunded are statuses derived on the client (L147-153). The Refunds switch view is **new UI**, with no board (a §10A list). Data: it could filter payments by refunded status. No refunds list query was found (unsure).
- **The Order column has no slot in v2's 5 columns** (Q-5). Proposal: the order number under the customer, or in the detail page only.
- "Download settlement report" and "Payment settings" are new ⋯ entries. **No settlement-report operation was found** in `graphql/payment.ts` (unverified). "Payment settings" can link to Settings.

#### Payment detail (`ViewPayments.tsx`), board 15
- No structural change ("unchanged").
- **Restyle only:**
  - the KpiStrip of 4 SummaryCells (L497-530);
  - PaymentTimeline;
  - the details card with its refunds section;
  - the order card;
  - the gradient avatars.

#### Products (`pages/Store/Products.tsx`), board 16

| | Current | v2 |
|---|---|---|
| Title actions | **Import** (L1169) · **Export** (L1173) · Add product (L1176), all standalone | Add product + ⋯ (Import, Export, Choose columns) |
| Summary | None | **NEW panel:** Live products, Sold · 30d, Running low, Opened no sales |
| Tabs | None | Board 16 shows tabs (verify; probably status) |
| Toolbar | `StoreListToolbar` inside the card: search, Filter (Status, Stock, Collection, Price, Product type), Columns | Above the table, plus a **table \| cards switch** |
| Columns | Product (thumb, name, "N variants · collections") · SKUs · Price · Inventory · Status · ⋯ | Product · **Price** · Status · Stock · **Sold · 30d** · **Sells on** (icons) · **Revenue · 30d** |
| Other | Bulk: change status, export selected, Duplicate/Ribbon/Delete | AI banner (light blue, blue edge) |

- **SKUs column** has no place in v2 (Q-5). Proposal: under the product name, or in Choose columns.
- **New data:**
  - Sold · 30d and Revenue · 30d are not in `getProducts`. GA4 per-item data exists only keyed by GA4 item id (`GetProductsOverview`, `graphql/analytics.ts` L706). This is **probably a backend gap**, not "data the app already has".
  - "Sells on" is per product in `getProductPublications(productId)` (`graphql/marketplace/publications.ts`). There is no list-level field, so it needs a batch field.
  - "Opened no sales" has no source.
- **Products card view does not exist** (it is new). The Collections `ViewToggle` / `useViewMode` can be reused.

#### Inventory (`pages/Store/Inventory.tsx`), board 17
- **Title row:**
  - current: InventoryLocationPicker + **Export** (L1149, direct CSV);
  - v2: Export moves into ⋯. The location picker is not mentioned (keep: put it in the title row or the toolbar).
- **Tabs:**
  - current: none (the toolbar is inside the card, L967/L1225);
  - v2: **tabs above the table** (board 17 labels; probably stock levels).
- **Columns stay:**
  - Product (expand caret, thumb) · SKU · Unavailable · Committed · Available · On hand · Incoming · Visibility · ⋯;
  - sizes still open in place.
- **Sold out in red:** the current dot uses the danger tone. Check there is no pink tint: no "pink" is used here.
- **Kept as is:** SaveBar and History drawer.

#### Collections (`pages/Store/Collections.tsx`), boards 18 and 19
- **Title row:** "Add collection" today. No Export.
- **Summary panel:** none today; v2 adds one.
- **Views:**
  - a **grid/list switch already exists** (`useViewMode`, L61; toggle L219-237);
  - the toolbar sits inside the card in list view (L304).
- **Table columns:**
  - current: Collection · Products · Featured · Updated · ⋯;
  - v2: see board 18.
- **v2 cards** show 3 photos, name, status, how it's filled, product count, visits and conversion. Current cards have 1 image, a count and a Featured chip.
- **Data gaps:**
  - **visits and conversion** are not in `graphql/collections.ts` (backend/analytics gap);
  - for "how it's filled" (manual vs smart) the field is unverified.

#### Lookbooks (`pages/Store/LookBook.tsx`), boards 20 and 21
- **Today:**
  - a table only, with the toolbar inside the card (L339-362, L432);
  - tabs All · Live · Scheduled · Drafts · Expired · Archived;
  - Filter (Tag).
- **v2:** summary panel, **card view (new)** and table.
- **Table columns:**
  - current: Lookbook (cover, title, slug · tags) · Status · Looks · Issues · Updated;
  - v2: Lookbook, Looks, **Products**, **Views · 30d**, **Shop taps**, Status.
- **Unplaced:** "Issues" and "Updated" have no place (Q-5).
- **Data gaps:** views and shop taps were not found in `graphql/lookbooks.ts`.

#### Customers (`pages/ContactBook/Customers.tsx`) + Segments, board 22

| | Current | v2 |
|---|---|---|
| Title actions | **Export** secondary (L645-650) · Add customer (L651) | **New group** (secondary) · **New customer** (primary) · ⋯ (Import, Export) |
| Summary | None | **NEW panel** (4 cells, board 22) |
| Tabs | None. Segments are a separate page and menu item (`customers/segments`). There is **no "Saved segments" row** today | **Groups as tabs:** All, VIP, Loyal, New, Slipping away + saved groups |
| Toolbar | Inside the card: search, Filter (Labels), Columns | Above: search, filter icon, sort icon |
| Columns | Customer (gradient avatar, name, email) · Phone · Email marketing · Total spent · Last activity · ⋯ | Board 22: grey avatar, VIP ink tag, "Can reach on" icons (neutral) |

- **Import** is new: no customer import operation was found (unverified).
- **Segments page** (`Segments.tsx`):
  - header "Create segment";
  - columns Segment, Customers, Type, Updated;
  - ⋯ Edit, Duplicate, Delete.
  - In v2 it becomes the tabs plus the group pop-up. Duplicate and Delete need a place (a tab ⋯ menu: Q-7).
- **Ready-made segments** (backend `services/customer/src/config/constants.ts` L75-95: Recent, Repeat, High-Value, First-Time Buyers, Newsletter Subscribers) don't match v2's VIP, Loyal, New and Slipping away (Q-7).
- **Segment builder today** (`components/contact/SegmentBuilderModel.tsx`) is a **manual checklist of customers**. A segment is a static `customerIds` list (`SegmentInput {name, description, customerIds}`). The **rule builder is fully new** (§9).
- **Subscribers** (`customers/subscribers`, tabs All, Subscribed, Unsubscribed, Export standalone) has **no place in v2's menu** (Q-3).

#### Inbox: boards 23 and 24 (structural mismatch)
- **Today "Inbox" is 3 table pages**, all with the toolbar inside the card:
  - **Messages** (`Contacts.tsx`): contact-form submissions. Tabs Not replied, Replied, All. Drawer with "Reply on WhatsApp" (wa.me) and "Reply by email" (mailto).
  - **Reviews** (`Reviews.tsx`): KpiStrip, 6 tabs, filter, Export CSV (L538), reply textarea.
  - **Restock requests** (`BackInStock.tsx`).
- **There is no conversation/chat UI** anywhere in the frontend.
- **Backend:** `services/customer` has `getConversations`, `getMessages`, `sendAdminMessage`, `markMessagesAsRead` and `closeConversation`, but no channel field (WhatsApp/Email/SMS). The frontend uses none of these.
- **v2:**
  - two columns (a 380px list with To reply, Mine, All, Done, plus a filter for type and channel; and the chat);
  - the profile replaces the chat on a name tap;
  - the reply box has a WhatsApp | Email | SMS switch and an AI draft.
- **Where today's pages go:**
  - **Proposal:** Messages, Reviews and Restock become *types* in the inbox list filter (as the board's filter suggests: "orders, returns, reviews, restock, questions").
  - The Review moderation table (approve, hide, pin, bulk, KPIs) and the restock table don't fit a chat list (Q-8: **largest open structural question**).
  - "Mine", "Assign" and "Done" need assignment data. The backend has a conversation `status` but no assignee found.

#### Campaigns (`CampaignList.tsx`) and Discounts (`Promotions.tsx`), boards 26 and 28
- **Campaigns today:**
  - NewCampaignMenu (Email, SMS, WhatsApp) in the title row;
  - **channel tabs** All · Email · SMS · WhatsApp, search, Filter (Status), Columns, all inside the card (L269-289);
  - columns Campaign (ChannelCircle, name) · Status · Sent · Opened (always "—") · Revenue (always "—") · Sent date;
  - SmsConsentNotice inside the card.
- **v2 Campaigns:**
  - summary panel (collapsed on board 26);
  - **tabs above** (status tabs per §1A);
  - **channel → filter drawer**;
  - neutral channel icons.
  - So channel tabs become a filter and status filter options become tabs.
- **Discounts today:**
  - "Create discount" in the title row;
  - counts only in the subtitle;
  - tabs Active · Scheduled · Paused · Ended · All inside the card;
  - columns Code · Discount · Type · Used · Ends · Status;
  - row click opens the **edit dialog**.
- **v2 Discounts:**
  - summary panel and tabs above;
  - **29-Discount-Detail is a page.** Today there is no discount detail route (Q-9).
- **Marketing overview** (board 25, "as approved"):
  - channel cards with coloured ChannelCircles (blue/violet/green) → neutral;
  - the Recent campaigns table has tabs inside the card.
- **Templates** (`marketing/templates`) is not in the v2 menu (Q-3).

#### Analytics (one page with tabs; `components/analytics/shell/AnalyticsShell.tsx`), boards 03 and 31–34

**The menu changes.** Today:
- a single "Analytics" menu entry, with an in-page SegmentedSwitch under the header (L205-212): Overview · Sales · Behaviour · Campaigns · Business insights;
- the header has `section="amber"` (L160/178) and actions DateRange, Compare switch, Filter, **Export / Export dropdown** (L104-120).

v2: Analytics ▸ Overview, Sales, Customers, Traffic, Marketing as **menu sub-items**.

| v2 page | Current source | Change |
|---|---|---|
| Overview (03) | `TrafficOverview.tsx`: KpiStrip (Sessions, Unique visitors, Page views, Engaged sessions, Sessions per visitor), sessions chart, pies, sources, by day/hour, "Sessions by location" (Google GeoChart, world), Landing pages table; a "Live" switch shows `RealTimeOverview` | **New layout:** a live **India map** (official SVG, city lat/long), 4 tiles (blue/navy), then 2 rows × 4 lite cards (Visitors, Visitors who buy, New customers, Orders with a discount, Returns & RTO, Cancelled, Blog visits, Sold out). The traffic content moves to the Traffic sub-page |
| Sales (31) | `SalesOverview.tsx`: KpiStrip of 6 (Total sales, Orders, AOV, Net revenue, Refunded, Units sold), charts, "Sales by category" (L230), ProductsOverview, etc. | Number strip → summary panel (exactly 4: Q-10, there are 6 today) |
| Customers (32) | **No page.** Only the Business insights "Customers" section plus customer cards on Sales | New page from existing data (Q-6) |
| Traffic (33) | Overview tab today; Behaviour tab (funnel, pages, events, forms) | Summary panel (Q-6: where Behaviour's funnel, pages, events and forms go) |
| Marketing (34) | `CampaignsOverview.tsx` (KpiStrip of 4, campaigns table, source/medium, UTM) | Summary panel + **new weekly "Back for every ₹1 on ads" chart**, share bars on sources and campaign bars |
| (none) | **Business insights** (`BusinessInsights.tsx`: What to do next, Sales health, Customers, Profitability, Marketing efficiency, Inventory) | **No v2 place** (Q-6) |

- **"Ask Zcom AI" in Analytics: not found** today. §1A's "Ask Zcom AI" → "Ask why" item has nothing to rename; "Ask why" is a new contextual action.
- **Export** stays, but moves into a ⋯ menu.

#### Blog posts, Categories, Tags, Authors, boards 35–40

| Page | Current | v2 |
|---|---|---|
| Posts | "Write a post". Tabs All · Published · Scheduled · Drafts · Archived **inside the card** (L353-361/472). Filter drawer (Category, Author, Tag) already exists. Columns: Post (thumb, title, excerpt) · Category · Author · Status · Date. **No SEO column** | Post (title, **category · author** under it) · Status · **SEO score** · **Reads** · Updated. Summary panel. Filter adds status, SEO band, updated, reads |
| Categories | "Add category". Search + columns inside the card. Columns: Category (thumb) · Parent · Posts · SEO · In search | Banner image per row, SEO column (**already present** as `components/blogs/SeoScore.tsx` chip), summary panel |
| Tags | Columns: Tag · URL slug · Posts · SEO · In search | SEO score (present), summary panel |
| Authors (`Writers.tsx`) | Columns: Author (**gradient avatar**, L94) · URL slug · Posts · SEO | **Profile SEO** (bio, photo, links); neutral photos; summary panel |

- **Moved:**
  - the Posts Category and Author columns move under the title;
  - the excerpt line is dropped from the row (it is a duplicate; it is still in the editor).
- **Reads:** no reads/views field was found in `graphql/blog.ts` (gap; GA4 page views may serve).
- **SEO score today:**
  - it is computed on the client (`blogSeoChecks`: slug, title, meta description, focus keyword, share image, alt text) and shown as a Chip, not a ring;
  - v2 wants a ring, labels Great/Good/Needs work, and server-stored scores (§9).
- **Unplaced:** "Parent", "In search" and "URL slug" columns have no stated v2 place (verify boards 38–40; Q-5).

#### Help & support (`pages/Help/HelpLearn.tsx`), boards 43 and 44
- **Current:**
  - one page "Help & learn" with a search in the header;
  - SetupStoreCard;
  - "Video tutorials" with a **Topic `Select`** (not tabs);
  - TutorialCard thumbnails (`h-28`, `bg-sec-soft`; **not 16:9**);
  - FAQ accordion;
  - TalkToZerrorCard.
- **The menu item is in the bottom group** (`storeHelpNavItems`).
- **v2:**
  - a menu dropdown: Tutorial videos, Guides, **My tickets**, **What's new**;
  - topic tabs and 8 thumbnails at 16:9;
  - Popular guides.
- **Not found:** My tickets and What's new pages. There is no ticket operation in `src/graphql`. The SA has tickets (board 45), so the backend may have one (unverified).
- **FAQ** ("Common questions") and Talk to Zerror need a place (proposal: under Guides).

#### Sign in (`pages/Signin.tsx`, `StoreChooser.tsx`, `components/layout/AuthLayout.tsx`, `AuthBuddy.tsx`), boards 06 and 07
- **Current:**
  - already one question at a time (email → password, `AuthReveal`);
  - no Google/Apple buttons;
  - no marketing panel;
  - a dark page with a dot grid, an "auth-edge" card with a **rotating spectrum edge**, and footer links.
- **The mascot:**
  - a 40px dark tile with eye bars (follows the pointer, blinks, closes its eyes on the password step) and a typed speech bubble.
  - v2: an **orb with eyes** in a blue halo, no card. Lines change to "Hi. What's your email?" etc.
- **2-step:** `AuthCodeInput` exists (`AuthBuddy.tsx` L63-170) but is unused. There is no 2-step step in Signin.
- **Store choice:** "Choose a store" (several stores) has no board (recipe).

#### Pop-ups (board 09)
- **Sizes:**
  - `components/ui/Modal.tsx` L8-30 has sm 480, md 640, lg 720;
  - v2 has 420 / 640 / 960.
- **`ConfirmDialog`:**
  - does it show an icon tile? (check in Phase 2);
  - the title "Sign out?" (SidebarLayout) must become "Log out of ‹store›?".
- **Overlay:** `--zc-overlay` is `rgba(17,19,24,.40)` vs v2 `rgba(11,12,16,.4)`. There is no blur on modals (fine).
- **Duplicate pop-ups:** legacy `components/ModalComponent.tsx` and `DeleteItemModal` still exist alongside ui/Modal (CLAUDE.md §7). There must be one pop-up.
- **The group rule builder (large) is new.**

#### Settings (`pages/Settings/SettingsLayout.tsx`), boards 48–57
- **Current inner menu:**
  - Your business: Store profile, Team, Business & tax, Plan & billing;
  - Selling: Orders & checkout, Notifications, Shipping & delivery, Locations;
  - Integrations: Claude & MCP;
  - Account: Account & security, Keyboard shortcuts;
  - Sign out.
- **Boards 48–57:**
  - Store, Domain, Shipping, Taxes, Checkout, Team, Notifications, Security, Billing, Developers.
  - **Domain** has no current section; check whether domain settings live in Store profile (unverified).
- **Team tabs inside the table:** the Team section passes `tabsInTable` (`main.tsx` L443), so its tabs sit inside the table. Move them above (the §4d rule).
- Otherwise: new page bg and tokens.

---

### 3. Shell

| | Current | v2 §3.1 |
|---|---|---|
| Menu file | `config/navigation.ts` (store), `components/Sidebar.tsx` (permissions), `components/layout/Sidebar.tsx` (**synced** UI), 248px | 240px, ink |
| Top | Wordmark "Zcom" + "Admin" label | **Store switcher:** neutral badge with initials (`#23262E`), store name, domain |
| Search | Capsule button with ⌘K (Sidebar L211-225) | Same, search only |
| Order | Home · Orders ▸ (Orders, Returns) · Payments · Store ▸ (Products, Inventory, Collections, Lookbooks) · Customers ▸ (Customers, Segments, Subscribers) · Inbox ▸ (Messages, Reviews, Restock requests) · Marketing ▸ (Overview, Campaigns, Templates, Discounts) · Analytics (single) · Blogs ▸ (Posts, Categories, Tags, Authors) · Apps & channels · **Settings** (last main item) | Home · **Inbox** (count) · **Sales ▸** Orders, Payments · **Catalogue ▸** Products, Inventory, Collections, Lookbooks · Customers · Marketing ▸ Overview, Campaigns, Discounts · **Content ▸** Blog posts, Categories, Tags, Authors · Analytics ▸ Overview, Sales, Customers, Traffic, Marketing · Apps & channels · **Help & support ▸** Tutorial videos, Guides, My tickets, What's new |
| Bottom | Notifications (blue count), Help & learn, owner row (avatar, name, store · role) + collapse button | Notifications (**red** count), Settings, profile |
| Profile menu | Header (name, email, version `APP_VERSION = "1.0.0"`, SidebarLayout L42) → Enable notifications → Sign out. A comment says Account & security and Shortcuts were moved to Settings (owner, 4 Nov) | Your account, Switch store, Keyboard shortcuts, Log out, **Zcom version + What's new** (Q-11: conflicts with the 4 Nov owner decision) |
| Group headings | **None** (already flat) | None |

Routes v2 removes from the menu:
- **Returns:** exists (`sales/returns`) → Orders tab.
- **Refunds:** no route exists.
- **Abandoned carts:** no route exists.
- **Drafts:** no draft orders exist, so nothing to show.
- **Customer groups:** exists as `customers/segments` → tabs.

Current menu items with no v2 place (Q-3): **Subscribers, Templates, Reviews, Restock requests, Inventory › Transfers**. Transfers is routed but **not in the current menu either**; it is reached from Inventory, presumably.

Top bar:
- `components/layout/AppShell.tsx` (**synced**) has **no desktop top bar** (L3-8).
- Below 1024px there is a 56px black top bar (L78-100), holding the menu button, store name/subtitle, a search icon and the bell (`SidebarLayout.tsx` L301-312).
- v2 §10: under 1024 it should be a **72px icon rail** on laptop/tablet; the phone keeps a top row (store switcher, search, menu).
- Legacy `--zc-topbar*` tokens: `styles/tokens.css` L98-105.

Search (⌘K): `components/layout/CommandPalette.tsx` (synced), wired in `SidebarLayout.tsx` L135-245.
- Groups: Pages, Actions (Add product, Create order, Add collection, Write a post, Create email campaign), and server results for **Products and Orders only** (`GLOBAL_SEARCH`, `graphql/search.ts`).
- v2 adds **customers and settings** and removes Actions? (§3.1 says search only: Q-12).
- It also has an **"Ask Zcom AI: ‹query›" row** (CommandPalette L26-27, L135-138), which v2 removes.

AI entry points (shell):
- `AskBar` (`components/layout/Assistant.tsx` L41-60, synced): a 48px capsule, max 560px, placeholder "Ask anything about your store…". It hides on scroll down (AppShell L109-120).
  - v2: 54px, 600px, orb, page suggestion chip, ⌘J hint, **always visible** (fixed).
- `⌘J` hotkey (`useShellHotkeys`, SidebarLayout L118).
- `AskZcomPanel` (`components/assistant/AskZcomPanel.tsx`) is a **right drawer** with a history view.
  - v2: **bottom half-sheet → full view** with history on the left.
- The synced kit `AssistantPanel` (Assistant.tsx L150-220) is unused in this app.

---

### 4. Hit lists

#### (a) Top bars
1. `components/layout/AppShell.tsx` L78-100: the mobile/tablet top bar (<1024). Fed by `layouts/SidebarLayout.tsx` L291-312 (`topBarTitle`, `onOpenSearch`, `mobileActions` bell).
2. Tokens `--zc-topbar*`: `styles/tokens.css` L98-105 (marked LEGACY).
3. Not shell top bars, but check:
   - the full-screen blog editor bars (`components/blogs/Sidebar.tsx`, `EditorContainer.tsx`);
   - the media library `components/media-library/parts/TopBar.tsx`.
   These are editor chrome; keep them as the editor recipe.
4. Strips above the page (keep, not top bars): `ImpersonationBanner`, `RestrictedModeBanner`, `BillingStateBanner` (`SidebarLayout` L272-285), `SupportBanner.tsx` (synced; already differs from SA).

#### (b) AI entry points
**Remove or replace** (non-contextual "Ask"):
- `components/layout/CommandPalette.tsx` L135-138: the "Ask Zcom AI: …" row (search box).
- `components/ui/Ai.tsx` L97-99: `TodaysBrief` "Ask AI" button. Used only by the orphan `components/home/HomeAnalyticsBody.tsx` L143 and DevUi.
- `components/ui/Button.tsx` L18: variant `ai` documented for "Ask AI". Restyle; keep it for contextual actions.
- `components/layout/Assistant.tsx` `AskBar` and `AskZcomPanel`: **these become the one v2 entry point** (restyle and extend).

**Already absent (nothing to remove):**
- no hero AI button (`WelcomeBanner`);
- no top-right Ask AI;
- no menu Ask AI;
- no Analytics "Ask Zcom AI".

**Contextual AI actions (stay; restyle to the orb):**
- `components/ai/WriteWithAiField.tsx` (product, lookbook fields);
- `components/AssetSetting.tsx` L415 (image alt text);
- `components/lookbooks/LookbookMediaEditor.tsx` L227;
- `pages/Store/AddEditProductsV3.tsx` L1865 (description);
- `pages/Store/AddEditLookBook.tsx` L133/181;
- `components/blogs/Sidebar.tsx` L133-145 and `EditorContainer.tsx` L227-242 ("Improve with AI", ask-for-changes);
- `components/analytics/home/NeedsAttention.tsx` L79 ("Zcom AI checked your store…" label);
- `components/insights/WhatToDoNext.tsx`;
- `ui/Ai.tsx` `AiSuggestion`, `AiInsightCard`, `WriteWithAiButton`.

**v2 also adds:**
- "Write one with AI" (Campaigns);
- "Draft by Zcom AI" (Inbox);
- "Ask why" (Analytics).

#### (c) Colours outside §2.1
- **Raw hex in components:** `lint:hex` = 0. It excludes the token files, `heroui-theme.js` and editor/preview CSS (`scripts/check-hex.mjs` L16-26).
- **Raw px:** `lint:px` = 61 in 36 files (max 99).
- **Section colours** (retire):
  - definitions in `styles/tokens-expression.css` L10-22 (`--zc-sec-{blue,violet,teal,green,amber,coral,pink,slate}-*`) and solid tile fills in `styles/tokens.css` L219-228 (violet #7B5CFF, coral #E2483C, amber #D97706, pink #DB2777, teal #0F9F8F, green, blue, slate);
  - the mechanism is `components/ui/IconTile.tsx` L6-8, L31-35 (synced) and `components/common/PageHeader.tsx` L31-44 (`SECTION` map) → **every list page title tile**;
  - explicit uses: `AnalyticsShell.tsx` L160 `section="amber"`, `Inventory/Transfers.tsx` L152 `"teal"`, `products/SalesChannelsCard.tsx` L203 `"slate"`, `help/help-sections.ts` (6 entries, `analytics: violet` L18).
- **`bg-sec-soft` / `text-sec-fg` / `zc-sec-*` in TSX:** 24 lines. These include:
  - `ui/EmptyState.tsx` L61;
  - `marketing/ChannelCircle.tsx` L21;
  - `pages/Marketing/TemplateDetail.tsx` L143;
  - `help/TutorialCard.tsx` L37, L53-56;
  - `help/NowPlayingCard.tsx` L44;
  - `layout/SupportBanner.tsx` L43, L56 (`zc-sec-amber`);
  - `blogs/EditorContainer.tsx` L127, L187.
- **Channel colours:** `tokens-expression.css` L26-28 (email #1747C7 blue, SMS #6236D9 violet, WhatsApp #18794E green), `theme.css` L114-116, `marketing/campaign-channels.ts` L66-70, `ChannelCircle.tsx`, `NewCampaignMenu.tsx` L17-43. There is no red email colour today.
- **AI spectrum (multicolour; v2 = one blue gradient):**
  - `--zc-ai-1..4` #5B8CFF / #9D7BFF / #FF8FB8 / #FFBE73 and the 115° linear gradient, conic (`tokens.css` L120-129);
  - `--zc-ai-label` #6236D9;
  - `.zc-btn--ai` gradient ring (`components.css` L123-149);
  - spectrum edges at `components.css` L126-149, 707-716, 811;
  - the auth card's rotating edge (`tokens.css` L406-412);
  - `AiSpectrumDefs` (`ui/Ai.tsx` L17).
- **Avatar gradients:** `tokens-expression.css` L62-67 (blue→violet, teal→blue, pink→violet, amber→pink, green→teal, grey), used by `ui/Media.tsx` L141-146.
- **Orange as a tone:** `layout/Sidebar.tsx` L99-117, `ui/AttentionList.tsx` L22/59, `layout/types.ts` L30, `NeedsAttention.tsx` L56. Map it to amber.
- **Purple/orange prop values:** `analytics/common/InsightCard.tsx` L11, `analytics/home/HomeInsights.tsx` L38 (orphan).
- **Raw Tailwind palette colour:** `components/orders/CourierModal.tsx` L363 `text-purple-500`.
- **Other gradients:**
  - `help/NowPlayingCard.tsx` L59 (scrim: OK);
  - `ColorPicker.tsx` L185/206 (functional: OK);
  - `--zc-banner-scrim*` (video banner).
- **Glass and blur** (v2 bans `backdrop-filter` except optionally on the Home hero buttons): `components.css` L114-115 (glass), L223 (`zc-icon-btn--glass`), L789-790 (glass tiles in VideoBanner); `--zc-glass-blur*` tokens L256-259.
- **Off-spec values:**
  - the table header is light blue (`--zc-table-head-bg` #EDF2FC, fg #2A3A5C; `tokens.css` L44-45) vs v2 `#FAFAFB` / `#5F646E`;
  - the notification count is blue (`--zc-nav-count-bg`) vs v2 red;
  - danger is #B42318 vs v2 `--red` #D92D20 (the dot already matches);
  - success fg is #18794E vs #16A34A.

#### (d) Tabs or search inside a table card
All of these pass `toolbar=` to `DataTable`, which renders it inside the card (`ui/DataTable.tsx` L284-299). The ones with **tabs** are marked **T**:
- `Orders/Orders.tsx` L1457 **T**
- `Orders/Returns.tsx` L308 **T**
- `Payments/Payments.tsx` L562 **T**
- `Store/Products.tsx` L1201
- `Store/Inventory.tsx` L1225
- `Store/Collections.tsx` L304 (list view)
- `Store/LookBook.tsx` L432 **T**
- `ContactBook/Customers.tsx` L668
- `ContactBook/Segments.tsx` L391
- `FormSubmissions/Contacts.tsx` L340 **T**
- `Reviews.tsx` L577 **T**
- `BackInStock.tsx` L374 **T**
- `Newsletters.tsx` L651 **T**
- `Marketing/CampaignList.tsx` L376 **T**
- `MarketingOverview.tsx` L270 **T** (h2 + channel switch)
- `Promotions.tsx` L663 **T**
- `Blogs/Posts.tsx` L472 **T**
- `Categories.tsx` L198
- `Tags.tsx` L178
- `Writers.tsx` L196
- `Inventory/Transfers.tsx` L183
- `Analytics/CampaignsOverview.tsx` L176
- `PagePerformance.tsx` L217
- `ProductsOverview.tsx` L248
- `TrafficOverview.tsx` L342
- `Settings/Locations.tsx` L267
- `ManagePackages.tsx` L298
- `Roles.tsx` L256
- `Staff.tsx` L201
- Settings Team `tabsInTable` (`main.tsx` L443, `components/settings/SettingsSectionTabs.tsx`)

**The fix is central:** DataTable or a new `TableToolbar` renders above the card. Each page needs no structural change beyond that. The analytics/settings tables inside cards may keep an in-card header (Q-13).

#### (e) Export / Import buttons outside a ⋯ menu
| File:line | Button |
|---|---|
| `pages/Orders/Orders.tsx` L1429 | Export (desktop; already in ⋯ on phone, L1398-1412) |
| `pages/Payments/Payments.tsx` L547 | Export |
| `pages/Store/Products.tsx` L1169, L1173 | Import, Export |
| `pages/Store/Inventory.tsx` L1149 | Export |
| `pages/ContactBook/Customers.tsx` L645-650 | Export |
| `pages/FormSubmissions/Newsletters.tsx` ~L622-641 | Export |
| `pages/FormSubmissions/Reviews.tsx` L538 | Export CSV |
| `components/analytics/shell/AnalyticsShell.tsx` L104-120 | Export / Export dropdown (⋯ on phone) |
| `pages/Analytics/ProductInsight.tsx` L103-111 | Export |
| `components/table/ExportImportDropdown.tsx` via `TopHeader.tsx` L70/L102 | Default `true`, but every current caller passes `false` (dormant) |

Bulk-bar "Export selected" appears in Orders, Products, Inventory, Customers and Newsletters. It is selection-scoped and not mentioned in v2 (Q-4: keep in the bulk bar?).

#### (f) Coloured or gradient avatars
- **Source:** `components/ui/Avatar` (`ui/Media.tsx` L141-156, synced), with gradients from `tokens-expression.css` L62-67.
- **Used in:**
  - `layout/Sidebar.tsx` (owner row);
  - `Orders/Orders.tsx` (Customer column);
  - `OrderDetails.tsx` L578;
  - `Payments/Payments.tsx` L324;
  - `ViewPayments.tsx`;
  - `ContactBook/Customers.tsx` L352;
  - `CustomerProfile.tsx`;
  - `FormSubmissions/Contacts.tsx` L82-91;
  - `Newsletters.tsx` L385-396;
  - `Reviews.tsx`;
  - `Blogs/Writers.tsx` L94;
  - `Settings/Staff.tsx`;
  - `AccountProfile.tsx`;
  - `analytics/common/TopList.tsx`;
  - `analytics/sales/CustomerOrderDrawer.tsx`;
  - `blogs/EditorContainer.tsx`;
  - `help/TalkToZerrorCard.tsx`;
  - `orders/CustomerCombobox.tsx`;
  - `SelectedCustomer.tsx`.
- **HeroUI `User`/`Avatar`** (default HeroUI colours): `contact/SegmentBuilderModel.tsx`, `marketing/SelectRecipients.tsx`, `Settings/Tax.tsx`.
- **The fix is one change** in `Media.tsx` (neutral `#E8EAEF` / `#1F2430`), plus replacing the HeroUI `User`.
- **Coloured icon tiles:** `ChannelCircle` and every section-coloured page tile (see c).

#### (g) Stacked or overlapping thumbnails
- **None found.** There is no `-space-x`, AvatarGroup or negative-margin stack. The only `-ml-2` (`AddEditOrders.tsx` L1238/1267) is unrelated.
- The Orders list currently has **no Items column at all**. Home Top products uses one image per row.
- The "+N" badge is needed for the new Orders Items column (and the order preview drawer).

---

### 5. Shared components: v2 → existing (S = synced with `../zcommerce-super-admin`)

| v2 component | Existing to restyle or replace | Notes |
|---|---|---|
| Title row (44px ink tile, title + count, status line, 1 primary + 1 secondary + ⋯) | `components/layout/PageHeader.tsx` **S** + `components/common/PageHeader.tsx` (section map) + `ui/IconTile.tsx` **S** | Drop `SECTION` colours; tile ink 44px; add a ⋯ slot |
| Summary panel (4 cells, gradient, mini charts, collapse, remembered) | **New.** Nearest: `ui/StatCard.tsx` `KpiStrip` **S**, `ui/VideoBanner.tsx` **S** | Collapse preference: `layout/shell-utils.ts` `readStoredFlag`/`storeFlag` + `lib/store-handle.ts` `storeKey` (localStorage) |
| Table toolbar (tabs pill group, search, filter, sort, view switch; above the table) | `ui/DataTable.tsx` `toolbar` prop **S**, `components/orders/ListToolbar.tsx`, `components/products/StoreListToolbar.tsx`, `components/table/TopHeader.tsx`, `pages/FormSubmissions/InboxToolbar.tsx`, `components/table/TabsFilter.tsx`, per-page inline toolbars | **5+ toolbars**: consolidate into one. No sort button exists today (new) |
| Segmented tabs | `ui/Tabs.tsx` `SegmentedSwitch` **S**, `ui/Primitives.tsx` `SegmentedControl` **S** | Already pills; background `#DFE1E7` vs `--zc-surface-sunken` #F2F3F5 |
| Filter drawer (420px, scrim, Clear all/Cancel/Show N) | `ui/FilterDrawer.tsx` **S** (400px), `ui/FilterChips.tsx` **S** | Width and footer check |
| Data table (radius 22, header #FAFAFB, rows 60-64, chevron end) | `ui/DataTable.tsx` **S**, `ui/table-styles.ts`, `table-state.ts`, `TablePagination.tsx` **S**; legacy `components/Table.tsx` | Row h 52 (`--zc-table-row-h`) → 60-64; add the desktop chevron; row test-id gap (CLAUDE.md §12) |
| ⋯ menu (title row and row) | `ui/RowMenu.tsx` **S**, `ui/Dropdown.tsx` **S**, `menu-styles.ts` **S**; `components/table/ExportImportDropdown.tsx`, `ColumnToggleDropdown.tsx` | Choose columns moves from the toolbar circle into ⋯ |
| Pop-up, 3 sizes (420/640/960, icon title row) | `ui/Modal.tsx` **S** (480/640/720), `ui/ConfirmDialog.tsx` **S**; legacy `components/ModalComponent.tsx`, `DeleteItemModal` | Change widths; add the icon tile; one pop-up |
| Drawer (order preview 460, notifications 420) | `ui/Drawer.tsx` **S** | Radius 22 on the open edge |
| Orb glyph (idle/listening/thinking/done; white variant) | **New.** Replaces `ui/Ai.tsx` `Sparkle`, `AiAvatar`, `AiSpectrumDefs` **S** | Used by AI line, card, bar, drafts, sign-in |
| AI card (`.ai-card`) | `ui/Ai.tsx` `AiInsightCard` / `TodaysBrief` **S** | Gradient restyle |
| AI line (`.ai-line`) | `ui/Ai.tsx` `AiSuggestion` (partly) **S**; `analytics/common/InsightCard.tsx` | New light-blue line |
| AI bar + half/full sheet | `layout/Assistant.tsx` `AskBar` **S** + `components/assistant/AskZcomPanel.tsx` (local) + `hooks/useAskZcom.ts` | Panel → bottom sheet; keep the polling logic |
| SEO ring | `components/blogs/SeoScore.tsx` (local chip) + `ui/ProgressRing.tsx` **S** (sizes 24/40/96, needs 26) | |
| Video thumbnail (16:9, 4 looks) | `components/help/TutorialCard.tsx`, `NowPlayingCard.tsx`, `TutorialVideo.tsx`, `components/home/LearnStrip.tsx` (local) | Needs real screenshots (assets) |
| Wallet capsule + 380px card | Orders inline button (L1417) + wallet pop-up in `Orders.tsx` + `walletTone` (L106) | Promote to a component; thresholds differ (see §7) |
| View switch | `ui/Media.tsx` `ViewToggle` + `useViewMode` **S** | Reuse for Products, Lookbooks |
| Pill buttons | `ui/Button.tsx` **S** + `.zc-btn` (already `--zc-radius-pill`, `components.css` L19), `ui/IconButton.tsx` **S** | Secondary colours to v2; active icon button ink |
| Status badge | `ui/StatusChip.tsx`, `Chip.tsx`, `status-map.ts` **S** | Keep green/amber/red |
| Avatar | `ui/Media.tsx` `Avatar` **S** | Neutral |
| Step tracker (order) | **New.** Nearest: `payments/PaymentTimeline`, `orders/TrackDetail.tsx` | |
| Group rule builder | **New** (replaces `components/contact/SegmentBuilderModel.tsx`) | |
| Store switcher, menu | `layout/Sidebar.tsx` **S** | |
| Command palette | `layout/CommandPalette.tsx` **S** | |

**Sync status today:**
- `diff -rq` against `D:\zcom\zcommerce-super-admin` already shows drift: `ui/RankedBars.tsx` and `layout/SupportBanner.tsx` differ; SA-only `DashboardLayout.tsx` and `PlatformNotificationsPanel.tsx`; dashboard-only `sign-out.ts`.
- `tokens.css`, `tokens-expression.css`, `theme.css` and `components.css` are identical.
- **CLAUDE.md names `../zcom-super-admin`, which does not exist.** The real folder is `../zcommerce-super-admin`.

---

### 6. Token gaps (§2 vs `src/styles/tokens.css`)

| v2 | Current | Gap |
|---|---|---|
| Font **Geist** UI, Geist Mono labels | `--zc-font-sans: "Inter Variable"` (L7-36). Only `geist-mono-regular.woff2` and Inter files are in `public/fonts`. CLAUDE.md §7 still says Geist | **Switch back to Geist; Geist Sans files are missing** |
| `--page` #EBECF0 | `--zc-bg` #E9ECEF (L39) | Change |
| `--ink` #0B0C10 | `--zc-fg` #111318, nav-bg #0E1015, `--zc-sec-ink-solid` #111318 | Add ink; decide whether text = ink |
| `--surface` #FFF | same | ok |
| `--line` #E3E4E9; rows #F1F1F4; header #FAFAFB | border #EBEBEF, border-strong #E2E3E8, divider #F1F1F4; table head **#EDF2FC / #2A3A5C** | Change border and table head |
| Muted #5F646E / #6F747E / #8A8F9A | #5F646E / #6F747E / placeholder #9599A2 | Add faint #8A8F9A |
| `--blue` #1F5EFF; secondary #EEF3FF / #1F4FD6 / #DCE5FF | primary #1F5EFF; primary-text #1747C7; soft #EEF3FF; soft-strong #DCE6FF | Small text/border diffs |
| `--ai-gradient` radial (#60A5FA → #1D4ED8 → #0B1A4F → #070E2B) | `--zc-ai-gradient` linear 115° blue→violet→pink→orange (L126) + conic | **Replace**; retire `--zc-ai-1..4`, `--zc-ai-tint` (violet), `--zc-ai-label` |
| Red #D92D20 / #FDECEC | danger #B42318 (text), danger-dot #D92D20, soft #FDECEC | Decide whether text stays the AA-darker #B42318 (Q-14) |
| Amber #F59E0B / text #A15C07 / tint #FFF4E0 | warning #A15C07, soft #FFF4E5, dot #E8890C | Dot and tint differ |
| Green #16A34A / #E8F6EE | success #18794E, soft #EAF7EF | Diff (AA question again) |
| Avatar #E8EAEF / #1F2430; store badge #23262E | gradients `--zc-avatar-1..6` | Replace |
| Radius: cards/tables/panel **22**, small cards **18**, inputs 11-12, pills 999, icon tiles 12, pop-ups 22, drawers 22 | card 16, overlay 20, banner 20, field 10, tile 12, menu 12, pill 9999 | Card 16→22, add 18, field 10→11/12, modal 20→22 |
| Page padding 28 / 32; gap 16; cell padding 0 18 | `--zc-page-pad-top` 28, `-x` 32 (L175-176); AppShell uses Tailwind `lg:px-8 lg:pt-7` | ok (padding hard-coded in AppShell classes) |
| Shadow on floating only `0 30px 70px -24px rgba(11,12,16,.35)` | shadows not checked in detail; `shadow-popover`, `shadow-sticky` exist | Align the popover shadow |
| Title 22/30 semibold; hero 44-46 / 300 + 600; table header 12/500; panel value 26/32 | title-1 24/32/600; display 40/48/**700**; kpi-xl 32, kpi-l 24 | Title 24→22; display weight 300; add a 26/32 value size |
| Motion: transform/opacity only; no backdrop-filter | glass blur tokens + `backdrop-filter` in `components.css` L114, L223, L789 | Remove (except optionally the hero buttons) |
| Overlay `rgba(11,12,16,.4)` | `--zc-overlay rgba(17,19,24,.40)` | Minor |
| Sidebar 240 | `--zc-sidebar-w` 248 | Change |
| Notification count red | `--zc-nav-count-bg` #1F5EFF | Change |

HeroUI hex mirror: `src/theme/heroui-theme.js` must change in step with these (CLAUDE.md §7).

---

### 7. §9 New behaviour: frontend data vs backend

| Item | Frontend today | Backend (read-only check of `D:\zcom\Zcom-backend`) | Verdict |
|---|---|---|---|
| Shiprocket wallet | `GET_WALLET_BALANCE` → `getWalletBalance { balance_amount }` (`graphql/shipping.ts` L23-28). Health from balance only: `walletTone`, Orders.tsx L106 (green ≥ ₹2,000, orange ≥ ₹500, red below) | `services/shipping` schema L73/L290: balance only | **Gap:** 14-day average spend / days left (the shipping cost history needs a query), auto-recharge setting, add-money flow. The v2 thresholds (days-based) differ from the current ones |
| Abandoned tab | Nothing | `services/commerce/src/models/checkout-session.model.ts` stores email/phone and an abandoned status with a TTL. GraphQL exposes only `getCheckoutSession(id)` (no list), and the TTL **deletes** abandoned sessions | **Backend gap:** list query, retention, "Send reminder" mutation |
| Customer groups (rules) | `graphql/segments.ts` CRUD with a static `customerIds` | `Segment` / `SegmentInput` have no rules (`services/customer/.../schemas/index.ts` L84-92, L221-225). Defaults: Recent, Repeat, High-Value, First-Time, Newsletter | **Backend gap:** rule engine, live count/preview, scheduled refresh |
| SEO score | Client-side `blogSeoChecks` (`components/blogs/SeoScore.tsx` L21) on Categories, Tags, Authors lists; not on Posts | No `seoScore` found in `services/blog` | **Partial.** A frontend-only score is possible from list data (slug/meta/asset); stored score = backend. Posts needs meta/content fields in the list query (unverified) |
| Inbox profile | `GET_CUSTOMER_PROFILE` (stats), `GET_CUSTOMER_ORDERS` (`graphql/customerProfile.ts`) | Exists | **Exists.** Inbox **conversations**: the backend has `getConversations`, `getMessages`, `sendAdminMessage` (customer service), **unused by the frontend**, with no channel and no assignee. Send-on WhatsApp/Email/SMS = **gap** |
| Summary collapse pref | localStorage helpers (`readStoredFlag`, `storeKey`) | No per-user preference store found | Frontend localStorage is enough per user per browser. Cross-device = backend gap (Q-15) |
| AI bar and sheet | `graphql/assistant.ts`, `hooks/useAskZcom.ts`, `AskZcomPanel` | `services/assistant` | **Exists.** UI only; static per-page suggestions |
| Order step icons | Status fields in `OrderDetails` | n/a | UI only |
| India map | `react-google-charts` GeoChart (world → IN drill-down) in `analytics/common/GeoMapMetrics.tsx` | City lat/long data not checked | **Gap:** official SVG path asset + city coordinates; live city data source unverified |

Extra data gaps found outside §9 (§1A calls these "front-end only", but the data is not in current list queries):
- Products: Sold · 30d, Revenue · 30d, Sells on, Opened no sales.
- Lookbooks: Views · 30d, Shop taps, Products count.
- Collections: visits, conversion.
- Blog: Reads.
- Orders list: item names and images.
- Payments: settlement report.
- Customers: Import.
- Help: tickets, What's new.
- Analytics overview: Visitors who buy, Blog visits (GA4 probably).
- Home: Stock to watch.

---

### 8. Open questions and risks for the designer (Mehak)

1. **Home extras:** the setup checklist, and user widget customisation (add, remove, reorder). Where do they live? Is customisation dropped (it is a capability)?
2. **Orders tabs:** where do "Pickup & manifests" (Shiprocket pickups) and New vs Ready to ship go? Returns has 7 sub-statuses: is the filter inside the Returns & RTO tab OK?
3. **Menu items with no v2 place:** Subscribers, Templates, Reviews, Restock requests, Inventory Transfers.
4. Bulk-bar "Export selected" (5 pages): keep it?
5. **Dropped columns:**
   - Payments: Order #;
   - Products: SKUs;
   - Lookbooks: Issues, Updated;
   - Blog categories/tags: Parent, In search, URL slug.
   Do they go to Choose columns or away?
6. **Analytics:** current tabs are Overview (traffic), Sales, Behaviour, Campaigns, Business insights; v2 is Overview, Sales, Customers, Traffic, Marketing. Where do Behaviour (funnel, pages, events, forms) and Business insights go? Customers is a new page.
7. **Customer groups:**
   - v2 tabs are VIP, Loyal, New, Slipping away; the backend defaults are different;
   - existing manual (static-list) segments need to migrate;
   - where do Duplicate and Delete for a group go?
8. **Inbox (biggest):** today's inbox is form messages, reviews and restock tables, not conversations.
   - Does the chat run on the unused `services/customer` conversations?
   - Do Reviews moderation (approve, hide, pin, bulk, KPIs) and Restock stay as tables somewhere?
9. Discount detail (29) is a page in v2 but an edit pop-up today. Is it a new route?
10. Summary panel = "exactly 4". Analytics Sales has 6 KPIs today, Overview 5, Reviews 4. Which 4?
11. **Profile menu:** v2 puts Your account, Switch store and Keyboard shortcuts back in it; the owner moved them to Settings on 4 Nov. Which wins? There is no real version number today (`1.0.0` hard-coded) and no What's new data.
12. ⌘K: drop the "Actions" group (Add product, Create order…) because "search only"? Customers and settings search need server/static sources.
13. Tables inside analytics/settings cards (Landing pages, Locations, Roles): does the "toolbar above" rule apply there too?
14. Status colours: v2 red #D92D20 and green #16A34A as text fail or are marginal for AA on tints; current text uses #B42318 / #18794E. Keep the darker text shades?
15. Collapse preference: is localStorage per browser OK, or must it follow the user across devices (backend)?
16. **Risks:**
    - All shared kit changes are **synced files**: `../zcommerce-super-admin` must change byte-identically (2 files already drift).
    - The DataTable toolbar move touches 29 call sites.
    - The Geist Sans font files must be added.
    - The Playwright `order-row` hook is already broken (CLAUDE.md §12).
    - The Orders row click changes from navigation to a drawer, which affects the e2e specs.

---

# Part B

## Phase 0 audit: Super Admin (zcommerce-super-admin) vs design v2

Read-only audit, 2026-11-05. Repo: `D:\zcom\zcommerce-super-admin`, branch `restyle/design-system` (2 ahead of origin; `CLAUDE.md` modified, `docs/design-v2/` untracked). No repo files were changed.
Spec: `docs/design-v2/README.md` (v2). Boards checked: 02, 45, 59–70 (58 was skipped because it is superseded).

**Main finding.** The current console is the 04 S-00 "six item" shell: Home, Stores, Subscriptions, Analytics, ZCOM AI, Settings. There are no section children. Its structure is far from the v2 SA menu. Two whole areas in v2 have no frontend, GraphQL or backend today: **Support** (Tickets, Announcements, Guides & videos) and **System health**. The store page is an 11-section two-pane card, not the v2 7-tab row. Two v2 tabs (Team, Apps) have little or no data. Parts of the CLAUDE.md directory map are out of date. For example it describes `/billing/:section` pages, but these now redirect to `/subscriptions` (`src/lib/legacy-routes.util.ts`).

Check results:
- `npm run lint:hex`: **0** raw hex outside the token files. The token files hold 126 hex values (`tokens.css`), 49 (`tokens-expression.css`) and 16 (`theme/heroui-theme.js`).
- `npm run lint:px`: 28 of the 36 allowed.
- `npm run check:synced`: **skipped**, because the script looks for `../zcom-frontend` and the checkout is `../Zcomm-frontend`. A manual `cmp` of all 70 SYNCED files against `D:\zcom\Zcomm-frontend` found that all are identical except `layout/SupportBanner.tsx` and `ui/RankedBars.tsx`. Those two differ only in line endings (CRLF): `diff --strip-trailing-cr` shows them identical.

---

### 1. Route inventory

| Route | Page component | v2 board / recipe |
|---|---|---|
| `/sign-in` | `src/pages/SignIn.tsx` (+ `layout/AuthLayout.tsx`, `layout/AuthBuddy.tsx`) | 06-Login, 07-Login-Steps (§5, label "Platform") |
| `/forgot-password` | `pages/ForgotPassword.tsx` | No board. Use §5 sign-in look, §10A |
| `/set-password?token=` | `pages/SetPassword.tsx` | No board. Use §5 look, §10A |
| `/mfa` (in the shell) | `pages/Mfa.tsx` | No board. Use the §10A Settings/record recipe (or §5 look) |
| `/` | `pages/Home.tsx` | **02-V4-SA-Home** |
| `/stores` | `pages/Clients.tsx` → `clients/ClientsPageContent.tsx` → `clients/stores-list/StoresTable.tsx` | **59-SA-Stores-Table** |
| `/stores/new` | `pages/AddClient.tsx` | No board. §10A editor recipe ("Create store") |
| `/stores/:id` → `/stores/:id/overview`; `/stores/:id/subscription` → `billing` | redirects (`App.tsx:114-115`) | n/a |
| `/stores/:id/:section` (11 sections) | `pages/ClientDetail.tsx` | **60–66** (Overview, Billing, Team, Apps, AI usage, Activity log, Settings) |
| `/clients…` | redirects | n/a |
| `/subscriptions` (`?store=` → store billing) | `pages/Subscriptions.tsx` | v2 "Billing ▸". **No SA Billing board.** §10A list recipe |
| `/billing`, `/billing/:section`, `/reminders` | `LegacyBillingRedirect` → `/subscriptions?…` | n/a (v2 menu brings "Billing ▸" back: see Q1) |
| `/analytics` → `/analytics/revenue`; `/analytics/:section` (11 tabs) | `pages/Analytics.tsx` | **67** Revenue, **68** Stores, **70** System |
| `/ai` (`?tab=`) | `pages/Ai.tsx` | **69-SA-Analytics-AI** (Analytics ▸ AI usage) |
| `/ai/settings`, `/ai/:section` | redirects | n/a |
| `/settings`, `/settings/:section` (profile, team, general, plans, discounts, billing, ai, audit) | `pages/Settings.tsx` + `components/settings/*` | No SA board. §6.15/§10A two-pane, v2 tokens (merchant 48–57 for the look) |
| `/settings/automation` | redirect → `/reminders` | n/a |
| `/dev/ui` (DEV only) | `components/ui/DevUiPage.tsx` (SYNCED) | Phase 2 showcase |
| `*` | `pages/NotFound.tsx` | No board. §10A error state |
| **Missing:** Support › Tickets / Announcements / Guides & videos, System health | none | 45-V4-SA-Tickets; the rest have no board (§10A) |

---

### 2. Per page: current vs new

#### 2.1 Home (`pages/Home.tsx`) → 02-V4-SA-Home
**Current, top to bottom:**
1. `VideoBanner` (SYNCED; time-of-day video, glass "Add store" button; `Home.tsx:55-65`).
2. `SnapshotHeader` ("Last updated · Refresh now").
3. `MoneyDueCard`.
4. `AtRiskCard`.
5. "This month" `KpiStrip` with 6 `MetricCard`s: MRR, collected, outstanding, new live, churned, AI cost (`Home.tsx:84-103`).
6. `DevelopmentCard` (new and in development).
7. `AttentionSummaryCard` (What needs attention, AI-styled; its "Ask ZCOM" prop is not passed).
8. `EarningsChart` (year).
9. `ClientsTable` preview, 10 rows, with tabs, search and filters inside the card, and "View all stores".

**New:**
- Hero: date and "PLATFORM", "Good morning, Zerror Studios", orb + AI line, chips (stores · live, GMV ↑%, payments past due), period tabs Today / 7 days / 30 days / This year, and the buttons **Announce** and **Create store**.
- Summary panel: GMV, Subscriptions (past due in red), Store health, Uptime.
- 3 "Needs you" cards: the AI one is light blue; the others are white with a red or amber dot.
- Recent activity with grey tiles and an "Activity log" link.

**Where each current block goes:**
- Money due, At risk and Development → "Needs you" cards (BILLING / ZCOM AI / ONBOARDING).
- What needs attention bullets → the hero AI line + the AI "Needs you" card.
- MRR, collected and outstanding → Analytics › Revenue summary.
- New live and churned → Analytics › Stores.
- AI cost → Analytics › AI usage.
- `EarningsChart` → Analytics › Revenue.
- Stores preview table → removed (it duplicates `/stores`).
- "Last updated · Refresh now" (`SnapshotHeader`) has **no slot** on 02. Propose ⋯ or a hero line, then ask.
- Recent activity comes from `platformAuditLog`, which exists.
- Announce has **no data**, because Announcements is missing (§6).

#### 2.2 Stores (`ClientsPageContent.tsx`, `stores-list/StoresTable.tsx`) → 59
There is **no cards view and no Onboarding page in the current code** (grep for grid, cards and onboarding routes found none). The v2 notes about those are therefore already met, but onboarding functions are spread around (see the end of this section).

**Title row:**
- Current: `PageHeader type="list" section="blue"` (`ClientsPageContent.tsx:58-72`), the count, the line "N live · N in trial · N payment due · N overdue", and **Add store**.
- New: ink tile, "Stores 3", the line "2 live · 1 in setup · 1 needs payment", **Create store** + ⋯ (Export CSV, Choose columns, Deleted stores).

**Summary:**
- Current: none.
- New: Sales · 30 days, Average health, Plans, Past due. All four can be worked out from the loaded clients; for Plans use `platformPlans` names.

**Tabs:**
- Current: segmented tabs **inside the table card** (`StoresTable.tsx:162-169`, `769-779`, `StoresToolbar.tsx`): All, Live, Trial, Unpaid, Suspended, Deleted. There is also a "Saved views" dropdown button (All stores / At risk / Overdue / Dormant / In development / Churned; `StoresTable.tsx:811-828`).
- New: **All, Live, In setup, At risk, Paused**, above the table.

**Where each current tab goes:**
- Trial → the In setup tab, or a filter-drawer lifecycle option (needs a decision).
- Unpaid → the filter drawer Payment group. The summary also shows "Past due".
- Suspended → **Paused**.
- **Deleted has no v2 tab.** Keep it reachable through ⋯ "Deleted stores" or a filter-drawer "Show deleted" option (`DeletedStoresTable.tsx`, PRD-018). Needs a decision.
- Saved views → filter drawer. At risk is a tab, so **At risk (view) and At risk (tab) must merge**; the server's `platformStoresAtRisk` is used by `AtRiskStoresTable.tsx` (now only reachable from Home's `ClientsTable`).

**Columns:**
- Current, in order: Store (gradient `Avatar` + name + slug), Plan, Status, Lifecycle, Risk, ‹Month› payment, Health (bar), Sales · 30d, Monthly fee, and Renewal (optional) (`StoresTable.tsx:142-154`).
- New, in order: **Store** (name + "Live · no products yet" line), **Owner** (name + email), **Plan**, **Health** (bar + number), **Sales · 30d**, **Orders**, **Billing**, **Last active**, then the expand chevron and the open chevron.
- Status and Lifecycle → the second line under the store name, plus the tabs.
- Risk → the At risk tab and the expanded row.
- Payment → **Billing**.
- Monthly fee and Renewal → Choose columns (⋯).
- Orders = `usage.orders30d`. Last active = `usage.lastActiveAt`. Owner = `owner.name/email`. All of these are available.

**Toolbar:**
- Current, inside the card: search, saved-views dropdown, Filter, Export icon (`:829-837`), Choose columns.
- New: tabs, then on the right search ("Store, owner or domain"), filter, sort.
- Export and Columns → ⋯.

**Row:**
- Current: the row opens `/stores/:id/overview`, and a ⋯ row menu holds Log in, View subscription, Send reminder, Edit, Copy link, Suspend/Reactivate, Delete.
- New: the chevron **opens the row in place**, showing a sales chart, store numbers (products live of total, customers, team), app statuses, and the AI "what to do" + Message owner / Open store. The store name opens the store page.
- Keep the row ⋯ menu: it is allowed (§4.4).

**Onboarding capabilities that must survive under "In setup":**
- `OnboardingCard.tsx` (provisioning progress + retry, `RetryTenantProvisioning`).
- `StoreSetupCard.tsx` (`platformStoreSetup`).
- `StoreGoLiveCard.tsx` (domain verification, checklist, Mark live).
- Home `DevelopmentCard`.
- The lifecycle "Set up" filter and the legacy `?tab=setup` (`StoresTable.tsx:216-219`).
- The saved view "In development".

All of them need to be reachable from the In setup tab and from the store page. The board shows only the list.

#### 2.3 Store detail (`pages/ClientDetail.tsx`) → 60–66
**Header:**
- Current: `PageHeader type="detail"` with a back link, store name, Status + Payment + payment-app chips, meta "owner · email · domain ↗", and, by section: **Log in to store** + ⋯ store menu, or on Billing: Log in + Change plan + ⋯ billing menu (`:465-481`). There is also a missing-owner-email `InlineNotice`.
- New: breadcrumb "Stores / Name", a neutral tile with initials, name + Live + plan chip, meta "legal name · domain · city · on Zcom since …", **Message owner** (secondary), **Open store admin →** (primary = Log in to store), and ⋯.
- The two ⋯ menus (`storeMenu` `:421-442`, `billingMenu` `:446-463`) merge into one ⋯, or stay per tab.

**Navigation:**
- Current: a left two-pane section card (`SettingsShell`, `:533-539`) with 4 groups and 11 sections: Store (Overview, Store details, Profile, Go live) · Billing (Billing & plan, Usage history) · Insights (Analytics, ZCOM AI, Activity, History) · Manage (Lifecycle).
- New: a **horizontal tab row** with 7 tabs. Each tab should keep a URL, `/stores/:id/:tab`, with redirects from the old section keys.

| v2 tab | Current sources (all must survive) | Board blocks; data gaps |
|---|---|---|
| **Overview** (60) | `overview`: `OnboardingCard`, `StoreSetupCard`, `ClientOverviewTab` (KpiStrip: Sales·30d, Orders·30d, Health, Monthly fee; `AiInsightCard` via `aiSamples.storeInsight`; `ClientPerformanceCard` chart; health factors card; `ClientUsageTab` plan usage; Profile key-values; `NotesCard`). Also `StoreHealthCard` (from `analytics`). | AI banner (ai-line, Schedule a call) ← `AiInsightCard`. Summary: Sales·30d, Orders, **Products live "of 61"**, **Customers + subscribed**. Store health list ← health factors + `StoreHealthCard`. **Connected apps** ← integration-health rows. Activity ← `platformAuditLog`. Plan & billing card ← usage + subscription. Owner (Email / WhatsApp) ← Profile. Notes ← `NotesCard`. The `ClientPerformanceCard` chart has no slot (propose Billing or remove; ask). Fee moves to Plan & billing. |
| **Billing** (61) | `billing`: `StoreBillingStateCard`, `StoreBillingSection` (plan card, `StorePaymentsCard` payments/invoices/reminders switch, credits `ClientPlatformBilling`, grace-period override, custom plan), `usage` (`ClientUsageHistory`). Billing ⋯: Record payment, Issue credit, Record refund, Mark past due, Extend trial, Activate, Reactivate, Cancel. | Current plan card (Extend free period, Change plan); next invoice, pays with, billing email, GSTIN; Invoices table ("Download all"); Plan limits (staff, products, AI questions, emails); Adjust (Add a credit, Give a discount, Ask for a card). Payments list, reminder log and usage history have no slot on 61 → keep as sections below or behind a switch. "Download all" (bulk PDFs) and "Ask for a card" are **not in the frontend**. |
| **Team** (62) | none (only `usage.staffCount`) | Person / Role / Two-step / Last active, plus the 2FA warning banner. **No per-store staff query in `src/graphql`**. Backend needed (§9 lists nothing for it) → ask. |
| **Apps** (63) | `analytics` section: `ClientAnalyticsCard` (GA4 sync health, data through, re-run). `IntegrationHealthTab` rows (all stores; `IntegrationHealthFilter` has no `tenantId`, only `search`). | Summary (Connected, Need attention, Payments through, Last full sync); tabs Connected / Need attention / Suggested; grid table **App, Type, Status, Last sync, Note, Action**; "Suggested for this store". Last sync ← `lastSyncAt`. Note ← `lastError` only. Actions such as "Move to Cashfree", "Make default" and "Ask owner to reconnect" have no mutation. **Suggested has no data.** The tenant filter is missing (search by slug only works client-side). |
| **AI usage** (64) | `ai`: `ClientAiCard` (status, pause, per-store limit override, month usage, top questions `AiTopQuestions`). | Summary: Questions (have) / **Actions done by AI** / Cost (have) / **Answers marked helpful**. "What they asked" (have questions; **asker, page and rating not known**). "Where they use it" (**no page data**). The pause and override controls have no slot on 64 → ⋯ or Settings › Features. |
| **Activity log** (65) | `activity` (`ClientActivityCard`, `platformAuditLog` by targetId) + `history` (`StoreHistoryCard`, statusHistory) | Chips Everything / People / Money / Apps / Settings / Zcom team, a day-grouped table, and **Export log** as a title-row button (this conflicts with §4.1: put it in ⋯). The board shows **merchant-side events** (invites, sign-ins, GST change, city/browser). The console audit log holds staff actions only → data gap. |
| **Settings** (66) | `details` (`StoreDetailsCard`), `profile` (`StoreProfileCard`), `go-live` (`StoreGoLiveCard`, `StoreSetupCard`), `lifecycle` (`StoreLifecycleCard`, `MoneyInFlightPanel`, suspend/reactivate/delete/restore). Header ⋯: Resend owner invite, Copy link. | Store card (Web address Change ← go-live domain verification; Store owner **Transfer** (no mutation); Region and currency). **Features for this store** toggles (no per-store flag API; plans have `features`). **Support access** switch (no data). Careful: Pause ← suspend, Close ← delete. Profile (category, source, tags, account manager, planned go-live) and the go-live checklist have **no slot on 66** → extra cards. "Save changes" as the title-row primary. |

#### 2.4 Billing ▸ (`pages/Subscriptions.tsx`) → no SA board
**Title row:**
- Current: `section="green"` tile; a description with paid · due · overdue · to collect; `DateRangeComparison`; and an **Export ▾** button with Subscriptions / Invoices / Payments CSV (`:569-603`).
- New: ink tile; a secondary period control; ⋯ holding the three exports.

**Summary panel (new):** Paid, Due, Overdue, To collect. These numbers are already worked out (`summary`).

**Tabs:** Active, Due & overdue, Trial, Cancelled. Today they sit inside the card (`:606-614`); v2 puts them above the table.

**Columns:** Store and plan, Payment, Last payment, Next due, Health*, Owner email*, Quick action (*optional).

**Kept as they are:** filter drawer (Payment, Renews, Plan, Billing cycle, Health, Payment issues incl. flagged/stuck), bulk Send reminder, row menu.

**What v2 leaves open:** the "Billing ▸" sub-items. Old merged pages (Invoices, Transactions, Flagged, Stuck, Reminders) are now `?issue=`/`?tab=` slices (`legacy-routes.util.ts`). §3.1's slices rule says to keep them as tabs, but the chevron in the menu implies children. **Ask (Q1).** The unused `components/payments/StalePendingPayments.tsx` has an in-card toolbar.

#### 2.5 Support ▸ Tickets / Announcements / Guides & videos → 45 (Tickets only)
**Nothing exists:** no route, page, hook or GraphQL operation.

Board 45 shows:
- Title "Tickets", with **New ticket for a store** + ⋯.
- Summary: Open, Waiting on a store, **First reply (median)**, Solved this week.
- Tabs: Open, Waiting on store, Solved, Mine.
- Columns: Ticket (title + ID · topic · attachments), Store, Priority, Status, Assigned, Reply due, then the chevron.

Announcements and Guides & videos have no board (§10A list recipe; guides use video thumbnails §4.8). This is **T1: PRD + backend** (tickets model, SLA timers, announcements fan-out to merchants, guides CMS). The merchant app's My tickets (44) would share the model.

#### 2.6 Analytics (`pages/Analytics.tsx`) → 67 / 68 / 70, plus `/ai` → 69
**Current page:**
- One `PageHeader section="amber"`, with **Export** (secondary) for revenue, store-sales and performance (`:117-137`).
- One segmented row of 11 tabs, above the content (good): Platform revenue, Store sales, Performance, Integration health, Sync monitor, Money, Retention, Platform health, Usage, Merchant sales, AI cost.
- Period controls per tab (a range picker, 7/30/90 days, a Select).

**New:** 4 menu sub-pages, Revenue / Stores / AI usage / System. Each has a title "Analytics · X", a period pill + ⋯ (Export inside), and a summary panel instead of number strips.

Proposed mapping. It needs approval, because v2 has fewer pages than today's tabs:
- **Revenue (67)** ← Platform revenue (`RevenueReportsTab`: MRR history, movement table, revenue by plan in `planColors`), Money snapshot, Store sales / Merchant sales (GMV), Home's `EarningsChart`.
  - Board blocks: summary (Subscription revenue, GMV, Paying stores, Past due); AI line "Open Billing"; Sales across stores; From sign-up to paying funnel; Revenue by store; AI usage and System mini cards.
- **Stores (68)** ← Retention, Usage (dormant), Performance, Store sales.
  - Board blocks: summary (Stores, Days to first sale, Average health, Stores lost); sign-up → first-sale funnel; **Setup checklist by store** matrix. `platformStoreSetup` exists, but only per tenant; a matrix needs N calls or a list query (see §6).
- **AI usage (69)** ← the whole `/ai` page and the AI cost tab.
  - Current `/ai`: title with **AI settings** + **Export** buttons (`Ai.tsx:116-128`), an AI-gradient tile (`:52`), a KpiStrip (Spend today, Spend this month, Questions, Cache hit rate), and 5 tabs **inside the table card** (`AiToolbar`, `ai/ai-table.tsx:9-15`): Usage by store, Spend by model, Top-up requests, Data health, Benchmarks.
  - Board 69: summary (Questions, **Actions taken**, Total cost, **Marked helpful**), By store, **What it's asked about** (topics), Model and limits ("Change in Settings").
  - **Top-up requests (an action queue, with the menu count pill), Data health and Benchmarks have no place on 69.** They must not be lost; propose tabs or sections below. Ask (Q4).
- **System (70)** ← Integration health, Sync monitor, Platform health snapshot.
  - Board blocks: summary (**Uptime**, **Store page speed**, Errors, **Open incidents**), "Open status page", per-service daily bars (30 days), Incidents. Most of this is **not in the frontend** (§6).

#### 2.7 System health (v2 menu item) → no board
Nothing exists. Board 70 "Analytics · System" already covers system data, so the separate menu item either duplicates it or is a live ops view (re-run sync, dead letters, job runs `PlatformJobsCard`). **Ask (Q2).**

#### 2.8 Settings (`pages/Settings.tsx`, `components/settings/*`) → no SA board (§6.15 two-pane stays)
**Current:**
- Two-pane `SettingsShell` with groups Your account (Profile & security, Team & roles), Platform (General, Plans & pricing, Discounts, Payments & billing rules, ZCOM AI settings) and Records (Audit log).
- Keyboard shortcuts and Sign out everywhere are dialogs.
- `PageHeader section="slate"` (`Settings.tsx:89-92`).
- In-card toolbars:
  - `AuditLogSettings.tsx:174-185` (search + filter inside the table).
  - `CouponsTab.tsx:305-307` (`TableToolbar`).
  - `TableCardHeader` titles in Team, Plans, Profile sessions. These are titles only, which is acceptable.

**New:** the same structure on v2 tokens. Move search and filter above the tables in Audit log and Discounts. The profile menu's "Your account" links to `/settings/profile`.

#### 2.9 Sign in (`pages/SignIn.tsx`, `AuthLayout.tsx`, `AuthBuddy.tsx`) → 06/07
**Current:**
- Dark page `--zc-auth-bg #08090C`, a dot grid, and a centred 380px **card with a rotating conic spectrum edge** (`.auth-edge`, `tokens.css:402-415`).
- A centred "Zcom" wordmark + "Super admin".
- Title "Log in", subtitle "Zerror team access only.".
- An `AuthBuddy` chat helper, steps email → password → TOTP in the same card (already one question at a time since 2026-11-04), and a footer "© Privacy Terms".
- No Google or Apple buttons.

**New:**
- Pure black, with no card. Wordmark top left with the label **"Platform"**; tagline bottom right; blue halo + orb in the centre whose eyes track the typing.
- Steps email → password → "Getting your store ready…" → retry, with a red edge on failure.
- Keep the TOTP step (§5 "2-step code follows as in v1.4") and the Forgot password link.

`AuthLayout` and `AuthBuddy` are SYNCED, so the change must land in both apps. The label "Super admin" is set in 4 pages (`SignIn.tsx:141`, `ForgotPassword.tsx:65,84`, `SetPassword.tsx:71,80`); the sidebar uses `productLabel: "Super admin"` (`DashboardLayout.tsx:160`); board 02 shows "Platform admin".

#### 2.10 Pages with no board (Phase 8, §10A)
- `AddClient` (form/editor).
- `Mfa`, `ForgotPassword`, `SetPassword` (§5 look).
- `NotFound` (error state).
- The notifications panel `PlatformNotificationsPanel` (tabs Payments / Stores / Health; §10A says a 420px right drawer with tabs).

---

### 3. Shell

**Menu:**
- Current (`config/navigation.ts:11-20`): Home, Stores (grey count), Subscriptions (orange count), Analytics, ZCOM AI (blue count, gated `platform:ai:read`), Settings. It is already flat, with no group headings and no children.
- Bottom: Notifications (blue count pill), a divider, and the owner row (gradient `Avatar`) with the collapse button (`Sidebar.tsx`, SYNCED).
- Top: the "Zcom" wordmark + "Super admin" text. There is no badge or store switcher.
- v2: Home, Stores (count), **Billing ▸**, **Support ▸** (Tickets, Announcements, Guides & videos), **Analytics ▸** (Revenue, Stores, AI usage, System), **System health**, Settings, then the profile row.
- Top in v2: a neutral "Z" badge + "Zcom / Platform admin", then search.

| Current item | v2 place |
|---|---|
| Subscriptions | Billing ▸ (children unknown, Q1). The orange "needs action" count keeps its place on Billing |
| ZCOM AI | Analytics ▸ AI usage. The open top-ups count loses its menu pill (Q4) |
| Analytics tabs | Analytics ▸ 4 children; the rest per §2.6 |

**Other shell notes:**
- The sidebar has **no chevron or sub-item rendering for one-level sections in use**. `NavList` supports `children` (merchant), but SA passes none.
- Width: 248px today vs 240px in v2. Collapsed: 64px vs a 72px rail (§10).
- The account menu has only "Sign out" plus the name, email and version (`DashboardLayout.tsx:170-172`). v2 wants Your account, Keyboard shortcuts, Log out, and the version with a What's new link. SA has no What's new page: ask.

**Top bar:**
- Desktop (≥1024) already has **no top bar**.
- Under 1024, `AppShell.tsx:78-99` (SYNCED) draws a 56px black top bar: menu button, "Zcom / Super admin" (`DashboardLayout.tsx:185-186`), search icon, and the bell (`mobileActions`, `:193-203`).
- §10: on a phone a top row is allowed (store switcher, search, menu). At 768–1023 the menu becomes a 72px icon rail, so the **tablet top bar must go**.

**Search ⌘K:**
- The sidebar capsule "Search stores ⌘K" (`Sidebar.tsx:210-231`) matches v2.
- `CommandPalette.tsx` (SYNCED) groups Pages, Stores and Actions, **plus an "Ask Zcom AI: ‹query›" row** (`CommandPalette.tsx:135-139`, wired `DashboardLayout.tsx:233`). That row must be removed: search only.

**AI entry points:**
- **AskBar**: a floating bottom-centre pill, 560px wide, with a spectrum ring, sparkle and ⌘J chip, that hides on scroll-down (`Assistant.tsx:46`, `AppShell.tsx:109-136`, `DashboardLayout.tsx:188-192`). It **stays as the one entry point** but is restyled: orb, 600px × 54px, one page chip, and placeholder "Ask Zcom AI about any store…".
- **AskZcomPlatformPanel**: a right drawer with chat, history and usage bar (`assistant/AskZcomPlatformPanel.tsx`; `DashboardLayout.tsx:236-243`). It becomes the half-height bottom sheet → full view with history on the left (§3.3, 46-AI-Full).
- **⌘J**: `shell-utils.ts:25-27`. Keep it.
- **TodaysBrief**: `ui/Ai.tsx:87` (SYNCED) has an "Ask AI" button (`:97-100`). SA pages don't use it (DevUi only); `lib/aiSamples.platformBrief` is used only by tests. Retire the button in the kit.
- **AiInsightCard**: used on the store Overview (`ClientOverviewTab.tsx:70`) with `aiSamples.storeInsight`. It is contextual, so keep it, restyled as the §4.8 ai-line or AI banner with the orb.
- **lib/aiSamples.ts**: rule-based brief and insight text. Its only live consumer is `ClientOverviewTab`.

---

### 4. Hit lists

#### (a) Top bar
- `src/components/layout/AppShell.tsx:78-99` (SYNCED): the black top bar, `lg:hidden`. Its title and subtitle come from `DashboardLayout.tsx:184-186`, and its bell from `DashboardLayout.tsx:193-203`.
- `--zc-topbar-h-mobile` and `bg-topbar` tokens (tokens.css).
- `AppShell.tsx:36-38`: the `banner` and `topBanner` slots. SA passes neither. The synced `SupportBanner.tsx` (a full-width amber strip, `zc-sec-amber`) is not used in SA.
- The "incomplete store data" warning above every page (`DashboardLayout.tsx:206-213`) is not a top bar, but keep it visible in the new layout.

#### (b) AI entry points
**To remove or merge:**
1. `layout/CommandPalette.tsx:26-27, 135-139` + `DashboardLayout.tsx:233`: the ⌘K "Ask Zcom AI: …" row.
2. `ui/Ai.tsx:73-74, 97-100`: the `TodaysBrief` "Ask AI" button (kit only).
3. `insights/home/AttentionSummaryCard.tsx:28-29, 39-41`: the "Ask ZCOM" button prop. It is dormant (Home doesn't pass it), but remove it.

**To restyle (the one entry point):**
4. `layout/Assistant.tsx:46-80` `AskBar` + `AppShell.tsx:132-136` slot (max-w 560) + `components.css:696-717` (spectrum ring).
5. `assistant/AskZcomPlatformPanel.tsx` (the right drawer becomes the bottom sheet; `Sparkle` at `:291`).
6. `layout/shell-utils.ts:25` (⌘J).

**Sparkle or spectrum glyphs to become the orb:**
- `ui/Ai.tsx:14-55` (`Sparkle`, `AiAvatar`, `AiSpectrumDefs`).
- `CommandPalette.tsx:15-18`.
- `Assistant.tsx:62`.
- `AttentionSummaryCard.tsx:37`.
- `pages/Ai.tsx:52` (the page tile).
- `ClientOverviewTab.tsx:70` (`AiInsightCard`).

**Contextual AI that stays:**
- The store insight (`ClientOverviewTab.tsx:70`).
- The What needs attention content (into the Home hero line and AI card).
- `ClientAiCard` pause and override (controls, not "Ask AI").
- AI settings (`settings/AiSettings.tsx`).
- `PlanEditorModal.tsx:362` "Ask ZCOM and AI insights" is a plan feature label, not an entry point.

#### (c) Colours outside §2.1
**Retired section colours:**
- `styles/tokens-expression.css:10-23` (8 palettes: blue, violet, teal, green, amber, coral, pink, slate) and `:111-124` (`.zc-sec-*` classes + tinted header gradient).
- `ui/IconTile.tsx:5-8` (`sectionClass`).
- `layout/PageHeader.tsx:4, 33, 145, 163` (`section` prop).
- Callers that pass a section:
  - `ClientsPageContent.tsx:61` (blue)
  - `pages/Analytics.tsx:121` (amber)
  - `pages/Subscriptions.tsx:572` (green)
  - `pages/Settings.tsx:92` (slate)
  - `pages/Mfa.tsx:111` (slate)
  - `SupportBanner.tsx:43` (amber)
- `ui/EmptyState.tsx:14` tints by section.

**Channel colours:** `tokens-expression.css:26-29` (email blue, SMS violet, WhatsApp green). The SA reminder channels may use them.

**AI spectrum (violet, pink, orange):**
- `tokens.css:122-129` (`--zc-ai-1..4`, `--zc-ai-gradient` linear 115°, `--zc-ai-conic`, violet tint).
- `tokens.css:244` (`--zc-ai-label #6236D9`).
- Used by `components.css:122-150` (AI ring), `:696-717` (ask bar), `:806-812` (AI card), `tokens.css:382-393, 406-412` (`.auth-edge` conic halo, AI edges), and `tokens-expression.css:146-150` (spectrum button).
- These are replaced by the single `--ai-gradient` radial (blue).

**Plan and chart colours:**
- `ui/chart-theme.ts:66-83` (SYNCED) `planColors` maps to categorical `--zc-chart-cat-1..6` = blue `#1F5EFF`, **violet `#8B6CFF`, teal `#14A3A3`, orange `#E8890C`, pink `#E5487A`**, grey (`tokens.css:152-157`).
- Consumer: `billing/RevenueReportsTab.tsx:307`.
- Board 67 itself uses orange/teal/violet store series and a blue/violet funnel; board 69 uses violet-pink bars. These **conflict with §2.1**: ask whether chart series are exempt (Q6).

**Gradients other than the AI gradient:**
- Avatars `tokens-expression.css:62-67` (6 gradients).
- Welcome banner `tokens-expression.css:33, 127-143` (light violet). It is unused, because SA Home uses `VideoBanner`.
- `--zc-banner-scrim*` `tokens.css:261-262` (the VideoBanner scrim).
- Glass `backdrop-filter`: `components.css:114-115, 789-790`, `tokens.css:259-260`. Only the hero buttons may keep it (§2.4).
- Functional and fine: `ColorPicker.tsx:185,206`, mask gradients, skeleton shimmer `components.css:449`, radio dot `:390`.

**Base palette drift vs §2.1:**
- Page `--zc-bg #E9ECEF` vs `#EBECF0`.
- Nav `--zc-nav-bg #0E1015` vs ink `#0B0C10`.
- Card radius `--zc-radius-card 16px` vs 22.
- Field radius 10 vs 11–12.
- Modal widths 480 / 640 / 720 (`tokens.css:314`) vs 420 / 640 / 960.
- Filter drawer 400 (`FilterDrawer.tsx:15`) vs 420.
- Sidebar 248 vs 240.

**Raw hex in components:** 0 (`lint:hex`).

#### (d) Tabs or search inside a table card
`ui/DataTable.tsx:288-294` (SYNCED) renders `toolbar` **inside** the card. Every caller below puts tabs and/or search inside:

**Tabs + search inside the card:**
- `stores-list/StoresTable.tsx:810, 874` (`StoresToolbar.tsx:18-31`)
- `stores-list/DeletedStoresTable.tsx:93, 149, 188`
- `clients/ClientsTable.tsx:561-584, 595, 678` (Home preview; HeroUI `Tabs`)
- `clients/AtRiskStoresTable.tsx:85, 152`
- `clients/RemovedStoresPanel.tsx:74, 134, 164`
- `pages/Subscriptions.tsx:606-623, 678`
- AI tabs via `AiToolbar` (`ai/ai-table.tsx:9-15`): `AiUsageTab.tsx:118-120`, `AiModelsTab.tsx:80-82`, `AiTopUpsTab.tsx:136-166` (+ status `SegmentedSwitch`), `AiDataHealthTab.tsx:81, 101`, `AiBenchmarksTab.tsx:78-100`
- `analytics/analytics-shared.tsx:122, 152` (`TableCard` with a `SegmentedSwitch`)
- `analytics/IntegrationHealthTab.tsx:186, 281`
- `components/payments/StalePendingPayments.tsx:55` (unused)

**Search only inside the card:**
- `billing/CouponsTab.tsx:305-307`
- `settings/AuditLogSettings.tsx:174-185`

**Tabs inside a card header (switch):**
- `clients/StorePaymentsCard.tsx:137, 149, 270, 471` (Payments / Invoices / Reminders switch + status switch)
- `layout/PlatformNotificationsPanel.tsx:269` (a drawer, acceptable)

**Card titles only (acceptable):** `TableCardHeader` in `ClientPlatformBilling.tsx:149`, `StoreStuckPayments.tsx:41`, `PlansSettings.tsx:179`, `TeamSettings.tsx:240`, `ProfileSecuritySettings.tsx:256`.

**Dropdown-style filters that v2 sends to the drawer:**
- The "All stores ▾" saved-views button (`StoresTable.tsx:811-828`).
- `ClientsTable.tsx:607-640` `FilterSelect`s.
- The Analytics snapshot period `Select` (`Analytics.tsx:162-176`). This is a period control, so it can probably stay as the title-row period pill.

#### (e) Export or Import buttons outside a ⋯ menu
- `pages/Subscriptions.tsx:582-600`: Export ▾ (Subscriptions / Invoices / Payments CSV) in the title row.
- `pages/Analytics.tsx:124-135`: Export in the title row.
- `pages/Ai.tsx:123-125`: Export in the title row (+ an "AI settings" secondary button at `:120-122`).
- `stores-list/StoresTable.tsx:829-837`: an Export icon button in the table toolbar.
- Board 65 itself shows "Export log" as a title-row button (it conflicts with §4.1).
- No Import buttons exist in SA.
- Per-row "Download PDF" (`InvoiceRowActions.tsx:137`, `StorePaymentsCard.tsx:518`) is in row menus, which is fine. `InvoiceParts.tsx:115-122` is a button in the invoice dialog, which is acceptable.

#### (f) Coloured or gradient avatars
- `ui/Media.tsx:141-157` (SYNCED) `Avatar` → `--zc-avatar-1..6` gradients (`tokens-expression.css:62-67`). Used in:
  - `stores-list/StoresTable.tsx:690` (store rows)
  - `layout/Sidebar.tsx:265` (owner row)
- `ui/Ai.tsx:44-55` `AiAvatar` (spectrum circle), used by `AttentionSummaryCard.tsx:37` and as the AI page tile (`pages/Ai.tsx:52`). It becomes the orb.
- `ClientsTable.tsx:448-452` already uses neutral `bg-surface-sunken` initials.
- **The boards contradict §2.1.** 59, 60–66 and 45 show orange, blue and purple gradient store avatars, coloured app tiles on 60 (green N, purple S, orange M) and a violet plan chip "Growth". The text wins (neutral grey), but confirm (Q6).

#### (g) Stacked thumbnails
None in SA. There are no product photos; `AttentionList` "stacked" is a layout name, not images.

---

### 5. Shared components → v2 components
Nearly all of `components/ui/*` and 9 `components/layout/*` files are **SYNCED** (70 files, first-line marker). Every Phase 2 change must be made byte-identical in `D:\zcom\Zcomm-frontend` (and the `check:synced` path needs fixing: see Q8).

| v2 component | Existing piece | Gap |
|---|---|---|
| Title row (§4.1) | `layout/PageHeader.tsx` (S; types list/page/detail, count, description, actions, badges, back) + `IconTile.tsx` (S) | Ink 44px tile (now a section colour, 40px); breadcrumb for detail; ⋯ slot convention |
| Summary panel + collapse (§4.2) | `StatCard`/`KpiStrip` (S), `insights/MetricCard.tsx`, `VideoBanner` tiles | **New component** (gradient, 4 cells, mini charts, collapse with a per-user, per-page preference (§9)) |
| Toolbar above the table (§4.3) | `common/TableToolbar.tsx`, `stores-list/StoresToolbar.tsx`, `ai/ai-table.tsx AiToolbar`, inline toolbars in Subscriptions/Audit | Consolidate into one; move it out of `DataTable`'s `toolbar` slot; add a sort icon button (none today; sort is by headers) |
| Segmented tabs with counts | `ui/Tabs.tsx` `SegmentedSwitch`, `TabLabel` (S); HeroUI `Tabs` in `ClientsTable` | Restyle (`#DFE1E7` track, white active) |
| Filter drawer (§4.3) | `ui/FilterDrawer.tsx` + `FilterButton` (S), `common/AppliedFilters.tsx` | 400 → 420px; "Show N results" exists via `countResults` |
| Data table (§4.4) | `ui/DataTable.tsx` (S), `table-state.ts`, `table-styles.ts`, `TablePagination.tsx` (S), `common/dataTableStyles.ts` | Row 60–64px, chevron end, in-place row expand (Stores) is **new**, the preview-drawer pattern |
| ⋯ menu | `ui/RowMenu.tsx` (S), `ui/Dropdown.tsx`, `menu-styles.ts` | Title-row ⋯ usage (Export, Columns) |
| Pop-up sizes (§4.6) | `ui/Modal.tsx` (S; sm 480, md 640, lg 720), `ui/ConfirmDialog.tsx` (S), `common/ConfirmModal.tsx` (+ `modalStyles.ts`) | 420/640/960; icon title row; 35 `<Modal>` and 15 confirm usages to check |
| Orb glyph (§3.4) | `ui/Ai.tsx` `Sparkle`/`AiAvatar`/`AiThinking` (S) | **New** (4 states, `.glyph.w`) |
| AI card / AI line (§4.8) | `ui/Ai.tsx` `AiInsightCard`, `TodaysBrief` (S); `AttentionSummaryCard` | Restyle to the blue gradient and the light-blue line |
| AI bar + sheet (§3.3) | `layout/Assistant.tsx` `AskBar` (S), `assistant/AskZcomPlatformPanel.tsx`, `AiUsageBar.tsx` | Sheet half/full, page chip, dimmed page |
| View switch | none in SA (SA Stores is table only) | Kit only |
| Pill buttons (§4.5) | `ui/Button.tsx` (S; variants primary, secondary, tertiary, glass, danger…), `IconButton.tsx` (S) | 36px pills, light-blue secondary, ink "active" icon button |
| Hero band (§6.1/§7) | `ui/VideoBanner.tsx` (S, video loop + glass) | **New** gradient hero with lights, chips and period tabs |
| Sidebar / shell | `layout/Sidebar.tsx`, `AppShell.tsx`, `CommandPalette.tsx` (S) | Badge, one-level chevrons (exists for the merchant), 240/72px, no tablet top bar |
| Two-pane Settings | `ui/SettingsShell.tsx`, `TwoPane.tsx` (S) | Keep for Settings; the store page moves off it to tabs |
| Health bar / score | `stores-list/StoreHealthBar.tsx`, `ui/HealthScore.tsx`, `ProgressRing.tsx` (S) | Board 60 ring is green; OK (status) |

---

### 6. Data gaps (SA boards vs `src/graphql`)

| Board item | Status |
|---|---|
| **Uptime** (02, 70), store page speed, errors %, open incidents, per-service daily status bars, incidents list, status page link | **None.** The nearest are the `platformMetrics` HEALTH section (failures, stuck events, webhooks, gateways) and `platformWebhookHealth` (exists on the backend, not read) |
| **Store health** average / "67 of 100" (02, 59, 68) | Average can be computed from `healthScore` on loaded clients (frontend) |
| Hero period tabs on Home (Today / 7d / 30d / This year) | `platformAttention` has no period; `platformMetrics(period)` periods differ. Partial |
| GMV with growth % (02) | `usage.revenue30d`/`growthPercent` per store; `platformStoreSales(range)` totals per currency. Available but has to be added up per currency |
| Announce (02), **Announcements** page | **None** |
| **Support tickets**, first-reply median, waiting on store, SLA "Reply due", assignee, priority | **None** |
| Guides & videos | **None** (static content possible?) |
| Stores row expand: daily sales bars per store | **None** (monthly `platformUsage` snapshots only) |
| Stores: Products live "52 of 61", **Customers**, "Team 7 of 25" | `usage.products` (one number), `staffCount`; plan limits have staff. **No customers count, no live vs total** |
| Store › Overview "Customers · 100 subscribed", "11 sizes sold out" | Customers: none. Sold out ≈ `health.stockOutVariants` |
| Store › **Team** (people, roles, two-step, last active, 2FA banner) | **None** (only `staffCount`) |
| Store › **Apps**: Type, Status, **Last sync**, **Note**, Action; summary "Payments through", "Last full sync"; **Suggested for this store** | `platformIntegrationHealth` has provider, channelType, status, lastSyncAt, lastError, but **no `tenantId` filter** (`IntegrationHealthFilter`: provider, channelType, status, search). `paymentProvider` on the profile. No app actions (make default, migrate gateway). **Suggested: none** |
| Store › AI usage: actions done by AI, answers marked helpful, asker name, page used, topic | Have questions count, cost, top questions (`AiTopQuestions`). **No actions, ratings per store, page, asker** |
| Analytics › AI usage: "What it's asked about" topics, "Marked helpful %" | **None** (`PlatformAssistantRateMessage` rates staff chat only) |
| Store › Activity log: merchant-side events, location · browser, category chips | `platformAuditLog` = console staff actions. **No merchant event feed** |
| Store › Settings: Features for this store toggles, Support access switch / expiry, Transfer owner | **None** (plan `features` only; `ImpersonateTenant` exists, but no owner-granted access window) |
| Store › Billing: "Download all" invoices, "Ask for a card", "Give a discount" per store, Emails this month limit | PDFs are per invoice (`PlatformInvoicePdf`); coupons apply per invoice (`ApplyCouponToInvoice`); messages this month exists. Download all / ask for a card: none |
| Analytics › Stores: days to first sale, sign-up → first-sale funnel, setup checklist matrix | `platformStoreSetup` per tenant only; funnel and first-sale date not exposed |
| Analytics › Revenue: sign-up → paying funnel, sales across stores by day | Partial (MRR history, collections); daily per-store GMV none |

All of these need T1 PRDs / backend. §9 covers none of the SA items, so each needs a decision (keep the board slot empty, hide it, or open a PRD).

---

### 7. Open questions and risks

1. **Billing ▸ children.** What sits under Billing (Subscriptions, Invoices, Payments, Discounts, Plans)? v2 has no SA Billing board, and 04 S-00 merged these pages into one. Plans and Discounts currently live in Settings.
2. **System health vs Analytics › System (70).** Are they one page or two? If two, what does System health hold (live ops: sync re-run, dead letters, job runs, Run now)?
3. **Support area.** Tickets, Announcements and Guides are a new T1 feature (model, backend, merchant counterpart). Should Phase 6 build the UI on empty or mocked data, hide the menu items, or wait for a PRD?
4. **ZCOM AI → Analytics › AI usage.** Where do Top-up requests (with its count pill), Data health, Benchmarks, Spend by model, and the AI settings shortcut live? Board 69 has none of them.
5. **Stores tabs.** Where do Trial, Unpaid and especially **Deleted** (PRD-018 restore and purge countdown) go, given that v2 tabs are All / Live / In setup / At risk / Paused? Should the "At risk" saved view (client signals) and the server `platformStoresAtRisk` list merge into one tab?
6. **Boards vs text.** The boards show gradient store avatars, coloured app tiles, a violet plan chip, multicolour chart series (67, 69) and an "Export log" button (65). §0 says the text wins: please confirm that charts are not exempt.
7. **Store page sections with no v2 slot:** Profile (PRD-025), Go live checklist, History, Usage history, the Performance chart, the GA4 re-run, the grace-period override, payments and reminder log. The proposal is extra cards inside Settings, Billing, Apps and Activity log; please confirm.
8. **SYNCED kit.** 70 files must change in lockstep with `Zcomm-frontend`. The `check:synced` script points at `../zcom-frontend` (missing), so it silently skips. Fixing the path (T2) should come before Phase 1, or drift will go unnoticed. CRLF/LF differences exist on 2 files.
9. **Precedence vs PRD-024 D5.** CLAUDE.md §4 (`CLAUDE.md:150`) still says the Ask AI bar, panel and ⌘K "Ask AI" stay as they were. The new `## UI` precedence note (`CLAUDE.md:156`) overrides it, but line 150 should be updated so later sessions don't follow it.
10. **Docs drift.** `docs/design/README.md` mentions a "v2 (30 Oct) handover pack" (`../../Zcom-dashboard-handover/`) that is different from `docs/design-v2/`. CLAUDE.md §2/§3 still describe `/billing/:section` as pages and `/ai/:section`. There is a risk of confusing future sessions.
11. **Label.** Sign-in should say "Platform" (§5) while the menu board says "Platform admin". Today it is "Super admin" everywhere (document titles too).
12. **Mobile.** v2 allows a phone top row but needs a 72px rail at 768–1023. The SYNCED `AppShell` shows the top bar below 1024, so this also changes the merchant app.
13. **Performance.** The row expand on Stores needs per-store usage, apps and insight. Lazy-load these per opened row, because `PlatformTenants` is near the gateway cost limit (CLAUDE.md PRD-025 note: keep it off the shared fragment).
