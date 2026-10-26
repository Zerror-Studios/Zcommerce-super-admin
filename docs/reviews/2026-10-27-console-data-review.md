# Console data review: is every tab showing real, complete data? (2026-10-27)

| Field | Value |
|---|---|
| Scope | Every screen of the platform console: Home, Stores, store page, Add store, Billing (all tabs), Analytics (Revenue, Store sales, Performance, Integration health, Sync monitor), AI (all tabs), Settings (all sections), the shell (notifications, assistant, search) |
| Method | Read-only trace of each widget: component → hook → `src/graphql/*` operation → platform-admin resolver → service. Nothing run against a database. `validate:clients --all`: **89/89** console operations valid (no field is missing from the schema) |
| Requested by | Workspace owner, "Review the Super Admin Dashboard. Need to integrate proper API with complete actual data throughout the tabs" |
| Follow-up | [PRD-024](../prd/PRD-024-console-data-completeness.md) (pointer; source of truth in `zcom-backend/docs/prd/`) |
| Status | Open: every item is assigned to a PRD-024 FR |

## 1. Summary

Every screen calls the real API, and every money figure comes from the server; there is no mock data left. The console still misleads in five ways:

1. **Mislabelled or mixed measures**: KPIs whose number isn't what the label says (e.g. "3-month average" plots MRR; "Billed this month" mixes cash in the range with every open invoice).
2. **Browser maths on partial data**: counts, filters and totals over the loaded page only, values back-computed from percentages, plans matched by tier name.
3. **Backend approximations**: past MRR rebuilt from today's subscriptions; rolling 30-day snapshot values summed as "per day" and shown for 7/90-day ranges; growth +100 % / −100 % when the previous period was 0.
4. **Placeholders presented as features**: AI-styled brief, store insight and assistant answers are templates (`ai-flag.ts` is always on); the notifications bell has no backend; the Performance card is empty; SMS/WhatsApp reminders are queued but never sent.
5. **Two real bugs**: a settings load failure lets Save overwrite the server with defaults, and the Collections plan filter can empty the table.

Classes: **1** real · **2** browser-derived · **3** placeholder · **4** backend approximation or stub · **5** broken.

## 2. Findings register

Paths: `FE` = `zcom-super-admin/src`, `BE` = `zcom-backend/services/platform-admin/src`, `rpt` = `BE/services/platform-reports.service.ts`. FR = the PRD-024 requirement that fixes it.

### 2.1 Broken (class 5)

| # | Finding | Evidence | FR |
|---|---|---|---|
| D-01 | Settings query error is swallowed: the form shows `DEFAULT_PLATFORM_SETTINGS` with Save enabled, so saving resets provider, bank text and year kind | FE `providers/SettingsProvider.tsx:88-95` (no `error` in the context) | FR-1.1 |
| D-02 | Collections plan filter sends the id of the first plan with that tier name; the server looks it up only among subscribed plan versions, so the table can go empty | FE `components/billing/SubscriptionReportsTab.tsx:179`, rpt:591 | FR-1.2 |
| D-03 | Store page plan usage and Add store match plans by tier name across every store's plans (custom plans, newer versions): wrong limits, and Add store can offer another store's custom plan (`PLAN_OTHER_TENANT`) | FE `pages/ClientDetail.tsx:96-99`, `pages/AddClient.tsx:205` | FR-1.3 |
| D-04 | Grace period "saved" toast fires before the mutation resolves | FE `ClientBillingTab.tsx:90,100` | FR-1.4 |
| D-05 | Revenue trend line labelled "3-month average" plots MRR | FE `RevenueReportsTab.tsx:236,265` | FR-1.5 |
| D-06 | Performance "GMV per day" sums each day's rolling 30-day totals | `BE/services/platform-analytics.service.ts:156,200` | FR-3.3 |
| D-07 | Reminder channel switches can be toggled by read-only users | FE `BillingRulesSettings.tsx:201-209` | FR-1.4 |

### 2.2 Backend approximations and stubs (class 4)

| # | Finding | Evidence | FR |
|---|---|---|---|
| A-01 | `growthPercentOf` returns +100 when the previous period was 0 and −100 for 0/0: fake "+100 %", "Orders declining" health factor, insight "down 100 %" | `BE/jobs/usage-snapshot.job.ts:152` | FR-2.1 |
| A-02 | Past MRR rebuilt from each store's **current** subscription; cancelled stores vanish from history | rpt:470-477, `mrrAt` :291 | FR-3.1 |
| A-03 | Performance 7/30/90-day picker never changes the window (latest rolling-30-day snapshot); comparisons are 30 vs 30 | `platform-analytics.service.ts:140` | FR-3.3 |
| A-04 | Projected year and "Monthly billing" include TRIAL and PAST_DUE subscriptions; `kpis.activeMrr` fetched, never shown | rpt:494, :531 | FR-2.2 |
| A-05 | Collections "Billed" and collection rate = cash in range + every open invoice; Pending/Overdue count all open invoices under a "this month" label | rpt:647-648, :663, :738 | FR-2.3 |
| A-06 | Collections Invoices tab loads from the previous period start; `paymentMethod` always "—" | rpt:545, :618 | FR-2.3 |
| A-07 | Bookings count REFUNDED invoices; gateway rows are a fixed list; summary collection rate uses all-time outstanding | rpt:324, :208, :535 | FR-2.4 |
| A-08 | Churn uses CANCELLED + `updatedAt` | rpt:657 | FR-3.2 |
| A-09 | Earned sums `payment_log` by `createdAt`, not paid date; "x of N stores paid" counts trials | rpt:481 | FR-2.2 |
| A-10 | Outstanding, Top stores and Integration health include DELETED stores | rpt:497, `platform-analytics.service.ts:131` | FR-2.5 |
| A-11 | Overall conversion divides all orders by sessions, including stores without GA4 | `platform-analytics.service.ts:193` | FR-2.6 |
| A-12 | Month-over-month compares a partial current month with a full previous one | rpt:411 | FR-2.4 |
| A-13 | Usage snapshot covers ACTIVE stores only; a store with a collector error keeps an old row with no age shown | `usage-snapshot.job.ts` | FR-2.7 |
| A-14 | SMS/WhatsApp reminders are queued and counted as "queued" but notification drops them (no platform SMS account) | `platform-reminder.service.ts:57,147`; notification `platform-billing-mail.subscriber.ts:20` | FR-1.8 (hide) / Q3 |
| A-15 | AI "Questions this month" counts every chat call (failed, refused, cached); Usage counts answered only | `platform-ai.service.ts:295` vs :207 | FR-2.8 |

### 2.3 Browser-derived (class 2)

| # | Finding | Evidence | FR |
|---|---|---|---|
| B-01 | Transactions header counts, search and status filter apply to the loaded 200 rows although the server supports `search` and `status` | FE `pages/Billing.tsx:30-37`, `TransactionsTab.tsx:68-84` | FR-1.6, FR-3.5 |
| B-02 | Store sales tab sums the latest snapshots in the browser, back-computes the previous period from `growthPercent`, mixes currencies | FE `lib/store-sales.ts` | FR-3.4 |
| B-03 | `toClient` turns a missing snapshot into real-looking zeros and drops `usage.date`, `staffCount`, `region`, `tenant.plan` | FE `lib/api-adapters.ts:92-137` | FR-1.3, FR-1.7 |
| B-04 | "Live" = not suspended and not trial (PAST_DUE, CANCELLED, failed provisioning shown as Live), contradicting PRD-018 `liveAt` | FE `lib/api-adapters.ts:27-31`, `storeStatus.ts:22` | FR-1.9 / Q4 |
| B-05 | Needs attention and Reminders compute "overdue" from `renewalDate`; the server's `daysOverdue` is dropped by the adapter | FE `NeedsAttention.tsx:50,72,92`, `AutomationSettingsTab.tsx:95-145` | FR-1.7 |
| B-06 | Header/sidebar store counts use loaded rows, not `totalCount`; "N live · unpaid · overdue" counted from loaded rows | FE `ClientsPageContent.tsx:30-51`, `DashboardLayout.tsx:111` | FR-1.6 |
| B-07 | Discounts search and status filter the loaded 100 only | FE `CouponsTab.tsx:161` | FR-3.5 |
| B-08 | Plan filter options and plan column use the hard-coded tier enum; custom plans and versions hidden | FE `display-labels.util.ts:25`, `ClientsTable.tsx:405` | FR-1.3 |
| B-09 | Transactions plan column shows the store's current plan, not the payment's `planName` | FE `TransactionsTab.tsx` | FR-1.6 |
| B-10 | Add store price hint is always monthly; timezone and currency never sent | FE `AddClient.tsx:210` | FR-1.4 |
| B-11 | AI top-ups show OPEN only; Data health hides healthy and never-computed stores; store AI card shows no usage | FE `hooks/use-platform-ai.ts:93,108`, `ClientAiCard.tsx` | FR-1.10, FR-3.6 |

### 2.4 Placeholders (class 3)

| # | Finding | Evidence | FR |
|---|---|---|---|
| P-01 | Home "Today's brief", store "insight" and the Ask AI panel are templates styled as AI (`isAiEnabled()` always true); the brief's "critical" (< 50) disagrees with Needs attention (< 30) | FE `lib/aiSamples.ts`, `components/ui/ai-flag.ts` | FR-1.11 / Q2 |
| P-02 | Notifications bell is always empty; no backend feed exists | FE `DashboardLayout.tsx:57-58,144-155` | FR-4.1 / Q1 |
| P-03 | Store page Performance card is empty although monthly snapshots exist (`platformUsage`) | FE `ClientOverviewTab.tsx:103-108` | FR-1.12 |
| P-04 | Store page has no Activity section although `platformAuditLog` filters by tenant | FE `ClientDetail.tsx:64` | FR-1.12 |
| P-05 | Plan usage: storage limit always "No limit", staff and messages not shown, bandwidth always null | FE `ClientUsageTab.tsx:32-47` | FR-1.12, FR-3.7 |
| P-06 | Shell: "one shared account" identity copy, hard-coded `APP_VERSION`, mislabelled Pending ("Awaiting settlement"), Sync monitor "Failing" copy, Benchmarks empty below 10 stores with no explanation | FE `DashboardLayout.tsx:24,166`, `RevenueReportsTab.tsx:201`, `SyncMonitorTab.tsx`, `AiBenchmarksTab.tsx` | FR-1.5 |
| P-07 | Invoice detail has no status history, linked payments or PDF | FE `InvoiceParts.tsx:48` | FR-3.8 |
| P-08 | Reminder send history not exposed (`platform_reminder_log` exists) | — | FR-3.9 |
| P-09 | Settings has no profile/security section (password change, sessions, MFA management) | — | Q5 |
| P-10 | Platform jobs: Run now only, no last-run status or history | FE `PlatformJobsCard` | FR-3.10 |

### 2.5 Data gap

| # | Finding | Evidence | FR |
|---|---|---|---|
| G-01 | Migrated stores (PRD-003) have no `owner` or `billing` contact: owner shows "—", Resend invite has no address | `zcom-backend/scripts/migration/src/steps/master/tenant-doc.step.ts` | Q6 |

## 3. What is already right

Stores list and paging, removed stores, store lifecycle, go live, money in flight, subscription actions and change plan, platform billing (invoices, credits, refunds), Billing › Invoices, Flagged and Stuck payments, Plans, Team, Audit log (prefix search), Integration health and Sync monitor rows, AI overview spend and caps, AI usage CSV, AI settings. These are server data end to end.
