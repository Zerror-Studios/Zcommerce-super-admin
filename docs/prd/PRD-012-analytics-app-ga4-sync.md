# PRD-012 — Analytics as an app: platform dashboards (pointer: zcom-super-admin)

| Field | Value |
|---|---|
| Status | **Implemented (console)** 2026-10-22 (mirrors the source of truth, Approved 2026-10-22) |
| Source-of-truth PRD | `../../../zcom-backend/docs/prd/PRD-012-analytics-app-ga4-sync.md` |
| Related | PRD-005 (platform-admin API, usage snapshots), PRD-010 / ADR-006 (apps service, `channel_connection`), PRD-011 (payment apps) |
| Repos affected | zcom-backend (source of truth: analytics service, GA4 sync, master summary, platform-admin reads) · zcom-frontend (dashboard) · **zcom-super-admin (this repo: FR-8.3 dashboards, console side of FR-8.4)** · storefronts/* (measurement id only) |
| Created / Updated | 2026-10-22 / 2026-10-22 |

All requirements, the contract (§5–7), metric definitions (§9), the open questions and the phase plan live in the source-of-truth PRD. This file lists **this repo's** share: the platform dashboards of **FR-8.3** and the console side of **FR-8.4**.

## Why this shape

- The console had no view of analytics health or traffic: `pageViews30d` was always 0, Store sales was computed client-side from a 30-day snapshot, and nothing said whether a store's GA4 connection worked (source PRD §2 item 4).
- The backend now writes everything the console needs into **master** collections (`tenant_usage_snapshot` with real traffic and net revenue, `analytics_sync_summary` after every sync run, `channel_connection` from the apps service) and exposes them on the `platform-admin` subgraph. The console reads those rollups only; it never fans out to tenant databases (source PRD FR-8.1, §12 tenant isolation).
- Money and totals stay on the server (root `CLAUDE.md` §4). The only arithmetic in the browser is the period-over-period change next to a KPI (`lib/analytics-health.changePercent`), computed from two server figures.

## This repo's work

| Area | What was built | Files |
|---|---|---|
| Contract | `PLATFORM_ANALYTICS_OVERVIEW`, `PLATFORM_INTEGRATION_HEALTH`, `PLATFORM_SYNC_MONITOR`, `PLATFORM_RERUN_ANALYTICS_SYNC`; `PlatformTenantFields.usage` selects `pageViews30d`, `sessions30d`, `conversionRate30d`. Selections are spelled out (no fragment interpolation) so the workspace contract validator checks every document | `src/graphql/analytics.ts`, `src/graphql/tenants.ts`, `src/types/platform-api.ts` |
| Data hooks | `useAnalyticsOverview(range)`, `useIntegrationHealth({ filter, limit, offset })`, `useSyncMonitor()`, `useTenantSyncRows(tenantId)` (the store page, filtered from the same rollup), `useRerunAnalyticsSync()` (refetches the monitor so the pending chip shows) | `src/hooks/use-platform-analytics.ts` |
| Pure logic (tested) | health → chip label and tone, integration status → chip, 7/30/90-day ranges, `changePercent` / `changePoints`, error preview, backfill percent | `src/lib/analytics-health.ts` + `.test.ts`; `lib/display-labels.util.ts` gained app provider and channel type labels |
| **Analytics › Performance** (`/analytics/performance`) | KPI strip (Sessions, Orders, GMV, Conversion rate with previous-period deltas; Stores with traffic of total), daily trend (GMV area, sessions and orders lines), Top stores by GMV and by growth with analytics health chips; rows open the store | `components/analytics/PerformanceTab.tsx` |
| **Analytics › Integration health** (`/analytics/integrations`) | Counts by status (Installations, Active, Error, Inactive), By-provider table with error counts, every installation with provider and type, status chip, last test, last sync, last error (truncated, full text in a tooltip), analytics health and data through; provider / type / status filters and a debounced store search, 25 per page, server-side | `components/analytics/IntegrationHealthTab.tsx` |
| **Analytics › Sync monitor** (`/analytics/sync`) | Summary cards (Installations, Runs · 24h with failures, Needs attention = failing + quota paused, Importing history, Run time p95 with quota tokens), "Failing" and "Backfills in progress" tables first, then all installations; "Re-run sync" per row for `platform:tenants:manage` (confirm, success toast); a "Re-run pending" chip while `rerunRequestedAt` is set; Refresh action | `components/analytics/SyncMonitorTab.tsx`, `RerunSyncButton.tsx`, `AnalyticsHealthChip.tsx` |
| **Analytics › Store sales** | Labels say **net** sales; the table shows the server's Sessions, Page views and Conversion per store (no client-side conversion maths); "Stores with traffic" KPI | `components/analytics/StoreSalesTab.tsx`, `lib/store-sales.ts` (+ test), `types/index.ts`, `lib/api-adapters.ts` |
| **Store page** | An "Analytics" section: 30-day sessions, page views and conversion from the usage snapshot; each GA4 connection's health chip, property, data through, last sync, backfill progress and last error, with the same "Re-run sync" action for manage roles | `components/clients/ClientAnalyticsCard.tsx`, `pages/ClientDetail.tsx` |
| Routing and nav | `/analytics/:section` accepts `performance`, `integrations`, `sync`; the Analytics nav lists them; every analytics section is gated on `platform:reports:read` (a "Reports aren't available to your role" state otherwise) | `pages/Analytics.tsx`, `config/navigation.ts` |

**FR-8.4 (alerts) in this repo.** The platform events (`analytics.sync.failed`, `analytics.quota.paused`, `analytics.backfill.completed`) are routed by the backend to the platform notifications list; the console's notifications panel has no feed yet (PRD-005 known issue), so nothing more was built here. The Sync monitor's "Failing" table is the operator's view until the feed exists.

## UX notes (2026-10-22)

- **Periods.** Performance offers 7 / 30 / 90 days (source PRD FR-8.3) through the kit's `SegmentedControl`; the range is the last N calendar days ending today, sent as `DateRangeInput` picker days, like Platform revenue. The per-store tables are always 30-day figures (the usage snapshot), so their headers say "· 30d".
- **Deltas.** KPI arrows compare with the previous period of the same length; conversion rate shows a difference in points. A zero previous period shows no arrow ("—"), never "+Infinity". `growthPercent` −100 renders "—" (no sales in the previous period), as elsewhere in the console.
- **Health chips.** `OK` → "Synced" (green), `ERROR` → "Error" (red), `QUOTA_PAUSED` → "Quota paused" (amber), `BACKFILLING` → "Importing history" (blue), `NOT_CONNECTED` → "Not connected" (neutral), null (no analytics app) → "No analytics". Integration status: `ACTIVE` / `INACTIVE` / `ERROR`.
- **Errors.** `lastError` is cut at 60 characters on one line; the full text sits in a tooltip. Load failures use the kit's `ErrorState` with Retry; mutation failures go through `mutationFailureCopy` (`extensions.code` only; `FORBIDDEN` and `MFA_REQUIRED` are handled once by the Apollo link).
- **Re-run.** Not destructive, so the confirm is a normal modal with a primary button (not the red `ConfirmDialog`). The button is hidden for roles without `platform:tenants:manage`; the pending chip is shown to everyone.
- **Empty states.** "No installations yet" (Integration health, Sync monitor), "No installations match" with Clear filters, "Every connection synced on its last run.", "No history imports running.", and on the store page "No analytics app installed. The store connects Google Analytics 4 from its Apps hub."
- Charts use recharts through `components/ui/chart-theme.ts` (GMV area on the money axis, sessions and a dashed orders line on the count axis), as the repo's design system requires.

## Conventions for the code here

- One Apollo client; operations in `src/graphql/analytics.ts`; shapes in `src/types/platform-api.ts`; pure logic in `src/lib/analytics-health.ts` with tests; UI from the `components/ui` kit and tokens.
- Branch on `extensions.code` only. Client-side permission checks are UX; the backend guards `platform:reports:read` and `platform:tenants:manage`.

## Open questions that affect this repo

- None new. FR-8.4's console surface waits for the platform notifications feed (PRD-005 known issue).
- Not yet run in a browser against a live gateway (the console as a whole has not been, see `CLAUDE.md` §8).

## Implementation log

- 2026-10-22 · Source PRD approved by the owner (full scope). Pointer PRD created with this repo's FR-8.3 / FR-8.4 share.
- 2026-10-22 · **Implemented in this repo.** Contract documents, hooks, `lib/analytics-health` (+10 tests), Performance / Integration health / Sync monitor screens, Store sales on net revenue and server traffic fields, the store page's Analytics card and "Re-run sync", routes and nav. Checks: `tsc -b` clean; vitest 43/43 (was 33); `npm run validate:ops` 0 invalid, 0 over the depth limit; workspace contract validator 17 valid / 0 invalid; `vite build --mode development` OK (pre-existing chunk-size warning); oxlint only the pre-existing warnings; `lint:hex` 0. Not run in a browser against a live gateway.
