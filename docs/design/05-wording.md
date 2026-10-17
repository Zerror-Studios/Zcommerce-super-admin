# 05 · Wording, tone and formatting (both apps)

Put all user-facing strings in one place per app (e.g. `copy.ts` / i18n files) so they can be changed without touching components.

## 1. Voice

- Calm, short, specific, helpful. Plain verbs. Write like Apple or Linear.
- Talk to the merchant as "you". The Super Admin talks to the Zerror team, still plain and short.
- **Sentence case** for every title, label, button, tab, badge and menu item ("Add product", not "Add New Product").
- **No exclamation marks. No "Oops". No ALL CAPS.**
- Never show internal words to users: "local state", "demo", "null", "undefined", error codes, stack traces. Log them; show a human message.
- Product name: "Zcom". Avoid hype words: "powerful", "magic", "smart", "AI-powered", "simple".
- Indian English spelling: colour, behaviour, analyse, organisation, cancelled.

## 2. Formatting

| Thing | Rule | Example |
|---|---|---|
| Money (summaries, tables) | `Intl.NumberFormat('en-IN', {style:'currency', currency:'INR', maximumFractionDigits:0})` | ₹4,82,650 |
| Money (finance, invoices, transactions) | 2 decimals | ₹49.50 |
| Negative money | minus sign before ₹ | −₹20.50 |
| Compact money (charts, axes) | k / L / Cr | ₹25k · ₹1.2L · ₹3.4Cr |
| Percent | max 1 decimal | 2.4% · 17% |
| Change in a rate | "pts" | −0.3 pts |
| Date | day month (year only if not current year) | 14 Oct · 14 Oct 2025 |
| Date + time | lower-case am/pm | 14 Oct, 4:58 pm |
| Range | en dash with spaces | 15 Sep – 14 Oct |
| Relative time | only in feeds/notifications and < 7 days | 2m · 1h · Yesterday · Mon |
| Counts | correct plurals | 1 order · 12 orders |
| Empty value | em dash in tertiary | — |
| IDs, codes | Geist Mono, copyable | #1042 · NH-KS-014 · LAUNCH25 |

Never: "₹ ₹128", "$" for INR, "₹49.5", "-100.0%" when the base is zero (show "—").

## 3. Navigation labels

**Merchant Admin:** Home · Orders · Products · Customers · Marketing · Content · Analytics · Finance · Apps & channels · Notifications · Settings
Children: All orders · Abandoned checkouts · Returns · All products · Inventory · Collections · Lookbooks · All customers · Segments · Form responses · Campaigns · Discounts · Templates · Blog posts · Categories · Tags · Authors · Overview · Live view · Sales · Behaviour · Payments · Payouts · Invoices

**Super Admin:** Home · Stores · Billing (Collections · Transactions) · Analytics (Revenue · Store performance) · Notifications · Settings (Discounts · Payment reminders · Billing rules · Plans · Team)

## 4. Renames — Merchant Admin

| Today | New |
|---|---|
| Welcome back, Owner · Here's what's happening with your store today, October 14, 2026. | Good evening, {first name} · Wednesday, 14 October |
| Live Site | View store |
| Last updated: 04:58 PM (chip) | tooltip on date picker: "Updated 2 min ago" |
| Contact Book | Customers |
| Form Submissions / Contact Forms | Form responses |
| Store › Products | Products › All products |
| LookBooks | Lookbooks |
| Add New Product / Add New Lookbook / Add New Order | Add product / Add lookbook / Create order |
| Products (0) | Products (count shown muted, hidden when 0) |
| Search for product details… | Search products / Search orders / Search payments / Search members / Search roles / Search campaigns / Search posts / Search lookbooks |
| Columns ⌄ / Filters ▼ | Columns / Filter (ghost) |
| SMS Campaigns / Email Campaigns | Campaigns (tabs: Email · SMS) |
| View All Templates | Templates |
| New Campaign | Create campaign |
| Discount Coupons | Discounts |
| Blogs › Posts | Blog posts |
| Create Post | Write a post |
| Writers | Authors |
| Traffic Overview | Overview |
| Real-time Analytics · LIVE · Real-Time Overview | Live view · ● Live |
| Sales Overview | Sales |
| Behavior Overview | Behaviour |
| Top pages by ⌄ | Top pages (with segmented control) |
| View Report | (remove unless a report page exists) |
| Insights · Conversion Opportunity | Today's brief / Insight (AI patterns) |
| Users | Members |
| Invite Staff | Invite member |
| My Login History | Login history (user menu) |
| OWNER (badge) | Owner (plain text) |
| Protected | lock icon, tooltip "The store owner can't be removed" |
| Never (last active) | Not yet active |
| Add role | Add role (keep) |
| Shipping and Delivery / Shipping & Delivery | Shipping & delivery |
| Create Profile / Create Custom Profile / New Custom Profile | Add shipping profile / Untitled profile |
| Manage Rates → / Manage Locations → / Manage Products | Edit rates / Edit locations / Assign products |
| Edit Profile | Edit |
| Packages | Packaging |
| Default Origin | Default |
| General Shipping Rates · All Products | General rates · Applies to all products |
| Customers will not see this name; it is used only to manage rates in your admin. | Only you see this name. |
| Specific Tax Rules · Override the default tax rate for specific products or categories. | Tax rules · Set a different rate for specific products or categories. |
| How would you like to collect tax? · Add tax on top of prices (Exclusive) · Prices already include tax (Inclusive) | How do you charge tax? · Add tax at checkout · Prices include tax |
| Ready to go beyond basic plan · View Plans | (removed; see Settings › Plan & billing) |
| Developed by Zerror Studios © 2026 · Version 1.01.000 | (removed; version in user menu › Help) |

## 5. Renames — Super Admin

| Today | New |
|---|---|
| ZCOMMERCE SUPER ADMIN (pill) | zcom Super admin (plain text) |
| Dashboard · Platform-wide overview across all Zcom client stores. | Platform overview · October 2026 · 7 stores |
| Total Revenue | Earned this month / Earned this year |
| Monthly Recurring Revenue / Active MRR | Monthly billing |
| Total Stores / Clients | Stores |
| Clients (15) · Monitor and manage every client store on the Zcom platform. | Stores (count muted) — no description |
| Add client | Add store |
| Login (row pill) / Login as client | Log in |
| Store Health · 0 · Critical | Health · 0 Critical (score + label) |
| Renewal / Due · Expired 2 days ago | {Month} payment · Overdue · 2 days |
| Ended | Cancelled |
| MRR (₹) | Monthly fee |
| Store profile · Account and billing summary for … | Profile |
| Store Revenue | Store sales · 30d |
| Monthly Recurring Revenue (₹) | Monthly fee |
| Orders (30d) | Orders · 30d |
| Growth −100.0% | — (tooltip: No sales in the previous period) |
| Performance trend · Estimated monthly revenue & orders for … | Performance |
| Grace period · Extend days after due date when this client says they will pay later. Uses the platform default (3 days) unless you set a custom value below. | Grace period · Extra days before this store is suspended for non-payment. Default: 3 days. |
| No billing history yet · Subscription charges for this client will show up here. | No invoices yet · Invoices for this store will appear here. |
| Plan usage · Resource consumption vs Free plan limits | Plan usage · Against the {plan} plan limits |
| Subscriptions · Subscription health, payments, renewals, and shop status in one place. | Collections |
| Total shops · Healthy · Unhealthy / at risk · Collected vs expected · Paid this month · Pending payments · Overdue payments · Renewals (7 / 30d) · Churned this month | Billed this month · Collected · Pending · Overdue (KPI strip) |
| Shops (15) · Payments (11) | Stores · Invoices |
| at risk / unhealthy (lower-case badges) | At risk / Critical |
| Transactions · Payment charges across Stripe and Razorpay. | Transactions · Payments across Stripe and Razorpay |
| Revenue Reports · Plan bookings, collection health, gateway mix, and top contributing stores. | Revenue |
| Plan revenue · Net collected · Paying stores | Bookings · Collected · Paying stores |
| Automation | Payment reminders |
| Ready to send · 1 store selected for expiry reminder emails | (bulk bar) 1 selected · Preview email · Send reminder |
| Send emails | Send reminder |
| Currently In Zerror (account menu) | Signed in as |
| Account Settings · Log Out | Account · Log out |

## 6. Empty states

| Where | Title | Sentence | Button |
|---|---|---|---|
| Orders | No orders yet | When customers buy from your store, their orders show up here. | Share your store link |
| Products | Add your first product | Products you add here appear in your store and can be sold right away. | Add product |
| Inventory | Nothing to track yet | Add products to see and update stock here. | Add product |
| Collections | No collections yet | Group products so customers can browse them together. | Create collection |
| Lookbooks | No lookbooks yet | Group products into a styled story customers can shop from. | Add lookbook |
| Customers | No customers yet | Customers appear here after their first order or sign-up. | — |
| Form responses | No responses yet | Messages from your store's forms will appear here. | — |
| Campaigns | No campaigns yet | Send an email or SMS to bring customers back. | Create campaign |
| Discounts | No discounts yet | Create a code to reward customers or run a sale. | Create discount |
| Blog posts | No posts yet | Posts help customers find you on Google. | Write a post |
| Payments | No payments yet | Payments appear here once customers check out. | — |
| Tax rules | No custom tax rules | Every product uses your default tax rate. | Add rule |
| Analytics card, no data | (single line) Not enough data for this period yet. | | |
| Search, no results | No results for "kurta blu" | Check the spelling or clear filters. | Clear filters |
| Notifications | You're all caught up | New activity will show up here. | — |
| Super Admin · Stores | No stores yet | Add your first store to start tracking billing and health. | Add store |
| Super Admin · Store invoices | No invoices yet | Invoices for this store will appear here. | — |
| Super Admin · Unpaid tab | Everyone's paid | No unpaid invoices right now. | — |
| 404 | Page not found | The link may be broken or the page may have moved. | Go to Home |

## 7. Toasts and messages

| Today | New |
|---|---|
| You have logged out! | You've been logged out. |
| Signed in · Welcome back to Zcom Admin. | (no toast) |
| Failed to load lookbooks | Couldn't load lookbooks. Retry (inline + toast) |
| Client deleted · Alpine Botanics was removed from local state. | Alpine Botanics deleted. Undo |
| Emails queued · Reminder email will be sent to 1 store (demo). | Reminder sent to 1 store. |
| This page is under development and will be available soon. | (removed — page hidden behind a feature flag) |
| Generic save success | Changes saved. |
| Generic error | Something went wrong. Try again. (plus Retry where possible) |
| Network offline | You're offline. Changes will save when you're back. (only if supported; else "Couldn't save. Check your connection.") |
| Copied | Copied |
| Wrong login | That email and password don't match. Try again or reset your password. |
| Support login banner | You're viewing {Store} as Zerror support. Changes are logged. · Exit |

## 8. Confirmation dialogs

Pattern: title asks the question with the object's name; one sentence of consequence; buttons "Cancel" (ghost) + specific verb (destructive).

| Action | Title | Body | Button |
|---|---|---|---|
| Delete product | Delete "Linen kurta set — Sage"? | It will be removed from your store. This can't be undone. | Delete product |
| Archive product | Archive this product? | It will be hidden from your store. You can restore it any time. | Archive |
| Remove member | Remove Riya Shah? | She'll lose access to this store right away. | Remove member |
| Suspend store (SA) | Suspend Aura Apparel? | The storefront goes offline and the owner can't log in until you reactivate it. | Suspend store |
| Delete store (SA) | Delete Aura Apparel? | All store data will be permanently deleted. This can't be undone. | Delete store |
| Discard changes | Discard unsaved changes? | Your edits on this page will be lost. | Discard |

## 9. AI copy

- Brief: one sentence of finding + what to look at. "Sessions are up 17% this month, but conversion slipped to 2.4%. Three products account for most cart drop-offs."
- Always name the data and range: "Based on orders and sessions, 15 Sep – 14 Oct".
- Hedge honestly: "usually", "likely", "worth a check-in". Never promise outcomes.
- Thinking text: "Analysing the last 30 days…", "Reading 1,284 orders…", "Checking checkout drop-offs…".
- Footer in the assistant: "AI can make mistakes. Check numbers before acting."
