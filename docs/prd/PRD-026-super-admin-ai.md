# PRD-026 — Super Admin AI on existing data (pointer: zcom-super-admin)

| Field | Value |
|---|---|
| Status | **Implemented (console)** 2026-11-02: FR-7 built from the integration guide on `main` (working tree, not committed, deployed or run in a browser); deploy the PRD-026 backend first |
| Source-of-truth PRD | [`../../../zcom-backend/docs/prd/PRD-026-super-admin-ai.md`](../../../zcom-backend/docs/prd/PRD-026-super-admin-ai.md) |
| Guide | [`../../../zcom-backend/docs/architecture/super-admin-ai-console-integration.md`](../../../zcom-backend/docs/architecture/super-admin-ai-console-integration.md) |
| Created / Updated | 2026-11-02 / 2026-11-02 |
| Decision | Owner, 2026-11-02: "Review Super Admin AI: console integration guide and based on that proceed the integration" (changes backend PRD-026 Q7, which had given FR-7 to a separate console team) |

Requirements, contract and decisions live in the source-of-truth PRD. This repo implements **FR-7** (Home, the chat, the snapshot tabs, the Stores filters and columns, the AI settings additions).

## Review of the guide (2026-11-02)

Checked against the composed supergraph (`zcom-backend/services/gateway/dist/supergraph.graphql`) after the PRD-026 backend was merged into `microservice`:

- Every operation, type, field, enum and filter the guide names exists with the shape it gives (`platformAttention`, `platformMetrics`, `refreshPlatformMetrics`, the six `platformAssistant*` / `askZcomPlatform` operations, `PlatformTenantFilter`'s eleven new fields, `PlatformTenant.lifecycleStatus` / `riskScore` / `riskReasons`, `aiConfig.superadmin`). No contract gap.
- **Status line is stale:** "branch `feat/prd-026-super-admin-ai`, not deployed" — the backend was merged into `microservice` (PR #3) and pushed 2026-11-02, which starts the EB deploy.
- **§3 block 6 / FR-7.2 "wire the existing `Assistant` drawer":** not possible as written. `components/layout/Assistant.tsx` is a synced file (byte-identical with the dashboard) whose `onAsk` returns one finished answer: no polling, tool chips, rating or usage bar. The console follows the dashboard's PRD-021 pattern instead: its own panel and hook on the platform operations; the shared ask bar and command-palette entry open it.
- **Permission mirror:** `platform:ai:ask` was missing from the console's `lib/permissions.ts`; added (Owner and Admin, as in core).
- Minor: §11 "Changes" sits between §10 and §12.

## UX notes (this repo)

- The snapshot tabs are new sections of **Analytics** (`/analytics/money`, `retention`, `health`, `usage`, `merchant-sales`, `ai-cost`) beside the existing ones; each is shown only when its section came back (guide §2), never by role.
- Shared layer: `graphql/platform-insights.ts` (selections spelled out for the contract validator), `types/platform-insights.ts`, `lib/platform-insights.util.ts` (units, statuses, IST, labels, refresh and chat copy), `hooks/use-platform-insights.ts` (Home, snapshot per period, Refresh now with cooldown), `components/insights/MetricCard.tsx` (OK / SMALL_SAMPLE / UNAVAILABLE as a KPI cell) and `SnapshotHeader.tsx` ("Last updated · Refresh now").

## Implementation log (this repo)

### FR-7 — 2026-11-02 (working tree on `main`)

| FR | Console | Files |
|---|---|---|
| FR-7.1 Home | Banner, then "Last updated · Refresh now"; Money due this week (hidden without billing; rows → store billing); Stores at risk (reason tags, "+ N more" → `/stores?view=at-risk`); This month (`KpiStrip` of `MetricCard`: MRR, Collected, Outstanding, New stores live, Stores lost, AI cost; null ones skipped); New and in development (→ `?view=in-development`); What needs attention (bullets with store links, "Written …", amber "from <date>", empty and first-run copy). Earnings chart and Stores preview kept; the old KPI cards and `NeedsAttention` usage removed | `pages/Home.tsx`, `components/insights/home/*`, `lib/home-attention.util.ts` |
| FR-7.2 Chat | Own panel and hook on the platform operations (the synced `Assistant.tsx` can't poll; it stays byte-identical, only `AskBar` is used): runs polled ~1 s with `afterSeq`, tool chips, final text replaces the stream, cut-short / stopped / failed notes, Stop, Retry, 👍/👎, the internal budget bar, last 10 conversations (open, delete), new chat, `CONVERSATION_FULL`, `MFA_REQUIRED` → `/mfa`, store names linked; Markdown with raw HTML off and relative links only (the dashboard's renderer, no dependency); every entry point hidden without `platform:ai:ask`. The sample chat answers in `lib/aiSamples.ts` are removed | `components/assistant/*`, `hooks/use-ask-zcom-platform.ts`, `lib/ask-zcom-platform.util.ts`, `components/layout/DashboardLayout.tsx` |
| FR-7.3 Tabs | Analytics › Money, Retention, Platform health, Usage, Merchant sales, AI cost (`/analytics/<section>`), each gated on its section coming back; period select (7 periods, default this month); figure cells, breakdowns (MRR movement, cohort table, retention bands, churn reasons, event backlog, AI cost per store), store lists with lifecycle chips and risk tags; loading, error, first-run and permission states | `pages/Analytics.tsx`, `components/insights/tabs/*` |
| FR-7.3 Stores | Server-side filters through a light `PlatformTenantSignals` read (paged 100 until `totalCount`, never on `PlatformTenantFields`): lifecycle, at risk / overdue / dormant, category, source, city, state, account manager (from store profiles: `platformUsers` needs `users:manage`), tags (all of), age since go-live; saved views `?view=at-risk|overdue|dormant|in-development|churned` (`development` alias); Lifecycle and Risk columns (saved columns key bumped to `stores.v3`, layouts reset once); CSV export of the filtered rows. PRD-025 At risk tab kept | `components/clients/stores-list/*`, `graphql/tenants.ts` |
| FR-6 settings (§8) | AI settings › Super Admin AI: cooldown, Zerror monthly token budget, small-sample threshold, rate limit, at-risk days without login and sales drop %; only changed fields sent (nested); `INVALID_AI_CONFIG` shown under the nested field | `components/settings/AiSettings.tsx`, `graphql/ai.ts`, `lib/platform-ai.util.ts` |
| FR-7.4 Contract | Console manifest regenerated: 119/119 operations valid, 0 failures; costs `PlatformAttention` 928, `PlatformMetrics` 417, chat ≤ 54 (limit 5000) | `zcom-backend/scripts/validate-clients/manifests/zcom-super-admin.operations.json` |

Shared layer: see UX notes. `platform:ai:ask` added to `lib/permissions.ts`.

**Checks (2026-11-02):** `tsc -b` and `tsc -p tsconfig.app.json` clean (note: `tsc --noEmit -p .` checks nothing here, the root tsconfig only lists references); vitest **318 in 50 files** (+31 new); `vite build` passes; `check:synced` 61 files, 0 differ; `validate:ops` 0 invalid; `lint:hex` 0, `lint:px` 29/36; oxlint no new findings (pre-existing warnings in untouched files).

**Not done / open:** nothing has run in a browser or against the deployed backend; `lib/aiSamples.ts` still holds `platformBrief` (now used only by its own test) and `storeInsight` (the store page's insight card, outside FR-7); the states to test on staging per guide §10.3 (first run, stale, small sample, unavailable, a viewer without billing or AI permissions).
