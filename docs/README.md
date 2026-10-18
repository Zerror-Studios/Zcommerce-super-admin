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
| [PRD-007](prd/PRD-007-shared-host-admin-login.md) | Shared platform hosts (pointer → backend): console on `platform.zcommerce.com`, store links to `admin.zcommerce.com/store/{slug}` | **Approved** 2026-10-18 |

## Architecture

| Doc | Purpose | Last verified |
|---|---|---|
| [solution-architecture.md](architecture/solution-architecture.md) | **Start here.** Platform console design: current mock-data architecture, routes, domain model, subscription-health logic, [Target] backend integration and the ADRs it needs (Mermaid). Parent: `../ARCHITECTURE.md` (workspace) | 2026-10-13 |

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
| 2026-10-17 | [platform-admin integration review](../../zcom-backend/docs/reviews/2026-10-17-platform-admin-integration-review.md) (in zcom-backend) | Security, performance and console findings for the PRD-005 integration; console items in §3.3 (C-H1..H4 and C-M2/M3 fixed with the mock removal; role gating, MFA routing, debounce, Vercel rewrite and headers open) | Open |
| 2026-10-14 | [2026-10-14-super-admin-audit.md](audits/2026-10-14-super-admin-audit.md) | Console: exposure, report-logic bugs, vocabulary (status table inside) | 0 code findings open; owner actions and 4 npm audit findings pending |
