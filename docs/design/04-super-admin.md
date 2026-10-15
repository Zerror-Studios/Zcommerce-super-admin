# 04 · Super Admin (Zerror team)

Applies to the Super Admin app (today on `localhost:5174`). Same shell, tokens and components as the Merchant Admin, with the "Super admin" label next to the wordmark.

**What this app is for:** in one glance the Zerror team should see **every store, how much we're earning (this month, this year, projected), who has paid and who hasn't, how healthy each store is**, and be able to **log straight into any store's dashboard** to check something.

> Mapping rule (same as Merchant): map existing pages into this structure; keep every existing feature; don't build items marked "new" unless approved — list them in your report instead.

---

## 1. Navigation

| Sidebar item | Children (shown when active) | Today's pages |
|---|---|---|
| Home | — | Home / Dashboard |
| Stores | All stores · Store detail | Clients, client detail |
| Billing | Collections · Transactions | Billing › Subscriptions, Transactions |
| Analytics | Revenue · Store performance (new, optional) | Analytics › Revenue Reports |
| (bottom) Notifications | panel | bell in the old top bar |
| (bottom) Settings | Discounts · Payment reminders · Billing rules · Plans · Team | Settings › Discounts, Automation (+ any existing) |

- Use **"Stores"** everywhere (today the same screen says "Clients (15)" and "Total Stores 11"). The owner is a field of a store.
- Search placeholder in the sidebar: "Search stores". ⌘K searches stores by name, owner, email or domain, plus pages and actions.

---

## 2. Shared definitions (use one definition everywhere)

Put these in one place in code (e.g. `metrics.ts`) so Home, Billing and Analytics always agree. Today Home shows MRR ₹1,282 and Revenue shows "Active MRR ₹982" — that must never happen again.

| Metric | Definition | Label |
|---|---|---|
| **Monthly billing** | Sum of monthly fees of all stores that are billable (Live or Building, not Suspended/Cancelled) | "Monthly billing" (avoid "MRR" in the UI; tooltip: "Monthly recurring revenue") |
| **Earned this month** | Successful subscription payments received in the current calendar month, minus refunds | "Earned this month" + "3 of 7 stores paid" |
| **Earned this year** | Same, from 1 Jan (or 1 Apr if Financial year is selected) to today | "Earned this year" + change vs same period last year |
| **Projected for the year** | Earned this year + Monthly billing × remaining months in the year | "Projected for 2026" + "At current monthly billing" |
| **Outstanding** | Issued invoices not yet paid (due + overdue) | "Outstanding" + "4 stores unpaid · 2 overdue" (value in critical colour when > 0) |
| **Collection rate** | Paid ÷ billed for the period | "Collected 74%" |

- Year selector inside the date control: **Calendar year / Financial year (Apr–Mar)**. Default: calendar year.
- Money: whole rupees in summaries (₹52,500); paise only in Transactions and invoices.

### Store lifecycle (status)

Show **one status** per store, derived from data (never show "Active" next to "Expired 2 days ago" again):

| Status | Badge tone | Meaning |
|---|---|---|
| Building | info | Store is being set up, not public yet |
| Live | success | Public and in good standing |
| Payment due | warning | Invoice issued, not yet due date |
| Overdue · N days | critical | Past due date, inside the grace period. Sub-line: "Suspends on 20 Oct" |
| Suspended | critical | Grace period ended; storefront off. Sub-line: "Deletes on 19 Nov" if a deletion date applies |
| Cancelled | neutral | Subscription ended |

In tables, show **Status** (Building/Live/Suspended/Cancelled) and **Payment** (Paid · 3 Oct / Due 20 Oct / Overdue · 12 days) as **two separate columns**, as in ref 07.
Grace, suspension and deletion days come from **Settings › Billing rules** (don't hard-code).

### Store health

- Keep the existing health score calculation. Display: score + label, with a 56px thin bar.
  - 80–100 **Healthy** (success) · 50–79 **At risk** (warning) · 0–49 **Critical** (critical).
  - Building stores: "Not live yet" in tertiary text.
- Tooltip / detail lists the factors the current calculation uses (e.g. orders trend, uptime, payment status) with each one's contribution.
- Today "Healthy 0 / Unhealthy 15 / 11 at risk" is confusing: use the three labels above, everywhere.

---

## 3. Pages

### 3.1 Home — "Platform overview" (ref 07)

- Header: H1 "Platform overview", sub-line "October 2026 · 7 stores". Right: date control ("This month ⌄", with This month / Last month / This year / Financial year / Custom), ghost "Export", primary "Add store".
- **Today's brief** (AI): e.g. "Two stores are past their grace period and will be suspended this week. Drift Skate Co.'s orders fell 40% this month — worth a check-in." + "Review stores".
- **KPI strip (4):** Earned this month · Earned this year · Projected for {year} · Outstanding. (Definitions §2.)
- **Row:** "Earnings · 2026" bar chart (flex 2): one bar per month; collected = solid `--chart-1`; future months = dashed `--chart-projected` (projected). Tooltip: month, collected, billed, collection rate.
  **Needs attention** (flex 1), clickable rows with status dot, ordered by urgency:
  1. Overdue stores — "Aura Apparel is overdue by 12 days" / "Suspends on 20 Oct"
  2. Payments due soon — "2 payments due on 20 Oct" / names
  3. Health drops — "Drift Skate Co. health fell to 41" / reason
  4. Stores being built — "4 stores are being built" / next launch
  5. Suspended stores / deletions scheduled
- **Stores table** (same component as Stores page, first 10 rows + "View all stores"): tabs All · Live · Building · Unpaid · Suspended with counts; search "Search stores or owners"; Filter · Sort.
  Columns: **Store** (initials avatar, name, owner email) · **Status** · **{Month} payment** · **Health** · **Store sales · 30d** (right) · **Monthly fee** (right) · actions.
  Actions: visible ghost **"Log in"** button (icon + label) + "···" menu.
- Remove: the multi-colour "Plan distribution" donut (replace with a "Stores by plan" list in Analytics if plans still matter), icon tiles on KPI cards, the "$" icon.

### 3.2 Log in to a store (one click)

- "Log in" on any store row, store detail header and ⌘K ("Log in to Aura Apparel").
- Opens the store's Merchant Admin **in a new tab**, signed in as Zerror support (keep the existing impersonation mechanism; only change UI).
- Inside the merchant app show a persistent 40px banner at the very top of the main area: `--warning-bg`, `--warning-fg` text: "You're viewing **Aura Apparel** as Zerror support. Changes are logged." + "Exit" (ends the session and closes/returns).
- Every action during support sessions is written to the store's activity log (Store detail › Activity) with the team member's name.
- No confirmation dialog for logging in (it should be one click); confirmation only for destructive actions inside.

### 3.3 Stores (all stores)

- Header: "Stores" + count; ghost "Export"; primary "Add store".
- Same table as Home with optional extra columns via Columns: Plan · Live since · Next invoice · Orders · 30d · Domain · Contract start · Lock-in ends.
- Row menu "···": View details · Log in · Send payment reminder · Record payment · Change plan or fee · Suspend store / Reactivate store · Delete store (destructive, last).
- Bulk: "3 selected · Send payment reminder · Export · Clear selection".
- Row click → Store detail.
- Replace the per-row outlined "Login" pill with the ghost "Log in" button.

### 3.4 Store detail

- Back link "← Stores". Title = store name + Status badge + Payment badge. Sub-line: owner name · email · domain (link). Right: ghost "Send reminder", ghost "···" (Change plan, Suspend, Delete), **primary "Log in"**.
- Underline tabs: **Overview · Billing · Activity · Settings**.
- **Overview:** KPI strip (Store sales · 30d, Orders · 30d, Health, Paid to date) → "Performance" chart (sales line + orders dashed, 12 months) → Insight card (AI) if any → Health breakdown (factors) → **Plan usage** (Products 8 / 25, Storage, Bandwidth: thin neutral bars, warning colour over 80%, critical over 95%).
  Side column: **Profile** (Owner, Email, Phone, Domain, Live since, Contract start, Lock-in ends, Monthly fee) · **Notes** (internal, editable).
- **Billing:** payment status card (next invoice, due date, grace period, "Suspends on …" when overdue) → Invoices table (Invoice · Period · Amount · Status · Paid on · Method) → Payments table → **Grace period** setting: "Extra days before this store is suspended for non-payment. Default: {n} days." with a number input and Save.
- **Activity:** timeline (payments, reminders sent, plan changes, support logins with team member name, suspensions).
- **Settings:** Suspend store / Reactivate · Export store data · Delete store (each a settings row with explanation; destructive confirm modals).
- Fix: "Store Revenue" with **$** icon → "Store sales" with no icon; "Growth −100.0%" when the previous period is 0 → "—" with tooltip "No sales in the previous period".
- "Monthly Recurring Revenue (₹)" wrapping label → "Monthly fee".

### 3.5 Billing › Collections (was Subscriptions)

- Header: "Collections"; date control; ghost "Export CSV".
- KPI strip (4): Billed this month · Collected (with collection %) · Pending · Overdue. Delete the 9-card grid and the "Period vs previous" bar (fold changes into KPI deltas).
- Tabs: **Stores · Invoices** (was Shops · Payments).
  Stores tab columns: Store · Plan/fee · Payment (badge) · Last payment · Next due · Amount due (right) · Days overdue (right).
- Health filter moves into Filter (Healthy / At risk / Critical).

### 3.6 Billing › Transactions

- Columns: Date & time · Store · Plan · Amount (₹ with paise, right) · Status (Paid/Due/Failed/Refunded) · Gateway (Stripe / Razorpay) · Transaction ID (Geist Mono, copyable).
- Search "Search transactions". Description line under H1: "Payments across Stripe and Razorpay" (useful, keep).
- Fix "₹49.5" → "₹49.50".

### 3.7 Analytics › Revenue

- KPI strip: Bookings · Collected · Pending · Failed (fix "Net collected −₹20.5" display: show "−₹20.50" with tooltip explaining refunds).
- Earnings trend (bars or line, 12 months) + Revenue by plan (stacked bars, categorical palette).
- Tables: Plan breakdown (Plan · Revenue · Share · Stores · Monthly billing) · Gateway split (Gateway · Collected · Failed · Pending · Share) · Top stores by collected revenue.
- Optional new **Store performance**: table comparing stores (Store sales, Orders, Conversion, Health) — only if data already exists.

### 3.8 Settings

- **Discounts:** Code (mono) · Discount · Applies to · Used ("48 / 100") · Expires · Status. Expired codes show **Expired** (neutral) — today several past-dated codes still say Active; derive status from the date.
- **Payment reminders** (was Automation): KPI strip (Expiring in 30 days · Expiring in 7 days · Overdue) → stores table with selection → bulk bar "1 selected · Preview email · Send reminder" (replaces the bottom "Ready to send" card). Toast: "Reminder sent to 1 store." (no "(demo)").
- **Billing rules** (if settings exist): invoice day, due day, grace days, suspension, deletion after suspension.
- **Plans:** plan names, monthly fees, limits.
- **Team:** Zerror members with access, roles, last active.

### 3.9 Notifications (Super Admin)

Types: Payment received · Payment failed · Store overdue · Store will be suspended in 3 days · Store suspended · Health dropped below 50 · Store launched · Reminder sent. Tabs: All · Payments · Stores · Health.

---

## 4. Display bugs to fix (seen in the recordings)

1. "Clients (15)" vs "Total Stores 11" — one count, one word ("Stores").
2. MRR ₹1,282 (Home) vs Active MRR ₹982 (Revenue) — one definition (§2).
3. "Active" status next to "Expired 2 days ago" — derive one status (§2).
4. "Pending ₹ ₹128" (double symbol), "₹49.5", "−₹20.5".
5. "$" icon for INR on store detail.
6. Toast "Alpine Botanics was removed from local state." → "Aura Apparel deleted." + Undo where possible.
7. "Emails queued … (demo)" → "Reminder sent to 1 store."
8. Green "Signed in · Welcome back to Zcommerce Admin" toast after login → remove.
9. Browser tab title → "{Page} · Zcommerce Super admin".
