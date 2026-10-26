# PRD-021 — ZCOM AI Layer 1 (pointer: zcom-super-admin)

| Field | Value |
|---|---|
| Status | **Implemented (console)** 2026-10-26 (working tree on `feat/console-zcom-ai`; not committed or deployed). Source PRD Approved 2026-10-24 |
| Source-of-truth PRD | [`../../../zcom-backend/docs/prd/PRD-021-zcom-ai-layer-1.md`](../../../zcom-backend/docs/prd/PRD-021-zcom-ai-layer-1.md) |
| API guide | [`../../../zcom-backend/docs/architecture/zcom-ai-frontend-integration.md`](../../../zcom-backend/docs/architecture/zcom-ai-frontend-integration.md) §9 |
| Approved by / on | Workspace owner / 2026-10-24 (source PRD); the console build approved 2026-10-26 ("Review this Integration Plan and Implement it", then "Dashboard + console"; supersedes the 2026-10-25 "backend only" decision, source PRD §10) |
| Created / Updated | 2026-10-26 / 2026-10-26 |

Requirements, decisions, limits and the contract live in the source-of-truth PRD and the API guide. This file holds only **this repo's** UX and implementation notes (source FR-6, the super admin AI).

## This repo's work

| Source FR | Screen | As built |
|---|---|---|
| FR-6.3 | **AI › Overview** (`/ai/overview`) | `aiPlatformTotals`: spend today against the daily cap, spend this month (USD and INR) against the budget, questions, cost per question, cache hit rate, refusals and failures, spend per model. A red note when `dailyCapReached` (merchants see "resting"); an amber banner listing `alertsCrossed` |
| FR-6.2 | **AI › Usage by store** (`/ai/usage`) | `aiUsageByTenant` (server order: most expensive first), debounced search, 25 a page, Paused / AI off chips, this week against the weekly limit (red at 100 %), cost in USD with INR beneath; a row opens the store. **Download CSV** reads `aiUsageCsv` and saves `ai-usage-<day>.csv` with exactly one UTF-8 BOM |
| FR-6.4 | **AI › Top-up requests** (`/ai/top-ups`) | `aiTopUpRequests(status: OPEN)`, 25 a page; **Grant** (`grantAiTopUp`: 1–10,000 questions, optional note, shows the expiry) and **Dismiss** (`dismissAiTopUpRequest`, confirmed; `false` = already handled). Manage only; others see "View only" |
| FR-6.5 | **AI › Data health** (`/ai/data-health`) | `aiDataHealth(needsAttention: true)`, 25 a page: the reasons per store (failed run, cost coverage under 80 %, Business settings missing), spend months, whether Profitability is visible, last run; a row opens the store |
| FR-6.6 | **AI › Benchmarks** (`/ai/benchmarks`) | `aiBenchmarks(period)` with a Last 30 days / All time selector; p25, median, p75 in the metric's unit; empty state until enough stores have data |
| FR-6.4 | **AI › Settings** (`/ai/settings`) | `aiConfig` for everyone with `platform:ai:read`; editable with `platform:ai:manage`. Sends **only the changed fields** (`updateAiConfig`), pricing as the changed models' rows; budget alerts typed as percentages and sent as fractions; local checks mirror the server's limits; `INVALID_AI_CONFIG` shown on its field (nested paths like `pricing.0.inputPerMTok` on the top-level field); "within 60 seconds" after saving |
| FR-6.4 | **Store detail › AI** (section on `stores/:id`) | `aiTenantSetting`: paused chip and reason, the three limits ("Plan value" when null, "Fair use" for -1); **Pause / Resume AI** (`setTenantAiPaused`, optional reason), **Edit limits** (`setTenantAiOverride`), **Grant questions**; **Most-asked questions** (`aiTopQuestions`) load only when the operator presses Show, with a note that viewing is audit-logged |

## Implementation notes

- **Permissions.** `lib/permissions.ts` mirrors the backend's `platform:ai:read` / `platform:ai:manage` (BILLING_MANAGER reads; PLATFORM_OWNER and PLATFORM_ADMIN manage; READ_ONLY reads). The AI nav entry is hidden without `platform:ai:read` (`visibleNavItems` in `config/navigation.ts`; `NavItem` is a SYNCED type, so the rule lives beside the list), and `/ai/*` shows a lock page for a role without it. `MFA_REQUIRED` goes through the Apollo link as everywhere else.
- **Overrides are sent whole.** The server treats an omitted override field like `null` (back to the plan), so `aiOverrideInput` always sends all three; empty = plan value, "Fair use" = -1.
- **Cache.** `PlatformAiTenantSetting` is keyed by `tenantId` and `PlatformAiConfig` is a singleton, so a change's response updates the screen without a refetch. Top questions are `network-only` (each view is a new audit row).
- **Money** is shown only here: USD with paise (four decimals under $1), INR whole rupees. Merchants never see it (source FR-6).
- **Files:** `src/graphql/ai.ts`, `src/hooks/use-platform-ai.ts`, `src/lib/platform-ai.util.ts` (+ test), `src/components/ai/{AiOverviewTab,AiUsageTab,AiTopUpsTab,AiDataHealthTab,AiBenchmarksTab,AiConfigTab,GrantTopUpDialog}.tsx`, `src/components/clients/ClientAiCard.tsx`, `src/pages/Ai.tsx`; edits in `App.tsx`, `config/navigation.ts`, `components/layout/DashboardLayout.tsx`, `pages/ClientDetail.tsx`, `lib/permissions.ts` (+ test), `lib/apollo-client.ts` (two key rules), `types/platform-api.ts`.
- **No new dependency.** No SYNCED kit file was changed (`check:synced`: 0 differ).

## Implementation log

- 2026-10-26 · Pointer created with the console build. `validate:clients` 89/89 operations (14 new; manifest refreshed in `zcom-backend/scripts/validate-clients/manifests/zcom-super-admin.operations.json`); vitest 163 (18 new: `lib/platform-ai.util.test.ts` 17, permissions +1); `tsc -b`, `vite build` (with `VITE_GATEWAY_URL`), `lint:hex`, `check:synced`, `validate:ops` pass; oxlint shows no warning in the new files (the existing ones are unchanged). Deploy the backend first (the operations need the PRD-021 platform-admin API).
- Not built here: the console's own "Ask AI" bar is still the sample-copy assistant (`lib/aiSamples.ts`); wiring it to a real model is not part of FR-6.
