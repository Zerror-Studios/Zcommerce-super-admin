# zcom-super-admin — docs index

This is the index of every document in this repo. **Keep it current:** any doc you add, rename or retire must be reflected here in the same change. Workflow rules are in `../CLAUDE.md` §0.

| Folder | Holds | Naming |
|---|---|---|
| `prd/` | Product requirement docs; T1 work needs one with Status *Approved* | `PRD-NNN-<slug>.md`, from `_TEMPLATE.md` |
| `architecture/` | Living analyses, contracts and diagrams of how the code works today | `<topic>.md` |
| `adr/` | Architecture decision records, immutable once Accepted (supersede, don't edit) | `ADR-NNN-<slug>.md`, from `_TEMPLATE.md` |
| `reviews/` | Code and design reviews | `YYYY-MM-DD-<slug>.md` |
| `audits/` | Security, performance and accessibility audits, with each finding's status (open, fixed or won't fix) | `YYYY-MM-DD-<slug>.md` |
| `changelog/` | One line per change (T1 and T2) | `YYYY-MM.md` |
| `design/` | The approved design spec for the restyle (owner decision 2026-10-15; no separate PRD) | `NN-<topic>.md`, `tokens.css`, `reference/*.png` |

## PRDs

| ID | Title | Status | Repos |
|---|---|---|---|
| [PRD-002](prd/PRD-002-audit-remediation.md) | Platform audit remediation (pointer; source of truth in `../zcom-backend/docs/prd/`): WS-G fixes SA-1 to SA-8 | Approved; round 1 done; rounds 2 and 3 needed no change here (source PRD Implemented 2026-10-14) | zcom-super-admin (+ all repos) |
| [PRD-005](prd/PRD-005-platform-admin-api.md) | Platform admin API and super-admin integration (pointer; source of truth in `../zcom-backend/docs/prd/`): this repo's phases (Apollo client, real sign-in + MFA, screens moved to the API domain by domain, report logic moved server-side, mock data deleted) | **Approved** 2026-10-17; Phases 1–3 implemented the same day (`api` mode: sign-in, MFA, Stores, lifecycle, subscription actions, billing rules, Home KPIs, Platform revenue, Collections with invoice actions, Transactions, Discounts, Reminders); Phase 4 open | zcom-super-admin, zcom-backend |
| [PRD-006](prd/PRD-006-billing-core-payment-provider.md) | Platform payment provider setting (pointer → backend `../../zcom-backend/docs/prd/PRD-006-billing-core-payment-provider.md`) | Implemented 2026-10-18 |
| [PRD-007](prd/PRD-007-shared-host-admin-login.md) | Shared platform hosts (pointer → backend): console on `platform.zerrorstudios.com`, store links to `store.zerrorstudios.com/store/{slug}` | **Approved** 2026-10-18 |
| [PRD-014](prd/PRD-014-production-readiness-remediation.md) | Production-readiness remediation (pointer → backend `../../zcom-backend/docs/prd/PRD-014-production-readiness-remediation.md`): FR-0.7 CSP `connect-src` for the API host, FR-0.9 synthetic chart and usage bars, FR-0.10 / D6 period-end plan changes (scheduled change shown, trials change now), audited "Activate without payment", no double payment record | **Approved** 2026-10-25; Wave 0 (W0-F) implemented 2026-10-25, not deployed; Wave 1 (W1-CONSOLE: CSRF client, forgot password, owner invites) implemented 2026-10-25, not committed; Wave 2 (W2-CONSOLE: coupon edits, paging, HTTP timeout, permission gating, jobs, usage history) implemented and verified 2026-10-26 (fix round W2V-C-01, W2V-C-06; Wave 2 exit PASS WITH NOTES), not committed | zcom-super-admin, zcom-backend |
| [PRD-012](prd/PRD-012-analytics-app-ga4-sync.md) | Analytics as an app (pointer → backend `../../zcom-backend/docs/prd/PRD-012-analytics-app-ga4-sync.md`): this repo's FR-8.3 dashboards (Performance, Integration health, Sync monitor), Store sales on the server's net revenue and traffic fields, the store page's Analytics card and "Re-run sync" | **Implemented (console)** 2026-10-22 | zcom-super-admin, zcom-backend |
| [PRD-016](prd/PRD-016-subscription-proration-entitlements.md) | Subscription proration, entitlements and dunning (pointer → backend `../../zcom-backend/docs/prd/PRD-016-subscription-proration-entitlements.md`); this repo's FR-26: plan-change preview, Flagged payments tab (apply / refunded outside / dismiss), store billing card (state, dates, credits, record refund, reactivate override with reason), dunning and entitlement-mode settings, coupons by plan id | **Approved** 2026-10-26 (D6/D7 gated for the dunning switch-on) · not started | zcom-super-admin, zcom-backend |
| [PRD-017](prd/PRD-017-plan-management-merchant-billing.md) | Plan management and merchant billing (pointer → backend `../../zcom-backend/docs/prd/PRD-017-plan-management-merchant-billing.md`): this repo's FR-4 (Settings › Plans with versions, archive and migrate; Store detail › Billing eligible plans and custom plans; Billing › Invoices with server paging; store edit form) and FR-3.2 settings (bank-transfer text, support contact) | **Approved** 2026-10-26 (D1–D13; D8 gated on the CA); not started | zcom-super-admin, zcom-backend |
| [PRD-018](prd/PRD-018-tenant-data-lifecycle.md) | Tenant data lifecycle (pointer → backend `../../zcom-backend/docs/prd/PRD-018-tenant-data-lifecycle.md`): this repo's Store detail › Lifecycle (category suspend, money in flight, guarded delete, restore, exports), Go live tab (domain verification, checklist), purged stores, data-request counts | **Approved** 2026-10-26 (D1–D19; legal-dependent parts gated on the lawyer); not started | zcom-super-admin, zcom-backend |
| [PRD-019](prd/PRD-019-gst-invoicing.md) | GST invoicing (pointer → backend `../../zcom-backend/docs/prd/PRD-019-gst-invoicing.md`); this repo: Settings › Legal profile, client Billing profile, proforma / tax invoice / credit note in Billing › Invoices, downloads | Approved 2026-10-26 (owner: 'please review and approve the six drafted follow-up PRDs'); not started; tax content gated on the owner's CA | zcom-super-admin |
| [PRD-021](prd/PRD-021-zcom-ai-layer-1.md) | ZCOM AI Layer 1 (pointer → backend `../../zcom-backend/docs/prd/PRD-021-zcom-ai-layer-1.md`; API guide §9): this repo's AI area (Overview, Usage by store with CSV, Top-up requests, Data health, Benchmarks, Settings › `ai_config`) and the store page's AI section (pause, limit overrides, grant questions, audited top questions) | **Implemented (console)** 2026-10-26 on `feat/console-zcom-ai`; not committed or deployed | zcom-super-admin, zcom-backend |
| [PRD-024](prd/PRD-024-console-data-completeness.md) | Complete, actual data on every console tab (pointer → backend `../../zcom-backend/docs/prd/PRD-024-console-data-completeness.md`): Phase A console fixes here, console side of Phases B–D | **Implemented** 2026-10-27 (Phases A–C, not committed); Phase D approved (D6–D9), console side built 2026-10-27, waiting for the backend fields | zcom-super-admin, zcom-backend |

## Architecture

| Doc | Purpose | Last verified |
|---|---|---|
| [solution-architecture.md](architecture/solution-architecture.md) | **Start here.** Platform console design: current mock-data architecture, routes, domain model, subscription-health logic, [Target] backend integration and the ADRs it needs (Mermaid). Parent: `../ARCHITECTURE.md` (workspace) | 2026-10-13 (route map and hooks: 2026-10-22, PRD-012) |

## Design spec

| Doc | Purpose |
|---|---|
| [design/README.md](design/README.md) | **Start here for UI work.** Index of the spec and the rules every screen follows |
| [design/01-foundations.md](design/01-foundations.md) | Type (Geist), colour tokens, spacing, radii |
| [design/02-components.md](design/02-components.md) | The shared kit (`src/components/ui`) and how each component behaves |
| [design/03-merchant-admin.md](design/03-merchant-admin.md) | Merchant admin screens (reference; lives in `../zcom-frontend`) |
| [design/04-super-admin.md](design/04-super-admin.md) | Super Admin screens: Home, Stores, Collections, Analytics, Settings |
| [design/05-wording.md](design/05-wording.md) | Wording, dates and numbers |
| [design/06-qa-checklist.md](design/06-qa-checklist.md) | Visual QA checklist |
| [design/tokens.css](design/tokens.css) | Spec copy of the tokens (`src/styles/tokens.css` is the one the app loads) |

## ADRs

| ID | Decision | Status |
|---|---|---|
| — | _none yet_ | |

## Reviews and audits

| Date | Doc | Scope | Open findings |
|---|---|---|---|
| 2026-10-27 | [Console data review](reviews/2026-10-27-console-data-review.md) | Every tab traced to the backend: 7 broken, 15 backend approximations, 11 browser-derived, 10 placeholders, 1 data gap; fixes planned in PRD-024 | Open |
| 2026-10-17 | [platform-admin integration review](../../zcom-backend/docs/reviews/2026-10-17-platform-admin-integration-review.md) (in zcom-backend) | Security, performance and console findings for the PRD-005 integration; console items in §3.3 (C-H1..H4 and C-M2/M3 fixed with the mock removal; role gating, MFA routing, debounce, Vercel rewrite and headers open) | Open |
| 2026-10-14 | [2026-10-14-super-admin-audit.md](audits/2026-10-14-super-admin-audit.md) | Console: exposure, report-logic bugs, vocabulary (status table inside) | 0 code findings open; owner actions and 4 npm audit findings pending |
