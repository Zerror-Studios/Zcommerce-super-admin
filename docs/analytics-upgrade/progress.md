# Analytics Level 1 upgrade · Super Admin progress

Store side (A1–A3): `D:\zcom\Zcomm-frontend\docs\analytics-upgrade\progress.md`. This file covers the console.

## A4 · Super Admin

### Status: built (2026-11-11), not committed (owner reviews first), not run in a browser

**Menu (§3.7)**
- Analytics is **Revenue · Stores · AI usage** (`src/config/navigation.ts`). The "System" item is gone, and so is its
  command palette entry, which is built from the menu.
- Integration health, Sync monitor and Platform health (snapshot) were the System item's other views. They keep their
  URLs (`/analytics/integrations`, `/sync`, `/health`), open from **System health › ⋯** (people with report access), light
  the System health menu item (`NAV_GROUP_ALIASES` in `DashboardLayout.tsx`), and are titled "System health · Sync
  monitor" and so on. Nothing is dropped.

**Stores (§3.7, §4)**: `src/components/analytics/StoresTab.tsx` replaces `StoreSalesTab.tsx` and `PerformanceTab.tsx`
(both deleted).
- Title "Analytics · Stores". Subtitle: "Store sales and visits from the nightly store snapshot · a store shows after
  its first snapshot". Date picker in the title row. ⋯ has Export (daily trend on Overview, store sales on the other
  sub-tabs) and the existing "Open Merchant sales / Retention / Usage" views.
- Summary panel: **GMV, Orders, Visits, Conversion rate** (from `platformAnalyticsOverview`), compared with the window
  before.
- Sticky underline sub-tabs (`.zc-subtabs`, the same markup as the store side). The sub-tab is kept in `?tab=`
  (Overview has none; `top`, `needs-look`). The URL is replaced, not pushed, and AppShell already opens a `?tab=`
  change at the top.
  - **Overview:** GMV over time (GMV area with visits and orders lines, full width, round 3 draw-in and morph). **Totals
    by currency** shows only when stores sell in more than one currency.
  - **Top stores:** Top stores by GMV (the overview's top 10, with visits, conversion and the Google Analytics chip).
    **Show all N stores** turns the card into "All stores by sales" (`platformStoreSales`, sortable, 25 a page,
    "Show top 10" goes back). Top stores by growth sits under it.
  - **Needs a look:** stores with no orders, or with net sales down 20% or more. Full width.
- Card headers: title, one-line subtitle, and a source chip on the right (`SourceChip` in `analytics-shared.tsx`:
  "Store orders", "Orders and Google Analytics", "Zcom billing").
- Money: store rows use each store's own currency (the overview's rows have no currency, so it is taken from the
  store-sales rows). With more than one currency, the GMV tile shows the largest currency with "INR stores only · see
  Totals by currency", because the overview's GMV adds every currency together. Before, every amount was printed in ₹.
- The old Stores KPI "Stores · Every store not deleted" was wrong: the rollup counts only stores that have snapshot
  figures. It is not kept, since the spec's four KPIs don't include it.

**Redirect (§3.8)**
- `/analytics/performance` → `/analytics/store-sales`, which is Stores › Overview. The query (a date range) and the hash
  are kept, and any `tab` is dropped (`LEGACY_SECTIONS` in `pages/Analytics.tsx`). The menu item stays lit on the old
  URL.
- Links: nothing in the console linked to `/analytics/performance` apart from the menu. Home cards, notifications and
  the backend (AI tools, notification hrefs) were all checked. Ask Zcom suggestions: Stores got its own three, and "Is
  anything slow or failing?" moved to System health with two more (`src/config/ask-suggestions.ts`).

**Date control**
- Stores uses the shared kit `DateRangePicker` with `useUrlDateRange` (`?from=&to=`, remembered under
  `console-analytics-stores`, default Last 30 days). The 7 · 30 · 90 pills (`DaysSwitch`) are deleted.
- Both queries take **any window of 1–366 days**. This is the backend's `dailyWindows` limit; there are no fixed
  7/30/90 windows. So the picker maps straight onto them, with these limits:
  - Presets: Yesterday, Last 7 days, Last 30 days, This month, Last month, This quarter, This year, Custom. "Today" is
    left out because the snapshot only has complete days.
  - No day earlier than 365 days ago, so a custom range can't go past 366 days.
  - The compare switch is hidden: the server always compares with the window before.
- Revenue already used the kit picker (`DateRangeComparison`) and is unchanged. The snapshot views (Money, AI cost…)
  keep their stored-period select, because the snapshot exists only for fixed periods.

**Revenue:** works as before and keeps its empty state ("No paid plans yet."). Every card header has a "Zcom billing"
source chip. Titles had no counts glued to them.

**AI usage:** the page works as before. The per-store "This week" column now shows the round 3 `<AiQuota>` row
("12 / 50" and a 3px bar, amber at 80% or more) when the plan has a weekly limit. The plain count shows when it has
none. The month budget stays as the summary panel's ring. The Ask Zcom panel's budget bar was already `<AiQuota>`.

### P6 / §9 Q12: ₹0 GMV and Kesar & Kin missing (`05-sa-system.jpg`)

**Not a frontend filter.** The console sends the picked range and shows what the server returns. There is no store
list, status or demo filter on the client.

**Where the numbers come from:** the backend, read only.
- `platformAnalyticsOverview` and `platformStoreSales` (`services/platform-admin/src/services/platform-analytics.service.ts`)
  don't read orders. They sum `dailyFigures` from the nightly **usage snapshot** (`TenantUsageSnapshot`,
  `jobs/usage-snapshot.job.ts`).
- Each snapshot run stores a store's **last 7 complete UTC days**:
  - orders and net revenue from the store's `analytics_sales_daily` (else `analytics_sales_snapshot`);
  - sessions from GA4 `analytics_daily`.
- A store is listed only when some snapshot holds day figures for it inside the window (`"dailyFigures.0": {$exists:
  true}`; days with no data are left out).
- The job covers ACTIVE and SUSPENDED stores, and the reads cover every store that isn't DELETED.
- **Demo or sample stores are not excluded** anywhere: not in the job, not in the queries, not in the console. So the
  subtitle does *not* say "Demo stores are not counted". It says the true thing: the figures come from the nightly
  snapshot, and a store shows after its first one.

**Kesar & Kin missing:**
- The sample store was removed and reseeded live on 2026-11-10 as a **new store** (`6af2e55402cc59ec79fa737e`;
  backend changelog 2026-11-10, PRD-023 Phase 2). Its six months of history were written backdated, straight into the
  store's database.
- The platform rollups only see what nightly snapshots captured:
  - Until the first snapshot ran for the new store id, it had no `dailyFigures`, so it was missing from both lists.
  - After that, each run adds only the last 7 days. The backdated history never reaches Super Admin, so 30/90-day
    windows undercount Kesar & Kin until enough nights have passed.
- Nothing in the job backfills older days.

**₹0 for Nahara, Deveshe Dreams and Birelle:** they are listed, so their snapshots have day rows. Those rows hold 0
paid orders and 0 net revenue, meaning their `analytics_sales_daily` counted no paid orders in the window: no orders,
or only unpaid ones (e.g. COD not yet paid). "Not connected" is correct, because no GA4 installation sync summary
exists for them.

**For Anand (§9 Q12), backend or data:**
1. Is the usage-snapshot job running on the live cluster (`PLATFORM_USAGE_JOB_HOUR_UTC`)? Check that `tenant_usage_snapshot`
   has rows with `dailyFigures` for Kesar & Kin's new id.
2. Should the snapshot (or a one-off command) backfill `dailyFigures` from `analytics_sales_daily` for a new or
   reseeded store, so the platform sees its history? Or should these two queries read `analytics_sales_daily`
   directly?
3. Check that Nahara, Deveshe Dreams and Birelle really had no paid orders in the window. If they had some, their
   `analytics_sales_daily` isn't being filled (the analytics service's `SalesDailyService`).
4. `platformAnalyticsOverview` adds GMV across currencies. A per-currency GMV (or a `currency` on `StorePerformanceRow`)
   would let the console show it without borrowing the store-sales rows.
5. A "last snapshot at" time on these queries would let the page say how fresh the figures are.

### Left / notes
- Not run in a browser and no screenshots (A5 QA). The sticky sub-tabs use the same class and bleed as the store side.
- Today is not a preset. A custom range that ends today still includes today, which has no snapshot figures yet. This
  was already true of the old pills.
- `/analytics/performance` is the only old System analytics route. The other System views keep their URLs, so they
  aren't redirects.
- Old PRDs (PRD-012, PRD-024) still mention "Analytics › Performance". They are historical, so they were left as they
  are.
- `src/styles/tokens.css` was already modified in the working tree before A4 started. A4 didn't touch it.

### Checks (A4)
- `npx tsc -b`: clean, run midway and at the end.
- oxlint on the touched files: 0 errors. One warning (`react(refs)` in `pages/Analytics.tsx`) was already there
  (the export ref read in a menu callback).
- `npm run lint:hex`: 0. `npm run lint:px`: 18/18.
- `npx vitest run`: 58 files, 383 tests, all pass. New: `src/components/analytics/analytics-tab.util.test.ts` (menu is
  Revenue · Stores · AI usage, no System; the sub-tab ids; the window limit).
- No SYNCED file touched, so `check:synced` wasn't needed. No backend change. Nothing committed.

### Files
- New: `src/components/analytics/StoresTab.tsx`, `src/components/analytics/analytics-tab.util.test.ts`, this file.
- Deleted: `src/components/analytics/StoreSalesTab.tsx`, `src/components/analytics/PerformanceTab.tsx`.
- Changed:
  - `src/pages/Analytics.tsx`
  - `src/components/analytics/analytics-shared.tsx` (`DaysSwitch` → `SourceChip`)
  - `src/components/analytics/analytics-tab.util.ts` (sub-tabs, window limit)
  - `src/components/billing/RevenueReportsTab.tsx`
  - `src/components/ai/AiUsageTab.tsx`
  - `src/components/layout/DashboardLayout.tsx`
  - `src/config/navigation.ts`
  - `src/config/ask-suggestions.ts`
  - `src/pages/SystemHealth.tsx`
  - `docs/changelog/2026-11.md`

See the Merchant Admin repo's `docs/analytics-upgrade/FINAL-REPORT.md` for the full report (both apps).
